'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getBuyerWtbRequests, createWtbRequest } from '@/lib/actions/wtb';
import { broadcastMemberOpportunity } from '@/lib/messaging/messaging-store';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import type { WtbRequest } from '@/types/database';
import {
  X,
  Radio,
  CheckCircle2,
  Lock,
  Plus,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface BroadcastWtbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BroadcastWtbModal({
  isOpen,
  onClose,
  onSuccess,
}: BroadcastWtbModalProps) {
  const { company } = useAuth();

  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [existingWtbs, setExistingWtbs] = useState<WtbRequest[]>([]);
  const [selectedWtbId, setSelectedWtbId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // New WTB form state
  const [formProductName, setFormProductName] = useState('');
  const [formCategory, setFormCategory] = useState(WHOLESALE_CATEGORIES[0]?.name || 'Consumer Electronics');
  const [formTargetQty, setFormTargetQty] = useState('100');
  const [formTargetPrice, setFormTargetPrice] = useState('450');
  const [formBarcode, setFormBarcode] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'seller'>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load user's current WTBs
  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setIsLoadingList(true);

    const loadUserWtbs = async () => {
      const itemsMap = new Map<string, WtbRequest>();

      // 1. Load from localStorage
      try {
        const raw = localStorage.getItem('b2b_user_wtb_requests_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item.id) {
                itemsMap.set(item.id, {
                  id: item.id,
                  buyer_company_id: item.buyer_company_id || company?.id || null,
                  buyer_company: item.buyer_company || company?.name || null,
                  buyer_name: item.buyer_name || company?.contact_name || 'Buyer',
                  buyer_email: item.buyer_email || company?.email || '',
                  buyer_phone: item.buyer_phone || company?.phone || null,
                  product_name: item.product_name || item.productName || 'Wholesale Item',
                  category_id: item.category_id || null,
                  category_slug: item.category_slug || item.category || 'electronics',
                  target_quantity: Number(item.target_quantity || item.targetQuantity || 1),
                  target_price: Number(item.target_price || item.targetPrice || 0),
                  barcode_or_sku: item.barcode_or_sku || item.barcode || null,
                  notes: item.notes || null,
                  status: item.status || 'open',
                  created_at: item.created_at || new Date().toISOString(),
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('[LOAD LOCAL WTB ERROR]', err);
      }

      // 2. Load from server
      if (company?.email) {
        try {
          const serverList = await getBuyerWtbRequests(company.email);
          serverList.forEach((w) => itemsMap.set(w.id, w));
        } catch (err) {
          console.warn('[LOAD SERVER WTB ERROR]', err);
        }
      }

      if (isMounted) {
        const list = Array.from(itemsMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setExistingWtbs(list);
        if (list.length > 0) {
          setSelectedWtbId(list[0].id);
          setActiveTab('existing');
        } else {
          setActiveTab('new');
        }
        setIsLoadingList(false);
      }
    };

    loadUserWtbs();

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
      let broadcastQty = 0;
      let broadcastPrice = 0;
      let broadcastBarcode = '';
      let broadcastNotes = '';
      let broadcastItemId = '';

      if (activeTab === 'existing') {
        const selected = existingWtbs.find((w) => w.id === selectedWtbId);
        if (!selected) {
          setErrorMsg('Please select a WTB request from your list to broadcast.');
          setIsSubmitting(false);
          return;
        }

        broadcastItemId = selected.id;
        broadcastTitle = selected.product_name;
        broadcastCategory = selected.category_slug;
        broadcastQty = selected.target_quantity;
        broadcastPrice = selected.target_price;
        broadcastBarcode = selected.barcode_or_sku || '';
        broadcastNotes = selected.notes || '';
      } else {
        // Validation for new WTB
        if (!formProductName.trim()) {
          setErrorMsg('Product name is required.');
          setIsSubmitting(false);
          return;
        }
        const qty = parseInt(formTargetQty, 10);
        if (!qty || qty <= 0) {
          setErrorMsg('Target quantity must be greater than zero.');
          setIsSubmitting(false);
          return;
        }
        const price = parseFloat(formTargetPrice);
        if (isNaN(price) || price <= 0) {
          setErrorMsg('Target price must be greater than zero.');
          setIsSubmitting(false);
          return;
        }

        broadcastTitle = formProductName.trim();
        broadcastCategory = formCategory;
        broadcastQty = qty;
        broadcastPrice = price;
        broadcastBarcode = formBarcode.trim();
        broadcastNotes = formNotes.trim();

        // Save new WTB to database & local storage
        const newWtbResult = await createWtbRequest({
          buyerName: company.contact_name || company.name || 'Buyer',
          buyerEmail: company.email || '',
          buyerPhone: company.phone || '',
          buyerCompany: company.name || 'Commercial Trader',
          buyerCompanyId: company.id,
          productName: broadcastTitle,
          categorySlug: broadcastCategory.toLowerCase().replace(/\s+/g, '-'),
          targetQuantity: broadcastQty,
          targetPrice: broadcastPrice,
          barcodeOrSku: broadcastBarcode || undefined,
          notes: broadcastNotes || undefined,
        });

        broadcastItemId = newWtbResult.wtbRequestId || `wtb-${Date.now()}`;

        // Also save to localStorage for instant offline access
        try {
          const raw = localStorage.getItem('b2b_user_wtb_requests_v2');
          const current = raw ? JSON.parse(raw) : [];
          const newLocalItem: WtbRequest = {
            id: broadcastItemId,
            buyer_company_id: company.id,
            buyer_company: company.name,
            buyer_name: company.contact_name || 'Buyer',
            buyer_email: company.email || '',
            buyer_phone: company.phone || null,
            product_name: broadcastTitle,
            category_id: null,
            category_slug: broadcastCategory,
            target_quantity: broadcastQty,
            target_price: broadcastPrice,
            barcode_or_sku: broadcastBarcode || null,
            notes: broadcastNotes || null,
            status: 'open',
            created_at: new Date().toISOString(),
          };
          current.unshift(newLocalItem);
          localStorage.setItem('b2b_user_wtb_requests_v2', JSON.stringify(current));
        } catch {}
      }

      // Dispatch internal broadcast to all members
      await broadcastMemberOpportunity({
        broadcastKind: 'wtb',
        itemId: broadcastItemId,
        title: broadcastTitle,
        category: broadcastCategory,
        quantity: broadcastQty,
        price: broadcastPrice,
        barcode: broadcastBarcode,
        notes: broadcastNotes,
        senderCompany: company,
        targetAudience,
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[BROADCAST WTB ERROR]', err);
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
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>GOLD MEMBER BROADCAST</span>
            </span>
          </div>

          <h2 className="text-[22px] sm:text-[24px] font-black tracking-tight text-white leading-snug">
            Broadcast WTB Request to All Members
          </h2>
          <p className="text-[13px] text-[#A7BFDE] mt-1 max-w-xl">
            Transmit your sourcing demand instantly across the internal network. All verified wholesale traders receive notification in their messages desk.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-5">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-[22px] font-extrabold text-[#0B1F3A]">
                WTB Broadcast Sent!
              </h3>
              <p className="text-[14px] text-[#64748B] max-w-md mx-auto leading-relaxed">
                Your Want-To-Buy requirement has been broadcasted to all verified network members. Counterparties will see your product specifications, volume, and target pricing, and can unlock your dossier to submit formal quotations.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
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
                  Your personal contact info and company name will be masked in the broadcast. Members will see product details, target volume, and pricing, but must use their contact unlocks to reveal your buyer dossier.
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
                  <span>Select from My WTBs ({existingWtbs.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`px-4 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'new'
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New WTB</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tab 1: Existing WTBs */}
              {activeTab === 'existing' && (
                <div className="space-y-3">
                  <div className="text-[13px] font-bold text-[#0B1F3A]">
                    Choose an active WTB requirement to broadcast:
                  </div>

                  {isLoadingList ? (
                    <div className="p-8 text-center text-[13px] text-[#64748B]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0A6CFF]" />
                      Loading your WTB requests...
                    </div>
                  ) : existingWtbs.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center space-y-2">
                      <p className="text-[13px] text-[#64748B]">
                        You don&apos;t have any active WTB requests yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('new')}
                        className="text-[13px] font-bold text-[#16A34A] hover:underline cursor-pointer"
                      >
                        + Create a new WTB for this broadcast
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {existingWtbs.map((wtb) => {
                        const isSelected = selectedWtbId === wtb.id;
                        return (
                          <div
                            key={wtb.id}
                            onClick={() => setSelectedWtbId(wtb.id)}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-[#16A34A] bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                                : 'border-[#EAEFF6] bg-white hover:border-[#CBD5E1]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                                  {wtb.product_name}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-100 shrink-0">
                                  {wtb.category_slug}
                                </span>
                              </div>
                              <div className="text-[12px] text-[#5B6B82] mt-1 flex items-center gap-3">
                                <span>
                                  Target Qty: <strong className="text-[#0B1F3A]">{wtb.target_quantity} pcs</strong>
                                </span>
                                <span>·</span>
                                <span>
                                  Target Price: <strong className="text-[#16A34A]">£{wtb.target_price.toFixed(2)}</strong>
                                </span>
                                {wtb.barcode_or_sku && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[11px]">{wtb.barcode_or_sku}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-[#16A34A] bg-[#16A34A] text-white'
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

              {/* Tab 2: Create New WTB */}
              {activeTab === 'new' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formProductName}
                      onChange={(e) => setFormProductName(e.target.value)}
                      placeholder="e.g. Apple iPhone 15 Pro Max 256GB Natural Titanium"
                      className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
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
                        EAN / Barcode / SKU
                      </label>
                      <input
                        type="text"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        placeholder="e.g. 195949048735"
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Target Quantity (units) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formTargetQty}
                        onChange={(e) => setFormTargetQty(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Target Price (£ / unit) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formTargetPrice}
                        onChange={(e) => setFormTargetPrice(e.target.value)}
                        className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Procurement Specifications &amp; Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Specify packaging, EU/UK specs, warranty requirements, delivery port..."
                      className="w-full px-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#16A34A] bg-white text-[#0B1F3A]"
                    />
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
                    onClick={() => setTargetAudience('seller')}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                      targetAudience === 'seller'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Suppliers Only
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
                  disabled={isSubmitting || (activeTab === 'existing' && !selectedWtbId)}
                  className="px-6 py-2.5 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-[13.5px] transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transmitting Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      <span>Send WTB Broadcast</span>
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
