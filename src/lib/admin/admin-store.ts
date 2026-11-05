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

// STORAGE KEYS (bumped to v6 for clean live state)
const ACCOUNTS_STORAGE_KEY = 'b2b_admin_accounts_v5';
const PAYMENTS_STORAGE_KEY = 'b2b_admin_payments_v5';
const LISTINGS_STORAGE_KEY = 'b2b_admin_listings_v6';
const DELETED_ACCOUNTS_STORAGE_KEY = 'b2b_admin_deleted_accounts_v5';
const DELETED_LISTINGS_STORAGE_KEY = 'b2b_admin_deleted_listings_v6';

export const LEGACY_MOCK_LISTING_IDS = [
  'b1111111-1111-4000-8000-000000000001',
  'b2222222-2222-4000-8000-000000000002',
  'b5555555-5555-4000-8000-000000000005',
  'b7777777-7777-4000-8000-000000000007',
  'b3333333-3333-4000-8000-000000000003',
];

export function getDeletedListingIds(): string[] {
  if (typeof window === 'undefined') return [...LEGACY_MOCK_LISTING_IDS];
  try {
    const raw = localStorage.getItem(DELETED_LISTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.from(new Set([...LEGACY_MOCK_LISTING_IDS, ...(Array.isArray(parsed) ? parsed : [])]));
  } catch {
    return [...LEGACY_MOCK_LISTING_IDS];
  }
}

export function isListingDeleted(productId?: string | null): boolean {
  if (!productId) return false;
  if (LEGACY_MOCK_LISTING_IDS.includes(productId)) return true;
  if (typeof window === 'undefined') return false;
  try {
    const list = getDeletedListingIds();
    return list.includes(productId);
  } catch {
    return false;
  }
}

export function markListingAsDeleted(productId?: string | null) {
  if (typeof window === 'undefined' || !productId) return;
  try {
    const list = getDeletedListingIds();
    if (!list.includes(productId)) {
      list.push(productId);
      localStorage.setItem(DELETED_LISTINGS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function markListingsAsDeleted(productIds: string[]) {
  if (typeof window === 'undefined' || !productIds?.length) return;
  try {
    const set = new Set(getDeletedListingIds());
    productIds.forEach((id) => set.add(id));
    localStorage.setItem(DELETED_LISTINGS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkListingAsDeleted(productId?: string | null) {
  if (typeof window === 'undefined' || !productId) return;
  try {
    const list = getDeletedListingIds();
    const filtered = list.filter((id) => id !== productId && !LEGACY_MOCK_LISTING_IDS.includes(id));
    localStorage.setItem(DELETED_LISTINGS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

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

// INITIAL SEED ACCOUNTS - Platform Administrator Desk
const INITIAL_ACCOUNTS: AdminClientAccount[] = [
  {
    id: 'facbb93f-080f-480f-b54b-8ef26664da86',
    name: 'B2B LINK European Trade Desk',
    contact_name: 'Platform Administrator',
    email: 'admin@b2blink.eu',
    phone: '+44 20 7946 0991',
    address: 'Narva mnt 5, 10117 Tallinn',
    website: 'https://b2blink.eu',
    role: 'admin',
    membership_tier: 'gold',
    approval_status: 'approved',
    account_status: 'active',
    country: 'Estonia',
    created_at: '2024-01-01T00:00:00Z',
    last_active: 'Just now',
    listings_count: 0,
    total_spend_or_sales: 'Enterprise Platform Desk',
    verified_documents: true,
  },
];

// INITIAL SEED PAYMENTS - Clean ledger format
const INITIAL_PAYMENTS: AdminPaymentRecord[] = [];

// INITIAL SEED MODERATED LISTINGS
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
const STATUS_OVERRIDES_KEY = 'b2b_admin_status_overrides_v2';

export interface AdminStatusOverride {
  approval_status: ApprovalStatus;
  account_status: AccountStatus;
  verified_documents: boolean;
  tier?: MembershipTier;
  updated_at: string;
}

export function getStatusOverrides(): Record<string, AdminStatusOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STATUS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStatusOverride(
  identifier: string,
  approvalStatus: ApprovalStatus,
  tier?: MembershipTier
) {
  if (typeof window === 'undefined' || !identifier) return;
  try {
    const overrides = getStatusOverrides();
    const clean = identifier.toLowerCase().trim();
    overrides[clean] = {
      approval_status: approvalStatus,
      account_status: approvalStatus === 'approved' ? 'active' : approvalStatus === 'rejected' ? 'suspended' : 'pending',
      verified_documents: approvalStatus === 'approved',
      tier,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(STATUS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function applyOverridesToAccounts(accounts: AdminClientAccount[]): AdminClientAccount[] {
  if (typeof window === 'undefined') return accounts;
  const overrides = getStatusOverrides();
  if (!overrides || Object.keys(overrides).length === 0) return accounts;

  return accounts.map((acc) => {
    const byId = acc.id ? overrides[acc.id.toLowerCase().trim()] : undefined;
    const byEmail = acc.email ? overrides[acc.email.toLowerCase().trim()] : undefined;
    const o = byId || byEmail;
    if (o) {
      return {
        ...acc,
        approval_status: o.approval_status,
        account_status: o.account_status,
        verified_documents: o.verified_documents,
        membership_tier: o.tier || acc.membership_tier,
      };
    }
    return acc;
  });
}

export function getAdminAccounts(): AdminClientAccount[] {
  const filterClientsOnly = (list: AdminClientAccount[]) =>
    applyOverridesToAccounts(list).filter(
      (a) =>
        !isAccountDeleted(a.id, a.email) &&
        a.role !== 'admin' &&
        a.email?.toLowerCase() !== 'admin@b2blink.eu'
    );

  if (typeof window === 'undefined') return filterClientsOnly(INITIAL_ACCOUNTS);
  try {
    // Purge only legacy v1-v3 storage versions
    localStorage.removeItem('b2b_admin_accounts_v3');
    localStorage.removeItem('b2b_admin_accounts_v2');
    localStorage.removeItem('b2b_admin_accounts_v1');

    const accountsMap = new Map<string, AdminClientAccount>();

    // 1. Read existing v5 accounts
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            if (a && a.email) accountsMap.set(a.email.toLowerCase().trim(), a);
          }
        }
      } catch {}
    }

    // 2. Migrate legacy v4 accounts if any exist
    const v4Raw = localStorage.getItem('b2b_admin_accounts_v4');
    if (v4Raw) {
      try {
        const v4List = JSON.parse(v4Raw);
        if (Array.isArray(v4List)) {
          for (const acc of v4List) {
            if (acc && acc.email) {
              const k = acc.email.toLowerCase().trim();
              if (!accountsMap.has(k)) accountsMap.set(k, acc);
            }
          }
        }
      } catch {}
    }

    // 3. Recover any accounts registered in local user registry
    const regUsersRaw = localStorage.getItem('b2b_registered_users_v1');
    if (regUsersRaw) {
      try {
        const regUsers = JSON.parse(regUsersRaw);
        if (Array.isArray(regUsers)) {
          for (const u of regUsers) {
            const uEmail = (u.email || '').toLowerCase().trim();
            if (uEmail && uEmail !== 'admin@b2blink.eu' && !accountsMap.has(uEmail)) {
              accountsMap.set(uEmail, {
                id: u.companyId || u.id || `comp_${Date.now()}`,
                name: u.companyName || u.contactName || 'Enterprise Partner',
                contact_name: u.contactName || 'Representative',
                email: u.email,
                phone: u.phone || null,
                address: null,
                website: null,
                role: (u.role || 'seller') as any,
                membership_tier: u.tier || 'bronze',
                approval_status: u.approval_status || 'pending',
                account_status: u.approval_status === 'approved' ? 'active' : 'pending',
                company_number: null,
                vat_number: null,
                country: 'Global',
                created_at: u.createdAt || new Date().toISOString(),
                last_active: 'Just now',
                listings_count: 0,
                total_spend_or_sales: `€${u.tier === 'gold' ? '179' : u.tier === 'silver' ? '79' : '0'}/mo Membership`,
                verified_documents: u.approval_status === 'approved',
              });
            }
          }
        }
      } catch {}
    }

    // 4. Recover active or cached company from browser session
    const cachedCompRaw = localStorage.getItem('b2b_cached_company');
    if (cachedCompRaw) {
      try {
        const c = JSON.parse(cachedCompRaw);
        const cEmail = (c.email || '').toLowerCase().trim();
        if (cEmail && cEmail !== 'admin@b2blink.eu' && c.role !== 'admin' && !accountsMap.has(cEmail)) {
          accountsMap.set(cEmail, {
            id: c.id || `comp_${Date.now()}`,
            name: c.company_name || c.name || c.contact_name || 'Enterprise Account',
            contact_name: c.contact_name || 'Representative',
            email: c.email,
            phone: c.phone || null,
            address: c.address || null,
            website: c.website || null,
            role: (c.role || 'seller') as any,
            membership_tier: c.tier || c.membership_tier || 'bronze',
            approval_status: c.approval_status || 'pending',
            account_status: c.approval_status === 'approved' ? 'active' : 'pending',
            company_number: c.company_number || null,
            vat_number: c.vat_number || null,
            country: 'Global',
            created_at: c.created_at || new Date().toISOString(),
            last_active: 'Just now',
            listings_count: 0,
            total_spend_or_sales: `€${(c.tier || c.membership_tier) === 'gold' ? '179' : (c.tier || c.membership_tier) === 'silver' ? '79' : '0'}/mo Membership`,
            verified_documents: c.approval_status === 'approved',
          });
        }
      } catch {}
    }

    // 5. Recover pending verification email if registration is underway
    const pendingEmail = localStorage.getItem('b2b_pending_verification_email');
    if (pendingEmail) {
      const pEmail = pendingEmail.toLowerCase().trim();
      if (pEmail && pEmail !== 'admin@b2blink.eu' && !accountsMap.has(pEmail)) {
        const pTier = (localStorage.getItem('b2b_pending_tier') || 'bronze') as MembershipTier;
        const pCompName = localStorage.getItem('b2b_pending_company_name') || 'Enterprise Partner';
        const pContName = localStorage.getItem('b2b_pending_contact_name') || 'Representative';
        const pCompId = localStorage.getItem('b2b_pending_company_id') || `comp_${Date.now()}`;
        accountsMap.set(pEmail, {
          id: pCompId,
          name: pCompName,
          contact_name: pContName,
          email: pendingEmail,
          phone: null,
          address: null,
          website: null,
          role: 'seller',
          membership_tier: pTier,
          approval_status: 'pending',
          account_status: 'pending',
          company_number: null,
          vat_number: null,
          country: 'Global',
          created_at: new Date().toISOString(),
          last_active: 'Just now',
          listings_count: 0,
          total_spend_or_sales: `€${pTier === 'gold' ? '179' : pTier === 'silver' ? '79' : '0'}/mo Membership`,
          verified_documents: false,
        });
      }
    }

    const mergedList = filterClientsOnly(Array.from(accountsMap.values()));
    if (mergedList.length > 0) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(mergedList));
      return mergedList;
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
  saveStatusOverride(companyId, 'rejected');
  const current = getAdminAccounts();
  const target = current.find((acc) => acc.id === companyId);
  if (target?.email) saveStatusOverride(target.email, 'rejected', target.membership_tier);

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
  saveStatusOverride(companyId, 'approved');
  const current = getAdminAccounts();
  const target = current.find((acc) => acc.id === companyId);
  if (target?.email) saveStatusOverride(target.email, 'approved', target.membership_tier);

  const updated = current.map((acc) =>
    acc.id === companyId
      ? { ...acc, account_status: 'active' as AccountStatus, approval_status: 'approved' as ApprovalStatus }
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
  }

  return true;
}

export function updateAccountApproval(companyId: string, status: ApprovalStatus): boolean {
  saveStatusOverride(companyId, status);
  const current = getAdminAccounts();
  const target = current.find(
    (acc) => acc.id === companyId || (acc.email && companyId && acc.email.toLowerCase() === companyId.toLowerCase())
  );
  if (target?.email) {
    saveStatusOverride(target.email, status, target.membership_tier);
  }

  const updated = current.map((acc) =>
    acc.id === companyId || (acc.email && companyId && acc.email.toLowerCase() === companyId.toLowerCase())
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
      const cachedRaw = localStorage.getItem('b2b_cached_company');
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const matchById = cached.id && (cached.id === companyId || (target && cached.id === target.id));
        const matchByEmail = cached.email && (
          cached.email.toLowerCase() === companyId.toLowerCase() ||
          (target?.email && cached.email.toLowerCase() === target.email.toLowerCase())
        );
        if (cached && (matchById || matchByEmail)) {
          cached.approval_status = status;
          localStorage.setItem('b2b_cached_company', JSON.stringify(cached));
        }
      }

      // Notify any active components
      window.dispatchEvent(new CustomEvent('b2b_account_status_change', { detail: { companyId, status } }));
      broadcastAdminUpdate();

      // Persist to backend and update Supabase auth metadata
      if (target) {
        fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: status === 'approved' ? 'approve' : 'suspend',
            companyId: target.id || companyId,
            email: target.email,
            contactName: target.contact_name,
            companyName: target.name,
            tier: target.membership_tier,
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

  // Note: Payments record transaction completion but do not bypass KYC business document verification.

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

  // Note: Payments record transaction completion but do not bypass KYC business document verification.

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
  if (typeof window === 'undefined') return [];
  try {
    // Clear out legacy mock and old test keys so they never contaminate the store
    localStorage.removeItem('b2b_admin_listings_v1');
    localStorage.removeItem('b2b_admin_listings_v2');
    localStorage.removeItem('b2b_admin_listings_v3');
    localStorage.removeItem('b2b_admin_listings_v4');
    localStorage.removeItem('b2b_admin_listings_v5');
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
        return unique.filter((l) => !isAccountDeleted(l.company_id, l.seller_email) && !isListingDeleted(l.id));
      }
    }

    const mergedInitial = Array.from(
      new Map([...formattedUserItems, ...INITIAL_LISTINGS].map((item) => [item.id, item])).values()
    );
    const cleanInitial = mergedInitial.filter((l) => !isAccountDeleted(l.company_id, l.seller_email) && !isListingDeleted(l.id));
    localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(cleanInitial));
    return cleanInitial;
  } catch {
    // ignore
  }
  return [];
}

export function saveAdminListings(listings: AdminModeratedListing[]) {
  if (typeof window === 'undefined') return;
  try {
    const clean = listings.filter((l) => !isListingDeleted(l.id));
    localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(clean));
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
  markListingAsDeleted(productId);
  const listings = getAdminListings();
  const updated = listings.filter((l) => l.id !== productId && !isListingDeleted(l.id));
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
      broadcastAdminUpdate();

      fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}
  }
  return true;
}

export function deleteListings(productIds: string[]): boolean {
  if (!productIds.length) return true;
  markListingsAsDeleted(productIds);
  const idSet = new Set(productIds);
  const listings = getAdminListings();
  const updated = listings.filter((l) => !idSet.has(l.id) && !isListingDeleted(l.id));
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
      broadcastAdminUpdate();

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

const INITIAL_QUERIES: CustomerQuery[] = [
  {
    id: 'query-101',
    name: 'Markus Weber',
    company: 'Bavaria Global Trade GmbH',
    email: 'm.weber@bavariatrade.de',
    phone: '+49 89 2345 6789',
    topic: 'verification',
    message: 'Hello Support Desk,\n\nWe recently created our account and would like to confirm whether our Munich Commercial Registry excerpt and DE VAT ID are sufficient for instant verified status, or if you need a utility bill for our warehouse.\n\nThank you,\nMarkus Weber',
    created_at: '04 Nov 2026, 01:25 PM',
    status: 'new',
  },
  {
    id: 'query-102',
    name: "Sarah O'Connor",
    company: 'Emerald Logistics Ireland',
    email: 's.oconnor@emeraldwholesalegoods.ie',
    phone: '+353 1 496 0123',
    topic: 'technical',
    message: 'Hi team,\n\nCould you please provide the CSV bulk ingestion column template for consumer electronics inventory? We have approximately 1,200 SKUs we want to import into the wholesale catalog.\n\nBest regards,\nSarah',
    created_at: '03 Nov 2026, 04:18 PM',
    status: 'new',
  },
  {
    id: 'query-103',
    name: 'Marco Bellini',
    company: 'Milano Distribuzione Srl',
    email: 'm.bellini@milanowholesale.it',
    phone: '+39 02 8765 4321',
    topic: 'billing',
    message: 'Greetings,\n\nWe wish to subscribe to the Gold Tier package via corporate Wise wire transfer in EUR. Please send us the official proforma invoice with your Tallinn IBAN.\n\nCordiali saluti,\nMarco Bellini',
    created_at: '02 Nov 2026, 11:40 AM',
    status: 'replied',
    reply_text: 'Dear Marco,\n\nThank you for reaching out. We have generated proforma invoice B2B-PRO-2026-8849 with our dedicated Wise EUR IBAN for Milano Distribuzione Srl. Your Gold membership will be activated immediately upon wire reference receipt.\n\nBest regards,\nB2B LINK Support',
    replied_at: '02 Nov 2026, 01:10 PM',
  },
];


export function getCustomerQueries(): CustomerQuery[] {
  if (typeof window === 'undefined') return INITIAL_QUERIES;
  try {
    const raw = localStorage.getItem(QUERIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
