'use client';

import type { MembershipTier } from '@/types/database';
import {
  recordManualPayment,
  updateAccountTier,
  getAdminAccounts,
  saveAdminAccounts,
  type AdminClientAccount,
} from '@/lib/admin/admin-store';

export interface PaymentCard {
  id: string;
  brand: 'visa' | 'mastercard' | 'amex';
  last4: string;
  expMonth: string;
  expYear: string;
  cardholderName: string;
  isDefault: boolean;
  createdAt: string;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'free';

export interface UserSubscription {
  companyId: string;
  tier: MembershipTier;
  status: SubscriptionStatus;
  amountGbp: number;
  interval: 'month' | 'year';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  currentPeriodEndTimestamp?: number;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  defaultCardId?: string | null;
}

export const DEMO_TEST_CARD = {
  cardNumber: '4242 4242 4242 4242',
  cardholderName: 'Habib Rehman',
  expMonth: '12',
  expYear: '28',
  cvc: '123',
  zip: '10117',
  brand: 'visa' as const,
};

const CARDS_STORAGE_PREFIX = 'b2b_cards_';
const SUBSCRIPTION_STORAGE_PREFIX = 'b2b_sub_';

export const TIER_PRICING: Record<MembershipTier, { name: string; price: number; period: string }> = {
  bronze: { name: 'Bronze Tier', price: 0, period: 'Free' },
  silver: { name: 'Silver Tier', price: 79, period: '/mo' },
  gold: { name: 'Gold Tier', price: 179, period: '/mo' },
};

function getStorageKey(prefix: string, companyId: string) {
  return `${prefix}${companyId || 'default'}`;
}

export function broadcastBillingUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('b2b_billing_update'));
  }
}

// ==========================================
// 1. CARDS MANAGEMENT
// ==========================================

export function getCompanyCards(companyId: string): PaymentCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(CARDS_STORAGE_PREFIX, companyId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }

    // Return empty cards array for new companies (no test card seeded)
    return [];
  } catch {
    return [];
  }
}

export function saveCompanyCards(companyId: string, cards: PaymentCard[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(CARDS_STORAGE_PREFIX, companyId);
    localStorage.setItem(key, JSON.stringify(cards));
    broadcastBillingUpdate();
  } catch {
    // ignore
  }
}

export function addPaymentCard(
  companyId: string,
  cardData: {
    cardNumber: string;
    cardholderName: string;
    expMonth: string;
    expYear: string;
    brand?: 'visa' | 'mastercard' | 'amex';
    setAsDefault?: boolean;
  }
): { success: boolean; card?: PaymentCard; error?: string } {
  const cleanNumber = cardData.cardNumber.replace(/\s+/g, '');
  if (cleanNumber.length < 15) {
    return { success: false, error: 'Please enter a valid card number.' };
  }
  if (!cardData.cardholderName.trim()) {
    return { success: false, error: 'Cardholder name is required.' };
  }

  const cards = getCompanyCards(companyId);
  const last4 = cleanNumber.slice(-4);
  const brand = cardData.brand || (cleanNumber.startsWith('5') ? 'mastercard' : 'visa');
  const isFirst = cards.length === 0;
  const shouldBeDefault = isFirst || Boolean(cardData.setAsDefault);

  const updatedCards = shouldBeDefault
    ? cards.map((c) => ({ ...c, isDefault: false }))
    : [...cards];

  const newCard: PaymentCard = {
    id: `card-${Date.now()}`,
    brand,
    last4,
    expMonth: cardData.expMonth,
    expYear: cardData.expYear,
    cardholderName: cardData.cardholderName.trim(),
    isDefault: shouldBeDefault,
    createdAt: new Date().toISOString(),
  };

  updatedCards.push(newCard);
  saveCompanyCards(companyId, updatedCards);

  // If set as default, update subscription record
  if (shouldBeDefault) {
    const sub = getCompanySubscription(companyId);
    sub.defaultCardId = newCard.id;
    saveCompanySubscription(companyId, sub);
  }

  return { success: true, card: newCard };
}

export function removePaymentCard(
  companyId: string,
  cardId: string
): { success: boolean; error?: string } {
  const cards = getCompanyCards(companyId);
  const sub = getCompanySubscription(companyId);

  // RULE: One card must stay for active subscription!
  const hasActivePaidSub = sub.tier !== 'bronze' && sub.status === 'active';

  if (hasActivePaidSub && cards.length <= 1) {
    return {
      success: false,
      error:
        'Cannot remove this card: At least one payment card must stay on file for your active subscription. Please add a replacement card first or cancel your subscription.',
    };
  }

  const targetCard = cards.find((c) => c.id === cardId);
  if (!targetCard) {
    return { success: false, error: 'Card not found.' };
  }

  const remaining = cards.filter((c) => c.id !== cardId);

  // If deleted card was default, make another one default
  if (targetCard.isDefault && remaining.length > 0) {
    remaining[0].isDefault = true;
    sub.defaultCardId = remaining[0].id;
    saveCompanySubscription(companyId, sub);
  }

  saveCompanyCards(companyId, remaining);
  return { success: true };
}

