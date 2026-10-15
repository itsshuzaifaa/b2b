'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProductInquiry } from '@/lib/actions/inquiries';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import { useAuth } from '@/lib/auth/auth-context';
import type { Product } from '@/types/database';
import { X, Send, CheckCircle2, AlertCircle, Building2, Package, Tag } from 'lucide-react';

interface InquiryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

function InquiryDialogContent({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const router = useRouter();
  const { company } = useAuth();
  const [targetQuantity, setTargetQuantity] = useState<number>(product.moq || 20);
  const [offeredPrice, setOfferedPrice] = useState<string>(product.unit_price ? String(product.unit_price) : '');
  const [buyerName, setBuyerName] = useState(company?.contact_name || '');
  const [buyerEmail, setBuyerEmail] = useState(company?.email || '');
  const [buyerPhone, setBuyerPhone] = useState(company?.phone || '');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdConvId, setCreatedConvId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (targetQuantity < product.moq) {
      setErrorMsg(`Target quantity cannot be below Minimum Order Quantity (MOQ: ${product.moq}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createProductInquiry({
        productId: product.id,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || undefined,
        buyerCompanyId: company?.id,
        targetQuantity,
        offeredPrice: offeredPrice ? parseFloat(offeredPrice) : undefined,
        message,
      });

      if (res.success) {
        const conv = startMarketplaceInquiry(
          product,
          company,
          buyerName || company?.contact_name || 'Commercial Buyer',
          buyerEmail || company?.email || 'buyer@trade.eu',
          buyerPhone || company?.phone || '',
          message || `Interested in ${targetQuantity} units at £${offeredPrice || product.unit_price} / unit.`
        );
        setCreatedConvId(conv.id);
        setIsSuccess(true);
      } else {
        setErrorMsg(res.error || 'Failed to submit inquiry.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0B132B] px-6 py-4 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
              Wholesale Inquiry Request
            </span>
            <h3 className="text-base font-bold text-white line-clamp-1">{product.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Quick Specs Header */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-3 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <Package className="w-3.5 h-3.5 text-[#0066FF]" />
            <span>MOQ: {product.moq} units</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-[#16a34a]">
            <Tag className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Listed: £{product.unit_price.toFixed(2)} / unit</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Building2 className="w-3.5 h-3.5" />
            <span>{product.company?.name || 'Verified Supplier'}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Inquiry Dispatched to Seller!</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Your specifications have been logged and an email notification was triggered directly to the seller&apos;s verified desk. You can chat directly inside your inquiries inbox.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const cid = createdConvId;
                    onClose();
                    router.push(cid ? `/dashboard/inquiries?id=${cid}` : '/dashboard/inquiries');
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Open In-App Chat
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={product.moq}
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(parseInt(e.target.value, 10) || product.moq)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must meet minimum MOQ of {product.moq}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offered Unit Price (£ GBP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`e.g. ${product.unit_price}`}
                    value={offeredPrice}
                    onChange={(e) => setOfferedPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank to accept listed price</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                    placeholder="Marcus Wright"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                    placeholder="marcus@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  placeholder="+44 7911 123456"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message & Delivery Specifications <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Specify destination warehouse location, incoterms (EXW/FOB), or batch inspection requirements..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 bg-[#0066FF] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function InquiryModal({ product, isOpen, onClose }: InquiryModalProps) {
  if (!isOpen || !product) return null;
  return <InquiryDialogContent key={product.id} product={product} onClose={onClose} />;
}
