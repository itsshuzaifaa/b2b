'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Mail,
  Edit2,
  Trash2,
  ExternalLink,
  X,
  CheckCircle2,
  ChevronDown,
  Building2,
  User,
  Phone,
  Clock,
  Calendar,
  Plus,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';

export type QuoteStatusType = 'Sent' | 'Viewed' | 'Accepted' | 'Declined' | 'Expired' | 'Unlocked';

export interface SentQuoteItem {
  id: string;
  product: string;
  category?: string;
  buyer: string;
  buyerContact?: string;
  buyerEmail: string;
  buyerPhone?: string;
  yourPrice: number;
  quantity: number;
  sentDate: string;
  neededBy?: string;
  leadTimeDays?: number;
  notes?: string;
  requestTargetPrice?: number;
  requestTargetQuantity?: number;
  requestBarcode?: string;
  requestNotes?: string;
  status: QuoteStatusType;
}

const INITIAL_QUOTES: SentQuoteItem[] = [];

export default function DashboardQuotesPage() {
  const { company } = useAuth();
  const storageKey = company?.id ? `b2b_sent_quotes_${company.id}` : 'b2b_sent_quotes_v2';
  const [quotes, setQuotes] = useState<SentQuoteItem[]>(INITIAL_QUOTES);

  // Modal states
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<SentQuoteItem | null>(null);
  const [editingQuote, setEditingQuote] = useState<SentQuoteItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);

  // New Quote Form
  const [newProduct, setNewProduct] = useState('');
  const [newBuyer, setNewBuyer] = useState('');
  const [newBuyerEmail, setNewBuyerEmail] = useState('');
  const [newPrice, setNewPrice] = useState('100.00');
  const [newQty, setNewQty] = useState('50');
  const [newNotes, setNewNotes] = useState('');

  // Load from localStorage
  useEffect(() => {
    const loadQuotes = () => {
      try {
        localStorage.removeItem('b2b_sent_quotes_v1');
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setQuotes(parsed);
            return;
          }
        }
        setQuotes([]);
      } catch {
        setQuotes([]);
      }
    };

    loadQuotes();
    window.addEventListener('b2b_quotes_updated', loadQuotes);
    window.addEventListener('storage', loadQuotes);

    return () => {
      window.removeEventListener('b2b_quotes_updated', loadQuotes);
      window.removeEventListener('storage', loadQuotes);
    };
  }, [storageKey]);

  const saveQuotes = (newQuotes: SentQuoteItem[]) => {
    setQuotes(newQuotes);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newQuotes));
    } catch {
      // ignore
    }
  };

  // 1. Manually adjust status
  const handleStatusChange = (id: string, newStatus: QuoteStatusType) => {
    const updated = quotes.map((q) => (q.id === id ? { ...q, status: newStatus } : q));
    saveQuotes(updated);
  };

  // 2. Delete quote
  const handleDelete = (id: string) => {
    const updated = quotes.filter((q) => q.id !== id);
    saveQuotes(updated);
    setDeleteConfirmId(null);
  };

  // 3. Save edited quote
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote) return;

    const updated = quotes.map((q) => (q.id === editingQuote.id ? editingQuote : q));
    saveQuotes(updated);
    setEditingQuote(null);
  };

  // 4. Create new quote record
  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct || !newBuyer || !newBuyerEmail) return;

    const newQuote: SentQuoteItem = {
      id: `sq-${Date.now()}`,
      product: newProduct,
      category: 'General Wholesale',
      buyer: newBuyer,
      buyerContact: newBuyer,
      buyerEmail: newBuyerEmail,
      yourPrice: parseFloat(newPrice) || 0,
      quantity: parseInt(newQty, 10) || 1,
      sentDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      notes: newNotes,
      status: 'Sent',
    };

    saveQuotes([newQuote, ...quotes]);
    setShowAddQuoteModal(false);
    setNewProduct('');
    setNewBuyer('');
    setNewBuyerEmail('');
    setNewNotes('');
  };

  const getStatusBadgeStyle = (status: QuoteStatusType) => {
    switch (status) {
      case 'Unlocked':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Viewed':
        return 'bg-[#EBF3FF] text-[#0A6CFF] border-[#D0E2FF]';
      case 'Accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Sent':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Declined':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Expired':
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Quotes
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Quotes are sent directly via email. Adjust statuses, edit terms, or review original request details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#EBF3FF] text-[#0A6CFF] text-[12px] font-bold px-3.5 py-1.5 rounded-full">
            {quotes.length} quotes recorded
          </div>
          <button
            type="button"
            onClick={() => setShowAddQuoteModal(true)}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Sent Quote</span>
          </button>
        </div>
      </div>

      {/* Sent Quotes Table Card */}
      <div className="mt-8 bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">
            Sent Quotes &amp; Correspondence
          </h2>
          <span className="text-[12px] text-[#8A9BB0]">
            Click status to change manually
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="p-12 text-center text-[#5B6B82]">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-[15px] font-semibold text-[#0B1F3A]">No sent quotes yet</p>
            <p className="text-[13px] mt-1">Visit Buyer Requests in WTB to review procurement tenders and quote buyers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-t border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                  <th className="py-3.5 px-6">PRODUCT</th>
                  <th className="py-3.5 px-6">BUYER</th>
                  <th className="py-3.5 px-6">YOUR PRICE</th>
                  <th className="py-3.5 px-6">QUANTITY</th>
                  <th className="py-3.5 px-6">SENT</th>
                  <th className="py-3.5 px-6">STATUS (MANUAL)</th>
                  <th className="py-3.5 px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
                {quotes.map((sq) => (
                  <tr key={sq.id} className="hover:bg-[#F8FAFC]/70 transition group">
                    {/* Product Column with Request Details Popup Trigger */}
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => setSelectedRequestDetails(sq)}
                        className="font-bold text-[#0B1F3A] hover:text-[#0A6CFF] text-left transition flex items-center gap-1.5 cursor-pointer"
                        title="Click to view full WTB request details & buyer email"
                      >
                        <span>{sq.product}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#0A6CFF] opacity-0 group-hover:opacity-100 transition shrink-0" />
                      </button>
                      {sq.category && (
                        <div className="text-[11px] text-[#8A9BB0] mt-0.5">{sq.category}</div>
                      )}
                    </td>

                    {/* Buyer Column */}
                    <td className="py-4 px-6 text-[#5B6B82] font-medium">
                      <div>{sq.buyer}</div>
                      <div className="text-[11px] text-[#8A9BB0]">{sq.buyerEmail}</div>
                    </td>

                    {/* Your Price */}
                    <td className="py-4 px-6 font-bold text-[#0B1F3A]">
                      €{sq.yourPrice.toFixed(2)}
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-6 text-[#5B6B82] font-medium">
                      {sq.quantity.toLocaleString()} u
                    </td>

                    {/* Sent Date */}
                    <td className="py-4 px-6 text-[#5B6B82] font-medium whitespace-nowrap">
                      {sq.sentDate}
                    </td>

                    {/* Status with Manual Selector */}
                    <td className="py-4 px-6">
                      <div className="relative inline-block">
                        <select
                          value={sq.status}
                          onChange={(e) => handleStatusChange(sq.id, e.target.value as QuoteStatusType)}
                          className={`appearance-none text-[11px] font-bold px-3 py-1 pr-6 rounded-full border focus:outline-none transition cursor-pointer ${getStatusBadgeStyle(
                            sq.status
                          )}`}
                        >
                          <option value="Sent">Sent</option>
                          <option value="Unlocked">Unlocked</option>
                          <option value="Viewed">Viewed</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Declined">Declined</option>
                          <option value="Expired">Expired</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingQuote({ ...sq })}
                          title="Edit this quote"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A6CFF] hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(sq.id)}
                          title="Delete this quote"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP: COMPLETE DETAILS OF THE REQUEST THEY SENT A QUOTE FOR */}
      {selectedRequestDetails && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-xl w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                  WTB Procurement Request Details
                </span>
                <h3 className="text-[18px] font-extrabold text-[#0B1F3A] mt-0.5">
                  {selectedRequestDetails.product}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestDetails(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="py-5 space-y-4">
              {/* Buyer Company & Contact Profile */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] space-y-2">
                <div className="flex items-center gap-2 text-[14px] font-bold text-[#0B1F3A]">
                  <Building2 className="w-4 h-4 text-[#0A6CFF]" />
                  <span>Buyer: {selectedRequestDetails.buyer}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                  <User className="w-4 h-4 text-[#8A9BB0]" />
                  <span>Representative: {selectedRequestDetails.buyerContact}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                  <Mail className="w-4 h-4 text-[#8A9BB0]" />
                  <span>Corporate Email: </span>
                  <a
                    href={`mailto:${selectedRequestDetails.buyerEmail}`}
                    className="text-[#0A6CFF] hover:underline font-semibold"
                  >
                    {selectedRequestDetails.buyerEmail}
                  </a>
                </div>
                {selectedRequestDetails.buyerPhone && (
                  <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
                    <Phone className="w-4 h-4 text-[#8A9BB0]" />
                    <span>Direct Phone / WhatsApp: {selectedRequestDetails.buyerPhone}</span>
                  </div>
                )}
              </div>

              {/* Target Parameters */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white border border-[#EAEFF6]">
                <div>
                  <span className="text-[11px] font-bold text-[#8A9BB0] uppercase">Target Price</span>
                  <p className="text-[16px] font-extrabold text-[#0B1F3A]">
                    €{selectedRequestDetails.requestTargetPrice?.toFixed(2) || selectedRequestDetails.yourPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#8A9BB0] uppercase">Target Qty</span>
                  <p className="text-[16px] font-extrabold text-[#0B1F3A]">
                    {(selectedRequestDetails.requestTargetQuantity || selectedRequestDetails.quantity).toLocaleString()} u
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#8A9BB0] uppercase">Needed By</span>
                  <p className="text-[14px] font-bold text-[#0A6CFF] mt-0.5">
                    {selectedRequestDetails.neededBy || 'Immediate'}
                  </p>
                </div>
              </div>

              {/* Request Notes */}
              <div>
                <span className="text-[11px] font-bold uppercase text-[#8A9BB0] tracking-wider block mb-1">
                  Buyer Specifications &amp; Delivery Instructions
                </span>
                <p className="text-[13px] text-[#41536D] p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] leading-relaxed">
                  {selectedRequestDetails.requestNotes || selectedRequestDetails.notes || 'Global verified inventory requested.'}
                </p>
              </div>

              {/* Sent Quote Record */}
              <div className="pt-2 border-t border-[#F1F5F9]">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#8A9BB0] font-semibold">Your Quote Bid:</span>
                  <span className="font-extrabold text-[#0B1F3A]">
                    €{selectedRequestDetails.yourPrice.toFixed(2)} / unit · {selectedRequestDetails.quantity.toLocaleString()} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] mt-1">
                  <span className="text-[#8A9BB0] font-semibold">Current Quote Status:</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(selectedRequestDetails.status)}`}>
                    {selectedRequestDetails.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex gap-3">
              <a
                href={`mailto:${selectedRequestDetails.buyerEmail}?subject=Wholesale Quotation: ${encodeURIComponent(
                  selectedRequestDetails.product
                )}&body=Hello ${encodeURIComponent(
                  selectedRequestDetails.buyerContact || selectedRequestDetails.buyer || 'Buyer'
                )},%0D%0A%0D%0ARegarding your procurement request for ${encodeURIComponent(
                  selectedRequestDetails.product
                )}, Nordic Electro Wholesale Ltd is pleased to quote:%0D%0A%0D%0AUnit Price: €${selectedRequestDetails.yourPrice.toFixed(
                  2
                )}%0D%0AQuantity Offered: ${selectedRequestDetails.quantity} units%0D%0ALead Time: ${
                  selectedRequestDetails.leadTimeDays || 3
                } working days%0D%0ANotes: ${encodeURIComponent(selectedRequestDetails.notes || '')}%0D%0A%0D%0ABest regards,%0D%0ALars Lindqvist%0D%0ANordic Electro Wholesale Ltd`}
                className="flex-1 py-3 px-5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Mail className="w-4 h-4" />
                <span>Send Direct Email to Buyer</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedRequestDetails(null)}
                className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: EDIT PREVIOUSLY SENT QUOTE */}
      {editingQuote && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <h3 className="text-[16px] font-bold text-[#0B1F3A]">Edit Quote Terms</h3>
              <button
                type="button"
                onClick={() => setEditingQuote(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Product / Tender
                </label>
                <input
                  type="text"
                  disabled
                  value={editingQuote.product}
                  className="w-full px-3.5 py-2.5 text-[14px] bg-[#F8FAFC] border border-[#EAEFF6] rounded-xl text-[#0B1F3A] font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Your Price (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingQuote.yourPrice}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, yourPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Quantity Offered
                  </label>
                  <input
                    type="number"
                    required
                    value={editingQuote.quantity}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, quantity: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Status
                </label>
                <select
                  value={editingQuote.status}
                  onChange={(e) =>
                    setEditingQuote({ ...editingQuote, status: e.target.value as QuoteStatusType })
                  }
                  className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-semibold"
                >
                  <option value="Sent">Sent</option>
                  <option value="Viewed">Viewed</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Declined">Declined</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Quote Terms / Notes
                </label>
                <textarea
                  rows={3}
                  value={editingQuote.notes || ''}
                  onChange={(e) => setEditingQuote({ ...editingQuote, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] transition cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQuote(null)}
                  className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: DELETE CONFIRMATION */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-sm w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-[17px] font-bold text-[#0B1F3A]">Delete Quote Record?</h3>
            <p className="text-[13px] text-[#5B6B82] mt-1 mb-6">
              This will remove this quotation from your tracking list. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[14px] transition cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="py-2.5 px-5 rounded-full bg-[#F3F6FB] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: RECORD NEW SENT QUOTE */}
      {showAddQuoteModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <h3 className="text-[16px] font-bold text-[#0B1F3A]">Record Sent Quote</h3>
              <button
                type="button"
                onClick={() => setShowAddQuoteModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Product / Tender Name
                </label>
                <input
                  type="text"
                  required
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5 Headphones"
                  className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Buyer Company
                  </label>
                  <input
                    type="text"
                    required
                    value={newBuyer}
                    onChange={(e) => setNewBuyer(e.target.value)}
                    placeholder="e.g. Apex Retail UK"
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Buyer Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newBuyerEmail}
                    onChange={(e) => setNewBuyerEmail(e.target.value)}
                    placeholder="buyer@apexretail.co.uk"
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Price Quoted (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Units Quoted
                  </label>
                  <input
                    type="number"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[14px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Terms / Notes
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Sent via email on 12 Oct with proforma invoice."
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] transition cursor-pointer shadow-xs"
                >
                  Record Quote
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddQuoteModal(false)}
                  className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