export function setDefaultCard(
  companyId: string,
  cardId: string
): { success: boolean; error?: string } {
  const cards = getCompanyCards(companyId);
  const exists = cards.some((c) => c.id === cardId);
  if (!exists) return { success: false, error: 'Card not found.' };

  const updated = cards.map((c) => ({
    ...c,
    isDefault: c.id === cardId,
  }));
  saveCompanyCards(companyId, updated);

  const sub = getCompanySubscription(companyId);
  sub.defaultCardId = cardId;
  saveCompanySubscription(companyId, sub);

  return { success: true };
}

// ==========================================
// 2. SUBSCRIPTION MANAGEMENT
// ==========================================

export function getCompanySubscription(companyId: string): UserSubscription {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const defaultSub: UserSubscription = {
    companyId: companyId || 'default',
    tier: 'bronze',
    status: 'free',
    amountGbp: 0,
    interval: 'month',
    currentPeriodStart: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEnd: nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEndTimestamp: nextMonth.getTime(),
    cancelAtPeriodEnd: false,
    defaultCardId: null,
  };

  if (typeof window === 'undefined') return defaultSub;

  try {
    const key = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, companyId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const sub: UserSubscription = JSON.parse(raw);

      // Check if a canceled subscription has reached its 30-day period end
      if (sub.cancelAtPeriodEnd && sub.tier !== 'bronze') {
        const periodEndMs =
          sub.currentPeriodEndTimestamp ||
          (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0);

        if (periodEndMs && Date.now() > periodEndMs) {
          // Grace period over: now demote quietly to Bronze with no further charges
          sub.tier = 'bronze';
          sub.status = 'free';
          sub.amountGbp = 0;
          sub.cancelAtPeriodEnd = false;
          localStorage.setItem(key, JSON.stringify(sub));
          updateAccountTier(companyId, 'bronze');
          broadcastBillingUpdate();
        }
      }

      return sub;
    }
    localStorage.setItem(key, JSON.stringify(defaultSub));
    return defaultSub;
  } catch {
    return defaultSub;
  }
}

export function saveCompanySubscription(companyId: string, sub: UserSubscription) {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, companyId);
    localStorage.setItem(key, JSON.stringify(sub));
    broadcastBillingUpdate();
  } catch {
    // ignore
  }
}

/**
 * Cancels active subscription renewal.
 * By default, keeps plan benefits active until the 30-day period ends (cancelAtPeriodEnd = true).
 * No recurring charges will occur.
 */
export function cancelSubscription(
  companyId: string,
  immediate: boolean = false
): { success: boolean; error?: string } {
  const sub = getCompanySubscription(companyId);

  const nowStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (immediate) {
    // Demote right away to Bronze
    sub.status = 'canceled';
    sub.tier = 'bronze';
    sub.amountGbp = 0;
    sub.cancelAtPeriodEnd = false;
    sub.canceledAt = nowStr;

    saveCompanySubscription(companyId, sub);
    updateAccountTier(companyId, 'bronze');

    recordManualPayment({
      company_id: companyId,
      company_name: 'Subscriber Cancellation',
      contact_email: 'billing@b2blink.eu',
      plan_or_service: 'Subscription Canceled — Immediate Demotion',
      amount_gbp: 0,
      payment_method: 'Corporate Card',
      wise_reference: `CANCEL-${Date.now()}`,
      transaction_id: `CAN-${Date.now()}`,
      status: 'Completed',
      notes: `Subscription voluntarily canceled by customer on ${nowStr}. Immediately demoted to Bronze tier.`,
    });

    return { success: true };
  } else {
    // Keep active tier until 30 days are over, no auto-renewal
    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = nowStr;
    saveCompanySubscription(companyId, sub);

    recordManualPayment({
      company_id: companyId,
      company_name: 'Subscriber Auto-Renewal Canceled',
      contact_email: 'billing@b2blink.eu',
      plan_or_service: `Auto-Renewal Canceled — Retains ${sub.tier.toUpperCase()} until ${sub.currentPeriodEnd}`,
      amount_gbp: 0,
      payment_method: 'Corporate Card',
      wise_reference: `SCHED-CANCEL-${Date.now()}`,
      transaction_id: `CAN-${Date.now()}`,
      status: 'Completed',
      notes: `Subscription canceled on ${nowStr}. Perks remain active until ${sub.currentPeriodEnd}. Will not auto-renew or charge again.`,
    });

    return { success: true };
  }
}

/**
 * Reactivates auto-renewal for an active subscription marked for cancellation
 */
export function reactivateSubscription(companyId: string): { success: boolean; error?: string } {
  const sub = getCompanySubscription(companyId);
  if (sub.tier === 'bronze') {
    return { success: false, error: 'No active paid subscription to reactivate.' };
  }

  sub.cancelAtPeriodEnd = false;
  sub.canceledAt = null;
  saveCompanySubscription(companyId, sub);
  return { success: true };
}

/**
 * Changes plan or reactivates subscription with a saved or new card
 */
