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

function extractFunctionErrorMessage(
  payload: unknown,
  functionName: string,
  status: number,
) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message =
      (typeof record.error === "string" && record.error) ||
      (typeof record.message === "string" && record.message) ||
      (typeof record.code === "string" && record.code);

    if (message) return message;
  }

  return `Failed to invoke ${functionName} (${status})`;
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

export async function invokeProtectedFunction<T>(
  functionName: string,
  options: InvokeProtectedFunctionOptions = {},
): Promise<T> {
  const accessToken = await getFreshAccessToken();
  const request = buildFunctionRequest(functionName, options);
  request.headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

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
}
