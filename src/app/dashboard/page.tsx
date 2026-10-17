'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { CsvImportModal } from '@/components/dashboard/CsvImportModal';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
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
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  X,
  User,
  Mail,
  Phone,
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

  // Modals state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedWtbForQuote, setSelectedWtbForQuote] = useState<WtbRequest | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);

  // Unified data
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [wtbList, setWtbList] = useState<WtbRequest[]>([]);
  const [listingsCount, setListingsCount] = useState<number>(0);
  const [remainingUnlocks, setRemainingUnlocks] = useState<number>(2);
  const [unlockedCount, setUnlockedCount] = useState<number>(0);

  const currentTier = ((company?.tier || company?.membership_tier || 'bronze') as string).toLowerCase() as MembershipTier;
  const tierConfig = TIER_LIMITS[currentTier] || TIER_LIMITS.bronze;
  const maxActiveProducts = tierConfig.maxActiveProducts;
  const isUnlimitedProducts = maxActiveProducts === Infinity;
  const maxUnlocks = tierConfig.contactUnlocks ?? 2;
  const isUnlimitedUnlocks = maxUnlocks === Infinity;

  const loadData = () => {
    if (!company) return;

    // 1. Unlocked Leads count
    const unlockedIds = getUnlockedLeadIds(company.id);
    setUnlockedCount(unlockedIds.length);
    setRemainingUnlocks(getRemainingUnlocks(company.id, currentTier));

    // 2. Messaging Conversations
    const convs = getConversationsForUser(company);
    setInquiries(convs);

    // 3. Listings Count strictly scoped to this company
    let localCount = 0;
    try {
      const raw = localStorage.getItem('b2b_seller_listings_real_v2');
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
    setListingsCount(localCount);

    if (company.id) {
      fetch(`/api/products?companyId=${encodeURIComponent(company.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setListingsCount(data.products.length);
          }
        })
        .catch(() => {});
    }

    // 4. WTB Requests
    import('@/lib/actions/wtb').then(({ getBuyerWtbRequests, getPublicWtbRequests }) => {
      if (company.email) {
        getBuyerWtbRequests(company.email).then((list) => {
          if (list && list.length > 0) {
            setWtbList(list);
          } else {
            getPublicWtbRequests().then((openList: WtbRequest[]) => {
              setWtbList(openList.slice(0, 5));
            });
          }
        });
      } else {
        getPublicWtbRequests().then((openList: WtbRequest[]) => {
          setWtbList(openList.slice(0, 5));
        });
      }
    });
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_lead_unlock_update', loadData);
    if (company) {
      void syncWithSupabase(role || undefined, company.id, company.email).then(() => {
        setInquiries(getConversationsForUser(company));
      });
    }
    return () => {
      window.removeEventListener('b2b_lead_unlock_update', loadData);
    };
  }, [company, role, currentTier]);

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0A6CFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] font-medium text-[#5B6B82]">Loading trading workspace...</p>
        </div>
      </div>
    );
  }

  const memberName = company?.contact_name || company?.name || company?.email?.split('@')[0] || 'Member';
  const companyName = company?.name || `${memberName} Trading Ltd`;

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
            Welcome back, <strong className="text-[#0B1F3A] font-semibold">{memberName}</strong> ({companyName}). You can browse, buy, and sell wholesale stock from this dashboard.
          </p>
        </div>

        {/* Dual Buy & Sell Action Buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <Link
            href="/requests/new"
            className="bg-white hover:bg-slate-50 text-[#0B1F3A] border border-[#EAEFF6] font-bold text-[13px] px-4 py-2.5 rounded-full transition flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-[#0A6CFF]" />
            <span>Post WTB Request</span>
          </Link>

          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-5 py-2.5 rounded-full transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Listing</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6">
        {/* Card 1: Contact Unlocks (Monetization Engine) */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#5B6B82]">Contact unlocks</span>
              <span className="text-[10px] font-extrabold uppercase bg-blue-50 text-[#0A6CFF] px-2 py-0.5 rounded">
                {currentTier}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {isUnlimitedUnlocks ? '∞' : remainingUnlocks}
              </span>
              <span className="text-[13px] font-medium text-[#8A9BB0]">
                {isUnlimitedUnlocks ? 'unlimited unlocks' : `left of ${maxUnlocks}`}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
            <span className="text-[11px] text-[#5B6B82]">
              {unlockedCount} counterparties unlocked
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

        {/* Card 2: Active Listings (Selling) */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#5B6B82]">My active listings</span>
              <Package className="w-4 h-4 text-[#8A9BB0]" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {listingsCount}
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

        {/* Card 3: Want-To-Buy Requests (Buying Demand) */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#5B6B82]">WTB demand board</span>
              <FileText className="w-4 h-4 text-[#8A9BB0]" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {wtbList.length}
              </span>
              <span className="text-[13px] font-medium text-[#8A9BB0]">active requests</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
            <Link
              href="/requests"
              className="text-[11px] font-bold text-[#0A6CFF] hover:underline"
            >
              Explore board &rarr;
            </Link>
            <span className="text-[11px] text-[#8A9BB0]">Commercial demand</span>
          </div>
        </div>

        {/* Card 4: Trade Inquiries & Chat */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#5B6B82]">Trade inquiries</span>
              <Inbox className="w-4 h-4 text-[#8A9BB0]" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[32px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {inquiries.length}
              </span>
              <span className="text-[13px] font-medium text-[#8A9BB0]">conversations</span>
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
      </div>

      {/* Main Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-7">
        {/* LEFT COLUMN: Trade Inquiries & Order Discussions (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-bold text-[#0B1F3A]">Active Inquiries &amp; Messages</h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Direct commercial inquiries from European wholesale partners
                </p>
              </div>
              <Link
                href="/dashboard/inquiries"
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {inquiries.length === 0 ? (
                <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8]">
                  <Inbox className="w-8 h-8 text-[#0A6CFF] mx-auto mb-2 opacity-60" />
                  <p className="text-[13px] font-bold text-[#0B1F3A]">No active trade inquiries yet</p>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    When you contact a wholesale seller or receive inquiries on your listings, threads show here.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0A6CFF] hover:underline"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Browse Marketplace</span>
                    </Link>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setCsvModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#059669] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>List Stock</span>
                    </button>
                  </div>
                </div>
              ) : (
                inquiries.slice(0, 4).map((conv) => (
                  <div
                    key={conv.id}
                    className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-center justify-between gap-3 hover:bg-slate-100/70 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#0B1F3A] truncate">
                          {conv.productTitle || 'Wholesale Lot'}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-[#0A6CFF]">
                          Active
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5B6B82] mt-0.5 truncate">
                        {conv.sellerCompanyName || conv.buyerCompanyName || 'Counterparty'} · {conv.lastMessageText || 'Chat open'}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/inquiries?id=${conv.id}`}
                      className="bg-white border border-[#EAEFF6] hover:border-[#0A6CFF] text-[#0A6CFF] font-bold text-[12px] px-3.5 py-1.5 rounded-full transition shadow-2xs shrink-0"
                    >
                      Open Chat
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Want-To-Buy Commercial Demand (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-bold text-[#0B1F3A]">Demand Opportunities</h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  High-intent European Want-To-Buy requests
                </p>
              </div>
              <Link
                href="/requests"
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline"
              >
                Browse &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {wtbList.length === 0 ? (
                <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8]">
                  <FileText className="w-8 h-8 text-[#059669] mx-auto mb-2 opacity-60" />
                  <p className="text-[13px] font-bold text-[#0B1F3A]">No active requests</p>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    Post your procurement requirements to receive direct supplier offers.
                  </p>
                  <Link
                    href="/requests/new"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    <span>+ Post New Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                wtbList.slice(0, 3).map((req) => (
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
                          Target: <strong className="text-[#0B1F3A]">{req.target_quantity} units</strong> · £{req.target_price.toFixed(2)}/unit
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
                        href={`/requests`}
                        className="text-[12px] font-bold text-[#0A6CFF] hover:underline"
                      >
                        View &amp; Quote &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
            <Link
              href="/requests/new"
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[12px] flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4 text-[#0A6CFF]" />
              <span>Broadcast a Want-To-Buy Request</span>
            </Link>
          </div>
        </div>
      </div>

      {/* CSV / ADD PRODUCT MODAL */}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => {
          setCsvModalOpen(false);
          loadData();
        }}
      />

      {/* UPGRADE MEMBERSHIP MODAL */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />

      {/* QUOTATION MODAL */}
      {selectedWtbForQuote && (
        <QuotationModal
          wtbRequest={selectedWtbForQuote}
          isOpen={!!selectedWtbForQuote}
          onClose={() => setSelectedWtbForQuote(null)}
          onSuccess={() => setSelectedWtbForQuote(null)}
        />
      )}
    </>
  );
}
