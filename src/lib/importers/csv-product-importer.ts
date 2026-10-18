'use server';

import Papa from 'papaparse';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Product, MembershipTier } from '@/types/database';

export interface CsvRowError {
  row: number;
  message: string;
}

export interface CsvImportResult {
  success: boolean;
  totalProcessed: number;
  insertedCount: number;
  errors: CsvRowError[];
}

interface RawCsvProductRow {
  title?: string;
  category_slug?: string;
  barcode_or_sku?: string;
  unit_price?: string | number;
  quantity_available?: string | number;
  moq?: string | number;
  description?: string;
  images?: string;
}

/**
 * Normalizes CSV headers to standard column keys.
 */
function normalizeHeader(rawHeader: string): string {
  const cleaned = rawHeader.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
  switch (cleaned) {
    case 'title':
    case 'product_name':
    case 'name':
      return 'title';
    case 'category_slug':
    case 'category':
    case 'niche':
      return 'category_slug';
    case 'barcode_or_sku':
    case 'barcode':
    case 'sku':
    case 'upc':
    case 'ean':
      return 'barcode_or_sku';
    case 'unit_price':
    case 'price':
    case 'cost':
      return 'unit_price';
    case 'quantity_available':
    case 'quantity':
    case 'qty':
    case 'stock':
      return 'quantity_available';
    case 'moq':
    case 'min_order':
    case 'minimum_order_quantity':
      return 'moq';
    case 'description':
    case 'details':
      return 'description';
    case 'images':
    case 'image_urls':
      return 'images';
    default:
      return cleaned;
  }
}

/**
 * Imports and validates bulk product CSV data for a specific seller company.
 * 
 * Rules enforced:
 * 1. Seller must have approval_status = 'approved'.
 * 2. 'bronze' tier is rejected immediately ("CSV upload requires Silver or Gold tier.").
 * 3. 'silver' tier verifies (current_active_products + rows_count) <= 50.
 * 4. Required columns: title, category_slug, barcode_or_sku, unit_price, quantity_available, moq.
 * 5. Duplicate barcodes within CSV are detected and flagged.
 */
