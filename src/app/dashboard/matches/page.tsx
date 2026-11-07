'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type { TradeMatch } from '@/lib/matching/match-types';
import { getUserMatches, dismissMatch } from '@/lib/matching/match-types';
import { ALL_TRADING_BOARD_ITEMS, type TradingBoardItem } from '@/lib/trading-board-data';
import {
  isLeadUnlocked,
  unlockLead,
  getRemainingUnlocks,
  getUnlockedLeadIds,
} from '@/lib/leads/unlock-store';
import { submitQuotation } from '@/lib/actions/quotations';
import { dispatchWtbLeadToBuyerDashboard } from '@/lib/messaging/messaging-store';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { MembershipTier } from '@/types/database';
import {
  Zap,
  Lock,
  Unlock,
  CheckCircle2,
  Building2,
  User,
  Mail,
  Phone,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Send,
  X,
  Sparkles,
  ChevronDown,
  Clock,
  Package,
  Layers,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface ListingItem {
  id: string;
  title: string;
  brand?: string;
  itemCode?: string;
  condition?: string;
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  available: number;
  moq: number;
  location?: string;
  status: string;
  createdAt?: string;
}

function MatchingStockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company, role, isLoading: authLoading } = useAuth();

  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'wtb' | 'wts' | 'unlocked' | 'quoted'>('all');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Contact Unlocks tracking
  const [unlockTrigger, setUnlockTrigger] = useState(0);

  // Quote Composer Modal
  const [quotingMatch, setQuotingMatch] = useState<TradeMatch | null>(null);
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteQty, setQuoteQty] = useState<number>(100);
  const [quoteLeadDays, setQuoteLeadDays] = useState<number>(3);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteSuccessMsg, setQuoteSuccessMsg] = useState<string | null>(null);

  // Read product filter from URL query
  const productFilterParam = searchParams.get('product') || '';
  const [activeProductFilter, setActiveProductFilter] = useState<string>(productFilterParam);

  useEffect(() => {
    if (productFilterParam) {
      setActiveProductFilter(productFilterParam);
    }
  }, [productFilterParam]);

  const currentTier = ((company?.tier || (company as any)?.membership_tier || 'bronze') as MembershipTier);
  const isGold = currentTier === 'gold';
  const companyId = company?.id || '';
  const userEmail = company?.email?.toLowerCase().trim() || '';

  const remainingUnlocks = companyId ? getRemainingUnlocks(companyId, currentTier) : 0;
  const unlockedLeadIds = useMemo(() => {
    return companyId ? getUnlockedLeadIds(companyId) : [];
  }, [companyId, unlockTrigger]);

  // Load and synthesize smart matches from server & active listings
  const loadMatches = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (userEmail) params.set('email', userEmail);

      let serverMatches: TradeMatch[] = [];
      try {
        const res = await fetch(`/api/matches?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.matches)) {
            serverMatches = data.matches;
          }
        }
      } catch (err) {
        console.warn('[MATCHES API NOTICE]', err);
      }

      // Merge with client store matches
      const localMatches = getUserMatches(companyId, userEmail);
      const matchMap = new Map<string, TradeMatch>();

      serverMatches.forEach((m) => matchMap.set(m.id, m));
      localMatches.forEach((m) => matchMap.set(m.id, m));

      // Also dynamically synthesize matches from user's active listings in localStorage
      // against the active WTB demand board (400 items)
      try {
        const rawListings = localStorage.getItem('b2b_seller_listings_v3');
        const userListings: ListingItem[] = rawListings ? JSON.parse(rawListings) : [];

        const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
        const userWtbs = rawWtb ? JSON.parse(rawWtb) : [];
        const combinedWtbPool = [...ALL_TRADING_BOARD_ITEMS, ...userWtbs];

        for (const lst of userListings) {
          if (lst.status === 'Unpublished') continue;
          const lstTitleNorm = lst.title.toLowerCase().trim();
          const lstBrandNorm = (lst.brand || '').toLowerCase().trim();
          const lstEanNorm = lst.ean && lst.ean !== 'n/a' ? lst.ean.trim() : '';

          for (const item of combinedWtbPool) {
            if (item.type !== 'BUY') continue;
            const wtbDescNorm = (item.description || '').toLowerCase().trim();
            const wtbBrandNorm = (item.brand || '').toLowerCase().trim();
            const wtbEanNorm = item.ean && item.ean !== 'n/a' ? item.ean.trim() : '';

            const isExactBarcode = Boolean(lstEanNorm && wtbEanNorm && lstEanNorm === wtbEanNorm);
            const isTitleMatch =
              (lstBrandNorm && wtbBrandNorm && lstBrandNorm === wtbBrandNorm && (wtbDescNorm.includes(lstTitleNorm) || lstTitleNorm.includes(wtbDescNorm))) ||
              (lstTitleNorm.length > 5 && wtbDescNorm.length > 5 && (wtbDescNorm.includes(lstTitleNorm) || lstTitleNorm.includes(wtbDescNorm)));

            if (isExactBarcode || isTitleMatch) {
              const synthId = `match-cat-${lst.id}-${item.id}`;
              if (!matchMap.has(synthId)) {
                matchMap.set(synthId, {
                  id: synthId,
                  matchType: isExactBarcode ? 'exact_barcode' : 'title_keyword',
                  triggerDirection: 'wts_created',
                  confidence: isExactBarcode ? 100 : 94,
                  createdAt: lst.createdAt || new Date().toISOString(),

                  wtbId: item.id,
                  wtbProductName: item.description,
                  wtbBarcode: item.ean || lst.ean,
                  wtbTargetPrice: item.price,
                  wtbTargetQuantity: item.qty,
                  buyerCompanyId: `buyer-comp-${item.id}`,
                  buyerCompanyName: item.companyName || 'Verified Procurement Partner',
                  buyerEmail: item.contactEmail || 'purchasing@euro-trade.eu',
                  buyerPhone: item.contactPhone || '+49 69 9482 1039',

                  wtsProductId: lst.id,
                  wtsTitle: lst.title,
                  wtsBarcode: lst.ean,
                  wtsUnitPrice: lst.unitPrice,
                  wtsQuantityAvailable: lst.available,
                  wtsCondition: lst.condition || 'New',
                  wtsLocation: lst.location || 'DE',
                  sellerCompanyId: companyId,
                  sellerCompanyName: company?.name || 'Your Company',
                  sellerEmail: userEmail,
                  sellerPhone: company?.phone || null,
                });
              }
            }
          }
        }
      } catch (synthErr) {
        console.warn('[MATCH SYNTHESIS NOTICE]', synthErr);
      }

      setMatches(Array.from(matchMap.values()));
    } catch (err) {
      console.warn('[LOAD MATCHES ERROR]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();

    const handleUpdate = () => loadMatches();
    const handleUnlockEvent = () => setUnlockTrigger((prev) => prev + 1);

    window.addEventListener('b2b_trade_matches_updated', handleUpdate);
    window.addEventListener('b2b_listings_updated', handleUpdate);
    window.addEventListener('b2b_lead_unlock_update', handleUnlockEvent);
    window.addEventListener('b2b_quotes_updated', handleUnlockEvent);

    return () => {
      window.removeEventListener('b2b_trade_matches_updated', handleUpdate);
      window.removeEventListener('b2b_listings_updated', handleUpdate);
      window.removeEventListener('b2b_lead_unlock_update', handleUnlockEvent);
      window.removeEventListener('b2b_quotes_updated', handleUnlockEvent);
    };
  }, [companyId, userEmail]);

  // Check if a specific match is unlocked
  const checkIsUnlocked = (match: TradeMatch): boolean => {
    if (!companyId) return false;
    return isLeadUnlocked(companyId, match.id) || isLeadUnlocked(companyId, match.wtbId) || isLeadUnlocked(companyId, match.wtsProductId);
  };

  // Check if a quote has already been sent for this match
  const checkIsQuoted = (match: TradeMatch): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const quotesKey = companyId ? `b2b_sent_quotes_${companyId}` : 'b2b_sent_quotes_v2';
      const raw = localStorage.getItem(quotesKey);
      if (!raw) return false;
      const quotes = JSON.parse(raw);
      if (!Array.isArray(quotes)) return false;
      return quotes.some(
        (q: any) =>
          q.product === match.wtbProductName ||
          q.product === match.wtsTitle ||
          q.buyer === match.buyerCompanyName ||
          q.buyerEmail === match.buyerEmail
      );
    } catch {
      return false;
    }
  };

  // Handle lead unlock
  const handleUnlockMatch = (match: TradeMatch) => {
    if (!companyId) {
      alert('Please log in to unlock counterparty details.');
      return;
    }

    const res = unlockLead(companyId, match.id, currentTier);
    if (res.success) {
      if (match.wtbId) {
        unlockLead(companyId, match.wtbId, currentTier);
      }
      setFeedbackNotice(`Successfully unlocked counterparty details for "${match.wtbProductName || match.wtsTitle}"! You can now send an official quotation.`);
      setTimeout(() => setFeedbackNotice(null), 5000);
      setUnlockTrigger((prev) => prev + 1);
    } else {
      setUpgradeModalOpen(true);
    }
  };

  // Handle open Quote modal
  const handleOpenQuoteModal = (match: TradeMatch) => {
    // If not unlocked yet, prompt unlock first
    if (!checkIsUnlocked(match)) {
      handleUnlockMatch(match);
      return;
    }

    setQuotingMatch(match);
    setQuotePrice(String(match.wtbTargetPrice || match.wtsUnitPrice || 500));
    setQuoteQty(match.wtbTargetQuantity || 50);
    setQuoteLeadDays(3);
    setQuoteNotes(`Offered stock matching your procurement requirement for ${match.wtbProductName || match.wtsTitle}. Inspected and ready for immediate European dispatch.`);
    setQuoteSuccessMsg(null);
  };

  // Submit quote
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotingMatch || !companyId || !company) return;

    const priceNum = parseFloat(quotePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid unit price.');
      return;
    }

    setIsSubmittingQuote(true);
    try {
      // 1. Submit through quotations action
      await submitQuotation({
        wtbRequestId: quotingMatch.wtbId,
        sellerCompanyId: companyId,
        sellerEmail: userEmail,
        unitPrice: priceNum,
        quantityOffered: quoteQty,
        leadTimeDays: quoteLeadDays,
        notes: quoteNotes,
      });

      // 2. Dispatch to buyer dashboard & create live inquiry thread
      const mockWtbRequest = {
        id: quotingMatch.wtbId,
        buyer_user_id: quotingMatch.buyerCompanyId,
        buyer_company_id: quotingMatch.buyerCompanyId,
        buyer_company: quotingMatch.buyerCompanyName,
        buyer_name: quotingMatch.buyerCompanyName,
        buyer_email: quotingMatch.buyerEmail,
        buyer_phone: quotingMatch.buyerPhone || undefined,
        product_name: quotingMatch.wtbProductName,
        category_slug: 'consumer-electronics',
        target_quantity: quotingMatch.wtbTargetQuantity,
        target_price: quotingMatch.wtbTargetPrice,
        status: 'open' as const,
        created_at: quotingMatch.createdAt,
      };

      dispatchWtbLeadToBuyerDashboard({
        wtbRequest: mockWtbRequest as any,
        sellerCompany: company,
        actionType: 'quote_submitted',
        quoteDetails: {
          unitPrice: priceNum,
          quantity: quoteQty,
          totalPrice: priceNum * quoteQty,
          notes: quoteNotes,
          leadTimeDays: quoteLeadDays,
        },
      });

      // 3. Save to seller's local quotes store so it shows in /dashboard/quotes
      try {
        const quotesKey = `b2b_sent_quotes_${companyId}`;
        const raw = localStorage.getItem(quotesKey);
        const existing = raw ? JSON.parse(raw) : [];
        const newRecord = {
          id: `sq-${Date.now()}`,
          product: quotingMatch.wtbProductName || quotingMatch.wtsTitle,
          category: 'Consumer Electronics',
          buyer: quotingMatch.buyerCompanyName,
          buyerContact: quotingMatch.buyerCompanyName,
          buyerEmail: quotingMatch.buyerEmail,
          buyerPhone: quotingMatch.buyerPhone || '',
          yourPrice: priceNum,
          quantity: quoteQty,
          sentDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          leadTimeDays: quoteLeadDays,
          notes: quoteNotes,
          requestTargetPrice: quotingMatch.wtbTargetPrice,
          requestTargetQuantity: quotingMatch.wtbTargetQuantity,
          requestBarcode: quotingMatch.wtbBarcode,
          requestNotes: `Direct quote for matched stock: ${quotingMatch.wtsTitle}`,
          status: 'Sent',
        };
        localStorage.setItem(quotesKey, JSON.stringify([newRecord, ...existing]));
        window.dispatchEvent(new CustomEvent('b2b_quotes_updated'));
      } catch {}

      setQuoteSuccessMsg(`Official quotation of €${priceNum.toFixed(2)} sent directly to ${quotingMatch.buyerCompanyName}! Direct negotiation thread created.`);
      setTimeout(() => {
        setQuotingMatch(null);
        setQuoteSuccessMsg(null);
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit quote.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = (m.wtsTitle || '').toLowerCase().includes(q) || (m.wtbProductName || '').toLowerCase().includes(q);
        const matchesBuyer = (m.buyerCompanyName || '').toLowerCase().includes(q);
        const matchesSeller = (m.sellerCompanyName || '').toLowerCase().includes(q);
        const matchesBarcode = (m.wtsBarcode || '').includes(q) || (m.wtbBarcode || '').includes(q);
        if (!matchesTitle && !matchesBuyer && !matchesSeller && !matchesBarcode) {
          return false;
        }
      }

      // 2. Product-specific filter from URL (e.g. from bundled cards)
      if (activeProductFilter.trim()) {
        const pf = activeProductFilter.toLowerCase().trim();
        const matchesProduct =
          (m.wtsTitle || '').toLowerCase().includes(pf) ||
          pf.includes((m.wtsTitle || '').toLowerCase()) ||
          (m.wtbProductName || '').toLowerCase().includes(pf) ||
          pf.includes((m.wtbProductName || '').toLowerCase());
        if (!matchesProduct) return false;
      }

      // 3. Status pill filter
      const isUnlocked = checkIsUnlocked(m);
      const isQuoted = checkIsQuoted(m);
      const isUserSeller = (companyId && m.sellerCompanyId === companyId) || (userEmail && m.sellerEmail?.toLowerCase() === userEmail);
      const isUserBuyer = (companyId && m.buyerCompanyId === companyId) || (userEmail && m.buyerEmail?.toLowerCase() === userEmail);

      if (selectedFilter === 'wtb') return isUserSeller; // Buyer wants to buy from our seller inventory
      if (selectedFilter === 'wts') return isUserBuyer;  // Seller has stock matching our WTB request
      if (selectedFilter === 'unlocked') return isUnlocked;
      if (selectedFilter === 'quoted') return isQuoted;

      return true;
    });
  }, [matches, searchQuery, activeProductFilter, selectedFilter, companyId, userEmail, unlockedLeadIds, unlockTrigger]);

  const wtbMatchesCount = matches.filter((m) => (companyId && m.sellerCompanyId === companyId) || (userEmail && m.sellerEmail?.toLowerCase() === userEmail)).length;
  const wtsMatchesCount = matches.filter((m) => (companyId && m.buyerCompanyId === companyId) || (userEmail && m.buyerEmail?.toLowerCase() === userEmail)).length;
  const unlockedCount = matches.filter((m) => checkIsUnlocked(m)).length;

  return (
    <div className="space-y-6 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#0A6CFF]/10 text-[#0A6CFF] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#0A6CFF]/20 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-[#0A6CFF]" />
              <span>Smart Trading Matches</span>
            </span>
            {remainingUnlocks > 0 && remainingUnlocks !== Infinity ? (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {remainingUnlocks} Unlocks Remaining
              </span>
            ) : remainingUnlocks === Infinity ? (
              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Unlimited Unlocks (Gold)
              </span>
            ) : (
              <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                0 Unlocks Remaining
              </span>
            )}
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Matching Stock &amp; Counterparties
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Verified counterparties algorithmically paired with your physical stock lots and purchase orders. Unlock direct contact credentials to submit binding quotes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadMatches}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#EAEFF6] text-[#0B1F3A] font-bold text-[13px] rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Scan for latest matches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Matches</span>
          </button>

          {!isGold && (
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="px-5 py-2 bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Unlimited Unlocks</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Feedback Notice */}
      {feedbackNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Product-Specific Filter Pill (if navigated with ?product=...) */}
      {activeProductFilter && (
        <div className="p-3 px-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0A6CFF]">Filtered by Product:</span>
            <span className="font-extrabold text-[#0B1F3A]">&ldquo;{activeProductFilter}&rdquo;</span>
            <span className="text-slate-500 text-xs">({filteredMatches.length} matches found)</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveProductFilter('')}
            className="text-[12px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Show all products</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#5B6B82] border border-[#EAEFF6] hover:bg-[#F8FAFC]'
            }`}
          >
            <span>All Matches</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${selectedFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <AnimatedNumber value={matches.length} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('wtb')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedFilter === 'wtb'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-[#5B6B82] border border-[#EAEFF6] hover:bg-[#F8FAFC]'
            }`}
          >
            <span>Waiting Buyers</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${selectedFilter === 'wtb' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>
              <AnimatedNumber value={wtbMatchesCount} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('unlocked')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedFilter === 'unlocked'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-[#5B6B82] border border-[#EAEFF6] hover:bg-[#F8FAFC]'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Unlocked Counterparties</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${selectedFilter === 'unlocked' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
              <AnimatedNumber value={unlockedCount} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('quoted')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedFilter === 'quoted'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-[#5B6B82] border border-[#EAEFF6] hover:bg-[#F8FAFC]'
            }`}
          >
            <span>Quotes Sent</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brand, model, barcode or trader..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Matches Grid */}
      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-[28px] border border-[#EAEFF6]">
          <RefreshCw className="w-8 h-8 text-[#0A6CFF] animate-spin mx-auto mb-3" />
          <h4 className="text-[16px] font-bold text-[#0B1F3A]">Scanning European counterparty pool...</h4>
          <p className="text-[13px] text-[#5B6B82] mt-1">Comparing barcodes, condition grades, and target wholesale pricing.</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-[28px] border border-[#EAEFF6] p-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0A6CFF] mx-auto flex items-center justify-center mb-3">
            <Zap className="w-7 h-7" />
          </div>
          <h3 className="text-[18px] font-extrabold text-[#0B1F3A] mb-1">
            {searchQuery || activeProductFilter ? 'No matches found for your filter' : 'No active counterparty matches right now'}
          </h3>
          <p className="text-[13.5px] text-[#5B6B82] max-w-md mx-auto leading-relaxed mb-5">
            {searchQuery || activeProductFilter
              ? 'Try clearing your search query or product filter to view all available matches.'
              : 'When you list wholesale stock lots or post WTB requests, our engine will automatically pair you with counterparty traders in real time.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {activeProductFilter && (
              <button
                type="button"
                onClick={() => setActiveProductFilter('')}
                className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
              >
                Clear Product Filter
              </button>
            )}
            <Link
              href="/dashboard/listings"
              className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition shadow-xs"
            >
              Manage Catalog &amp; List Stock
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
            const isUnlocked = checkIsUnlocked(match);
            const isQuoted = checkIsQuoted(match);
            const isBarcodeMatch = match.matchType === 'exact_barcode';
            const totalDealValue = (match.wtbTargetPrice || 0) * (match.wtbTargetQuantity || 1);

            return (
              <div
                key={match.id}
                className={`bg-white rounded-[26px] border transition shadow-[0_4px_24px_rgba(11,31,58,0.02)] overflow-hidden ${
                  isUnlocked ? 'border-emerald-200 ring-1 ring-emerald-500/10' : 'border-[#EAEFF6] hover:border-blue-200'
                }`}
              >
                {/* Top Match Bar */}
                <div className="px-6 py-3.5 bg-slate-50/70 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-extrabold text-[#0A6CFF] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                      <Zap className="w-3 h-3 fill-[#0A6CFF]" />
                      <span>{match.confidence}% Match ({isBarcodeMatch ? 'Exact Barcode' : 'Title & Spec'})</span>
                    </span>
                    <span className="text-[#8A9BB0]">&bull;</span>
                    <span className="font-semibold text-[#5B6B82]">Matched with Active Buying Order</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isQuoted ? (
                      <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Quote Dispatched</span>
                      </span>
                    ) : isUnlocked ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Unlock className="w-3 h-3 text-emerald-600" />
                        <span>Counterparty Unlocked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Contact Info Locked</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Content: Split Stock Lot vs Matched Counterparty Requirement */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left Column: Your Physical Stock Lot (5 cols) */}
                  <div className="lg:col-span-5 space-y-2 border-b lg:border-b-0 lg:border-r border-[#F1F5F9] pb-5 lg:pb-0 lg:pr-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Your Inventory Stock Lot
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {match.wtsCondition || 'New'}
                      </span>
                    </div>

                    <h3 className="text-[17px] font-extrabold text-[#0B1F3A] leading-snug">
                      {match.wtsTitle || match.wtbProductName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#5B6B82]">
                      <div>
                        Your Unit Price:{' '}
                        <strong className="text-[#0B1F3A]">€{(match.wtsUnitPrice || 0).toFixed(2)}</strong>
                      </div>
                      <div>&bull;</div>
                      <div>
                        Available:{' '}
                        <strong className="text-[#0B1F3A]">{(match.wtsQuantityAvailable || 0).toLocaleString()} u</strong>
                      </div>
                      <div>&bull;</div>
                      <div>
                        Location:{' '}
                        <span className="font-mono font-bold text-[#0A6CFF]">{match.wtsLocation || 'DE'}</span>
                      </div>
                    </div>

                    {match.wtsBarcode && match.wtsBarcode !== 'n/a' && (
                      <div className="text-[11.5px] font-mono text-slate-400">
                        EAN: <span className="text-[#0B1F3A] font-semibold">{match.wtsBarcode}</span>
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Matched Buyer Demand Specifications (4 cols) */}
                  <div className="lg:col-span-4 space-y-2.5 border-b lg:border-b-0 lg:border-r border-[#F1F5F9] pb-5 lg:pb-0 lg:pr-6">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0A6CFF]">
                      Counterparty Purchase Requirement
                    </span>

                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-black text-[#059669]">
                          €{match.wtbTargetPrice.toFixed(2)}
                        </span>
                        <span className="text-[12px] text-[#5B6B82] font-semibold">target price</span>
                      </div>
                      <div className="text-[12.5px] text-[#5B6B82] mt-0.5">
                        Quantity Needed: <strong className="text-[#0B1F3A] font-bold">{match.wtbTargetQuantity.toLocaleString()} units</strong>
                      </div>
                      <div className="text-[11.5px] text-slate-400 mt-0.5">
                        Est. Trade Volume: <span className="font-bold text-[#0B1F3A]">€{totalDealValue.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Reveal / Locked Profile Card */}
                    <div className={`p-3 rounded-xl border text-[12px] transition ${
                      isUnlocked
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <Building2 className={`w-3.5 h-3.5 ${isUnlocked ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="truncate">
                          {isUnlocked ? match.buyerCompanyName : 'Verified European Tech Distributor'}
                        </span>
                      </div>

                      {isUnlocked ? (
                        <div className="space-y-0.5 text-[11.5px] text-[#0B1F3A]">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <a href={`mailto:${match.buyerEmail}`} className="hover:underline font-semibold text-[#0A6CFF]">
                              {match.buyerEmail}
                            </a>
                          </div>
                          {match.buyerPhone && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <a href={`tel:${match.buyerPhone}`} className="hover:underline font-semibold">
                                {match.buyerPhone}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Direct trading credentials protected. Click unlock to view.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions (Quote or Unlock) (3 cols) */}
                  <div className="lg:col-span-3 flex flex-col gap-2.5">
                    {isUnlocked ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenQuoteModal(match)}
                          className="w-full py-2.5 px-4 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Quote Them Now</span>
                        </button>

                        <Link
                          href="/dashboard/inquiries"
                          className="w-full py-2 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[12px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Open Inquiries Desk</span>
                        </Link>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUnlockMatch(match)}
                          className="w-full py-2.5 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Unlock Contact Info</span>
                        </button>

                        <div className="text-center text-[11px] text-slate-400 font-medium">
                          {remainingUnlocks === Infinity ? (
                            'Unlimited unlocks on Gold Plan'
                          ) : (
                            <span>Uses 1 contact unlock ({remainingUnlocks} left)</span>
                          )}
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => dismissMatch(match.id, false)}
                      className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600 transition text-center pt-1"
                    >
                      Hide match
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quote Composer Modal */}
      {quotingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-[32px] border border-[#EAEFF6] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF]">
                  Submit Formal Quotation
                </span>
                <h3 className="text-[20px] font-black text-white mt-0.5">
                  Quote for {quotingMatch.buyerCompanyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuotingMatch(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {quoteSuccessMsg ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-[18px] font-bold text-[#0B1F3A]">Quotation Sent!</h4>
                  <p className="text-[13px] text-[#5B6B82] max-w-sm mx-auto">{quoteSuccessMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] space-y-1">
                    <div className="font-bold text-[#0B1F3A] truncate">
                      {quotingMatch.wtbProductName || quotingMatch.wtsTitle}
                    </div>
                    <div className="text-[#5B6B82]">
                      Target Buyer Price: <strong className="text-emerald-700">€{quotingMatch.wtbTargetPrice.toFixed(2)}</strong> &bull; Quantity: <strong>{quotingMatch.wtbTargetQuantity} u</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                        Your Offered Unit Price (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={quotePrice}
                        onChange={(e) => setQuotePrice(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                        Offered Quantity (units) *
                      </label>
                      <input
                        type="number"
                        required
                        value={quoteQty}
                        onChange={(e) => setQuoteQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-bold focus:outline-none focus:border-[#0A6CFF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Lead Time / Dispatch Window (days)
                    </label>
                    <input
                      type="number"
                      value={quoteLeadDays}
                      onChange={(e) => setQuoteLeadDays(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 text-[13.5px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Commercial Terms &amp; Notes
                    </label>
                    <textarea
                      rows={3}
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      placeholder="e.g. Price includes standard European insurance and palletizing. Inspection welcome."
                      className="w-full px-3.5 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setQuotingMatch(null)}
                      className="px-5 py-2.5 rounded-full text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuote}
                      className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingQuote ? 'Dispatching Quote...' : 'Submit Binding Quote'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Membership Modal for contact unlocks */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Contact Unlock Allowance Exhausted"
        subtitle="You have used all direct contact unlocks included in your current plan. Upgrade to Gold for unlimited contact unlocks, verified buyer leads, and priority broker matching."
      />
    </div>
  );
}

export default function MatchingStockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] flex items-center justify-center p-8 bg-white rounded-[28px] border border-[#EAEFF6]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <h4 className="text-[16px] font-bold text-[#0B1F3A]">Loading matching stock desk...</h4>
          </div>
        </div>
      }
    >
      <MatchingStockContent />
    </Suspense>
  );
}
