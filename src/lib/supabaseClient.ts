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

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Global flag to prevent multiple invalid token handlers from running
  let handledInvalidToken = false;

  // Global auth state listener to handle invalid refresh token errors
  client.auth.onAuthStateChange(async (event, session) => {
    // Handle normal events
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') return;
    
    // If session is null unexpectedly, it might be due to an invalid refresh token
    if (!session && event !== 'SIGNED_IN' && !handledInvalidToken) {
      handledInvalidToken = true;
      console.warn('Session lost, clearing auth state');
      try {
        await client.auth.signOut();
        // Clear any stale tokens from localStorage
        localStorage.removeItem('supabase.auth.token');
        // Redirect to login if not already there
        if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
          window.location.href = '/signin';
        }
      } catch (err) {
        console.error('Error during forced sign out:', err);
      }
    }
  });

  // Wrap refreshSession to detect invalid refresh token errors and force sign-out
  const originalRefresh = client.auth.refreshSession.bind(client.auth);
  (client.auth as any).refreshSession = async (...args: any[]) => {
    try {
      const result = await originalRefresh(...args);
      // Reset the flag on successful refresh
      if (result.data?.session) {
        handledInvalidToken = false;
      }
      return result;
    } catch (e: any) {
      const msg = (e as AuthError)?.message || '';
      const isInvalidToken = /invalid refresh token/i.test(msg) || 
                            /refresh token not found/i.test(msg) ||
                            /refresh token.+expired/i.test(msg);
      
      if (isInvalidToken && !handledInvalidToken) {
        handledInvalidToken = true;
        console.warn('Invalid refresh token detected, signing out');
        try {
          await client.auth.signOut();
          // Clear any stale tokens from localStorage
          localStorage.removeItem('supabase.auth.token');
          // Redirect to login
          if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
            window.location.href = '/signin';
          }
        } catch (err) {
          console.error('Error during forced sign out:', err);
        }
        // Return a clean state instead of throwing
        return { data: { session: null, user: null }, error: null };
      }
      throw e;
    }
  };

  _cached = client;
  return _cached;
}
