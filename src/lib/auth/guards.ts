import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { User } from '@supabase/supabase-js';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Company } from '@/types/database';

export class AuthError extends Error {
  status: 401 | 403;
  code?: string;
  constructor(status: 401 | 403, message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export interface AuthSuccessResult {
  user: User;
  company: Company | null;
  isAdmin: boolean;
  errorResponse: null;
}

export interface AuthFailureResult {
  user: null | User;
  company: null | Company;
  isAdmin: false;
  errorResponse: NextResponse;
}

export type AuthResult = AuthSuccessResult | AuthFailureResult;

/**
 * Checks whether a user possesses verified administrative privileges.
 * 
 * SECURITY MANDATE:
 * Evaluated strictly on the server side using tamper-proof sources:
 * 1. `app_metadata.role === 'admin'` or `app_metadata.is_admin === true`
 *    (app_metadata is encrypted in JWT and can only be modified via the Supabase Service Role).
 * 2. Supabase `public.admins` table checked with elevated Service Role client by `user_id`.
 * 
 * NEVER inspects `user_metadata` (client-writable) or matches by contact_email.
 * The `companies.role = 'admin'` path is completely removed.
 */
export async function isUserAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;

  // 1. Check tamper-proof app_metadata claims
  const appRole = (user.app_metadata?.role as string | undefined)?.toLowerCase();
  const isAppAdmin = user.app_metadata?.is_admin === true;
  if (appRole === 'admin' || isAppAdmin) {
    return true;
  }

  // 2. Check public.admins table strictly by user_id via Service Role client
  try {
    const admin = createAdminClient();
    const { data: adminRecord, error: adminErr } = await admin
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!adminErr && adminRecord) {
      return true;
    }
  } catch {
    // admins table might not exist yet before migration
  }

  return false;
}

/**
 * Requires a valid, authenticated user session.
 * Always calls `supabase.auth.getUser()` (never `getSession()`).
 * 
 * Returns `{ user, company, isAdmin, errorResponse: null }` on success.
 * Returns `{ user: null, company: null, isAdmin: false, errorResponse: 401 }` on failure.
 */
