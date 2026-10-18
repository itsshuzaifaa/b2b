'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Building2,
  Mail,
  ShieldCheck,
  Package,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AdminClientAccount } from '@/lib/admin/admin-store';

export interface ParsedCsvProduct {
  rowNumber: number;
  type: 'BUY' | 'SELL';
  title: string;
  brand: string;
  category: string;
  itemCode: string;
  condition: string;
  barcodeOrSku: string;
  unitPrice: number;
  quantityAvailable: number;
  moq: number;
  location: string;
  description: string;
  images: string[];
  isValid: boolean;
  errors: string[];
}

interface AdminBulkCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AdminClientAccount | null;
  initialMode?: 'WTS' | 'WTB';
  onSuccess?: (insertedCount: number) => void;
}

function normalizeHeader(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
  switch (cleaned) {
    case 'type':
    case 'trade_type':
    case 'buy_sell':
    case 'trade_mode':
    case 'order_type':
    case 'side':
    case 'action':
      return 'type';
    case 'title':
    case 'product_name':
    case 'name':
    case 'product':
    case 'item':
      return 'title';
    case 'brand':
    case 'make':
    case 'manufacturer':
      return 'brand';
    case 'category':
    case 'category_slug':
    case 'niche':
    case 'sector':
      return 'category';
    case 'item_code':
    case 'itemcode':
    case 'code':
      return 'item_code';
    case 'barcode_or_sku':
    case 'barcode':
    case 'sku':
    case 'ean':
    case 'upc':
      return 'barcode_or_sku';
    case 'condition':
    case 'grade':
    case 'state':
      return 'condition';
    case 'unit_price':
    case 'price':
    case 'cost':
    case 'wholesale_price':
    case 'target_price':
    case 'target_unit_price':
    case 'max_price':
    case 'buy_price':
    case 'bid_price':
      return 'unit_price';
    case 'quantity_available':
    case 'quantity':
    case 'qty':
    case 'stock':
    case 'available':
    case 'target_quantity':
    case 'target_qty':
    case 'needed_qty':
    case 'qty_needed':
    case 'required_qty':
      return 'quantity_available';
    case 'moq':
    case 'min_order':
    case 'minimum_order':
    case 'minimum_order_quantity':
      return 'moq';
    case 'location':
    case 'country':
    case 'warehouse':
    case 'hub':
      return 'location';
    case 'description':
    case 'desc':
    case 'details':
    case 'notes':
      return 'description';
    case 'images':
    case 'image_urls':
    case 'image':
      return 'images';
    default:
      return cleaned;
  }
}

