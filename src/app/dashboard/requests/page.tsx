'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { getBuyerWtbRequests, getPublicWtbRequests } from '@/lib/actions/wtb';
import { getBuyerReceivedQuotes, type ReceivedWtbQuote } from '@/lib/messaging/messaging-store';
import type { WtbRequest } from '@/types/database';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  Package,
  ArrowRight,
  TrendingUp,
  Search,
  ExternalLink,
  MessageSquare,
  Mail,
  Building2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';
import { TradingBoardDetailModal } from '@/components/modals/TradingBoardDetailModal';
import { PriceBadge } from '@/lib/utils/pricing';
import type { TradeMatch } from '@/lib/matching/match-types';
import { getUserMatches } from '@/lib/matching/match-types';
import {
  ALL_TRADING_BOARD_ITEMS,
  type TradingBoardItem,
} from '@/lib/trading-board-data';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { isAccountDeleted } from '@/lib/admin/admin-store';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

function DashboardRequestsContent() {
  const { company, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'board' | 'mine'>('board');

  // Global WTB Board State
  const [globalWtbItems, setGlobalWtbItems] = useState<TradingBoardItem[]>([]);
  const [boardSearch, setBoardSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [selectedDetailItem, setSelectedDetailItem] = useState<TradingBoardItem | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(true);

  // My Requests State
  const [mySearchFilter, setMySearchFilter] = useState('');
  const [myWtbList, setMyWtbList] = useState<WtbRequest[]>([]);
  const [receivedQuotes, setReceivedQuotes] = useState<ReceivedWtbQuote[]>([]);
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedMatchesReqId, setExpandedMatchesReqId] = useState<string | null>(null);
  const [createWtbOpen, setCreateWtbOpen] = useState(false);

  const buyerName = company?.contact_name || company?.email?.split('@')[0] || 'Buyer';
  const buyerCompanyName = company?.name || `${buyerName} Enterprise`;

  // 1. Load All Global WTB Requests (Trading Board)
  const refreshGlobalBoard = async () => {
    try {
      // Base sample WTBs
      const baseWtbs = ALL_TRADING_BOARD_ITEMS.filter((item) => item.type === 'BUY');

      // Local user created WTBs
      localStorage.removeItem('b2b_user_wtb_requests_v1');
      const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
      const userWtbs: TradingBoardItem[] = rawUserWtbs
        ? JSON.parse(rawUserWtbs).map((w: any) => ({
            ...w,
            pricingType: w.pricingType || (w.notes?.includes('NEG') ? 'neg' : w.notes?.includes('POA') ? 'poa' : 'fixed'),
            ean: (w.ean && w.ean !== '8806095087286' && w.ean !== '—') ? w.ean : 'n/a',
          }))
        : [];

      // Supabase Public WTBs
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
            ean: req.barcode_or_sku || 'n/a',
            qty: req.target_quantity || 50,
            condition: (req.notes?.match(/Condition:\s*([^.|]+)/i)?.[1]?.trim()) || 'New',
            price: req.target_price || 0,
            pricingType: (req as any).pricing_type || (req.notes?.includes('NEG') ? 'neg' : req.notes?.includes('POA') ? 'poa' : 'fixed'),
            currency: '€',
            location: 'EU',
            match: '96%',
            companyName: (typeof req.buyer_company === 'string' && req.buyer_company) ? req.buyer_company : 'Verified Commercial Buyer',
            contactEmail: req.buyer_email || 'procurement@b2blink.eu',
            contactName: req.buyer_name || 'Procurement Desk',
            contactPhone: req.buyer_phone || '',
            moq: Math.min(10, req.target_quantity || 10),
          }));
        }
      } catch (err) {
        console.warn('Could not load Supabase WTBs in dashboard requests:', err);
      }

      const combined = [...userWtbs, ...supabaseMapped, ...baseWtbs];
      const cleanItems = combined.filter((item) => {
        const cId = (item as any).companyId || (item as any).company_id;
        const cEmail = item.contactEmail || (item as any).buyer_email;
        if (isAccountDeleted(cId, cEmail)) return false;
        return true;
      });
      const unique = Array.from(new Map(cleanItems.map((item) => [item.id, item])).values());
      setGlobalWtbItems(unique.filter((item) => item.type === 'BUY'));
      setIsBoardLoading(false);
    } catch {
      setGlobalWtbItems(ALL_TRADING_BOARD_ITEMS.filter((item) => item.type === 'BUY'));
      setIsBoardLoading(false);
    }
  };

  // 2. Load My Requests & Quotes
  const refreshMyRequests = () => {
    if (company?.email) {
      getBuyerWtbRequests(company.email).then((data) => {
        setMyWtbList(data);
      });
      const quotes = getBuyerReceivedQuotes(company.email);
      setReceivedQuotes(quotes);
    }
  };

  useEffect(() => {
    refreshGlobalBoard();
    refreshMyRequests();

    // Listen for live creation / update events
    window.addEventListener('b2b_wtb_created', refreshGlobalBoard);
    window.addEventListener('b2b_wtb_created', refreshMyRequests);
    window.addEventListener('b2b_admin_update', refreshGlobalBoard);
    window.addEventListener('storage', refreshGlobalBoard);
    window.addEventListener('storage', refreshMyRequests);

    return () => {
      window.removeEventListener('b2b_wtb_created', refreshGlobalBoard);
      window.removeEventListener('b2b_wtb_created', refreshMyRequests);
      window.removeEventListener('b2b_admin_update', refreshGlobalBoard);
      window.removeEventListener('storage', refreshGlobalBoard);
      window.removeEventListener('storage', refreshMyRequests);
    };
  }, [company?.email]);

  // Load matches
  useEffect(() => {
    if (company?.id || company?.email) {
      const companyId = company?.id;
      const email = company?.email;
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (email) params.set('email', email);

      fetch(`/api/matches?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.matches)) {
            setMatches(data.matches);
          }
        })
        .catch(() => {
          setMatches(getUserMatches(companyId, email));
        });
    }
  }, [company?.id, company?.email]);

  // Filtered Global Board Items
  const filteredBoardItems = useMemo(() => {
    return globalWtbItems.filter((item) => {
      if (selectedCategory !== 'All categories' && item.category !== selectedCategory) return false;
      if (boardSearch.trim()) {
        const q = boardSearch.toLowerCase().trim();
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesBrand = item.brand.toLowerCase().includes(q);
        const matchesCode = item.itemCode.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesEan = item.ean.toLowerCase().includes(q);
        if (!matchesDesc && !matchesBrand && !matchesCode && !matchesCategory && !matchesEan) return false;
      }
      return true;
    });
  }, [globalWtbItems, selectedCategory, boardSearch]);

  // Filtered My Requests
  const filteredMyRequests = useMemo(() => {
    return myWtbList.filter((req) => {
      const q = mySearchFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        req.product_name.toLowerCase().includes(q) ||
        req.category_slug.toLowerCase().includes(q) ||
        (req.barcode_or_sku && req.barcode_or_sku.toLowerCase().includes(q))
      );
    });
  }, [myWtbList, mySearchFilter]);

  const totalProcurementValue = filteredMyRequests.reduce(
    (acc, req) => acc + (req.target_quantity * req.target_price),
    0
  );

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    WHOLESALE_CATEGORIES.forEach((c) => set.add(c.name));
    globalWtbItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['All categories', ...Array.from(set)];
  }, [globalWtbItems]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#16A34A] text-[12px] font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>High-Intent Commercial Procurement Demand</span>
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight">
            WTB Sourcing Requests
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal max-w-2xl">
            Browse active global buyer requirements or manage your own sourcing requests. Quote buyers directly with 0% commission.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => setCreateWtbOpen(true)}
          className="px-5 py-2.5 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-[13px] flex items-center gap-2 self-start lg:self-auto shadow-xs transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Post Sourcing Request (WTB)</span>
        </button>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#EAEFF6] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={`px-5 py-2.5 rounded-full text-[13.5px] font-extrabold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'board'
              ? 'bg-[#0B1F3A] text-white shadow-xs'
              : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Active WTB Demand Board</span>
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
            activeTab === 'board' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#0B1F3A]'
          }`}>
            <AnimatedNumber value={globalWtbItems.length} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mine')}
          className={`px-5 py-2.5 rounded-full text-[13.5px] font-extrabold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'mine'
              ? 'bg-[#0A6CFF] text-white shadow-xs'
              : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Sourcing Requests</span>
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
            activeTab === 'mine' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#0B1F3A]'
          }`}>
            <AnimatedNumber value={filteredMyRequests.length} />
          </span>
        </button>
      </div>

      {/* TAB 1: ALL WTB REQUESTS BOARD (TRADING BOARD TABLE STYLE) */}
      {activeTab === 'board' && (
        <div className="bg-white rounded-[28px] border border-[#CBD5E1] p-5 sm:p-7 shadow-[0_2px_8px_rgba(11,31,58,0.04)] flex flex-col h-[740px] max-h-[82vh] min-h-[560px] overflow-hidden">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#EAEFF6] shrink-0 bg-white z-20">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-[#0B1F3A]">
                Showing <AnimatedNumber value={filteredBoardItems.length} /> active buyer requests
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:w-[260px] lg:w-[300px]">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
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

          {/* Table */}
          <div
            className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-width:thin] pt-2"
            style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
          >
            {isBoardLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-[#16A34A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-[#5B6B82]">Loading WTB Demand Board...</p>
              </div>
            ) : (
              <table className="w-full min-w-[1020px] text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#EEF2F6] shadow-xs">
                  <tr className="bg-[#EEF2F6] text-[11px] font-black uppercase tracking-wider text-[#334155]">
                    <th className="py-3 px-3.5 rounded-l-lg bg-[#EEF2F6]">REQUEST TYPE</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">CATEGORY</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">BRAND</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">ITEM CODE</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">DESCRIPTION</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">EAN/UPC</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">QTY WANTED</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">CONDITION</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">TARGET PRICE</th>
                    <th className="py-3 px-3 bg-[#EEF2F6]">DESTINATION</th>
                    <th className="py-3 px-3 rounded-r-lg bg-[#EEF2F6]">MATCH</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoardItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-[#64748B] text-[14px]">
                        No active WTB requests match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBoardItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedDetailItem(item)}
                        className={`cursor-pointer transition-colors duration-75 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                        } hover:bg-[#F0FDF4] group`}
                        style={{
                          contentVisibility: 'auto',
                          containIntrinsicSize: 'auto 48px',
                        }}
                      >
                        {/* 1. Request Type */}
                        <td className="py-3.5 px-3.5 rounded-l-lg whitespace-nowrap">
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-md inline-block uppercase tracking-wider bg-[#DCFCE7] text-[#15803D]">
                            BUY
                          </span>
                        </td>

                        {/* 2. Category */}
                        <td className="py-3.5 px-3 text-[13px] text-[#475569] font-medium whitespace-nowrap">
                          {item.category}
                        </td>

                        {/* 3. Brand */}
                        <td className="py-3.5 px-3 text-[13.5px] font-extrabold text-[#0B1F3A] whitespace-nowrap">
                          {item.brand}
                        </td>

                        {/* 4. Code */}
                        <td className="py-3.5 px-3 text-[12px] font-mono text-[#64748B] whitespace-nowrap">
                          {item.itemCode}
                        </td>

                        {/* 5. Description */}
                        <td className="py-3.5 px-3">
                          <div
                            className="font-extrabold text-[#0B1F3A] text-[13.5px] truncate max-w-[260px] sm:max-w-[320px] group-hover:text-[#16A34A] transition-colors"
                            title={item.description}
                          >
                            {item.description}
                          </div>
                        </td>

                        {/* 6. EAN */}
                        <td className="py-3.5 px-3 text-[12px] font-mono text-[#475569] whitespace-nowrap">
                          {item.ean && item.ean !== '195949048735' && item.ean !== '8806095087286' && item.ean !== '—' ? item.ean : 'n/a'}
                        </td>

                        {/* 7. Qty */}
                        <td className="py-3.5 px-3 text-[13.5px] font-black text-[#0B1F3A] whitespace-nowrap">
                          {item.qty.toLocaleString()}
                        </td>

                        {/* 8. Condition */}
                        <td className="py-3.5 px-3 text-[12.5px] text-[#475569] font-medium whitespace-nowrap">
                          {item.condition}
                        </td>

                        {/* 9. Target Price */}
                        <td className="py-3.5 px-3 text-[14px] font-black text-[#0B1F3A] whitespace-nowrap">
                          <PriceBadge price={item.price} pricingType={item.pricingType} currency={item.currency} />
                        </td>

                        {/* 10. Location */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] text-[11px] font-mono font-bold">
                            {item.location}
                          </span>
                        </td>

                        {/* 11. Match */}
                        <td className="py-3.5 px-3 rounded-r-lg whitespace-nowrap">
                          <span className="bg-[#DCFCE7] text-[#15803D] text-[11px] font-black px-2 py-0.5 rounded">
                            {item.match}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY SOURCING REQUESTS (EXISTING REQUESTS & RECEIVED QUOTES TRACKER) */}
      {activeTab === 'mine' && (
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-[#EAEFF6] shadow-xs">
              <div className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Active Requests
              </div>
              <div className="text-[28px] font-black text-[#0B1F3A]">
                {filteredMyRequests.length}
              </div>
              <div className="text-[12px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Broadcasted across global suppliers</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EAEFF6] shadow-xs">
              <div className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Supplier Quotes Received
              </div>
              <div className="text-[28px] font-black text-[#0A6CFF]">
                {receivedQuotes.length}
              </div>
              <div className="text-[12px] text-[#5B6B82] font-medium mt-1">
                Direct offers from verified suppliers
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EAEFF6] shadow-xs">
              <div className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Procurement Value
              </div>
              <div className="text-[28px] font-black text-[#0B1F3A]">
                €{totalProcurementValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-[12px] text-[#5B6B82] font-medium mt-1">
                Aggregated target batch value
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#EAEFF6] flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mySearchFilter}
                onChange={(e) => setMySearchFilter(e.target.value)}
                placeholder="Search your requests by product name, category, or barcode..."
                className="w-full pl-9 pr-4 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-full text-[#0B1F3A] placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-2xl border border-[#EAEFF6] overflow-hidden shadow-xs">
            {filteredMyRequests.length === 0 ? (
              <div className="p-12 text-center text-[#5B6B82]">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-[#0B1F3A] text-base">No personal WTB requests found</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Post a procurement request to receive quotes from verified distributors.</p>
                <button
                  type="button"
                  onClick={() => setCreateWtbOpen(true)}
                  className="bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Request</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredMyRequests.map((req) => {
                  const quotesForThisReq = receivedQuotes.filter(
                    (q) => q.wtbRequestId === req.id || q.productName === req.product_name
                  );
                  const matchesForThisReq = matches.filter(
                    (m) =>
                      m.wtbId === req.id ||
                      (m.wtbProductName && m.wtbProductName.toLowerCase() === req.product_name.toLowerCase()) ||
                      (m.wtbBarcode && req.barcode_or_sku && m.wtbBarcode === req.barcode_or_sku)
                  );
                  const isExpanded = expandedRequestId === req.id;
                  const isMatchesExpanded = expandedMatchesReqId === req.id;

                  return (
                    <div key={req.id} className="p-5 space-y-4 hover:bg-slate-50/40 transition">
                      {/* Top summary row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                              {req.category_slug}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Broadcast
                            </span>

                            {matchesForThisReq.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                                <span>{matchesForThisReq.length} Matching Stock {matchesForThisReq.length === 1 ? 'Lot' : 'Lots'} Available</span>
                              </span>
                            )}

                            {quotesForThisReq.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                <Sparkles className="w-3 h-3 text-[#0A6CFF]" />
                                <span>{quotesForThisReq.length} Supplier {quotesForThisReq.length === 1 ? 'Quote' : 'Quotes'} Received</span>
                              </span>
                            ) : (
                              matchesForThisReq.length === 0 && (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  Awaiting supplier offers
                                </span>
                              )
                            )}
                          </div>

                          <h3 className="text-[17px] font-bold text-[#0B1F3A]">
                            {req.product_name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#5B6B82] mt-2">
                            <div>
                              Target: <strong className="text-[#0B1F3A]">{req.target_quantity.toLocaleString()} units</strong>
                            </div>
                            <div>
                              Target Price:{' '}
                              <PriceBadge price={req.target_price} pricingType={req.pricing_type} />
                            </div>
                            <div>
                              Total Budget:{' '}
                              <strong className="text-[#0B1F3A]">
                                {req.pricing_type === 'neg'
                                  ? 'Negotiable'
                                  : req.pricing_type === 'poa'
                                  ? 'On Application'
                                  : `€${(req.target_quantity * req.target_price).toLocaleString()}`}
                              </strong>
                            </div>
                            {req.barcode_or_sku && (
                              <div className="text-slate-400 font-mono text-[11px]">
                                SKU: {req.barcode_or_sku}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {matchesForThisReq.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedMatchesReqId(isMatchesExpanded ? null : req.id)}
                              className="text-[12px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                              <span>{isMatchesExpanded ? 'Hide Stock Matches' : `View ${matchesForThisReq.length} Stock Matches`}</span>
                              {isMatchesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {quotesForThisReq.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                              className="text-[12px] font-bold bg-[#EBF3FF] hover:bg-[#D8EAFF] text-[#0A6CFF] px-3.5 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide Quotes' : `View ${quotesForThisReq.length} Quotes`}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          <Link
                            href="/dashboard/inquiries"
                            className="text-[12px] font-bold text-[#0A6CFF] hover:bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full transition"
                          >
                            Inquiries Desk
                          </Link>

                          <button
                            type="button"
                            onClick={() => setActiveTab('board')}
                            className="text-[12px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-full transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>Demand Board</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Stock Matches list */}
                      {matchesForThisReq.length > 0 && isMatchesExpanded && (
                        <div className="pt-2 pl-4 border-l-2 border-emerald-300 space-y-2.5">
                          <div className="text-[12px] font-bold text-emerald-900 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                            <span>Available Wholesale Stock Matching This Request:</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {matchesForThisReq.map((match) => (
                              <div
                                key={match.id}
                                className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-3 text-[12.5px]"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-[#0B1F3A] truncate">
                                    {match.wtsTitle || match.wtbProductName}
                                  </div>
                                  <div className="text-slate-500 text-[11.5px] mt-0.5">
                                    {match.wtsQuantityAvailable} units available &bull; €{match.wtsUnitPrice} / unit &bull; Location: {match.wtsLocation || 'DE'}
                                  </div>
                                </div>
                                <Link
                                  href={`/dashboard/matches?product=${encodeURIComponent(req.product_name)}`}
                                  className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 transition"
                                >
                                  Unlock &amp; Quote
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expandable Quotes list */}
                      {quotesForThisReq.length > 0 && isExpanded && (
                        <div className="pt-2 pl-4 border-l-2 border-blue-300 space-y-2.5">
                          <div className="text-[12px] font-bold text-blue-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#0A6CFF]" />
                            <span>Binding Supplier Quotations Received:</span>
                          </div>
                          <div className="space-y-2">
                            {quotesForThisReq.map((quote) => (
                              <div
                                key={quote.id}
                                className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px]"
                              >
                                <div>
                                  <div className="font-bold text-[#0B1F3A] flex items-center gap-2">
                                    <span>{quote.sellerCompanyName}</span>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                                      Offered: €{(quote.offeredPrice ?? 0).toFixed(2)} / unit
                                    </span>
                                  </div>
                                  <div className="text-slate-600 text-[12px] mt-1">
                                    Available: {quote.offeredQuantity ?? 0} units &bull; Lead Time: {quote.leadTimeDays || 3} days &bull; Total: €{(quote.totalPrice ?? ((quote.offeredPrice ?? 0) * (quote.offeredQuantity ?? 0))).toLocaleString()}
                                  </div>
                                  {quote.notes && (
                                    <div className="text-[11.5px] text-slate-500 italic mt-0.5">
                                      &ldquo;{quote.notes}&rdquo;
                                    </div>
                                  )}
                                </div>
                                <Link
                                  href={`/dashboard/inquiries?quote=${quote.id}`}
                                  className="px-4 py-1.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[12px] shrink-0 transition text-center shadow-xs"
                                >
                                  Open Conversation
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trading Board Detail & Quoting Modal */}
      {selectedDetailItem && (
        <TradingBoardDetailModal
          isOpen={Boolean(selectedDetailItem)}
          onClose={() => setSelectedDetailItem(null)}
          item={selectedDetailItem}
        />
      )}

      {/* Create WTB Modal */}
      {createWtbOpen && (
        <CreateWtbModal
          isOpen={createWtbOpen}
          onClose={() => setCreateWtbOpen(false)}
          onSuccess={() => {
            refreshGlobalBoard();
            refreshMyRequests();
            setCreateWtbOpen(false);
          }}
          initialMode="WTB"
        />
      )}
    </div>
  );
}

export default function DashboardRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] flex items-center justify-center p-8 bg-white rounded-[28px] border border-[#EAEFF6]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#16A34A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <h4 className="text-[16px] font-bold text-[#0B1F3A]">Loading WTB Sourcing Requests...</h4>
          </div>
        </div>
      }
    >
      <DashboardRequestsContent />
    </Suspense>
  );
}
