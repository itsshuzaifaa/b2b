'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProductInquiry } from '@/lib/actions/inquiries';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import { useAuth } from '@/lib/auth/auth-context';
import type { Product } from '@/types/database';
import { X, CheckCircle2, AlertCircle, Send, Mail, MessageSquare, Clock, Phone, Building2 } from 'lucide-react';

interface InquiryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function InquiryDialogContent({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { company } = useAuth();
  const [targetQuantity, setTargetQuantity] = useState<number>(product.moq || 20);
  const [unitPrice, setUnitPrice] = useState<string>(product.unit_price ? String(product.unit_price) : '');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdConvId, setCreatedConvId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Supplier contact resolution
  const supplierName = product.company?.contact_name || product.company?.name || 'Verified Supplier';
  const supplierCompany = product.company?.name || 'Authorized Wholesaler';
  const supplierEmail = product.company?.email || 'supplier@b2blink.eu';
  const supplierPhone = (product.company as any)?.phone || '';

  const parsedPrice = parseFloat(unitPrice) || product.unit_price || 0;
  const estimatedTotal = (parsedPrice * targetQuantity).toFixed(2);

  // Email subject & body for direct email button
  const emailSubject = encodeURIComponent(`Wholesale Inquiry: ${product.title} [B2B LINK]`);
  const emailBody = encodeURIComponent(
    `Hello ${supplierName},\n\nI am contacting you regarding your wholesale stock of "${product.title}" listed on B2B LINK.\n\n` +
      `Our Requirements:\n` +
      `- Target Quantity: ${targetQuantity} units (MOQ: ${product.moq})\n` +
      `- Proposed Unit Price: £${parsedPrice.toFixed(2)} GBP\n` +
      `- Estimated Deal Value: £${estimatedTotal} GBP\n` +
      `- Lead Time Requested: ${leadTimeDays} business days\n\n` +
      `${notes ? `Additional Terms / Notes:\n${notes}\n\n` : ''}` +
      `Please let us know your current availability and payment/dispatch terms.\n\n` +
      `Best regards,\n${company?.contact_name || company?.name || 'Commercial Buyer'}\n` +
      `${company?.name || ''}\n${company?.email || ''}\n${company?.phone || ''}`
  );

  const handleDirectChat = () => {
    const defaultMsg = `Hi, I am interested in ordering ${targetQuantity} units of "${product.title}" at £${parsedPrice.toFixed(2)} / unit. Lead time: ${leadTimeDays} days. ${notes ? `Notes: ${notes}` : ''}`;
    const conv = startMarketplaceInquiry(
      product,
      company,
      company?.contact_name || company?.name || 'Commercial Buyer',
      company?.email || '',
      company?.phone || '',
      defaultMsg
    );
    onClose();
    router.push(`/dashboard/inquiries?id=${conv.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (targetQuantity < product.moq) {
      setErrorMsg(`Target volume cannot be below the Minimum Order Quantity (MOQ: ${product.moq} units).`);
      return;
    }

    if (parsedPrice <= 0) {
      setErrorMsg('Please specify a valid offered unit price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createProductInquiry({
        productId: product.id,
        buyerName: company?.contact_name || company?.name || 'Commercial Buyer',
        buyerEmail: company?.email || '',
        buyerPhone: company?.phone || undefined,
        buyerCompanyId: company?.id,
        targetQuantity,
        offeredPrice: parsedPrice,
        message: notes || `Inquiry for ${targetQuantity} units at £${parsedPrice.toFixed(2)} / unit. Lead time: ${leadTimeDays} business days.`,
      });

      if (res.success) {
        const conv = startMarketplaceInquiry(
          product,
          company,
          company?.contact_name || company?.name || 'Commercial Buyer',
          company?.email || '',
          company?.phone || '',
          notes || `Commercial Inquiry: ${targetQuantity} units at £${parsedPrice.toFixed(2)} / unit.`
        );
        setCreatedConvId(conv.id);
        setIsSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to dispatch inquiry.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-[28px] shadow-[0_20px_50px_rgba(11,31,58,0.14)] border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Matching WTB Direct Quotation Desk */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#EEF2F6] flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-1">
              Direct Supplier Desk
            </div>
            <h3 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] line-clamp-1">
              {product.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Specs Bar */}
        <div className="bg-[#F8FAFC] border-b border-[#EEF2F6] px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#5B6B82] shrink-0">
          <div>
            <span className="text-[#8A9BB0]">Minimum Order (MOQ):</span>{' '}
            <span className="font-bold text-[#0B1F3A]">{product.moq} units</span>
          </div>
          <div>
            <span className="text-[#8A9BB0]">Listed Wholesale Price:</span>{' '}
            <span className="font-bold text-[#0A6CFF]">£{product.unit_price.toFixed(2)} / unit</span>
          </div>
          {product.quantity_available && (
            <div className="text-[12px]">
              <span className="text-[#8A9BB0]">In Stock:</span>{' '}
              <span className="font-bold text-emerald-600">{product.quantity_available.toLocaleString()} pcs</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Supplier Contact Card with Email & Chat Buttons */}
          <div className="mb-6 p-4.5 rounded-2xl bg-[#F0F7FF] border border-[#D0E2FF] flex flex-col gap-3 text-[13px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF] block">
                  Supplier Commercial Contact
                </span>
                <div className="font-bold text-[#0B1F3A] text-[15px] mt-0.5">
                  {supplierName}
                </div>
                <div className="text-[12px] text-[#5B6B82] font-medium flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{supplierCompany}</span>
                </div>
                <div className="text-[12px] text-[#5B6B82] font-mono mt-0.5">
                  {supplierEmail}
                </div>
                {supplierPhone && (
                  <div className="text-[12px] text-[#5B6B82] flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{supplierPhone}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Email Directly & Chat */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <a
                  href={`mailto:${supplierEmail}?subject=${emailSubject}&body=${emailBody}`}
                  className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-[#0A6CFF] border border-[#BFDBFE] font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs"
                  title="Open your email client to contact supplier directly"
                >
                  <Mail className="w-4 h-4" />
                  <span>Email Directly</span>
                </a>
                <button
                  type="button"
                  onClick={handleDirectChat}
                  className="px-4 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                  title="Open live chat with supplier in your dashboard"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Live Chat</span>
                </button>
              </div>
            </div>
          </div>

          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-[22px] font-extrabold text-[#0B1F3A]">Inquiry Dispatched!</h4>
              <p className="text-[14px] text-[#5B6B82] max-w-md mx-auto leading-relaxed">
                Your commercial inquiry has been logged and sent to <strong className="text-[#0B1F3A]">{supplierName}</strong>. You can continue the negotiation inside your live messages inbox.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    const cid = createdConvId;
                    onClose();
                    router.push(cid ? `/dashboard/inquiries?id=${cid}` : '/dashboard/inquiries');
                  }}
                  className="px-7 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
                >
                  Open Live Chat
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-7 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] text-[14px] font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Price and Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Offered Unit Price (£ GBP) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">
                      £
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder={product.unit_price ? String(product.unit_price) : '0.00'}
                      className="w-full pl-8 pr-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Quantity Required <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={product.moq}
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(parseInt(e.target.value, 10) || product.moq)}
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Minimum Order Quantity: {product.moq} units
                  </span>
                </div>
              </div>

              {/* Lead Time */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Requested Dispatch Lead Time (Business Days)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Clock className="w-4 h-4" />
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 3)}
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Commercial Terms & Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify destination warehouse location, collection depot, warranty requirements, or inspection terms..."
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Deal Value Snapshot */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EEF2F6] flex items-center justify-between text-[13px]">
                <span className="text-[#5B6B82]">Estimated Total Deal Value:</span>
                <span className="text-[17px] font-black text-[#0B1F3A]">
                  £{Number(estimatedTotal).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 min-h-[46px] rounded-full text-[14px] font-bold text-[#5B6B82] hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-7 min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] disabled:opacity-50 text-white text-[14px] font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Sending...' : 'Submit Inquiry'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function InquiryModal({ product, isOpen, onClose, onSuccess }: InquiryModalProps) {
  if (!isOpen || !product) return null;
  return <InquiryDialogContent key={product.id} product={product} onClose={onClose} onSuccess={onSuccess} />;
}
