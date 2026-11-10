import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import type { MembershipTier } from '@/types/database';
import { isPaymentSandboxMode, processSubscriptionCheckout } from '@/lib/billing/subscription-service';

/**
 * GET /api/billing/activate-tier
 * Safe public check exposing whether payment sandbox mode is currently enabled.
 * Returns true unless explicitly disabled via PAYMENT_SANDBOX_MODE="false".
 */
export async function GET() {
  const isSandbox = isPaymentSandboxMode();
  return NextResponse.json({
    sandbox: isSandbox,
  });
}

/**
 * POST /api/billing/activate-tier
 * Activates membership tiers (Silver/Gold) in sandbox mode.
 * 
 * INTENDED FLOW:
 * Sign up -> Verify Email -> Pay -> Email documents for Admin Approval.
 * 
 * SECURITY MANDATE:
 * 1. Default active in sandbox mode (isPaymentSandboxMode()).
 * 2. Authenticates session via requireUser() (allows pending or approved companies; pending user must be able to pay).
 * 3. Requires the Auth user's email to be verified (email_confirmed_at).
 * 4. Allows only companies with approval_status IN ('pending', 'approved').
 *    Returns HTTP 403 for 'rejected' or 'suspended'.
 * 5. Payment NEVER alters approval_status or unlocks the dashboard gate.
 * 6. Company identity is derived strictly from session (auth.company.id).
 *    Any companyId or email supplied in request body is strictly ignored.
 * 7. Only test card 4242 4242 4242 4242 is accepted. Any other card is declined.
 *    Card numbers, CVCs, and expiry dates are NEVER stored or logged.
 * 8. Tiers are restricted to 'silver' or 'gold' only.
 * 9. Prevents accidental re-runs if user already has an active paid package.
 * 10. Logs activations with console.error at safe audit level (companyId, tier, timestamp only; NO CARD DATA).
 */
export async function POST(req: Request) {
  if (!isPaymentSandboxMode()) {
    return NextResponse.json(
      {
        error: 'Payments are not enabled yet.',
        code: 'FEATURE_DISABLED',
      },
      { status: 403 }
    );
  }

  // 2. In sandbox mode, require an authenticated user session
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 3. Require the Auth user's email to be verified
  const isEmailConfirmed = Boolean(auth.user.email_confirmed_at || (auth.user as any).confirmed_at);
  if (!isEmailConfirmed) {
    return NextResponse.json(
      {
        error: 'Forbidden: Email address must be verified before payment.',
        code: 'EMAIL_NOT_VERIFIED',
      },
      { status: 403 }
    );
  }

  // 4. Ensure company exists
  if (!auth.company) {
    return NextResponse.json(
      { error: 'Forbidden: No registered company found for your user account.', code: 'NO_COMPANY' },
      { status: 403 }
    );
  }

  // 5. Allow only companies whose approval_status is pending or approved; return 403 for rejected and suspended.
  const status = auth.company.approval_status;
  if (status !== 'pending' && status !== 'approved') {
    return NextResponse.json(
      {
        error: `Forbidden: Account is ${status}. Only pending or approved companies may activate packages.`,
        code: status === 'rejected' ? 'ACCOUNT_REJECTED' : 'ACCOUNT_SUSPENDED',
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    // 6. Take company from session only; ignore any company ID or email in body
    const companyId = auth.company.id;

    // 7. Validate tier: allow only silver or gold
    const requestedTier = (typeof body.tier === 'string' ? body.tier.toLowerCase().trim() : '') as MembershipTier;
    if (requestedTier !== 'silver' && requestedTier !== 'gold') {
      return NextResponse.json(
        {
          error: 'Invalid membership tier. Only silver or gold upgrades are allowed.',
          code: 'INVALID_TIER',
        },
        { status: 400 }
      );
    }

    // 8. Protect against accidental tier re-runs & enforce tier transition rules
    const currentTier = (auth.company.tier || 'bronze').toLowerCase();
    if (currentTier === requestedTier) {
      // Idempotent success: tier already active
      return NextResponse.json({
        success: true,
        sandbox: true,
        tier: requestedTier,
        alreadyActive: true,
        company: {
          id: companyId,
          tier: requestedTier,
          membership_tier: requestedTier,
          approval_status: auth.company.approval_status,
        },
      });
    }

    // Downgrade protection: Gold to Silver cannot be applied immediately via activation.
    // In our subscription model, downgrades take effect only after the current billing period expires.
    if (currentTier === 'gold' && requestedTier === 'silver') {
      return NextResponse.json(
        {
          error: 'Downgrading from Gold to Silver cannot be processed immediately. Downgrades take effect at the end of your current subscription period.',
          code: 'TIER_DOWNGRADE_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    if (currentTier !== 'bronze' && body.isSignup === true) {
      return NextResponse.json(
        {
          error: `Account is already on the ${currentTier.toUpperCase()} package. Plan upgrades can be managed in your billing dashboard.`,
          code: 'TIER_ALREADY_ACTIVE',
        },
        { status: 400 }
      );
    }

    // 9. Accept only test card 4242 4242 4242 4242 (validated on server).
    // NEVER store card numbers, CVC or expiry anywhere, and NEVER log them.
    const rawCard = typeof body.cardNumber === 'string' ? body.cardNumber.replace(/\s+/g, '') : '';
    if (rawCard !== '4242424242424242') {
      return NextResponse.json(
        {
          error: 'Your card was declined. Only test card 4242 4242 4242 4242 is accepted in sandbox mode.',
          code: 'CARD_DECLINED',
        },
        { status: 400 }
      );
    }

    // 10. Process subscription checkout, ledger insertion & entitlement update
    const checkoutResult = await processSubscriptionCheckout({
      companyId,
      userId: auth.user.id,
      targetTier: requestedTier,
      cardNumber: rawCard,
    });

    if (!checkoutResult.success) {
      return NextResponse.json(
        { error: checkoutResult.error || 'Failed to activate tier.', code: checkoutResult.code || 'ACTIVATION_FAILED' },
        { status: 400 }
      );
    }

    // 11. Log each sandbox activation (company ID, tier, timestamp) with console.error safety: NO CARD DATA
    console.error(
      `[PAYMENT_SANDBOX_ACTIVATION] Company ID: ${companyId}, Tier: ${requestedTier}, Timestamp: ${new Date().toISOString()}`
    );

    return NextResponse.json({
      success: true,
      sandbox: true,
      tier: requestedTier,
      chargeAmount: checkoutResult.chargeAmount,
      company: {
        id: companyId,
        tier: requestedTier,
        membership_tier: requestedTier,
        approval_status: auth.company.approval_status,
      },
      subscription: checkoutResult.subscription,
      payment: checkoutResult.payment,
    });
  } catch (err) {
    console.error('[PAYMENT_SANDBOX_EXCEPTION]', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
