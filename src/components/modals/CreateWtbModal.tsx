'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { createWtbRequest } from '@/lib/actions/wtb';
import { X, CheckCircle2, AlertCircle, Send, ShoppingCart } from 'lucide-react';
import { POPULAR_BRANDS } from '@/app/dashboard/listings/page';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';

interface CreateWtbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateWtbModal({ isOpen, onClose, onSuccess }: CreateWtbModalProps) {
  const router = useRouter();
  const { company, isLoggedIn } = useAuth();

  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('Apple');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState(WHOLESALE_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState('');
  const [ean, setEan] = useState('');
  const [condition, setCondition] = useState('New');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [location, setLocation] = useState('DE');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!productName.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    const qtyNum = parseInt(targetQuantity, 10);
    const priceNum = parseFloat(targetPrice);

    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg('Target quantity must be greater than 0.');
      return;
    }
    if (!priceNum || priceNum <= 0) {
      setErrorMsg('Target unit price must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;

      // 1. Submit to action/DB
      const buyerName = company?.contact_name || company?.name || 'Verified Buyer';
      const buyerEmail = company?.email || 'buyer@b2blink.eu';

      await createWtbRequest({
        buyerName,
        buyerEmail,
        buyerPhone: company?.phone || undefined,
        buyerCompany: company?.name || 'Verified Procurement Partner',
        buyerCompanyId: company?.id,
        productName: `${brand ? `${brand} ` : ''}${productName.trim()}`,
        categorySlug: finalCategory.toLowerCase().replace(/\s+/g, '-'),
        targetQuantity: qtyNum,
        targetPrice: priceNum,
        barcodeOrSku: ean.trim() || undefined,
        notes: `${notes ? `${notes} | ` : ''}Condition: ${condition} | Delivery: ${location} | Model: ${itemCode || 'Standard'}`,
      });

      // 2. Also save to local storage for immediate visibility in Trading Board
      try {
        localStorage.removeItem('b2b_user_wtb_requests_v1');
        const localKey = 'b2b_user_wtb_requests_v2';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const newWtbItem = {
          id: `wtb-usr-${Date.now()}`,
          type: 'BUY',
          category: finalCategory,
          brand,
          itemCode: itemCode || 'WTB-REQ',
          description: productName.trim(),
          ean: ean.trim() || '8806095087286',
          qty: qtyNum,
          condition,
          price: priceNum,
          currency: '€',
          location,
          match: '96%',
          companyName: company?.name || 'Verified Procurement Partner',
          contactEmail: buyerEmail,
          contactName: buyerName,
          contactPhone: company?.phone || '',
          moq: Math.min(10, qtyNum),
        };
        localStorage.setItem(localKey, JSON.stringify([newWtbItem, ...existing]));
        window.dispatchEvent(new CustomEvent('b2b_wtb_created'));
      } catch {}

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to post WTB request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-xs animate-in fade-in duration-200 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#16A34A] block mb-0.5">
              Want To Buy (WTB) Desk
            </span>
            <h3 className="text-[20px] font-extrabold text-[#0B1F3A]">
              Post a Sourcing Request
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

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-[22px] font-extrabold text-[#0B1F3A]">
                WTB Request Posted!
              </h4>
              <p className="text-[14px] text-[#64748B] max-w-md mx-auto leading-relaxed">
                Your request is now live on the Trading Board. Global verified suppliers matching this item will receive instant alert notifications.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-8 py-3 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
              >
                Close & View Board
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Product Title */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Product / Title Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Galaxy Tab S9 128GB Wi-Fi Graphite"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                />
              </div>

              {/* Brand and Item Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Brand
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-bold"
                  >
                    {POPULAR_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Model / Item Code
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. SM-X810"
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                  />
                </div>
              </div>

              {/* Category & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                  >
                    {WHOLESALE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                  >
                    <option value="New">Brand New / Sealed</option>
                    <option value="Refurbished">Refurbished</option>
                    <option value="Used">Used / Grade A</option>
                  </select>
                </div>

                {category === 'Other' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Specify Category <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Type your category (e.g. Vintage Watches, Medical Supplies, Industrial Machinery...)"
                      className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                    />
                  </div>
                )}
              </div>

              {/* EAN/UPC Code */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  EAN / UPC / Barcode
                </label>
                <input
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="e.g. 8806095087286"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-mono focus:outline-none focus:border-[#16A34A] transition"
                />
              </div>

              {/* Target Quantity & Target Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Target Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Target Unit Price (€ EUR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">
                      €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="e.g. 420.00"
                      className="w-full pl-8 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Destination Location */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Destination Country / Hub Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                >
                  <option value="DE">Germany (DE)</option>
                  <option value="NL">Netherlands (NL)</option>
                  <option value="FR">France (FR)</option>
                  <option value="PL">Poland (PL)</option>
                  <option value="CZ">Czech Republic (CZ)</option>
                  <option value="IT">Italy (IT)</option>
                  <option value="ES">Spain (ES)</option>
                  <option value="UK">United Kingdom (UK)</option>
                  <option value="BE">Belgium (BE)</option>
                  <option value="SE">Sweden (SE)</option>
                </select>
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Procurement Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Ready for prompt payment. Pallet delivery requested to central Rotterdam hub."
                  className="w-full px-4 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#16A34A] transition font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full text-[13px] font-bold text-[#64748B] hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-7 py-2.5 rounded-full bg-[#16A34A] hover:bg-emerald-700 disabled:opacity-50 text-white text-[13.5px] font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Posting...' : 'Post Sourcing Request'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
