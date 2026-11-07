'use client';

import { MOCK_COMPANIES, MOCK_PRODUCTS } from '@/lib/mock-data';
import { ALL_TRADING_BOARD_ITEMS, type TradingBoardItem } from '@/lib/trading-board-data';
import type { Company, MembershipTier, ApprovalStatus } from '@/types/database';
import {
  getStoredConversations,
  saveStoredConversations,
  type InquiryConversation,
  type InquiryMessage,
} from '@/lib/messaging/messaging-store';

export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface AdminClientAccount {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  role: 'seller' | 'buyer' | 'admin';
  membership_tier: MembershipTier;
  approval_status: ApprovalStatus;
  account_status: AccountStatus;
  company_number?: string | null;
  vat_number?: string | null;
  country?: string;
  created_at: string;
  last_active?: string;
  last_active_at?: string | null;
  last_inactivity_reminder_at?: string | null;
  wts_count?: number;
  wtb_count?: number;
  listings_count: number;
  total_spend_or_sales: string;
  verified_documents: boolean;
}

export type PaymentStatus = 'Completed' | 'Pending Verification' | 'Failed' | 'Refunded';
export type PaymentMethod = 'Wise Bank Transfer' | 'SEPA Wire' | 'Corporate Card' | 'Free Activation';

export interface AdminPaymentRecord {
  id: string;
  company_id: string;
  company_name: string;
  contact_email: string;
  plan_or_service: string;
  amount_gbp: number;
  payment_method: PaymentMethod;
  wise_reference: string;
  transaction_id: string;
  status: PaymentStatus;
  created_at: string;
  completed_at?: string | null;
  invoice_number: string;
  notes?: string;
}

export interface AdminModeratedListing {
  id: string;
  type: 'BUY' | 'SELL';
  company_id: string;
  company_name: string;
  seller_email: string;
  contact_name?: string;
  contact_phone?: string;
  title: string;
  brand: string;
  item_code: string;
  category_slug: string;
  category_name: string;
  ean: string;
  condition: string;
  unit_price: number;
  currency: string;
  location: string;
  quantity_available: number;
  moq: number;
  barcode_or_sku?: string | null;
  is_hot: boolean;
  moderation_status: 'active' | 'suspended' | 'flagged';
  moderation_reason?: string | null;
  images: string[];
  created_at: string;
}

// STORAGE KEYS (bumped to v4 for clean testing state)
const ACCOUNTS_STORAGE_KEY = 'b2b_admin_accounts_v4';
const PAYMENTS_STORAGE_KEY = 'b2b_admin_payments_v4';
const LISTINGS_STORAGE_KEY = 'b2b_admin_listings_v5';
const DELETED_ACCOUNTS_STORAGE_KEY = 'b2b_admin_deleted_accounts_v4';