export function AdminBulkCsvModal({
  isOpen,
  onClose,
  account,
  initialMode = 'WTS',
  onSuccess,
}: AdminBulkCsvModalProps) {
  // Step 1: Upload & Field Configuration | Step 2: Full-screen Table Preview & Publish
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [tradeMode, setTradeMode] = useState<'WTS' | 'WTB'>(initialMode);
  const [parsedRows, setParsedRows] = useState<ParsedCsvProduct[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'errors'>('all');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    total: number;
    mode: 'WTS' | 'WTB';
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTradeMode(initialMode || 'WTS');
      setCurrentStep(1);
      setCurrentPage(1);
    } else {
      setFile(null);
      setParsedRows([]);
      setHeaderError(null);
      setFilterView('all');
      setIsProcessing(false);
      setIsSubmitting(false);
      setSubmissionSuccess(null);
      setSubmitError(null);
      setCurrentStep(1);
      setCurrentPage(1);
      setTradeMode(initialMode || 'WTS');
    }
  }, [isOpen, initialMode]);

  const handleModeChange = (newMode: 'WTS' | 'WTB') => {
    setTradeMode(newMode);
    if (parsedRows.length > 0) {
      const targetType: 'BUY' | 'SELL' = newMode === 'WTB' ? 'BUY' : 'SELL';
      setParsedRows((prev) =>
        prev.map((r) => ({
          ...r,
          type: targetType,
          itemCode:
            r.itemCode === 'WTB-REQ' && targetType === 'SELL'
              ? 'MDL-2026'
              : r.itemCode === 'MDL-2026' && targetType === 'BUY'
              ? 'WTB-REQ'
              : r.itemCode,
        }))
      );
    }
  };

  const handleToggleRowType = (rowNumber: number) => {
    setParsedRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber ? { ...r, type: r.type === 'BUY' ? 'SELL' : 'BUY' } : r
      )
    );
  };

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setHeaderError(null);
    setSubmitError(null);
    setSubmissionSuccess(null);
    setIsProcessing(true);

    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
      complete: (results) => {
        setIsProcessing(false);
        const headers = results.meta.fields || [];

        // Validate mandatory columns
        const missingHeaders: string[] = [];
        if (!headers.includes('title')) missingHeaders.push('title');
        if (!headers.includes('unit_price')) missingHeaders.push('unit_price (or price / target_price)');
        if (!headers.includes('quantity_available'))
          missingHeaders.push('quantity_available (or quantity / qty / target_quantity)');

        if (missingHeaders.length > 0) {
          setHeaderError(
            `Formatting Error: Missing required column(s): ${missingHeaders.join(', ')}. Please use our sample CSV template.`
          );
          setParsedRows([]);
          setCurrentStep(1);
          return;
        }

        const seenBarcodes = new Map<string, number>();
        const products: ParsedCsvProduct[] = [];

        // Destination field is strictly determined by chosen tradeMode (WTS or WTB)
        const rowType: 'BUY' | 'SELL' = tradeMode === 'WTB' ? 'BUY' : 'SELL';

        results.data.forEach((row, index) => {
          const rowNumber = index + 2; // +1 for 0-index, +1 for header
          const rowErrors: string[] = [];

          const title = (row.title || '').trim();
          if (!title) {
            rowErrors.push('Missing product title.');
          }

          const rawPrice = (row.unit_price || '').replace(/[^0-9.]/g, '');
          const unitPrice = parseFloat(rawPrice);
          if (isNaN(unitPrice) || unitPrice <= 0) {
            rowErrors.push(
              `Invalid unit price "${row.unit_price || ''}". Must be a valid positive number.`
            );
          }

          const rawQty = (row.quantity_available || '').replace(/[^0-9]/g, '');
          const quantityAvailable = parseInt(rawQty, 10);
          if (isNaN(quantityAvailable) || quantityAvailable < 0) {
            rowErrors.push(
              `Invalid quantity "${row.quantity_available || ''}". Must be an integer >= 0.`
            );
          }

          const rawMoq = (row.moq || '1').replace(/[^0-9]/g, '');
          const moq = parseInt(rawMoq, 10);
          if (isNaN(moq) || moq < 1) {
            rowErrors.push(`Invalid MOQ "${row.moq || ''}". Minimum order quantity must be >= 1.`);
          }

          const barcodeOrSku = (row.barcode_or_sku || '').trim();
          const rowCondition = (row.condition || 'New').trim();
          if (barcodeOrSku) {
            const normalizedBarcode = barcodeOrSku.toUpperCase();
            const normalizedCondition = rowCondition.toLowerCase();
            const dedupeKey = `${normalizedBarcode}:::${normalizedCondition}`;

            if (seenBarcodes.has(dedupeKey)) {
              const prevRow = seenBarcodes.get(dedupeKey)!;
              rowErrors.push(
                `Duplicate Barcode/SKU "${barcodeOrSku}" with identical condition "${rowCondition}" (already defined on Row ${prevRow}).`
              );
            } else {
              seenBarcodes.set(dedupeKey, rowNumber);
            }
          }

          let images: string[] = [];
          if (row.images) {
            images = row.images
              .split(/[;,|]/)
              .map((url) => url.trim())
              .filter(Boolean);
          }

          // Exact matching for Item Code as in Image 2: uses item_code or barcodeOrSku fallback
          const itemCodeRaw = (row.item_code || '').trim();
          const itemCode =
            itemCodeRaw ||
            (barcodeOrSku && barcodeOrSku !== 'n/a'
              ? barcodeOrSku
              : rowType === 'BUY'
              ? 'WTB-REQ'
              : 'MDL-2026');

          products.push({
            rowNumber,
            type: rowType,
            title,
            brand: (row.brand || 'Other / Generic').trim(),
            category: (row.category || 'Consumer Electronics').trim(),
            itemCode,
            condition: (row.condition || 'New').trim(),
            barcodeOrSku: barcodeOrSku || 'n/a',
            unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
            quantityAvailable: isNaN(quantityAvailable) ? 0 : quantityAvailable,
            moq: isNaN(moq) ? 1 : moq,
            location: (row.location || 'EU').trim(),
            description: (row.description || title).trim(),
            images,
            isValid: rowErrors.length === 0,
            errors: rowErrors,
          });
        });

        setParsedRows(products);
        setCurrentPage(1);
        // Advance directly to Step 2 table preview!
        setCurrentStep(2);
      },
      error: (err) => {
        setIsProcessing(false);
        setHeaderError(`Failed to parse CSV file: ${err.message}`);
        setParsedRows([]);
        setCurrentStep(1);
      },
    });
  };

  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter((r) => r.isValid);
  const errorRows = parsedRows.filter((r) => !r.isValid);
  const hasErrors = errorRows.length > 0;

  const sellRows = validRows.filter((r) => r.type === 'SELL');
  const buyRows = validRows.filter((r) => r.type === 'BUY');

  const displayedRows = useMemo(() => {
    if (filterView === 'valid') return validRows;
    if (filterView === 'errors') return errorRows;
    return parsedRows;
  }, [filterView, parsedRows, validRows, errorRows]);

  // High-performance slicing: renders max 50 items per page by default (or all if selected)
  // Completely eliminates any DOM render delay or scroll jank!
  const totalFiltered = displayedRows.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));

  const paginatedRows = useMemo(() => {
    if (pageSize === -1 || totalFiltered <= pageSize) return displayedRows;
    const start = (currentPage - 1) * pageSize;
    return displayedRows.slice(start, start + pageSize);
  }, [displayedRows, currentPage, pageSize, totalFiltered]);

  const handleConfirmPublish = async () => {
    if (!account || validRows.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Post to bulk API with all valid rows tagged with current type
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: account.id,
          email: account.email,
          companyName: account.name,
          tier: account.membership_tier,
          products: validRows,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to bulk insert listings.');
      }

      // 2. Synchronize Local Storage for immediate client UI reflection
      try {
        if (sellRows.length > 0) {
          const rawLocal = localStorage.getItem('b2b_seller_listings_v3');
          const existingListings = rawLocal ? JSON.parse(rawLocal) : [];
          const newLocalListings = sellRows.map((item, idx) => ({
            id: `admin_imported_${Date.now()}_${idx}`,
            company_id: account.id,
            seller_id: account.id,
            title: item.title,
            brand: item.brand,
            itemCode: item.itemCode || (item.barcodeOrSku !== 'n/a' ? item.barcodeOrSku : `SKU-${Date.now()}-${idx}`),
            condition: item.condition,
            description: item.description,
            ean: item.barcodeOrSku !== 'n/a' ? item.barcodeOrSku : '',
            category: item.category,
            unitPrice: item.unitPrice,
            available: item.quantityAvailable,
            moq: item.moq,
            location: item.location,
            status: 'Active',
            contact_email: account.email,
            images: item.images.length > 0 ? item.images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
          }));

          const combined = [...existingListings, ...newLocalListings];
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(combined));

          const rawAdmin = localStorage.getItem('b2b_admin_listings_v5');
          const existingAdmin = rawAdmin ? JSON.parse(rawAdmin) : [];
          localStorage.setItem('b2b_admin_listings_v5', JSON.stringify([...existingAdmin, ...newLocalListings]));
        }

        if (buyRows.length > 0) {
          localStorage.removeItem('b2b_user_wtb_requests_v1');
          const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
          const existingWtbs = rawWtb ? JSON.parse(rawWtb) : [];
          const newLocalWtbs = buyRows.map((item, idx) => ({
            id: `admin_wtb_imported_${Date.now()}_${idx}`,
            type: 'BUY' as const,
            company_id: account.id,
            companyName: account.name,
            contactEmail: account.email,
            contactName: account.contact_name,
            contactPhone: account.phone || '',
            category: item.category,
            brand: item.brand,
            itemCode: item.itemCode || (item.barcodeOrSku !== 'n/a' ? item.barcodeOrSku : `WTB-${Date.now()}-${idx}`),
            description: item.title || item.description,
            title: item.title,
            ean: item.barcodeOrSku !== 'n/a' ? item.barcodeOrSku : 'n/a',
            qty: item.quantityAvailable,
            available: item.quantityAvailable,
            condition: item.condition,
            price: item.unitPrice,
            unitPrice: item.unitPrice,
            currency: '€',
            location: item.location,
            match: '98%',
            moq: item.moq,
            status: 'Active',
            moderation_status: 'active',
          }));
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify([...existingWtbs, ...newLocalWtbs]));

          const rawAdmin = localStorage.getItem('b2b_admin_listings_v5');
          const existingAdmin = rawAdmin ? JSON.parse(rawAdmin) : [];
          localStorage.setItem('b2b_admin_listings_v5', JSON.stringify([...existingAdmin, ...newLocalWtbs]));
        }
      } catch (err) {
        console.warn('Local storage listing sync warning:', err);
      }

      // 3. Dispatch global sync events
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
      window.dispatchEvent(new CustomEvent('b2b_admin_update'));
      window.dispatchEvent(new CustomEvent('b2b_wtb_created'));
      window.dispatchEvent(new CustomEvent('storage'));

      setSubmissionSuccess({
        total: validRows.length,
        mode: tradeMode,
      });
      if (onSuccess) {
        onSuccess(validRows.length);
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#0B1F3A]/60">
      <div className="relative w-full max-w-6xl bg-white rounded-[18px] sm:rounded-[24px] shadow-xl border border-[#D5DFEC] overflow-hidden flex flex-col h-[92dvh] max-h-[920px]">
        {/* Main Modal Header */}
        <div className="bg-[#0B1F3A] px-4 sm:px-6 py-3.5 text-white flex items-center justify-between border-b border-[#1E3A66] shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A6CFF]/20 border border-[#0A6CFF]/40 text-[#60A5FA] text-[10.5px] font-extrabold uppercase tracking-wider mb-0.5">
              <Package className="w-3.5 h-3.5 text-[#0A6CFF]" />
              <span>Admin Bulk Wholesale Dispatch</span>
            </div>
            <h3 className="text-[18px] font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Upload CSV for</span>
              <span className="text-[#38BDF8] underline decoration-dotted">{account.name}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: CHOOSE TARGET FIELD & SELECT FILE                                */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Account Summary Banner */}
            <div className="bg-[#F8FAFC] px-5 py-3 rounded-2xl border border-[#EAEFF6] flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[#0B1F3A] font-bold">
                  <Building2 className="w-4 h-4 text-[#0A6CFF]" />
                  <span>{account.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#5B6B82]">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{account.email}</span>
                </div>
                <div className="text-[#8A9BB0]">
                  Contact: <strong className="text-[#0B1F3A]">{account.contact_name}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Tier: {account.membership_tier}
                </span>
                <a
                  href={tradeMode === 'WTS' ? '/sample-b2b-products.csv' : '/sample-b2b-wtb-requests.csv'}
                  download={tradeMode === 'WTS' ? 'sample-b2b-wts-sell-offers.csv' : 'sample-b2b-wtb-buy-requests.csv'}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-50 border border-[#D5DFEC] text-[#0B1F3A] text-[12px] font-bold transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#0A6CFF]" />
                  <span>Download Sample {tradeMode} CSV</span>
                </a>
              </div>
            </div>

            {/* Target Field Selection Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-extrabold uppercase text-[#0B1F3A] tracking-wider">
                  Step 1: Choose Target Field
                </label>
                <span className="text-[11.5px] text-[#5B6B82]">
                  Whatever spreadsheet you upload will be published directly into this field.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* WTS Card */}
                <button
                  type="button"
                  onClick={() => handleModeChange('WTS')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex items-start gap-3.5 ${
                    tradeMode === 'WTS'
                      ? 'border-[#0A6CFF] bg-[#F0F7FF] shadow-xs'
                      : 'border-[#D5DFEC] bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      tradeMode === 'WTS' ? 'bg-[#0A6CFF] text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[14.5px] text-[#0B1F3A]">WTS (Sell Offers)</span>
                      {tradeMode === 'WTS' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0A6CFF] text-white uppercase tracking-wider">
                          Active Selection
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#5B6B82] mt-0.5 leading-snug">
                      Upload available wholesale supply stock. All rows are published as active seller listings in the marketplace catalog.
                    </p>
                  </div>
                </button>

                {/* WTB Card */}
                <button
                  type="button"
                  onClick={() => handleModeChange('WTB')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex items-start gap-3.5 ${
                    tradeMode === 'WTB'
                      ? 'border-[#16A34A] bg-[#F0FDF4] shadow-xs'
                      : 'border-[#D5DFEC] bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      tradeMode === 'WTB' ? 'bg-[#16A34A] text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[14.5px] text-[#0B1F3A]">WTB (Buy Requirements)</span>
                      {tradeMode === 'WTB' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#16A34A] text-white uppercase tracking-wider">
                          Active Selection
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#5B6B82] mt-0.5 leading-snug">
                      Upload procurement & sourcing demands. All rows are published as Want-To-Buy requirements on the Live Trading Board.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Error Message in Step 1 if any */}
            {headerError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-[13px] text-red-900">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-red-950">CSV Header Validation Failed:</strong>
                  <p className="mt-0.5 leading-relaxed">{headerError}</p>
                  <div className="mt-2">
                    <a
                      href={tradeMode === 'WTS' ? '/sample-b2b-products.csv' : '/sample-b2b-wtb-requests.csv'}
                      download={tradeMode === 'WTS' ? 'sample-b2b-wts-sell-offers.csv' : 'sample-b2b-wtb-buy-requests.csv'}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-red-800 underline hover:text-red-950"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {tradeMode} sample CSV template</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Dropzone */}
            <div className="space-y-2">
              <label className="block text-[12.5px] font-extrabold uppercase text-[#0B1F3A] tracking-wider">
                Step 2: Select or Drop CSV File for {tradeMode === 'WTS' ? 'Sell Offers (WTS)' : 'Buy Requirements (WTB)'}
              </label>

              <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#0A6CFF] rounded-2xl p-8 text-center bg-[#F8FAFC]/50 hover:bg-[#F0F7FF]/30 transition group cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center pointer-events-none">
                  <div
                    className={`w-12 h-12 rounded-xl bg-white border border-[#EAEFF6] shadow-xs flex items-center justify-center mb-2.5 ${
                      tradeMode === 'WTS' ? 'text-[#0A6CFF]' : 'text-[#16A34A]'
                    }`}
                  >
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-[15px] font-bold text-[#0B1F3A]">
                    {file ? `Selected: ${file.name}` : `Click to select or drag and drop your ${tradeMode} CSV`}
                  </p>
                  <p className="text-[12px] text-[#5B6B82] mt-1 max-w-md">
                    No &quot;type&quot; column required in your spreadsheet. All lines will be assigned to{' '}
                    <strong>{tradeMode === 'WTS' ? 'WTS (Sell Offers)' : 'WTB (Buy Requirements)'}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Previously uploaded file quick resume if present */}
            {file && parsedRows.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-[13px]">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-emerald-950 font-bold">{file.name}</strong> is loaded with{' '}
                    <span className="font-bold">{parsedRows.length} items</span> ({validRows.length} valid).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>Continue to Table Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: FULL-SPACE TABLE PREVIEW & PUBLISH                               */}
        {/* Pure native table: No backdrop blur, no transform layers, no lag!       */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 space-y-2.5 overflow-hidden">
            {/* Step 2 Clean Top Navigation & Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#F8FAFC] px-3.5 py-2 rounded-xl border border-[#EAEFF6] shrink-0 text-[12.5px]">
              {/* Left: Back button + File Name + Field Badge */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-[11.5px] font-bold text-[#0B1F3A] transition cursor-pointer shadow-2xs"
                  title="Return to Step 1 to change target field or re-upload file"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#0A6CFF]" />
                  <span>Back / Re-upload</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-[#0B1F3A]">{file?.name}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({totalRows} items)
                  </span>
                </div>

                <span
                  className={`text-[10.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                    tradeMode === 'WTS'
                      ? 'bg-[#E0F2FE] text-[#0284C7] border border-sky-300'
                      : 'bg-[#DCFCE7] text-[#15803D] border border-emerald-300'
                  }`}
                >
                  Field: {tradeMode === 'WTS' ? 'WTS (Sell)' : 'WTB (Buy)'}
                </span>
              </div>

              {/* Right: Quick Switch Field & Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleModeChange(tradeMode === 'WTS' ? 'WTB' : 'WTS')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B1F3A] text-[11.5px] font-bold transition cursor-pointer shadow-2xs"
                  title="Switch all lines between WTS and WTB"
                >
                  <RefreshCw className="w-3 h-3 text-[#0A6CFF]" />
                  <span>Switch all to {tradeMode === 'WTS' ? 'WTB (Buy)' : 'WTS (Sell)'}</span>
                </button>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded-full text-[11.5px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterView('all');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                      filterView === 'all'
                        ? 'bg-white text-[#0B1F3A] shadow-2xs'
                        : 'text-[#5B6B82] hover:text-[#0B1F3A]'
                    }`}
                  >
                    All ({totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterView('valid');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                      filterView === 'valid'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'text-[#5B6B82] hover:text-[#0B1F3A]'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  {errorRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterView('errors');
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                        filterView === 'errors'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-amber-700 hover:text-amber-900'
                      }`}
                    >
                      Issues ({errorRows.length})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Submission / Error feedback banners */}
            {submissionSuccess !== null && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-[12.5px] text-emerald-900 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <strong className="font-bold text-emerald-950">Success!</strong>
                  <span className="ml-1">
                    Successfully published {submissionSuccess.total}{' '}
                    {submissionSuccess.mode === 'WTS' ? 'Sell Offers' : 'Buy Requirements'} for {account.name}.
                  </span>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-[12.5px] text-red-900 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <div>
                  <strong className="font-bold text-red-950">Error during publish:</strong>
                  <span className="ml-1">{submitError}</span>
                </div>
              </div>
            )}

            {/* Table Preview: Exact 10 columns matching Image 2 */}
            {/* Native 60fps scrolling without content-visibility or will-change thrashing */}
            <div className="flex-1 min-h-0 bg-white rounded-xl border border-[#CBD5E1] shadow-2xs overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:thin]">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-[#F8FAFC] z-10 border-b border-[#E2E8F0] text-[11px] font-extrabold uppercase tracking-wider text-[#475569] shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3.5 whitespace-nowrap w-[80px]">BUY/SELL</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">CATEGORY</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">BRAND</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ITEM CODE</th>
                      <th className="py-2.5 px-3">DESCRIPTION</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">EAN/UPC</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right">QTY</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">CONDITION</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right">PRICE</th>
                      <th className="py-2.5 px-3.5 whitespace-nowrap text-center">LOCATION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-[#64748B] text-[13px]">
                          No items matching the selected filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <tr
                            key={row.rowNumber}
                            className={
                              !row.isValid
                                ? 'bg-red-50/70 hover:bg-red-100/70 text-red-950'
                                : isEven
                                ? 'bg-white hover:bg-[#F0F7FF]/70'
                                : 'bg-[#FAFCFE] hover:bg-[#F0F7FF]/70'
                            }
                          >
                            {/* 1. BUY/SELL Pill: Exact match to Image 2 (Clean pill, no row # clutter) */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleRowType(row.rowNumber)}
                                title="Click to toggle BUY / SELL"
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                                  row.type === 'BUY'
                                    ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-emerald-200'
                                    : 'bg-[#E0F2FE] text-[#0284C7] hover:bg-sky-200'
                                }`}
                              >
                                {row.type}
                              </button>
                            </td>

                            {/* 2. CATEGORY */}
                            <td className="py-2.5 px-3 text-[12.5px] text-[#475569] whitespace-nowrap">
                              {row.category}
                            </td>

                            {/* 3. BRAND (Bold) */}
                            <td className="py-2.5 px-3 text-[13px] font-extrabold text-[#0B1F3A] whitespace-nowrap">
                              {row.brand}
                            </td>

                            {/* 4. ITEM CODE (Mono gray font) */}
                            <td className="py-2.5 px-3 text-[11.5px] font-mono text-[#64748B] whitespace-nowrap">
                              {row.itemCode}
                            </td>

                            {/* 5. DESCRIPTION (Bold text) */}
                            <td className="py-2.5 px-3 text-[13px] font-bold text-[#0B1F3A]">
                              <div
                                className="truncate max-w-[260px] sm:max-w-[340px]"
                                title={row.title || row.description}
                              >
                                {row.title || row.description}
                              </div>
                            </td>

                            {/* 6. EAN/UPC */}
                            <td className="py-2.5 px-3 text-[11.5px] font-mono text-[#64748B] whitespace-nowrap">
                              {row.barcodeOrSku && row.barcodeOrSku !== 'n/a' ? row.barcodeOrSku : 'n/a'}
                            </td>

                            {/* 7. QTY (Bold black font, right-aligned) */}
                            <td className="py-2.5 px-3 text-[13px] font-black text-[#0B1F3A] whitespace-nowrap text-right">
                              {row.quantityAvailable.toLocaleString()}
                            </td>

                            {/* 8. CONDITION */}
                            <td className="py-2.5 px-3 text-[12.5px] text-[#475569] whitespace-nowrap">
                              {row.condition}
                            </td>

                            {/* 9. PRICE (Bold font with €, right-aligned) */}
                            <td className="py-2.5 px-3 text-[13.5px] font-black text-[#0B1F3A] whitespace-nowrap text-right">
                              {row.unitPrice > 0 ? (
                                `€${row.unitPrice.toFixed(2)}`
                              ) : (
                                <span className="text-red-500 font-bold">Invalid</span>
                              )}
                            </td>

                            {/* 10. LOCATION (Clean uppercase badge, centered) */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] text-[10.5px] font-mono font-bold uppercase">
                                {row.location}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Lightweight Pagination Toolbar */}
              {totalFiltered > 50 && (
                <div className="bg-[#F8FAFC] px-4 py-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11.5px] text-[#64748B] shrink-0">
                  <div className="flex items-center gap-2">
                    <span>
                      Showing {pageSize === -1 ? `all ${totalFiltered}` : `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalFiltered)} of ${totalFiltered}`} items
                    </span>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setPageSize(pageSize === 50 ? -1 : 50)}
                      className="font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                    >
                      {pageSize === 50 ? `Show all ${totalFiltered}` : 'Show 50 per page'}
                    </button>
                  </div>

                  {pageSize !== -1 && totalPages > 1 && (
                    <div className="flex items-center gap-1.5 font-bold">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[#0B1F3A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>
                      <span className="px-2 text-[#0B1F3A]">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[#0B1F3A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer shadow-2xs"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="bg-[#F8FAFC] px-6 py-3.5 border-t border-[#EAEFF6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-[#5B6B82] flex items-center gap-3">
            {currentStep === 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-[11.5px] font-bold text-[#0B1F3A] flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Step 1: Settings</span>
                </button>
                <span>
                  Ready: <strong className="text-emerald-700">{validRows.length} valid</strong> of {totalRows} items as{' '}
                  <strong className={tradeMode === 'WTS' ? 'text-[#0A6CFF]' : 'text-[#16A34A]'}>
                    {tradeMode === 'WTS' ? 'WTS (Sell Offers)' : 'WTB (Buy Requirements)'}
                  </strong>
                </span>
              </>
            ) : (
              <span>Select destination field and wholesale CSV file</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-[#0B1F3A] border border-[#D5DFEC] text-[12.5px] font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Cancel
            </button>

            {currentStep === 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!file || validRows.length === 0}
                className="px-5 py-2 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12.5px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Continue to Table Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isSubmitting || validRows.length === 0}
                className={`px-5 py-2 rounded-full text-white text-[12.5px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
                  tradeMode === 'WTS' ? 'bg-[#0A6CFF] hover:bg-[#0857CF]' : 'bg-[#16A34A] hover:bg-emerald-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing {tradeMode} Listings...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {tradeMode === 'WTS'
                        ? `Publish All ${validRows.length} WTS Sell Offers to ${account.name}`
                        : `Publish All ${validRows.length} WTB Buy Requirements to ${account.name}`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
