import { createClient } from "@/lib/supabaseClient";

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

  return {
    accessToken: session.access_token,
    supabase,
  };
}

export async function invokeProtectedFunction<T>(
  functionName: string,
  options: InvokeProtectedFunctionOptions = {},
): Promise<T> {
  const { accessToken, supabase } = await getFreshAccessToken();

  const { data, error } = await (supabase as any).functions.invoke(functionName, {
    body: options.body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });

  if (error) {
    throw new Error(error.message || `Failed to invoke ${functionName}`);
  }

  return data as T;
}