export function getDeletedAccountIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markAccountAsDeleted(idOrEmail?: string | null) {
  if (typeof window === 'undefined' || !idOrEmail) return;
  const clean = idOrEmail.trim().toLowerCase();
  // Admin account cannot be deleted or removed
  if (clean === 'admin@b2blink.eu' || clean === 'admin_company') return;

  try {
    const list = getDeletedAccountIds();
    let changed = false;
    if (!list.includes(clean)) {
      list.push(clean);
      changed = true;
    }
    if (!list.includes(idOrEmail)) {
      list.push(idOrEmail);
      changed = true;
    }
    if (changed) {
      localStorage.setItem(DELETED_ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function unmarkAccountAsDeleted(idOrEmail?: string | null) {
  if (typeof window === 'undefined' || !idOrEmail) return;
  try {
    const list = getDeletedAccountIds();
    const clean = idOrEmail.trim().toLowerCase();
    const filtered = list.filter((item) => item !== clean && item !== idOrEmail);
    if (filtered.length !== list.length) {
      localStorage.setItem(DELETED_ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {}
}

export function isAccountDeleted(id?: string | null, email?: string | null): boolean {
  if (email && email.trim().toLowerCase() === 'admin@b2blink.eu') return false;
  const deleted = getDeletedAccountIds();
  if (!deleted || deleted.length === 0) return false;
  if (id && deleted.includes(id)) return true;
  if (email && (deleted.includes(email) || deleted.includes(email.trim().toLowerCase()))) return true;
  return false;
}

// INITIAL SEED ACCOUNTS (Clean empty state for real user accounts & testing)
const INITIAL_ACCOUNTS: AdminClientAccount[] = [];

// INITIAL SEED PAYMENTS - Verified membership transactions for active Gold seller accounts
export const INITIAL_PAYMENTS: AdminPaymentRecord[] = [
  {
    id: 'PAY-a73bd495',
    company_id: 'a73bd495-ab88-47f3-9b10-631d9d3cbc55',
    company_name: 'G Line Investments',
    contact_email: 'vee@globle-investments.com',
    plan_or_service: 'Gold VIP Membership',
    amount_gbp: 179.0,
    payment_method: 'Wise Bank Transfer',
    wise_reference: 'WISE-GLINE-8821',
    transaction_id: 'TX-WISE-GL8821',
    status: 'Completed',
    created_at: '29 Oct 2026, 16:05',
    completed_at: '29 Oct 2026, 16:05',
    invoice_number: 'INV-2026-004',
    notes: 'Direct Wise B2B settlement verified and cleared.',
  },
  {
    id: 'PAY-f947aaa9',
    company_id: 'f947aaa9-ee79-4361-bbc5-6d8efa9136ad',
    company_name: 'European Holding OU',
    contact_email: 'jeff@european-holdings.ee',
    plan_or_service: 'Gold VIP Membership',
    amount_gbp: 179.0,
    payment_method: 'SEPA Wire',
    wise_reference: 'SEPA-EUHOLD-4392',
    transaction_id: 'TX-SEPA-EH4392',
    status: 'Completed',
    created_at: '26 Oct 2026, 17:55',
    completed_at: '26 Oct 2026, 17:55',
    invoice_number: 'INV-2026-003',
    notes: 'SEPA Direct Business Wire settled to B2B LINK IBAN.',
  },
  {
    id: 'PAY-151a6ad8',
    company_id: '151a6ad8-9d02-4fe5-809d-e0e4af0f6a3d',
    company_name: 'Unit D5 The Seedbed Centre IG10 3TQ',
    contact_email: 'info@rensure.co.uk',
    plan_or_service: 'Gold VIP Membership',
    amount_gbp: 179.0,
    payment_method: 'Wise Bank Transfer',
    wise_reference: 'WISE-RENSURE-7714',
    transaction_id: 'TX-WISE-RE7714',
    status: 'Completed',
    created_at: '26 Oct 2026, 17:45',
    completed_at: '26 Oct 2026, 17:45',
    invoice_number: 'INV-2026-002',
    notes: 'Wise business transfer cleared.',
  },
  {
    id: 'PAY-cdf59748',
    company_id: 'cdf59748-4090-4a15-b630-7ec2f62e1241',
    company_name: 'Globle Investments Ltd',
    contact_email: 'jeff@globle-investments.com',
    plan_or_service: 'Gold VIP Membership',
    amount_gbp: 179.0,
    payment_method: 'Corporate Card',
    wise_reference: 'STRIPE-CH-99214',
    transaction_id: 'TX-CARD-GL9921',
    status: 'Completed',
    created_at: '26 Oct 2026, 17:18',
    completed_at: '26 Oct 2026, 17:18',
    invoice_number: 'INV-2026-001',
    notes: 'Recurring monthly subscription charge succeeded.',
  },
];

// INITIAL SEED MODERATED LISTINGS (Empty for testing)
const INITIAL_LISTINGS: AdminModeratedListing[] = [];

// BROADCAST HELPER
function broadcastAdminUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('b2b_admin_update'));
  }
}

// ==========================================
// 1. ACCOUNTS MANAGEMENT
// ==========================================
export function getAdminAccounts(): AdminClientAccount[] {
  const filterClientsOnly = (list: AdminClientAccount[]) =>
    list.filter(
      (a) =>
        !isAccountDeleted(a.id, a.email) &&
        a.role !== 'admin' &&
        a.email?.toLowerCase() !== 'admin@b2blink.eu'
    );

  if (typeof window === 'undefined') return filterClientsOnly(INITIAL_ACCOUNTS);
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return filterClientsOnly(parsed);
      }
    }
    const filteredInitial = filterClientsOnly(INITIAL_ACCOUNTS);
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filteredInitial));
    return filteredInitial;
  } catch {
    // ignore
  }
  return filterClientsOnly(INITIAL_ACCOUNTS);
}

export function saveAdminAccounts(accounts: AdminClientAccount[]) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(accounts) || accounts.length === 0) return; // Prevent network blips from wiping cached accounts
  try {
    // Reconcile: If active accounts are provided, ensure they are unflagged from deleted blacklist
    for (const a of accounts) {
      if (a.id) unmarkAccountAsDeleted(a.id);
      if (a.email) unmarkAccountAsDeleted(a.email);
    }
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    broadcastAdminUpdate();
  } catch {
    // ignore
  }
}

export function suspendAccount(companyId: string): boolean {
  const current = getAdminAccounts();
  const updated = current.map((acc) =>
    acc.id === companyId
      ? { ...acc, account_status: 'suspended' as AccountStatus, approval_status: 'rejected' as ApprovalStatus }
      : acc
  );
  saveAdminAccounts(updated);
  return true;
}

