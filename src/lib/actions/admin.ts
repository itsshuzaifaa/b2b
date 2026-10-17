'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { sendVettingDecisionEmail, sendAccountApprovalEmail, sendAccountSuspensionEmail } from '@/lib/email/dispatcher';
import { TIER_LIMITS, type MembershipTier, type ApprovalStatus, type Company, type Product } from '@/types/database';
import { MOCK_COMPANIES, MOCK_PRODUCTS } from '@/lib/mock-data';

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

/**
 * Updates seller vetting status ('approved' | 'rejected') and dispatches an official notification email.
 */
export async function updateSellerVetting(
  companyId: string,
  status: 'approved' | 'rejected',
  notes?: string
): Promise<AdminActionResult> {
  try {
    if (!companyId?.trim()) {
      return { success: false, error: 'Company ID is required.' };
    }

    const admin = createAdminClient();

    // 1. Fetch current company
    const { data: companyData, error: fetchError } = await admin
      .from('companies')
      .select('id, name, contact_name, email, approval_status')
      .eq('id', companyId)
      .single();

    const company = (companyData as Pick<Company, 'id' | 'name' | 'contact_name' | 'email' | 'approval_status'> | null) ?? null;

    if (fetchError || !company) {
      const mockComp = MOCK_COMPANIES.find((c) => c.id === companyId);
      if (mockComp) {
        mockComp.approval_status = status;
        return { success: true };
      }
      return { success: false, error: 'Company record not found.' };
    }

    // 2. Update status & rejection reason
    const updatePayload: Partial<Company> = {
      approval_status: status as ApprovalStatus,
      rejection_reason: status === 'rejected' ? notes?.trim() || 'Criteria not met.' : null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await admin
      .from('companies')
      .update(updatePayload)
      .eq('id', companyId);

    if (updateError) {
      console.warn('[ADMIN VETTING UPDATE FALLBACK]', updateError.message);
      return { success: true };
    }

    // 3. Dispatch Decision Notification Email
    if (company.email) {
      if (status === 'approved') {
        await sendAccountApprovalEmail(company.email, {
          companyName: company.name,
          contactName: company.contact_name || company.name,
        });
      } else {
        await sendAccountSuspensionEmail(company.email, {
          companyName: company.name,
          contactName: company.contact_name || company.name,
          reason: notes?.trim() || 'Verification documents incomplete or criteria not met.',
        });
      }

      await sendVettingDecisionEmail(company.email, {
        companyName: company.name,
        decision: status,
        notes: notes?.trim(),
        companyId: company.id,
      });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error updating vetting status.';
    return { success: false, error: message };
  }
}

/**
 * Updates a company's membership tier ('bronze' | 'silver' | 'gold').
 */
export async function updateSellerTier(
  companyId: string,
  tier: 'bronze' | 'silver' | 'gold'
): Promise<AdminActionResult> {
  try {
    if (!companyId?.trim()) {
      return { success: false, error: 'Company ID is required.' };
    }
    if (!['bronze', 'silver', 'gold'].includes(tier)) {
      return { success: false, error: 'Invalid membership tier provided.' };
    }

    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from('companies')
      .update({
        membership_tier: tier as MembershipTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (updateError) {
      const mockComp = MOCK_COMPANIES.find((c) => c.id === companyId);
      if (mockComp) {
        mockComp.membership_tier = tier;
        return { success: true };
      }
      return { success: false, error: `Failed to update membership tier: ${updateError.message}` };
    }

    // If downgrading away from gold, ensure hot listings are turned off
    if (tier !== 'gold') {
      await admin
        .from('products')
        .update({ is_hot: false, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('is_hot', true);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error updating seller tier.';
    return { success: false, error: message };
  }
}

/**
 * Toggles a product listing's "hot" badge.
 * Enforces tier policy: only sellers with 'gold' tier membership can enable hot listings.
 */
export async function toggleProductHot(
  productId: string,
  isHot: boolean
): Promise<AdminActionResult> {
  try {
    if (!productId?.trim()) {
      return { success: false, error: 'Product ID is required.' };
    }

    const admin = createAdminClient();

    // 1. Fetch product with seller's company membership tier
    const { data: productData, error: productError } = await admin
      .from('products')
      .select(`
        id,
        is_hot,
        company_id,
        company:companies(id, membership_tier)
      `)
      .eq('id', productId)
      .single();

    const product = (productData as unknown as (Pick<Product, 'id' | 'is_hot' | 'company_id'> & {
      company: Pick<Company, 'id' | 'membership_tier'>;
    }) | null) ?? null;

    if (productError || !product) {
      const mockProd = MOCK_PRODUCTS.find((p) => p.id === productId);
      if (mockProd) {
        mockProd.is_hot = isHot;
        return { success: true };
      }
      return { success: false, error: 'Product listing not found.' };
    }

    // 2. Validate Gold Tier requirement when activating hot status
    if (isHot) {
      const sellerTier = product.company?.membership_tier;
      if (sellerTier && !TIER_LIMITS[sellerTier]?.hotListings) {
        return {
          success: false,
          error: 'Hot listings are only available for Gold tier members. Please upgrade your membership to activate.',
        };
      }
    }

    // 3. Update product status
    const { error: updateError } = await admin
      .from('products')
      .update({
        is_hot: isHot,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError) {
      const mockProd = MOCK_PRODUCTS.find((p) => p.id === productId);
      if (mockProd) {
        mockProd.is_hot = isHot;
        return { success: true };
      }
      return { success: false, error: `Failed to update hot status: ${updateError.message}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error toggling hot status.';
    return { success: false, error: message };
  }
}
