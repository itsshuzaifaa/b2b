import { createAdminClient } from '@/lib/supabase/server';
import type { MembershipTier, Subscription, Payment } from '@/types/database';

export const TIER_MONTHLY_PRICES: Record<MembershipTier, number> = {
  bronze: 0,
  silver: 79,
  gold: 179,
};

/**
 * Returns whether payment operations are currently running in Sandbox mode.
 * Default is TRUE since no live payment gateway credentials are connected yet.
 * Can be explicitly toggled via PAYMENT_SANDBOX_MODE="false" in production.
 */
export function isPaymentSandboxMode(): boolean {
  if (process.env.PAYMENT_SANDBOX_MODE === 'false') {
    return false;
  }
  return true;
}

export interface ProratedUpgradeCalculation {
  currentTier: MembershipTier;
  targetTier: 'gold';
  daysRemaining: number;
  totalDaysInPeriod: number;
  dailyRateSilver: number;
  dailyRateGold: number;
  dailyDifference: number;
  proratedChargeGbp: number;
  currentPeriodEnd: string;
}

/**
 * Calculates prorated upgrade from Silver to Gold based on exact remaining days in the active period.
 */
export function calculateProratedUpgradeCost(
  currentPeriodEndIso: string,
  silverPrice: number = TIER_MONTHLY_PRICES.silver,
  goldPrice: number = TIER_MONTHLY_PRICES.gold
): ProratedUpgradeCalculation {
  const now = Date.now();
  const periodEndMs = new Date(currentPeriodEndIso).getTime();
  const diffMs = Math.max(0, periodEndMs - now);
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const totalDays = 30;

  const dailyRateSilver = silverPrice / totalDays;
  const dailyRateGold = goldPrice / totalDays;
  const dailyDiff = Math.max(0, dailyRateGold - dailyRateSilver);

  // Round to 2 decimal places
  const proratedChargeGbp = Math.round(dailyDiff * daysRemaining * 100) / 100;

  return {
    currentTier: 'silver',
    targetTier: 'gold',
    daysRemaining,
    totalDaysInPeriod: totalDays,
    dailyRateSilver: Math.round(dailyRateSilver * 100) / 100,
    dailyRateGold: Math.round(dailyRateGold * 100) / 100,
    dailyDifference: Math.round(dailyDiff * 100) / 100,
    proratedChargeGbp,
    currentPeriodEnd: currentPeriodEndIso,
  };
}

/**
 * Retrieves the active subscription for a company, or synthesizes a clean fallback
 * based on the database companies.tier to ensure zero disruption before migrations run.
 */
export async function getCompanySubscription(companyId: string): Promise<{
  subscription: Subscription | null;
  effectiveTier: MembershipTier;
  invoices: Payment[];
}> {
  const admin = createAdminClient();

  // 1. Fetch company record
  const { data: company } = await admin
    .from('companies')
    .select('id, tier, company_name, contact_email, created_at')
    .eq('id', companyId)
    .maybeSingle();

  const effectiveTier = (company?.tier || 'bronze') as MembershipTier;

  // 2. Fetch subscription from subscriptions table
  let activeSub: Subscription | null = null;
  try {
    const { data: subData, error: subErr } = await admin
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subErr && subData) {
      activeSub = subData as unknown as Subscription;
    }
  } catch {
    // subscriptions table may not be migrated yet
  }

  // 3. Fallback synthesis for existing paid accounts if table has no row yet
  if (!activeSub && (effectiveTier === 'silver' || effectiveTier === 'gold')) {
    const start = company?.created_at ? new Date(company.created_at) : new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    activeSub = {
      id: `syn-${companyId.slice(0, 8)}`,
      company_id: companyId,
      tier: effectiveTier,
      status: 'active',
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
      retry_count: 0,
      payment_method: 'sandbox_card',
      created_at: start.toISOString(),
      updated_at: start.toISOString(),
    };
  }

  // 4. Fetch invoices from public.payments
  let invoices: Payment[] = [];
  try {
    const { data: payData } = await admin
      .from('payments')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (payData) {
      invoices = payData as unknown as Payment[];
    }
  } catch {
    // ignore
  }

  return {
    subscription: activeSub,
    effectiveTier,
    invoices,
  };
}

