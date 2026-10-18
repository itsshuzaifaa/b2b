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
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { AdminClientAccount } from '@/lib/admin/admin-store';

export interface ParsedCsvProduct {
  rowNumber: number;
  title: string;
  brand: string;
  category: string;
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
  onSuccess?: (insertedCount: number) => void;
}

function normalizeHeader(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
  switch (cleaned) {
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
    case 'barcode_or_sku':
    case 'barcode':
    case 'sku':
    case 'ean':
    case 'upc':
    case 'item_code':
      return 'barcode_or_sku';
    case 'condition':
    case 'grade':
    case 'state':
      return 'condition';
    case 'unit_price':
    case 'price':
    case 'cost':
    case 'wholesale_price':
      return 'unit_price';
    case 'quantity_available':
    case 'quantity':
    case 'qty':
    case 'stock':
    case 'available':
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
  onSuccess,
}: AdminBulkCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvProduct[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'errors'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setParsedRows([]);
      setHeaderError(null);
      setFilterView('all');
      setIsProcessing(false);
      setIsSubmitting(false);
      setSubmissionSuccess(null);
      setSubmitError(null);
    }
  }, [isOpen]);

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
        if (!headers.includes('unit_price')) missingHeaders.push('unit_price (or price)');
        if (!headers.includes('quantity_available'))
          missingHeaders.push('quantity_available (or quantity / qty)');

        if (missingHeaders.length > 0) {
          setHeaderError(
            `Formatting Error: Missing required column(s): ${missingHeaders.join(', ')}. Please use our sample CSV template.`
          );
          setParsedRows([]);
          return;
        }

        const seenBarcodes = new Map<string, number>();
        const products: ParsedCsvProduct[] = [];

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
          if (barcodeOrSku) {
            const normalizedBarcode = barcodeOrSku.toUpperCase();
            if (seenBarcodes.has(normalizedBarcode)) {
              const prevRow = seenBarcodes.get(normalizedBarcode)!;
              rowErrors.push(
                `Duplicate Barcode/SKU "${barcodeOrSku}" (already defined on Row ${prevRow}).`
              );
            } else {
              seenBarcodes.set(normalizedBarcode, rowNumber);
            }
          }

          let images: string[] = [];
          if (row.images) {
            images = row.images
              .split(/[;,|]/)
              .map((url) => url.trim())
              .filter(Boolean);
          }

          products.push({
            rowNumber,
            title,
            brand: (row.brand || 'Other / Generic').trim(),
            category: (row.category || 'Consumer Electronics').trim(),
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
      },
      error: (err) => {
        setIsProcessing(false);
        setHeaderError(`Failed to parse CSV file: ${err.message}`);
        setParsedRows([]);
      },
    });
  };

  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter((r) => r.isValid);
  const errorRows = parsedRows.filter((r) => !r.isValid);
  const hasErrors = errorRows.length > 0;

  const displayedRows = useMemo(() => {
    if (filterView === 'valid') return validRows;
    if (filterView === 'errors') return errorRows;
    return parsedRows;
  }, [filterView, parsedRows, validRows, errorRows]);

  const handleConfirmPublish = async () => {
    if (!account || validRows.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Post to bulk API
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: account.id,
          products: validRows,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to bulk insert products.');
      }

      // 2. Synchronize Local Storage for immediate client UI reflection
      try {
        const rawLocal = localStorage.getItem('b2b_seller_listings_v3');
        const existingListings = rawLocal ? JSON.parse(rawLocal) : [];
        const newLocalListings = validRows.map((item, idx) => ({
          id: `admin_imported_${Date.now()}_${idx}`,
          company_id: account.id,
          seller_id: account.id,
          title: item.title,
          brand: item.brand,
          itemCode: item.barcodeOrSku !== 'n/a' ? item.barcodeOrSku : `SKU-${Date.now()}-${idx}`,
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

        // Sync admin listings
        const rawAdmin = localStorage.getItem('b2b_admin_listings_v5');
        const existingAdmin = rawAdmin ? JSON.parse(rawAdmin) : [];
        localStorage.setItem('b2b_admin_listings_v5', JSON.stringify([...existingAdmin, ...newLocalListings]));
      } catch (err) {
        console.warn('Local storage listing sync warning:', err);
      }

      // 3. Dispatch global sync events
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
      window.dispatchEvent(new CustomEvent('b2b_admin_update'));

      setSubmissionSuccess(validRows.length);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl border border-[#EAEFF6] overflow-hidden flex flex-col h-[90vh] max-h-[900px] isolate transform-gpu">
        {/* Header */}
        <div className="bg-[#0B1F3A] px-7 py-5 text-white flex items-center justify-between border-b border-[#1E3A66] shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#0A6CFF]/20 border border-[#0A6CFF]/40 text-[#60A5FA] text-[11px] font-extrabold uppercase tracking-wider mb-1">
              <Package className="w-3.5 h-3.5 text-[#0A6CFF]" />
              <span>Admin Bulk Inventory Dispatch</span>
            </div>
            <h3 className="text-[20px] font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Upload Bulk CSV for</span>
              <span className="text-[#38BDF8] underline decoration-dotted">{account.name}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Seller Overview Banner - only visible before upload */}
        {(!file || totalRows === 0) && (
          <div className="bg-[#F8FAFC] px-7 py-3 border-b border-[#EAEFF6] flex flex-wrap items-center justify-between gap-3 shrink-0 text-[13px]">
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
                href="/sample-b2b-products.csv"
                download="sample-b2b-products.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-50 border border-[#D5DFEC] text-[#0B1F3A] text-[12px] font-bold transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#0A6CFF]" />
                <span>Download Official Sample CSV (50 Products)</span>
              </a>
            </div>
          </div>
        )}

        {/* Modal Body: Non-scrolling flex container when table is present to avoid double scroll jank */}
        <div className={`p-6 flex-1 min-h-0 flex flex-col space-y-4 ${totalRows > 0 ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {/* File Upload Area - only shown before file is loaded */}
          {!file || totalRows === 0 ? (
            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                Select or Drop Wholesale CSV File
              </label>
              <div className="border-2 border-dashed border-[#D5DFEC] hover:border-[#0A6CFF] rounded-2xl p-8 text-center bg-[#F8FAFC]/50 hover:bg-[#F0F7FF]/30 transition group cursor-pointer relative">
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
                  <div className="w-14 h-14 rounded-2xl bg-white text-[#0A6CFF] border border-[#EAEFF6] shadow-xs flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="text-[15px] font-bold text-[#0B1F3A]">
                    Click to select or drag and drop your inventory CSV
                  </p>
                  <p className="text-[12px] text-[#5B6B82] mt-1">
                    Supports title, brand, category, condition, unit_price, quantity_available, moq, and barcode/SKU
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Uploaded File Compact Header Bar */
            <div className="flex items-center justify-between bg-[#F8FAFC] px-4 py-2.5 rounded-2xl border border-[#EAEFF6] text-[13px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0A6CFF]/10 text-[#0A6CFF] flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0B1F3A]">{file.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ({(file.size / 1024).toFixed(1)} KB · {totalRows} products detected)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6B82]">
                    Loaded for <strong className="text-[#0B1F3A]">{account.name}</strong> ({account.email})
                  </div>
                </div>
              </div>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-[#D5DFEC] text-[#0B1F3A] text-[12px] font-bold transition cursor-pointer shadow-2xs">
                <UploadCloud className="w-3.5 h-3.5 text-[#0A6CFF]" />
                <span>Upload Different CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Top-Level Header Error Alert */}
          {headerError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-[13px] text-red-900 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-950">CSV Header Validation Failed:</strong>
                <p className="mt-0.5 leading-relaxed">{headerError}</p>
                <div className="mt-2">
                  <a
                    href="/sample-b2b-products.csv"
                    download="sample-b2b-products.csv"
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-red-800 underline hover:text-red-950"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download standard sample CSV template with correct headers</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Row Validation Errors Alert */}
          {hasErrors && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-amber-950 animate-in fade-in space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <strong className="font-bold text-amber-900">
                    CSV Formatting Issues Detected ({errorRows.length} rows with errors)
                  </strong>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  {validRows.length} listings ready to publish without issues
                </span>
              </div>
              <p className="text-[12px] text-amber-800 leading-relaxed">
                You can proceed to publish the <strong>{validRows.length} valid listings</strong> directly. The {errorRows.length} row(s) with formatting issues will be safely skipped:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-white/80 p-3 rounded-xl border border-amber-200/70 text-[12px] font-mono text-amber-900">
                {errorRows.map((row) => (
                  <div key={row.rowNumber} className="flex items-start gap-2">
                    <span className="font-bold text-amber-700 shrink-0">Row {row.rowNumber}:</span>
                    <span>{row.errors.join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Validation Alert */}
          {!hasErrors && totalRows > 0 && !headerError && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-[13px] text-emerald-900 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-950">CSV Validated Successfully!</strong>
                <p className="text-[12px] text-emerald-800 mt-0.5">
                  All {validRows.length} products passed validation with no formatting issues and are ready to publish.
                </p>
              </div>
            </div>
          )}

          {/* Submission Feedback */}
          {submissionSuccess !== null && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-[13px] text-emerald-900 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-950">Success!</strong>
                <span className="ml-1">
                  Successfully imported and published {submissionSuccess} wholesale listings for {account.name}.
                </span>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-[13px] text-red-900 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <strong className="font-bold text-red-950">Error during import:</strong>
                <span className="ml-1">{submitError}</span>
              </div>
            </div>
          )}

          {/* CSV Table Preview */}
          {totalRows > 0 && (
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[14px] font-extrabold text-[#0B1F3A]">
                    Parsed Table Preview ({totalRows} rows detected)
                  </h4>
                  {hasErrors ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      {errorRows.length} with issues
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>All {validRows.length} rows valid</span>
                    </span>
                  )}
                </div>

                {/* Filter View Buttons */}
                <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-full text-[12px] font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      filterView === 'all'
                        ? 'bg-white text-[#0B1F3A] shadow-2xs'
                        : 'text-[#5B6B82] hover:text-[#0B1F3A]'
                    }`}
                  >
                    All ({totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('valid')}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      filterView === 'valid'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-[#5B6B82] hover:text-emerald-700'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  {errorRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterView('errors')}
                      className={`px-3 py-1 rounded-full transition cursor-pointer ${
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

              {/* Scrollable Preview Table */}
              <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#EAEFF6] shadow-2xs overflow-hidden flex flex-col">
                <div
                  className="flex-1 min-h-0 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-width:thin]"
                  style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
                >
                  <table className="w-full min-w-[960px] text-left border-collapse text-[12px] table-fixed">
                    <thead className="sticky top-0 bg-[#F8FAFC] z-20 border-b border-[#EAEFF6] text-[10px] font-bold uppercase tracking-wider text-[#8A9BB0] shadow-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-14">Row</th>
                        <th className="py-2.5 px-3 w-24">Status</th>
                        <th className="py-2.5 px-3 w-64">Title</th>
                        <th className="py-2.5 px-3 w-32">Brand</th>
                        <th className="py-2.5 px-3 w-40">Category</th>
                        <th className="py-2.5 px-3 w-20">Condition</th>
                        <th className="py-2.5 px-3 w-24">Unit Price</th>
                        <th className="py-2.5 px-3 w-16">Qty</th>
                        <th className="py-2.5 px-3 w-16">MOQ</th>
                        <th className="py-2.5 px-3 w-20">Location</th>
                        <th className="py-2.5 px-3 w-36">Barcode / SKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-400">
                            No rows matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={`transition-colors duration-75 ${
                              !row.isValid
                                ? 'bg-red-50/50 hover:bg-red-50'
                                : 'hover:bg-[#F8FAFC]'
                            }`}
                            style={{
                              contentVisibility: 'auto',
                              containIntrinsicSize: 'auto 40px',
                            }}
                          >
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-400 font-bold">
                              #{row.rowNumber}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Valid</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full cursor-help"
                                  title={row.errors.join(' | ')}
                                >
                                  <AlertCircle className="w-3 h-3 text-red-600" />
                                  <span>Issue</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-bold text-[#0B1F3A] truncate" title={row.title}>
                              {row.title || <span className="text-red-500 italic">Missing title</span>}
                            </td>
                            <td className="py-2 px-3 text-[#5B6B82] truncate">
                              {row.brand}
                            </td>
                            <td className="py-2 px-3 text-[#5B6B82] truncate">
                              {row.category}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-[#0B1F3A]">
                                {row.condition}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-[#0B1F3A] whitespace-nowrap">
                              {row.unitPrice > 0 ? (
                                `€${row.unitPrice.toFixed(2)}`
                              ) : (
                                <span className="text-red-500 font-bold">Invalid</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-[#0B1F3A] whitespace-nowrap">
                              {row.quantityAvailable}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                              {row.moq}
                            </td>
                            <td className="py-2 px-3 font-bold text-[#0A6CFF] whitespace-nowrap">
                              {row.location}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500 truncate" title={row.barcodeOrSku}>
                              {row.barcodeOrSku}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F8FAFC] px-7 py-4 border-t border-[#EAEFF6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-[#5B6B82]">
            {totalRows > 0 ? (
              <span>
                Ready: <strong className="text-emerald-700">{validRows.length} valid</strong> of {totalRows} products
                {hasErrors && (
                  <span className="text-amber-700 font-semibold ml-1.5">
                    ({errorRows.length} with issues will be excluded)
                  </span>
                )}
              </span>
            ) : (
              <span>Select a CSV file to inspect and preview listings</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-[#0B1F3A] border border-[#D5DFEC] text-[13px] font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmPublish}
              disabled={isSubmitting || validRows.length === 0}
              className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[13px] font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing Listings...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {hasErrors
                      ? `Publish ${validRows.length} Valid Listings to ${account.name}`
                      : `Publish All ${validRows.length} Listings to ${account.name}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
