import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIdentifier = (body.identifier || '').trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { error: 'Please enter your username or email address.' },
        { status: 400 }
      );
    }

    // If identifier looks like an email address, return directly
    if (rawIdentifier.includes('@')) {
      return NextResponse.json({ email: rawIdentifier.toLowerCase() });
    }

    const usernameToFind = rawIdentifier.toLowerCase();
    const admin = createAdminClient();
    const { data: { users }, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error('[LOOKUP USERNAME ERROR]', error);
      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable.' },
        { status: 500 }
      );
    }

    const matchedUser = users.find((u) => {
      const uName = (u.user_metadata?.username as string | undefined)?.toLowerCase();
      return uName === usernameToFind;
    });

    if (!matchedUser || !matchedUser.email) {
      return NextResponse.json(
        { error: `No account found with username "${rawIdentifier}".` },
        { status: 404 }
      );
    }

    return NextResponse.json({ email: matchedUser.email });
  } catch (err) {
    console.error('[LOOKUP USERNAME EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during user lookup.' },
      { status: 500 }
    );
  }
}