export interface ProcessCheckoutParams {
  companyId: string;
  userId: string;
  targetTier: 'silver' | 'gold';
  cardNumber: string;
  cardLast4?: string;
  cardholderName?: string;
}

/**
 * Handles subscription checkout and upgrades in Sandbox mode.
 * - Enforces test card 4242 4242 4242 4242.
 * - Prevents duplicate upgrades.
 * - Calculates proration if upgrading from Silver to Gold.
 * - Records transaction in public.payments.
 * - Updates public.subscriptions.
 * - Synchronizes companies.tier without altering companies.approval_status.
 */
export async function processSubscriptionCheckout(params: ProcessCheckoutParams): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  subscription?: Subscription;
  payment?: Payment;
  chargeAmount?: number;
}> {
  const { companyId, userId, targetTier, cardNumber } = params;

  // 1. Sandbox card validation
  const cleanCard = cardNumber.replace(/\s+/g, '');
  if (cleanCard !== '4242424242424242') {
    return {
      success: false,
      error: 'Card declined. In sandbox mode, only test card 4242 4242 4242 4242 is accepted.',
      code: 'CARD_DECLINED',
    };
  }

  const admin = createAdminClient();

  // 2. Fetch company record
  const { data: company, error: compErr } = await admin
    .from('companies')
    .select('id, company_name, contact_email, tier, approval_status')
    .eq('id', companyId)
    .single();

  if (compErr || !company) {
    return { success: false, error: 'Company record not found.', code: 'COMPANY_NOT_FOUND' };
  }

  // Suspended or rejected companies cannot subscribe
  if (company.approval_status === 'suspended' || company.approval_status === 'rejected') {
    return {
      success: false,
      error: `Company account is ${company.approval_status}. Subscriptions are disabled.`,
      code: 'ACCOUNT_NOT_ELIGIBLE',
    };
  }

  const currentTier = (company.tier || 'bronze') as MembershipTier;

  // 3. Prevent duplicate active plan checkout
  if (currentTier === targetTier) {
    return {
      success: false,
      error: `Company is already subscribed to the ${targetTier.toUpperCase()} package.`,
      code: 'TIER_ALREADY_ACTIVE',
    };
  }

  // 4. Downgrade protection: Gold to Silver cannot be applied mid-cycle
  if (currentTier === 'gold' && targetTier === 'silver') {
    return {
      success: false,
      error: 'Downgrading from Gold to Silver cannot be processed mid-cycle. Downgrades take effect after your current paid term ends.',
      code: 'DOWNGRADE_MID_CYCLE_NOT_ALLOWED',
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 5. Calculate charge amount
  let chargeAmount = TIER_MONTHLY_PRICES[targetTier];
  let planDescription = `${targetTier.toUpperCase()} Monthly Membership`;
  let periodStart = nowIso;
  let periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // If upgrading from Silver to Gold, apply proration anchored to current billing anniversary
  if (currentTier === 'silver' && targetTier === 'gold') {
    const { subscription: existingSub } = await getCompanySubscription(companyId);
    if (existingSub?.current_period_end) {
      const proration = calculateProratedUpgradeCost(existingSub.current_period_end);
      chargeAmount = proration.proratedChargeGbp;
      periodStart = existingSub.current_period_start;
      periodEnd = existingSub.current_period_end;
      planDescription = `Prorated Upgrade: Silver to Gold (${proration.daysRemaining} days remaining)`;
    }
  }

  const paymentId = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
  const invoiceNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Record in public.payments ledger
  let createdPayment: Payment | undefined;
  try {
    const paymentPayload: any = {
      id: paymentId,
      company_id: companyId,
      company_name: company.company_name || 'Member Account',
      contact_email: company.contact_email || '',
      plan_or_service: planDescription,
      amount_gbp: chargeAmount,
      payment_method: 'Sandbox Corporate Card',
      wise_reference: `CARD-${cleanCard.slice(-4)}`,
      transaction_id: `TX-SB-${Date.now()}`,
      status: 'Completed',
      invoice_number: invoiceNumber,
      notes: `Automated sandbox payment. Test card ending in 4242.`,
      recorded_by: userId || null,
      created_at: nowIso,
      completed_at: nowIso,
      updated_at: nowIso,
    };

    const { data: pData, error: pErr } = await admin
      .from('payments')
      .insert(paymentPayload)
      .select('*')
      .single();

    if (!pErr && pData) {
      createdPayment = pData as unknown as Payment;
    }
  } catch (err) {
    console.error('[PAYMENT LEDGER INSERT WARNING]', err);
  }

  // 7. Insert or update in public.subscriptions
  let savedSub: Subscription | undefined;
  try {
    const subPayload: any = {
      company_id: companyId,
      tier: targetTier,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      canceled_at: null,
      retry_count: 0,
      next_retry_at: null,
      last_retry_at: null,
      last_failure_reason: null,
      payment_method: 'sandbox_card',
      gateway_customer_id: `cust_sb_${companyId.slice(0, 8)}`,
      gateway_subscription_id: `sub_sb_${companyId.slice(0, 8)}`,
      updated_at: nowIso,
    };

    // Check if an existing subscription row exists for this company
    const { data: existingSubRow } = await admin
      .from('subscriptions')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingSubRow?.id) {
      const { data: updatedSub } = await admin
        .from('subscriptions')
        .update(subPayload)
        .eq('id', existingSubRow.id)
        .select('*')
        .single();
      savedSub = updatedSub as unknown as Subscription;
    } else {
      subPayload.created_at = nowIso;
      const { data: newSub } = await admin
        .from('subscriptions')
        .insert(subPayload)
        .select('*')
        .single();
      savedSub = newSub as unknown as Subscription;
    }

    // Link subscription_id on payment if available
    if (savedSub?.id && paymentId) {
      await admin.from('payments').update({ subscription_id: savedSub.id }).eq('id', paymentId);
    }
  } catch (err) {
    console.warn('[SUBSCRIPTIONS TABLE UPSERT NOTICE]', err);
  }

  // 8. Synchronize companies.tier strictly (NEVER alter approval_status)
  await admin
    .from('companies')
    .update({
      tier: targetTier,
      updated_at: nowIso,
    })
    .eq('id', companyId);

  // Synchronize user_metadata for active user
  if (userId) {
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          tier: targetTier,
          membership_tier: targetTier,
        },
      });
    } catch {}
  }

  return {
    success: true,
    subscription: savedSub,
    payment: createdPayment,
    chargeAmount,
  };
}