export function changePlan(
  companyId: string,
  newTier: MembershipTier,
  companyName: string = 'Enterprise Trader Ltd',
  contactEmail: string = 'billing@client.eu'
): { success: boolean; error?: string } {
  const cards = getCompanyCards(companyId);
  if (newTier !== 'bronze' && cards.length === 0) {
    return {
      success: false,
      error: 'Please add a payment card before upgrading to a paid subscription.',
    };
  }

  const sub = getCompanySubscription(companyId);
  const pricing = TIER_PRICING[newTier];
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  sub.tier = newTier;
  sub.status = newTier === 'bronze' ? 'free' : 'active';
  sub.amountGbp = pricing.price;
  sub.currentPeriodStart = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  sub.currentPeriodEnd = nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  sub.currentPeriodEndTimestamp = nextMonth.getTime();
  sub.cancelAtPeriodEnd = false;
  sub.canceledAt = null;

  saveCompanySubscription(companyId, sub);

  // Update in Admin Store
  updateAccountTier(companyId, newTier);

  // If paid tier, record payment in Admin Dashboard
  if (pricing.price > 0) {
    const defaultCard = cards.find((c) => c.isDefault) || cards[0];
    recordManualPayment({
      company_id: companyId,
      company_name: companyName,
      contact_email: contactEmail,
      plan_or_service: `${pricing.name} Monthly Membership`,
      amount_gbp: pricing.price,
      payment_method: 'Corporate Card',
      wise_reference: `CARD-${defaultCard?.last4 || '4242'}`,
      transaction_id: `TX-CARD-${Date.now()}`,
      status: 'Completed',
      notes: `Recurring subscription renewal paid via card ending in ${defaultCard?.last4 || '4242'}.`,
    });
  }

  return { success: true };
}

/**
 * Processes Card Checkout upon Registration
 */
export function processRegistrationCardCheckout(params: {
  companyId: string;
  userId?: string;
  companyName: string;
  contactEmail: string;
  tier: MembershipTier;
  cardData: {
    cardNumber: string;
    cardholderName: string;
    expMonth: string;
    expYear: string;
    brand?: 'visa' | 'mastercard' | 'amex';
  };
}): { success: boolean; error?: string } {
  const { companyId, userId, companyName, contactEmail, tier, cardData } = params;

  // 1. Save card
  const cardRes = addPaymentCard(companyId, {
    cardNumber: cardData.cardNumber,
    cardholderName: cardData.cardholderName,
    expMonth: cardData.expMonth,
    expYear: cardData.expYear,
    brand: cardData.brand,
    setAsDefault: true,
  });

  if (!cardRes.success || !cardRes.card) {
    return { success: false, error: cardRes.error || 'Card verification failed.' };
  }

  if (userId && userId !== companyId) {
    try {
      addPaymentCard(userId, {
        cardNumber: cardData.cardNumber,
        cardholderName: cardData.cardholderName,
        expMonth: cardData.expMonth,
        expYear: cardData.expYear,
        brand: cardData.brand,
        setAsDefault: true,
      });
    } catch {}
  }

  const pricing = TIER_PRICING[tier];
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 2. Setup subscription
  const sub: UserSubscription = {
    companyId,
    tier,
    status: tier === 'bronze' ? 'free' : 'active',
    amountGbp: pricing.price,
    interval: 'month',
    currentPeriodStart: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEnd: nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEndTimestamp: nextMonth.getTime(),
    cancelAtPeriodEnd: false,
    defaultCardId: cardRes.card.id,
  };

  saveCompanySubscription(companyId, sub);

  if (userId && userId !== companyId) {
    try {
      saveCompanySubscription(userId, { ...sub, companyId: userId });
    } catch {}
  }

  // 3. Record in Admin Payments
  if (pricing.price > 0) {
    recordManualPayment({
      company_id: companyId,
      company_name: companyName,
      contact_email: contactEmail,
      plan_or_service: `${pricing.name} Monthly Membership (Card Checkout)`,
      amount_gbp: pricing.price,
      payment_method: 'Corporate Card',
      wise_reference: `CARD-${cardRes.card.last4}`,
      transaction_id: `CARD-SUB-${Date.now()}`,
      status: 'Completed',
      notes: `Automated card checkout on signup. Verified card: ${cardRes.card.brand.toUpperCase()} ending in ${cardRes.card.last4} (${cardRes.card.cardholderName}).`,
    });

    // 4. Also register/sync in Admin Accounts list so admin dashboard sees this member immediately
    const existingAccounts = getAdminAccounts();
    const found = existingAccounts.find(
      (a) => a.id === companyId || a.email.toLowerCase() === contactEmail.toLowerCase()
    );
    if (!found) {
      const newAccount: AdminClientAccount = {
        id: companyId,
        name: companyName,
        contact_name: cardData.cardholderName,
        email: contactEmail,
        role: 'seller',
        membership_tier: tier,
        approval_status: 'approved',
        account_status: 'active',
        created_at: new Date().toISOString(),
        listings_count: 0,
        total_spend_or_sales: `£${pricing.price}/mo Membership`,
        verified_documents: true,
      };
      saveAdminAccounts([newAccount, ...existingAccounts]);
    } else {
      updateAccountTier(companyId, tier);
    }
  }

  return { success: true };
}
