import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'seller',
  'buyer',
  'b2blink',
  'support',
  'root',
  'api',
  'help',
  'billing',
  'system',
  'official',
  'moderator',
  'staff',
  'demo',
  'jeff',
  'contact',
  'security',
  'marketplace',
]);

export async function GET(request: NextRequest) {
  const rateLimitRes = await enforceRateLimit(request, 'check-username');
  if (rateLimitRes) return rateLimitRes;

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawUsername = searchParams.get('username') || '';
    const username = rawUsername.trim().toLowerCase();

    if (!username) {
      return NextResponse.json({
        available: false,
        reason: 'Please enter a username.',
      });
    }

    if (username.length < 3) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be at least 3 characters.',
      });
    }

    if (username.length > 30) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be 30 characters or fewer.',
      });
    }

    // Format check: letters, numbers, underscores, hyphens, dots
    const validFormat = /^[a-zA-Z0-9_.-]+$/.test(username);
    if (!validFormat) {
      return NextResponse.json({
        available: false,
        reason: 'Only letters, numbers, underscores, dots, or hyphens are allowed.',
      });
    }

    // Reserved check
    if (RESERVED_USERNAMES.has(username)) {
      return NextResponse.json({
        available: false,
        reason: 'This username is reserved. Please pick another.',
      });
    }

    const admin = createAdminClient();
    const normalizedUsername = username.replace(/[^a-z0-9]/g, '');

    // 1. FAST PATH: Check companies table
    const { data: companies } = await admin
      .from('companies')
      .select('contact_name, company_name, contact_email')
      .limit(100);

    if (companies && companies.length > 0) {
      const matchInCompanies = companies.some((c: any) => {
        const cName = (c.contact_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const compName = (c.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cName === normalizedUsername || compName === normalizedUsername;
      });

      if (matchInCompanies) {
        return NextResponse.json({
          available: false,
          reason: 'This username is already taken. Please choose another.',
        });
      }
    }

    // 2. Auth listUsers fallback with strict 1.5s timeout
    try {
      const timeoutPromise = new Promise<{ data: { users: any[] } | null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 1500)
      );
      const listPromise = admin.auth.admin.listUsers({ page: 1, perPage: 100 });
      const raceResult = await Promise.race([listPromise, timeoutPromise]);
      const users = (raceResult as any)?.data?.users || [];

      const isTaken = users.some((u: any) => {
        if (!u.email_confirmed_at) return false;
        const existing = (u.user_metadata?.username as string | undefined)?.toLowerCase();
        return existing === username;
      });

      if (isTaken) {
        return NextResponse.json({
          available: false,
          reason: 'This username is already taken. Please choose another.',
        });
      }
    } catch {
      // If listUsers fails or times out, proceed without blocking user
    }

    return NextResponse.json({
      available: true,
      message: 'Username is available!',
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    console.error('[CHECK USERNAME EXCEPTION]', err);
    return NextResponse.json({
      available: false,
      reason: 'Error checking username availability. Please try again.',
    }, { status: 500 });
  }
}
