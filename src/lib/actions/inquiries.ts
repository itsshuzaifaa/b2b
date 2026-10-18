'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
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
}

/**
 * Validates buyer input, inserts a new product inquiry into `product_inquiries`,
 * and triggers an email notification to the listing seller.
 */
export async function createProductInquiry(data: InquiryInput): Promise<InquiryActionResult> {
  try {
    // 1. Validation
    if (!data.productId?.trim()) {
      return { success: false, error: 'Product ID is required.' };
    }
    if (!data.buyerName?.trim()) {
      return { success: false, error: 'Buyer name is required.' };
    }
    if (!data.buyerEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.buyerEmail)) {
      return { success: false, error: 'A valid buyer email address is required.' };
    }
    if (!data.targetQuantity || data.targetQuantity <= 0) {
      return { success: false, error: 'Target quantity must be greater than zero.' };
    }
    if (!data.message?.trim()) {
      return { success: false, error: 'Inquiry message cannot be empty.' };
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
        buyer_company_id: data.buyerCompanyId || null,
        buyer_name: data.buyerName.trim(),
        buyer_email: data.buyerEmail.trim().toLowerCase(),
        buyer_phone: data.buyerPhone?.trim() || null,
        target_quantity: data.targetQuantity,
        offered_price: data.offeredPrice ?? null,
        message: data.message.trim(),
      })
      .select('id')
      .single();

    if (insertError || !insertedInquiry) {
      return { success: false, error: `Failed to record inquiry: ${insertError?.message}` };
    }

    // 4. Trigger email to seller
    if (sellerEmail) {
      await sendNewInquiryEmail(sellerEmail, {
        sellerName: sellerName || 'Wholesale Supplier',
        buyerName: data.buyerName.trim(),
        buyerEmail: data.buyerEmail.trim(),
        buyerPhone: data.buyerPhone?.trim(),
        productTitle: productData.title,
        targetQuantity: data.targetQuantity,
        offeredPrice: data.offeredPrice,
        message: data.message.trim(),
        inquiryId: insertedInquiry.id,
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
