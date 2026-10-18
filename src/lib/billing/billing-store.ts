'use client';

import type { MembershipTier } from '@/types/database';
import {
  recordManualPayment,
  updateAccountTier,
  getAdminAccounts,
  saveAdminAccounts,
  getAdminPayments,
  type AdminClientAccount,
  type AdminPaymentRecord,
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

export function getCompanyCards(
  companyId?: string,
  contactEmail?: string,
  userId?: string
): PaymentCard[] {
  if (typeof window === 'undefined') return [];
  try {
    // 1. Check primary company key
    if (companyId) {
      const key = getStorageKey(CARDS_STORAGE_PREFIX, companyId);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }

    // 2. Check contactEmail key
    if (contactEmail) {
      const emailKey = getStorageKey(CARDS_STORAGE_PREFIX, contactEmail.toLowerCase().trim());
      const raw = localStorage.getItem(emailKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (companyId) saveCompanyCards(companyId, parsed);
          return parsed;
        }
      }
    }

    // 3. Check userId key
    if (userId && userId !== companyId) {
      const userKey = getStorageKey(CARDS_STORAGE_PREFIX, userId);
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (companyId) saveCompanyCards(companyId, parsed);
          return parsed;
        }
      }
    }

    // 4. Scan all localStorage keys for any saved cards
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CARDS_STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (companyId) saveCompanyCards(companyId, parsed);
              return parsed;
            }
          }
        } catch {}
      }
    }

    // 5. Look up in Admin Payments for any corporate card on file
    const allPay = getAdminPayments();
    const match = allPay.find(
      (p: AdminPaymentRecord) =>
        (companyId && p.company_id === companyId) ||
        (contactEmail && p.contact_email?.toLowerCase() === contactEmail.toLowerCase().trim()) ||
        p.payment_method === 'Corporate Card'
    );

    if (match && match.payment_method === 'Corporate Card') {
      const last4 = match.wise_reference?.replace(/\D/g, '').slice(-4) || '4242';
      const recoveredCard: PaymentCard = {
        id: `card-${match.id || Date.now()}`,
        brand: match.wise_reference?.toLowerCase().includes('mastercard')
          ? 'mastercard'
          : match.wise_reference?.toLowerCase().includes('amex')
          ? 'amex'
          : 'visa',
        last4,
        expMonth: '12',
        expYear: '28',
        cardholderName: match.company_name || 'Verified Member',
        isDefault: true,
        createdAt: match.created_at || new Date().toISOString(),
      };
      const cards = [recoveredCard];
      if (companyId) saveCompanyCards(companyId, cards);
      if (contactEmail) saveCompanyCards(contactEmail.toLowerCase().trim(), cards);
      return cards;
    }

    return [];
  } catch {
    return [];
  }
}

export function saveCompanyCards(
  companyId: string,
  cards: PaymentCard[],
  contactEmail?: string,
  userId?: string
) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId) {
      const key = getStorageKey(CARDS_STORAGE_PREFIX, companyId);
      localStorage.setItem(key, JSON.stringify(cards));
    }
    if (contactEmail) {
      const emailKey = getStorageKey(CARDS_STORAGE_PREFIX, contactEmail.toLowerCase().trim());
      localStorage.setItem(emailKey, JSON.stringify(cards));
    }
    if (userId && userId !== companyId) {
      const userKey = getStorageKey(CARDS_STORAGE_PREFIX, userId);
      localStorage.setItem(userKey, JSON.stringify(cards));
    }
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
  },
  contactEmail?: string
): { success: boolean; card?: PaymentCard; error?: string } {
  const cleanNumber = cardData.cardNumber.replace(/\s+/g, '');
  if (cleanNumber.length < 15) {
    return { success: false, error: 'Please enter a valid card number.' };
  }
  if (!cardData.cardholderName.trim()) {
    return { success: false, error: 'Cardholder name is required.' };
  }

  const cards = getCompanyCards(companyId, contactEmail);
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
  saveCompanyCards(companyId, updatedCards, contactEmail);

  // If set as default, update subscription record
  if (shouldBeDefault) {
    const sub = getCompanySubscription(companyId, contactEmail);
    sub.defaultCardId = newCard.id;
    saveCompanySubscription(companyId, sub, contactEmail);
  }

  return { success: true, card: newCard };
}

export function removePaymentCard(
  companyId: string,
  cardId: string,
  contactEmail?: string
): { success: boolean; error?: string } {
  const cards = getCompanyCards(companyId, contactEmail);
  const sub = getCompanySubscription(companyId, contactEmail);

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
    saveCompanySubscription(companyId, sub, contactEmail);
  }

  saveCompanyCards(companyId, remaining, contactEmail);
  return { success: true };
}

export function setDefaultCard(
  companyId: string,
  cardId: string,
  contactEmail?: string
): { success: boolean; error?: string } {
  const cards = getCompanyCards(companyId, contactEmail);
  const exists = cards.some((c) => c.id === cardId);
  if (!exists) return { success: false, error: 'Card not found.' };

  const updated = cards.map((c) => ({
    ...c,
    isDefault: c.id === cardId,
  }));
  saveCompanyCards(companyId, updated, contactEmail);

  const sub = getCompanySubscription(companyId, contactEmail);
  sub.defaultCardId = cardId;
  saveCompanySubscription(companyId, sub, contactEmail);

  return { success: true };
}

