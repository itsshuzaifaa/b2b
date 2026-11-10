'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  MessageSquare,
  Users,
  Copy,
  Check,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Send,
  Building2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Bell,
  Zap,
} from 'lucide-react';
import type { CampaignLead } from '@/lib/campaigns/campaign-store';

export default function SiteAdminCampaignsPage() {
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer'>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'table' | 'emails' | 'whatsapp' | 'inactivity'>('table');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Autonomous Inactivity Reminders State
  const [inactivityScanning, setInactivityScanning] = useState(false);
  const [inactivityResult, setInactivityResult] = useState<any | null>(null);
  const [showInactivityEmailPreview, setShowInactivityEmailPreview] = useState(false);

  const runInactivityCheck = async (force: boolean = false) => {
    setInactivityScanning(true);
    try {
      const res = await fetch('/api/cron/inactivity-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, force }),
      });
      const data = await res.json();
      setInactivityResult(data);
      if (data.success) {
        handleCopy('', `Scan Complete! Sent: ${data.emailsSent}, Skipped: ${data.emailsSkipped}`);
      } else {
        handleCopy('', `Scan Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      handleCopy('', `Error running scan: ${err.message}`);
    } finally {
      setInactivityScanning(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.leads)) {
          setLeads(data.leads);
        }
      }
    } catch (err) {
      console.error('Failed to load campaign leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Role filter
      if (roleFilter !== 'all' && l.role !== roleFilter) return false;

      // Tier filter
      if (tierFilter !== 'all' && l.membership_tier.toLowerCase() !== tierFilter.toLowerCase()) {
        return false;
      }

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        l.email.toLowerCase().includes(q) ||
        l.whatsapp.includes(q) ||
        l.contact_name.toLowerCase().includes(q) ||
        l.company_name.toLowerCase().includes(q)
      );
    });
  }, [leads, roleFilter, tierFilter, searchQuery]);

  // Derived lists
  const filteredEmails = useMemo(() => {
    return filteredLeads.map((l) => l.email).filter(Boolean);
  }, [filteredLeads]);

  const filteredWhatsApp = useMemo(() => {
    return filteredLeads.map((l) => l.whatsapp).filter((w) => Boolean(w) && w.length >= 7);
  }, [filteredLeads]);

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedType(label);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  // Export full CSV
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Email',
      'WhatsApp Number',
      'Contact Name',
      'Company Name',
      'Role',
      'Membership Tier',
      'Country',
      'Status',
      'Created At',
    ];

    const rows = filteredLeads.map((l) => [
      `"${l.id}"`,
      `"${l.email}"`,
      `"${l.whatsapp}"`,
      `"${l.contact_name.replace(/"/g, '""')}"`,
      `"${l.company_name.replace(/"/g, '""')}"`,
      `"${l.role}"`,
      `"${l.membership_tier}"`,
      `"${l.country || 'EU'}"`,
      `"${l.status}"`,
      `"${l.created_at}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `b2b_link_campaign_leads_${roleFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export plain text list
  const handleExportTextList = (list: string[], filename: string) => {
    const content = list.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sellerCount = leads.filter((l) => l.role === 'seller').length;
  const buyerCount = leads.filter((l) => l.role === 'buyer').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {copiedType && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B1528] text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold">{copiedType}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
              Admin Exclusive
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Synced on Registration
            </span>
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-tight">
            Campaign Leads &amp; Outreach Lists
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Direct database of verified emails and WhatsApp phone numbers captured when accounts are created, reserved for admin marketing campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchLeads}
            disabled={loading}
            className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-bold px-3.5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-xs px-4 py-2.5 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="bg-white rounded-2xl p-4.5 border border-[#EAEFF6] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Campaign Contacts
            </span>
            <Users className="w-4 h-4 text-[#0A6CFF]" />
          </div>
          <div className="text-[28px] font-black text-[#0B1F3A] leading-tight">
            {leads.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            <strong className="text-emerald-700 font-bold">{sellerCount}</strong> Sellers ·{' '}
            <strong className="text-blue-700 font-bold">{buyerCount}</strong> Buyers
          </div>
        </div>

        {/* Card 2: Email List */}
        <div className="bg-white rounded-2xl p-4.5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Email Outreach List
              </span>
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-[28px] font-black text-[#0A6CFF] leading-tight">
              {filteredEmails.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active corporate inboxes
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(filteredEmails.join(', '), `Copied ${filteredEmails.length} emails to clipboard!`)}
            className="mt-3 w-full bg-[#EBF3FF] hover:bg-[#DCE9FF] text-[#0A6CFF] text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All Emails</span>
          </button>
        </div>

        {/* Card 3: WhatsApp List */}
        <div className="bg-white rounded-2xl p-4.5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                WhatsApp Broadcast List
              </span>
              <Phone className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-[28px] font-black text-emerald-600 leading-tight">
              {filteredWhatsApp.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              International formatted numbers
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(filteredWhatsApp.join(', '), `Copied ${filteredWhatsApp.length} WhatsApp numbers!`)}
            className="mt-3 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All WhatsApp</span>
          </button>
        </div>

        {/* Card 4: Broadcast Quick Tool */}
        <div className="bg-gradient-to-br from-[#0B1528] to-[#12223F] rounded-2xl p-4.5 text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[#00E5FF] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Broadcast Hub</span>
            </div>
            <div className="text-sm font-bold leading-snug">
              Launch Campaign Blast
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Send announcements straight to sellers or export numbers into bulk WhatsApp platforms.
            </p>
          </div>
          <Link
            href="/site-admin/messages"
            className="mt-3 w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 text-center"
          >
            <Send className="w-3 h-3 text-[#00E5FF]" />
            <span>Open In-App Desk</span>
          </Link>
        </div>
      </div>

      {/* Tabs and Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        {/* View Tabs */}
        <div className="flex items-center gap-2 bg-[#F1F5F9] p-1 rounded-full w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer ${
              activeTab === 'table'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lead Directory ({filteredLeads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'emails'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3 h-3 text-blue-600" />
            <span>Email Blast View</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'whatsapp'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-3 h-3 text-emerald-600" />
            <span>WhatsApp Numbers View</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inactivity')}
            className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inactivity'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Inactivity Reminders</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase">
              Auto
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF] font-medium"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-0.5 text-xs">
            {(['all', 'seller', 'buyer'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-full font-bold capitalize transition cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#0B1528] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'all' ? 'All Roles' : `${r}s`}
              </button>
            ))}
          </div>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full focus:outline-none cursor-pointer"
          >
            <option value="all">All Tiers</option>
            <option value="gold">Gold Tiers</option>
            <option value="silver">Silver Tiers</option>
            <option value="bronze">Bronze Tiers</option>
          </select>
        </div>
      </div>

      {/* TAB 1: ALL LEADS TABLE */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-2xl border border-[#EAEFF6] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Contact / Enterprise</th>
                  <th className="py-3 px-4">Role &amp; Tier</th>
                  <th className="py-3 px-4">Corporate Email</th>
                  <th className="py-3 px-4">WhatsApp Number</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No campaign leads matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const isSeller = lead.role === 'seller';
                    const cleanPhone = lead.whatsapp.replace(/[^\d]/g, '');

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                        {/* Name & Company */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{lead.contact_name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {lead.company_name}
                          </div>
                        </td>

                        {/* Role & Tier */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                isSeller
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {lead.role}
                            </span>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {lead.membership_tier}
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`mailto:${lead.email}`}
                              className="font-medium text-blue-600 hover:underline truncate max-w-[190px]"
                            >
                              {lead.email}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(lead.email, `Copied email: ${lead.email}`)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* WhatsApp */}
                        <td className="py-3.5 px-4">
                          {lead.whatsapp ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-800 font-semibold">
                                {lead.whatsapp}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(lead.whatsapp, `Copied WhatsApp: ${lead.whatsapp}`)
                                }
                                className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                                title="Copy number"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                                title="Chat on WhatsApp"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not provided</span>
                          )}
                        </td>

                        {/* Country */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {lead.country || 'Global'}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]" suppressHydrationWarning>
                          {lead.created_at ? lead.created_at.slice(0, 10) : ''}
                        </td>

                        {/* Direct Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={`mailto:${lead.email}?subject=B2B%20LINK%20Wholesale%20Campaign`}
                              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-full transition"
                            >
                              Email
                            </a>
                            {lead.whatsapp && (
                              <a
                                href={`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                                  lead.contact_name
                                )},%20this%20is%20Jeff%20from%20B2B%20LINK.`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-full transition"
                              >
                                WhatsApp
                              </a>
                            )}
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
      )}

      {/* TAB 2: QUICK EMAIL BLAST VIEW */}
      {activeTab === 'emails' && (
        <div className="bg-white rounded-2xl border border-[#EAEFF6] p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Formatted Email Outreach List ({filteredEmails.length} recipients)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comma-separated list ready to paste directly into your email service provider (Resend, Mailchimp, SendGrid, Gmail BCC).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(filteredEmails.join(', '), `Copied ${filteredEmails.length} emails to clipboard!`)}
                className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-xs font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All ({filteredEmails.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportTextList(filteredEmails, `b2b_link_emails_${roleFilter}.txt`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-full transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={8}
            value={filteredEmails.join(', ')}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none resize-none leading-relaxed"
          />

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Campaign Delivery Notice:</strong> All registered business emails are pre-filtered for valid commercial corporate domains. For cold broadcast compliance, use the platform’s official transactional sender in <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">lib/email/dispatcher.ts</code>.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK WHATSAPP NUMBERS VIEW */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-2xl border border-[#EAEFF6] p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Broadcast Numbers ({filteredWhatsApp.length} active numbers)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Formatted in international E.164 standard (+CountryCode) ready for bulk WhatsApp broadcast tools, CRM import, or Meta Business Cloud API.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(filteredWhatsApp.join(', '), `Copied ${filteredWhatsApp.length} WhatsApp numbers!`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All ({filteredWhatsApp.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportTextList(filteredWhatsApp, `b2b_link_whatsapp_${roleFilter}.txt`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-full transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={8}
            value={filteredWhatsApp.join('\n')}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none resize-none leading-relaxed"
          />

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
            <Share2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">WhatsApp Campaign Readiness:</strong> Numbers are automatically formatted with national dial codes (+44, +46, +33, +49, +31, +92) captured during the account onboarding flow.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUTONOMOUS INACTIVITY REMINDERS */}
      {activeTab === 'inactivity' && (
        <div className="space-y-6">
          {/* Main Control Card */}
          <div className="bg-white rounded-2xl border border-[#EAEFF6] p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Autonomous Background Job
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cron Endpoint Active
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                  30-Day Inactivity Reminder Engine
                </h3>
                <p className="text-xs text-[#5B6B82] mt-1 max-w-2xl leading-relaxed">
                  Automatically scans wholesale accounts that have had no login activity for over 30 days (1 month). Dispatches a personalized email urging members to log in and refresh their Want-To-Buy (WTB) and Want-To-Sell (WTS) requests, and posts a notification in their in-app desk.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInactivityEmailPreview(true)}
                  className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-bold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => runInactivityCheck(false)}
                  disabled={inactivityScanning}
                  className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-xs font-bold px-4 py-2.5 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inactivityScanning ? 'animate-spin' : ''}`} />
                  <span>{inactivityScanning ? 'Scanning...' : 'Run Inactivity Check Now'}</span>
                </button>
              </div>
            </div>

            {/* Config Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5">
                <div className="text-[11px] font-bold uppercase text-slate-500">Autonomous Schedule</div>
                <div className="text-sm font-black text-[#0B1F3A] mt-1">Daily at 08:00 UTC</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">vercel.json &bull; cron</div>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5">
                <div className="text-[11px] font-bold uppercase text-slate-500">Inactivity Trigger</div>
                <div className="text-sm font-black text-[#0B1F3A] mt-1">30 Days (1 Month)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Based on last active date</div>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5">
                <div className="text-[11px] font-bold uppercase text-slate-500">Cooldown Protection</div>
                <div className="text-sm font-black text-[#0B1F3A] mt-1">30-Day Cooldown</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Zero spam guarantee</div>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3.5">
                <div className="text-[11px] font-bold uppercase text-slate-500">Channels Dispatched</div>
                <div className="text-sm font-black text-[#0B1F3A] mt-1">Email + In-App Desk</div>
                <div className="text-[11px] text-slate-500 mt-0.5">support@b2blink.eu</div>
              </div>
            </div>

            {/* Webhook & Cron Integration Note */}
            <div className="mt-4 p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Autonomous Cron Endpoint:</strong> <code className="font-mono bg-blue-100/80 text-blue-800 px-1.5 py-0.5 rounded text-[11px]">/api/cron/inactivity-reminders</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => runInactivityCheck(true)}
                disabled={inactivityScanning}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
              >
                Force Run (Bypass 30d Cooldown)
              </button>
            </div>
          </div>

          {/* Results Summary Box if scan was triggered */}
          {inactivityResult && (
            <div className="bg-white rounded-2xl border border-[#EAEFF6] p-6 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-sm font-extrabold text-[#0B1F3A] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span suppressHydrationWarning>Latest Scan Execution Results ({new Date(inactivityResult.timestamp).toLocaleTimeString()})</span>
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    {inactivityResult.emailsSent} Sent
                  </span>
                  <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    {inactivityResult.emailsSkipped} Skipped (Recent)
                  </span>
                  {inactivityResult.emailsFailed > 0 && (
                    <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                      {inactivityResult.emailsFailed} Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Details table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Company / Contact</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Days Inactive</th>
                      <th className="py-2.5 px-3">WTB / WTS Lots</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inactivityResult.details?.map((d: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {d.companyName}
                          <span className="block text-[11px] font-normal text-slate-500">{d.contactName}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{d.email}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${d.daysInactive >= 30 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {d.daysInactive} days
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-blue-600 font-bold">{d.activeWtbCount} WTB</span> ·{' '}
                          <span className="text-emerald-600 font-bold">{d.activeWtsCount} WTS</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {d.status === 'sent' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              Email Dispatched
                            </span>
                          )}
                          {d.status === 'skipped_recent_notification' && (
                            <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full text-[10px]">
                              Cooldown Skipped
                            </span>
                          )}
                          {d.status === 'not_inactive' && (
                            <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full text-[10px]">
                              Active (&lt;30d)
                            </span>
                          )}
                          {d.status === 'failed' && (
                            <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              Failed: {d.error || 'Error'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: INACTIVITY EMAIL PREVIEW */}
      {showInactivityEmailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1528]/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-2">
                <span className="bg-blue-50 text-[#0A6CFF] text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-blue-200">
                  Email Preview
                </span>
                <h3 className="font-extrabold text-[#0B1F3A] text-sm">
                  Monthly Inactivity Reminder (WTB &amp; WTS Refresh)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInactivityEmailPreview(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Canvas Preview */}
            <div className="p-6 bg-[#F3F6FB]">
              <div className="bg-white rounded-2xl border border-[#EAEFF6] p-6 shadow-xs space-y-4">
                {/* Header branding */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="font-black text-[#0B1F3A] text-lg">
                    B2B <span className="text-[#00C2FF]">LINK</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Account Reminder
                  </span>
                </div>

                {/* Email Body */}
                <h2 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                  Keep Your Trading Requirements Fresh
                </h2>

                <p className="text-xs text-slate-700 leading-relaxed">
                  Hello <strong>Acme Electronics Representative</strong>,
                </p>

                <p className="text-xs text-slate-700 leading-relaxed">
                  It has been <strong>35 days (over 1 month)</strong> since your last activity on the <strong>B2B LINK</strong> wholesale network.
                </p>

                <p className="text-xs text-slate-700 leading-relaxed">
                  Wholesale pricing, buyer demand, and stock availability across consumer technology move rapidly. To ensure your company continues to receive verified Buyer-Seller Matches, competitive quotations, and relevant trade inquiries, we recommend logging in to review and refresh your active listings:
                </p>

                {/* WTB & WTS Boxes */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#0A6CFF] text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                        WTB Sourcing
                      </span>
                      <strong className="text-xs text-[#0B1F3A]">Want-To-Buy Procurement Demands</strong>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      You currently have <strong className="text-blue-600">3</strong> active procurement request(s). Refresh target purchase quantities and target prices, or mark fulfilled requests as closed to prevent outdated quotations.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#00C2FF] text-[#0B1F3A] text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                        WTS Inventory
                      </span>
                      <strong className="text-xs text-[#0B1F3A]">Want-To-Sell Available Lots</strong>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      You currently have <strong className="text-cyan-700">8</strong> active stock listing(s). Update available quantities, condition grades, and asking prices to ensure high visibility to active European buyers.
                    </p>
                  </div>
                </div>

                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-[11px] text-blue-900 leading-normal">
                  💡 <strong>Unified Wholesale Account:</strong> All B2B LINK accounts can both source demand and liquidate excess inventory with <strong>0% transaction commission</strong>.
                </div>

                <div className="pt-2 text-center">
                  <span className="inline-block bg-[#0A6CFF] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-xs">
                    Log In &amp; Update Listings
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
                  Kind regards,<br />
                  <strong className="text-[#0B1F3A]">B2B LINK Trading Support</strong><br />
                  <span className="text-[11px] text-slate-400">Trading Board Desk &bull; support@b2blink.eu</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Sender: notifications@b2blink.eu</span>
              <button
                type="button"
                onClick={() => setShowInactivityEmailPreview(false)}
                className="bg-[#0B1F3A] hover:bg-[#081528] text-white text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
