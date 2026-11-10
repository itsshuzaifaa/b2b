import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { recordUserPresence } from '@/lib/presence/presence-tracker';

/**
 * POST /api/presence
 * Heartbeat tracker for member active presence.
 * 
 * SECURITY MANDATE:
 * Takes identity strictly from the authenticated user session.
 * Never trusts unauthenticated body payloads.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  try {
    const email = auth.user.email || auth.company?.contact_email;
    const userId = auth.user.id;

    if (email || userId) {
      recordUserPresence(email, userId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PRESENCE RECORD EXCEPTION]', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
