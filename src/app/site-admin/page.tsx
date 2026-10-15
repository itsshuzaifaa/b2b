'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminAccounts,
  getAdminPayments,
  getAdminListings,
  broadcastMessageToAllSellers,
  type AdminClientAccount,
  type AdminPaymentRecord,
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
} from 'lucide-react';

export default function SiteAdminOverviewPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminClientAccount[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [listingsCount, setListingsCount] = useState<number>(0);

  // Broadcast modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/accounts');
      if (res.ok) {
        const data = await res.json();
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
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
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    return () => window.removeEventListener('b2b_admin_update', loadData);
  }, []);

  const totalSellers = accounts.filter((a) => a.role === 'seller').length;
  const totalBuyers = accounts.filter((a) => a.role === 'buyer').length;
  const completedPayments = payments.filter((p) => p.status === 'Completed');
  const totalCompletedGbp = completedPayments.reduce((sum, p) => sum + p.amount_gbp, 0);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    const sentCount = broadcastMessageToAllSellers(broadcastText.trim());
    setBroadcastSuccess(`Broadcast successfully dispatched to ${sentCount} registered sellers!`);
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
            Real-time compliance oversight for European buyers, sellers, card fee settlements, and stock listings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="bg-[#050E1D] hover:bg-[#0B1F3A] text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Broadcast to Sellers</span>
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

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mt-6">
        {/* Card 1: Total Accounts */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider">Registered Accounts</span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              {accounts.length}
            </div>
            <p className="text-[12px] text-[#5B6B82] font-medium mt-1.5">
              {totalSellers} Sellers · {totalBuyers} Verified Buyers
            </p>
          </div>
        </div>

        {/* Card 2: Fee Collections */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider">Settled Platform Volume</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              £{totalCompletedGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[12px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Card Checkout Subscriptions Cleared</span>
            </p>
          </div>
        </div>

        {/* Card 3: Active Listings */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider">Marketplace Listings</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              {listingsCount}
            </div>
            <p className="text-[12px] text-[#5B6B82] font-medium mt-1.5">
              All physical lots European stock
            </p>
          </div>
        </div>
      </div>

      {/* Recent Client Payments Ledger Preview */}
      <div className="mt-8 bg-white rounded-[24px] border border-[#EAEFF6] p-6 shadow-[0_4px_20px_rgba(11,31,58,0.02)]">
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-[16px] font-bold text-[#0B1F3A]">
              Recent Client Payments
            </h2>
            <p className="text-[12px] text-[#5B6B82]">
              Stripe card subscriptions, membership renewals, and automated client receipts.
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
          {payments.slice(0, 4).map((pay) => (
            <div key={pay.id} className="py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[14px] text-[#0B1F3A] truncate">
                    {pay.company_name}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Succeeded ✓
                  </span>
                </div>
                <div className="text-[12px] text-[#5B6B82] truncate mt-0.5">
                  {pay.plan_or_service} · <span className="font-mono text-[11px] text-[#8A9BB0]">{pay.transaction_id}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="font-black text-[15px] text-[#0B1F3A]">
                    £{pay.amount_gbp.toFixed(2)} GBP
                  </div>
                  <div className="text-[11px] text-[#8A9BB0]">{pay.created_at}</div>
                </div>
              </div>
            </div>
          ))}
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
                    Broadcast Message to All Sellers
                  </h3>
                  <p className="text-[11px] text-[#5B6B82]">
                    Delivers instantaneously to all registered seller inboxes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {broadcastSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-[18px] font-bold text-[#0B1F3A]">Broadcast Dispatched!</h4>
                <p className="text-[13px] text-[#5B6B82]">{broadcastSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleSendBroadcast} className="py-4 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                    Announcement Content *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="E.g., Important update: Please ensure all lots have up-to-date quantities..."
                    className="w-full p-3.5 text-[14px] border border-[#E2E8F0] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition resize-none font-medium"
                  />
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#EAEFF6] text-[11px] text-[#5B6B82] leading-relaxed">
                  Every registered seller will receive this notification directly inside their <strong>Buyer inquiries</strong> chat thread with the executive desk.
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-5 py-2.5 text-[13px] font-semibold text-[#5B6B82] hover:text-[#0B1F3A] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Broadcast</span>
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
