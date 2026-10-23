import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

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

    // Database uniqueness check via Supabase Admin
    const admin = createAdminClient();
    const { data: { users }, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error('[CHECK USERNAME ERROR]', error);
      // In case of listUsers error, allow user through rather than completely blocking
      return NextResponse.json({ available: true });
    }

    const isTaken = users.some((u) => {
      // Usernames are only locked in if the account email has been verified!
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