export async function requireUser(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        user: null,
        company: null,
        isAdmin: false,
        errorResponse: NextResponse.json(
          { error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
      };
    }

    // Resolve company profile server-side strictly by user_id
    let company: Company | null = null;
    try {
      const admin = createAdminClient();
      const { data: compData } = await admin
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (compData) {
        company = compData as Company;
      }
    } catch {
      // ignore
    }

    const isAdmin = await isUserAdmin(user);

    return {
      user,
      company,
      isAdmin,
      errorResponse: null,
    };
  } catch (err) {
    // Rethrow Next.js internal signals (redirects, prerender bailout, connection errors)
    if (typeof (err as { digest?: unknown })?.digest === 'string') {
      throw err;
    }
    console.error('[AUTH GUARD EXCEPTION requireUser]', err);
    return {
      user: null,
      company: null,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Failed to authenticate session.' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Requires an authenticated user whose company has `approval_status === 'approved'`
 * strictly queried from the PostgreSQL database (public.companies).
 * 
 * SECURITY MANDATE:
 * 1. Calls requireUser() to verify session validity.
 * 2. If caller is an admin (verified server-side via isUserAdmin), bypasses approval checks.
 * 3. Never trusts user_metadata or client-supplied status.
 * 4. Returns 401 if not logged in.
 * 5. Returns 403 { error, code: 'NO_COMPANY' } if no company profile exists in database.
 * 6. Returns 403 { error, code: 'ACCOUNT_NOT_APPROVED', approval_status } if company status is not 'approved' (pending, rejected, suspended).
 */
export async function requireApprovedUser(): Promise<AuthResult> {
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return {
      user: null,
      company: null,
      isAdmin: false,
      errorResponse:
        auth.errorResponse ||
        NextResponse.json(
          { error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
    };
  }

  // Administrators bypass approval checks
  if (auth.isAdmin) {
    return {
      user: auth.user,
      company: auth.company,
      isAdmin: true,
      errorResponse: null,
    };
  }

  // Look up caller's company strictly by user_id from database
  const admin = createAdminClient();
  const { data: dbCompany, error: compErr } = await admin
    .from('companies')
    .select('*')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (compErr || !dbCompany) {
    return {
      user: auth.user,
      company: null,
      isAdmin: false,
      errorResponse: NextResponse.json(
        {
          error: 'Forbidden: No registered company found for your user account.',
          code: 'NO_COMPANY',
        },
        { status: 403 }
      ),
    };
  }

  const company = dbCompany as Company;

  if (company.approval_status !== 'approved') {
    return {
      user: auth.user,
      company,
      isAdmin: false,
      errorResponse: NextResponse.json(
        {
          error: `Forbidden: Account is not approved (current status: ${company.approval_status || 'pending'}).`,
          code: 'ACCOUNT_NOT_APPROVED',
          approval_status: company.approval_status || 'pending',
        },
        { status: 403 }
      ),
    };
  }

  return {
    user: auth.user,
    company,
    isAdmin: false,
    errorResponse: null,
  };
}

/**
 * For use inside Server Actions.
 * Throws AuthError(401) if not logged in.
 * Throws AuthError(403) with code ACCOUNT_NOT_APPROVED if not approved.
 */
export async function assertApprovedUser(): Promise<{ user: User; company: Company | null; isAdmin: boolean }> {
  const res = await requireApprovedUser();
  if (res.errorResponse || !res.user) {
    const errRes = res.errorResponse;
    const status = (errRes?.status || 401) as 401 | 403;
    let message = status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.';
    let code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    if (errRes) {
      try {
        const cloned = errRes.clone();
        const body = await cloned.json();
        if (body?.error) message = body.error;
        if (body?.code) code = body.code;
      } catch {}
    }
    const err = new AuthError(status, message, code);
    throw err;
  }
  return { user: res.user, company: res.company, isAdmin: res.isAdmin };
}

/**
 * Requires a verified administrator user.
 * Uses `supabase.auth.getUser()` (never `getSession()`).
 * 
 * Returns 401 if there is no user session.
 * Returns 403 if the authenticated user is not an administrator.
 * Returns `{ user, company, isAdmin: true, errorResponse: null }` on success.
 */
export async function requireAdmin(): Promise<
  | { user: User; company: Company | null; isAdmin: true; errorResponse: null }
  | { user: User | null; company: null; isAdmin: false; errorResponse: NextResponse }
> {
  const userResult = await requireUser();

  // 1. Not logged in -> 401 Unauthorized
  if (userResult.errorResponse || !userResult.user) {
    return {
      user: null,
      company: null,
      isAdmin: false,
      errorResponse:
        userResult.errorResponse ||
        NextResponse.json(
          { error: 'Unauthorized: Authentication required.' },
          { status: 401 }
        ),
    };
  }

  // 2. Logged in but not an admin -> 403 Forbidden
  if (!userResult.isAdmin) {
    return {
      user: userResult.user,
      company: null,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Administrator privileges required.' },
        { status: 403 }
      ),
    };
  }

  return {
    user: userResult.user,
    company: userResult.company,
    isAdmin: true,
    errorResponse: null,
  };
}

/**
 * For use inside Server Actions.
 * Throws AuthError(401) if not logged in.
 */
export async function assertUser(): Promise<{ user: User; company: Company | null; isAdmin: boolean }> {
  const res = await requireUser();
  if (res.errorResponse || !res.user) {
    throw new AuthError(401, 'Unauthorized: Authentication required.');
  }
  return { user: res.user, company: res.company, isAdmin: res.isAdmin };
}

/**
 * For use inside Server Actions.
 * Throws AuthError(401) if not logged in.
 * Throws AuthError(403) if logged in but not an administrator.
 */
export async function assertAdmin(): Promise<{ user: User; company: Company | null; isAdmin: true }> {
  const res = await requireAdmin();
  if (res.errorResponse || !res.user || !res.isAdmin) {
    const status = res.errorResponse?.status === 401 ? 401 : 403;
    const msg =
      status === 401
        ? 'Unauthorized: Authentication required.'
        : 'Forbidden: Administrator privileges required.';
    throw new AuthError(status, msg);
  }
  return { user: res.user, company: res.company, isAdmin: true };
}

/**
 * Verifies that the request possesses authorization for maintenance cron execution.
 * 
 * SECURITY MANDATE:
 * 1. Checks Bearer token exclusively from the `Authorization: Bearer <token>` header.
 *    Query parameter secrets (?secret=) are strictly disallowed.
 * 2. Compares token to process.env.CRON_SECRET using crypto.timingSafeEqual.
 *    CRON_SECRET MUST be configured and non-empty. If CRON_SECRET is missing, denies bearer check.
 * 3. Alternatively permits authenticated platform administrators (via isUserAdmin).
 */
export async function verifyCronOrAdmin(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization') || '';

  if (cronSecret && cronSecret.length > 0) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      const providedSecret = bearerMatch[1].trim();
      const bufProvided = crypto.createHash('sha256').update(providedSecret).digest();
      const bufExpected = crypto.createHash('sha256').update(cronSecret).digest();
      if (crypto.timingSafeEqual(bufProvided, bufExpected)) {
        return true;
      }
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && (await isUserAdmin(user))) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

