'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getAdminPayments,
  markPaymentCompleted,
  recordManualPayment,
  deletePayment,
  type AdminPaymentRecord,
  type PaymentStatus,
  type PaymentMethod,
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
} from 'lucide-react';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Pending Verification' | 'Failed'>('All');

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState<AdminPaymentRecord | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Payment Form
  const [newCompany, setNewCompany] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('Gold VIP Annual Membership');
  const [newAmount, setNewAmount] = useState('1490.00');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('Wise Bank Transfer');
  const [newReference, setNewReference] = useState('WISE-B2B-');
  const [newStatus, setNewStatus] = useState<PaymentStatus>('Completed');
  const [newNotes, setNewNotes] = useState('');

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

  const handleVerify = (id: string) => {
    markPaymentCompleted(id);
    showNotice('Payment verified and seller account activated.');
    loadData();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this payment transaction record?')) {
      deletePayment(id);
      showNotice('Payment record deleted.');
      loadData();
    }
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newAmount) return;

    recordManualPayment({
      company_id: `comp-${Date.now()}`,
      company_name: newCompany.trim(),
      contact_email: newEmail.trim() || 'accounting@client.eu',
      plan_or_service: newPlan,
      amount_gbp: parseFloat(newAmount) || 0,
      payment_method: newMethod,
      wise_reference: newReference.trim() || `WISE-${Date.now()}`,
      transaction_id: `TR-${Date.now()}`,
      status: newStatus,
      notes: newNotes,
    });

    setShowAddPaymentModal(false);
    showNotice(`Recorded payment for ${newCompany}`);
    setNewCompany('');
    setNewEmail('');
    setNewNotes('');
    loadData();
  };

  const completedList = payments.filter((p) => p.status === 'Completed');
  const pendingList = payments.filter((p) => p.status === 'Pending Verification');
  const totalVolumeGbp = completedList.reduce((acc, p) => acc + p.amount_gbp, 0);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.company_name.toLowerCase().includes(q) ||
        p.transaction_id.toLowerCase().includes(q) ||
        p.wise_reference.toLowerCase().includes(q) ||
        p.invoice_number.toLowerCase().includes(q) ||
        p.contact_email.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;

      return true;
    });
  }, [payments, searchQuery, statusFilter]);

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Client Payment Records
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Financial ledger of client membership completions, Wise bank transfers, and VAT invoice references.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddPaymentModal(true)}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Manual Payment</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6]">
          <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">
            Total Completed Fees
          </span>
          <div className="text-[26px] font-black text-[#0B1F3A] mt-1 leading-none">
            €{totalVolumeGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[12px] text-[#5B6B82] mt-1.5">
            {completedList.length} verified transactions
          </p>
        </div>

        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6]">
          <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">
            Wise Direct Transfers Cleared
          </span>
          <div className="text-[26px] font-black text-emerald-600 mt-1 leading-none">
            {completedList.filter((p) => p.payment_method === 'Wise Bank Transfer').length} Cleared
          </div>
          <p className="text-[12px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Direct to B2B LINK Wise account</span>
          </p>
        </div>

        <div className="p-5 rounded-[24px] bg-[#F8FAFC] border border-[#EAEFF6]">
          <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">
            Pending Verification
          </span>
          <div className="text-[26px] font-black text-amber-600 mt-1 leading-none">
            {pendingList.length} Pending
          </div>
          <p className="text-[12px] text-[#5B6B82] mt-1.5">
            Awaiting manual balance match
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="mt-7 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Completed', 'Pending Verification', 'Failed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, Wise reference code, or invoice..."
            className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Payments Ledger Table */}
      <div className="mt-6 bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                <th className="py-4 px-6">TRANSACTION &amp; DATE</th>
                <th className="py-4 px-6">CLIENT COMPANY</th>
                <th className="py-4 px-6">PLAN / SERVICE</th>
                <th className="py-4 px-6">METHOD &amp; REFERENCE</th>
                <th className="py-4 px-6">AMOUNT</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5B6B82]">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-[15px] text-[#0B1F3A]">No payment records found</p>
                    <p className="text-[12px] mt-1">Try adjusting search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const isCompleted = pay.status === 'Completed';
                  const isPending = pay.status === 'Pending Verification';

                  return (
                    <tr key={pay.id} className="hover:bg-[#F8FAFC]/70 transition group">
                      {/* Transaction & Date */}
                      <td className="py-4 px-6">
                        <div className="font-mono font-bold text-[#0B1F3A] text-[13px]">
                          {pay.transaction_id}
                        </div>
                        <div className="text-[12px] text-[#8A9BB0] mt-0.5">{pay.created_at}</div>
                      </td>

                      {/* Client */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-[#0B1F3A]">{pay.company_name}</div>
                        <div className="text-[11px] text-[#0A6CFF] font-mono mt-0.5">
                          {pay.invoice_number}
                        </div>
                      </td>

                      {/* Plan / Service */}
                      <td className="py-4 px-6 text-[#5B6B82] max-w-xs">
                        <span className="line-clamp-1 text-[13px] font-medium">{pay.plan_or_service}</span>
                      </td>

                      {/* Method & Reference */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-[#0B1F3A] text-[13px]">
                          {pay.payment_method}
                        </div>
                        <div className="font-mono text-[11px] text-[#0A6CFF] bg-[#EBF3FF] px-2 py-0.5 rounded inline-block mt-0.5">
                          {pay.wise_reference}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6 font-black text-[#0B1F3A] text-[15px]">
                        €{pay.amount_gbp.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{pay.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleVerify(pay.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-full transition shadow-2xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Verify Wise</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(pay)}
                            title="View official receipt"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A6CFF] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(pay.id)}
                            title="Delete transaction record"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT / DETAILS MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                    Payment Confirmation Receipt
                  </span>
                  <h3 className="text-[17px] font-extrabold text-[#0B1F3A]">
                    {selectedReceipt.invoice_number}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-[13px]">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Amount Settled</span>
                  <div className="text-[24px] font-black text-[#0B1F3A] mt-0.5">
                    €{selectedReceipt.amount_gbp.toFixed(2)} EUR
                  </div>
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedReceipt.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="p-3 rounded-xl border border-[#EAEFF6]">
                  <span className="text-[#8A9BB0] block font-semibold">Client Company</span>
                  <strong className="text-[#0B1F3A] mt-0.5 block">{selectedReceipt.company_name}</strong>
                </div>
                <div className="p-3 rounded-xl border border-[#EAEFF6]">
                  <span className="text-[#8A9BB0] block font-semibold">Payment Method</span>
                  <strong className="text-[#0B1F3A] mt-0.5 block">{selectedReceipt.payment_method}</strong>
                </div>
                <div className="p-3 rounded-xl border border-[#EAEFF6]">
                  <span className="text-[#8A9BB0] block font-semibold">Wise Reference</span>
                  <span className="font-mono font-bold text-[#0A6CFF] mt-0.5 block">{selectedReceipt.wise_reference}</span>
                </div>
                <div className="p-3 rounded-xl border border-[#EAEFF6]">
                  <span className="text-[#8A9BB0] block font-semibold">Completed Timestamp</span>
                  <span className="text-[#5B6B82] mt-0.5 block">{selectedReceipt.completed_at || selectedReceipt.created_at}</span>
                </div>
              </div>

              {selectedReceipt.notes && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-[#5B6B82]">
                  <strong className="text-[#0B1F3A] block mb-0.5">Audit Notes:</strong>
                  {selectedReceipt.notes}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[13px] hover:bg-[#0857cf] transition cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD MANUAL PAYMENT MODAL */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <h3 className="text-[17px] font-bold text-[#0B1F3A]">
                Record Client Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPaymentModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                  Client Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="E.g., Nordic Electro Wholesale Ltd"
                  className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                    Amount (€ EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  >
                    <option value="Wise Bank Transfer">Wise Bank Transfer</option>
                    <option value="SEPA Wire">SEPA Wire</option>
                    <option value="Corporate Card">Corporate Card</option>
                    <option value="Free Activation">Free Activation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                    Wise Reference Code
                  </label>
                  <input
                    type="text"
                    value={newReference}
                    onChange={(e) => setNewReference(e.target.value)}
                    placeholder="WISE-B2B-1234"
                    className="w-full px-3.5 py-2.5 text-[14px] font-mono border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  >
                    <option value="Completed">Completed (Auto-activate)</option>
                    <option value="Pending Verification">Pending Verification</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1.5">
                  Plan Description / Tier
                </label>
                <input
                  type="text"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-6 py-2.5 rounded-full shadow-xs cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
