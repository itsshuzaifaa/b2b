'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getAdminPayments,
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
} from 'lucide-react';

export default function SiteAdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'events'>('overview');
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    setPayments(getAdminPayments());
  };

  useEffect(() => {
    loadData();
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

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.company_name.toLowerCase().includes(q) ||
        p.plan_or_service.toLowerCase().includes(q) ||
        p.transaction_id.toLowerCase().includes(q) ||
        p.contact_email.toLowerCase().includes(q)
      );
    });
  }, [payments, searchQuery]);

  // Primary customer / subscriber metrics (Stripe Customer View from Image 1)
  const primarySellerPayment = payments[0] || {
    company_name: 'fluxify digital',
    contact_email: 'huzaifaff559@gmail.com',
    amount_gbp: 79.0,
    created_at: 'Oct 15, 11:14 AM',
    transaction_id: 'ch_3Nx8294019284',
    invoice_number: 'in_1Nx8294019284',
  };

  const totalSpent = payments.reduce((acc, p) => acc + (p.status === 'Completed' ? p.amount_gbp : 0), 0);
  const mrr = 79.0;

  return (
    <div className="relative min-h-full">
      {/* Top Customer Header (Exact match to Stripe Dashboard screenshot) */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#EAEFF6]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] sm:text-[34px] font-black text-[#0B1F3A] tracking-tight leading-none">
              {primarySellerPayment.company_name}
            </h1>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Live Customer
            </span>
          </div>
          <p className="text-[15px] text-[#5B6B82] mt-1.5 font-medium">
            {primarySellerPayment.contact_email}
          </p>

          {/* Metric Stats Row: Spent, Since, MRR */}
          <div className="flex items-center gap-8 sm:gap-10 mt-5">
            <div>
              <span className="text-[12px] font-medium text-[#8A9BB0] block">Spent</span>
              <span className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A]">
                £{totalSpent.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[12px] font-medium text-[#8A9BB0] block">Since</span>
              <span className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A]">
                Aug 2026
              </span>
            </div>
            <div>
              <span className="text-[12px] font-medium text-[#8A9BB0] block flex items-center gap-1">
                <span>MRR</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </span>
              <span className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A]">
                £{mrr.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions Dropdown */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showNotice('Customer statement exported.')}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <span>Actions</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub Tabs: Overview & Events and logs */}
      <div className="flex items-center gap-6 border-b border-[#EAEFF6] mt-4">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-[14px] font-bold transition relative cursor-pointer ${
            activeTab === 'overview'
              ? 'text-[#0A6CFF] border-b-2 border-[#0A6CFF]'
              : 'text-[#5B6B82] hover:text-[#0B1F3A]'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-[14px] font-bold transition relative cursor-pointer ${
            activeTab === 'events'
              ? 'text-[#0A6CFF] border-b-2 border-[#0A6CFF]'
              : 'text-[#5B6B82] hover:text-[#0B1F3A]'
          }`}
        >
          Events and logs
        </button>
      </div>

      {feedback && (
        <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'overview' ? (
        <div className="mt-8 space-y-8">
          {/* Subscriptions Card (Matching Stripe Image 1) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">
                Subscriptions
              </h2>
              <button
                type="button"
                onClick={() => showNotice('Subscription configuration is locked to card plan.')}
                className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
              >
                Create
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAEFF6] p-4 sm:p-5 shadow-[0_2px_12px_rgba(11,31,58,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[15px] text-[#0B1F3A]">
                      Silver Commercial Plan
                    </span>
                    <span className="bg-emerald-100/80 text-emerald-800 text-[11px] font-extrabold px-2 py-0.5 rounded-md">
                      Active
                    </span>
                  </div>
                  <p className="text-[13px] text-[#5B6B82] mt-0.5">
                    Billing monthly • Next invoice on Nov 15 for £79.00
                  </p>
                </div>
              </div>

              {/* Action Icons on the right */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Edit subscription"
                  onClick={() => showNotice('Editing subscription terms.')}
                  className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Cancel subscription"
                  onClick={() => showNotice('Cancel dialog opened.')}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="More actions"
                  className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Payments Section (Exact match to Stripe Image 1 table) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">
                Payments
              </h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search payments..."
                    className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-[13px] bg-slate-50 border border-[#EAEFF6] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                >
                  View all
                </button>
                <button
                  type="button"
                  onClick={() => showNotice('Manual charge dialog opened.')}
                  className="text-[13px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                >
                  Create
                </button>
              </div>
            </div>

            {/* Payments Ledger Table */}
            <div className="bg-white rounded-2xl border border-[#EAEFF6] shadow-[0_2px_12px_rgba(11,31,58,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0]">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          className="rounded text-[#0A6CFF] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">AMOUNT</th>
                      <th className="py-3 px-6">DESCRIPTION</th>
                      <th className="py-3 px-6">DATE</th>
                      <th className="py-3 px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#5B6B82]">
                          No payments found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((pay) => (
                        <tr
                          key={pay.id}
                          onClick={() => setSelectedPayment(pay)}
                          className={`hover:bg-[#F8FAFC] transition cursor-pointer group ${
                            selectedPayment?.id === pay.id ? 'bg-[#EBF3FF]/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td
                            className="py-3.5 px-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="rounded text-[#0A6CFF] focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Amount with green Succeeded badge (Exact match to Stripe) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <span className="font-extrabold text-[14px] text-[#0B1F3A]">
                                £{pay.amount_gbp.toFixed(2)} GBP
                              </span>
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                <span>Succeeded</span>
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            </div>
                          </td>

                          {/* Description */}
                          <td className="py-3.5 px-6 text-[#0B1F3A] font-medium">
                            <span>{pay.plan_or_service}</span>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-6 text-[#5B6B82] text-[13px] whitespace-nowrap">
                            <span>{pay.created_at}</span>
                          </td>

                          {/* Menu ... */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(pay)}
                              className="p-1 rounded-md text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Events & Logs Tab */
        <div className="mt-8 bg-white rounded-2xl border border-[#EAEFF6] p-6 shadow-xs">
          <h3 className="text-[16px] font-bold text-[#0B1F3A] mb-4">
            Stripe Webhook &amp; Gateway Audit Log
          </h3>
          <div className="space-y-4">
            {[
              { event: 'charge.succeeded', id: 'ch_3Nx8294019284', date: 'Oct 15, 11:14 AM', desc: 'Charge succeeded for £79.00 GBP on Visa ending in 4242' },
              { event: 'invoice.finalized', id: 'in_1Nx8294019284', date: 'Oct 15, 11:14 AM', desc: 'Invoice in_1Nx8294019284 finalized for fluxify digital' },
              { event: 'customer.subscription.created', id: 'sub_89210', date: 'Oct 15, 11:14 AM', desc: 'Subscription for Silver Commercial Plan activated' },
            ].map((ev, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-[#EAEFF6] flex items-center justify-between text-[13px]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0A6CFF]">{ev.event}</span>
                    <span className="font-mono text-[11px] text-[#8A9BB0]">{ev.id}</span>
                  </div>
                  <p className="text-[#5B6B82] mt-0.5">{ev.desc}</p>
                </div>
                <span className="text-[12px] text-[#8A9BB0] whitespace-nowrap">{ev.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIDE DRAWER (Opens on the RIGHT as requested by user)     */}
      {/* ========================================================= */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#0B1F3A]/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setSelectedPayment(null)}
          />

          {/* Drawer Panel Sliding from Right */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-[#EAEFF6] flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div>
              <div className="p-6 border-b border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                    Payment Details
                  </span>
                  <h3 className="text-[18px] font-extrabold text-[#0B1F3A] mt-0.5">
                    {selectedPayment.transaction_id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-[13px]">
                {/* Big Amount Card */}
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Amount</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[26px] font-black text-[#0B1F3A]">
                      £{selectedPayment.amount_gbp.toFixed(2)} GBP
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2.5 py-1 rounded-md">
                      <span>Succeeded</span>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#5B6B82] flex items-center justify-between pt-2 border-t border-[#EAEFF6]">
                    <span>0% Platform Processing Fee:</span>
                    <span className="font-bold text-[#0B1F3A]">£0.00</span>
                  </div>
                  <div className="text-[11px] text-[#5B6B82] flex items-center justify-between mt-1">
                    <span>Net Credited Volume:</span>
                    <span className="font-bold text-emerald-600">£{selectedPayment.amount_gbp.toFixed(2)} GBP</span>
                  </div>
                </div>

                {/* Account Details (Matching Stripe sidebar) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0]">
                      Account details
                    </span>
                    <span className="text-[11px] font-bold text-[#0A6CFF] cursor-pointer hover:underline">
                      Edit
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[#EAEFF6] space-y-2">
                    {/* Customer ID Pill */}
                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Customer ID:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('cus_HwySSSrWEuVeTp', 'cus')}
                        className="font-mono text-[11px] bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] px-2 py-0.5 rounded flex items-center gap-1 transition"
                      >
                        <span>cus_HwySSSrWEuVeTp</span>
                        <Copy className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Company Name:</span>
                      <strong className="text-[#0B1F3A]">{selectedPayment.company_name}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Customer Email:</span>
                      <span className="text-[#0A6CFF] font-medium">{selectedPayment.contact_email}</span>
                    </div>
                  </div>
                </div>

                {/* Billing Emails */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0] block mb-2">
                    Billing emails
                  </span>
                  <div className="p-3 rounded-xl border border-[#EAEFF6] text-[#0B1F3A] font-medium">
                    {selectedPayment.contact_email}
                  </div>
                </div>

                {/* Payment Method Details */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0] block mb-2">
                    Payment Method
                  </span>
                  <div className="p-3.5 rounded-xl border border-[#EAEFF6] flex items-center gap-3">
                    <div className="w-9 h-6 bg-slate-800 text-white font-black text-[10px] rounded flex items-center justify-center">
                      VISA
                    </div>
                    <div>
                      <div className="font-bold text-[#0B1F3A]">Visa ending in 4242</div>
                      <div className="text-[11px] text-[#8A9BB0]">Expires 12/28 • Cardholder: Habib Rehman</div>
                    </div>
                  </div>
                </div>

                {/* Metadata & Audit */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0] block mb-2">
                    Metadata &amp; Invoicing
                  </span>
                  <div className="p-3.5 rounded-xl border border-[#EAEFF6] space-y-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Invoice Number:</span>
                      <span className="font-mono font-bold text-[#0A6CFF]">{selectedPayment.invoice_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Payment Reference:</span>
                      <span className="font-mono text-[#0B1F3A]">{selectedPayment.wise_reference}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8A9BB0]">Cleared Date:</span>
                      <span className="text-[#0B1F3A] font-medium">{selectedPayment.created_at}</span>
                    </div>
                    {selectedPayment.notes && (
                      <div className="pt-2 border-t border-[#EAEFF6] text-[#5B6B82] leading-relaxed">
                        {selectedPayment.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-[#F1F5F9] bg-[#F8FAFC] flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  showNotice('Invoice receipt sent to customer.');
                  setSelectedPayment(null);
                }}
                className="w-1/2 py-2.5 rounded-full border border-[#EAEFF6] bg-white text-[#0B1F3A] font-bold text-[13px] hover:bg-slate-50 transition cursor-pointer"
              >
                Send Receipt
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="w-1/2 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[13px] hover:bg-[#0857cf] transition cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
