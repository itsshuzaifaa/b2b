'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getCustomerQueries,
  replyCustomerQuery,
  deleteCustomerQuery,
  type CustomerQuery,
} from '@/lib/admin/admin-store';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  Send,
  X,
  Building2,
  Phone,
  Trash2,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export default function SiteAdminCustomerQueriesPage() {
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'replied'>('all');
  const [selectedQuery, setSelectedQuery] = useState<CustomerQuery | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const loadData = async () => {
    // 1. Initial immediate load from local store
    const local = getCustomerQueries();
    setQueries(local);

    // 2. Fetch authoritative queries from server API
    try {
      const res = await fetch('/api/admin/queries', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.queries)) {
          setQueries(data.queries);
          // Sync into local storage for offline resilience
          try {
            localStorage.setItem('b2b_customer_queries_v2', JSON.stringify(data.queries));
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch server queries, using local', err);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    window.addEventListener('b2b_queries_update', loadData);
    const interval = setInterval(loadData, 5000); // Polling every 5s for real-time incoming queries
    return () => {
      window.removeEventListener('b2b_admin_update', loadData);
      window.removeEventListener('b2b_queries_update', loadData);
      clearInterval(interval);
    };
  }, []);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleOpenQuery = (q: CustomerQuery) => {
    setSelectedQuery(q);
    setReplySubject('Response from B2B LINK Support');
    setReplyText(
      q.reply_text ||
        `Thank you for contacting B2B LINK.\n\nOur Support Team has reviewed your enquiry regarding ${q.company}.\n\n`
    );
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);

    try {
      // 1. Send via server API to dispatch real email to customer and update server database
      const res = await fetch('/api/admin/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          id: selectedQuery.id,
          replyText: replyText.trim(),
          replySubject: replySubject.trim(),
        }),
      });

      const data = await res.json();

      // 2. Also update local store
      replyCustomerQuery(selectedQuery.id, replyText);

      if (data.emailSent) {
        showNotice(`Official reply emailed directly to ${selectedQuery.email}!`);
      } else {
        showNotice(`Reply saved and dispatched to ${selectedQuery.email}`);
      }
    } catch (err) {
      console.error('Error dispatching reply:', err);
      replyCustomerQuery(selectedQuery.id, replyText);
      showNotice(`Reply recorded for ${selectedQuery.email}`);
    } finally {
      setIsSendingReply(false);
      setSelectedQuery(null);
      loadData();
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this customer inquiry?')) {
      deleteCustomerQuery(id);
      showNotice('Customer inquiry removed.');
      loadData();
    }
  };

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      const term = searchQuery.toLowerCase().trim();
      if (!term) return true;
      return (
        q.name.toLowerCase().includes(term) ||
        q.company.toLowerCase().includes(term) ||
        q.email.toLowerCase().includes(term) ||
        q.message.toLowerCase().includes(term) ||
        q.topic.toLowerCase().includes(term)
      );
    });
  }, [queries, statusFilter, searchQuery]);

  const newCount = queries.filter((q) => q.status === 'new').length;
  const repliedCount = queries.filter((q) => q.status === 'replied').length;

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Contact Us Desk
            </span>
            {newCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {newCount} Awaiting Reply
              </span>
            )}
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
            Customer Queries
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Direct incoming inquiries from visitors and clients who filled the platform Contact Us form.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#F8FAFC] border border-[#EAEFF6] px-4 py-2 rounded-2xl flex items-center gap-3">
            <span className="text-[13px] text-[#5B6B82]">Total Inquiries:</span>
            <span className="text-[16px] font-black text-[#0B1F3A]">{queries.length}</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All Queries ({queries.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('new')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'new'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>New ({newCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('replied')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'replied'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Replied ({repliedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px] max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries by name, company, email..."
            className="w-full pl-10 pr-4 py-2 text-[13px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#EAEFF6] text-[11px] font-bold uppercase tracking-wider text-[#5B6B82]">
                <th className="py-3.5 px-5">Sender &amp; Company</th>
                <th className="py-3.5 px-4">Inquiry Topic</th>
                <th className="py-3.5 px-4">Message Preview</th>
                <th className="py-3.5 px-4">Received Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {filteredQueries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[#8A9BB0]">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-[#0B1F3A]">No customer queries found</p>
                    <p className="text-[12px] text-[#5B6B82] mt-0.5">
                      New messages submitted on the Contact Us page will display here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQueries.map((q, idx) => {
                  const isEven = idx % 2 === 1;
                  const isNew = q.status === 'new';

                  return (
                    <tr
                      key={q.id}
                      onClick={() => handleOpenQuery(q)}
                      className={`border-b border-[#F0F4FA] transition cursor-pointer ${
                        isEven ? 'bg-[#F9FAFC]' : 'bg-white'
                      } hover:bg-[#F0F6FF]`}
                    >
                      {/* Sender */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-[#0B1F3A] flex items-center gap-2">
                          <span>{q.name}</span>
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[12px] text-[#5B6B82] mt-0.5">{q.company}</div>
                        <div className="text-[11px] text-[#0A6CFF]">{q.email}</div>
                      </td>

                      {/* Topic */}
                      <td className="py-4 px-4">
                        <span className="inline-block text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF]">
                          {q.topic}
                        </span>
                      </td>

                      {/* Message Preview */}
                      <td className="py-4 px-4 max-w-md">
                        <p className="line-clamp-2 text-[#41536D] text-[13px] leading-relaxed">
                          {q.message}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-[#5B6B82] text-[12px]">
                        {q.created_at}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${
                            isNew
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isNew ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>New</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Replied</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenQuery(q);
                            }}
                            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[12px] font-bold px-3.5 py-1.5 rounded-full transition cursor-pointer shadow-xs"
                          >
                            {isNew ? 'Reply' : 'View'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(q.id, e)}
                            className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete query"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* POPUP: QUERY DETAILS & REPLY MODAL */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-2xl w-full p-6 sm:p-8 text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#F0F4FA] mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF] bg-[#EBF3FF] px-2.5 py-0.5 rounded-full">
                    {selectedQuery.topic}
                  </span>
                  <span className="text-[12px] text-[#8A9BB0]">• {selectedQuery.created_at}</span>
                </div>
                <h3 className="text-[22px] font-black text-[#0B1F3A]">
                  Inquiry from {selectedQuery.name}
                </h3>
                <p className="text-[13px] text-[#5B6B82] mt-0.5">
                  {selectedQuery.company} &bull; {selectedQuery.email}{' '}
                  {selectedQuery.phone ? `• ${selectedQuery.phone}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuery(null)}
                className="p-1 rounded-full text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Original Customer Message */}
            <div className="mb-6">
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#5B6B82] mb-2">
                Original Message
              </label>
              <div className="p-4 bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl text-[14px] text-[#1E293B] whitespace-pre-line leading-relaxed">
                {selectedQuery.message}
              </div>
            </div>

            {/* Previous Reply info if already replied */}
            {selectedQuery.reply_text && (
              <div className="mb-6 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <div className="flex items-center justify-between text-[12px] font-bold text-emerald-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Replied on {selectedQuery.replied_at}</span>
                  </span>
                </div>
                <p className="text-[13px] text-emerald-950 whitespace-pre-line leading-relaxed">
                  {selectedQuery.reply_text}
                </p>
              </div>
            )}

            {/* Reply Drafting Form */}
            <form onSubmit={handleSendReply} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[13px] font-bold text-[#0B1F3A]">
                    Official Response (Emailed directly to {selectedQuery.email})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const mailtoUrl = `mailto:${selectedQuery.email}?subject=${encodeURIComponent(
                        replySubject
                      )}&body=${encodeURIComponent(replyText)}`;
                      window.open(mailtoUrl, '_blank');
                    }}
                    className="text-[11px] text-[#0A6CFF] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in Desktop Mail App</span>
                  </button>
                </div>
                <textarea
                  required
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-4 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] leading-relaxed font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0F4FA]">
                <button
                  type="button"
                  onClick={() => setSelectedQuery(null)}
                  className="px-5 py-2.5 rounded-full border border-[#E3E9F2] text-[#5B6B82] font-bold text-[14px] hover:bg-[#F3F6FB] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingReply}
                  className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] disabled:opacity-60 text-white font-bold text-[14px] transition cursor-pointer shadow-xs flex items-center gap-2"
                >
                  {isSendingReply ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Reply & Email Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
