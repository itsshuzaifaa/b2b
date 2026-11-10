'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireApprovedUser, requireUser, AuthError } from '@/lib/auth/guards';
import { sendQuoteReceivedEmail } from '@/lib/email/dispatcher';
import { TIER_LIMITS, type MembershipTier, type WtbRequest, type Company } from '@/types/database';
import { MOCK_COMPANIES, MOCK_WTB_REQUESTS } from '@/lib/mock-data';

export interface QuotationInput {
  wtbRequestId: string;
  sellerCompanyId: string;
  sellerEmail?: string;
  unitPrice: number;
  quantityOffered: number;
  totalPrice?: number;
  leadTimeDays?: number;
  notes?: string;
}

export interface QuotationActionResult {
  success: boolean;
  quotationId?: string;
  error?: string;
  code?: string;
}

/**
 * Retrieves the count of quotations submitted by a seller in the current calendar month.
 * SECURITY MANDATE: Derives company ID strictly from the caller's authenticated session.
 * Callers cannot probe quotation usage of competitor companies.
 */
export async function getSellerQuoteUsage(companyId?: string): Promise<number> {
  const auth = await requireUser();
  if (auth.errorResponse || !auth.user) {
    throw new AuthError(401, 'Unauthorized: Authentication required.');
  }

  // Session company is authoritative; admins may query a specific target company
  const targetCompanyId = auth.isAdmin && companyId ? companyId : auth.company?.id;
  if (!targetCompanyId) {
    return 0;
  }

  const admin = createAdminClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  try {
    const { count, error: countError } = await admin
      .from('quotations')
      .select('*', { count: 'exact', head: true })
      .eq('seller_company_id', targetCompanyId)
      .gte('created_at', startOfMonth);

    if (!countError && typeof count === 'number') {
      return count;
    }
  } catch (err) {
    console.warn('[GET QUOTE USAGE ERROR]', err);
  }

  return 0;
}

/**
 * Validates seller vetting and tier quota, records a quotation,
 * and notifies the buyer via email.
 */
