import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import {
  calculateProratedUpgradeCost,
  getCompanySubscription,
  processSubscriptionCheckout,
} from '@/lib/billing/subscription-service';

/**
 * GET /api/billing/subscription/upgrade
 * Returns real-time prorated quote for upgrading to Gold.
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
    return NextResponse.json({ error: 'No company found.', code: 'NO_COMPANY' }, { status: 403 });
  }

  const { subscription, effectiveTier } = await getCompanySubscription(auth.company.id);

  if (effectiveTier === 'gold') {
    return NextResponse.json({
      success: true,
      alreadyGold: true,
      message: 'Account is already on the Gold plan.',
    });
  }

  const periodEnd = subscription?.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const quote = calculateProratedUpgradeCost(periodEnd);

  return NextResponse.json({
    success: true,
    quote,
  });
}

/**
 * POST /api/billing/subscription/upgrade
 * Executes prorated upgrade from Silver to Gold.
 */
export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json().catch(() => ({}));
    const cardNumber = typeof body.cardNumber === 'string' ? body.cardNumber : '';

    const result = await processSubscriptionCheckout({
      companyId: auth.company.id,
      userId: auth.user.id,
      targetTier: 'gold',
      cardNumber,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process upgrade.', code: result.code || 'UPGRADE_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tier: 'gold',
      chargeAmount: result.chargeAmount,
      subscription: result.subscription,
      payment: result.payment,
    });
  } catch (err) {
    console.error('[UPGRADE SUBSCRIPTION EXCEPTION]', err);
    return NextResponse.json({ error: 'Failed to process upgrade.' }, { status: 500 });
  }
}