export function updateAccountBasicInfo(
  companyId: string,
  updatedData: Partial<AdminClientAccount>
): boolean {
  const current = getAdminAccounts();
  const idx = current.findIndex((a) => a.id === companyId);
  if (idx === -1) return false;

  current[idx] = {
    ...current[idx],
    ...updatedData,
  };
  saveAdminAccounts(current);
  return true;
}

export function unsuspendAccount(companyId: string): boolean {
  const current = getAdminAccounts();
  const updated = current.map((acc) =>
    acc.id === companyId
      ? { ...acc, account_status: 'active' as AccountStatus, approval_status: 'approved' as ApprovalStatus }
      : acc
  );
  saveAdminAccounts(updated);
  return true;
}



export function deleteAccount(companyId: string, email?: string | null): boolean {
  const current = getAdminAccounts();
  const targetAcc = current.find(
    (a) => a.id === companyId || (email && a.email?.toLowerCase() === email.toLowerCase())
  );
  const effectiveEmail = email || targetAcc?.email;

  // Guard: Admin account cannot be deleted or removed
  if (
    targetAcc?.role === 'admin' ||
    effectiveEmail?.toLowerCase() === 'admin@b2blink.eu' ||
    companyId === 'admin_company'
  ) {
    console.warn('Admin account cannot be deleted or removed.');
    return false;
  }

  markAccountAsDeleted(companyId);
  if (effectiveEmail) {
    markAccountAsDeleted(effectiveEmail);
  }

  const updated = current.filter(
    (acc) => acc.id !== companyId && (!effectiveEmail || acc.email.toLowerCase() !== effectiveEmail.toLowerCase())
  );
  saveAdminAccounts(updated);

  // CASCADE DELETE ALL LISTINGS & WTB REQUESTS FOR THIS ACCOUNT
  if (typeof window !== 'undefined') {
    try {
      // 1. Purge from LISTINGS_STORAGE_KEY (b2b_admin_listings_v5)
      const rawAdminListings = localStorage.getItem(LISTINGS_STORAGE_KEY);
      if (rawAdminListings) {
        const parsed = JSON.parse(rawAdminListings);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (l: any) =>
              l.company_id !== companyId &&
              l.companyId !== companyId &&
              (!effectiveEmail || l.seller_email?.toLowerCase() !== effectiveEmail.toLowerCase()) &&
              (!effectiveEmail || l.contactEmail?.toLowerCase() !== effectiveEmail.toLowerCase())
          );
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(remaining));
        }
      }

      // 2. Purge from user seller listings (b2b_seller_listings_v3)
      const rawUserSell = localStorage.getItem('b2b_seller_listings_v3');
      if (rawUserSell) {
        const parsed = JSON.parse(rawUserSell);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (l: any) =>
              l.company_id !== companyId &&
              l.companyId !== companyId &&
              (!effectiveEmail || l.seller_email?.toLowerCase() !== effectiveEmail.toLowerCase()) &&
              (!effectiveEmail || l.contactEmail?.toLowerCase() !== effectiveEmail.toLowerCase())
          );
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(remaining));
        }
      }

      // 3. Purge from user WTB requests (b2b_user_wtb_requests_v2)
      const rawUserWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
      if (rawUserWtb) {
        const parsed = JSON.parse(rawUserWtb);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (w: any) =>
              w.company_id !== companyId &&
              w.companyId !== companyId &&
              w.buyerCompanyId !== companyId &&
              (!effectiveEmail || w.contactEmail?.toLowerCase() !== effectiveEmail.toLowerCase()) &&
              (!effectiveEmail || w.buyerEmail?.toLowerCase() !== effectiveEmail.toLowerCase())
          );
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(remaining));
        }
      }

      // 4. Purge from payments records (PAYMENTS_STORAGE_KEY)
      const rawPayments = localStorage.getItem(PAYMENTS_STORAGE_KEY);
      if (rawPayments) {
        const parsed = JSON.parse(rawPayments);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (p: any) =>
              p.company_id !== companyId &&
              (!effectiveEmail || p.contact_email?.toLowerCase() !== effectiveEmail.toLowerCase())
          );
          localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(remaining));
        }
      }
    } catch (err) {
      console.error('Error cascading account deletion:', err);
    }

    // Broadcast across all tabs and components
    window.dispatchEvent(new CustomEvent('b2b_admin_update'));
    window.dispatchEvent(new CustomEvent('b2b_listing_created'));
    window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
    window.dispatchEvent(new CustomEvent('b2b_wtb_created'));
  }

  return true;
}