// ==========================================
// 2. SUBSCRIPTION MANAGEMENT
// ==========================================

export function getCompanySubscription(
  companyId?: string,
  contactEmail?: string,
  fallbackTier?: MembershipTier
): UserSubscription {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Check external sources for higher active tiers
  let detectedTier: MembershipTier | null = null;

  if (fallbackTier && fallbackTier !== 'bronze') {
    detectedTier = fallbackTier;
  }

  if (typeof window !== 'undefined') {
    try {
      const regTier = localStorage.getItem('b2b_registered_tier') as MembershipTier;
      if (regTier && (regTier === 'silver' || regTier === 'gold')) {
        if (!detectedTier) {
          detectedTier = regTier;
        }
      }

      // Check admin accounts
      const accounts = getAdminAccounts();
      const accountMatch = accounts.find(
        (a) =>
          (companyId && a.id === companyId) ||
          (contactEmail && a.email?.toLowerCase() === contactEmail.toLowerCase().trim())
      );
      if (accountMatch?.membership_tier && accountMatch.membership_tier !== 'bronze') {
        detectedTier = accountMatch.membership_tier;
      }
    } catch {}
  }

  const effectiveTier: MembershipTier = detectedTier || 'bronze';
  const pricing = TIER_PRICING[effectiveTier];

  const defaultSub: UserSubscription = {
    companyId: companyId || 'default',
    tier: effectiveTier,
    status: effectiveTier === 'bronze' ? 'free' : 'active',
    amountGbp: pricing.price,
    interval: 'month',
    currentPeriodStart: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEnd: nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currentPeriodEndTimestamp: nextMonth.getTime(),
    cancelAtPeriodEnd: false,
    defaultCardId: null,
  };

  if (typeof window === 'undefined') return defaultSub;

  try {
    let raw: string | null = null;
    let usedKey: string | null = null;

    if (companyId) {
      usedKey = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, companyId);
      raw = localStorage.getItem(usedKey);
    }

    if (!raw && contactEmail) {
      const emailKey = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, contactEmail.toLowerCase().trim());
      raw = localStorage.getItem(emailKey);
    }

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
          if (usedKey) localStorage.setItem(usedKey, JSON.stringify(sub));
          if (companyId) updateAccountTier(companyId, 'bronze');
          broadcastBillingUpdate();
          return sub;
        }
      }

      // If stored tier is bronze but account/registration/fallback is silver or gold, update it!
      if (effectiveTier !== 'bronze' && (sub.tier === 'bronze' || !sub.tier)) {
        sub.tier = effectiveTier;
        sub.status = 'active';
        sub.amountGbp = pricing.price;
        sub.cancelAtPeriodEnd = false;
        if (companyId) saveCompanySubscription(companyId, sub, contactEmail);
      }

      return sub;
    }

    // No existing subscription record found: save the defaultSub reflecting the active tier
    if (companyId) {
      saveCompanySubscription(companyId, defaultSub, contactEmail);
    }
    return defaultSub;
  } catch {
    return defaultSub;
  }
}

export function saveCompanySubscription(
  companyId: string,
  sub: UserSubscription,
  contactEmail?: string,
  userId?: string
) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId) {
      const key = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, companyId);
      localStorage.setItem(key, JSON.stringify(sub));
    }
    if (contactEmail) {
      const emailKey = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, contactEmail.toLowerCase().trim());
      localStorage.setItem(emailKey, JSON.stringify(sub));
    }
    if (userId && userId !== companyId) {
      const userKey = getStorageKey(SUBSCRIPTION_STORAGE_PREFIX, userId);
      localStorage.setItem(userKey, JSON.stringify(sub));
    }
    if (sub.tier) {
      localStorage.setItem('b2b_registered_tier', sub.tier);
    }
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
  const cards = getCompanyCards(companyId, contactEmail);
  if (newTier !== 'bronze' && cards.length === 0) {
    return {
      success: false,
      error: 'Please add a payment card before upgrading to a paid subscription.',
    };
  }

  const sub = getCompanySubscription(companyId, contactEmail, newTier);
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

  saveCompanySubscription(companyId, sub, contactEmail);
  if (cards.length > 0) {
    saveCompanyCards(companyId, cards, contactEmail);
  }

  // Update in Admin Store
  updateAccountTier(companyId, newTier, contactEmail);

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
  const cardRes = addPaymentCard(
    companyId,
    {
      cardNumber: cardData.cardNumber,
      cardholderName: cardData.cardholderName,
      expMonth: cardData.expMonth,
      expYear: cardData.expYear,
      brand: cardData.brand,
      setAsDefault: true,
    },
    contactEmail
  );

  if (!cardRes.success || !cardRes.card) {
    return { success: false, error: cardRes.error || 'Card verification failed.' };
  }

  // Multi-key sync for cards
  saveCompanyCards(companyId, [cardRes.card], contactEmail, userId);

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

  saveCompanySubscription(companyId, sub, contactEmail, userId);

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
        approval_status: 'pending',
        account_status: 'active',
        created_at: new Date().toISOString(),
        listings_count: 0,
        total_spend_or_sales: `€${pricing.price}/mo Membership`,
        verified_documents: false,
      };
      saveAdminAccounts([newAccount, ...existingAccounts]);
    } else {
      updateAccountTier(companyId, tier);
    }
  }

  return { success: true };
}
