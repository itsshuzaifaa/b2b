'use client';

import { MOCK_COMPANIES, MOCK_PRODUCTS } from '@/lib/mock-data';
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
  company_id: string;
  company_name: string;
  seller_email: string;
  title: string;
  category_slug: string;
  unit_price: number;
  quantity_available: number;
  moq: number;
  barcode_or_sku?: string | null;
  is_hot: boolean;
  moderation_status: 'active' | 'suspended' | 'flagged';
  moderation_reason?: string | null;
  images: string[];
  created_at: string;
}

// STORAGE KEYS
const ACCOUNTS_STORAGE_KEY = 'b2b_admin_accounts_v3';
const PAYMENTS_STORAGE_KEY = 'b2b_admin_payments_v3';
const LISTINGS_STORAGE_KEY = 'b2b_admin_listings_v1';

// INITIAL SEED ACCOUNTS
// INITIAL SEED ACCOUNTS - Only real user accounts
const INITIAL_ACCOUNTS: AdminClientAccount[] = [
  {
    id: 'b40715ed-1c53-4988-a4ab-9e3d437bc2b1',
    name: 'fluxify digital',
    contact_name: 'Habib Rehman',
    email: 'huzaifaff559@gmail.com',
    phone: '+92 321 2722444',
    role: 'seller',
    membership_tier: 'silver',
    approval_status: 'approved',
    account_status: 'active',
    company_number: 'EE-123456',
    vat_number: 'EE102938475',
    country: 'Estonia',
    created_at: '2026-10-15T09:40:00Z',
    last_active: 'Just now',
    listings_count: 0,
    total_spend_or_sales: '£79/mo Membership',
    verified_documents: true,
  },
  {
    id: '87d3cc3d-4d43-48f4-9df3-ffdcb84a9319',
    name: 'huzaifa Faisal',
    contact_name: 'huzaifa Faisal',
    email: 'huzaifa.webdesigner@gmail.com',
    phone: '+44 7911 123456',
    role: 'buyer',
    membership_tier: 'bronze',
    approval_status: 'approved',
    account_status: 'active',
    company_number: null,
    vat_number: null,
    country: 'United Kingdom',
    created_at: '2026-10-14T11:00:00Z',
    last_active: 'Today',
    listings_count: 0,
    total_spend_or_sales: '£0 (Free Buyer Access)',
    verified_documents: true,
  },
];

// INITIAL SEED PAYMENTS - Stripe Ledger Format
const INITIAL_PAYMENTS: AdminPaymentRecord[] = [
  {
    id: 'pi_3Nx8294019284',
    company_id: 'b40715ed-1c53-4988-a4ab-9e3d437bc2b1',
    company_name: 'fluxify digital',
    contact_email: 'huzaifaff559@gmail.com',
    plan_or_service: 'Silver Commercial Tier (Monthly)',
    amount_gbp: 79.0,
    payment_method: 'Corporate Card',
    wise_reference: 'pm_card_visa_4242',
    transaction_id: 'ch_3Nx8294019284',
    status: 'Completed',
    created_at: 'Oct 15, 11:14 AM',
    completed_at: 'Oct 15, 11:14 AM',
    invoice_number: 'in_1Nx8294019284',
    notes: 'Stripe card checkout authorized via 3D Secure. Cardholder: Habib Rehman.',
  },
  {
    id: 'pi_3Nx8294019283',
    company_id: 'b40715ed-1c53-4988-a4ab-9e3d437bc2b1',
    company_name: 'fluxify digital',
    contact_email: 'huzaifaff559@gmail.com',
    plan_or_service: 'Subscription update',
    amount_gbp: 79.0,
    payment_method: 'Corporate Card',
    wise_reference: 'pm_card_visa_4242',
    transaction_id: 'ch_3Nx8294019283',
    status: 'Completed',
    created_at: 'Sep 15, 10:30 AM',
    completed_at: 'Sep 15, 10:30 AM',
    invoice_number: 'in_1Nx8294019283',
    notes: 'Recurring monthly renewal settled via Stripe card ending in 4242.',
  },
  {
    id: 'pi_3Nx8294019282',
    company_id: 'b40715ed-1c53-4988-a4ab-9e3d437bc2b1',
    company_name: 'fluxify digital',
    contact_email: 'huzaifaff559@gmail.com',
    plan_or_service: 'Account Activation & Card Checkout',
    amount_gbp: 79.0,
    payment_method: 'Corporate Card',
    wise_reference: 'pm_card_visa_4242',
    transaction_id: 'ch_3Nx8294019282',
    status: 'Completed',
    created_at: 'Aug 15, 09:12 AM',
    completed_at: 'Aug 15, 09:12 AM',
    invoice_number: 'in_1Nx8294019282',
    notes: 'Initial registration card verification and commercial checkout.',
  },
];

// INITIAL SEED MODERATED LISTINGS
const INITIAL_LISTINGS: AdminModeratedListing[] = MOCK_PRODUCTS.map((prod) => ({
  id: prod.id,
  company_id: prod.company_id,
  company_name: prod.company?.name || 'Verified Wholesale Supplier',
  seller_email: prod.company?.email || 'supplier@trade.eu',
  title: prod.title,
  category_slug: prod.category_slug,
  unit_price: prod.unit_price,
  quantity_available: prod.quantity_available,
  moq: prod.moq,
  barcode_or_sku: prod.barcode_or_sku,
  is_hot: prod.is_hot,
  moderation_status: 'active',
  images: prod.images || ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
  created_at: prod.created_at,
}));

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
  if (typeof window === 'undefined') return INITIAL_ACCOUNTS;
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(INITIAL_ACCOUNTS));
  } catch {
    // ignore
  }
  return INITIAL_ACCOUNTS;
}

export function saveAdminAccounts(accounts: AdminClientAccount[]) {
  if (typeof window === 'undefined') return;
  try {
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

export function deleteAccount(companyId: string): boolean {
  const current = getAdminAccounts();
  const updated = current.filter((acc) => acc.id !== companyId);
  saveAdminAccounts(updated);
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
  return true;
}

// ==========================================
// 2. PAYMENT RECORDS
// ==========================================
export function getAdminPayments(): AdminPaymentRecord[] {
  if (typeof window === 'undefined') return INITIAL_PAYMENTS;
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    const raw = localStorage.getItem(LISTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(INITIAL_LISTINGS));
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
        buyerCompanyId: 'comp-jeff-admin',
        buyerCompanyName: 'Jeff Vetting Director (B2B LINK Desk)',
        buyerEmail: 'jeff@b2blink.com',
        buyerContactEmail: 'jeff@b2blink.com',
        buyerPhone: '+372 612 3456',
        buyerContactPhone: '+372 612 3456',
        lastMessageText: `Welcome to B2B LINK, ${seller.contact_name}! Your commercial seller portal is activated. Let us know if you need any assistance uploading lots.`,
        lastMessageTime: 'Just now',
        unreadByBuyer: false,
        unreadBySeller: true,
        messages: [
          {
            id: `msg-${Date.now()}-${seller.id}`,
            senderRole: 'buyer', // 'buyer' is admin perspective towards seller
            senderName: 'Jeff Vetting Director (B2B LINK OÜ)',
            senderId: 'comp-jeff-admin',
            text: `Welcome to B2B LINK, ${seller.contact_name}! Your commercial seller portal is active. You can publish verified stock lots, manage quotes, and communicate directly with buyers with 0% platform fees. Feel free to reply here if you have any questions.`,
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
