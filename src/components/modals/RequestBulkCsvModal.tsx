'use client';

import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Mail,
  CheckCircle2,
  Sparkles,
  Copy,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type { Company } from '@/types/database';

interface RequestBulkCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
}

export function RequestBulkCsvModal({ isOpen, onClose, company }: RequestBulkCsvModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const supportEmail = 'catalog@b2blink.eu';
  const companyName = company?.name || company?.company_name || 'My Wholesale Company';
  const senderEmail = company?.email || '';

  const emailSubject = encodeURIComponent(`Bulk CSV Catalog Upload Request - ${companyName}`);
  const emailBody = encodeURIComponent(
    `Hello B2B Link Catalog Operations Team,\n\n` +
      `We would like to request a bulk wholesale catalog upload for our Gold member account.\n\n` +
      `Account / Company: ${companyName}\n` +
      `Registered Email: ${senderEmail}\n\n` +
      `Please find our inventory CSV attached formatted according to the official B2B Link template.\n\n` +
      `Thank you,\n` +
      `${company?.contact_name || companyName}`
  );

  const mailtoLink = `mailto:${supportEmail}?subject=${emailSubject}&body=${emailBody}`;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Gold accents */}
        <div className="relative bg-gradient-to-r from-[#0B1F3A] via-[#11294D] to-[#0B1F3A] px-7 py-6 text-white shrink-0 overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-6 w-48 h-48 bg-[#E5A638]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5A638]/20 border border-[#E5A638]/40 text-[#F5C26B] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#E5A638]" />
                <span>Gold Member Concierge Service</span>
              </div>
              <h3 className="text-[22px] font-extrabold text-white tracking-tight leading-snug">
                Request Bulk CSV Inventory Upload
              </h3>
              <p className="text-[13px] text-slate-300 mt-1 max-w-lg leading-relaxed">
                Our catalog specialists format, verify, and publish your wholesale lots on your behalf to guarantee maximum visibility and zero formatting errors.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-7 overflow-y-auto space-y-6">
          {/* Step-by-Step Guide */}
          <div>
            <h4 className="text-[13px] font-bold text-[#8A9BB0] uppercase tracking-wider mb-3">
              How the Bulk Upload Process Works
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-[#0A6CFF] font-black text-[12px] flex items-center justify-center mb-2.5">
                    1
                  </div>
                  <h5 className="font-bold text-[14px] text-[#0B1F3A] mb-1">Download Template</h5>
                  <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                    Get our official sample CSV spreadsheet with standard wholesale headers.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 font-black text-[12px] flex items-center justify-center mb-2.5">
                    2
                  </div>
                  <h5 className="font-bold text-[14px] text-[#0B1F3A] mb-1">Fill Your Products</h5>
                  <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                    Include Title, Price, Quantity, MOQ, Condition, and EAN/SKU for each item.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 font-black text-[12px] flex items-center justify-center mb-2.5">
                    3
                  </div>
                  <h5 className="font-bold text-[14px] text-[#0B1F3A] mb-1">Email To Us</h5>
                  <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                    Send the file to our dedicated catalog desk. We publish it in 2–4 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Recipient Card */}
          <div className="p-5 rounded-2xl bg-[#F3F6FB] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Mail className="w-5 h-5 text-[#E5A638]" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0]">
                  Official Catalog Operations Desk
                </div>
                <div className="font-mono font-bold text-[15px] text-[#0B1F3A] mt-0.5">
                  {supportEmail}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5B6B82] mt-0.5">
                  <Clock className="w-3 h-3 text-[#0A6CFF]" />
                  <span>Turnaround: 2–4 hours during European business hours</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0B1F3A] border border-[#D5DFEC] text-[12px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>

              <a
                href={mailtoLink}
                className="px-4 py-2 rounded-xl bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Mail className="w-4 h-4" />
                <span>Open Mail App</span>
              </a>
            </div>
          </div>

          {/* Gold Concierge Perks callout */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-[12px] text-amber-950">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-[#0B1F3A]">Why we do manual verification:</strong>
              <p className="text-slate-600 leading-relaxed">
                To keep the B2B Link marketplace 100% free of dead links, corrupted barcodes, and duplicate rows, our catalog team runs automated and manual data cleansing for all Gold supplier inventory files before broadcasting.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F8FAFC] px-7 py-4 border-t border-[#EAEFF6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <a
            href="/sample-b2b-products.csv"
            download="sample-b2b-products.csv"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-[#0B1F3A] border border-[#D5DFEC] text-[13px] font-bold transition cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#0A6CFF]" />
            <span>Download Sample CSV (50 Products)</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[#0B1F3A] hover:bg-[#163056] text-white text-[13px] font-bold transition cursor-pointer shadow-xs"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
