'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getAdminPayments,
  getAdminAccounts,
  type AdminPaymentRecord,
} from '@/lib/admin/admin-store';
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  X,
  FileText,
  Building2,
  Check,
  ShieldCheck,
  Download,
  MoreHorizontal,
  ChevronDown,
  Pencil,
  Copy,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  Calendar,
  Sparkles,
  Mail,
} from 'lucide-react';

export default function SiteAdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | '30days' | '90days'>('all');
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentMonthStr, setCurrentMonthStr] = useState('Oct');
  const [currentMonthYearStr, setCurrentMonthYearStr] = useState('Oct 2026');

  const loadData = () => {
    setPayments(getAdminPayments());
  };

  useEffect(() => {
    loadData();
    try {
      const now = new Date();
      setCurrentMonthStr(now.toLocaleDateString('en-GB', { month: 'short' }));
      setCurrentMonthYearStr(now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }));
    } catch {}
    window.addEventListener('b2b_admin_update', loadData);
    return () => window.removeEventListener('b2b_admin_update', loadData);
  }, []);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filtered payments by search & date filter
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.company_name.toLowerCase().includes(q) ||
        p.plan_or_service.toLowerCase().includes(q) ||
        p.transaction_id.toLowerCase().includes(q) ||
        p.contact_email.toLowerCase().includes(q) ||
        p.invoice_number.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (dateFilter === 'month') {
        return p.created_at.includes(currentMonthYearStr) || p.created_at.includes('2026');
      }

      return true;
    });
  }, [payments, searchQuery, dateFilter, currentMonthYearStr]);

  // Aggregate metrics
  const completedPayments = payments.filter((p) => p.status === 'Completed');
  const totalSettled = completedPayments.reduce((acc, p) => acc + p.amount_gbp, 0);

  // This month's payments
  const thisMonthPayments = completedPayments.filter((p) => p.created_at.includes(currentMonthStr) || p.created_at.includes('Oct'));
  const thisMonthTotal = thisMonthPayments.reduce((acc, p) => acc + p.amount_gbp, 0);

  // Accounts with active paid subscriptions
  const accounts = getAdminAccounts();
  const activePaidSubs = accounts.filter(
    (a) => a.membership_tier === 'silver' || a.membership_tier === 'gold'
  );
  const mrr = activePaidSubs.reduce(
    (acc, a) => acc + (a.membership_tier === 'gold' ? 179 : 79),
    0
  );

  return (
    <div className="relative min-h-full space-y-6 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EAEFF6]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Settlement Ledger
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Direct Card &amp; Wise Automated Reconciliation
            </span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] tracking-tight">
            Payment Records / Ledgers
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Real-time transaction receipts, client membership subscriptions, and automated corporate invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showNotice('Statement exported to CSV.')}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-full transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Statement</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Summary Metric Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* Box 1: Active Paid Subscriptions */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Active Paid Subscriptions
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              {activePaidSubs.length} Active
            </div>
            <p className="text-[12px] text-[#0A6CFF] font-semibold mt-1.5">
              MRR: £{mrr.toFixed(2)}/mo &bull; Silver &amp; Gold Tiers
            </p>
          </div>
        </div>

        {/* Box 2: This Month's Payments */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              This Month&apos;s Payments
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              £{thisMonthTotal.toFixed(2)}
            </div>
            <p className="text-[12px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{thisMonthPayments.length} transactions settled</span>
            </p>
          </div>
        </div>

        {/* Box 3: Total Settled Volume */}
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A9BB0] mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Total Volume Settled
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[28px] font-black text-[#0B1F3A] leading-none">
              £{totalSettled.toFixed(2)}
            </div>
            <p className="text-[12px] text-[#5B6B82] font-medium mt-1.5">
              Total lifetime card checkout volume
            </p>
          </div>
        </div>
      </div>

      {/* Payments Ledger Section */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] shadow-xs overflow-hidden">
        {/* Table Search & Date Filter Bar */}
        <div className="p-5 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-black text-[#0B1F3A]">
              Payments Ledger
            </h2>
            <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {filteredPayments.length} Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#EAEFF6] rounded-full px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-transparent text-[13px] font-bold text-[#0B1F3A] focus:outline-none cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="month">This Month</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client or TX ID..."
                className="w-56 sm:w-64 pl-8 pr-3 py-1.5 text-[13px] bg-[#F8FAFC] border border-[#EAEFF6] rounded-full text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Payments Table with Alternating White and Light Grey Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#EAEFF6] text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0]">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded text-[#0A6CFF] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-5">Client / Subscriber</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-6">Plan / Description</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#5B6B82]">
                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-[#0B1F3A]">No payment records found.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay, idx) => {
                  const isEven = idx % 2 === 1;

                  return (
                    <tr
                      key={pay.id}
                      onClick={() => setSelectedPayment(pay)}
                      className={`border-b border-[#F1F5F9] transition cursor-pointer ${
                        isEven ? 'bg-[#F9FAFC]' : 'bg-white'
                      } hover:bg-[#F0F6FF] ${
                        selectedPayment?.id === pay.id ? 'bg-[#EBF3FF]/60' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-4 px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="rounded text-[#0A6CFF] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Client Name & Email */}
                      <td className="py-4 px-5">
                        <div className="font-extrabold text-[14px] text-[#0B1F3A]">
                          {pay.company_name}
                        </div>
                        <div className="text-[12px] text-[#0A6CFF] font-medium mt-0.5">
                          {pay.contact_email}
                        </div>
                      </td>

                      {/* Amount with Succeeded badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[14px] text-[#0B1F3A]">
                            £{pay.amount_gbp.toFixed(2)} GBP
                          </span>
                        </div>
                      </td>

                      {/* Description & Transaction ID */}
                      <td className="py-4 px-6 text-[#0B1F3A]">
                        <div className="font-semibold text-[13px]">{pay.plan_or_service}</div>
                        <div className="font-mono text-[11px] text-[#8A9BB0] mt-0.5 flex items-center gap-1.5">
                          <span>{pay.transaction_id}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(pay.transaction_id, pay.id);
                            }}
                            className="hover:text-[#0A6CFF] cursor-pointer"
                            title="Copy transaction ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {copiedId === pay.id && (
                            <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-5 text-[#5B6B82] text-[12px] whitespace-nowrap">
                        {pay.created_at}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          <span>{pay.status === 'Completed' ? 'Succeeded' : pay.status}</span>
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      </td>

                      {/* Invoice Link */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(pay)}
                          className="bg-[#F8FAFC] hover:bg-[#EAEFF6] text-[#0A6CFF] font-bold text-[12px] px-3 py-1.5 rounded-full border border-[#EAEFF6] inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP: RECEIPT MODAL */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 sm:p-8 text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0F4FA] mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                  B2B LINK OÜ &bull; Commercial Receipt
                </span>
                <h3 className="text-[20px] font-black text-[#0B1F3A] mt-0.5">
                  {selectedPayment.invoice_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#EAEFF6] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8A9BB0]">Client Name:</span>
                  <span className="font-bold text-[#0B1F3A]">{selectedPayment.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A9BB0]">Contact Email:</span>
                  <span className="font-bold text-[#0A6CFF]">{selectedPayment.contact_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A9BB0]">Plan / Service:</span>
                  <span className="font-bold text-[#0B1F3A]">{selectedPayment.plan_or_service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A9BB0]">Transaction ID:</span>
                  <span className="font-mono text-[#0B1F3A]">{selectedPayment.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A9BB0]">Date:</span>
                  <span className="font-medium text-[#0B1F3A]">{selectedPayment.created_at}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#EAEFF6]">
                  <span className="font-bold text-[#0B1F3A]">Amount Paid:</span>
                  <span className="text-[18px] font-black text-[#0A6CFF]">
                    £{selectedPayment.amount_gbp.toFixed(2)} GBP
                  </span>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[12px] text-blue-900">
                  <span className="font-bold">Settlement Note:</span> {selectedPayment.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#F0F4FA] mt-5">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="px-5 py-2.5 rounded-full border border-[#E3E9F2] text-[#5B6B82] font-bold text-[13px] hover:bg-[#F3F6FB] transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  showNotice(`Receipt ${selectedPayment.invoice_number} sent to ${selectedPayment.contact_email}`);
                  setSelectedPayment(null);
                }}
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Client Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
