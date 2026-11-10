import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireUser, requireApprovedUser } from '@/lib/auth/guards';
import type { Product } from '@/types/database';
import { processMatchesForNewProduct } from '@/lib/matching/match-service';

/**
 * GET /api/products
 * Public endpoint for retrieving wholesale products.
 * SECURITY: Restricted to whitelisted public fields only.
 * Private fields (contact_phone, vat_number, company_number, kyc documents) are never exposed.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const productId = searchParams.get('id');
    const companyId = searchParams.get('companyId');
    const categorySlug = searchParams.get('category');
    const query = searchParams.get('q')?.toLowerCase();

    const admin = createAdminClient();

    let dbQuery = admin
      .from('products')
      .select(`
        *,
        company:companies(id, company_name, name, contact_name, country, role, tier, membership_tier, approval_status, niches, categories, created_at),
        category:categories(id, name, slug)
      `)
      .neq('id', '00000000-0000-4000-a000-000000000001') // exclude system anchor product
      .order('created_at', { ascending: false });

    const showAll = searchParams.get('all') === 'true' || searchParams.get('admin') === 'true';

    if (productId) {
      dbQuery = dbQuery.eq('id', productId);
    }
    if (companyId) {
      dbQuery = dbQuery.eq('company_id', companyId);
    } else if (!productId && !showAll) {
      dbQuery = dbQuery.eq('status', 'active');
    }

    const { data: rows, error } = await dbQuery;

    if (error) {
      console.error('[GET PRODUCTS ERROR]', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const products: Product[] = (rows || []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id,
      category_id: row.category_id,
      category_slug: row.category?.slug || 'electronics',
      title: row.title,
      description: row.description || '',
      barcode_or_sku: row.barcode_or_sku || null,
      unit_price: Number(row.unit_price) || 0,
      quantity_available: Number(row.quantity_available) || 0,
      moq: Number(row.moq) || 1,
      status: (row.status || 'active') as any,
      is_hot: Boolean(row.is_hot),
      images: row.image_urls && row.image_urls.length > 0 ? row.image_urls : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
      created_at: row.created_at,
      updated_at: row.updated_at,
      company: row.company
        ? {
            id: row.company.id,
            name: row.company.company_name || row.company.name || 'Verified Supplier',
            contact_name: row.company.contact_name || 'Sales Representative',
            email: row.company.contact_email || row.company.email || '',
            role: row.company.role || 'seller',
            membership_tier: row.company.tier || row.company.membership_tier || 'gold',
            approval_status: row.company.approval_status || 'approved',
            categories: row.company.niches || row.company.categories || [],
            created_at: row.company.created_at,
          }
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      product: products[0] || null,
      products,
    });
  } catch (err) {
    console.error('[GET PRODUCTS EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

let cachedCategories: { data: { id: string; slug: string }[]; expiresAt: number } | null = null;
async function getCategoriesCached(admin: any) {
  const now = Date.now();
  if (cachedCategories && cachedCategories.expiresAt > now) {
    return cachedCategories.data;
  }
  const { data: dbCategories } = await admin.from('categories').select('id, slug');
  if (dbCategories && dbCategories.length > 0) {
    cachedCategories = { data: dbCategories, expiresAt: now + 5 * 60 * 1000 };
    return dbCategories;
  }
  return cachedCategories?.data || [];
}

/**
 * POST /api/products
 * Creates or updates a product.
 * SECURITY:
 * 1. Requires authenticated user session via requireUser().
 * 2. Non-admins can only create/update products for their own verified company.
 * 3. Admins can create/update products on behalf of any company.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth.errorResponse) return auth.errorResponse;

  if (!auth.isAdmin && !auth.company) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: No registered company found for your user account.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const admin = createAdminClient();

    const {
      id,
      title,
      description,
      barcodeOrSku,
      categorySlug,
      categoryId,
      unitPrice,
      quantityAvailable,
      moq,
      isHot,
      status = 'active',
      images = [],
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: 'Product title is required' }, { status: 400 });
    }

    // Determine target company:
    // If admin: can use body.companyId or fallback to auth.company?.id
    // If non-admin: MUST use auth.company!.id (ignore any companyId passed from client)
    const effectiveCompanyId = auth.isAdmin
      ? (body.companyId || auth.company?.id)
      : auth.company!.id;

    if (!effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Seller company ID is required' }, { status: 400 });
    }

    // Resolve category id
    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId && categorySlug) {
      const dbCategories = await getCategoriesCached(admin);
      const match = dbCategories?.find(
        (c: any) => c.slug === categorySlug || categorySlug.includes(c.slug) || c.slug.includes(categorySlug)
      );
      if (match) resolvedCategoryId = match.id;
    }
    if (!resolvedCategoryId) {
      const { data: firstCat } = await admin.from('categories').select('id').limit(1).single();
      resolvedCategoryId = firstCat?.id;
    }

    const rowCondition = (body.condition || '').trim();
    let descBase = description?.trim() || null;
    if (rowCondition && (!descBase || !descBase.toLowerCase().includes('condition:'))) {
      descBase = descBase ? `${descBase} | Condition: ${rowCondition}` : `Condition: ${rowCondition}`;
    }

    let safeBarcode =
      barcodeOrSku?.trim() && barcodeOrSku.trim().toLowerCase() !== 'n/a'
        ? barcodeOrSku.trim()
        : `SKU-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (!id && safeBarcode) {
      // Check if this seller already has a product with this exact barcode_or_sku
      const { data: existing } = await admin
        .from('products')
        .select('id, barcode_or_sku')
        .eq('company_id', effectiveCompanyId)
        .eq('barcode_or_sku', safeBarcode)
        .maybeSingle();

      if (existing) {
        const conditionTag = rowCondition ? rowCondition.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
        safeBarcode = `${safeBarcode}-${conditionTag || Date.now().toString().slice(-4)}`;
      }
    }

    const payload: any = {
      company_id: effectiveCompanyId,
      category_id: resolvedCategoryId,
      title: title.trim(),
      description: descBase,
      barcode_or_sku: safeBarcode,
      unit_price: Number(unitPrice) || 0,
      quantity_available: Number(quantityAvailable) || 0,
      moq: Number(moq) || 1,
      is_hot: Boolean(isHot),
      status,
      image_urls: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // 1. Updating existing product -> Verify ownership
      const { data: existingProduct, error: fetchErr } = await admin
        .from('products')
        .select('id, company_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !existingProduct) {
        return NextResponse.json({ success: false, error: 'Product listing not found.' }, { status: 404 });
      }

      // Non-admin can only update products owned by their own company
      if (!auth.isAdmin && existingProduct.company_id !== auth.company!.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot modify products belonging to another company.' },
          { status: 403 }
        );
      }

      payload.company_id = existingProduct.company_id;

      const { data, error } = await admin
        .from('products')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      // Trigger automatic matching with open WTB requests
      try {
        void processMatchesForNewProduct({
          id: data.id,
          company_id: payload.company_id,
          title: payload.title,
          brand: body.brand || null,
          barcode_or_sku: payload.barcode_or_sku,
          unit_price: payload.unit_price,
          quantity_available: payload.quantity_available,
          condition: body.condition || 'New',
          description: payload.description,
        });
      } catch (matchErr) {
        console.warn('[MATCH NOTIFICATION NOTICE]', matchErr);
      }

      return NextResponse.json({ success: true, product: data });
    } else {
      // 2. Creating new product
      payload.created_at = new Date().toISOString();
      const { data, error } = await admin
        .from('products')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      // Trigger automatic matching with open WTB requests
      try {
        void processMatchesForNewProduct({
          id: data.id,
          company_id: payload.company_id,
          title: payload.title,
          brand: body.brand || null,
          barcode_or_sku: payload.barcode_or_sku,
          unit_price: payload.unit_price,
          quantity_available: payload.quantity_available,
          condition: body.condition || 'New',
          description: payload.description,
        });
      } catch (matchErr) {
        console.warn('[MATCH NOTIFICATION NOTICE]', matchErr);
      }

      return NextResponse.json({ success: true, product: data });
    }
  } catch (err) {
    console.error('[POST PRODUCT EXCEPTION]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save product' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/products
 * Updates status of products.
 * SECURITY:
 * 1. Requires authenticated user session via requireUser().
 * 2. Non-admins can only update products belonging to their own company.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth.errorResponse) return auth.errorResponse;

  if (!auth.isAdmin && !auth.company) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: No registered company found for your user account.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { ids, id, status = 'suspended' } = body || {};

    let targetIds: string[] = [];
    if (Array.isArray(ids)) {
      targetIds = ids.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (id) {
      targetIds = [String(id).trim()];
    }

    if (!targetIds.length) {
      return NextResponse.json({ success: false, error: 'Product ID or IDs required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // If non-admin: verify ALL target products belong to caller's company
    if (!auth.isAdmin) {
      const { data: targetProducts, error: checkErr } = await admin
        .from('products')
        .select('id, company_id')
        .in('id', targetIds);

      if (checkErr) throw checkErr;

      const hasUnauthorizedProduct = (targetProducts || []).some(
        (p) => p.company_id !== auth.company!.id
      );

      if (hasUnauthorizedProduct || (targetProducts || []).length !== targetIds.length) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot modify products belonging to another company.' },
          { status: 403 }
        );
      }
    }

    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'active') {
      // Republished: reset active timer
      updatePayload.created_at = new Date().toISOString();
    }

    let updateQuery = admin.from('products').update(updatePayload).in('id', targetIds);
    if (!auth.isAdmin) {
      updateQuery = updateQuery.eq('company_id', auth.company!.id);
    }

    const { error } = await updateQuery;
    if (error) throw error;

    return NextResponse.json({ success: true, count: targetIds.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update products' },
      { status: 500 }
    );
  }
}

export const PUT = POST;

/**
 * DELETE /api/products
 * Deletes products by ID(s) or company ID.
 * SECURITY:
 * 1. Requires authenticated user session via requireUser().
 * 2. Non-admins can only delete products belonging to their own company.
 * 3. Bypassing company_id via query or payload is blocked.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireApprovedUser();
  if (auth.errorResponse) return auth.errorResponse;

  if (!auth.isAdmin && !auth.company) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: No registered company found for your user account.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const companyIdParam = searchParams.get('companyId');

    let body: any = null;
    try {
      body = await req.json();
    } catch {}

    const admin = createAdminClient();

    // 1. Bulk delete by company ID
    const targetCompanyId = companyIdParam || body?.companyId;
    if (targetCompanyId) {
      // Non-admins can NEVER target another company's products
      if (!auth.isAdmin && targetCompanyId !== auth.company!.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot delete products belonging to another company.' },
          { status: 403 }
        );
      }

      const effectiveCompId = auth.isAdmin ? targetCompanyId : auth.company!.id;
      const { error, count } = await admin
        .from('products')
        .delete()
        .eq('company_id', effectiveCompId);

      if (error) throw error;
      return NextResponse.json({ success: true, count });
    }

    // 2. Delete by specific product ID(s)
    let idsToDelete: string[] = [];
    if (idsParam) {
      idsToDelete = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (id) {
      idsToDelete = [id.trim()];
    } else if (Array.isArray(body?.ids)) {
      idsToDelete = body.ids.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (body?.id) {
      idsToDelete = [String(body.id).trim()];
    }

    if (!idsToDelete.length) {
      return NextResponse.json({ success: false, error: 'Product ID or IDs required' }, { status: 400 });
    }

    // If non-admin: verify ALL target products belong to caller's company!
    if (!auth.isAdmin) {
      const { data: targetProducts, error: fetchErr } = await admin
        .from('products')
        .select('id, company_id')
        .in('id', idsToDelete);

      if (fetchErr) throw fetchErr;

      // If any product belongs to another company or wasn't found, deny
      const hasOtherCompanyProduct = (targetProducts || []).some(
        (p) => p.company_id !== auth.company!.id
      );

      if (hasOtherCompanyProduct || (targetProducts || []).length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot delete products belonging to another company.' },
          { status: 403 }
        );
      }
    }

    let deleteQuery = admin.from('products').delete().in('id', idsToDelete);
    if (!auth.isAdmin) {
      deleteQuery = deleteQuery.eq('company_id', auth.company!.id);
    }

    const { error, count } = await deleteQuery;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count ?? idsToDelete.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete product' },
      { status: 500 }
    );
  }
}
