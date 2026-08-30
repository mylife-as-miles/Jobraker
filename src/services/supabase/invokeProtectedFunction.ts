import { createClient } from "@/lib/supabaseClient";
import { sanitizeStructuredPayload } from "@/lib/inputSecurity";

type InvokeProtectedFunctionOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

const SESSION_REFRESH_BUFFER_MS = 60_000;

async function getFreshAccessToken() {
  const supabase = createClient();

  const {
    data: { session: initialSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to read your session");
  }

  let session = initialSession;
  const expiresAtMs =
    typeof session?.expires_at === "number" ? session.expires_at * 1000 : null;

  if (
    !session?.access_token ||
    (expiresAtMs !== null &&
      expiresAtMs - Date.now() <= SESSION_REFRESH_BUFFER_MS)
  ) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error(
        error.message || "Your session has expired. Please sign in again.",
      );
    }
    session = data.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return session.access_token;
}

export function sanitizeClientAiError(message: string, status?: number): string {
  if (!message || typeof message !== "string") {
    return status === 429
      ? "AI capacity is temporarily limited due to high demand. Please try again in a moment."
      : "An unexpected error occurred. Please try again.";
  }

  const lower = message.toLowerCase();
  if (
    status === 429 ||
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("googlegenerativeai") ||
    lower.includes("generativelanguage.googleapis.com") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("exhausted your capacity") ||
    lower.includes("prepaid credits") ||
    lower.includes("check quota")
  ) {
    return "AI generation is temporarily experiencing high demand. Please try again in a few moments.";
  }

  if (
    status === 403 ||
    lower.includes("permission_denied") ||
    lower.includes("denied access") ||
    lower.includes("provider_access_denied")
  ) {
    return "The AI service is temporarily undergoing maintenance. Please try again shortly.";
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes("overloaded") ||
    lower.includes("service unavailable") ||
    lower.includes("provider_temporarily_unavailable")
  ) {
    return "The AI service is temporarily taking longer than usual to respond. Please try again in a moment.";
  }

  // Strip stack trace leaks (e.g. "at file:///...", "at Object...", "at ModuleLoader...")
  if (message.includes("\n    at ") || message.includes("    at ")) {
    return message.split(/\n\s*at\s+/)[0].trim() || "An error occurred while processing your request.";
  }

  return message;
}

function extractFunctionErrorMessage(
  payload: unknown,
  functionName: string,
  status: number,
) {
  let message = "";
  if (typeof payload === "string" && payload.trim()) {
    message = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    message =
      (typeof record.error === "string" && record.error) ||
      (typeof record.message === "string" && record.message) ||
      (typeof record.code === "string" && record.code) ||
      "";
  }

  if (!message) {
    if (status === 429) {
      return "AI generation is temporarily experiencing high demand. Please try again in a few moments.";
    }
    return `Failed to invoke ${functionName} (${status})`;
  }

  return sanitizeClientAiError(message, status);
}

function buildFunctionRequest(functionName: string, options: InvokeProtectedFunctionOptions) {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured for Edge Function access.");
  }

  const headers = new Headers(options.headers ?? {});
  headers.set("apikey", supabaseAnonKey);
  headers.set("accept", "application/json");

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (
      typeof FormData !== "undefined" &&
      options.body instanceof FormData
    ) {
      body = options.body;
    } else if (
      options.body instanceof Blob ||
      options.body instanceof URLSearchParams ||
      typeof options.body === "string"
    ) {
      body = options.body;
    } else {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      body = JSON.stringify(sanitizeStructuredPayload(options.body));
    }
  }

  return {
    url: `${supabaseUrl}/functions/v1/${functionName}`,
    headers,
    body,
  };
}

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_NETWORK_RETRIES = 1;
const RETRY_DELAY_MS = 2_000;

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("networkerror")
  );
}

export async function invokeProtectedFunction<T>(
  functionName: string,
  options: InvokeProtectedFunctionOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
    try {
      const accessToken = await getFreshAccessToken();
      const request = buildFunctionRequest(functionName, options);
      request.headers.set("Authorization", `Bearer ${accessToken}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const raw = await response.text();
      let payload: unknown = null;

      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      if (!response.ok) {
        throw new Error(
          extractFunctionErrorMessage(payload, functionName, response.status),
        );
      }

      return payload as T;
    } catch (err) {
      lastError = err;

      // Only retry on transient network errors (connection drops, DNS timeouts)
      if (
        isTransientNetworkError(err) &&
        attempt < MAX_NETWORK_RETRIES
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      // Rethrow AbortError as a friendlier timeout message
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `Request to ${functionName} timed out after ${DEFAULT_TIMEOUT_MS / 1000}s. Check your connection and try again.`,
        );
      }

      throw err;
    }
  }

  throw lastError;
}