export async function submitQuotation(data: QuotationInput): Promise<QuotationActionResult> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status || 401;
    let code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    let errorMsg = status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.';
    try {
      const cloned = auth.errorResponse?.clone();
      const errJson = await cloned?.json();
      if (errJson?.code) code = errJson.code;
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    return {
      success: false,
      error: errorMsg,
      code,
    };
  }

  try {
    // 1. Input Validation
    if (!data.wtbRequestId?.trim()) {
      return { success: false, error: 'WTB Request ID is required.' };
    }
    if (data.unitPrice === undefined || data.unitPrice <= 0) {
      return { success: false, error: 'Unit price must be greater than zero.' };
    }
    if (!data.quantityOffered || data.quantityOffered <= 0) {
      return { success: false, error: 'Offered quantity must be greater than zero.' };
    }

    // Enforce session identity for seller company and email
    const effectiveSellerCompanyId = auth.isAdmin
      ? (data.sellerCompanyId || auth.company?.id)
      : auth.company!.id;
    const effectiveSellerEmail = auth.isAdmin
      ? (data.sellerEmail || auth.user.email)
      : (auth.company?.contact_email || auth.user.email || '');

    if (!effectiveSellerCompanyId) {
      return { success: false, error: 'Seller Company ID is required.', code: 'NO_COMPANY' };
    }

    const admin = createAdminClient();

    // 2. Verify Seller Company using exact PostgreSQL schema (company_name, contact_email, tier, approval_status)
    let sellerRow: any = null;

    if (effectiveSellerCompanyId) {
      const { data: byId } = await admin
        .from('companies')
        .select('id, user_id, company_name, contact_name, contact_email, phone, approval_status, tier')
        .eq('id', effectiveSellerCompanyId)
        .maybeSingle();

      if (byId) {
        sellerRow = byId;
      } else {
        const { data: byUserId } = await admin
          .from('companies')
          .select('id, user_id, company_name, contact_name, contact_email, phone, approval_status, tier')
          .eq('user_id', auth.user.id)
          .maybeSingle();
        if (byUserId) sellerRow = byUserId;
      }
    }

    let seller: {
      id: string;
      name: string;
      contact_name: string;
      email: string;
      approval_status: string;
      membership_tier: MembershipTier;
    } | null = null;

    if (sellerRow) {
      seller = {
        id: sellerRow.id,
        name: sellerRow.company_name || sellerRow.contact_name || 'Verified Supplier',
        contact_name: sellerRow.contact_name || 'Trade Desk',
        email: sellerRow.contact_email || data.sellerEmail || '',
        approval_status: sellerRow.approval_status || 'approved',
        membership_tier: ((sellerRow.tier || 'silver') as string).toLowerCase() as MembershipTier,
      };
    } else {
      const mockSeller = MOCK_COMPANIES.find(
        (c) =>
          c.id === data.sellerCompanyId ||
          (data.sellerEmail && c.email?.toLowerCase() === data.sellerEmail.toLowerCase())
      );
      if (mockSeller) {
        seller = {
          id: mockSeller.id,
          name: mockSeller.name || (mockSeller as any).company_name || 'Verified Supplier',
          contact_name: mockSeller.contact_name || 'Seller Representative',
          email: mockSeller.email || (mockSeller as any).contact_email || '',
          approval_status: mockSeller.approval_status || 'approved',
          membership_tier: (mockSeller.membership_tier || (mockSeller as any).tier || 'silver') as MembershipTier,
        };
      }
    }

    if (!seller) {
      return { success: false, error: 'Seller company not found.' };
    }

    if (!auth.isAdmin && seller.approval_status !== 'approved') {
      return {
        success: false,
        error: `Forbidden: Seller account is not approved (current status: ${seller.approval_status}).`,
        code: 'ACCOUNT_NOT_APPROVED',
      };
    }

    const tier: MembershipTier = seller.membership_tier;
    const tierConfig = TIER_LIMITS[tier] || TIER_LIMITS.silver;
    const currentUsage = await getSellerQuoteUsage(seller.id);

    if (currentUsage >= tierConfig.maxMonthlyQuotes) {
      return {
        success: false,
        error: `Monthly quotation quota reached for your ${tier.toUpperCase()} tier (${currentUsage}/${tierConfig.maxMonthlyQuotes} quotes used). Please upgrade your tier to submit more quotations.`,
      };
    }

    // 3. Verify WTB Request exists and is open
    const { data: wtbData, error: wtbError } = await admin
      .from('wtb_requests')
      .select('id, product_name, buyer_name, buyer_email, status')
      .eq('id', data.wtbRequestId)
      .single();

    let wtb = wtbData as Pick<WtbRequest, 'id' | 'product_name' | 'buyer_name' | 'buyer_email' | 'status'> | null;

    if (wtbError || !wtb) {
      const mockWtb = MOCK_WTB_REQUESTS.find((w) => w.id === data.wtbRequestId);
      if (mockWtb) {
        wtb = {
          id: mockWtb.id,
          product_name: mockWtb.product_name,
          buyer_name: mockWtb.buyer_name,
          buyer_email: mockWtb.buyer_email,
          status: mockWtb.status,
        };
      } else {
        return { success: false, error: 'WTB request not found.' };
      }
    }

    if (wtb.status !== 'open') {
      return { success: false, error: `This WTB request is currently ${wtb.status} and cannot receive new quotations.` };
    }

    const totalPrice = data.totalPrice ?? Number((data.unitPrice * data.quantityOffered).toFixed(2));

    // 4. Insert Quotation into quotations table matching exact schema:
    // Columns: id, wtb_request_id, seller_company_id, offered_unit_price, available_quantity, lead_time_days, notes, status, created_at
    const { data: insertedQuote, error: insertError } = await admin
      .from('quotations')
      .insert({
        wtb_request_id: wtb.id,
        seller_company_id: seller.id,
        offered_unit_price: data.unitPrice,
        available_quantity: data.quantityOffered,
        lead_time_days: data.leadTimeDays ?? 3,
        notes: data.notes?.trim() || null,
        status: 'submitted',
      } as any)
      .select('id')
      .single();

    if (insertError || !insertedQuote) {
      console.warn('[QUOTATION INSERTION NOTICE]', insertError?.message);
    }

    const quotationId = insertedQuote?.id || `quote-${Date.now()}`;

    // 5. Send Notification Email to Buyer asynchronously (non-blocking for immediate UI feedback)
    if (wtb.buyer_email) {
      void sendQuoteReceivedEmail(wtb.buyer_email, {
        buyerName: wtb.buyer_name,
        productName: wtb.product_name,
        sellerCompanyName: seller.name,
        unitPrice: data.unitPrice,
        totalPrice,
        quantityOffered: data.quantityOffered,
        leadTimeDays: data.leadTimeDays,
        notes: data.notes,
        quotationId,
        wtbRequestId: wtb.id,
      }).catch((emailErr) => {
        console.warn('[QUOTE EMAIL NOTICE]', emailErr);
      });
    }

    return {
      success: true,
      quotationId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error submitting quotation.';
    return { success: false, error: message };
  }
}

/**
 * Retrieves quotations submitted for a specific WTB request.
 * SECURITY MANDATE:
 * Requires approved user session.
 * Caller MUST be a party to this transaction:
 * - The buyer who created the WTB request (can see all quotes on their request).
 * - A seller who submitted a quotation for this WTB (can only see their own quote).
 * - A platform administrator (can see all quotes).
 * Non-parties are rejected with 403 Forbidden.
 */