export function updateAccountTier(
  companyIdOrEmail: string,
  newTier: MembershipTier,
  email?: string
): boolean {
  const current = getAdminAccounts();
  const cleanKey = (companyIdOrEmail || '').toLowerCase().trim();
  const cleanEmail = email ? email.toLowerCase().trim() : '';

  const updated = current.map((acc) => {
    const matches =
      acc.id === companyIdOrEmail ||
      (acc.email && acc.email.toLowerCase().trim() === cleanKey) ||
      (cleanEmail && acc.email && acc.email.toLowerCase().trim() === cleanEmail);

    if (matches) {
      return {
        ...acc,
        membership_tier: newTier,
        total_spend_or_sales:
          acc.role === 'seller'
            ? `€${newTier === 'gold' ? '179' : newTier === 'silver' ? '79' : '0'}/mo Membership`
            : '€0 (Free Buyer Access)',
      };
    }
    return acc;
  });

  saveAdminAccounts(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('b2b_billing_update'));
    window.dispatchEvent(new CustomEvent('b2b_admin_update'));

    // Reconcile with server backend
    try {
      fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tier',
          companyId: companyIdOrEmail,
          email: email || cleanEmail,
          tier: newTier,
        }),
      }).catch(() => {});
    } catch {}

    // Auto-record membership payment if upgraded to a paid tier (Gold/Silver)
    if (newTier === 'gold' || newTier === 'silver') {
      try {
        const targetAcc = updated.find(
          (a) =>
            a.id === companyIdOrEmail ||
            (cleanKey && a.email?.toLowerCase().trim() === cleanKey) ||
            (cleanEmail && a.email?.toLowerCase().trim() === cleanEmail)
        );
        if (targetAcc) {
          const payments = getAdminPayments();
          const hasPayment = payments.some(
            (p) =>
              p.company_id === targetAcc.id ||
              (targetAcc.email && p.contact_email?.toLowerCase().trim() === targetAcc.email.toLowerCase().trim())
          );
          if (!hasPayment) {
            const price = newTier === 'gold' ? 179.0 : 79.0;
            const now =
              new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
              ', ' +
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newPayment: AdminPaymentRecord = {
              id: `PAY-${Date.now().toString().slice(-6)}`,
              company_id: targetAcc.id,
              company_name: targetAcc.name,
              contact_email: targetAcc.email,
              plan_or_service: `${newTier === 'gold' ? 'Gold VIP' : 'Silver Tier'} Membership`,
              amount_gbp: price,
              payment_method: 'Wise Bank Transfer',
              wise_reference: `WISE-${targetAcc.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-UPG`,
              transaction_id: `TX-${Date.now().toString().slice(-8)}`,
              status: 'Completed',
              created_at: now,
              completed_at: now,
              invoice_number: `INV-2026-${Math.floor(110 + Math.random() * 890)}`,
              notes: 'Tier upgraded by admin.',
            };
            saveAdminPayments([newPayment, ...payments]);
          }
        }
      } catch {}
    }
  }

  return true;
}

