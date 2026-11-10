import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { cancelCompanySubscription } from '@/lib/billing/subscription-service';

/**
 * POST /api/billing/subscription/cancel
 * Schedules subscription cancellation at the end of the current billing period.
 * 
 * BUSINESS RULE:
 * Members retain their paid access (Silver/Gold) until the current paid period ends.
 */
export async function POST() {
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return (
      auth.errorResponse ||
      NextResponse.json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' }, { status: 401 })
    );
  }

  if (!auth.company?.id) {
    return NextResponse.json({ error: 'No company found.', code: 'NO_COMPANY' }, { status: 403 });
  }

  const result = await cancelCompanySubscription(auth.company.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to cancel subscription.' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: result.currentPeriodEnd,
    message: 'Your subscription will cancel at the end of the current billing cycle. You retain full paid access until then.',
  });
}
