'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { getBuyerWtbRequests } from '@/lib/actions/wtb';
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
} from 'lucide-react';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';

export default function BuyerRequestsPage() {
  const { company, role } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [wtbList, setWtbList] = useState<WtbRequest[]>([]);
  const [receivedQuotes, setReceivedQuotes] = useState<ReceivedWtbQuote[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createWtbOpen, setCreateWtbOpen] = useState(false);

  const buyerName = company?.contact_name || company?.email?.split('@')[0] || 'Buyer';
  const buyerCompanyName = company?.name || `${buyerName} Enterprise`;

  const refreshRequests = () => {
    if (company?.email) {
      getBuyerWtbRequests(company.email).then((data) => {
        setWtbList(data);
      });
    }
  };

  // Load WTB requests and received quotes
  useEffect(() => {
    let isMounted = true;
    const buyerEmail = company?.email;

    if (buyerEmail) {
      // 1. Load WTB requests
      getBuyerWtbRequests(buyerEmail).then((data) => {
        if (isMounted) {
          setWtbList(data);
          setIsLoading(false);
        }
      });

      // 2. Load received quotes
      const quotes = getBuyerReceivedQuotes(buyerEmail);
      setReceivedQuotes(quotes);

      // Listen for real-time received quotes updates
      const handleQuotesUpdate = (e: Event) => {
        const custom = e as CustomEvent<ReceivedWtbQuote[]>;
        if (custom.detail) {
          setReceivedQuotes(custom.detail);
        } else {
          setReceivedQuotes(getBuyerReceivedQuotes(buyerEmail));
        }
      };

      window.addEventListener('b2b_received_quotes_update', handleQuotesUpdate);
      return () => {
        isMounted = false;
        window.removeEventListener('b2b_received_quotes_update', handleQuotesUpdate);
      };
    } else {
      setIsLoading(false);
    }
  }, [company?.email]);

  // WTB requests sent by the buyer
  const buyerRequests = wtbList.filter((req) => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      req.product_name.toLowerCase().includes(q) ||
      req.category_slug.toLowerCase().includes(q) ||
      (req.barcode_or_sku && req.barcode_or_sku.toLowerCase().includes(q))
    );
  });

  const totalProcurementValue = buyerRequests.reduce(
    (acc, req) => acc + (req.target_quantity * req.target_price),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight">
            My WTB Requests
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Track and manage Want-To-Buy procurement requests sent by {buyerCompanyName} to verified European suppliers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateWtbOpen(true)}
          className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-5 py-2.5 rounded-full transition flex items-center gap-2 self-start sm:self-auto shadow-xs cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Post New WTB Request</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#EAEFF6] shadow-xs">
          <div className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
            Active Requests
          </div>
          <div className="text-[28px] font-black text-[#0B1F3A]">
            {buyerRequests.length}
          </div>
          <div className="text-[12px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Broadcasted across EU suppliers</span>
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
            £{totalProcurementValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by product name, category, or barcode..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-full text-[#0B1F3A] placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF]"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-[#EAEFF6] overflow-hidden shadow-xs">
        {buyerRequests.length === 0 ? (
          <div className="p-12 text-center text-[#5B6B82]">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-[#0B1F3A] text-base">No WTB requests found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">Post a procurement request to receive quotes from verified distributors.</p>
            <button
              type="button"
              onClick={() => setCreateWtbOpen(true)}
              className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-xs px-4 py-2 rounded-full inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Request</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {buyerRequests.map((req) => {
              const quotesForThisReq = receivedQuotes.filter(
                (q) => q.wtbRequestId === req.id || q.productName === req.product_name
              );
              const isExpanded = expandedRequestId === req.id;

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

                        {quotesForThisReq.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            <Sparkles className="w-3 h-3 text-[#0A6CFF]" />
                            <span>{quotesForThisReq.length} Supplier {quotesForThisReq.length === 1 ? 'Quote' : 'Quotes'} Received</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Awaiting supplier offers
                          </span>
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
                          Target Price: <strong className="text-[#0A6CFF]">£{req.target_price.toFixed(2)} / unit</strong>
                        </div>
                        <div>
                          Total Budget:{' '}
                          <strong className="text-[#0B1F3A]">
                            £{(req.target_quantity * req.target_price).toLocaleString()}
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

                      <Link
                        href="/requests"
                        className="text-[12px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-full transition flex items-center gap-1"
                      >
                        <span>Demand Board</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Expandable Received Quotes list from Suppliers */}
                  {quotesForThisReq.length > 0 && (isExpanded || quotesForThisReq.length === 1) && (
                    <div className="pt-2">
                      <div className="bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl p-4 sm:p-5 space-y-3.5">
                        <div className="text-[12px] font-bold uppercase tracking-wider text-[#0A6CFF] flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#0A6CFF]" />
                          <span>Supplier Quotes & Proposals ({quotesForThisReq.length})</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {quotesForThisReq.map((q) => (
                            <div
                              key={q.id}
                              className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-[15px] text-[#0B1F3A]">
                                    {q.sellerCompanyName}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                    {q.sellerTier} Supplier
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    • {new Date(q.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#5B6B82]">
                                  <div>
                                    Offered Price: <strong className="text-[#0A6CFF] font-bold">£{q.offeredPrice.toFixed(2)}</strong> / unit
                                  </div>
                                  <div>
                                    Quantity: <strong className="text-[#0B1F3A]">{q.offeredQuantity.toLocaleString()} units</strong>
                                  </div>
                                  <div>
                                    Total Value: <strong className="text-[#0B1F3A]">£{q.totalPrice.toLocaleString()}</strong>
                                  </div>
                                  <div>
                                    Lead Time: <strong className="text-[#0B1F3A]">{q.leadTimeDays} business days</strong>
                                  </div>
                                </div>

                                {q.notes && (
                                  <p className="text-[12px] text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    &ldquo;{q.notes}&rdquo;
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Link
                                  href={`/dashboard/inquiries?id=${q.conversationId}`}
                                  className="inline-flex items-center gap-1.5 bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[12px] font-bold px-4 py-2 rounded-full shadow-xs transition"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat with Supplier</span>
                                </Link>

                                {q.sellerEmail && (
                                  <a
                                    href={`mailto:${q.sellerEmail}?subject=Re: Quotation for ${encodeURIComponent(q.productName)}&body=Hello ${encodeURIComponent(q.sellerCompanyName)},%0D%0A%0D%0AThank you for your quotation for ${encodeURIComponent(q.productName)} (£${q.offeredPrice} for ${q.offeredQuantity} units).%0D%0A%0D%0AWe would like to proceed with the following terms:`}
                                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] text-[12px] font-semibold px-3.5 py-2 rounded-full transition"
                                    title="Send direct email to supplier"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-[#0A6CFF]" />
                                    <span>Email</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Uniform Create WTB Modal */}
      <CreateWtbModal
        isOpen={createWtbOpen}
        onClose={() => setCreateWtbOpen(false)}
        onSuccess={refreshRequests}
      />
    </div>
  );
}
