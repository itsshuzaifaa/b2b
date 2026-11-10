import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { reactivateCompanySubscription } from '@/lib/billing/subscription-service';

/**
 * POST /api/billing/subscription/reactivate
 * Reverses a pending cancellation prior to period end.
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

  const result = await reactivateCompanySubscription(auth.company.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to reactivate subscription.' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Subscription successfully resumed. Your automatic renewals will continue.',
  });
}
