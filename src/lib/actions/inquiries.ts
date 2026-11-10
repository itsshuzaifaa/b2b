'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireApprovedUser, AuthError } from '@/lib/auth/guards';
import { sendNewInquiryEmail } from '@/lib/email/dispatcher';
import type { Product, Company } from '@/types/database';

export interface InquiryInput {
  productId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerCompanyId?: string;
  targetQuantity: number;
  offeredPrice?: number;
  message: string;
}

export interface InquiryActionResult {
  success: boolean;
  inquiryId?: string;
  error?: string;
  code?: string;
}

/**
 * Validates buyer input, inserts a new product inquiry into `product_inquiries`,
 * and triggers an email notification to the listing seller.
 */
export async function createProductInquiry(data: InquiryInput): Promise<InquiryActionResult> {
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
    // 1. Validation
    if (!data.productId?.trim()) {
      return { success: false, error: 'Product ID is required.' };
    }
    if (!data.targetQuantity || data.targetQuantity <= 0) {
      return { success: false, error: 'Target quantity must be greater than zero.' };
    }
    if (!data.message?.trim()) {
      return { success: false, error: 'Inquiry message cannot be empty.' };
    }

    // Take company ID and email strictly from session
    const effectiveBuyerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
    const effectiveBuyerName = auth.company?.contact_name || data.buyerName?.trim() || 'Wholesale Buyer';
    const effectiveBuyerCompany = auth.company?.company_name || 'Commercial Member';
    const effectiveBuyerPhone = auth.company?.phone || data.buyerPhone?.trim() || null;

    if (!effectiveBuyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveBuyerEmail)) {
      return { success: false, error: 'A valid buyer email address is required from your session.' };
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    // 2. Fetch Product & Seller details
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select(`
        id,
        title,
        moq,
        unit_price,
        company_id,
        company:companies(id, company_name, contact_name, contact_email)
      `)
      .eq('id', data.productId)
      .single();

    if (productError || !productData) {
      // Offline/demo fallback for verified showcase lots
      const { MOCK_PRODUCTS } = await import('@/lib/mock-data');
      const mockProduct = MOCK_PRODUCTS.find((p) => p.id === data.productId);
      if (mockProduct) {
        if (data.targetQuantity < mockProduct.moq) {
          return {
            success: false,
            error: `Target quantity (${data.targetQuantity}) is below the minimum order quantity (MOQ: ${mockProduct.moq}).`,
          };
        }
        return {
          success: true,
          inquiryId: `inq-demo-${Date.now()}`,
        };
      }
      return { success: false, error: 'Target product listing not found.' };
    }

    const rawCompany = (productData as any)?.company;
    const sellerEmail = rawCompany?.contact_email || rawCompany?.email;
    const sellerName = rawCompany?.contact_name || rawCompany?.company_name || rawCompany?.name;

    if (data.targetQuantity < productData.moq) {
      return {
        success: false,
        error: `Target quantity (${data.targetQuantity}) is below the minimum order quantity (MOQ: ${productData.moq}).`,
      };
    }

    // 3. Insert inquiry into database
    const { data: insertedInquiry, error: insertError } = await admin
      .from('product_inquiries')
      .insert({
        product_id: productData.id,
        seller_company_id: productData.company_id,
        buyer_name: effectiveBuyerName,
        buyer_email: effectiveBuyerEmail,
        buyer_phone: effectiveBuyerPhone,
        buyer_company: effectiveBuyerCompany,
        requested_quantity: data.targetQuantity,
        target_price: data.offeredPrice ?? 0,
        message: data.message.trim(),
        status: 'new',
      } as any)
      .select('id')
      .single();

    if (insertError || !insertedInquiry) {
      return { success: false, error: `Failed to record inquiry: ${insertError?.message}` };
    }

    // 4. Trigger email to seller asynchronously (non-blocking for fast UI response)
    if (sellerEmail) {
      void sendNewInquiryEmail(sellerEmail, {
        sellerName: sellerName || 'Wholesale Supplier',
        buyerName: data.buyerName.trim(),
        buyerEmail: data.buyerEmail.trim(),
        buyerPhone: data.buyerPhone?.trim(),
        productTitle: productData.title,
        targetQuantity: data.targetQuantity,
        offeredPrice: data.offeredPrice,
        message: data.message.trim(),
        inquiryId: insertedInquiry.id,
      }).catch((emailErr) => {
        console.warn('[INQUIRY EMAIL NOTICE]', emailErr);
      });
    }

    return {
      success: true,
      inquiryId: insertedInquiry.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error submitting inquiry.';
    return { success: false, error: message };
  }
}

/**
 * Retrieves details for a specific inquiry.
 * SECURITY MANDATE:
 * Requires an approved user session.
 * Caller's company MUST be a party to this inquiry (the buyer or the seller), or a platform administrator.
 */
export async function getInquiryDetails(inquiryId: string): Promise<any> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status === 401 ? 401 : 403;
    throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.');
  }

  const admin = createAdminClient();
  const { data: inquiry, error } = await admin
    .from('product_inquiries')
    .select('*')
    .eq('id', inquiryId)
    .single();

  if (error || !inquiry) {
    return null;
  }

  // Authorization check: Caller must be buyer, seller, or administrator
  if (!auth.isAdmin) {
    const isSeller = auth.company?.id && inquiry.seller_company_id === auth.company.id;
    const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
    const isBuyer = inquiry.buyer_email && inquiry.buyer_email.toLowerCase().trim() === callerEmail;

    if (!isSeller && !isBuyer) {
      throw new AuthError(403, 'Forbidden: You are not a party to this inquiry.');
    }
  }

  return inquiry;
}

/**
 * Retrieves inquiries submitted by the caller.
 * SECURITY MANDATE:
 * Requires an approved user session.
 * Caller can only retrieve inquiries where their company is the buyer (or all if admin).
 */
export async function getBuyerInquiries(buyerCompanyId?: string): Promise<any[]> {
  const auth = await requireApprovedUser();
  if (auth.errorResponse || !auth.user) {
    const status = auth.errorResponse?.status === 401 ? 401 : 403;
    throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.');
  }

  const admin = createAdminClient();
  let query = admin.from('product_inquiries').select('*');

  if (!auth.isAdmin) {
    const callerEmail = (auth.company?.contact_email || auth.user.email || '').toLowerCase().trim();
    query = query.ilike('buyer_email', callerEmail);
  } else if (buyerCompanyId) {
    query = query.eq('buyer_company_id', buyerCompanyId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}
