'use client';

import type { MembershipTier, ApprovalStatus } from '@/types/database';
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
const PAYMENTS_STORAGE_KEY = 'b2b_admin_payments_v4';
const LISTINGS_STORAGE_KEY = 'b2b_admin_listings_v5';

export function getDeletedAccountIds(): string[] {
  return [];
}

export function markAccountAsDeleted(_idOrEmail?: string | null) {
  void _idOrEmail;
  // No-op: Account deletion is managed authoritatively via the database
}

export function unmarkAccountAsDeleted(_idOrEmail?: string | null) {
  void _idOrEmail;
  // No-op: Account deletion is managed authoritatively via the database
}

export function isAccountDeleted(_id?: string | null, _email?: string | null): boolean {
  void _id;
  void _email;
  return false;
}

// Empty initial seed structures (Hardcoded sample accounts, listings, and payments removed)
export const INITIAL_PAYMENTS: AdminPaymentRecord[] = [];

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
  return [];
}

export function saveAdminAccounts(_accounts: AdminClientAccount[]) {
  // No-op: Accounts are managed authoritatively via PostgreSQL public.companies and auth.users
  if (typeof window !== 'undefined') {
    broadcastAdminUpdate();
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
            (l: { company_id?: string; companyId?: string; seller_email?: string; contactEmail?: string }) =>
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
            (l: { company_id?: string; companyId?: string; seller_email?: string; contactEmail?: string }) =>
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
            (w: { company_id?: string; companyId?: string; buyerCompanyId?: string; contactEmail?: string; buyerEmail?: string }) =>
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
            (p: { company_id?: string; contact_email?: string }) =>
              p.company_id !== companyId &&
              (!effectiveEmail || p.contact_email?.toLowerCase() !== effectiveEmail.toLowerCase())
          );
          localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(remaining));
        }
      }

      // 5. Purge from local messaging conversations
      const rawInquiries = localStorage.getItem('b2b_inquiry_conversations_v4');
      if (rawInquiries) {
        const parsed = JSON.parse(rawInquiries);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (c: { sellerCompanyId?: string; buyerCompanyId?: string; sellerContactEmail?: string; buyerContactEmail?: string }) =>
              c.sellerCompanyId !== companyId &&
              c.buyerCompanyId !== companyId &&
              (!effectiveEmail || (c.sellerContactEmail?.toLowerCase() !== effectiveEmail.toLowerCase() && c.buyerContactEmail?.toLowerCase() !== effectiveEmail.toLowerCase()))
          );
          localStorage.setItem('b2b_inquiry_conversations_v4', JSON.stringify(remaining));
        }
      }

      // 6. Dispatch backend API delete request to purge from PostgreSQL
      try {
        fetch(`/api/admin/accounts?id=${encodeURIComponent(companyId)}${effectiveEmail ? `&email=${encodeURIComponent(effectiveEmail)}` : ''}`, {
          method: 'DELETE',
        }).catch(() => {});
      } catch {}
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

export function updateAccountApproval(companyId: string, status: ApprovalStatus, email?: string): boolean {
  const current = getAdminAccounts();
  const cleanId = (companyId || '').trim().toLowerCase();
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  const updated = current.map((acc) => {
    const isMatch =
      acc.id === companyId ||
      acc.id?.toLowerCase() === cleanId ||
      (acc.email && acc.email.toLowerCase() === cleanId) ||
      (cleanEmail && acc.email && acc.email.toLowerCase() === cleanEmail);

    if (isMatch) {
      return {
        ...acc,
        approval_status: status,
        account_status: status === 'approved' ? ('active' as AccountStatus) : ('suspended' as AccountStatus),
        verified_documents: status === 'approved',
      };
    }
    return acc;
  });
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

      // If approved, trigger fresh onboarding popup on next dashboard load
      if (status === 'approved' && target) {
        if (target.id) {
          localStorage.removeItem(`b2b_onboarding_completed_${target.id}`);
        }
        if (target.email) {
          const cleanEmail = target.email.toLowerCase().trim();
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
  _accounts?: AdminClientAccount[]
): AdminPaymentRecord[] {
  return payments;
}

export function getAdminPayments(): AdminPaymentRecord[] {
  return [];
}

export function saveAdminPayments(_payments: AdminPaymentRecord[]) {
  // No-op: Payments are saved authoritatively via the PostgreSQL payments table
  if (typeof window !== 'undefined') {
    broadcastAdminUpdate();
  }
}

export function markPaymentCompleted(paymentId: string): boolean {
  const payments = getAdminPayments();
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updatedPayments = payments.map((p) =>
    p.id === paymentId
      ? { ...p, status: 'Completed' as PaymentStatus, completed_at: now }
      : p
  );
  saveAdminPayments(updatedPayments);
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
  return [];
}

export function saveAdminListings(_listings: AdminModeratedListing[]) {
  // No-op: Listings are managed authoritatively via PostgreSQL products & wtb_requests tables
  if (typeof window !== 'undefined') {
    broadcastAdminUpdate();
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
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(parsed.filter((p: { id?: string }) => p.id !== productId)));
        }
      }
      const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
      if (rawWtb) {
        const parsed = JSON.parse(rawWtb);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(parsed.filter((w: { id?: string }) => w.id !== productId)));
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
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(parsed.filter((p: { id?: string }) => !p.id || !idSet.has(p.id))));
        }
      }
      const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
      if (rawWtb) {
        const parsed = JSON.parse(rawWtb);
        if (Array.isArray(parsed)) {
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(parsed.filter((w: { id?: string }) => !w.id || !idSet.has(w.id))));
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

export function getCustomerQueries(): CustomerQuery[] {
  return [];
}

export function saveCustomerQueries(_queries: CustomerQuery[], emitEvents = true) {
  if (typeof window === 'undefined') return;
  if (emitEvents) {
    window.dispatchEvent(new CustomEvent('b2b_admin_update'));
    window.dispatchEvent(new CustomEvent('b2b_queries_update'));
  }
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