/**
 * Flags subscription to cancel at the end of the current paid billing period.
 * Paid member access remains active until current_period_end.
 */
export async function cancelCompanySubscription(companyId: string): Promise<{
  success: boolean;
  error?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { data: sub, error } = await admin
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        canceled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('company_id', companyId)
      .select('*')
      .maybeSingle();

    if (error || !sub) {
      return { success: false, error: error?.message || 'Active subscription not found.' };
    }

    return {
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.current_period_end,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to schedule cancellation',
    };
  }
}

/**
 * Reverses a pending cancellation prior to period end.
 */
export async function reactivateCompanySubscription(companyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { data: sub, error } = await admin
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: nowIso,
      })
      .eq('company_id', companyId)
      .select('*')
      .maybeSingle();

    if (error || !sub) {
      return { success: false, error: error?.message || 'Subscription not found.' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reactivate subscription',
    };
  }
}

/**
 * Automated Maintenance Job (Executed by CRON)
 * Handles:
 * 1. Period-end cancellations: Reverts companies to 'bronze' after their cancelled term ends.
 * 2. Day 1, 3, 5 Retries on past-due subscriptions: Demotes to 'bronze' after final Day 5 failure.
 * 3. Normal Sandbox Renewals: Advances periods by 30 days and logs receipts.
 */
