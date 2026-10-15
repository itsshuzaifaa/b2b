'use client';

import React, { useState } from 'react';
import { importProductsFromCsv, type CsvRowError } from '@/lib/importers/csv-product-importer';
import { useAuth } from '@/lib/auth/auth-context';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Download, ShieldAlert } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const { company } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<CsvRowError[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const isBronze = company?.membership_tier === 'bronze';
  const isPending = company?.approval_status !== 'approved';

  const downloadSampleCsv = () => {
    const csvContent =
      'title,category_slug,barcode_or_sku,unit_price,quantity_available,moq,description,images\n' +
      '"Apple AirPods Pro 2nd Gen USB-C","consumer-electronics","0195949052553",149.00,120,10,"EU retail master cartons. Full Apple warranty.","https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800"\n' +
      '"Philips Sonicare DiamondClean 9000","health-fmcg","8710103986000",78.50,300,25,"Original factory sealed lots. EU plug.","https://images.unsplash.com/photo-1559599101-f09722fb4948?w=800"';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'b2b_link_catalog_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setGeneralError(null);
      setRowErrors([]);
      setSuccessCount(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setGeneralError('Please select a CSV file first.');
      return;
    }
    if (!company) {
      setGeneralError('Company session not found.');
      return;
    }

    setIsProcessing(true);
    setGeneralError(null);
    setRowErrors([]);
    setSuccessCount(null);

    try {
      const text = await file.text();
      const result = await importProductsFromCsv({
        companyId: company.id,
        csvContent: text,
      });

      if (result.success) {
        setSuccessCount(result.insertedCount);
        if (onSuccess) onSuccess();
      } else {
        if (result.errors.length > 0) {
          setRowErrors(result.errors);
        } else {
          setGeneralError('Failed to import CSV.');
        }
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to process file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0B132B] px-6 py-4 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
              Bulk Inventory Manager
            </span>
            <h3 className="text-base font-bold text-white">Upload Catalog via CSV</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isBronze && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Silver / Gold Tier Required:</strong>
                <p className="mt-0.5 leading-relaxed">
                  Bulk CSV catalog uploads are enabled for Silver (up to 50 active items) and Gold (unlimited items). Please upgrade your tier in the membership portal.
                </p>
              </div>
            </div>
          )}

          {isPending && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Account Pending Activation:</strong>
                <p className="mt-0.5 leading-relaxed">
                  You cannot publish catalog listings until Jeff activates your seller credentials upon Wise receipt.
                </p>
              </div>
            </div>
          )}

          {successCount !== null ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Inventory Imported Successfully!</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {successCount} new products have been inserted into your active catalog and are live on the marketplace.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-xl bg-[#0066FF] text-white text-xs font-semibold shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {generalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Sample Template Callout */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-950 font-medium">
                  <FileText className="w-4 h-4 text-[#0066FF]" />
                  <span>Need the standard CSV header format?</span>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="flex items-center gap-1.5 bg-white text-[#0066FF] hover:bg-blue-100/60 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sample .CSV</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-[#0066FF] rounded-2xl p-6 text-center transition group bg-slate-50/50">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isBronze || isPending}
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center group-hover:scale-105 transition">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      {file ? file.name : 'Click to select or drag CSV file here'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Required: title, category_slug, barcode_or_sku, unit_price, quantity_available, moq
                    </p>
                  </div>
                </label>
              </div>

              {/* Row Errors Breakdown if any */}
              {rowErrors.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 max-h-48 overflow-y-auto space-y-2">
                  <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Validation Errors ({rowErrors.length} found):</span>
                  </div>
                  <ul className="text-xs text-red-800 space-y-1 pl-5 list-disc">
                    {rowErrors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || isProcessing || isBronze || isPending}
                  className="flex items-center gap-1.5 bg-[#0066FF] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm transition"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Validating & Inserting...' : 'Upload & Process'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
