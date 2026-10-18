'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getAdminListings,
  suspendListing,
  reinstateListing,
  deleteListing,
  type AdminModeratedListing,
} from '@/lib/admin/admin-store';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import {
  Search,
  CheckCircle2,
  Trash2,
  Eye,
  Ban,
  Check,
  X,
  Package,
  Building2,
  Mail,
  AlertTriangle,
  Barcode,
  ChevronDown,
  ShieldCheck,
  MapPin,
  Tag,
  Phone,
  Layers,
} from 'lucide-react';

export default function SiteAdminListingsPage() {
  const [listings, setListings] = useState<AdminModeratedListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'sell' | 'buy' | 'suspended'>('all');
  const [selectedCategory, setSelectedCategory] = useState('All categories');

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<AdminModeratedListing | null>(null);
  const [suspendTargetProduct, setSuspendTargetProduct] = useState<AdminModeratedListing | null>(null);
  const [suspendReason, setSuspendReason] = useState('Suspended pending EAN authenticity check and commercial invoice audit.');
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<AdminModeratedListing | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    setListings(getAdminListings());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    return () => window.removeEventListener('b2b_admin_update', loadData);
  }, []);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleConfirmSuspend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTargetProduct) return;
    suspendListing(suspendTargetProduct.id, suspendReason);
    showNotice(`Listing "${suspendTargetProduct.title}" has been suspended from the live trading board.`);
    setSuspendTargetProduct(null);
    loadData();
  };

  const handleReinstate = (id: string, title: string) => {
    reinstateListing(id);
    showNotice(`Listing "${title}" is now active on the live trading board.`);
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteListing(id);
    setDeleteConfirmProduct(null);
    showNotice('Listing permanently removed from marketplace catalog.');
    loadData();
  };

  // Compute counts
  const totalCount = listings.length;
  const sellCount = useMemo(() => listings.filter((l) => l.type === 'SELL').length, [listings]);
  const buyCount = useMemo(() => listings.filter((l) => l.type === 'BUY').length, [listings]);
  const suspendedCount = useMemo(() => listings.filter((l) => l.moderation_status === 'suspended').length, [listings]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    WHOLESALE_CATEGORIES.forEach((c) => set.add(c.name));
    listings.forEach((l) => {
      if (l.category_name) set.add(l.category_name);
    });
    return ['All categories', ...Array.from(set)];
  }, [listings]);

  // Filtered Listings
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // 1. Tab filter
      if (tabFilter === 'sell' && item.type !== 'SELL') return false;
      if (tabFilter === 'buy' && item.type !== 'BUY') return false;
      if (tabFilter === 'suspended' && item.moderation_status !== 'suspended') return false;

      // 2. Category filter
      if (selectedCategory !== 'All categories' && item.category_name !== selectedCategory) {
        return false;
      }

      // 3. Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.item_code.toLowerCase().includes(q) ||
        item.company_name.toLowerCase().includes(q) ||
        item.seller_email.toLowerCase().includes(q) ||
        item.ean.toLowerCase().includes(q) ||
        item.category_name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [listings, tabFilter, selectedCategory, searchQuery]);

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0A6CFF] mb-1.5">
            ADMIN CONSOLE &middot; MARKETPLACE CONTROL
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Listing Moderation
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Quality control for marketplace trading board lots. Suspend fraudulent offerings, reinstate listings, and inspect EAN compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-[#EBF3FF] text-[#0A6CFF] text-[12px] font-extrabold px-3.5 py-1.5 rounded-full border border-[#D0E2FF]">
            {totalCount} total lots
          </div>
          <div className="bg-[#DCFCE7] text-[#15803D] text-[12px] font-extrabold px-3.5 py-1.5 rounded-full border border-[#86EFAC]/60">
            {buyCount} buy offers
          </div>
          <div className="bg-[#E0F2FE] text-[#0284C7] text-[12px] font-extrabold px-3.5 py-1.5 rounded-full border border-[#7DD3FC]/60">
            {sellCount} sell offers
          </div>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setTabFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-extrabold whitespace-nowrap transition cursor-pointer ${
              tabFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All Lots ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter('sell')}
            className={`px-4 py-2 rounded-full text-[13px] font-extrabold whitespace-nowrap transition cursor-pointer ${
              tabFilter === 'sell'
                ? 'bg-[#0A6CFF] text-white shadow-xs'
                : 'bg-white text-[#0A6CFF] border border-[#CBD5E1] hover:bg-[#EBF3FF]'
            }`}
          >
            Sell Offers ({sellCount})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter('buy')}
            className={`px-4 py-2 rounded-full text-[13px] font-extrabold whitespace-nowrap transition cursor-pointer ${
              tabFilter === 'buy'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'bg-white text-[#15803D] border border-[#CBD5E1] hover:bg-[#DCFCE7]'
            }`}
          >
            Buy Offers ({buyCount})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter('suspended')}
            className={`px-4 py-2 rounded-full text-[13px] font-extrabold whitespace-nowrap transition cursor-pointer ${
              tabFilter === 'suspended'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            Suspended by Admin ({suspendedCount})
          </button>
        </div>

        {/* Search Bar & Category Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-[280px]">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brand, model, EAN, supplier..."
              className="w-full pl-9 pr-4 py-2 text-[13.5px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto appearance-none bg-white border border-[#CBD5E1] rounded-xl pl-4 pr-9 py-2 text-[13px] text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF] transition cursor-pointer"
            >
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Trading Board Moderation Table */}
      <div className="mt-6 bg-white rounded-[24px] border border-[#CBD5E1] shadow-[0_2px_8px_rgba(11,31,58,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EEF2F6] text-[10.5px] font-black uppercase tracking-wider text-[#334155] border-b border-[#CBD5E1]">
                <th className="py-3 px-3.5 whitespace-nowrap">TYPE</th>
                <th className="py-3 px-3 whitespace-nowrap">BRAND</th>
                <th className="py-3 px-3 whitespace-nowrap">CODE</th>
                <th className="py-3 px-3">DESCRIPTION</th>
                <th className="py-3 px-3 whitespace-nowrap">CATEGORY</th>
                <th className="py-3 px-3 whitespace-nowrap">EAN / BARCODE</th>
                <th className="py-3 px-3 whitespace-nowrap">QTY &amp; MOQ</th>
                <th className="py-3 px-3 whitespace-nowrap">PRICE</th>
                <th className="py-3 px-3 whitespace-nowrap">LOC</th>
                <th className="py-3 px-3">SUPPLIER / BUYER</th>
                <th className="py-3 px-3 whitespace-nowrap">STATUS</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-[13px]">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#5B6B82]">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-[15px] text-[#0B1F3A]">No trading board lots found</p>
                    <p className="text-[12px] mt-1 text-[#64748B]">Try clearing filters or search query.</p>
                  </td>
                </tr>
              ) : (
                filteredListings.map((item, idx) => {
                  const isSuspended = item.moderation_status === 'suspended';
                  const isBuy = item.type === 'BUY';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                      } ${isSuspended ? 'bg-red-50/40 hover:bg-red-50/70' : isBuy ? 'hover:bg-[#F0FDF4]' : 'hover:bg-[#EFF6FF]'} group`}
                    >
                      {/* 1. Type */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isBuy ? (
                          <span className="bg-[#DCFCE7] text-[#15803D] text-[10px] font-black px-2 py-0.5 rounded uppercase border border-[#86EFAC]/50">
                            BUY
                          </span>
                        ) : (
                          <span className="bg-[#E0F2FE] text-[#0284C7] text-[10px] font-black px-2 py-0.5 rounded uppercase border border-[#7DD3FC]/50">
                            SELL
                          </span>
                        )}
                      </td>

                      {/* 2. Brand */}
                      <td className="py-3 px-3 font-bold text-[#0B1F3A] text-[12.5px] whitespace-nowrap">
                        {item.brand}
                      </td>

                      {/* 3. Code */}
                      <td className="py-3 px-3 font-mono text-[#64748B] text-[11.5px] font-medium whitespace-nowrap">
                        {item.item_code}
                      </td>

                      {/* 4. Description */}
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(item)}
                          className="font-extrabold text-[#0B1F3A] text-[12.5px] text-left hover:text-[#0A6CFF] transition line-clamp-1 cursor-pointer max-w-[220px]"
                          title={item.title}
                        >
                          {item.title}
                        </button>
                      </td>

                      {/* 5. Category */}
                      <td className="py-3 px-3 text-[#64748B] text-[11.5px] whitespace-nowrap">
                        <span className="truncate max-w-[140px] inline-block" title={item.category_name}>
                          {item.category_name}
                        </span>
                      </td>

                      {/* 6. EAN */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11.5px] text-[#475569]">
                        <span className="flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.ean && item.ean !== '195949048735' && item.ean !== '8806095087286' && item.ean !== '—' ? item.ean : 'n/a'}</span>
                        </span>
                      </td>

                      {/* 7. Quantity & MOQ */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-[#0B1F3A] text-[12.5px]">
                          {item.quantity_available.toLocaleString()} u
                        </div>
                        <div className="text-[10.5px] text-[#8A9BB0]">
                          MOQ: {item.moq} pcs
                        </div>
                      </td>

                      {/* 8. Price */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-black text-[#0B1F3A] text-[13px]">
                          {item.currency}{item.unit_price.toFixed(2)}
                        </div>
                      </td>

                      {/* 9. Location */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="bg-[#EEF2F6] text-[#334155] font-black text-[10.5px] px-2 py-0.5 rounded border border-[#CBD5E1]">
                          {item.location}
                        </span>
                      </td>

                      {/* 10. Supplier / Buyer */}
                      <td className="py-3 px-3">
                        <div className="min-w-[140px]">
                          <div className="font-bold text-[#0B1F3A] text-[12px] truncate">
                            {item.company_name}
                          </div>
                          <div className="text-[11px] text-[#8A9BB0] truncate">
                            {item.seller_email}
                          </div>
                        </div>
                      </td>

                      {/* 11. Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSuspended ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                            Suspended
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>

                      {/* 12. Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Inspect Dossier */}
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(item)}
                            title="Inspect trading board dossier"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A6CFF] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Suspend / Reinstate */}
                          {isSuspended ? (
                            <button
                              type="button"
                              onClick={() => handleReinstate(item.id, item.title)}
                              title="Reinstate listing to live board"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSuspendTargetProduct(item)}
                              title="Suspend this listing"
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmProduct(item)}
                            title="Delete listing permanently"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOSSIER INSPECTION MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-7 max-w-xl w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                {selectedProduct.type === 'BUY' ? (
                  <span className="bg-[#DCFCE7] text-[#15803D] text-[11px] font-black px-2.5 py-0.5 rounded uppercase border border-[#86EFAC]/60">
                    BUY OFFER
                  </span>
                ) : (
                  <span className="bg-[#E0F2FE] text-[#0284C7] text-[11px] font-black px-2.5 py-0.5 rounded uppercase border border-[#7DD3FC]/60">
                    SELL OFFER
                  </span>
                )}
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0A6CFF]">
                    {selectedProduct.brand} &middot; {selectedProduct.item_code}
                  </span>
                  <h3 className="text-[17px] font-extrabold text-[#0B1F3A] line-clamp-1">
                    {selectedProduct.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="py-5 space-y-4 text-[13px]">
              {/* Product Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#F8FAFD] border border-[#EAEFF6]">
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    Unit Price
                  </span>
                  <p className="text-[19px] font-black text-[#0B1F3A]">
                    {selectedProduct.currency}{selectedProduct.unit_price.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    Available Quantity
                  </span>
                  <p className="text-[16px] font-extrabold text-[#0B1F3A]">
                    {selectedProduct.quantity_available.toLocaleString()} pcs
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    MOQ Requirement
                  </span>
                  <p className="text-[15px] font-extrabold text-[#0B1F3A]">
                    {selectedProduct.moq} pcs
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    EAN Barcode
                  </span>
                  <p className="font-mono text-[13px] font-bold text-[#0B1F3A] flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedProduct.ean && selectedProduct.ean !== '195949048735' && selectedProduct.ean !== '8806095087286' && selectedProduct.ean !== '—' ? selectedProduct.ean : 'n/a'}</span>
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    Condition / Lot
                  </span>
                  <p className="font-bold text-[#0B1F3A]">
                    {selectedProduct.condition || 'Factory New'}
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A9BB0]">
                    Storage Location
                  </span>
                  <p className="font-bold text-[#0B1F3A] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedProduct.location} Warehouse Hub</span>
                  </p>
                </div>
              </div>

              {/* Company & Trader Contact Dossier */}
              <div className="p-4 rounded-2xl bg-white border border-[#EAEFF6] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0A6CFF]">
                    Counterparty Dossier
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Trader
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[11px] text-[#8A9BB0] block">Company Name</span>
                    <span className="font-bold text-[#0B1F3A] text-[13.5px]">{selectedProduct.company_name}</span>
                  </div>
                  {selectedProduct.contact_name && (
                    <div>
                      <span className="text-[11px] text-[#8A9BB0] block">Contact Person</span>
                      <span className="font-bold text-[#0B1F3A] text-[13.5px]">{selectedProduct.contact_name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] text-[#8A9BB0] block">Email Address</span>
                    <span className="font-medium text-[#0A6CFF] text-[13px]">{selectedProduct.seller_email}</span>
                  </div>
                  {selectedProduct.contact_phone && (
                    <div>
                      <span className="text-[11px] text-[#8A9BB0] block">Phone / WhatsApp</span>
                      <span className="font-medium text-[#0B1F3A] text-[13px]">{selectedProduct.contact_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Moderation Notes if Suspended */}
              {selectedProduct.moderation_status === 'suspended' && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-[12.5px]">
                  <strong>Current Moderation Status:</strong> Suspended by Admin.
                  {selectedProduct.moderation_reason && (
                    <div className="mt-1 text-red-700">
                      Reason: {selectedProduct.moderation_reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#F1F5F9]">
              <div>
                {selectedProduct.moderation_status === 'suspended' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleReinstate(selectedProduct.id, selectedProduct.title);
                      setSelectedProduct(null);
                    }}
                    className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] transition cursor-pointer shadow-xs"
                  >
                    Reinstate Listing
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSuspendTargetProduct(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="px-5 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[13px] transition cursor-pointer shadow-xs"
                  >
                    Suspend Listing
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[13px] hover:bg-[#0857cf] transition cursor-pointer shadow-xs"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendTargetProduct && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-[#0B1F3A] text-center">
              Suspend Listing?
            </h3>
            <p className="text-[12.5px] text-[#5B6B82] text-center mt-1">
              Hides <strong>{suspendTargetProduct.title}</strong> from all buyers on the live trading board.
            </p>

            <form onSubmit={handleConfirmSuspend} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                  Moderation Reason for Counterparty *
                </label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full p-3 text-[13px] border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-amber-500 resize-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendTargetProduct(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer"
                >
                  Confirm Suspension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT MODAL */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-[#0B1F3A] text-center">
              Delete Listing Permanently?
            </h3>
            <p className="text-[13px] text-[#5B6B82] text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteConfirmProduct.title}</strong> from the trading board?
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-5 py-2.5 rounded-full bg-slate-100 text-[#0B1F3A] font-semibold text-[13px] hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmProduct.id)}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] shadow-xs transition cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
