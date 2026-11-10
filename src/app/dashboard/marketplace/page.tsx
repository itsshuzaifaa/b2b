'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Search, ChevronDown, PlusCircle, Sparkles, Filter, Store, Package, FileText, ArrowRight } from 'lucide-react';
import { TradingBoardDetailModal } from '@/components/modals/TradingBoardDetailModal';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';
import {
  ALL_TRADING_BOARD_ITEMS,
  type TradingBoardItem,
} from '@/lib/trading-board-data';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { isAccountDeleted } from '@/lib/admin/admin-store';
import { PriceBadge } from '@/lib/utils/pricing';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

function DashboardMarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company } = useAuth();

  // Tab state: ALL, BUY, SELL
  const tabParam = searchParams.get('tab')?.toUpperCase();
  const [activeTab, setActiveTab] = useState<'ALL' | 'BUY' | 'SELL'>(
    tabParam === 'BUY' ? 'BUY' : tabParam === 'SELL' ? 'SELL' : 'ALL'
  );

  useEffect(() => {
    if (tabParam === 'BUY') setActiveTab('BUY');
    else if (tabParam === 'SELL') setActiveTab('SELL');
    else if (tabParam === 'ALL') setActiveTab('ALL');
  }, [tabParam]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [items, setItems] = useState<TradingBoardItem[]>(ALL_TRADING_BOARD_ITEMS);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedDetailItem, setSelectedDetailItem] = useState<TradingBoardItem | null>(null);
  const [createWtbOpen, setCreateWtbOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'WTB' | 'WTS'>('WTB');

  // Load items + local user listings + local user WTBs + live database products & WTBs
  const refreshItems = async () => {
    try {
      localStorage.removeItem('b2b_seller_listings_real_v2');
      localStorage.removeItem('b2b_seller_listings_v1');
      localStorage.removeItem('b2b_user_wtb_requests_v1');

      // 1. User Sell listings from localStorage
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
            pricingType: l.pricingType || (l.description?.includes('POA') ? 'poa' : l.description?.includes('NEG') ? 'neg' : 'fixed'),
            currency: '€',
            location: l.location || 'DE',
            match: '98%',
            companyName: l.companyName || (l.company_id === company?.id ? company?.name : null) || 'Verified Supplier',
            contactEmail: l.contactEmail || (l.company_id === company?.id ? company?.email : null) || 'supplier@b2blink.eu',
            contactName: l.contactName || (l.company_id === company?.id ? company?.contact_name : null) || 'Trade Desk',
            contactPhone: l.contactPhone || (l.company_id === company?.id ? company?.phone : '') || '',
            moq: Number(l.moq || 10),
            companyId: l.company_id || l.companyId || company?.id,
          }))
        : [];

      // 2. User WTB requests from localStorage
      const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
      const userWtbs: TradingBoardItem[] = rawUserWtbs
        ? JSON.parse(rawUserWtbs).map((w: any) => ({
            ...w,
            pricingType: w.pricingType || (w.notes?.includes('POA') ? 'poa' : w.notes?.includes('NEG') ? 'neg' : 'fixed'),
            ean: (w.ean && w.ean !== '8806095087286' && w.ean !== '—') ? w.ean : 'n/a',
            companyId: w.companyId || w.company_id || w.buyerCompanyId,
          }))
        : [];

      // 3. Supabase live products (WTS)
      let liveProducts: TradingBoardItem[] = [];
      try {
        const prodRes = await fetch('/api/products', { cache: 'no-store' });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.success && Array.isArray(prodData.products)) {
            liveProducts = prodData.products.map((p: any) => ({
              id: p.id,
              type: 'SELL' as const,
              category: p.category_slug ? p.category_slug.replace(/-/g, ' ') : 'General',
              brand: p.brand || p.title.split(' ')[0] || 'Wholesale',
              itemCode: p.barcode_or_sku ? p.barcode_or_sku.slice(0, 8) : p.id.slice(0, 8),
              description: p.title + (p.description ? ` — ${p.description}` : ''),
              ean: p.barcode_or_sku || 'n/a',
              qty: Number(p.quantity_available) || 50,
              condition: p.condition || 'New',
              price: Number(p.unit_price) || 0,
              pricingType: (p.description?.includes('POA') ? 'poa' : p.description?.includes('NEG') ? 'neg' : 'fixed'),
              currency: '€',
              location: p.location || 'DE',
              match: '98%',
              companyName: p.company?.name || 'Verified Supplier',
              contactEmail: p.company?.email || 'supplier@b2blink.eu',
              contactName: p.company?.contact_name || 'Trade Desk',
              contactPhone: p.company?.phone || '',
              moq: Number(p.moq) || 1,
              companyId: p.company_id,
            }));
          }
        }
      } catch (prodErr) {
        console.warn('Could not load live products in dashboard marketplace:', prodErr);
      }

      // 4. Supabase live WTBs
      let liveWtbs: TradingBoardItem[] = [];
      try {
        const { getPublicWtbRequests } = await import('@/lib/actions/wtb');
        const supabaseWtbs = await getPublicWtbRequests();
        if (Array.isArray(supabaseWtbs) && supabaseWtbs.length > 0) {
          liveWtbs = supabaseWtbs.map((req) => ({
            id: req.id,
            type: 'BUY' as const,
            category: req.category_slug
              ? req.category_slug.charAt(0).toUpperCase() + req.category_slug.slice(1).replace(/-/g, ' ')
              : 'Electronics',
            brand: req.product_name.split(' ')[0] || 'Brand',
            itemCode: req.barcode_or_sku ? req.barcode_or_sku.slice(0, 10) : `REQ-${req.id.slice(0, 6).toUpperCase()}`,
            description: req.product_name + (req.notes ? ` — ${req.notes}` : ''),
            ean: req.barcode_or_sku || 'n/a',
            qty: req.target_quantity || 50,
            condition: (req.notes?.match(/Condition:\s*([^.|]+)/i)?.[1]?.trim()) || 'New',
            price: req.target_price || 0,
            pricingType: (req as any).pricing_type || (req.notes?.includes('POA') ? 'poa' : req.notes?.includes('NEG') ? 'neg' : 'fixed'),
            currency: '€',
            location: 'EU',
            match: '96%',
            companyName: req.buyer_company || 'Verified Buyer',
            contactEmail: req.buyer_email || 'buyer@b2blink.eu',
            contactName: req.buyer_name || 'Buyer',
            contactPhone: req.buyer_phone || '',
            moq: 1,
            companyId: req.buyer_company_id || req.buyer_user_id,
          }));
        }
      } catch (wtbErr) {
        console.warn('Could not load live WTBs in dashboard marketplace:', wtbErr);
      }

      const combined = [
        ...formattedUserSell,
        ...userWtbs,
        ...liveProducts,
        ...liveWtbs,
        ...ALL_TRADING_BOARD_ITEMS,
      ];
      const cleanItems = combined.filter((item) => {
        const cId = (item as any).companyId || (item as any).company_id;
        const cEmail = item.contactEmail || (item as any).seller_email;
        if (isAccountDeleted(cId, cEmail)) return false;
        return true;
      });
      const unique = Array.from(new Map(cleanItems.map((item) => [item.id, item])).values());
      setItems(unique);
      setIsLoading(false);
    } catch {
      setItems(ALL_TRADING_BOARD_ITEMS);
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0A6CFF] text-[12px] font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verified Wholesale Exchange &bull; 0% Commission</span>
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight">
            Trading Board &amp; Marketplace
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal max-w-2xl">
            Real-time verified wholesale inventory lots &amp; active procurement requests worldwide. Inquire, quote, and unlock counterparty contacts directly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCreateMode('WTB');
              setCreateWtbOpen(true);
            }}
            className="px-5 py-2.5 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-[13px] flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post Sourcing Request (WTB)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateMode('WTS');
              setCreateWtbOpen(true);
            }}
            className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product Listing (WTS)</span>
          </button>
        </div>
      </div>

      {/* Main Trading Board Container */}
      <div className="bg-white rounded-[28px] border border-[#CBD5E1] p-5 sm:p-7 shadow-[0_2px_8px_rgba(11,31,58,0.04)] flex flex-col h-[740px] max-h-[82vh] min-h-[560px] overflow-hidden">
        {/* Filter Bar: Tabs, Search, and Category */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#EAEFF6] shrink-0 bg-white z-20">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-4 sm:px-5 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-[#0A6CFF] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              All Listings (<AnimatedNumber value={totalCount} />)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BUY')}
              className={`px-4 sm:px-5 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'BUY'
                  ? 'bg-[#16A34A] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              Buy Offers - WTB (<AnimatedNumber value={buyCount} />)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SELL')}
              className={`px-4 sm:px-5 py-2 rounded-full text-[13px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'SELL'
                  ? 'bg-[#0A6CFF] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              Sell Offers - WTS (<AnimatedNumber value={sellCount} />)
            </button>
          </div>

          {/* Search Bar & Category Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-[260px] lg:w-[300px]">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brand, model, SKU, or keyword..."
                className="w-full pl-9 pr-4 py-2 text-[13px] bg-white border-2 border-[#CBD5E1] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white border-2 border-[#CBD5E1] rounded-xl pl-3.5 pr-8 py-2 text-[13px] text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF] transition cursor-pointer"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Unified Trading Board Table: Internal Smooth Scrolling with Sticky Column Headers */}
        <div
          className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-width:thin] pt-2"
          style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-[#5B6B82]">Loading Trading Board...</p>
            </div>
          ) : (
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
                        onClick={() => setSelectedDetailItem(item)}
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
                          <PriceBadge price={item.price} pricingType={item.pricingType} currency={item.currency} />
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
          )}
        </div>
      </div>

      {/* Trading Board Detail & Quoting Modal */}
      {selectedDetailItem && (
        <TradingBoardDetailModal
          isOpen={Boolean(selectedDetailItem)}
          onClose={() => setSelectedDetailItem(null)}
          item={selectedDetailItem}
        />
      )}

      {/* Post Sourcing Request / Add Listing Modal */}
      {createWtbOpen && (
        <CreateWtbModal
          isOpen={createWtbOpen}
          onClose={() => setCreateWtbOpen(false)}
          onSuccess={() => {
            refreshItems();
            setCreateWtbOpen(false);
          }}
          initialMode={createMode}
        />
      )}
    </div>
  );
}

export default function DashboardMarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] flex items-center justify-center p-8 bg-white rounded-[28px] border border-[#EAEFF6]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <h4 className="text-[16px] font-bold text-[#0B1F3A]">Loading Trading Board &amp; Marketplace...</h4>
          </div>
        </div>
      }
    >
      <DashboardMarketplaceContent />
    </Suspense>
  );
}
