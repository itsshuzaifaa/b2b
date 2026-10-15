'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  getAdminListings,
  suspendListing,
  reinstateListing,
  deleteListing,
  toggleListingHot,
  type AdminModeratedListing,
} from '@/lib/admin/admin-store';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Trash2,
  Flame,
  Eye,
  Ban,
  Check,
  X,
  Package,
  Building2,
  Mail,
  AlertTriangle,
} from 'lucide-react';

export default function SiteAdminListingsPage() {
  const [listings, setListings] = useState<AdminModeratedListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hot' | 'suspended'>('all');

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<AdminModeratedListing | null>(null);
  const [suspendTargetProduct, setSuspendTargetProduct] = useState<AdminModeratedListing | null>(null);
  const [suspendReason, setSuspendReason] = useState('Suspended pending EAN authenticity check and invoice audit.');
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
    showNotice(`Listing "${suspendTargetProduct.title}" has been suspended from the marketplace.`);
    setSuspendTargetProduct(null);
    loadData();
  };

  const handleReinstate = (id: string, title: string) => {
    reinstateListing(id);
    showNotice(`Listing "${title}" is now active in the marketplace.`);
    loadData();
  };

  const handleToggleHot = (id: string) => {
    toggleListingHot(id);
    showNotice('Hot deal badge status updated.');
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteListing(id);
    setDeleteConfirmProduct(null);
    showNotice('Listing permanently removed from catalog.');
    loadData();
  };

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.company_name.toLowerCase().includes(q) ||
        item.category_slug.toLowerCase().includes(q) ||
        (item.barcode_or_sku && item.barcode_or_sku.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (statusFilter === 'active') return item.moderation_status === 'active';
      if (statusFilter === 'hot') return item.is_hot;
      if (statusFilter === 'suspended') return item.moderation_status === 'suspended';

      return true;
    });
  }, [listings, searchQuery, statusFilter]);

  const activeCount = listings.filter((l) => l.moderation_status === 'active').length;
  const hotCount = listings.filter((l) => l.is_hot).length;
  const suspendedCount = listings.filter((l) => l.moderation_status === 'suspended').length;

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Listing Moderation
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Quality control for marketplace stock lots. Suspend fraudulent offerings, reinstate listings, and curate Hot deals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#EBF3FF] text-[#0A6CFF] text-[12px] font-bold px-3.5 py-1.5 rounded-full">
            {listings.length} total lots
          </div>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All Lots ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            Active &amp; Compliant ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('hot')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'hot'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'
            }`}
          >
            Hot Deals ({hotCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('suspended')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'suspended'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            Suspended by Admin ({suspendedCount})
          </button>
        </div>

        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product title, supplier, or category..."
            className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Moderation Table Card */}
      <div className="mt-6 bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                <th className="py-4 px-6">PRODUCT LOT</th>
                <th className="py-4 px-6">SUPPLIER</th>
                <th className="py-4 px-6">PRICE &amp; MOQ</th>
                <th className="py-4 px-6">AVAILABLE</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6 text-right">MODERATION ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#5B6B82]">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-[15px] text-[#0B1F3A]">No catalog listings found</p>
                    <p className="text-[12px] mt-1">Try clearing filters or search query.</p>
                  </td>
                </tr>
              ) : (
                filteredListings.map((item) => {
                  const isSuspended = item.moderation_status === 'suspended';
                  const productImage = item.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

                  return (
                    <tr key={item.id} className="hover:bg-[#F8FAFC]/70 transition group">
                      {/* Product Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#F3F6FB] shrink-0 border border-[#EAEFF6]">
                            <Image src={productImage} alt={item.title} fill className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(item)}
                              className="font-bold text-[#0B1F3A] hover:text-[#0A6CFF] text-left transition line-clamp-1 cursor-pointer"
                            >
                              {item.title}
                            </button>
                            <div className="text-[11px] text-[#8A9BB0] mt-0.5 flex items-center gap-1.5">
                              <span className="capitalize">{item.category_slug.replace('-', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Supplier Column */}
                      <td className="py-4 px-6 text-[#5B6B82]">
                        <div className="font-bold text-[#0B1F3A] text-[13px]">{item.company_name}</div>
                        <div className="text-[11px] text-[#8A9BB0]">{item.seller_email}</div>
                      </td>

                      {/* Price & MOQ */}
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-[#0B1F3A] text-[15px]">
                          £{item.unit_price.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-[#8A9BB0]">MOQ: {item.moq} pcs</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-6 text-[#5B6B82] font-semibold">
                        {item.quantity_available.toLocaleString()} units
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1">
                          {isSuspended ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              Suspended
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          )}

                          {item.is_hot && !isSuspended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                              <Flame className="w-2.5 h-2.5 text-orange-500" />
                              <span>HOT</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Moderation Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Hot Tag */}
                          <button
                            type="button"
                            onClick={() => handleToggleHot(item.id)}
                            title={item.is_hot ? 'Remove Hot Deal status' : 'Promote to Hot Deal'}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              item.is_hot
                                ? 'text-orange-500 hover:bg-orange-50'
                                : 'text-slate-400 hover:text-orange-500 hover:bg-slate-100'
                            }`}
                          >
                            <Flame className="w-4 h-4" />
                          </button>

                          {/* Inspect Modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(item)}
                            title="Inspect lot details"
                            className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Suspend / Reinstate */}
                          {isSuspended ? (
                            <button
                              type="button"
                              onClick={() => handleReinstate(item.id, item.title)}
                              title="Reinstate listing to marketplace"
                              className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSuspendTargetProduct(item)}
                              title="Suspend this listing"
                              className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmProduct(item)}
                            title="Delete listing permanently"
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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
            <p className="text-[12px] text-[#5B6B82] text-center mt-1">
              Hides <strong>{suspendTargetProduct.title}</strong> from all buyers in the marketplace.
            </p>

            <form onSubmit={handleConfirmSuspend} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                  Moderation Reason for Seller *
                </label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full p-3 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-amber-500 resize-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendTargetProduct(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82]"
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

      {/* INSPECT PRODUCT DETAILS MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                  Catalog Dossier
                </span>
                <h3 className="text-[17px] font-bold text-[#0B1F3A] line-clamp-1">
                  {selectedProduct.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-[13px]">
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#F3F6FB] border border-[#EAEFF6]">
                <Image
                  src={selectedProduct.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                  alt={selectedProduct.title}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Unit Price</span>
                  <p className="text-[18px] font-black text-[#0B1F3A]">
                    £{selectedProduct.unit_price.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Quantity Available</span>
                  <p className="text-[16px] font-extrabold text-[#0B1F3A]">
                    {selectedProduct.quantity_available.toLocaleString()} pcs
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Supplier</span>
                  <p className="font-bold text-[#0B1F3A]">{selectedProduct.company_name}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Category</span>
                  <p className="font-bold text-[#0B1F3A] capitalize">{selectedProduct.category_slug.replace('-', ' ')}</p>
                </div>
              </div>

              {selectedProduct.moderation_reason && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px]">
                  <strong>Current Moderation Note:</strong> {selectedProduct.moderation_reason}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[13px] hover:bg-[#0857cf] transition cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
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
              Delete Product Listing?
            </h3>
            <p className="text-[13px] text-[#5B6B82] text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteConfirmProduct.title}</strong>?
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
