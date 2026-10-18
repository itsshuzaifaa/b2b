'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { broadcastMemberOpportunity } from '@/lib/messaging/messaging-store';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { POPULAR_BRANDS, type ListingItem } from '@/app/dashboard/listings/page';
import {
  X,
  Radio,
  CheckCircle2,
  Lock,
  Plus,
  Loader2,
  AlertCircle,
  Layers,
  Package,
} from 'lucide-react';

interface BroadcastWtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BroadcastWtsModal({
  isOpen,
  onClose,
  onSuccess,
}: BroadcastWtsModalProps) {
  const { company } = useAuth();

  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [existingListings, setExistingListings] = useState<ListingItem[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // New WTS form state
  const [formTitle, setFormTitle] = useState('');
  const [formBrand, setFormBrand] = useState('Apple');
  const [formCategory, setFormCategory] = useState(WHOLESALE_CATEGORIES[0]?.name || 'Consumer Electronics');
  const [formCondition, setFormCondition] = useState<'new' | 'refurbished' | 'used'>('new');
  const [formAvailable, setFormAvailable] = useState('100');
  const [formMoq, setFormMoq] = useState('10');
  const [formPrice, setFormPrice] = useState('450.00');
  const [formEan, setFormEan] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'buyer'>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load user's current listings
  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setIsLoadingList(true);

    const loadUserListings = async () => {
      const itemsMap = new Map<string, ListingItem>();

      // 1. Load from localStorage
      try {
        localStorage.removeItem('b2b_seller_listings_real_v2');
        const raw = localStorage.getItem('b2b_seller_listings_v3');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((l: any) => {
              if (l.id) {
                itemsMap.set(l.id, {
                  id: l.id,
                  title: l.title || l.description || 'Wholesale Lot',
                  brand: l.brand || 'Apple',
                  itemCode: l.itemCode,
                  condition: l.condition || 'new',
                  description: l.description || '',
                  ean: l.ean || '',
                  category: l.category || 'Consumer Electronics',
                  unitPrice: Number(l.unitPrice || l.price || 99),
                  available: Number(l.available || l.qty || 50),
                  moq: Number(l.moq || 5),
                  location: l.location || 'Global Warehouse',
                  status: l.status || 'Active',
                  images: l.images || [],
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('[LOAD LOCAL LISTINGS ERROR]', err);
      }

      // 2. Load from server
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products)) {
            data.products.forEach((p: any) => {
              if (
                company &&
                (p.company_id === company.id ||
                  (company.email && p.contact_email?.toLowerCase() === company.email.toLowerCase()))
              ) {
                itemsMap.set(p.id, {
                  id: p.id,
                  title: p.title,
                  brand: p.brand || 'Generic',
                  condition: p.condition || 'new',
                  description: p.description || '',
                  ean: p.ean || '',
                  category: p.category_slug || 'Consumer Electronics',
                  unitPrice: Number(p.unit_price || 0),
                  available: Number(p.stock_quantity || 50),
                  moq: Number(p.moq || 1),
                  status: 'Active',
                  images: p.image_urls || [],
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('[LOAD SERVER PRODUCTS ERROR]', err);
      }

      if (isMounted) {
        const list = Array.from(itemsMap.values());
        setExistingListings(list);
        if (list.length > 0) {
          setSelectedListingId(list[0].id);
          setActiveTab('existing');
        } else {
          setActiveTab('new');
        }
        setIsLoadingList(false);
      }
    };

    loadUserListings();

    return () => {
      isMounted = false;
    };
  }, [isOpen, company]);

  if (!isOpen) return null;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      let broadcastTitle = '';
      let broadcastCategory = '';
      let broadcastBrand = '';
      let broadcastCondition = 'new';
      let broadcastQty = 0;
      let broadcastMoq = 1;
      let broadcastPrice = 0;
      let broadcastEan = '';
      let broadcastNotes = '';
      let broadcastItemId = '';

      if (activeTab === 'existing') {
        const selected = existingListings.find((l) => l.id === selectedListingId);
        if (!selected) {
          setErrorMsg('Please select a wholesale listing from your list to broadcast.');
          setIsSubmitting(false);
          return;
        }

        broadcastItemId = selected.id;
        broadcastTitle = selected.title;
        broadcastCategory = selected.category;
        broadcastBrand = selected.brand || 'Generic';
        broadcastCondition = selected.condition || 'new';
        broadcastQty = selected.available;
        broadcastMoq = selected.moq || 1;
        broadcastPrice = selected.unitPrice;
        broadcastEan = selected.ean || '';
        broadcastNotes = selected.description || '';
      } else {
        // Validation for new WTS
        if (!formTitle.trim()) {
          setErrorMsg('Product title is required.');
          setIsSubmitting(false);
          return;
        }
        const qty = parseInt(formAvailable, 10);
        if (!qty || qty <= 0) {
          setErrorMsg('Available quantity must be greater than zero.');
          setIsSubmitting(false);
          return;
        }
        const moq = parseInt(formMoq, 10);
        if (!moq || moq <= 0) {
          setErrorMsg('Minimum Order Quantity (MOQ) must be greater than zero.');
          setIsSubmitting(false);
          return;
        }
        const price = parseFloat(formPrice);
        if (isNaN(price) || price <= 0) {
          setErrorMsg('Unit price must be greater than zero.');
          setIsSubmitting(false);
          return;
        }

        broadcastTitle = formTitle.trim();
        broadcastCategory = formCategory;
        broadcastBrand = formBrand;
        broadcastCondition = formCondition;
        broadcastQty = qty;
        broadcastMoq = moq;
        broadcastPrice = price;
        broadcastEan = formEan.trim();
        broadcastNotes = formDescription.trim();
        broadcastItemId = `listing-wts-${Date.now()}`;

        // Save new listing to localStorage
        try {
          const raw = localStorage.getItem('b2b_seller_listings_v3');
          const current: ListingItem[] = raw ? JSON.parse(raw) : [];
          const newListing: ListingItem = {
            id: broadcastItemId,
            title: broadcastTitle,
            brand: broadcastBrand,
            category: broadcastCategory,
            condition: broadcastCondition as any,
            unitPrice: broadcastPrice,
            available: broadcastQty,
            moq: broadcastMoq,
            ean: broadcastEan,
            description: broadcastNotes,
            status: 'Active',
          };
          current.unshift(newListing);
          localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(current));
        } catch (err) {
          console.warn('[SAVE LOCAL LISTING ERROR]', err);
        }
      }

      // Dispatch internal broadcast to all members
      await broadcastMemberOpportunity({
        broadcastKind: 'wts',
        itemId: broadcastItemId,
        title: broadcastTitle,
        brand: broadcastBrand,
        category: broadcastCategory,
        condition: broadcastCondition,
        quantity: broadcastQty,
        moq: broadcastMoq,
        price: broadcastPrice,
        barcode: broadcastEan,
        notes: broadcastNotes,
        senderCompany: company,
        targetAudience,
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[BROADCAST WTS ERROR]', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to dispatch broadcast.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1F3A]/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0B1F3A] text-white p-6 sm:p-7 relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00C2FF] bg-[#00C2FF]/10 px-2.5 py-0.5 rounded-full border border-[#00C2FF]/20 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#00C2FF] animate-pulse" />
              <span>GOLD MEMBER BROADCAST</span>
            </span>
          </div>

          <h2 className="text-[22px] sm:text-[24px] font-black tracking-tight text-white leading-snug">
            Broadcast WTS Offer to All Members
          </h2>
          <p className="text-[13px] text-[#A7BFDE] mt-1 max-w-xl">
            Transmit your wholesale stock lot instantly across the internal network. All verified wholesale buyers receive notification in their messages desk.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-5">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-[#0A6CFF] border border-blue-200 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-[22px] font-extrabold text-[#0B1F3A]">
                WTS Broadcast Sent!
              </h3>
              <p className="text-[14px] text-[#64748B] max-w-md mx-auto leading-relaxed">
                Your wholesale inventory lot has been broadcasted to all verified network members. Counterparties will see your stock specifications, available volume, MOQ, and unit pricing, and can unlock your dossier to submit formal purchase inquiries.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendBroadcast} className="space-y-5">
              {/* Privacy Shield Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 flex items-start gap-3">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[12.5px] leading-relaxed">
                  <strong className="font-bold text-amber-950 block mb-0.5">
                    Privacy Protection Active
                  </strong>
                  Your personal contact info and company name will be masked in the broadcast. Members will see product details, quantity, MOQ, and pricing, but must use their contact unlocks to reveal your seller dossier.
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center gap-2 border-b border-[#EAEFF6] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('existing')}
                  className={`px-4 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'existing'
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Select from My Listings ({existingListings.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`px-4 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'new'
                      ? 'bg-[#0A6CFF] text-white shadow-xs'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Listing</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tab 1: Existing Listings */}
              {activeTab === 'existing' && (
                <div className="space-y-3">
                  <div className="text-[13px] font-bold text-[#0B1F3A]">
                    Choose an active sell listing to broadcast:
                  </div>

                  {isLoadingList ? (
                    <div className="p-8 text-center text-[13px] text-[#64748B]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0A6CFF]" />
                      Loading your sell listings...
                    </div>
                  ) : existingListings.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center space-y-2">
                      <p className="text-[13px] text-[#64748B]">
                        You don&apos;t have any active sell listings yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('new')}
                        className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                      >
                        + Create a new listing for this broadcast
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {existingListings.map((listing) => {
                        const isSelected = selectedListingId === listing.id;
                        return (
                          <div
                            key={listing.id}
                            onClick={() => setSelectedListingId(listing.id)}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-[#0A6CFF] bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                                : 'border-[#EAEFF6] bg-white hover:border-[#CBD5E1]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                                  {listing.title}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-100 shrink-0">
                                  {listing.brand || listing.category}
                                </span>
                              </div>
                              <div className="text-[12px] text-[#5B6B82] mt-1 flex items-center gap-3">
                                <span>
                                  Available: <strong className="text-[#0B1F3A]">{listing.available} pcs</strong>
                                </span>
                                <span>·</span>
                                <span>
                                  MOQ: <strong className="text-slate-700">{listing.moq} pcs</strong>
                                </span>
                                <span>·</span>
                                <span>
                                  Price: <strong className="text-[#0A6CFF]">£{listing.unitPrice.toFixed(2)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-[#0A6CFF] bg-[#0A6CFF] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Create New Listing */}
              {activeTab === 'new' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Product Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Sony WH-1000XM5 Wireless Headphones Black"
                      className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Brand <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        className="w-full px-3 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
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
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      >
                        {WHOLESALE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Condition <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formCondition}
                        onChange={(e) => setFormCondition(e.target.value as any)}
                        className="w-full px-3 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      >
                        <option value="new">Brand New</option>
                        <option value="refurbished">Refurbished</option>
                        <option value="used">Used / Tested</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Unit Price (£) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Available Qty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formAvailable}
                        onChange={(e) => setFormAvailable(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        MOQ (pcs) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formMoq}
                        onChange={(e) => setFormMoq(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        EAN / Barcode
                      </label>
                      <input
                        type="text"
                        value={formEan}
                        onChange={(e) => setFormEan(e.target.value)}
                        placeholder="e.g. 4548736132580"
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Wholesale Lot Description
                      </label>
                      <input
                        type="text"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="e.g. Factory sealed pallets, direct distributor manifest..."
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-white text-[#0B1F3A]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target Audience */}
              <div className="pt-2 border-t border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[13px] font-bold text-[#0B1F3A] block">
                    Broadcast Target Audience
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Delivered to members&apos; Inquiries &amp; Messages desk
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudience('all')}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                      targetAudience === 'all'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Members
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAudience('buyer')}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                      targetAudience === 'buyer'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Buyers Only
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#EAEFF6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || (activeTab === 'existing' && !selectedListingId)}
                  className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13.5px] transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transmitting Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      <span>Send WTS Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