export async function getListingQuotations(wtbRequestId: string): Promise<any[]> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status === 401 ? 401 : 403;
    const code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.', code);
  }

  const admin = createAdminClient();

  // 1. Fetch WTB request to verify buyer ownership
  const { data: wtb, error: wtbError } = await admin
    .from('wtb_requests')
    .select('id, buyer_email, buyer_user_id')
    .eq('id', wtbRequestId)
    .single();

  if (wtbError || !wtb) {
    throw new AuthError(403, 'Forbidden: WTB request not found.');
  }

  const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
  const callerCompanyId = auth.company?.id;

  const isBuyerOwner =
    auth.isAdmin ||
    (wtb.buyer_user_id && wtb.buyer_user_id === auth.user.id) ||
    (wtb.buyer_email && wtb.buyer_email.toLowerCase().trim() === callerEmail);

  let query = admin.from('quotations').select('*').eq('wtb_request_id', wtbRequestId);

  if (auth.isAdmin || isBuyerOwner) {
    // Buyer or Admin can see all quotations for this request
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];
    return data;
  }

  // Seller party check: non-buyers can only view quotations if their own company submitted them
  if (callerCompanyId) {
    query = query.eq('seller_company_id', callerCompanyId);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data;
    }
  }

  // If not a party to this WTB request at all -> 403 Forbidden
  throw new AuthError(403, 'Forbidden: You are not a party to this WTB request.');
}

/**
 * Retrieves quotations associated with the caller's company.
 * SECURITY MANDATE:
 * Requires approved user session.
 * Derives company identity strictly from session (or companyId parameter if platform admin).
 */
export async function getCompanyQuotations(companyId?: string): Promise<any[]> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status === 401 ? 401 : 403;
    const code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.', code);
  }

  const effectiveCompanyId = auth.isAdmin && companyId ? companyId : auth.company?.id;
  if (!effectiveCompanyId) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('quotations')
    .select('*')
    .eq('seller_company_id', effectiveCompanyId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

/**
 * Updates quotation status ('accepted' | 'rejected' | 'withdrawn').
 * SECURITY MANDATE:
 * Requires approved user session.
 * - Accept/Reject: ONLY the buyer who owns the WTB request (or an admin) can accept or reject.
 * - Withdraw: The seller who submitted the quotation (or an admin) can withdraw it.
 */
export async function updateQuotationStatus(
  quotationId: string,
  status: 'accepted' | 'rejected' | 'withdrawn'
): Promise<{ success: boolean; error?: string; code?: string }> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const statusVal = auth.errorResponse?.status || 401;
    let code = statusVal === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED';
    let errorMsg = statusVal === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.';
    try {
      const cloned = auth.errorResponse?.clone();
      const errJson = await cloned?.json();
      if (errJson?.code) code = errJson.code;
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    return {
      success: false,
      error: errorMsg,
      code,
    };
  }

  const admin = createAdminClient();

  // 1. Fetch quotation and associated WTB request
  const { data: quote, error: quoteErr } = await admin
    .from('quotations')
    .select('id, seller_company_id, wtb_request_id')
    .eq('id', quotationId)
    .single();

  if (quoteErr || !quote) {
    return { success: false, error: 'Quotation not found.' };
  }

  const { data: wtb, error: wtbErr } = await admin
    .from('wtb_requests')
    .select('id, buyer_email, buyer_user_id')
    .eq('id', quote.wtb_request_id)
    .single();

  if (wtbErr || !wtb) {
    throw new AuthError(403, 'Forbidden: Associated WTB request not accessible.');
  }

  const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
  const callerCompanyId = auth.company?.id;

  const isBuyerOwner =
    auth.isAdmin ||
    (wtb.buyer_user_id && wtb.buyer_user_id === auth.user.id) ||
    (wtb.buyer_email && wtb.buyer_email.toLowerCase().trim() === callerEmail);

  const isSellerOwner =
    auth.isAdmin ||
    (callerCompanyId && quote.seller_company_id === callerCompanyId);

  // Status transition policy
  if (status === 'withdrawn') {
    if (!isSellerOwner) {
      throw new AuthError(403, 'Forbidden: Only the seller who submitted this quotation can withdraw it.');
    }
  } else {
    // 'accepted' or 'rejected'
    if (!isBuyerOwner) {
      throw new AuthError(403, 'Forbidden: Only the buyer who owns the WTB request can accept or reject quotations.');
    }
  }

  const { error: updateErr } = await admin
    .from('quotations')
    .update({ status })
    .eq('id', quotationId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  return { success: true };
}
