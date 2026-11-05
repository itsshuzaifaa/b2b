import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { isSupabaseConfigured } from './config';

export { isSupabaseConfigured };

function createMockBrowserQueryBuilder(initialData: any = []) {
  let accumulatedData = Array.isArray(initialData) ? initialData : [initialData];

  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: any) =>
          resolve({
            data: accumulatedData,
            error: null,
            count: accumulatedData.length,
          });
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () =>
          Promise.resolve({
            data: accumulatedData[0] || null,
            error: null,
          });
      }
      return () => new Proxy({}, handler);
    },
  };

  return new Proxy({}, handler);
}

function createMockBrowserClient(): any {
  return {
    from: (_table: string) => createMockBrowserQueryBuilder([]),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: 'Cloud database is operating in offline mode. Please verify your credentials or use demo mode.' },
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      verifyOtp: async () => ({
        data: { user: null, session: null },
        error: null,
      }),
    },
    channel: (_name: string) => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
  };
}

/**
 * Creates a browser-side Supabase client using `@supabase/ssr`.
 * Automatically manages session tokens in document cookies when Supabase is configured,
 * or provides a safe fallback client when running offline.
 */
export function createClient(): any {
  if (!isSupabaseConfigured()) {
    return createMockBrowserClient();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