export function updateAccountApproval(companyId: string, status: ApprovalStatus): boolean {
  const current = getAdminAccounts();
  const updated = current.map((acc) =>
    acc.id === companyId
      ? {
          ...acc,
          approval_status: status,
          account_status: status === 'approved' ? ('active' as AccountStatus) : ('suspended' as AccountStatus),
          verified_documents: status === 'approved',
        }
      : acc
  );
  saveAdminAccounts(updated);

  if (typeof window !== 'undefined') {
    try {
      // Sync cached user company if this is the currently authenticated member
      const target = updated.find((acc) => acc.id === companyId);
      const cachedRaw = localStorage.getItem('b2b_cached_company');
      if (cachedRaw && target) {
        const cached = JSON.parse(cachedRaw);
        if (cached && (cached.id === companyId || (cached.email && target.email && cached.email.toLowerCase() === target.email.toLowerCase()))) {
          cached.approval_status = status;
          localStorage.setItem('b2b_cached_company', JSON.stringify(cached));
        }
      }

      // If approved, mark verified and trigger fresh onboarding popup on next dashboard load
      if (status === 'approved' && target) {
        if (target.id) {
          localStorage.setItem(`b2b_account_verified_${target.id}`, 'true');
          localStorage.removeItem(`b2b_onboarding_completed_${target.id}`);
        }
        if (target.email) {
          const cleanEmail = target.email.toLowerCase().trim();
          localStorage.setItem(`b2b_account_verified_${cleanEmail}`, 'true');
          localStorage.removeItem(`b2b_onboarding_completed_${cleanEmail}`);
        }
        sessionStorage.setItem('b2b_just_verified', 'true');
        sessionStorage.setItem('b2b_show_onboarding', 'true');
      }

      // Notify any active components
      window.dispatchEvent(new CustomEvent('b2b_account_status_change', { detail: { companyId, status } }));

      // Persist to backend and update Supabase auth metadata
      if (target) {
        fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: status === 'approved' ? 'approve' : 'suspend',
            companyId,
            email: target.email,
            contactName: target.contact_name,
            companyName: target.name,
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  return true;
}

// ==========================================
// 2. PAYMENT RECORDS
// ==========================================
export function reconcilePaymentsWithAccounts(
  payments: AdminPaymentRecord[],
  accounts?: AdminClientAccount[]
): AdminPaymentRecord[] {
  const result = [...payments];
  const list = accounts || (typeof window !== 'undefined' ? getAdminAccounts() : []);

  // First ensure default seed payments for known gold accounts are present if list is empty
  for (const initPay of INITIAL_PAYMENTS) {
    if (!result.some((p) => p.company_id === initPay.company_id || (p.contact_email && p.contact_email.toLowerCase() === initPay.contact_email.toLowerCase()))) {
      result.push(initPay);
    }
  }

  // Next reconcile dynamically with any active Gold or Silver accounts in the list
  for (const acc of list) {
    if (acc.role === 'admin' || acc.email?.toLowerCase() === 'admin@b2blink.eu') continue;
    if (acc.membership_tier !== 'gold' && acc.membership_tier !== 'silver') continue;

    const hasPayment = result.some(
      (p) =>
        p.company_id === acc.id ||
        (acc.email && p.contact_email?.toLowerCase().trim() === acc.email.toLowerCase().trim())
    );

    if (!hasPayment) {
      const isGold = acc.membership_tier === 'gold';
      const price = isGold ? 179.0 : 79.0;
      const plan = isGold ? 'Gold VIP Membership' : 'Silver Tier Membership';
      const defaultDef = INITIAL_PAYMENTS.find(
        (ip) =>
          ip.company_id === acc.id ||
          (acc.email && ip.contact_email.toLowerCase() === acc.email.toLowerCase())
      );

      result.push(
        defaultDef || {
          id: `PAY-${acc.id.slice(0, 8)}`,
          company_id: acc.id,
          company_name: acc.name,
          contact_email: acc.email,
          plan_or_service: plan,
          amount_gbp: price,
          payment_method: 'Wise Bank Transfer',
          wise_reference: `WISE-${acc.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-01`,
          transaction_id: `TX-WISE-${acc.id.slice(0, 6).toUpperCase()}`,
          status: 'Completed',
          created_at: acc.created_at
            ? new Date(acc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', 10:00'
            : '26 Oct 2026, 10:00',
          completed_at: acc.created_at
            ? new Date(acc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', 10:00'
            : '26 Oct 2026, 10:00',
          invoice_number: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
          notes: 'Membership payment automatically reconciled.',
        }
      );
    }
  }

  return result;
}

export function getAdminPayments(): AdminPaymentRecord[] {
  if (typeof window === 'undefined') return INITIAL_PAYMENTS;
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const reconciled = reconcilePaymentsWithAccounts(parsed);
        if (reconciled.length !== parsed.length) {
          localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(reconciled));
        }
        return reconciled;
      }
    }
    // Seed initial payments if empty or null
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENTS));
    return INITIAL_PAYMENTS;
  } catch {
    // ignore
  }
  return INITIAL_PAYMENTS;
}

export function saveAdminPayments(payments: AdminPaymentRecord[]) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(payments) || payments.length === 0) return; // Prevent empty payload wipes
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
    broadcastAdminUpdate();
  } catch {
    // ignore
  }
}

export function markPaymentCompleted(paymentId: string): boolean {
  const payments = getAdminPayments();
  const payment = payments.find((p) => p.id === paymentId);
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updatedPayments = payments.map((p) =>
    p.id === paymentId
      ? { ...p, status: 'Completed' as PaymentStatus, completed_at: now }
      : p
  );
  saveAdminPayments(updatedPayments);

  // If this payment was for a company, automatically approve that company if not already approved!
  if (payment?.company_id) {
    const accounts = getAdminAccounts();
    const existing = accounts.find((a) => a.id === payment.company_id || (payment.contact_email && a.email?.toLowerCase() === payment.contact_email.toLowerCase().trim()));
    if (existing && existing.approval_status !== 'approved') {
      updateAccountApproval(payment.company_id, 'approved');
    }
  }

  return true;
}

