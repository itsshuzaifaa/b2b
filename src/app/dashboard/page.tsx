'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { QuotationModal } from '@/components/modals/QuotationModal';
import { CsvImportModal } from '@/components/dashboard/CsvImportModal';
import { WelcomeModal } from '@/components/modals/WelcomeModal';
import type { WtbRequest, MembershipTier } from '@/types/database';
import { TIER_LIMITS } from '@/types/database';
import { getConversationsForUser, syncWithSupabase } from '@/lib/messaging/messaging-store';
import {
  Plus,
  ShieldAlert,
  X,
  Phone,
  Mail,
  User,
  Inbox,
  FileText,
  PlusCircle,
  ArrowRight,
  CheckCircle2,
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

interface MatchingStockRequest {
  id: string;
  title: string;
  matchType: 'barcode' | 'category';
  units: number;
  targetPrice: number;
  currency: string;
  barcode: string;
  category: string;
  buyerName: string;
  notes: string;
}

export default function OverviewPage() {
  const { company, role, isLoading } = useAuth();
  const isBuyer = role === 'buyer' || company?.role === 'buyer';

  // Modals state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [selectedWtbForQuote, setSelectedWtbForQuote] = useState<WtbRequest | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);

  const [buyerInquiries, setBuyerInquiries] = useState<any[]>([]);
  const [buyerWtbList, setBuyerWtbList] = useState<WtbRequest[]>([]);

  // Dynamic seller stats (Issue 03, 04, 05, 06)
  const [sellerProductsCount, setSellerProductsCount] = useState<number>(0);
  const [sellerQuotesCount, setSellerQuotesCount] = useState<number>(0);
  const [sellerInquiriesCount, setSellerInquiriesCount] = useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;
    if (isBuyer) {
      const convs = getConversationsForUser(company);
      setBuyerInquiries(convs);
      void syncWithSupabase(role || undefined, company?.id, company?.email).then(() => {
        if (isMounted) setBuyerInquiries(getConversationsForUser(company));
      });
      if (company?.email) {
        import('@/lib/actions/wtb').then(({ getBuyerWtbRequests }) => {
          getBuyerWtbRequests(company.email).then((wtb) => {
            if (isMounted) setBuyerWtbList(wtb);
          });
        });
      }
    } else if (company) {
      // 1. Listings count: query local listings and API
      let localListingsCount = 0;
      try {
        const raw = localStorage.getItem('b2b_seller_listings_real_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localListingsCount = parsed.length;
        }
      } catch {}
      setSellerProductsCount(localListingsCount);

      if (company.id) {
        fetch(`/api/products?companyId=${encodeURIComponent(company.id)}`)
          .then((res) => res.json())
          .then((data) => {
            if (isMounted && data.success && Array.isArray(data.products)) {
              setSellerProductsCount(Math.max(localListingsCount, data.products.length));
            }
          })
          .catch(() => {});
      }

      // 2. Quotes count: load company quotes (no hardcoded quotes)
      try {
        const quotesKey = `b2b_sent_quotes_${company.id}`;
        const rawQ = localStorage.getItem(quotesKey) || localStorage.getItem('b2b_sent_quotes_v2');
        if (rawQ) {
          const parsedQ = JSON.parse(rawQ);
          if (Array.isArray(parsedQ)) setSellerQuotesCount(parsedQ.length);
        } else {
          setSellerQuotesCount(0);
        }
      } catch {
        setSellerQuotesCount(0);
      }

      // 3. Inquiries count: load seller inquiries
      try {
        const convs = getConversationsForUser(company);
        const buyerInqs = convs.filter((c: any) => c.type === 'buyer_seller' && c.sellerCompanyId === company.id);
        setSellerInquiriesCount(buyerInqs.length);
        void syncWithSupabase(role || undefined, company.id, company.email).then(() => {
          if (!isMounted) return;
          const updatedConvs = getConversationsForUser(company);
          const updatedBuyerInqs = updatedConvs.filter((c: any) => c.type === 'buyer_seller' && c.sellerCompanyId === company.id);
          setSellerInquiriesCount(updatedBuyerInqs.length);
        });
      } catch {}
    }
    return () => {
      isMounted = false;
    };
  }, [isBuyer, company, role]);

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0A6CFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] font-medium text-[#5B6B82]">Loading account overview...</p>
        </div>
      </div>
    );
  }

  // If active user is a Buyer, display strictly the Buyer Dashboard (Inquiries, WTB Requests, Edit Profile)
  if (isBuyer) {
    const buyerName = company?.contact_name || company?.name || company?.email?.split('@')[0] || 'Buyer';

    return (
      <div className="space-y-6">
        {/* Welcome Modal Popup from Jeff */}
        <WelcomeModal
          buyerName={buyerName}
          buyerEmail={company?.email || ''}
          companyId={company?.id}
        />

        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight">
              Buyer Dashboard
            </h1>
            <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
              Welcome back, <strong className="text-[#0B1F3A] font-semibold">{buyerName}</strong>. Manage your procurement inquiries and Want-To-Buy requests.
            </p>
          </div>

          <Link
            href="/requests/new"
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-5 py-2.5 rounded-full transition flex items-center gap-2 self-start sm:self-auto shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Post New WTB Request</span>
          </Link>
        </div>

        {/* The 3 Core Buyer Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Option 1: Inquiries */}
          <Link
            href="/dashboard/inquiries"
            className="group bg-white rounded-2xl p-6 border border-[#EAEFF6] shadow-xs hover:border-[#0A6CFF] hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Inbox className="w-6 h-6" />
              </div>
              <h2 className="text-[18px] font-black text-[#0B1F3A] mb-1.5">
                Inquiries
              </h2>
              <p className="text-[13px] text-[#5B6B82] leading-relaxed">
                Direct trade messages, quote proposals, and order communications with verified wholesale suppliers.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[13px] font-bold text-[#0A6CFF]">
              <span>Open Inquiries</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Option 2: WTB Requests sent by them */}
          <Link
            href="/dashboard/requests"
            className="group bg-white rounded-2xl p-6 border border-[#EAEFF6] shadow-xs hover:border-[#0A6CFF] hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-[18px] font-black text-[#0B1F3A] mb-1.5">
                WTB Requests Sent
              </h2>
              <p className="text-[13px] text-[#5B6B82] leading-relaxed">
                Track active Want-To-Buy procurement requests broadcasted across verified European wholesale suppliers.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[13px] font-bold text-[#059669]">
              <span>View WTB Requests</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Option 3: Edit Profile */}
          <Link
            href="/dashboard/profile"
            className="group bg-white rounded-2xl p-6 border border-[#EAEFF6] shadow-xs hover:border-[#0A6CFF] hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] text-slate-700 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-[18px] font-black text-[#0B1F3A] mb-1.5">
                Edit Profile
              </h2>
              <p className="text-[13px] text-[#5B6B82] leading-relaxed">
                Update your personal contact details, email address, phone number, and account information.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[13px] font-bold text-slate-800">
              <span>Edit Profile</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>

        {/* Quick Activity Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Recent Inquiries Preview */}
          <div className="bg-white rounded-2xl p-5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-[#0A6CFF]" />
                  <span>Recent Inquiries</span>
                </h3>
                <Link
                  href="/dashboard/inquiries"
                  className="text-[12px] font-bold text-[#0A6CFF] hover:underline"
                >
                  View all &rarr;
                </Link>
              </div>

              {buyerInquiries.length === 0 ? (
                <div className="p-6 text-center text-[#5B6B82] bg-slate-50/60 rounded-xl border border-dashed border-[#CFD9E8]">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0A6CFF] flex items-center justify-center mx-auto mb-2">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <h4 className="text-[13px] font-bold text-[#0B1F3A]">Your first inquiry shows here!</h4>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    When you contact a supplier about a wholesale stock lot on Marketplace, your direct chat appears right here.
                  </p>
                  <Link
                    href="/marketplace"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    <span>Explore Marketplace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyerInquiries.slice(0, 3).map((conv: any) => (
                    <div key={conv.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-bold text-[#0B1F3A] truncate">{conv.productTitle}</h4>
                        <p className="text-[12px] text-[#5B6B82] mt-0.5 truncate">{conv.sellerCompanyName} · {conv.lastMessageText || 'Chat open'}</p>
                      </div>
                      <Link
                        href={`/dashboard/inquiries?id=${conv.id}`}
                        className="text-[12px] font-bold text-[#0A6CFF] bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-blue-50 transition shrink-0 ml-3"
                      >
                        Chat
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active WTB Requests Preview */}
          <div className="bg-white rounded-2xl p-5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold text-[#0B1F3A] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#059669]" />
                  <span>Active WTB Requests Sent</span>
                </h3>
                <Link
                  href="/dashboard/requests"
                  className="text-[12px] font-bold text-[#0A6CFF] hover:underline"
                >
                  Manage all &rarr;
                </Link>
              </div>

              {buyerWtbList.length === 0 ? (
                <div className="p-6 text-center text-[#5B6B82] bg-slate-50/60 rounded-xl border border-dashed border-[#CFD9E8]">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#059669] flex items-center justify-center mx-auto mb-2">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-[13px] font-bold text-[#0B1F3A]">Your first WTB request shows here!</h4>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    Broadcast your bulk procurement demand across verified European distributors to receive direct quotes.
                  </p>
                  <Link
                    href="/requests/new"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#059669] hover:underline"
                  >
                    <span>+ Post New WTB Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyerWtbList.slice(0, 3).map((req) => (
                    <div key={req.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-bold text-[#0B1F3A] truncate">{req.product_name}</h4>
                        <p className="text-[12px] text-[#5B6B82] mt-0.5">Target: {req.target_quantity} units at £{req.target_price.toFixed(2)}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 ml-3">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User display name & company
  const sellerFirstName = company?.contact_name ? company.contact_name.split(' ')[0] : 'Seller';
  const companyName = company?.name || `${sellerFirstName} Enterprise`;

  const recentInquiries: InquiryItem[] = [];
  const matchingRequests: MatchingStockRequest[] = [];

  const handleOpenQuote = (req: MatchingStockRequest) => {
    const wtbPayload: WtbRequest = {
      id: req.id,
      buyer_company_id: 'comp-euro-retailer',
      buyer_name: req.buyerName,
      buyer_email: 'buyer@european-retail.eu',
      product_name: req.title,
      category_slug: req.category,
      target_quantity: req.units,
      target_price: req.targetPrice,
      barcode_or_sku: req.barcode,
      notes: req.notes,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    setSelectedWtbForQuote(wtbPayload);
  };

  const currentTier = ((company?.tier || company?.membership_tier || 'silver') as string).toLowerCase() as MembershipTier;
  const tierConfig = TIER_LIMITS[currentTier] || TIER_LIMITS.silver;
  const maxActiveProducts = tierConfig.maxActiveProducts;
  const isUnlimited = maxActiveProducts === Infinity;
  const maxQuotes = tierConfig.maxMonthlyQuotes || 25;

  return (
    <>
      {/* Dashboard Canvas Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Good morning, {sellerFirstName}
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Here is what is happening with {companyName} today.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCsvModalOpen(true)}
          className="self-start sm:self-auto bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] px-6 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add product</span>
        </button>
      </div>

      {/* 3 Stat Metric Cards (Dynamic, Barcode matches removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-7">
        {/* Card 1: Active listings */}
        <div className="bg-white rounded-[24px] p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="text-[13px] font-medium text-[#5B6B82]">Active listings</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[34px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {sellerProductsCount}
              </span>
              <span className="text-[14px] font-medium text-[#8A9BB0]">
                {isUnlimited ? '/ unlimited' : `/ ${maxActiveProducts}`}
              </span>
            </div>
          </div>
          <div className="text-[12px] font-medium text-[#8A9BB0] mt-4">
            {isUnlimited
              ? 'Unlimited on Gold'
              : `${Math.max(0, maxActiveProducts - sellerProductsCount)} listings left on ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}`}
          </div>
        </div>

        {/* Card 2: Quotes used */}
        <div className="bg-white rounded-[24px] p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="text-[13px] font-medium text-[#5B6B82]">Quotes used</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[34px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {sellerQuotesCount}
              </span>
              <span className="text-[14px] font-medium text-[#8A9BB0]">/ {maxQuotes}</span>
            </div>
          </div>
          <div>
            <div className="w-full h-1.5 bg-[#EAEFF6] rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="h-full bg-[#0A6CFF] rounded-full transition-all"
                style={{ width: `${Math.min(100, (sellerQuotesCount / maxQuotes) * 100)}%` }}
              />
            </div>
            <div className="text-[12px] font-medium text-[#8A9BB0]">
              {Math.max(0, maxQuotes - sellerQuotesCount)} quotes left this month
            </div>
          </div>
        </div>

        {/* Card 3: New buyer inquiries */}
        <div className="bg-white rounded-[24px] p-6 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="text-[13px] font-medium text-[#5B6B82]">New buyer inquiries</div>
            <div className="mt-2">
              <span className="text-[34px] font-extrabold text-[#0B1F3A] tracking-tight leading-none">
                {sellerInquiriesCount}
              </span>
            </div>
          </div>
          <div>
            <Link
              href="/dashboard/inquiries"
              className="text-[13px] font-bold text-[#0A6CFF] hover:underline mt-4 inline-block cursor-pointer"
            >
              Open inbox &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Two-Column Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-7">
        {/* LEFT COLUMN: Recent buyer inquiries (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-bold text-[#0B1F3A]">Recent buyer inquiries</h3>
              <Link
                href="/dashboard/inquiries"
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
              >
                View all
              </Link>
            </div>

            {/* Inquiries List */}
            <div className="space-y-4">
              {recentInquiries.length === 0 ? (
                <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8]">
                  <Inbox className="w-8 h-8 text-[#0A6CFF] mx-auto mb-2 opacity-60" />
                  <p className="text-[13px] font-bold text-[#0B1F3A]">No active buyer inquiries</p>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">When buyers inquire about your wholesale stock listings, they will show here.</p>
                </div>
              ) : (
                recentInquiries.map((inq, idx) => (
                  <div key={inq.id}>
                    <div
                      onClick={() => setSelectedInquiry(inq)}
                      className="flex items-center justify-between gap-4 p-2.5 -mx-2.5 rounded-2xl hover:bg-[#F8FAFC] transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] font-extrabold text-[13px] flex items-center justify-center shrink-0">
                          {inq.initials}
                        </div>

                        {/* Title & Product */}
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold text-[#0B1F3A] group-hover:text-[#0A6CFF] transition truncate">
                            {inq.companyName}
                          </div>
                          <div className="text-[13px] text-[#5B6B82] mt-0.5 font-normal truncate">
                            {inq.productTitle} · MOQ {inq.moq}
                          </div>
                        </div>
                      </div>

                      {/* Right Meta */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          New
                        </span>
                        <span className="text-[12px] text-[#8A9BB0] mt-1 font-medium">
                          {inq.timeAgo}
                        </span>
                      </div>
                    </div>

                    {/* Divider except last item */}
                    {idx < recentInquiries.length - 1 && (
                      <div className="border-t border-[#F1F5F9] my-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Requests matching your stock (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="mb-5">
              <h3 className="text-[18px] font-bold text-[#0B1F3A]">Requests matching your stock</h3>
            </div>

            {/* Matching Requests List */}
            <div className="space-y-4">
              {matchingRequests.length === 0 ? (
                <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8]">
                  <FileText className="w-8 h-8 text-[#059669] mx-auto mb-2 opacity-60" />
                  <p className="text-[13px] font-bold text-[#0B1F3A]">No matching WTB requests yet</p>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">Check the Buyer Demand Board to quote on commercial lots.</p>
                  <Link
                    href="/requests"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    <span>Browse Demand Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                matchingRequests.map((req, idx) => (
                  <div key={req.id}>
                    <div className="p-1">
                      {/* Top Row: Title + Badge */}
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h4 className="text-[15px] font-bold text-[#0B1F3A] leading-snug">
                          {req.title}
                        </h4>
                        {req.matchType === 'barcode' ? (
                          <span className="bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                            Barcode match
                          </span>
                        ) : (
                          <span className="bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                            Category match
                          </span>
                        )}
                      </div>

                      {/* Units & Target Price */}
                      <div className="text-[13px] text-[#5B6B82] mb-3 font-normal">
                        {req.units} units · target {req.currency}
                        {req.targetPrice.toFixed(2)} per unit
                      </div>

                      {/* Send Quote Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenQuote(req)}
                        className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2 rounded-full inline-flex items-center justify-center transition shadow-xs cursor-pointer"
                      >
                        Send quote
                      </button>
                    </div>

                    {/* Divider except last item */}
                    {idx < matchingRequests.length - 1 && (
                      <div className="border-t border-[#F1F5F9] my-4" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUOTATION MODAL */}
      {selectedWtbForQuote && (
        <QuotationModal
          wtbRequest={selectedWtbForQuote}
          isOpen={!!selectedWtbForQuote}
          onClose={() => setSelectedWtbForQuote(null)}
          onSuccess={() => setSelectedWtbForQuote(null)}
        />
      )}

      {/* CSV / ADD PRODUCT MODAL */}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
      />

      {/* INQUIRY DETAIL MODAL */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] font-extrabold text-[14px] flex items-center justify-center">
                  {selectedInquiry.initials}
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0B1F3A]">{selectedInquiry.companyName}</h3>
                  <p className="text-[12px] text-[#5B6B82]">{selectedInquiry.timeAgo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div>
                <span className="text-[11px] font-bold text-[#8A9BB0] uppercase tracking-wider">
                  Product Inquired
                </span>
                <p className="text-[15px] font-bold text-[#0B1F3A] mt-0.5">
                  {selectedInquiry.productTitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                <div>
                  <span className="text-[11px] font-semibold text-[#8A9BB0]">Requested Quantity</span>
                  <p className="text-[14px] font-bold text-[#0B1F3A]">{selectedInquiry.targetQuantity} units</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#8A9BB0]">Buyer Target Price</span>
                  <p className="text-[14px] font-bold text-[#0A6CFF]">£{selectedInquiry.offeredPrice.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#8A9BB0] uppercase tracking-wider">
                  Buyer Message
                </span>
                <p className="text-[14px] text-[#41536D] mt-1 bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#EAEFF6] leading-relaxed">
                  &ldquo;{selectedInquiry.message}&rdquo;
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                  <User className="w-4 h-4 text-[#8A9BB0]" />
                  <span>Representative: <strong className="text-[#0B1F3A]">{selectedInquiry.buyerName}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                  <Mail className="w-4 h-4 text-[#8A9BB0]" />
                  <a href={`mailto:${selectedInquiry.buyerEmail}`} className="text-[#0A6CFF] hover:underline">
                    {selectedInquiry.buyerEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                  <Phone className="w-4 h-4 text-[#8A9BB0]" />
                  <a href={`tel:${selectedInquiry.buyerPhone}`} className="text-[#0B1F3A]">
                    {selectedInquiry.buyerPhone}
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <a
                href={`mailto:${selectedInquiry.buyerEmail}?subject=RE: Wholesale Inquiry for ${encodeURIComponent(selectedInquiry.productTitle)}`}
                className="flex-1 py-3 px-5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center transition"
              >
                Reply to Buyer
              </a>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
