import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { isSupabaseConfigured } from './config';

export { isSupabaseConfigured };

/**
 * Creates a generic chainable proxy that resolves like a Supabase query builder
 * without executing any network calls.
 */
function createMockQueryBuilder(initialData: any = []) {
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
      return (...args: any[]) => {
        if (prop === 'insert' || prop === 'upsert') {
          const val = args[0];
          if (Array.isArray(val)) {
            accumulatedData = val.map((v, i) => ({
              id: v?.id || `rec_${Date.now()}_${i}`,
              ...v,
            }));
          } else if (val && typeof val === 'object') {
            accumulatedData = [
              {
                id: val?.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                ...val,
              },
            ];
          }
        }
        return new Proxy({}, handler);
      };
    },
  };

  return new Proxy({}, handler);
}

/**
 * Fallback elevated admin client for environments where Supabase is not configured.
 * Safely handles calls without making unresolvable DNS lookups.
 */
function createMockAdminClient(): any {
  return {
    from: (_table: string) => createMockQueryBuilder([]),
    auth: {
      admin: {
        createUser: async (params: any) => {
          const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
          return {
            data: {
              user: {
                id,
                email: params?.email,
                user_metadata: params?.user_metadata || {},
                app_metadata: {},
                created_at: new Date().toISOString(),
                email_confirmed_at: params?.email_confirm ? new Date().toISOString() : null,
              },
            },
            error: null,
          };
        },
        listUsers: async () => ({
          data: { users: [], total: 0 },
          error: null,
        }),
        getUserById: async (id: string) => ({
          data: { user: { id } },
          error: null,
        }),
        updateUserById: async (id: string, attrs: any) => ({
          data: { user: { id, ...attrs } },
          error: null,
        }),
        deleteUser: async (_id: string) => ({
          data: null,
          error: null,
        }),
        generateLink: async (params: any) => {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const baseUrl = params?.options?.redirectTo || 'http://localhost:3000/verify-email';
          return {
            data: {
              properties: {
                email_otp: otp,
                action_link: `${baseUrl}?email=${encodeURIComponent(params?.email || '')}&token=${otp}`,
              },
              user: null,
            },
            error: null,
          };
        },
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  };
}

/**
 * Creates a server-side Supabase client with Next.js App Router cookie handling.
 * Compatible with Next.js 15+ asynchronous cookies API.
 */
export async function createClient(): Promise<any> {
  if (!isSupabaseConfigured()) {
    return {
      from: (_table: string) => createMockQueryBuilder([]),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    };
  }

  const cookieStore = await cookies();
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
}

/**
 * Creates an elevated Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * Designed for server-only background tasks (queue dispatch, admin vetting, quota management).
 */
export function createAdminClient(): any {
  if (!isSupabaseConfigured()) {
    return createMockAdminClient();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
