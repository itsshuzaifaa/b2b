import type { User } from '@supabase/supabase-js';

/**
 * Fetches all rows from a Supabase query by paginating with `.range(from, to)`
 * in chunks of 1,000 rows, bypassing PostgREST's default 1,000-row hard cap.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  buildPageQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildPageQuery(from, to);
    if (error) {
      throw new Error(error.message || 'Failed to paginate Supabase query');
    }
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return all;
}

/**
 * Lists all Supabase Auth users across all pages, avoiding the 100-user cutoff.
 */
export async function listAllAuthUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  maxPages = 50
): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (page <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) break;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}
