import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, AuthError } from '@supabase/supabase-js'

let _cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_cached) return _cached;
  // Get environment variables from Vite
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

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
  console.log(import.meta.env, "OZOO")

  // Avoid noisy 403s: if there is no session, don’t call /auth/v1/user
  // Attach a lightweight auth state listener once to capture invalid refresh scenarios
  try {
    let handledInvalid = false;
    client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') return; // normal path
      if (event === 'SIGNED_OUT') return;
      // If session is null but we previously had one, sign out fully
      if (!session && !handledInvalid) {
        handledInvalid = true;
        return;
      }
    });
  } catch { }

  // Wrap refreshSession to detect invalid refresh token errors and force sign-out once.
  const originalRefresh = client.auth.refreshSession.bind(client.auth);
  (client.auth as any).refreshSession = async (...args: any[]) => {
    try {
      return await originalRefresh(...args);
    } catch (e: any) {
      const msg = (e as AuthError)?.message || '';
      if (/invalid refresh token/i.test(msg) || /refresh token not found/i.test(msg)) {
        try { await client.auth.signOut(); } catch { }
        // Surface a normalized object so callers treat it as logged out instead of looping
        return { data: { session: null }, error: null };
      }
      throw e;
    }
  };

  _cached = client;
  return _cached;
}
