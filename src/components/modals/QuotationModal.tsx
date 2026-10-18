'use client';

import React, { useState } from 'react';
import { submitQuotation } from '@/lib/actions/quotations';
import { useAuth } from '@/lib/auth/auth-context';
import { dispatchWtbLeadToBuyerDashboard } from '@/lib/messaging/messaging-store';
import type { WtbRequest } from '@/types/database';
import { X, CheckCircle2, AlertCircle, Send, Clock, ShieldAlert, Mail } from 'lucide-react';

interface QuotationModalProps {
  wtbRequest: WtbRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function QuotationDialogContent({
  wtbRequest,
  onClose,
  onSuccess,
}: {
  wtbRequest: WtbRequest;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { company } = useAuth();
  const [unitPrice, setUnitPrice] = useState<string>(wtbRequest.target_price ? String(wtbRequest.target_price) : '');
  const [quantityOffered, setQuantityOffered] = useState<number>(wtbRequest.target_quantity || 100);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isPendingSeller = company?.approval_status === 'pending';
  const isBuyerOnly = company?.role === 'buyer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!company) {
      setErrorMsg('You must be signed in to submit a quote.');
      return;
    }

    if (company.approval_status !== 'approved') {
      setErrorMsg('Your seller account is currently undergoing compliance review by Jeff.');
      return;
    }

    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please specify a valid unit price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitQuotation({
        wtbRequestId: wtbRequest.id,
        sellerCompanyId: company.id,
        sellerEmail: company.email || company.contact_email,
        unitPrice: priceNum,
        quantityOffered,
        leadTimeDays: leadTimeDays || undefined,
        notes: notes || undefined,
      });

      if (res.success) {
        // Save to seller's local quotes store so it appears in /dashboard/quotes
        try {
          const quotesKey = company.id ? `b2b_sent_quotes_${company.id}` : 'b2b_sent_quotes_v2';
          const raw = localStorage.getItem(quotesKey);
          const existing = raw ? JSON.parse(raw) : [];
          const newQuoteRecord = {
            id: `sq-${Date.now()}`,
            product: wtbRequest.product_name,
            category: wtbRequest.category_slug.replace('-', ' '),
            buyer: (wtbRequest as any).buyer_company || wtbRequest.buyer_name,
            buyerContact: wtbRequest.buyer_name,
            buyerEmail: wtbRequest.buyer_email,
            buyerPhone: wtbRequest.buyer_phone || '',
            yourPrice: priceNum,
            quantity: quantityOffered,
            sentDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            leadTimeDays,
            notes,
            requestTargetPrice: wtbRequest.target_price,
            requestTargetQuantity: wtbRequest.target_quantity,
            requestBarcode: wtbRequest.barcode_or_sku,
            requestNotes: wtbRequest.notes,
            status: 'Sent',
          };
          const filtered = existing.filter((q: any) => q.product !== wtbRequest.product_name || q.status !== 'Unlocked');
          localStorage.setItem(quotesKey, JSON.stringify([newQuoteRecord, ...filtered]));
          window.dispatchEvent(new CustomEvent('b2b_quotes_updated'));
        } catch {
          // ignore
        }

        // Dispatch official quotation and seller company info to Buyer Dashboard
        dispatchWtbLeadToBuyerDashboard({
          wtbRequest,
          sellerCompany: company,
          actionType: 'quote_submitted',
          quoteDetails: {
            unitPrice: priceNum,
            quantity: quantityOffered,
            totalPrice: Number((priceNum * quantityOffered).toFixed(2)),
            leadTimeDays,
            notes,
          },
        });

        setIsSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to submit quotation.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-[28px] shadow-[0_20px_50px_rgba(11,31,58,0.14)] border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#EEF2F6] flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-1">
              Direct Quotation Desk
            </div>
            <h3 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] line-clamp-1">
              {wtbRequest.product_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WTB Specs Snapshot */}
        <div className="bg-[#F8FAFC] border-b border-[#EEF2F6] px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#5B6B82] shrink-0">
          <div>
            <span className="text-[#8A9BB0]">Target Volume:</span>{' '}
            <span className="font-bold text-[#0B1F3A]">{wtbRequest.target_quantity.toLocaleString()} units</span>
          </div>
          <div>
            <span className="text-[#8A9BB0]">Buyer Target Price:</span>{' '}
            <span className="font-bold text-[#0A6CFF]">€{wtbRequest.target_price.toFixed(2)} / unit</span>
          </div>
          {wtbRequest.barcode_or_sku && (
            <div className="font-mono text-[11px] bg-white border border-[#E2E8F0] px-2.5 py-1 rounded-lg text-[#0B1F3A]">
              EAN: {wtbRequest.barcode_or_sku}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Seller Activation Warning if Pending */}
          {isPendingSeller && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-[13px] text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Account Pending Activation:</strong>
                <p className="mt-0.5 leading-relaxed text-[#6B5A30]">
                  Your seller account is currently undergoing compliance review. Our desk verifies and approves sellers within 24 hours.
                </p>
              </div>
            </div>
          )}

          {isBuyerOnly && (
            <div className="mb-5 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-[13px] text-blue-900">
              <AlertCircle className="w-5 h-5 text-[#0A6CFF] shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Buyer Account Detected:</strong>
                <p className="mt-0.5 leading-relaxed text-[#355B8A]">
                  You are currently signed in as a Buyer. To submit quotations to other buyers, please register or switch to a Seller account.
                </p>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-[22px] font-extrabold text-[#0B1F3A]">Quotation Dispatched!</h4>
              <p className="text-[14px] text-[#5B6B82] max-w-md mx-auto leading-relaxed">
                Your quote was submitted and the buyer (<strong className="text-[#0B1F3A]">{wtbRequest.buyer_name}</strong>) received an official notification email with your pricing and terms.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-8 min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Buyer Procurement Contact & Email Action */}
              <div className="p-4 rounded-2xl bg-[#F0F7FF] border border-[#D0E2FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF] block">
                    Buyer Procurement Contact
                  </span>
                  <div className="font-bold text-[#0B1F3A] mt-0.5">
                    {wtbRequest.buyer_name}
                  </div>
                  {wtbRequest.buyer_email && (
                    <div className="text-[12px] text-[#5B6B82] font-mono">
                      {wtbRequest.buyer_email}
                    </div>
                  )}
                </div>

                {wtbRequest.buyer_email && (
                  <a
                    href={`mailto:${wtbRequest.buyer_email}?subject=Quote for ${encodeURIComponent(wtbRequest.product_name)} [B2B LINK]&body=Dear ${encodeURIComponent(wtbRequest.buyer_name)},%0D%0A%0D%0ARegarding your WTB request for ${encodeURIComponent(wtbRequest.product_name)} (${wtbRequest.target_quantity} units at target €${wtbRequest.target_price}):%0D%0A%0D%0AOur Offer Details:%0D%0A- Offered Price: €${unitPrice || wtbRequest.target_price}%0D%0A- Available Quantity: ${quantityOffered}%0D%0A- Lead Time: ${leadTimeDays} business days%0D%0A- Notes: ${encodeURIComponent(notes || 'Official distributor lot.')}%0D%0A%0D%0APlease let us know if you would like to proceed.%0D%0A%0D%0ABest regards`}
                    onClick={() => {
                      if (company) {
                        dispatchWtbLeadToBuyerDashboard({
                          wtbRequest,
                          sellerCompany: company,
                          actionType: 'email_sent',
                          quoteDetails: {
                            unitPrice: parseFloat(unitPrice) || wtbRequest.target_price,
                            quantity: quantityOffered,
                            totalPrice: Number(((parseFloat(unitPrice) || wtbRequest.target_price) * quantityOffered).toFixed(2)),
                            leadTimeDays,
                            notes,
                          },
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#0A6CFF] border border-[#B3D4FF] text-[12px] font-bold px-3.5 py-2 rounded-xl transition shadow-2xs shrink-0"
                    title="Send quote via your email client"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Buyer Directly</span>
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1F3A] mb-1.5">
                    Offered Unit Price (€ EUR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[#8A9BB0] text-[15px] font-medium">€</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 text-[14px] border border-[#E2E8F0] rounded-[14px] text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF] transition"
                      placeholder="185.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1F3A] mb-1.5">
                    Quantity Offered <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantityOffered}
                    onChange={(e) => setQuantityOffered(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-[14px] text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A] mb-1.5">
                  Estimated Dispatch Lead Time (Business Days)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-[#8A9BB0] absolute left-3.5 top-3" />
                  <input
                    type="number"
                    min="1"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-[14px] text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF] transition"
                    placeholder="3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A] mb-1.5">
                  Commercial Terms & Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify warranty terms, pallet packaging details, payment terms (escrow/wire), or collection depot..."
                  className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-[14px] text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF] transition resize-none"
                />
              </div>

              {/* Total Summary preview */}
              <div className="bg-[#F1F5F9] p-4 rounded-[16px] flex items-center justify-between text-[13px]">
                <span className="text-[#5B6B82] font-medium">Estimated Total Deal Value:</span>
                <span className="font-extrabold text-[#0B1F3A] text-[16px]">
                  €
                  {((parseFloat(unitPrice) || 0) * (quantityOffered || 0)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#EEF2F6]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isPendingSeller}
                  className="flex items-center gap-2 bg-[#0A6CFF] hover:bg-[#0857cf] disabled:opacity-50 text-white text-[14px] font-bold px-6 py-2.5 rounded-full shadow-xs transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Quotation'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuotationModal({ wtbRequest, isOpen, onClose, onSuccess }: QuotationModalProps) {
  if (!isOpen || !wtbRequest) return null;
  return <QuotationDialogContent key={wtbRequest.id} wtbRequest={wtbRequest} onClose={onClose} onSuccess={onSuccess} />;
}
