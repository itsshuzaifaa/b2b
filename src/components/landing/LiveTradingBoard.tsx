'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, ArrowRight, Barcode } from 'lucide-react';
import { TradingBoardDetailModal } from '@/components/modals/TradingBoardDetailModal';
import { AuthGateModal } from '@/components/modals/AuthGateModal';
import { useAuth } from '@/lib/auth/auth-context';
import {
  ALL_TRADING_BOARD_ITEMS,
  type TradingBoardItem,
} from '@/lib/trading-board-data';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { isAccountDeleted } from '@/lib/admin/admin-store';
import { getPublicWtbRequests } from '@/lib/actions/wtb';

export function LiveTradingBoard() {
  const router = useRouter();
  const { isLoggedIn, company } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [items, setItems] = useState<TradingBoardItem[]>(ALL_TRADING_BOARD_ITEMS);

  // Modals
  const [selectedDetailItem, setSelectedDetailItem] = useState<TradingBoardItem | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Load live user sell listings and buy requests
  const refreshBoard = useCallback(async () => {
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
            itemCode: l.itemCode || l.ean?.slice(0, 8) || 'MDL-2026',
            description: l.title || l.description || 'Wholesale Lot',
            ean: l.ean || '195949048735',
            qty: Number(l.available || l.qty || 50),
            condition: l.condition === 'new' ? 'New' : l.condition === 'refurbished' ? 'Refurbished' : 'Used',
            price: Number(l.unitPrice || l.price || 99),
            currency: l.currency || '€',
            location: l.location || 'DE',
            match: '98%',
            companyName: l.companyName || company?.name || 'Verified Supplier',
            contactEmail: l.contactEmail || company?.email || 'supplier@b2blink.eu',
            contactName: l.contactName || company?.contact_name || 'Trade Desk',
            contactPhone: l.contactPhone || company?.phone || '',
            moq: Number(l.moq || 10),
            companyId: l.company_id || l.companyId || company?.id,
          }))
        : [];

      // 2. User WTB / Buy requests from localStorage
      const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
      const userWtbs: TradingBoardItem[] = rawUserWtbs ? JSON.parse(rawUserWtbs) : [];

      const formattedUserWtbs: TradingBoardItem[] = Array.isArray(userWtbs)
        ? userWtbs.map((w: any, idx: number) => ({
            id: w.id || `wtb-usr-${idx}`,
            type: 'BUY' as const,
            category: w.category || 'General Wholesale',
            brand: w.brand || 'Procurement',
            itemCode: w.itemCode || 'WTB-REQ',
            description: w.description || w.title || 'Wanted Wholesale Lot',
            ean: w.ean || '—',
            qty: Number(w.qty || 50),
            condition: w.condition || 'New',
            price: Number(w.price || 0),
            currency: w.currency || '€',
            location: w.location || 'EU',
            match: w.match || '96%',
            companyName: w.companyName || company?.name || 'Verified Buyer',
            contactEmail: w.contactEmail || company?.email || 'buyer@b2blink.eu',
            contactName: w.contactName || company?.contact_name || 'Procurement Desk',
            contactPhone: w.contactPhone || company?.phone || '',
            moq: Number(w.moq || 1),
            companyId: w.companyId || w.company_id || w.buyerCompanyId || company?.id,
          }))
        : [];

      // 3. Supabase Public WTBs
      let supabaseMapped: TradingBoardItem[] = [];
      try {
        const supabaseData = await getPublicWtbRequests();
        if (Array.isArray(supabaseData) && supabaseData.length > 0) {
          supabaseMapped = supabaseData.map((req) => ({
            id: req.id,
            type: 'BUY' as const,
            category: req.category_slug
              ? req.category_slug.charAt(0).toUpperCase() + req.category_slug.slice(1).replace(/-/g, ' ')
              : 'Electronics',
            brand: req.product_name.split(' ')[0] || 'Brand',
            itemCode: req.barcode_or_sku ? req.barcode_or_sku.slice(0, 10) : `REQ-${req.id.slice(0, 6).toUpperCase()}`,
            description: req.product_name + (req.notes ? ` — ${req.notes}` : ''),
            ean: req.barcode_or_sku || '8806095087286',
            qty: req.target_quantity || 50,
            condition: 'New',
            price: req.target_price || 0,
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
      } catch (err) {
        console.warn('Could not load Supabase WTBs:', err);
      }

      // Combine and filter out any items from deleted accounts
      const combined = [
        ...formattedUserSell,
        ...formattedUserWtbs,
        ...supabaseMapped,
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
    } catch {
      setItems(ALL_TRADING_BOARD_ITEMS);
    }
  }, [company]);

  useEffect(() => {
    refreshBoard();

    const handleUpdate = () => {
      refreshBoard();
    };

    window.addEventListener('b2b_wtb_created', handleUpdate);
    window.addEventListener('b2b_listing_created', handleUpdate);
    window.addEventListener('b2b_listings_updated', handleUpdate);
    window.addEventListener('b2b_admin_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('b2b_wtb_created', handleUpdate);
      window.removeEventListener('b2b_listing_created', handleUpdate);
      window.removeEventListener('b2b_listings_updated', handleUpdate);
      window.removeEventListener('b2b_admin_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshBoard]);

  // Extract unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    WHOLESALE_CATEGORIES.forEach((c) => set.add(c.name));
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['All categories', ...Array.from(set)];
  }, [items]);

  // Filtered Buy Items
  const buyItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type !== 'BUY') return false;
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
  }, [items, selectedCategory, searchQuery]);

  // Filtered Sell Items
  const sellItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type !== 'SELL') return false;
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
  }, [items, selectedCategory, searchQuery]);

  // Display 8 items per table as requested
  const visibleBuyItems = buyItems.slice(0, 8);
  const visibleSellItems = sellItems.slice(0, 8);

  // Handle row click
  const handleRowClick = (item: TradingBoardItem) => {
    if (!isLoggedIn || !company) {
      setAuthGateOpen(true);
      return;
    }
    setSelectedDetailItem(item);
  };

  return (
    <section className="bg-[#E2EDF8] py-12 sm:py-16 lg:py-20">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Card Container */}
        <div className="bg-white rounded-[32px] sm:rounded-[36px] border border-[#CBD5E1] p-6 sm:p-8 lg:p-9 shadow-[0_2px_8px_rgba(11,31,58,0.04)]">
          {/* Top Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EAEFF6]">
            <div>
              <h2 className="text-[28px] sm:text-[34px] font-black text-[#0B1F3A] tracking-[-0.03em] uppercase leading-tight">
                LIVE TRADING BOARD
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[#64748B] mt-1 font-normal">
                Real-time wholesale buyer requests and verified seller inventory
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-[260px] lg:w-[300px]">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by brand, model, EAN..."
                  className="w-full pl-9 pr-4 py-2 text-[13px] sm:text-[14px] bg-white border-2 border-[#CBD5E1] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-auto appearance-none bg-white border-2 border-[#CBD5E1] rounded-xl pl-4 pr-9 py-2 text-[13px] sm:text-[14px] text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF] transition cursor-pointer"
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

          {/* TWO SIDE-BY-SIDE TABLES: BUY FIRST (LEFT, GREEN) THEN SELL (RIGHT, BLUE) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-6">
            {/* 1. BUY OFFERS (Want to Buy - GREEN, FIRST ON LEFT) */}
            <div className="flex flex-col">
              {/* Table Heading with Pill and View All */}
              <div className="flex items-center justify-between pb-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] inline-block animate-pulse" />
                  <h3 className="text-[16px] sm:text-[17px] font-black text-[#0B1F3A] uppercase tracking-tight">
                    BUY OFFERS
                  </h3>
                  <span className="bg-[#DCFCE7] text-[#15803D] text-[11px] font-black px-2.5 py-0.5 rounded-full border border-[#86EFAC]/60">
                    Want To Buy
                  </span>
                </div>
                <Link
                  href="/marketplace?tab=buy"
                  className="text-[#16A34A] hover:underline font-bold text-[12px] sm:text-[13px] flex items-center gap-1 group"
                >
                  <span>View all ({buyItems.length})</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EEF2F6] text-[10.5px] font-black uppercase tracking-wider text-[#334155]">
                      <th className="py-2 px-2.5 rounded-l-lg whitespace-nowrap">BUY/SEL</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">BRAND</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">CODE</th>
                      <th className="py-2 px-2.5">DESCRIPTION</th>
                      <th className="py-2 px-2.5 rounded-r-lg whitespace-nowrap">QTY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBuyItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#64748B] text-[13px]">
                          No buy offers match your filters.
                        </td>
                      </tr>
                    ) : (
                      visibleBuyItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          onClick={() => handleRowClick(item)}
                          className={`cursor-pointer transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                          } hover:bg-[#F0FDF4] group`}
                        >
                          <td className="py-2 px-2.5 rounded-l-lg whitespace-nowrap">
                            <span className="bg-[#DCFCE7] text-[#15803D] text-[10px] font-black px-2 py-0.5 rounded uppercase">
                              BUY
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-bold text-[#0B1F3A] text-[12.5px] whitespace-nowrap">
                            {item.brand}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[#64748B] text-[11.5px] font-medium whitespace-nowrap">
                            {item.itemCode}
                          </td>
                          <td className="py-2 px-2.5">
                            <div
                              className="font-extrabold text-[#0B1F3A] text-[12.5px] truncate max-w-[150px] sm:max-w-[190px] lg:max-w-[170px] xl:max-w-[220px] group-hover:text-[#16A34A] transition-colors"
                              title={item.description}
                            >
                              {item.description}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 font-black text-[#0B1F3A] text-[12.5px] whitespace-nowrap rounded-r-lg">
                            {item.qty.toLocaleString()} u
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. SELL OFFERS (Available Inventory - BLUE, SECOND ON RIGHT) */}
            <div className="flex flex-col">
              {/* Table Heading with Pill and View All */}
              <div className="flex items-center justify-between pb-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0A6CFF] inline-block animate-pulse" />
                  <h3 className="text-[16px] sm:text-[17px] font-black text-[#0B1F3A] uppercase tracking-tight">
                    SELL OFFERS
                  </h3>
                  <span className="bg-[#E0F2FE] text-[#0284C7] text-[11px] font-black px-2.5 py-0.5 rounded-full border border-[#7DD3FC]/60">
                    Available Stock
                  </span>
                </div>
                <Link
                  href="/marketplace?tab=sell"
                  className="text-[#0A6CFF] hover:underline font-bold text-[12px] sm:text-[13px] flex items-center gap-1 group"
                >
                  <span>View all ({sellItems.length})</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EEF2F6] text-[10.5px] font-black uppercase tracking-wider text-[#334155]">
                      <th className="py-2 px-2.5 rounded-l-lg whitespace-nowrap">BUY/SEL</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">BRAND</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">CODE</th>
                      <th className="py-2 px-2.5">DESCRIPTION</th>
                      <th className="py-2 px-2.5 rounded-r-lg whitespace-nowrap">QTY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSellItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#64748B] text-[13px]">
                          No sell offers match your filters.
                        </td>
                      </tr>
                    ) : (
                      visibleSellItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          onClick={() => handleRowClick(item)}
                          className={`cursor-pointer transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                          } hover:bg-[#EFF6FF] group`}
                        >
                          <td className="py-2 px-2.5 rounded-l-lg whitespace-nowrap">
                            <span className="bg-[#E0F2FE] text-[#0284C7] text-[10px] font-black px-2 py-0.5 rounded uppercase">
                              SELL
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-bold text-[#0B1F3A] text-[12.5px] whitespace-nowrap">
                            {item.brand}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[#64748B] text-[11.5px] font-medium whitespace-nowrap">
                            {item.itemCode}
                          </td>
                          <td className="py-2 px-2.5">
                            <div
                              className="font-extrabold text-[#0B1F3A] text-[12.5px] truncate max-w-[150px] sm:max-w-[190px] lg:max-w-[170px] xl:max-w-[220px] group-hover:text-[#0A6CFF] transition-colors"
                              title={item.description}
                            >
                              {item.description}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 font-black text-[#0B1F3A] text-[12.5px] whitespace-nowrap rounded-r-lg">
                            {item.qty.toLocaleString()} u
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Board Item Detail Modal (Locked/Unlocked with Email, Chat, Inquiry) */}
      {selectedDetailItem && (
        <TradingBoardDetailModal
          item={selectedDetailItem}
          isOpen={!!selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />
      )}

      {/* Auth Gate Modal when visitor is not logged in */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title="Verified Wholesale Access Required"
        subtitle="Sign in or create a free commercial account to view full lot specifications, unlock direct contact details, and send quotations or inquiries."
      />
    </section>
  );
}
