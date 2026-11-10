import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { getCompanySubscription } from '@/lib/billing/subscription-service';

/**
 * GET /api/billing/subscription
 * Retrieves the caller's active subscription, renewal dates, cancellation status,
 * and invoice history from the PostgreSQL database.
 * 
 * SECURITY MANDATE:
 * 1. Protected by requireUser().
 * 2. Scoped strictly to the authenticated caller's company (auth.company.id).
 * 3. Never accepts company_id from query parameters or request body.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return (
      auth.errorResponse ||
      NextResponse.json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' }, { status: 401 })
    );
  }

  if (!auth.company?.id) {
    return NextResponse.json(
      { error: 'Forbidden: No company profile found.', code: 'NO_COMPANY' },
      { status: 403 }
    );
  }

  try {
    const data = await getCompanySubscription(auth.company.id);
    return NextResponse.json({
      success: true,
      subscription: data.subscription,
      effectiveTier: data.effectiveTier,
      invoices: data.invoices,
    });
  } catch (err) {
    console.error('[GET SUBSCRIPTION EXCEPTION]', err);
    return NextResponse.json(
      { error: 'Failed to load subscription details.' },
      { status: 500 }
    );
  }
}
