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
  role: 'seller' | 'buyer' | 'admin';
  membership_tier: MembershipTier;
  approval_status: ApprovalStatus;
  account_status: AccountStatus;
  company_number?: string | null;
  vat_number?: string | null;
  country?: string;
  created_at: string;
  last_active?: string;
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
  try {
    const list = getDeletedAccountIds();
    const clean = idOrEmail.trim().toLowerCase();
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

export function isAccountDeleted(id?: string | null, email?: string | null): boolean {
  const deleted = getDeletedAccountIds();
  if (!deleted || deleted.length === 0) return false;
  if (id && deleted.includes(id)) return true;
  if (email && (deleted.includes(email) || deleted.includes(email.trim().toLowerCase()))) return true;
  return false;
}

// INITIAL SEED ACCOUNTS (Clean empty state for real user accounts & testing)
const INITIAL_ACCOUNTS: AdminClientAccount[] = [];

// INITIAL SEED PAYMENTS - Stripe Ledger Format (Empty for testing)
const INITIAL_PAYMENTS: AdminPaymentRecord[] = [];

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
  if (typeof window === 'undefined') return INITIAL_ACCOUNTS.filter((a) => !isAccountDeleted(a.id, a.email));
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((a) => !isAccountDeleted(a.id, a.email));
      }
    }
    const filteredInitial = INITIAL_ACCOUNTS.filter((a) => !isAccountDeleted(a.id, a.email));
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filteredInitial));
    return filteredInitial;
  } catch {
    // ignore
  }
  return INITIAL_ACCOUNTS.filter((a) => !isAccountDeleted(a.id, a.email));
}

export function saveAdminAccounts(accounts: AdminClientAccount[]) {
  if (typeof window === 'undefined') return;
  try {
    const cleanAccounts = accounts.filter((a) => !isAccountDeleted(a.id, a.email));
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(cleanAccounts));
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

export function updateAccountTier(companyId: string, newTier: MembershipTier): boolean {
  const current = getAdminAccounts();
  const updated = current.map((acc) =>
    acc.id === companyId ? { ...acc, membership_tier: newTier } : acc
  );
  saveAdminAccounts(updated);
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
export function getAdminPayments(): AdminPaymentRecord[] {
  if (typeof window === 'undefined') return INITIAL_PAYMENTS;
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENTS));
  } catch {
    // ignore
  }
  return INITIAL_PAYMENTS;
}

export function saveAdminPayments(payments: AdminPaymentRecord[]) {
  if (typeof window === 'undefined') return;
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

  // If this payment was for a company, automatically approve that company!
  if (payment?.company_id) {
    updateAccountApproval(payment.company_id, 'approved');
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
    updateAccountApproval(created.company_id, 'approved');
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
            item_code: l.itemCode || l.ean?.slice(0, 8) || 'MDL-2026',
            category_slug: (l.category || 'electronics').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category_name: l.category || 'Consumer Electronics',
            ean: l.ean || '195949048735',
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
            ean: w.ean || '—',
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
  const updated = listings.map((l) =>
    l.id === productId
      ? { ...l, moderation_status: 'suspended' as const, moderation_reason: reason || 'Suspended by admin for commercial compliance check.' }
      : l
  );
  saveAdminListings(updated);
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
  // Ensure every registered seller has a thread in messaging-store
  const sellers = getAdminAccounts().filter((a) => a.role === 'seller');
  const conversations = getStoredConversations();

  let modified = false;

  for (const seller of sellers) {
    const threadId = `conv-admin-${seller.id}`;
    const exists = conversations.find((c) => c.id === threadId);

    if (!exists) {
      const nowIso = new Date().toISOString();
      const newThread: InquiryConversation = {
        id: threadId,
        productId: 'admin-desk',
        productTitle: 'Executive Desk & Compliance Support',
        productImage: '/b2b-link-logo-tight.png',
        productPrice: 0,
        productMoq: 0,
        sellerCompanyId: seller.id,
        sellerCompanyName: seller.name,
        buyerCompanyId: 'comp-admin-support',
        buyerCompanyName: 'B2B LINK Support Team',
        buyerEmail: 'support@b2blink.eu',
        buyerContactEmail: 'support@b2blink.eu',
        buyerPhone: '+372 612 3456',
        buyerContactPhone: '+372 612 3456',
        lastMessageText: `Welcome to B2B LINK. B2B LINK is designed to make wholesale trading faster and simpler.`,
        lastMessageTime: 'Just now',
        unreadByBuyer: false,
        unreadBySeller: true,
        messages: [
          {
            id: `msg-${Date.now()}-${seller.id}`,
            senderRole: 'buyer', // 'buyer' is admin perspective towards seller
            senderName: 'B2B LINK Support Team',
            senderId: 'comp-admin-support',
            text: `Hello ${seller.contact_name || seller.name},\n\nWelcome to B2B LINK.\n\nB2B LINK is designed to make wholesale trading faster and simpler.\n\nYou can use the platform to:\n• Browse live BUY and SELL listings\n• Post what you have available or what you need\n• Receive relevant Buyer-Seller Matches\n• Search by product, EAN/UPC or item code\n• Connect directly with other members\n\nIf you need any assistance, our Support Team is here to help.\n\nWelcome to the network.\n\nKind regards,\nB2B LINK Support Team`,
            timestamp: nowIso,
            isRead: false,
          },
        ],
      };
      conversations.unshift(newThread);
      modified = true;
    }
  }

  if (modified) {
    saveStoredConversations(conversations);
  }

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

export function saveCustomerQueries(queries: CustomerQuery[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(queries));
    window.dispatchEvent(new CustomEvent('b2b_admin_update'));
    window.dispatchEvent(new CustomEvent('b2b_queries_update'));
  } catch {}
}

export function addCustomerQuery(data: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}): CustomerQuery {
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

  if (typeof window !== 'undefined') {
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
