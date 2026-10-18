'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { createWtbRequest } from '@/lib/actions/wtb';
import { X, CheckCircle2, AlertCircle, Send, ShoppingCart, HelpCircle } from 'lucide-react';
import { POPULAR_BRANDS } from '@/app/dashboard/listings/page';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { WHOLESALE_CONDITIONS } from '@/lib/constants/conditions';
import { TRADING_HUB_LOCATIONS } from '@/lib/constants/locations';

interface CreateWtbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'WTB' | 'WTS';
}

export function CreateWtbModal({ isOpen, onClose, onSuccess, initialMode = 'WTB' }: CreateWtbModalProps) {
  const router = useRouter();
  const { company, isLoggedIn } = useAuth();

  const [tradeMode, setTradeMode] = useState<'WTB' | 'WTS'>(initialMode);
  const [showLocationHelp, setShowLocationHelp] = useState(false);

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
    if (initialMode) {
      setTradeMode(initialMode);
    }
  }, [initialMode, isOpen]);

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

      if (tradeMode === 'WTS') {
        // Save to seller listings store (WTS)
        try {
          const localKey = 'b2b_seller_listings_v3';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const newListingItem = {
            id: `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
            brand,
            itemCode: itemCode || 'WTS-LOT',
            category: finalCategory,
            ean: ean.trim() || 'n/a',
            condition,
            description: notes ? `${notes} | Stock Location: ${location}` : `Verified wholesale stock: ${brand} ${productName.trim()}. Condition: ${condition}.`,
            unitPrice: priceNum,
            available: qtyNum,
            moq: Math.min(10, qtyNum),
            location,
            status: 'Active' as const,
          };
          localStorage.setItem(localKey, JSON.stringify([newListingItem, ...existing]));
          window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
          window.dispatchEvent(new CustomEvent('b2b_admin_update'));
        } catch {}
      } else {
        // Submit WTB request
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

        // Also save to local storage for immediate visibility in Trading Board
        try {
          localStorage.removeItem('b2b_user_wtb_requests_v1');
          const localKey = 'b2b_user_wtb_requests_v2';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const newWtbItem = {
            id: `wtb-usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'BUY',
            category: finalCategory,
            brand,
            itemCode: itemCode || 'WTB-REQ',
            description: productName.trim(),
            ean: ean.trim() || 'n/a',
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
      }

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : `Failed to post ${tradeMode} request.`);
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
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-black block mb-1">
              {tradeMode === 'WTB' ? 'Want To Buy (WTB) Desk' : 'Want To Sell (WTS) Desk'}
            </span>
            <h3 className={`text-[24px] sm:text-[26px] font-extrabold leading-tight ${tradeMode === 'WTB' ? 'text-[#16A34A]' : 'text-[#0A6CFF]'}`}>
              {tradeMode === 'WTB' ? 'Post a Sourcing Request' : 'Post a Sell Listing'}
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

        {/* WTB / WTS Mode Switcher Tabs */}
        <div className="px-6 sm:px-8 pt-4 pb-1 shrink-0">
          <div className="flex bg-[#F1F5F9] p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setTradeMode('WTB')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                tradeMode === 'WTB'
                  ? 'bg-white text-[#16A34A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span>Buy (WTB) Request</span>
            </button>
            <button
              type="button"
              onClick={() => setTradeMode('WTS')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                tradeMode === 'WTS'
                  ? 'bg-white text-[#0A6CFF] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#0A6CFF]" />
              <span>Sell (WTS) Listing</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border ${
                tradeMode === 'WTB'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
              }`}>
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-[22px] font-extrabold text-[#0B1F3A]">
                {tradeMode === 'WTB' ? 'WTB Request Posted!' : 'WTS Listing Posted!'}
              </h4>
              <p className="text-[14px] text-[#64748B] max-w-md mx-auto leading-relaxed">
                {tradeMode === 'WTB'
                  ? 'Your request is now live on the Trading Board. Global verified suppliers matching this item will receive instant alert notifications.'
                  : 'Your wholesale stock lot is now live on the Trading Board and your active listings. Buyers can now view and submit inquiries directly.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className={`mt-4 px-8 py-3 rounded-full text-white text-[14px] font-bold shadow-xs transition cursor-pointer ${
                  tradeMode === 'WTB'
                    ? 'bg-[#16A34A] hover:bg-emerald-700'
                    : 'bg-[#0A6CFF] hover:bg-blue-700'
                }`}
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
                    {WHOLESALE_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
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
                  EAN / UPC / Barcode <span className="text-[#8A9BB0] font-normal text-[12px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="Optional (e.g. 8806095087286)"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-mono focus:outline-none focus:border-[#16A34A] transition"
                />
              </div>

              {/* Target Quantity & Target Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    {tradeMode === 'WTB' ? 'Target Quantity' : 'Available Quantity'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className={`w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition font-medium ${
                      tradeMode === 'WTB' ? 'focus:border-[#16A34A]' : 'focus:border-[#0A6CFF]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    {tradeMode === 'WTB' ? 'Target Unit Price (€ EUR)' : 'Unit Price (€ EUR)'} <span className="text-red-500">*</span>
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
                      className={`w-full pl-8 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition font-medium ${
                        tradeMode === 'WTB' ? 'focus:border-[#16A34A]' : 'focus:border-[#0A6CFF]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Destination / Stock Location with Question Mark Tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[13px] font-bold text-[#0B1F3A]">
                    Destination Country / Hub Location
                  </label>
                  
                  {/* Interactive Question Mark Icon & Guidance Popover */}
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowLocationHelp((prev) => !prev)}
                      onMouseEnter={() => setShowLocationHelp(true)}
                      onMouseLeave={() => setShowLocationHelp(false)}
                      className="p-0.5 text-slate-400 hover:text-[#0A6CFF] rounded-full focus:outline-none transition cursor-pointer"
                      aria-label="Location guidance help"
                      title="Hub Location Guidance: In WTB this is where items are delivered; in WTS this is where items are situated."
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>

                    {showLocationHelp && (
                      <div
                        role="tooltip"
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3.5 bg-[#0B1F3A] text-white text-[12px] rounded-2xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700"
                      >
                        <div className="font-bold text-[12.5px] text-[#38BDF8] flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-700/60">
                          <HelpCircle className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Hub Location Guide</span>
                        </div>
                        <div className="space-y-2 leading-relaxed text-slate-200">
                          <p>
                            <span className="inline-block px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-bold mr-1">WTB</span>
                            <strong>In WTB:</strong> This is where you want these items delivered.
                          </p>
                          <p>
                            <span className="inline-block px-1.5 py-0.2 bg-sky-500/20 text-sky-400 rounded font-bold mr-1">WTS</span>
                            <strong>In WTS:</strong> This is where the items currently are situated.
                          </p>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0B1F3A]" />
                      </div>
                    )}
                  </div>
                </div>

                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition font-medium ${
                    tradeMode === 'WTB' ? 'focus:border-[#16A34A]' : 'focus:border-[#0A6CFF]'
                  }`}
                >
                  {TRADING_HUB_LOCATIONS.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery / Sourcing Notes */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  {tradeMode === 'WTB' ? 'Procurement Notes' : 'Stock & Logistics Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    tradeMode === 'WTB'
                      ? 'e.g. Ready for prompt payment. Pallet delivery requested to central Rotterdam hub.'
                      : 'e.g. Factory sealed master cartons. Immediate dispatch available from Hamburg warehouse.'
                  }
                  className={`w-full px-4 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition font-medium ${
                    tradeMode === 'WTB' ? 'focus:border-[#16A34A]' : 'focus:border-[#0A6CFF]'
                  }`}
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
                  className={`px-7 py-2.5 rounded-full disabled:opacity-50 text-white text-[13.5px] font-bold flex items-center gap-2 transition shadow-xs cursor-pointer ${
                    tradeMode === 'WTB'
                      ? 'bg-[#16A34A] hover:bg-emerald-700'
                      : 'bg-[#0A6CFF] hover:bg-blue-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Posting...'
                      : tradeMode === 'WTB'
                      ? 'Post Sourcing Request'
                      : 'Post Sell Request'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