export async function importProductsFromCsv({
  companyId,
  csvContent,
}: {
  companyId: string;
  csvContent: string;
}): Promise<CsvImportResult> {
  const errors: CsvRowError[] = [];
  const client = await createClient();
  const admin = createAdminClient();

  // 1. Verify Company & Vetting Status
  const { data: company, error: companyError } = await client
    .from('companies')
    .select('id, company_name, tier, approval_status')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      errors: [{ row: 0, message: 'Seller company record not found.' }],
    };
  }

  if (company.approval_status !== 'approved') {
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      errors: [{ row: 0, message: 'Only approved sellers can upload products.' }],
    };
  }

  // 2. Verify Membership Tier Permissions
  const tier: MembershipTier = ((company as any).tier || (company as any).membership_tier || 'bronze') as MembershipTier;
  if (tier === 'bronze') {
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      errors: [{ row: 0, message: 'CSV upload requires Silver or Gold tier.' }],
    };
  }

  // 3. Convert input to string
  const rawCsvString = csvContent;

  if (!rawCsvString.trim()) {
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      errors: [{ row: 0, message: 'CSV file is empty.' }],
    };
  }

  // 4. Parse CSV via PapaParse
  const parseResult = Papa.parse<RawCsvProductRow>(rawCsvString, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });

  if (parseResult.errors && parseResult.errors.length > 0) {
    for (const parseErr of parseResult.errors) {
      errors.push({
        row: (parseErr.row ?? 0) + 1,
        message: `CSV Syntax error: ${parseErr.message}`,
      });
    }
  }

  const rows = parseResult.data;
  const totalProcessed = rows.length;

  if (totalProcessed === 0) {
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      errors: [{ row: 0, message: 'No valid data rows found in CSV.' }],
    };
  }

  // 5. Tier Quota Check for Silver
  if (tier === 'silver') {
    const { count: activeCount, error: countError } = await client
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (countError) {
      return {
        success: false,
        totalProcessed,
        insertedCount: 0,
        errors: [{ row: 0, message: `Failed to query active product count: ${countError.message}` }],
      };
    }

    const currentActive = activeCount ?? 0;
    if (currentActive + totalProcessed > 50) {
      return {
        success: false,
        totalProcessed,
        insertedCount: 0,
        errors: [
          {
            row: 0,
            message: `Silver tier limit exceeded. Currently active: ${currentActive}, CSV rows: ${totalProcessed}. Maximum allowed active products is 50.`,
          },
        ],
      };
    }
  }

  // 6. Row-by-Row Validation & Duplicate Barcode Check
  const seenBarcodes = new Map<string, number>();
  const validProductsToInsert: Array<
    Pick<
      Product,
      | 'company_id'
      | 'category_slug'
      | 'title'
      | 'description'
      | 'barcode_or_sku'
      | 'unit_price'
      | 'quantity_available'
      | 'moq'
      | 'status'
      | 'is_hot'
      | 'images'
    >
  > = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +1 for 0-index, +1 for header row
    const row = rows[i];

    // Validate Required Fields
    const title = row.title?.trim();
    if (!title) {
      errors.push({ row: rowNum, message: 'Missing required field: "title".' });
    }

    const categorySlug = row.category_slug?.trim();
    if (!categorySlug) {
      errors.push({ row: rowNum, message: 'Missing required field: "category_slug".' });
    }

    const barcodeOrSku = row.barcode_or_sku?.trim();
    if (!barcodeOrSku) {
      errors.push({ row: rowNum, message: 'Missing required field: "barcode_or_sku".' });
    } else {
      // Duplicate barcode check within file
      const normalizedBarcode = barcodeOrSku.toUpperCase();
      if (seenBarcodes.has(normalizedBarcode)) {
        const originalRow = seenBarcodes.get(normalizedBarcode)!;
        errors.push({
          row: rowNum,
          message: `Duplicate barcode/SKU "${barcodeOrSku}" detected in CSV (first defined on row ${originalRow}).`,
        });
      } else {
        seenBarcodes.set(normalizedBarcode, rowNum);
      }
    }

    // Validate Numeric values
    const unitPrice = typeof row.unit_price === 'number' ? row.unit_price : parseFloat(row.unit_price ?? '');
    if (isNaN(unitPrice) || unitPrice <= 0) {
      errors.push({ row: rowNum, message: 'Invalid "unit_price": must be a positive number greater than 0.' });
    }

    const quantityAvailable =
      typeof row.quantity_available === 'number'
        ? row.quantity_available
        : parseInt(String(row.quantity_available ?? ''), 10);
    if (isNaN(quantityAvailable) || quantityAvailable < 0) {
      errors.push({ row: rowNum, message: 'Invalid "quantity_available": must be an integer >= 0.' });
    }

    const moq = typeof row.moq === 'number' ? row.moq : parseInt(String(row.moq ?? ''), 10);
    if (isNaN(moq) || moq < 1) {
      errors.push({ row: rowNum, message: 'Invalid "moq": minimum order quantity must be an integer >= 1.' });
    }

    // If row had errors, continue without adding to insert list
    const rowHasErrors = errors.some((e) => e.row === rowNum);
    if (rowHasErrors || !title || !categorySlug || !barcodeOrSku || isNaN(unitPrice) || isNaN(quantityAvailable) || isNaN(moq)) {
      continue;
    }

    // Parse images array if present
    let images: string[] = [];
    if (row.images) {
      images = row.images
        .split(/[;,|]/)
        .map((url) => url.trim())
        .filter(Boolean);
    }

    validProductsToInsert.push({
      company_id: companyId,
      category_slug: categorySlug,
      title,
      description: row.description?.trim() || null,
      barcode_or_sku: barcodeOrSku,
      unit_price: unitPrice,
      quantity_available: quantityAvailable,
      moq,
      status: 'active',
      is_hot: false, // CSV uploads start non-hot; only gold tier can manually toggle
      images,
    });
  }

  // 7. If there are validation errors, do not proceed with database insertion
  if (errors.length > 0) {
    return {
      success: false,
      totalProcessed,
      insertedCount: 0,
      errors,
    };
  }

  // 8. Insert valid products into Supabase
  const { data: insertedData, error: insertError } = await admin
    .from('products')
    .insert(validProductsToInsert)
    .select('id');

  if (insertError) {
    return {
      success: false,
      totalProcessed,
      insertedCount: 0,
      errors: [{ row: 0, message: `Database insert failed: ${insertError.message}` }],
    };
  }

  const insertedCount = insertedData ? insertedData.length : validProductsToInsert.length;

  return {
    success: true,
    totalProcessed,
    insertedCount,
    errors: [],
  };
}
