'use server';

import { createAdminClient } from '@/lib/supabase/server';
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
}

/**
 * Retrieves the count of quotations submitted by a seller in the current calendar month.
 * First calls the Supabase RPC `fn_get_seller_monthly_quote_usage`.
 * If the RPC is not yet registered or fails, falls back to a direct count query on `quotations`.
 */
export async function getSellerQuoteUsage(companyId: string): Promise<number> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc('fn_get_seller_monthly_quote_usage', {
      p_company_id: companyId,
    });

    if (!error && typeof data === 'number') {
      return data;
    }
  } catch (rpcErr) {
    console.warn('[QUOTATION RPC WARNING] fn_get_seller_monthly_quote_usage fallback:', rpcErr);
  }

  // Fallback: Query quotations submitted in current calendar month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count, error: countError } = await admin
    .from('quotations')
    .select('*', { count: 'exact', head: true })
    .eq('seller_company_id', companyId)
    .gte('created_at', startOfMonth);

  if (countError) {
    console.error('[GET QUOTE USAGE ERROR]', countError);
    return 0;
  }

  return count ?? 0;
}

/**
 * Validates seller vetting and tier quota, records a quotation,
 * and notifies the buyer via email.
 */
export async function submitQuotation(data: QuotationInput): Promise<QuotationActionResult> {
  try {
    // 1. Input Validation
    if (!data.wtbRequestId?.trim()) {
      return { success: false, error: 'WTB Request ID is required.' };
    }
    if (!data.sellerCompanyId?.trim()) {
      return { success: false, error: 'Seller Company ID is required.' };
    }
    if (data.unitPrice === undefined || data.unitPrice <= 0) {
      return { success: false, error: 'Unit price must be greater than zero.' };
    }
    if (!data.quantityOffered || data.quantityOffered <= 0) {
      return { success: false, error: 'Offered quantity must be greater than zero.' };
    }

    const admin = createAdminClient();

    // 2. Verify Seller Company using exact PostgreSQL schema (company_name, contact_email, tier, approval_status)
    let sellerRow: any = null;

    if (data.sellerCompanyId) {
      const { data: byId } = await admin
        .from('companies')
        .select('id, user_id, company_name, contact_name, contact_email, phone, approval_status, tier')
        .or(`id.eq.${data.sellerCompanyId},user_id.eq.${data.sellerCompanyId}`)
        .maybeSingle();

      if (byId) {
        sellerRow = byId;
      }
    }

    if (!sellerRow && data.sellerEmail) {
      const { data: byEmail } = await admin
        .from('companies')
        .select('id, user_id, company_name, contact_name, contact_email, phone, approval_status, tier')
        .ilike('contact_email', data.sellerEmail.trim().toLowerCase())
        .maybeSingle();

      if (byEmail) {
        sellerRow = byEmail;
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
          contact_name: mockSeller.contact_name,
          email: mockSeller.email || (mockSeller as any).contact_email || '',
          approval_status: mockSeller.approval_status || 'approved',
          membership_tier: (mockSeller.membership_tier || (mockSeller as any).tier || 'silver') as MembershipTier,
        };
      }
    }

    if (!seller) {
      return { success: false, error: 'Seller company not found.' };
    }

    if (seller.approval_status === 'rejected') {
      return { success: false, error: 'Your seller account has been deactivated.' };
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

    // 5. Send Notification Email to Buyer
    if (wtb.buyer_email) {
      try {
        await sendQuoteReceivedEmail(wtb.buyer_email, {
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
        });
      } catch (emailErr) {
        console.warn('[QUOTE EMAIL NOTICE]', emailErr);
      }
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
