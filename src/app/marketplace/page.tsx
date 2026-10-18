'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Search, ChevronDown, PlusCircle, ArrowRight, ShieldCheck, Sparkles, Filter, Lock, Check } from 'lucide-react';
import { TradingBoardDetailModal } from '@/components/modals/TradingBoardDetailModal';
import { AuthGateModal } from '@/components/modals/AuthGateModal';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';
import {
  ALL_TRADING_BOARD_ITEMS,
  type TradingBoardItem,
} from '@/lib/trading-board-data';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { isAccountDeleted } from '@/lib/admin/admin-store';

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading, company, role } = useAuth();

  // Tab state: ALL, BUY, SELL
  const tabParam = searchParams.get('tab')?.toUpperCase();
  const [activeTab, setActiveTab] = useState<'ALL' | 'BUY' | 'SELL'>(
    tabParam === 'BUY' ? 'BUY' : tabParam === 'SELL' ? 'SELL' : 'ALL'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [items, setItems] = useState<TradingBoardItem[]>(ALL_TRADING_BOARD_ITEMS);

  // Modals
  const [selectedDetailItem, setSelectedDetailItem] = useState<TradingBoardItem | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [createWtbOpen, setCreateWtbOpen] = useState(false);

  // Load items + local user listings + local user WTBs
  const refreshItems = () => {
    try {
      localStorage.removeItem('b2b_seller_listings_real_v2');
      localStorage.removeItem('b2b_seller_listings_v1');
      localStorage.removeItem('b2b_user_wtb_requests_v1');

      // 1. User Sell listings
      const rawUserListings = localStorage.getItem('b2b_seller_listings_v3');
      const userListings = rawUserListings ? JSON.parse(rawUserListings) : [];

      const formattedUserSell: TradingBoardItem[] = Array.isArray(userListings)
        ? userListings.map((l: any, idx: number) => ({
            id: l.id || `user-lst-${idx}`,
            type: 'SELL',
            category: l.category || 'Mobile Phones',
            brand: l.brand || 'Apple',
            itemCode: l.itemCode || (l.ean && l.ean !== '195949048735' && l.ean !== 'n/a' ? l.ean.slice(0, 8) : 'MDL-2026'),
            description: l.title || l.description || 'Wholesale Lot',
            ean: (l.ean && l.ean !== '195949048735') ? l.ean : 'n/a',
            qty: Number(l.available || l.qty || 50),
            condition: l.condition
              ? l.condition === 'new'
                ? 'New'
                : l.condition === 'refurbished'
                ? 'Refurbished'
                : l.condition === 'worn_out'
                ? 'Ber'
                : l.condition
              : 'New',
            price: Number(l.unitPrice || l.price || 99),
            currency: '€',
            location: l.location || 'DE',
            match: '98%',
            companyName: company?.name || 'Verified Supplier',
            contactEmail: company?.email || 'supplier@b2blink.eu',
            contactName: company?.contact_name || 'Trade Desk',
            contactPhone: company?.phone || '',
            moq: Number(l.moq || 10),
          }))
        : [];

      // 2. User WTB requests
      const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
      const userWtbs: TradingBoardItem[] = rawUserWtbs
        ? JSON.parse(rawUserWtbs).map((w: any) => ({
            ...w,
            ean: (w.ean && w.ean !== '8806095087286' && w.ean !== '—') ? w.ean : 'n/a',
          }))
        : [];

      const combined = [...formattedUserSell, ...userWtbs, ...ALL_TRADING_BOARD_ITEMS];
      const cleanItems = combined.filter((item) => {
        const cId = (item as any).companyId || (item as any).company_id;
        const cEmail = item.contactEmail || (item as any).seller_email;
        if (isAccountDeleted(cId, cEmail)) return false;
        return true;
      });
      const unique = Array.from(new Map(cleanItems.map((item) => [item.id, item])).values());
      setItems(unique);
    } catch {
      setItems(ALL_TRADING_BOARD_ITEMS);
    }
  };

  useEffect(() => {
    refreshItems();
    window.addEventListener('b2b_wtb_created', refreshItems);
    window.addEventListener('b2b_listing_created', refreshItems);
    window.addEventListener('b2b_listings_updated', refreshItems);
    window.addEventListener('b2b_admin_update', refreshItems);
    window.addEventListener('storage', refreshItems);
    return () => {
      window.removeEventListener('b2b_wtb_created', refreshItems);
      window.removeEventListener('b2b_listing_created', refreshItems);
      window.removeEventListener('b2b_listings_updated', refreshItems);
      window.removeEventListener('b2b_admin_update', refreshItems);
      window.removeEventListener('storage', refreshItems);
    };
  }, [company]);

  // Compute counts
  const totalCount = items.length;
  const buyCount = useMemo(() => items.filter((i) => i.type === 'BUY').length, [items]);
  const sellCount = useMemo(() => items.filter((i) => i.type === 'SELL').length, [items]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    WHOLESALE_CATEGORIES.forEach((c) => set.add(c.name));
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['All categories', ...Array.from(set)];
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === 'BUY' && item.type !== 'BUY') return false;
      if (activeTab === 'SELL' && item.type !== 'SELL') return false;
      if (selectedCategory !== 'All categories' && item.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesEan = item.ean.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesBrand = item.brand.toLowerCase().includes(query);
        const matchesCode = item.itemCode.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        if (!matchesEan && !matchesDesc && !matchesBrand && !matchesCode && !matchesCategory) return false;
      }
      return true;
    });
  }, [items, activeTab, selectedCategory, searchQuery]);

  // Row click
  const handleRowClick = (item: TradingBoardItem) => {
    if (!isLoggedIn || !company) {
      setAuthGateOpen(true);
      return;
    }
    setSelectedDetailItem(item);
  };

  return (
    <div className="min-h-screen bg-[#E2EDF8]">
      {/* Hero Header without search bar */}
      <div className="bg-[#0B1F3A] text-white pt-28 pb-12 sm:pb-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-[#60A5FA] text-[13px] font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified Global Buyers & Sellers Of Wholesale Trade Inventory.</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[-0.03em] text-white">
                Live Trading Board
              </h1>
              <p className="mt-2 text-slate-300 max-w-2xl text-[14px] sm:text-[15px] leading-relaxed">
                Fresh from verified global sellers and active commercial procurement desks. Browse real-time buy and sell offers with direct contact access and 0% commission.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    setAuthGateOpen(true);
                  } else {
                    setCreateWtbOpen(true);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-[13.5px] flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Post Sourcing Request (WTB)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    setAuthGateOpen(true);
                  } else {
                    router.push('/dashboard/listings');
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13.5px] flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Product Listing</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Board Container */}
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {isLoading ? (
          <div className="bg-white rounded-[32px] sm:rounded-[36px] border border-[#CBD5E1] p-12 shadow-[0_2px_8px_rgba(11,31,58,0.04)] flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#5B6B82] font-semibold text-[14px]">Loading verified wholesale exchange...</p>
          </div>
        ) : !isLoggedIn ? (
          /* ========================================================================= */
          /* AUTH GATE: Prompt to login or create account to view all WTS/WTB Deals   */
          /* ========================================================================= */
          <div className="bg-white rounded-[32px] sm:rounded-[36px] border border-[#CBD5E1] p-8 sm:p-12 lg:p-16 shadow-[0_4px_24px_rgba(11,31,58,0.06)] text-center max-w-3xl mx-auto">
            {/* Lock / Security Icon Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#EBF3FF] border-2 border-[#BFDBFE] text-[#0A6CFF] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EBF3FF] border border-[#BFDBFE] text-[#0A6CFF] text-[12px] font-bold uppercase tracking-wider mb-4">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Wholesale Member Access</span>
            </div>

            <h2 className="text-[28px] sm:text-[36px] lg:text-[40px] font-black text-[#0B1F3A] tracking-[-0.03em] leading-tight mb-4">
              {activeTab === 'BUY'
                ? 'Login or Create an Account to View All WTB Deals'
                : activeTab === 'SELL'
                ? 'Login or Create an Account to View All WTS Deals'
                : 'Login or Create an Account to View All WTS & WTB Deals'}
            </h2>

            <p className="text-[15px] sm:text-[17px] text-[#5B6B82] max-w-xl mx-auto leading-relaxed mb-8">
              B2B LINK is an exclusive verified commercial trading network. Sign in to your account or create a free commercial profile to browse all live wholesale stock lots, access pallet &amp; volume pricing, and negotiate directly with sellers.
            </p>

            {/* Checklist of What Is Unlocked */}
            <div className="bg-[#F8FAFD] border border-[#EAEFF6] rounded-2xl p-5 sm:p-6 mb-8 text-left grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 text-[13.5px] font-semibold text-[#0B1F3A]">
                <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                <span>Full per-piece &amp; volume pricing</span>
              </div>
              <div className="flex items-center gap-3 text-[13.5px] font-semibold text-[#0B1F3A]">
                <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                <span>Direct seller contact details &amp; chat</span>
              </div>
              <div className="flex items-center gap-3 text-[13.5px] font-semibold text-[#0B1F3A]">
                <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                <span>Submit binding quotations &amp; RFQs</span>
              </div>
              <div className="flex items-center gap-3 text-[13.5px] font-semibold text-[#0B1F3A]">
                <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                <span>Post unlimited sourcing requests (WTB)</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
              <Link
                href="/login?redirect=/marketplace"
                className="w-full sm:w-auto min-w-[200px] min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <span>Log In to Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register?redirect=/marketplace"
                className="w-full sm:w-auto min-w-[200px] min-h-[50px] rounded-full bg-white hover:bg-slate-50 text-[#0B1F3A] font-bold text-[15px] border-2 border-[#CBD5E1] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Create Free Account</span>
              </Link>
            </div>

            <p className="text-[12px] text-[#8C9AA8] mt-6">
              Free membership for verified corporate buyers &bull; 0% transaction commission
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] sm:rounded-[36px] border border-[#CBD5E1] p-6 sm:p-8 lg:p-9 shadow-[0_2px_8px_rgba(11,31,58,0.04)] flex flex-col h-[740px] max-h-[82vh] min-h-[560px] overflow-hidden">

            {/* Filter Bar: Tabs, Search, and Category (Sticky at Top) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#EAEFF6] shrink-0 bg-white z-20">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-5 py-2 rounded-full text-[13.5px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'ALL'
                    ? 'bg-[#0A6CFF] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                All Listings ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BUY')}
                className={`px-5 py-2 rounded-full text-[13.5px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'BUY'
                    ? 'bg-[#16A34A] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                Buy Offers ({buyCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SELL')}
                className={`px-5 py-2 rounded-full text-[13.5px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'SELL'
                    ? 'bg-[#0A6CFF] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                Sell Offers ({sellCount})
              </button>
            </div>

            {/* Search Bar & Category Dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:w-[280px] lg:w-[320px]">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brand, model, or keyword..."
                  className="w-full pl-9 pr-4 py-2 text-[13.5px] bg-white border-2 border-[#CBD5E1] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-auto appearance-none bg-white border-2 border-[#CBD5E1] rounded-xl pl-4 pr-9 py-2 text-[13.5px] text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF] transition cursor-pointer"
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

          {/* Unified Trading Board Table: Internal Smooth Scrolling with Sticky Column Headers */}
          <div 
            className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-width:thin] pt-2"
            style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full min-w-[1020px] text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#EEF2F6] shadow-xs">
                <tr className="bg-[#EEF2F6] text-[11px] font-black uppercase tracking-wider text-[#334155]">
                  <th className="py-3 px-3.5 rounded-l-lg bg-[#EEF2F6]">BUY/SELL</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">CATEGORY</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">BRAND</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">ITEM CODE</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">DESCRIPTION</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">EAN/UPC</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">QTY</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">CONDITION</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">PRICE</th>
                  <th className="py-3 px-3 bg-[#EEF2F6]">LOCATION</th>
                  <th className="py-3 px-3 rounded-r-lg bg-[#EEF2F6]">MATCH</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#64748B] text-[14px]">
                      No trading board listings match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isBuy = item.type === 'BUY';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleRowClick(item)}
                        className={`cursor-pointer transition-colors duration-75 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                        } ${isBuy ? 'hover:bg-[#F0FDF4]' : 'hover:bg-[#EFF6FF]'} group`}
                        style={{
                          contentVisibility: 'auto',
                          containIntrinsicSize: 'auto 48px',
                        }}
                      >
                        {/* 1. BUY/SELL Pill */}
                        <td className="py-3.5 px-3.5 rounded-l-lg whitespace-nowrap">
                          <span
                            className={`text-[11px] font-black px-2.5 py-1 rounded-md inline-block uppercase tracking-wider ${
                              isBuy
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : 'bg-[#E0F2FE] text-[#0284C7]'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>

                        {/* 2. CATEGORY */}
                        <td className="py-3.5 px-3 text-[13px] text-[#475569] font-medium whitespace-nowrap">
                          {item.category}
                        </td>

                        {/* 3. BRAND */}
                        <td className="py-3.5 px-3 text-[13.5px] font-extrabold text-[#0B1F3A] whitespace-nowrap">
                          {item.brand}
                        </td>

                        {/* 4. ITEM CODE */}
                        <td className="py-3.5 px-3 text-[12px] font-mono text-[#64748B] whitespace-nowrap">
                          {item.itemCode}
                        </td>

                        {/* 5. DESCRIPTION */}
                        <td className="py-3.5 px-3">
                          <div
                            className={`font-extrabold text-[#0B1F3A] text-[13.5px] truncate max-w-[260px] sm:max-w-[320px] transition-colors ${
                              isBuy ? 'group-hover:text-[#16A34A]' : 'group-hover:text-[#0A6CFF]'
                            }`}
                            title={item.description}
                          >
                            {item.description}
                          </div>
                        </td>

                        {/* 6. EAN/UPC */}
                        <td className="py-3.5 px-3 text-[12px] font-mono text-[#475569] whitespace-nowrap">
                          {item.ean && item.ean !== '195949048735' && item.ean !== '8806095087286' && item.ean !== '—' ? item.ean : 'n/a'}
                        </td>

                        {/* 7. QTY */}
                        <td className="py-3.5 px-3 text-[13.5px] font-black text-[#0B1F3A] whitespace-nowrap">
                          {item.qty.toLocaleString()}
                        </td>

                        {/* 8. CONDITION */}
                        <td className="py-3.5 px-3 text-[12.5px] text-[#475569] font-medium whitespace-nowrap">
                          {item.condition}
                        </td>

                        {/* 9. PRICE */}
                        <td className="py-3.5 px-3 text-[14px] font-black text-[#0B1F3A] whitespace-nowrap">
                          {item.currency}{item.price.toFixed(2)}
                        </td>

                        {/* 10. LOCATION */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] text-[11px] font-mono font-bold">
                            {item.location}
                          </span>
                        </td>

                        {/* 11. MATCH */}
                        <td className="py-3.5 px-3 rounded-r-lg whitespace-nowrap">
                          <span className="bg-[#DCFCE7] text-[#15803D] text-[11px] font-black px-2 py-0.5 rounded">
                            {item.match}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Trading Board Detail Modal */}
      {selectedDetailItem && (
        <TradingBoardDetailModal
          item={selectedDetailItem}
          isOpen={!!selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />
      )}

      {/* Create WTB Modal */}
      <CreateWtbModal
        isOpen={createWtbOpen}
        onClose={() => setCreateWtbOpen(false)}
        onSuccess={() => refreshItems()}
      />

      {/* Auth Gate Modal when visitor is not logged in */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title="Verified Wholesale Access Required"
        subtitle="Sign in or create a free commercial account to view full lot specifications, unlock direct contact details, and send quotations or inquiries."
      />
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F3F6FB]" />}>
      <MarketplaceContent />
    </React.Suspense>
  );
}
