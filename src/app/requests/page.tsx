'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPublicWtbRequests } from '@/lib/actions/wtb';
import { MOCK_CATEGORIES } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth/auth-context';
import { getSellerQuoteUsage } from '@/lib/actions/quotations';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { AuthGateModal } from '@/components/modals/AuthGateModal';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import { dispatchWtbLeadToBuyerDashboard } from '@/lib/messaging/messaging-store';
import {
  isLeadUnlocked,
  unlockLead,
  getRemainingUnlocks,
  getUnlockedLeadIds,
} from '@/lib/leads/unlock-store';
import { TIER_LIMITS, type WtbRequest, type MembershipTier } from '@/types/database';
import {
  Search,
  PlusCircle,
  Clock,
  Building2,
  Lock,
  Unlock,
  Send,
  BarChart3,
  ArrowRight,
  Mail,
  CheckCircle2,
  ShieldAlert,
  Phone,
  Sparkles,
  Info,
  X,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

export default function RequestsPage() {
  const { isLoggedIn, company, role } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quoteUsage, setQuoteUsage] = useState<number>(0);
  const [wtbRequests, setWtbRequests] = useState<WtbRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // Unlocked WTBs tracking
  const [unlockedWtbIds, setUnlockedWtbIds] = useState<string[]>([]);

  // Modal states
  const [activeQuotationWtb, setActiveQuotationWtb] = useState<WtbRequest | null>(null);
  const [unlockConfirmWtb, setUnlockConfirmWtb] = useState<WtbRequest | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [buyerGateOpen, setBuyerGateOpen] = useState(false);
  const [quotaExceededOpen, setQuotaExceededOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const tier = (company?.membership_tier || company?.tier || 'bronze') as MembershipTier;
  const remainingUnlocks = company ? getRemainingUnlocks(company.id, tier) : 2;

  const isSeller = isLoggedIn && role === 'seller';
  const isBuyer = isLoggedIn && role === 'buyer';

  // Load real WTB requests from Supabase
  useEffect(() => {
    let isMounted = true;
    getPublicWtbRequests().then((data) => {
      if (isMounted) {
        setWtbRequests(data);
        setIsLoadingRequests(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch unlocked WTBs and monthly quote usage if seller
  useEffect(() => {
    if (company && role === 'seller') {
      // 1. Load unlocked WTB request IDs
      try {
        const unlockedKey = `b2b_unlocked_wtbs_${company.id}`;
        const rawUnlocked = localStorage.getItem(unlockedKey);
        if (rawUnlocked) {
          const parsed = JSON.parse(rawUnlocked);
          if (Array.isArray(parsed)) {
            setUnlockedWtbIds(parsed);
          }
        }
      } catch {}

      // 2. Load quote usage
      try {
        const quotesKey = `b2b_sent_quotes_${company.id}`;
        const rawQ = localStorage.getItem(quotesKey) || localStorage.getItem('b2b_sent_quotes_v2');
        if (rawQ) {
          const parsedQ = JSON.parse(rawQ);
          if (Array.isArray(parsedQ)) {
            setQuoteUsage(parsedQ.length);
            return;
          }
        }
      } catch {}

      getSellerQuoteUsage(company.id).then((count) => {
        setQuoteUsage(count);
      });
    }
  }, [company, role]);

  const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.silver;
  const maxQuotes = tierLimits.maxMonthlyQuotes || 25;
  const quotesRemaining = Math.max(0, maxQuotes - quoteUsage);

  // Filter requests
  const filteredRequests = wtbRequests.filter((req) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      req.product_name.toLowerCase().includes(q) ||
      req.category_slug.toLowerCase().includes(q) ||
      (req.barcode_or_sku && req.barcode_or_sku.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategory === 'all' || req.category_slug === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Handle clicking the primary action on a card
  const handleActionClick = (req: WtbRequest) => {
    if (!isLoggedIn || !company) {
      setAuthGateOpen(true);
      return;
    }

    const isOwnWtb = Boolean(req.buyer_company_id === company.id);
    const isUnlocked =
      isOwnWtb ||
      unlockedWtbIds.includes(req.id) ||
      isLeadUnlocked(company.id, req.id);

    if (isUnlocked) {
      setActiveQuotationWtb(req);
      return;
    }

    if (remainingUnlocks > 0 || tier === 'gold') {
      setUnlockConfirmWtb(req);
    } else {
      setUpgradeModalOpen(true);
    }
  };

  // Confirm Unlock & Deduct 1 Credit
  const handleConfirmUnlock = () => {
    if (!unlockConfirmWtb || !company) return;
    const targetWtb = unlockConfirmWtb;
    setUnlockConfirmWtb(null);

    const res = unlockLead(company.id, targetWtb.id, tier);
    if (!res.success) {
      setUpgradeModalOpen(true);
      return;
    }

    const newUnlocked = Array.from(new Set([...unlockedWtbIds, targetWtb.id]));
    setUnlockedWtbIds(newUnlocked);

    try {
      const quotesKey = `b2b_sent_quotes_${company.id}`;
      const raw = localStorage.getItem(quotesKey);
      const existing = raw ? JSON.parse(raw) : [];
      const placeholderQuote = {
        id: `sq-${Date.now()}`,
        product: targetWtb.product_name,
        category: targetWtb.category_slug.replace('-', ' '),
        buyer: (targetWtb as any).buyer_company || targetWtb.buyer_name,
        buyerContact: targetWtb.buyer_name,
        buyerEmail: targetWtb.buyer_email,
        buyerPhone: targetWtb.buyer_phone || '',
        yourPrice: targetWtb.target_price,
        quantity: targetWtb.target_quantity,
        sentDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        leadTimeDays: 3,
        notes: 'Lead unlocked - quoting desk opened.',
        requestTargetPrice: targetWtb.target_price,
        requestTargetQuantity: targetWtb.target_quantity,
        requestBarcode: targetWtb.barcode_or_sku,
        requestNotes: targetWtb.notes,
        status: 'Unlocked',
      };
      if (!existing.some((q: any) => q.product === targetWtb.product_name)) {
        localStorage.setItem(quotesKey, JSON.stringify([placeholderQuote, ...existing]));
      }
      window.dispatchEvent(new CustomEvent('b2b_quotes_updated'));
    } catch {}

    // Dispatch seller company info directly to Buyer Dashboard
    dispatchWtbLeadToBuyerDashboard({
      wtbRequest: targetWtb,
      sellerCompany: company,
      actionType: 'unlocked',
    });

    // Open QuotationModal with buyer details revealed
    setActiveQuotationWtb(targetWtb);
  };

  // Handle seller clicking Email Quote on an unlocked card
  const handleEmailQuoteClick = (req: WtbRequest) => {
    if (company && role === 'seller') {
      dispatchWtbLeadToBuyerDashboard({
        wtbRequest: req,
        sellerCompany: company,
        actionType: 'email_sent',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] pb-24 font-sans">
      {/* Top Hero Banner */}
      <div className="bg-[#0B1F3A] text-white pt-28 pb-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#00E5FF] text-[12px] font-bold uppercase tracking-wider mb-3">
                <span className="flex h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse" />
                <span>Commercial Sourcing Desk</span>
              </div>
              <h1 className="text-[34px] sm:text-[44px] font-extrabold tracking-[-0.025em] text-white leading-tight">
                Buyer Demand Board
              </h1>
              <p className="mt-2.5 text-[15px] sm:text-[16px] text-slate-300 leading-relaxed font-normal">
                Active procurement requests from verified European commercial buyers. Verified suppliers can assess requirement suitability, unlock direct buyer procurement details, and submit formal quotations with 0% commission.
              </p>
            </div>

            <Link
              href={isLoggedIn ? "/requests/new" : "/register?redirect=/requests/new&role=buyer"}
              className="inline-flex items-center justify-center gap-2.5 bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] px-7 py-3.5 rounded-full shadow-lg shadow-blue-500/25 transition shrink-0"
            >
              <PlusCircle className="w-5 h-5 text-white" />
              <span>Post New WTB Request</span>
            </Link>
          </div>

          {/* Search & Filters */}
          <div className="mt-8 max-w-3xl bg-white p-2 rounded-full shadow-xl flex items-center border border-[#EAEFF6]">
            <Search className="w-5 h-5 text-[#94A3B8] ml-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requested products, EAN barcodes, or categories..."
              className="w-full px-4 py-2.5 text-[15px] text-[#0B1F3A] rounded-full focus:outline-none placeholder:text-[#94A3B8] font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {/* 3-Step Process Indicator Guide for Sellers */}
        {isSeller && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-[#EAEFF6] shadow-xs flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2 font-bold text-[#0B1F3A]">
              <span className="w-6 h-6 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center text-xs">1</span>
              <span>Browse WTB Requests</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
            <div className="flex items-center gap-2 font-bold text-[#0B1F3A]">
              <span className="w-6 h-6 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center text-xs">2</span>
              <span>Check Specs & Suitability</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
            <div className="flex items-center gap-2 font-bold text-[#0A6CFF]">
              <span className="w-6 h-6 rounded-full bg-[#0A6CFF] text-white flex items-center justify-center text-xs">3</span>
              <span>Unlock Lead (-1 Quota) & Send Quotation</span>
            </div>
          </div>
        )}

        {/* Seller Quota Gauge */}
        {isSeller && (
          <div className="mb-8 p-6 rounded-[28px] bg-white border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.05)] flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] border border-[#D0E2FF] flex items-center justify-center text-[#0A6CFF] shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="text-[16px] font-bold text-[#0B1F3A]">Your Monthly Quotation Allowance</h4>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-[#EBF3FF] text-[#0A6CFF] px-2.5 py-0.5 rounded-full">
                    {company?.membership_tier || 'Silver'} Tier
                  </span>
                </div>
                <p className="text-[13px] text-[#5B6B82] mt-0.5">
                  Anti-spam quota: <strong>{quoteUsage}</strong> of <strong>{maxQuotes}</strong> quotes allocated this month. ({quotesRemaining} remaining)
                </p>
              </div>
            </div>

            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-[12px] font-bold text-[#0B1F3A]">
                <span>Remaining Allowance:</span>
                <span>{quotesRemaining} / {maxQuotes} Left</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#EAEFF6] overflow-hidden">
                <div
                  className="h-full bg-[#0A6CFF] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (quoteUsage / maxQuotes) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Buyer Notice Banner */}
        {isBuyer && (
          <div className="mb-8 p-5 rounded-[24px] bg-white border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-[14px]">
                <span className="font-bold text-[#0B1F3A] block">Buyer Account Notice: Sourcing Quoting is for Suppliers</span>
                <span className="text-[#5B6B82]">
                  You are signed in as a Buyer. Quoting and buyer contact details are exclusively accessible to verified wholesale suppliers. You can post and manage your procurement requests.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/dashboard/requests"
                className="text-[13px] font-bold bg-[#EBF3FF] text-[#0A6CFF] hover:bg-[#D8EAFF] px-4 py-2 rounded-full transition"
              >
                My WTB Requests
              </Link>
              <Link
                href="/requests/new"
                className="text-[13px] font-bold bg-[#0A6CFF] text-white hover:bg-[#0857cf] px-4 py-2 rounded-full transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Post Request</span>
              </Link>
            </div>
          </div>
        )}

        {/* Guest Warning */}
        {!isLoggedIn && (
          <div className="mb-8 p-5 rounded-[24px] bg-[#0B1F3A] text-white flex items-center justify-between gap-4 border border-slate-800 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-[#00E5FF] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-[14px]">
                <span className="font-bold text-white block">Sourcing Desk Gated for Verified Suppliers</span>
                <span className="text-slate-300">Buyer procurement contact details and quoting are exclusively reserved for verified wholesale suppliers.</span>
              </div>
            </div>
            <Link
              href="/register?role=seller"
              className="text-[13px] font-bold bg-white text-[#0B1F3A] hover:bg-slate-100 px-4 py-2 rounded-full transition shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Join as Seller</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Niche Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-7">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0A6CFF] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#E3E9F2] hover:border-[#CBD5E1]'
            }`}
          >
            All Niches ({wtbRequests.length})
          </button>
          {MOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#0A6CFF] text-white shadow-xs'
                  : 'bg-white text-[#41536D] border border-[#E3E9F2] hover:border-[#CBD5E1]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-12 text-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="w-8 h-8" />
            </div>
            <h4 className="text-[20px] font-bold text-[#0B1F3A]">No active WTB requests found</h4>
            <p className="text-[14px] text-[#5B6B82] mt-2 leading-relaxed">
              No procurement requests currently match your search criteria.
            </p>
            <Link
              href={isLoggedIn ? "/requests/new" : "/register?redirect=/requests/new&role=buyer"}
              className="mt-6 inline-flex items-center justify-center min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] transition-colors shadow-xs"
            >
              Post New WTB Request
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRequests.map((req) => {
              const isUnlocked = isSeller && unlockedWtbIds.includes(req.id);
              const batchValue = req.target_quantity * req.target_price;

              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-[28px] border transition-all p-7 flex flex-col justify-between ${
                    isUnlocked
                      ? 'border-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,0.08)]'
                      : 'border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] hover:border-[#CBD5E1]'
                  }`}
                >
                  {/* Step 01 & Step 02: Public Product Specs to Evaluate Suitability */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF] bg-[#EBF3FF] px-3 py-1 rounded-full">
                        {(req.category_slug || 'General').replace(/-/g, ' ')}
                      </span>

                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Lead Details Unlocked</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#5B6B82] font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#0A6CFF]" />
                          <span>Live Demand</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-[-0.02em] leading-snug">
                      {req.product_name}
                    </h3>

                    {req.barcode_or_sku && (
                      <div className="font-mono text-[12px] text-[#5B6B82] bg-[#F8FAFF] border border-[#E3E9F2] px-3 py-1 rounded-full inline-flex items-center gap-1.5 mt-2.5">
                        <span className="text-[#94A3B8]">EAN/GTIN:</span>
                        <strong className="text-[#0B1F3A]">{req.barcode_or_sku}</strong>
                      </div>
                    )}

                    {req.notes && (
                      <p className="mt-3.5 text-[13px] text-[#5B6B82] leading-relaxed bg-[#F8FAFF] p-3.5 rounded-2xl border border-[#EAEFF6]">
                        &ldquo;{req.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Pricing & Volume Evaluation Grid */}
                  <div className="mt-6 pt-5 border-t border-[#EAEFF6] space-y-4">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-[#F8FAFF] p-3 rounded-2xl border border-[#EAEFF6]">
                        <span className="text-[#8A9BB0] block text-[11px] font-semibold uppercase tracking-wider">
                          Target Quantity
                        </span>
                        <span className="text-[18px] font-extrabold text-[#0B1F3A] mt-0.5 block">
                          {req.target_quantity.toLocaleString()} units
                        </span>
                      </div>

                      <div className="bg-[#F8FAFF] p-3 rounded-2xl border border-[#EAEFF6] text-right">
                        <span className="text-[#8A9BB0] block text-[11px] font-semibold uppercase tracking-wider">
                          Target Unit Price
                        </span>
                        <span className="text-[18px] font-extrabold text-[#0B1F3A] mt-0.5 block">
                          £{req.target_price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Step 03: Gated Buyer Information row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-[13px] text-[#5B6B82] space-y-0.5">
                        {isUnlocked ? (
                          <>
                            <div className="flex items-center gap-1.5 font-medium">
                              <Building2 className="w-4 h-4 text-[#0A6CFF]" />
                              <span>Buyer: <strong className="text-[#0B1F3A]">{(req as any).buyer_company || req.buyer_name}</strong></span>
                            </div>
                            {req.buyer_email && (
                              <div className="flex items-center gap-1.5 text-[12px] text-[#0A6CFF]">
                                <Mail className="w-3.5 h-3.5 text-[#0A6CFF]" />
                                <a
                                  href={`mailto:${req.buyer_email}?subject=Quote for ${encodeURIComponent(req.product_name)} [B2B LINK]&body=Dear ${encodeURIComponent(req.buyer_name)},%0D%0A%0D%0ARegarding your WTB request for ${encodeURIComponent(req.product_name)} (${req.target_quantity} units at target £${req.target_price}):%0D%0A%0D%0AOur Offer Details:%0D%0A- Offered Price: £%0D%0A- Available Quantity: %0D%0A- Lead Time: %0D%0A%0D%0APlease let us know if you would like to proceed.%0D%0A%0D%0ABest regards`}
                                  onClick={() => handleEmailQuoteClick(req)}
                                  className="hover:underline font-semibold"
                                  title="Click to draft email to buyer"
                                >
                                  {req.buyer_email}
                                </a>
                              </div>
                            )}
                            {req.buyer_phone && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#5B6B82]">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{req.buyer_phone}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 font-medium text-slate-400">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Buyer: <span className="font-mono bg-slate-100 text-slate-400 text-xs px-2 py-0.5 rounded">•••••••••••• (Locked)</span></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span className="font-mono bg-slate-100 text-slate-400 text-xs px-2 py-0.5 rounded">••••••••@••••.eu (Locked)</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isUnlocked ? (
                          <>
                            {req.buyer_email && (
                              <a
                                href={`mailto:${req.buyer_email}?subject=Quote for ${encodeURIComponent(req.product_name)} [B2B LINK]&body=Dear ${encodeURIComponent(req.buyer_name)},%0D%0A%0D%0ARegarding your WTB request for ${encodeURIComponent(req.product_name)} (${req.target_quantity} units at target £${req.target_price}):%0D%0A%0D%0AOur Offer Details:%0D%0A- Offered Price: £%0D%0A- Available Quantity: %0D%0A- Lead Time: %0D%0A%0D%0APlease let us know if you would like to proceed.%0D%0A%0D%0ABest regards`}
                                onClick={() => handleEmailQuoteClick(req)}
                                className="inline-flex items-center gap-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1F3A] text-[13px] font-bold px-3.5 py-2.5 rounded-full transition"
                                title="Open email client to send quote"
                              >
                                <Mail className="w-3.5 h-3.5 text-[#0A6CFF]" />
                                <span>Email Quote</span>
                              </a>
                            )}
                            <button
                              onClick={() => setActiveQuotationWtb(req)}
                              className="inline-flex items-center gap-1.5 bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-4 sm:px-5 py-2.5 rounded-full shadow-xs transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Quote Desk</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleActionClick(req)}
                            className={`inline-flex items-center gap-2 text-white text-[13px] font-bold px-4 sm:px-5 py-2.5 rounded-full shadow-md transition cursor-pointer ${
                              remainingUnlocks > 0 || tier === 'gold'
                                ? 'bg-[#0A6CFF] hover:bg-[#0857cf]'
                                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {remainingUnlocks > 0 || tier === 'gold'
                                ? `Unlock Lead (${remainingUnlocks === Infinity ? 'Unlimited' : `${remainingUnlocks} Left`})`
                                : 'Upgrade to Unlock Lead'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STEP 03 UNLOCK CONFIRMATION MODAL */}
      {unlockConfirmWtb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-[28px] shadow-2xl border border-[#EAEFF6] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#00E5FF] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF] block">
                    Step 03: Lead Access & Quota
                  </span>
                  <h3 className="text-[18px] font-extrabold text-white">
                    Unlock Buyer Lead Details
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setUnlockConfirmWtb(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-7 space-y-5">
              <div className="bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0]">
                  Target Sourcing Requirement
                </div>
                <h4 className="text-[17px] font-black text-[#0B1F3A]">
                  {unlockConfirmWtb.product_name}
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#5B6B82] pt-1">
                  <span>Target: <strong className="text-[#0B1F3A]">{unlockConfirmWtb.target_quantity.toLocaleString()} units</strong></span>
                  <span>•</span>
                  <span>Target Price: <strong className="text-[#0A6CFF]">£{unlockConfirmWtb.target_price.toFixed(2)}</strong></span>
                  <span>•</span>
                  <span>Batch Value: <strong className="text-[#0B1F3A]">£{(unlockConfirmWtb.target_quantity * unlockConfirmWtb.target_price).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Quota Deduction Notice */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  <span>1 Quote Will Be Deducted From Your Monthly Allowance</span>
                </div>
                <p className="leading-relaxed text-amber-800">
                  You currently have <strong>{quotesRemaining} of {maxQuotes}</strong> quotes remaining this month on your <strong>{tier.toUpperCase()}</strong> membership.
                </p>
              </div>

              {/* What happens on unlock */}
              <div className="space-y-2 text-[13px] text-[#5B6B82]">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Buyer corporate identity, direct procurement email, and contact phone will be revealed permanently.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Your company profile (<strong>{company?.name}</strong>) will be sent to the buyer&apos;s dashboard and live chat desk.</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnlockConfirmWtb(null)}
                  className="px-5 py-2.5 text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnlock}
                  className="inline-flex items-center gap-2 bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[14px] font-bold px-6 py-2.5 rounded-full shadow-md transition cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Confirm & Unlock (-1 Quota)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BUYER ACCESS RESTRICTION MODAL */}
      {buyerGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl border border-[#EAEFF6] p-7 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-[20px] font-extrabold text-[#0B1F3A]">
              Supplier-Only Quoting Desk
            </h3>
            <p className="text-[14px] text-[#5B6B82] leading-relaxed">
              You are currently logged in with a <strong>Buyer</strong> account. Sourcing contact details and quotation submissions are exclusively available to verified wholesale suppliers.
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-[13px] text-[#5B6B82] text-left space-y-1.5">
              <div>• Post your procurement needs: use <strong>+ Post New WTB Request</strong></div>
              <div>• View your requests & received quotes: check your <strong>Buyer Dashboard</strong></div>
              <div>• To quote as a seller: register or upgrade to a <strong>Seller Account</strong></div>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => setBuyerGateOpen(false)}
                className="flex-1 py-2.5 text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                Close
              </button>
              <Link
                href="/dashboard/requests"
                className="flex-1 py-2.5 text-[13px] font-bold text-white bg-[#0A6CFF] hover:bg-[#0857cf] rounded-full transition inline-flex items-center justify-center gap-1.5"
              >
                <span>My Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* QUOTA EXCEEDED MODAL */}
      {quotaExceededOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl border border-[#EAEFF6] p-7 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-[20px] font-extrabold text-[#0B1F3A]">
              Monthly Quotation Limit Reached
            </h3>
            <p className="text-[14px] text-[#5B6B82] leading-relaxed">
              You have reached your limit of <strong>{maxQuotes} quotations</strong> for this calendar month on your <strong>{tier.toUpperCase()}</strong> tier. Upgrade your plan to submit additional quotations.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => setQuotaExceededOpen(false)}
                className="flex-1 py-2.5 text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                Close
              </button>
              <Link
                href="/pricing"
                className="flex-1 py-2.5 text-[13px] font-bold text-white bg-[#0A6CFF] hover:bg-[#0857cf] rounded-full transition inline-flex items-center justify-center gap-1.5"
              >
                <span>Upgrade Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      <QuotationModal
        wtbRequest={activeQuotationWtb}
        isOpen={!!activeQuotationWtb}
        onClose={() => setActiveQuotationWtb(null)}
        onSuccess={() => {
          // Refresh quotes count if not already incremented
        }}
      />

      {/* Auth Gate Modal for Visitors */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title="Account Required to Unlock Leads"
        subtitle="Only registered members can unlock buyer procurement details and submit competitive quotations. Create an account or sign in to proceed with 2 free unlocks."
      />

      {/* Upgrade Membership Modal */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Upgrade to Unlock Buyer Procurement Leads"
        subtitle="You have used all contact unlocks on your current plan. Upgrade to Silver (20 unlocks) or Gold (Unlimited) to link up with active wholesale procurement buyers."
      />
    </div>
  );
}
