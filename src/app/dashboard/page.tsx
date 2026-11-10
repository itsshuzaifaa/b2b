'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { CsvImportModal } from '@/components/dashboard/CsvImportModal';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';
import { BroadcastWtbModal } from '@/components/modals/BroadcastWtbModal';
import { BroadcastWtsModal } from '@/components/modals/BroadcastWtsModal';
import { TradingMatchesWidget } from '@/components/dashboard/TradingMatchesWidget';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { PriceBadge } from '@/lib/utils/pricing';
import {
  Skeleton,
  StatCardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
} from '@/components/skeletons';
import type { WtbRequest, MembershipTier } from '@/types/database';
import { TIER_LIMITS } from '@/types/database';
import { getConversationsForUser, syncWithSupabase } from '@/lib/messaging/messaging-store';
import { getRemainingUnlocks, getUnlockedLeadIds } from '@/lib/leads/unlock-store';
import {
  Plus,
  Inbox,
  FileText,
  Package,
  PlusCircle,
  ArrowRight,
  Sparkles,
  Store,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface InquiryItem {
  id: string;
  initials: string;
  companyName: string;
  productTitle: string;
  moq: number;
  timeAgo: string;
  isNew: boolean;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  targetQuantity: number;
  offeredPrice: number;
  message: string;
}

export default function OverviewPage() {
  const { company, role, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const isBuyer = role === 'buyer' || company?.role === 'buyer';

  // Modals state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{
    title: string;
    subtitle: string;
    goldOnly?: boolean;
  } | null>(null);
  const [createWtbOpen, setCreateWtbOpen] = useState(false);
  const [tradeModalMode, setTradeModalMode] = useState<'WTB' | 'WTS'>('WTB');
  const [broadcastWtbOpen, setBroadcastWtbOpen] = useState(false);
  const [broadcastWtsOpen, setBroadcastWtsOpen] = useState(false);
  const [selectedWtbForQuote, setSelectedWtbForQuote] = useState<WtbRequest | null>(null);

  const rawTier = (
    company?.tier ||
    company?.membership_tier ||
    (typeof window !== 'undefined' ? localStorage.getItem('b2b_registered_tier') : null) ||
    'bronze'
  ).toString().toLowerCase();

  const currentTier = (
    rawTier === 'gold' ? 'gold' : rawTier === 'silver' ? 'silver' : 'bronze'
  ) as MembershipTier;

  const tierConfig = TIER_LIMITS[currentTier] || TIER_LIMITS.bronze;
  const maxActiveProducts = tierConfig.maxActiveProducts;
  const isUnlimitedProducts = maxActiveProducts === Infinity;
  const maxUnlocks = tierConfig.contactUnlocks ?? 2;
  const isUnlimitedUnlocks = maxUnlocks === Infinity;

  // 1. Unlocked Leads & Remaining limits Query
  const {
    data: unlocksData,
    isPending: isUnlocksPending,
    isError: isUnlocksError,
    refetch: refetchUnlocks,
  } = useQuery({
    queryKey: ['dashboard-unlocks', company?.id, currentTier],
    enabled: !!company?.id,
    queryFn: async () => {
      if (!company?.id) return { remainingUnlocks: 2, unlockedCount: 0 };
      const unlockedIds = getUnlockedLeadIds(company.id);
      const remaining = getRemainingUnlocks(company.id, currentTier);
      return {
        remainingUnlocks: remaining,
        unlockedCount: unlockedIds.length,
      };
    },
  });

  // 2. Active Listings Count Query
  const {
    data: listingsCount,
    isPending: isListingsPending,
    isError: isListingsError,
    refetch: refetchListings,
  } = useQuery<number>({
    queryKey: ['dashboard-listings-count', company?.id, company?.email],
    enabled: !!company,
    queryFn: async () => {
      if (!company) return 0;
      let localCount = 0;
      try {
        localStorage.removeItem('b2b_seller_listings_real_v2');
        const raw = localStorage.getItem('b2b_seller_listings_v3');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const companyListings = parsed.filter(
              (p) =>
                (p.company_id && p.company_id === company.id) ||
                (p.seller_id && p.seller_id === company.id) ||
                (company.email && p.contact_email?.toLowerCase() === company.email.toLowerCase())
            );
            localCount = companyListings.length;
          }
        }
      } catch {}

      if (company.id) {
        try {
          const res = await fetch(`/api/products?companyId=${encodeURIComponent(company.id)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.products)) {
              return data.products.length;
            }
          }
        } catch {}
      }

      return localCount;
    },
  });

  // 3. WTB Demand Requests Query
  const {
    data: wtbList,
    isPending: isWtbPending,
    isError: isWtbError,
    refetch: refetchWtb,
  } = useQuery<WtbRequest[]>({
    queryKey: ['dashboard-wtb-requests', isBuyer, company?.email],
    enabled: !!company,
    queryFn: async () => {
      const { getBuyerWtbRequests, getPublicWtbRequests } = await import('@/lib/actions/wtb');
      if (isBuyer && company?.email) {
        const list = await getBuyerWtbRequests(company.email);
        if (list && list.length > 0) {
          return list;
        }
      }
      const openList = await getPublicWtbRequests();
      return openList || [];
    },
  });

  // 4. Inquiries & Direct Messages Query
  const {
    data: inquiries,
    isPending: isInquiriesPending,
    isError: isInquiriesError,
    refetch: refetchInquiries,
  } = useQuery<any[]>({
    queryKey: ['dashboard-inquiries', company?.id, company?.email, role],
    enabled: !!company,
    queryFn: async () => {
      if (!company) return [];
      try {
        await syncWithSupabase(
          role || undefined,
          company.id,
          company.email,
          company?.membership_tier || company?.tier || 'bronze',
          company.created_at
        );
      } catch {}
      return getConversationsForUser(company);
    },
  });

  // Keep queries in sync with platform window events
  const refreshAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-unlocks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-listings-count'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-wtb-requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-inquiries'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('b2b_lead_unlock_update', refreshAll);
    window.addEventListener('b2b_billing_update', refreshAll);
    window.addEventListener('b2b_account_status_change', refreshAll);

    return () => {
      window.removeEventListener('b2b_lead_unlock_update', refreshAll);
      window.removeEventListener('b2b_billing_update', refreshAll);
      window.removeEventListener('b2b_account_status_change', refreshAll);
    };
  }, [refreshAll]);

  // Active inquiries strictly for this account (including direct Trade inquiries + Admin Desk messages)
  const activeInquiries = React.useMemo(() => {
    if (!inquiries) return [];
    return inquiries.filter(
      (c) =>
        (!c.broadcastKind || c.type === 'seller_admin' || c.status === 'admin_desk') &&
        !c.id.startsWith('conv-broadcast-')
    );
  }, [inquiries]);

  // Awaiting reply: inquiries where the last message was NOT sent by the current user
  const awaitingReplyInquiries = React.useMemo(() => {
    if (!company || !inquiries) return [];
    return activeInquiries.filter((c) => {
      const msgs = c.messages || [];
      if (msgs.length === 0) return false;
      const lastMsg = msgs[msgs.length - 1];
      const isSentByMe = Boolean(
        (lastMsg.senderId && (lastMsg.senderId === company.id || lastMsg.senderId === company.user_id)) ||
        (lastMsg.senderEmail && company.email && lastMsg.senderEmail.toLowerCase() === company.email.toLowerCase()) ||
        (lastMsg.senderRole === (isBuyer ? 'buyer' : 'seller') && lastMsg.senderRole !== 'admin')
      );
      return !isSentByMe;
    });
  }, [activeInquiries, company, isBuyer, inquiries]);

  const handleOpenBroadcastWtb = () => {
    if (currentTier !== 'gold') {
      setUpgradeModalConfig({
        title: 'Gold Tier Exclusive: Broadcast Buy (WTB) Request',
        subtitle:
          'Internal network broadcasting is exclusively available to Gold members. Upgrade to instantly broadcast your Want-To-Buy procurement requests to all verified members across the platform.',
        goldOnly: true,
      });
      setUpgradeModalOpen(true);
      return;
    }
    setBroadcastWtbOpen(true);
  };

  const handleOpenBroadcastWts = () => {
    if (currentTier !== 'gold') {
      setUpgradeModalConfig({
        title: 'Gold Tier Exclusive: Broadcast Sell (WTS)',
        subtitle:
          'Internal network broadcasting is exclusively available to Gold members. Upgrade to instantly broadcast your Want-To-Sell wholesale stock lots to all verified members across the platform.',
        goldOnly: true,
      });
      setUpgradeModalOpen(true);
      return;
    }
    setBroadcastWtsOpen(true);
  };

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimedOut(true);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimedOut(false);
    }
  }, [isLoading]);

  // While auth / session initializes, render full DashboardSkeleton rather than an abrupt spinner
  if (isLoading && !loadingTimedOut) {
    return <DashboardSkeleton />;
  }

  const memberName =
    company?.contact_name ||
    (company as any)?.contactName ||
    company?.company_name ||
    company?.name ||
    company?.email?.split('@')[0] ||
    'Member';
  const companyName =
    company?.company_name ||
    (company as any)?.companyName ||
    company?.name ||
    `${memberName} Trading Ltd`;

  return (
    <>
      {/* Top Banner / Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight">
              Trading Overview
            </h1>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Account</span>
            </span>
          </div>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Welcome back,{' '}
            <strong className="text-[#0B1F3A] font-semibold">{memberName}</strong>{' '}
            ({companyName}). You can browse, buy, and sell wholesale stock from this dashboard.
          </p>
        </div>

        {/* Dual Buy & Sell Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setTradeModalMode('WTB');
              setCreateWtbOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-[#10B981] hover:bg-[#059669] text-white font-bold text-[13px] px-4 py-2.5 rounded-full transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Post Buy (WTB) Request</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTradeModalMode('WTS');
              setCreateWtbOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-4 py-2.5 rounded-full transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Post Sell (WTS) Request</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6">
        {/* Card 1: Contact Unlocks */}
        {isUnlocksPending || unlocksData === undefined ? (
          <StatCardSkeleton />
        ) : isUnlocksError ? (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-rose-200 shadow-sm flex flex-col justify-between min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">Contact unlocks</span>
                <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Error</span>
              </div>
              <p className="text-[12px] text-rose-600 mt-2">Could not retrieve unlock limits</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => refetchUnlocks()}
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between animate-fade-in min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">Contact unlocks</span>
                <span className="text-[10px] font-extrabold uppercase bg-blue-50 text-[#0A6CFF] px-2 py-0.5 rounded">
                  {currentTier}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                  {isUnlimitedUnlocks ? '∞' : <AnimatedNumber value={unlocksData.remainingUnlocks} />}
                </span>
                <span className="text-[13px] font-medium text-[#8A9BB0]">
                  {isUnlimitedUnlocks ? 'unlimited unlocks' : `left of ${maxUnlocks}`}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <span className="text-[11px] text-[#5B6B82]">
                <AnimatedNumber value={unlocksData.unlockedCount} /> counterparties unlocked
              </span>
              {!isUnlimitedUnlocks && (
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="text-[11px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Upgrade</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Card 2: Active Listings (Selling) */}
        {isListingsPending || listingsCount === undefined ? (
          <StatCardSkeleton />
        ) : isListingsError ? (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-rose-200 shadow-sm flex flex-col justify-between min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">My active listings</span>
                <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Error</span>
              </div>
              <p className="text-[12px] text-rose-600 mt-2">Could not load listing count</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => refetchListings()}
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between animate-fade-in min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">My active listings</span>
                <Package className="w-4 h-4 text-[#8A9BB0]" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                  <AnimatedNumber value={listingsCount} />
                </span>
                <span className="text-[13px] font-medium text-[#8A9BB0]">
                  {isUnlimitedProducts ? '/ unlimited' : `/ ${maxActiveProducts}`}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <Link
                href="/dashboard/listings"
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline"
              >
                Manage listings &rarr;
              </Link>
              <span className="text-[11px] text-[#8A9BB0]">Wholesale lots</span>
            </div>
          </div>
        )}

        {/* Card 3: Want-To-Buy Requests (Buying Demand) */}
        {isWtbPending || wtbList === undefined ? (
          <StatCardSkeleton />
        ) : isWtbError ? (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-rose-200 shadow-sm flex flex-col justify-between min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">WTB demand board</span>
                <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Error</span>
              </div>
              <p className="text-[12px] text-rose-600 mt-2">Could not load demand board</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => refetchWtb()}
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between animate-fade-in min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">WTB demand board</span>
                <FileText className="w-4 h-4 text-[#8A9BB0]" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                  <AnimatedNumber value={wtbList.length} />
                </span>
                <span className="text-[13px] font-medium text-[#8A9BB0]">active requests</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <Link
                href="/dashboard/requests"
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline"
              >
                Explore board &rarr;
              </Link>
              <span className="text-[11px] text-[#8A9BB0]">Commercial demand</span>
            </div>
          </div>
        )}

        {/* Card 4: Inquiries & Messages */}
        {isInquiriesPending || inquiries === undefined ? (
          <StatCardSkeleton />
        ) : isInquiriesError ? (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-rose-200 shadow-sm flex flex-col justify-between min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">Inquiries &amp; Messages</span>
                <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Error</span>
              </div>
              <p className="text-[12px] text-rose-600 mt-2">Could not load inquiries</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => refetchInquiries()}
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between animate-fade-in min-h-[162px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#5B6B82]">Inquiries &amp; Messages</span>
                <div className="relative">
                  <Inbox className="w-4 h-4 text-[#8A9BB0]" />
                  {awaitingReplyInquiries.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                  <AnimatedNumber value={awaitingReplyInquiries.length} />
                </span>
                <span className="text-[13px] font-medium text-[#8A9BB0]">
                  {awaitingReplyInquiries.length === 1 ? 'awaiting reply' : 'awaiting reply'}
                </span>
                {awaitingReplyInquiries.length > 0 && (
                  <span className="ml-auto bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                    {awaitingReplyInquiries.length} NEW
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
              <Link
                href="/dashboard/inquiries"
                className="text-[11px] font-bold text-[#0A6CFF] hover:underline"
              >
                Open messages &rarr;
              </Link>
              <span className="text-[11px] text-[#8A9BB0]">Direct trade chat</span>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Buyer-Seller Smart Matches Widget */}
      <TradingMatchesWidget
        onOpenQuoteModal={(wtbId, wtbTitle, targetPrice, targetQty) => {
          setSelectedWtbForQuote({
            id: wtbId,
            product_name: wtbTitle,
            target_price: targetPrice,
            target_quantity: targetQty,
            buyer_name: 'Verified Buyer',
            buyer_email: '',
            category_slug: 'electronics',
            status: 'open',
            created_at: new Date().toISOString(),
          } as any);
        }}
        onOpenCreateWtb={() => {
          setTradeModalMode('WTB');
          setCreateWtbOpen(true);
        }}
        onOpenCreateWts={() => {
          setTradeModalMode('WTS');
          setCreateWtbOpen(true);
        }}
      />

      {/* Main Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-7">
        {/* LEFT COLUMN: Trade Inquiries & Order Discussions (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-bold text-[#0B1F3A]">
                  Active Inquiries &amp; Messages
                </h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Direct commercial inquiries from global wholesale partners
                </p>
              </div>
              <Link
                href="/dashboard/inquiries"
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
              >
                View all &rarr;
              </Link>
            </div>

            {isInquiriesPending || inquiries === undefined ? (
              <TableSkeleton rows={4} variant="feed" />
            ) : isInquiriesError ? (
              <div className="p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-200 animate-fade-in">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2 opacity-80" />
                <p className="text-[13px] font-bold text-rose-700">Failed to load trade messages</p>
                <p className="text-[12px] text-[#5B6B82] mt-1 mb-4">
                  We were unable to retrieve your current conversations.
                </p>
                <button
                  type="button"
                  onClick={() => refetchInquiries()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#0A6CFF] hover:bg-[#0857CF] px-4 py-2 rounded-full cursor-pointer transition shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : activeInquiries.length === 0 ? (
              <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8] animate-fade-in">
                <Inbox className="w-8 h-8 text-[#0A6CFF] mx-auto mb-2 opacity-60" />
                <p className="text-[13px] font-bold text-[#0B1F3A]">No active messages yet</p>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  When buyers, sellers, or platform administrators send messages, trade and direct support threads appear here.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Link
                    href="/dashboard/marketplace"
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Browse Marketplace</span>
                  </Link>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTradeModalMode('WTS');
                      setCreateWtbOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#059669] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>List Stock</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {activeInquiries.slice(0, 4).map((conv) => {
                  const isAwaitingReply = awaitingReplyInquiries.some((a) => a.id === conv.id);
                  const isAdminDesk = conv.status === 'admin_desk' || conv.type === 'seller_admin';
                  const title = isAdminDesk
                    ? 'Platform Administrator (Executive Desk)'
                    : conv.productTitle || 'Wholesale Lot';
                  const subtitle = isAdminDesk
                    ? `Jeff Vetting Director · ${conv.lastMessageText || 'Direct message'}`
                    : `${conv.sellerCompanyName || conv.buyerCompanyName || 'Counterparty'} · ${conv.lastMessageText || 'Chat open'}`;

                  return (
                    <div
                      key={conv.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        isAdminDesk
                          ? 'bg-[#EBF3FF]/60 border-[#0A6CFF]/25 hover:bg-[#EBF3FF]'
                          : 'bg-[#F8FAFC] border-[#EAEFF6] hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isAdminDesk && (
                            <span className="bg-[#0A6CFF] text-white text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs shrink-0">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Admin Desk</span>
                            </span>
                          )}
                          <span className="text-[14px] font-bold text-[#0B1F3A] truncate">
                            {title}
                          </span>
                          {isAwaitingReply ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0 animate-pulse">
                              Awaiting Reply
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                              Replied
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#5B6B82] mt-0.5 truncate">
                          {subtitle}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/inquiries?id=${conv.id}`}
                        className="bg-white border border-[#EAEFF6] hover:border-[#0A6CFF] text-[#0A6CFF] font-bold text-[12px] px-3.5 py-1.5 rounded-full transition shadow-2xs shrink-0 cursor-pointer"
                      >
                        Open Chat
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Want-To-Buy Commercial Demand (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-bold text-[#0B1F3A]">
                  Demand Opportunities
                </h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  High-intent global Want-To-Buy requests
                </p>
              </div>
              <Link
                href="/dashboard/requests"
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline"
              >
                Browse &rarr;
              </Link>
            </div>

            {isWtbPending || wtbList === undefined ? (
              <TableSkeleton rows={3} variant="demand" />
            ) : isWtbError ? (
              <div className="p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-200 animate-fade-in">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2 opacity-80" />
                <p className="text-[13px] font-bold text-rose-700">Failed to load procurement requests</p>
                <p className="text-[12px] text-[#5B6B82] mt-1 mb-4">
                  We could not fetch active demand opportunities.
                </p>
                <button
                  type="button"
                  onClick={() => refetchWtb()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#0A6CFF] hover:bg-[#0857CF] px-4 py-2 rounded-full cursor-pointer transition shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : wtbList.length === 0 ? (
              <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8] animate-fade-in">
                <FileText className="w-8 h-8 text-[#059669] mx-auto mb-2 opacity-60" />
                <p className="text-[13px] font-bold text-[#0B1F3A]">No active requests</p>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Post your procurement requirements to receive direct supplier offers.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateWtbOpen(true)}
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                >
                  <span>+ Post New Request</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {wtbList.slice(0, 3).map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-bold text-[#0B1F3A] truncate">
                          {req.product_name}
                        </h4>
                        <div className="text-[12px] text-[#5B6B82] mt-0.5">
                          Target:{' '}
                          <strong className="text-[#0B1F3A]">
                            {req.target_quantity} units
                          </strong>{' '}
                          · <PriceBadge price={req.target_price} pricingType={req.pricing_type} />
                        </div>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        Open
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#8A9BB0]">
                        Buyer: {req.buyer_name || 'Wholesale Buyer'}
                      </span>
                      <Link
                        href={`/dashboard/requests`}
                        className="text-[12px] font-bold text-[#0A6CFF] hover:underline"
                      >
                        View &amp; Quote &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleOpenBroadcastWtb}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200/60"
            >
              <PlusCircle className="w-4 h-4 text-[#0A6CFF] shrink-0" />
              <span className="truncate">Broadcast Buy (WTB) Request</span>
              {currentTier !== 'gold' && (
                <span className="ml-auto text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                  Gold
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenBroadcastWts}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200/60"
            >
              <Package className="w-4 h-4 text-[#10B981] shrink-0" />
              <span className="truncate">Broadcast Sell (WTS)</span>
              {currentTier !== 'gold' && (
                <span className="ml-auto text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                  Gold
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* UPGRADE MEMBERSHIP MODAL */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          setUpgradeModalConfig(null);
          refreshAll();
        }}
        title={upgradeModalConfig?.title}
        subtitle={upgradeModalConfig?.subtitle}
        goldOnly={upgradeModalConfig?.goldOnly}
      />

      {/* BROADCAST WTB MODAL */}
      <BroadcastWtbModal
        isOpen={broadcastWtbOpen}
        onClose={() => setBroadcastWtbOpen(false)}
        onSuccess={() => {
          refreshAll();
          setBroadcastWtbOpen(false);
        }}
      />

      {/* BROADCAST WTS MODAL */}
      <BroadcastWtsModal
        isOpen={broadcastWtsOpen}
        onClose={() => setBroadcastWtsOpen(false)}
        onSuccess={() => {
          refreshAll();
          setBroadcastWtsOpen(false);
        }}
      />

      {/* QUOTATION MODAL */}
      {selectedWtbForQuote && (
        <QuotationModal
          wtbRequest={selectedWtbForQuote}
          isOpen={!!selectedWtbForQuote}
          onClose={() => setSelectedWtbForQuote(null)}
          onSuccess={() => {
            setSelectedWtbForQuote(null);
            refreshAll();
          }}
        />
      )}

      {/* UNIFORM CREATE WTB / WTS MODAL */}
      <CreateWtbModal
        isOpen={createWtbOpen}
        initialMode={tradeModalMode}
        onClose={() => setCreateWtbOpen(false)}
        onSuccess={refreshAll}
      />
    </>
  );
}