export function recordManualPayment(newPay: Omit<AdminPaymentRecord, 'id' | 'created_at' | 'invoice_number'>): AdminPaymentRecord {
  const payments = getAdminPayments();
  const id = `PAY-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoice = `INV-2026-${Math.floor(110 + Math.random() * 890)}`;
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const created: AdminPaymentRecord = {
    ...newPay,
    id,
    created_at: now,
    completed_at: newPay.status === 'Completed' ? now : null,
    invoice_number: invoice,
  };

  saveAdminPayments([created, ...payments]);

  if (created.status === 'Completed' && created.company_id) {
    const accounts = getAdminAccounts();
    const existing = accounts.find(
      (a) =>
        a.id === created.company_id ||
        (created.contact_email && a.email?.toLowerCase() === created.contact_email.toLowerCase().trim())
    );
    // Only trigger initial KYC approval if account is NOT already approved and NOT a membership renewal/upgrade
    const planText = (created.plan_or_service || '').toLowerCase();
    const isMembershipTx = planText.includes('membership') || planText.includes('upgrade') || planText.includes('subscription');
    if (existing && existing.approval_status !== 'approved' && !isMembershipTx) {
      updateAccountApproval(created.company_id, 'approved');
    }
  }

  return created;
}

export function deletePayment(paymentId: string): boolean {
  const current = getAdminPayments();
  const updated = current.filter((p) => p.id !== paymentId);
  saveAdminPayments(updated);
  return true;
}

// ==========================================
// 3. LISTINGS MODERATION
// ==========================================
export function getAdminListings(): AdminModeratedListing[] {
  if (typeof window === 'undefined') return INITIAL_LISTINGS;
  try {
    // Clear out legacy mock and old test keys so they never contaminate the store
    localStorage.removeItem('b2b_admin_listings_v1');
    localStorage.removeItem('b2b_admin_listings_v2');
    localStorage.removeItem('b2b_admin_listings_v3');
    localStorage.removeItem('b2b_admin_listings_v4');
    localStorage.removeItem('b2b_seller_listings_v1');
    localStorage.removeItem('b2b_seller_listings_real_v2');
    localStorage.removeItem('b2b_user_wtb_requests_v1');

    // 1. Check if we have user-created sell listings or WTBs in localStorage
    const rawUserListings = localStorage.getItem('b2b_seller_listings_v3');
    const userSellListings = rawUserListings ? JSON.parse(rawUserListings) : [];

    const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
    const userWtbListings = rawUserWtbs ? JSON.parse(rawUserWtbs) : [];

    const formattedUserItems: AdminModeratedListing[] = [
      ...(Array.isArray(userSellListings)
        ? userSellListings.map((l: any, idx: number) => ({
            id: l.id || `user-lst-${idx}`,
            type: 'SELL' as const,
            company_id: l.company_id || 'user-seller',
            company_name: l.companyName || 'Verified Supplier',
            seller_email: l.contactEmail || 'supplier@b2blink.eu',
            contact_name: l.contactName || 'Trade Desk',
            contact_phone: l.contactPhone || '',
            title: l.title || l.description || 'Wholesale Lot',
            brand: l.brand || 'Wholesale',
            item_code: l.itemCode || (l.ean && l.ean !== '195949048735' && l.ean !== 'n/a' ? l.ean.slice(0, 8) : 'MDL-2026'),
            category_slug: (l.category || 'electronics').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category_name: l.category || 'Consumer Electronics',
            ean: (l.ean && l.ean !== '195949048735') ? l.ean : 'n/a',
            condition: l.condition || 'New',
            unit_price: Number(l.unitPrice || l.price || 99),
            currency: l.currency || '€',
            location: l.location || 'DE',
            quantity_available: Number(l.available || l.qty || 50),
            moq: Number(l.moq || 10),
            barcode_or_sku: l.ean || l.itemCode,
            is_hot: false,
            moderation_status: 'active' as const,
            images: l.images || [],
            created_at: l.created_at || new Date().toISOString(),
          }))
        : []),
      ...(Array.isArray(userWtbListings)
        ? userWtbListings.map((w: any) => ({
            id: w.id,
            type: 'BUY' as const,
            company_id: w.company_id || 'user-buyer',
            company_name: w.companyName || 'Verified Buyer',
            seller_email: w.contactEmail || 'buyer@b2blink.eu',
            contact_name: w.contactName || 'Procurement Desk',
            contact_phone: w.contactPhone || '',
            title: w.description || w.title || 'Wanted Lot',
            brand: w.brand || 'Procurement',
            item_code: w.itemCode || 'WTB-REQ',
            category_slug: (w.category || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category_name: w.category || 'General Wholesale',
            ean: (w.ean && w.ean !== '8806095087286' && w.ean !== '—') ? w.ean : 'n/a',
            condition: w.condition || 'New',
            unit_price: Number(w.price || 0),
            currency: w.currency || '€',
            location: w.location || 'EU',
            quantity_available: Number(w.qty || 100),
            moq: Number(w.moq || 1),
            barcode_or_sku: w.ean || w.itemCode,
            is_hot: false,
            moderation_status: 'active' as const,
            images: [],
            created_at: new Date().toISOString(),
          }))
        : []),
    ];

    const raw = localStorage.getItem(LISTINGS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const combined = [...parsed, ...formattedUserItems];
        const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());
        return unique.filter((l) => !isAccountDeleted(l.company_id, l.seller_email));
      }
    }

    const mergedInitial = Array.from(
      new Map([...formattedUserItems, ...INITIAL_LISTINGS].map((item) => [item.id, item])).values()
    );
    const cleanInitial = mergedInitial.filter((l) => !isAccountDeleted(l.company_id, l.seller_email));
    localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(cleanInitial));
    return cleanInitial;
  } catch {
    // ignore
  }
  return INITIAL_LISTINGS;
}

export function saveAdminListings(listings: AdminModeratedListing[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(listings));
    broadcastAdminUpdate();
  } catch {
    // ignore
  }
}

export function suspendListing(productId: string, reason?: string): boolean {
  const listings = getAdminListings();
  const defaultReason = reason || 'Suspended by admin for commercial compliance check.';
  const updated = listings.map((l) =>
    l.id === productId
      ? { ...l, moderation_status: 'suspended' as const, moderation_reason: defaultReason }
      : l
  );
  saveAdminListings(updated);

  if (typeof window !== 'undefined') {
    fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: productId, status: 'suspended', reason: defaultReason }),
    }).catch(() => {});
  }

  return true;
}

export function suspendListings(productIds: string[], reason?: string): boolean {
  if (!productIds.length) return true;
  const idSet = new Set(productIds);
  const listings = getAdminListings();
  const defaultReason = reason || 'Suspended by admin for commercial compliance check.';
  const updated = listings.map((l) =>
    idSet.has(l.id)
      ? { ...l, moderation_status: 'suspended' as const, moderation_reason: defaultReason }
      : l
  );
  saveAdminListings(updated);

  if (typeof window !== 'undefined') {
    fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: productIds, status: 'suspended', reason: defaultReason }),
    }).catch(() => {});
  }

  return true;
}

export function reinstateListing(productId: string): boolean {
  const listings = getAdminListings();
  const updated = listings.map((l) =>
    l.id === productId
      ? { ...l, moderation_status: 'active' as const, moderation_reason: null }
      : l
  );
  saveAdminListings(updated);

  if (typeof window !== 'undefined') {
    fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: productId, status: 'active' }),
    }).catch(() => {});
  }

  return true;
}

export function deleteListing(productId: string): boolean {
  const listings = getAdminListings();
  const updated = listings.filter((l) => l.id !== productId);
  saveAdminListings(updated);

  if (typeof window !== 'undefined') {
    try {
      const rawUser = localStorage.getItem('b2b_seller_listings_v3');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(parsed.filter((p: any) => p.id !== productId)));
        }
      }
      const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
      if (rawWtb) {
        const parsed = JSON.parse(rawWtb);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(parsed.filter((w: any) => w.id !== productId)));
        }
      }
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
      window.dispatchEvent(new CustomEvent('b2b_wtb_created'));

      fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}
  }
  return true;
}

export function deleteListings(productIds: string[]): boolean {
  if (!productIds.length) return true;
  const idSet = new Set(productIds);
  const listings = getAdminListings();
  const updated = listings.filter((l) => !idSet.has(l.id));
  saveAdminListings(updated);

  if (typeof window !== 'undefined') {
    try {
      const rawUser = localStorage.getItem('b2b_seller_listings_v3');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(parsed.filter((p: any) => !idSet.has(p.id))));
        }
      }
      const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
      if (rawWtb) {
        const parsed = JSON.parse(rawWtb);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(parsed.filter((w: any) => !idSet.has(w.id))));
        }
      }
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
      window.dispatchEvent(new CustomEvent('b2b_wtb_created'));

      fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: productIds }),
      }).catch(() => {});
    } catch {}
  }
  return true;
}

export function toggleListingHot(productId: string): boolean {
  const listings = getAdminListings();
  const updated = listings.map((l) =>
    l.id === productId ? { ...l, is_hot: !l.is_hot } : l
  );
  saveAdminListings(updated);
  return true;
}

// ==========================================
// 4. ADMIN-TO-SELLER MESSAGING & BROADCASTS
// ==========================================
export interface AdminSellerThread {
  sellerId: string;
  sellerName: string;
  sellerContact: string;
  sellerEmail: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
}

const ADMIN_CONVERSATIONS_KEY = 'b2b_admin_threads_v1';

export function getAdminSellerThreads(): InquiryConversation[] {
  // Return existing admin desk / compliance threads without auto-injecting mock welcome messages
  const conversations = getStoredConversations();
  return conversations.filter((c) => c.id.startsWith('conv-admin-'));
}

export function broadcastMessageToAllSellers(broadcastText: string): number {
  if (!broadcastText.trim()) return 0;
  const threads = getAdminSellerThreads();
  const allConversations = getStoredConversations();
  const nowIso = new Date().toISOString();

  let count = 0;

  for (const thread of threads) {
    const target = allConversations.find((c) => c.id === thread.id);
    if (target) {
      const newMsg: InquiryMessage = {
        id: `msg-bcast-${Date.now()}-${count}`,
        senderRole: 'buyer', // admin
        senderName: 'Jeff Vetting Director (Platform Announcement)',
        senderId: 'comp-jeff-admin',
        text: broadcastText.trim(),
        timestamp: nowIso,
        isRead: false,
      };

      target.messages.push(newMsg);
      target.lastMessageText = broadcastText.trim();
      target.lastMessageTime = 'Just now';
      target.unreadBySeller = true;
      count++;
    }
  }

  saveStoredConversations(allConversations);
  return count;
}

// ==========================================
// 6. CUSTOMER QUERIES (CONTACT US DESK)
// ==========================================

export interface CustomerQuery {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
  created_at: string;
  status: 'new' | 'replied';
  reply_text?: string;
  replied_at?: string;
}

const QUERIES_STORAGE_KEY = 'b2b_customer_queries_v2';

const INITIAL_QUERIES: CustomerQuery[] = [];


export function getCustomerQueries(): CustomerQuery[] {
  if (typeof window === 'undefined') return INITIAL_QUERIES;
  try {
    const raw = localStorage.getItem(QUERIES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(INITIAL_QUERIES));
    return INITIAL_QUERIES;
  } catch {
    return INITIAL_QUERIES;
  }
}

export function saveCustomerQueries(queries: CustomerQuery[], emitEvents = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(queries));
    if (emitEvents) {
      window.dispatchEvent(new CustomEvent('b2b_admin_update'));
      window.dispatchEvent(new CustomEvent('b2b_queries_update'));
    }
  } catch {}
}

export function syncLocalCustomerQuery(serverQuery: CustomerQuery) {
  if (typeof window === 'undefined') return;
  const queries = getCustomerQueries();
  if (queries.some((q) => q.id === serverQuery.id)) return;
  const filtered = queries.filter(
    (q) =>
      !(
        q.email.toLowerCase().trim() === serverQuery.email.toLowerCase().trim() &&
        q.message.toLowerCase().trim() === serverQuery.message.toLowerCase().trim()
      )
  );
  filtered.unshift(serverQuery);
  saveCustomerQueries(filtered);
}

export function addCustomerQuery(
  data: {
    name: string;
    company: string;
    email: string;
    phone?: string;
    topic?: string;
    message: string;
  },
  options: { syncToServer?: boolean } = {}
): CustomerQuery {
  const queries = getCustomerQueries();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const newQuery: CustomerQuery = {
    id: `query-${Date.now()}`,
    name: data.name.trim() || 'Wholesale Trader',
    company: data.company.trim() || 'Direct Inquiry',
    email: data.email.trim(),
    phone: data.phone?.trim() || '',
    topic: data.topic || 'general',
    message: data.message.trim(),
    created_at: dateStr,
    status: 'new',
  };

  queries.unshift(newQuery);
  saveCustomerQueries(queries);

  // Only dispatch network request if explicitly configured (avoids duplicate submissions)
  if (options.syncToServer && typeof window !== 'undefined') {
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newQuery.name,
        company: newQuery.company,
        email: newQuery.email,
        phone: newQuery.phone,
        topic: newQuery.topic,
        message: newQuery.message,
      }),
    }).catch(() => {});
  }

  return newQuery;
}

export function replyCustomerQuery(id: string, replyText: string): CustomerQuery | null {
  const queries = getCustomerQueries();
  const target = queries.find((q) => q.id === id);
  if (!target) return null;

  const now = new Date();
  target.status = 'replied';
  target.reply_text = replyText.trim();
  target.replied_at = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  saveCustomerQueries(queries);

  if (typeof window !== 'undefined') {
    fetch('/api/admin/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reply',
        id,
        replyText,
        replySubject: `Re: B2B LINK Support Desk - ${target.topic.toUpperCase()} Inquiry`,
      }),
    }).catch(() => {});
  }

  return target;
}

export function deleteCustomerQuery(id: string): boolean {
  const queries = getCustomerQueries();
  const filtered = queries.filter((q) => q.id !== id);
  if (filtered.length !== queries.length) {
    saveCustomerQueries(filtered);

    if (typeof window !== 'undefined') {
      fetch('/api/admin/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      }).catch(() => {});
    }

    return true;
  }
  return false;
}