export async function executeSubscriptionLifecycleSweep(): Promise<{
  renewedCount: number;
  demotedCount: number;
  retriedCount: number;
}> {
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  let renewedCount = 0;
  let demotedCount = 0;
  let retriedCount = 0;

  try {
    // 1. Process Period-End Cancellations
    const { data: expiredCancellations } = await admin
      .from('subscriptions')
      .select('*')
      .eq('cancel_at_period_end', true)
      .lte('current_period_end', nowIso)
      .in('status', ['active', 'past_due']);

    if (expiredCancellations && expiredCancellations.length > 0) {
      for (const sub of expiredCancellations) {
        await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: nowIso,
          })
          .eq('id', sub.id);

        await admin
          .from('companies')
          .update({
            tier: 'bronze',
            updated_at: nowIso,
          })
          .eq('id', sub.company_id);

        demotedCount++;
      }
    }

    // 2. Process Day 1, 3, 5 Retries for Past-Due Subscriptions
    const { data: pastDueList } = await admin
      .from('subscriptions')
      .select('*')
      .eq('status', 'past_due')
      .lte('next_retry_at', nowIso);

    if (pastDueList && pastDueList.length > 0) {
      for (const sub of pastDueList) {
        const nextCount = (sub.retry_count || 0) + 1;

        if (nextCount > 3) {
          // Final Day 5 failure: demote to Bronze immediately. Zero extra grace period.
          await admin
            .from('subscriptions')
            .update({
              status: 'expired',
              next_retry_at: null,
              last_retry_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', sub.id);

          await admin
            .from('companies')
            .update({
              tier: 'bronze',
              updated_at: nowIso,
            })
            .eq('id', sub.company_id);

          demotedCount++;
        } else {
          // Schedule next retry: Day 1 (+24h), Day 3 (+48h), Day 5 (+48h)
          const delayDays = nextCount === 1 ? 1 : 2;
          const nextRetryDate = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);

          await admin
            .from('subscriptions')
            .update({
              retry_count: nextCount,
              last_retry_at: nowIso,
              next_retry_at: nextRetryDate.toISOString(),
              updated_at: nowIso,
            })
            .eq('id', sub.id);

          retriedCount++;
        }
      }
    }

    // 3. Process Active Sandbox Renewals where period has ended
    if (isPaymentSandboxMode()) {
      const { data: dueRenewals } = await admin
        .from('subscriptions')
        .select('*, company:companies(*)')
        .eq('status', 'active')
        .eq('cancel_at_period_end', false)
        .lte('current_period_end', nowIso);

      if (dueRenewals && dueRenewals.length > 0) {
        for (const sub of dueRenewals) {
          const nextEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const amount = TIER_MONTHLY_PRICES[sub.tier as MembershipTier] || 79;

          // Record renewal payment in ledger
          await admin.from('payments').insert({
            id: `PAY-REN-${Math.floor(100000 + Math.random() * 900000)}`,
            company_id: sub.company_id,
            company_name: (sub as any).company?.company_name || 'Member Account',
            contact_email: (sub as any).company?.contact_email || '',
            plan_or_service: `${sub.tier.toUpperCase()} Monthly Renewal`,
            amount_gbp: amount,
            payment_method: 'Sandbox Corporate Card',
            status: 'Completed',
            invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            subscription_id: sub.id,
            created_at: nowIso,
            completed_at: nowIso,
            updated_at: nowIso,
          });

          // Advance period
          await admin
            .from('subscriptions')
            .update({
              current_period_start: nowIso,
              current_period_end: nextEnd,
              retry_count: 0,
              next_retry_at: null,
              updated_at: nowIso,
            })
            .eq('id', sub.id);

          renewedCount++;
        }
      }
    }
  } catch (err) {
    console.error('[SUBSCRIPTION LIFECYCLE SWEEPER EXCEPTION]', err);
  }

  return {
    renewedCount,
    demotedCount,
    retriedCount,
  };
}
