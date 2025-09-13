import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createClient(): SupabaseClient {
  // Get environment variables from Vite
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Handle missing environment variables gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not found. Some features may not work.');
    // Return a mock client for development/demo purposes
    const mock = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signInWithOAuth: () => Promise.resolve({ data: null, error: null }),
        signInWithPassword: () => Promise.resolve({ data: null, error: null }),
        signUp: () => Promise.resolve({ data: null, error: null }),
        resetPasswordForEmail: (_email: string, _options?: any) =>
          Promise.resolve({ data: null, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: (_event: any, _cb?: any) => ({
          data: {
            subscription: { unsubscribe: () => void 0 },
          },
          error: null,
        }),
      },
      storage: {
        from: (_bucket: string) => ({
          createSignedUrl: async (_path: string, _expiresIn: number) => ({ data: { signedUrl: '' }, error: null }),
          upload: async () => ({ data: null, error: null }),
          download: async () => ({ data: null, error: null }),
        }),
      },
      functions: {
        invoke: async (_name: string, _opts?: any) => ({ data: null, error: null }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
      }),
      channel: () => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      }),
    } as unknown as SupabaseClient;
    return mock;
  }

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // Avoid noisy 403s: if there is no session, don’t call /auth/v1/user
  try {
    const authAny = (client as any).auth;
    const originalGetUser = authAny.getUser.bind(authAny);
    authAny.getUser = async (...args: any[]) => {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.access_token) {
          return { data: { user: null }, error: null };
        }
      } catch {
        // fall through to original call if session check fails
      }
      // If there is a token, try getUser; on 401/403 attempt refresh then retry once.
      const exec = async () => originalGetUser(...args);
      const res = await exec();
      const err = (res as any)?.error;
      const isAuthErr = err && (String(err.status || '').startsWith('40') || /forbidden|unauthorized/i.test(String(err.message || '')));
      if (isAuthErr) {
        try {
          await client.auth.refreshSession();
          const retry = await exec();
          const retryErr = (retry as any)?.error;
          const retryAuthErr = retryErr && (String(retryErr.status || '').startsWith('40') || /forbidden|unauthorized/i.test(String(retryErr.message || '')));
          if (!retryAuthErr) return retry;
        } catch {}
        // Clear bad session to stop repeated 403s
        try { await client.auth.signOut(); } catch {}
        return { data: { user: null }, error: null };
      }
      return res;
    };
  } catch {
    // non-fatal; keep default behavior
  }

  return client;
}
