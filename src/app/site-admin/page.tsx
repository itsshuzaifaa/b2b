'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminAccounts,
  saveAdminAccounts,
  getAdminPayments,
  getAdminListings,
  getCustomerQueries,
  updateAccountApproval,
  broadcastMessageToAllSellers,
  isAccountDeleted,
  type AdminClientAccount,
  type AdminPaymentRecord,
  type CustomerQuery,
} from '@/lib/admin/admin-store';
import {
  Users,
  CreditCard,
  ShieldCheck,
  Package,
  ArrowRight,
  CheckCircle2,
  Send,
  X,
  Mail,
  ExternalLink,
  HelpCircle,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  Check,
} from 'lucide-react';

export default function SiteAdminOverviewPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminClientAccount[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [listingsCount, setListingsCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Broadcast modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/accounts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          saveAdminAccounts(data.accounts);
        } else {
          setAccounts(getAdminAccounts());
        }
      } else {
        setAccounts(getAdminAccounts());
      }
    } catch {
      setAccounts(getAdminAccounts());
    }
    setPayments(getAdminPayments());
    setListingsCount(getAdminListings().length);
    setQueries(getCustomerQueries());

    try {
      const qRes = await fetch('/api/admin/queries', { cache: 'no-store' });
      if (qRes.ok) {
        const qData = await qRes.json();
        if (Array.isArray(qData.queries)) {
          setQueries(qData.queries);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    window.addEventListener('b2b_queries_update', loadData);
    const interval = setInterval(loadData, 5000);
    return () => {
      window.removeEventListener('b2b_admin_update', loadData);
      window.removeEventListener('b2b_queries_update', loadData);
      clearInterval(interval);
    };
  }, []);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleVerifyAccountQuick = async (acc: AdminClientAccount) => {
    // Optimistic AJAX state update
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, approval_status: 'approved', account_status: 'active' } : a))
    );
    updateAccountApproval(acc.id, 'approved');
    showNotice(`Account "${acc.name}" verified & activated! Compliance notice sent to ${acc.email}.`);

    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          companyId: acc.id,
          email: acc.email,
          contactName: acc.contact_name,
          companyName: acc.name,
        }),
      });
    } catch {}
    loadData();
  };

  const completedPayments = payments.filter((p) => p.status === 'Completed');
  const totalCompletedGbp = completedPayments.reduce((sum, p) => sum + p.amount_gbp, 0);

  const pendingAccounts = accounts.filter(
    (a) => a.approval_status === 'pending' || a.approval_status === 'pending_verification'
  );
  const newQueries = queries.filter((q) => q.status === 'new');

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    const sentCount = broadcastMessageToAllSellers(broadcastText.trim());
    setBroadcastSuccess(`Broadcast successfully dispatched to ${sentCount} registered traders!`);
    setTimeout(() => {
      setShowBroadcastModal(false);
      setBroadcastSuccess(null);
      setBroadcastText('');
    }, 1800);
  };

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[#0A6CFF] animate-pulse" />
            <span>Platform Executive Desk</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Platform Control Center
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Real-time compliance oversight for global traders, card fee settlements, stock listings, and customer inquiries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="bg-[#050E1D] hover:bg-[#0B1F3A] text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Broadcast Message</span>
          </button>
          <Link
            href="/site-admin/payments"
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment Ledger</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Requirement 02: 4 Metric Cards Grid in specified order:
          1. Settled Platform Volume (Amount box)
          2. Active Users / Registered Accounts
          3. Marketplace Listings
          4. Customer Queries (with direct link)
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6">
        {/* Card 1: Amount Box (Settled Platform Volume) */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Settled Volume
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              €{totalCompletedGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[12px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Card Subscriptions Cleared</span>
            </p>
          </div>
        </div>

        {/* Card 2: Active Users / Registered Accounts */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Active Users
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              {accounts.length}
            </div>
            <p className="text-[12px] text-[#5B6B82] font-medium mt-1.5">
              Unified wholesale accounts on file
            </p>
          </div>
        </div>

        {/* Card 3: Marketplace Listings */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Marketplace Listings
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              {listingsCount}
            </div>
            <p className="text-[12px] text-[#5B6B82] font-medium mt-1.5">
              Live physical lots global stock
            </p>
          </div>
        </div>

        {/* Card 4: Customer Queries (New Page Link) */}
        <Link
          href="/site-admin/queries"
          className="p-5 rounded-[24px] bg-[#F8FAFC] hover:bg-[#F0F6FF] border border-[#EAEFF6] hover:border-[#0A6CFF] transition flex flex-col justify-between shadow-xs group"
        >
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-[#0A6CFF]">
              Customer Queries
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none flex items-center justify-between">
              <span>{queries.length}</span>
              {newQueries.length > 0 && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {newQueries.length} New
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#0A6CFF] font-semibold mt-1.5 flex items-center gap-1 group-hover:underline">
              <span>View contact desk requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </Link>
      </div>

      {/* Requirement 03: Split 50% / 50% on desktop:
          - Left: Payment Ledger (Recent Client Payments)
          - Right: Important Updates (Verification Queue & Inquiries)
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* LEFT HALF: PAYMENT LEDGER */}
        <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-6 sm:p-7 shadow-[0_4px_24px_rgba(11,31,58,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-[17px] font-bold text-[#0B1F3A] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0A6CFF]" />
                  <span>Payment Ledger</span>
                </h2>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Recent card settlements and monthly subscription receipts.
                </p>
              </div>
              <Link
                href="/site-admin/payments"
                className="text-[12px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1"
              >
                <span>View Full Ledger ({payments.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#F8FAFC] mt-2">
              {payments.slice(0, 5).map((pay) => (
                <div key={pay.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                        {pay.company_name}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {pay.status === 'Completed' ? 'Succeeded ✓' : pay.status}
                      </span>
                    </div>
                    <div className="text-[12px] text-[#5B6B82] truncate mt-0.5">
                      {pay.plan_or_service} &bull; <span className="font-mono text-[11px] text-[#8A9BB0]">{pay.transaction_id}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-[14px] sm:text-[15px] text-[#0B1F3A]">
                      €{pay.amount_gbp.toFixed(2)} EUR
                    </div>
                    <div className="text-[11px] text-[#8A9BB0] mt-0.5">{pay.created_at}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-[#F8FAFC]">
            <Link
              href="/site-admin/payments"
              className="text-[13px] font-bold text-[#0A6CFF] hover:underline flex items-center justify-center gap-1.5 py-1"
            >
              <span>Manage all billing statements and invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RIGHT HALF: IMPORTANT UPDATES & VERIFICATION QUEUE */}
        <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-6 sm:p-7 shadow-[0_4px_24px_rgba(11,31,58,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <div>
                  <h2 className="text-[17px] font-bold text-[#0B1F3A]">
                    Important Updates
                  </h2>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    Pending KYC documents, compliance alerts, and trader inquiries.
                  </p>
                </div>
              </div>
              <Link
                href="/site-admin/users"
                className="text-[12px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1"
              >
                <span>Audit Accounts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Alert Items: Pending KYC accounts */}
              {pendingAccounts.length > 0 ? (
                pendingAccounts.slice(0, 3).map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                          {acc.name}
                        </span>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                          Document Verification Needed
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5B6B82] mt-0.5 truncate">
                        Contact: {acc.contact_name} &bull; {acc.email}{' '}
                        {acc.vat_number ? `• VAT: ${acc.vat_number}` : ''}
                      </p>
                      <span className="text-[11px] text-amber-700 font-semibold block mt-1">
                        Registered {acc.created_at} &bull; Documents submitted for review
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyAccountQuick(acc)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] px-3.5 py-1.5 rounded-full shadow-xs transition flex items-center gap-1 cursor-pointer"
                        title="Approve & activate account"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : null}

              {/* Alert Items: Unreplied Customer Queries */}
              {newQueries.length > 0 ? (
                newQueries.slice(0, 2).map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                          Inquiry: {q.name} ({q.company})
                        </span>
                        <span className="bg-blue-100 text-blue-900 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                          {q.topic}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5B6B82] mt-0.5 line-clamp-1">
                        {q.message}
                      </p>
                      <span className="text-[11px] text-blue-700 font-semibold block mt-0.5">
                        Received on {q.created_at} &bull; Awaiting admin response
                      </span>
                    </div>

                    <div className="shrink-0">
                      <Link
                        href="/site-admin/queries"
                        className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[12px] px-3.5 py-1.5 rounded-full shadow-xs transition flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </Link>
                    </div>
                  </div>
                ))
              ) : null}

              {/* If no pending items */}
              {pendingAccounts.length === 0 && newQueries.length === 0 && (
                <div className="py-8 text-center bg-[#F8FAFC] border border-dashed border-[#EAEFF6] rounded-2xl">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                  <p className="text-[14px] font-bold text-[#0B1F3A]">Compliance Up to Date</p>
                  <p className="text-[12px] text-[#5B6B82] mt-0.5">
                    No pending customer verifications or unread inquiries at this moment.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-[#F8FAFC] flex items-center justify-between text-[12px] text-[#8A9BB0]">
            <span>Platform auto-verifies registered Estonian &amp; UK companies.</span>
            <Link href="/site-admin/users" className="text-[#0A6CFF] font-bold hover:underline">
              View all clients &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
        <Link
          href="/site-admin/users"
          className="p-5 rounded-[24px] bg-white border border-[#EAEFF6] hover:border-[#0A6CFF] transition shadow-[0_4px_20px_rgba(11,31,58,0.02)] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-bold text-[#0B1F3A]">
            Accounts Directory (Buyers &amp; Sellers)
          </h3>
          <p className="text-[12px] text-[#5B6B82] mt-1 leading-relaxed">
            Manage clients, inspect dossiers, update membership tiers, or suspend accounts.
          </p>
        </Link>

        <Link
          href="/site-admin/listings"
          className="p-5 rounded-[24px] bg-white border border-[#EAEFF6] hover:border-[#0A6CFF] transition shadow-[0_4px_20px_rgba(11,31,58,0.02)] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-bold text-[#0B1F3A]">
            Listing Moderation &amp; Quality Control
          </h3>
          <p className="text-[12px] text-[#5B6B82] mt-1 leading-relaxed">
            Audit wholesale catalog items, suspend fraudulent stock lots, and toggle Hot deals.
          </p>
        </Link>

        <Link
          href="/site-admin/messages"
          className="p-5 rounded-[24px] bg-white border border-[#EAEFF6] hover:border-[#0A6CFF] transition shadow-[0_4px_20px_rgba(11,31,58,0.02)] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Send className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-bold text-[#0B1F3A]">
            Seller Communication &amp; Trade Inquiries
          </h3>
          <p className="text-[12px] text-[#5B6B82] mt-1 leading-relaxed">
            Admin desk announcements, private seller threads, and buyer-seller trade oversight.
          </p>
        </Link>
      </div>

      {/* BROADCAST ANNOUNCEMENT MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0B1F3A] text-[#00E5FF] flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0B1F3A]">
                    Broadcast Message to All Members
                  </h3>
                  <p className="text-[11px] text-[#5B6B82]">
                    Delivers instantaneously to registered member inboxes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="text-[#8A9BB0] hover:text-[#0B1F3A] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {broadcastSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[16px] text-[#0B1F3A]">Broadcast Dispatched</h4>
                <p className="text-[13px] text-[#5B6B82]">{broadcastSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleSendBroadcast} className="mt-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5 uppercase tracking-wider">
                    Broadcast Announcement
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="Enter platform notice, regulatory update, or maintenance alert..."
                    className="w-full px-4 py-3 text-[14px] bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-5 py-2.5 rounded-full border border-[#EAEFF6] text-[#41536D] font-bold text-[13px] hover:bg-[#F3F6FB] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Announcement</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
