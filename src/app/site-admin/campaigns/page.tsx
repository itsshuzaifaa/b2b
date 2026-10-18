'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  Users,
  Copy,
  Check,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  RefreshCw,
  Share2,
  X,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import type { CampaignLead } from '@/lib/campaigns/campaign-store';

export default function SiteAdminCampaignsPage() {
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'table' | 'emails' | 'whatsapp'>('table');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Export CSV Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    name: true,
    company: true,
    email: true,
    phone: true,
    country: false,
    tier: false,
    created_at: false,
  });

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

  // Filtered Leads (no buyer/seller segregation)
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
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
        l.company_name.toLowerCase().includes(q) ||
        (l.country && l.country.toLowerCase().includes(q))
      );
    });
  }, [leads, tierFilter, searchQuery]);

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

  // Toggle field selection for CSV Export
  const handleToggleField = (field: string) => {
    setSelectedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSelectAllFields = () => {
    setSelectedFields({
      name: true,
      company: true,
      email: true,
      phone: true,
      country: true,
      tier: true,
      created_at: true,
    });
  };

  const handleSelectDefaultFields = () => {
    setSelectedFields({
      name: true,
      company: true,
      email: true,
      phone: true,
      country: false,
      tier: false,
      created_at: false,
    });
  };

  // Execute selected CSV export
  const handleDownloadCustomCsv = () => {
    const headers: string[] = [];
    const fieldKeys: string[] = [];

    if (selectedFields.name) {
      headers.push('Contact Name');
      fieldKeys.push('name');
    }
    if (selectedFields.company) {
      headers.push('Company Name');
      fieldKeys.push('company');
    }
    if (selectedFields.email) {
      headers.push('Email Address');
      fieldKeys.push('email');
    }
    if (selectedFields.phone) {
      headers.push('Phone / WhatsApp');
      fieldKeys.push('phone');
    }
    if (selectedFields.country) {
      headers.push('Country');
      fieldKeys.push('country');
    }
    if (selectedFields.tier) {
      headers.push('Membership Tier');
      fieldKeys.push('tier');
    }
    if (selectedFields.created_at) {
      headers.push('Registration Date');
      fieldKeys.push('created_at');
    }

    if (headers.length === 0) {
      alert('Please select at least one field to export.');
      return;
    }

    const rows = filteredLeads.map((l) => {
      const rowValues: string[] = [];
      if (selectedFields.name) rowValues.push(`"${(l.contact_name || '').replace(/"/g, '""')}"`);
      if (selectedFields.company) rowValues.push(`"${(l.company_name || '').replace(/"/g, '""')}"`);
      if (selectedFields.email) rowValues.push(`"${(l.email || '').replace(/"/g, '""')}"`);
      if (selectedFields.phone) rowValues.push(`"${(l.whatsapp || '').replace(/"/g, '""')}"`);
      if (selectedFields.country) rowValues.push(`"${(l.country || 'EU').replace(/"/g, '""')}"`);
      if (selectedFields.tier) rowValues.push(`"${(l.membership_tier || 'bronze').replace(/"/g, '""')}"`);
      if (selectedFields.created_at) rowValues.push(`"${(l.created_at || '').replace(/"/g, '""')}"`);
      return rowValues.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `b2b_link_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
  };

  return (
    <div className="space-y-6 w-full max-w-full">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EAEFF6]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Outreach Database
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Synced on Account Creation
            </span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] tracking-tight">
            Campaign Leads &amp; Outreach Lists
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1 font-normal">
            Direct database of verified corporate emails and WhatsApp numbers captured across all wholesale accounts.
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
            onClick={() => setShowExportModal(true)}
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-xs px-5 py-2.5 rounded-full transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row: 3 Wide Cards (Broadcast Hub Removed to maximize width) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Total Leads */}
        <div className="bg-[#F8FAFC] rounded-[24px] p-5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Campaign Contacts
            </span>
            <Users className="w-4 h-4 text-[#0A6CFF]" />
          </div>
          <div className="text-[30px] font-black text-[#0B1F3A] leading-tight">
            {leads.length}
          </div>
          <div className="text-[12px] text-slate-500 mt-1 font-medium">
            Registered global trading counterparties
          </div>
        </div>

        {/* Card 2: Email List */}
        <div className="bg-[#F8FAFC] rounded-[24px] p-5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Email Outreach List
              </span>
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-[30px] font-black text-[#0A6CFF] leading-tight">
              {filteredEmails.length}
            </div>
            <div className="text-[12px] text-slate-500 mt-1 font-medium">
              Active corporate inboxes on file
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(filteredEmails.join(', '), `Copied ${filteredEmails.length} emails to clipboard!`)}
            className="mt-3 w-full bg-white hover:bg-[#EBF3FF] border border-[#EAEFF6] text-[#0A6CFF] text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All Emails</span>
          </button>
        </div>

        {/* Card 3: WhatsApp List */}
        <div className="bg-[#F8FAFC] rounded-[24px] p-5 border border-[#EAEFF6] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                WhatsApp Broadcast List
              </span>
              <Phone className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-[30px] font-black text-emerald-600 leading-tight">
              {filteredWhatsApp.length}
            </div>
            <div className="text-[12px] text-slate-500 mt-1 font-medium">
              Direct international phone numbers
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(filteredWhatsApp.join(', '), `Copied ${filteredWhatsApp.length} WhatsApp numbers!`)}
            className="mt-3 w-full bg-white hover:bg-emerald-50 border border-[#EAEFF6] text-emerald-700 text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All WhatsApp</span>
          </button>
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
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF] font-medium"
            />
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

      {/* TAB 1: ALL LEADS TABLE (Alternating white and grey bg, utilizes full width) */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-[24px] border border-[#EAEFF6] overflow-hidden shadow-xs w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#EAEFF6] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Contact / Enterprise</th>
                  <th className="py-3.5 px-4">Membership Tier</th>
                  <th className="py-3.5 px-5">Corporate Email</th>
                  <th className="py-3.5 px-5">WhatsApp Number</th>
                  <th className="py-3.5 px-4">Country</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No campaign leads matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, idx) => {
                    const isEven = idx % 2 === 1;
                    const cleanPhone = lead.whatsapp.replace(/[^\d]/g, '');

                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-[#F1F5F9] transition ${
                          isEven ? 'bg-[#F9FAFC]' : 'bg-white'
                        } hover:bg-[#F0F6FF]`}
                      >
                        {/* Name & Company */}
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          <div className="text-[13px]">{lead.contact_name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {lead.company_name}
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              lead.membership_tier.toLowerCase() === 'gold'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : lead.membership_tier.toLowerCase() === 'silver'
                                ? 'bg-[#EBF3FF] text-[#0A6CFF] border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {lead.membership_tier} Member
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`mailto:${lead.email}`}
                              className="font-medium text-blue-600 hover:underline truncate max-w-[200px]"
                            >
                              {lead.email}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(lead.email, `Copied email for ${lead.contact_name}`)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* WhatsApp */}
                        <td className="py-3.5 px-5 font-mono text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span>{lead.whatsapp || '—'}</span>
                            {lead.whatsapp && (
                              <button
                                type="button"
                                onClick={() => handleCopy(lead.whatsapp, `Copied phone for ${lead.contact_name}`)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                title="Copy number"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Country */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {lead.country || 'Global'}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {lead.created_at}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`mailto:${lead.email}`}
                              className="bg-[#F8FAFC] hover:bg-[#EAEFF6] border border-[#EAEFF6] text-[#0A6CFF] text-[11px] font-bold px-2.5 py-1 rounded-full transition"
                            >
                              Email
                            </a>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full transition"
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

      {/* TAB 2: EMAILS LIST VIEW */}
      {activeTab === 'emails' && (
        <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[16px] text-slate-900">
              Bulk Email Pastebox ({filteredEmails.length} Total)
            </h3>
            <button
              type="button"
              onClick={() => handleCopy(filteredEmails.join(', '), 'Copied all emails to clipboard!')}
              className="bg-[#0A6CFF] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#0857CF] transition flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy All ({filteredEmails.length})</span>
            </button>
          </div>
          <textarea
            readOnly
            rows={10}
            value={filteredEmails.join(', ')}
            className="w-full p-4 bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl text-xs font-mono text-slate-700 focus:outline-none select-all"
          />
        </div>
      )}

      {/* TAB 3: WHATSAPP LIST VIEW */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[16px] text-slate-900">
              WhatsApp Numbers List ({filteredWhatsApp.length} Total)
            </h3>
            <button
              type="button"
              onClick={() => handleCopy(filteredWhatsApp.join('\n'), 'Copied all WhatsApp numbers!')}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-emerald-700 transition flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy All ({filteredWhatsApp.length})</span>
            </button>
          </div>
          <textarea
            readOnly
            rows={10}
            value={filteredWhatsApp.join('\n')}
            className="w-full p-4 bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl text-xs font-mono text-slate-700 focus:outline-none select-all"
          />
        </div>
      )}

      {/* MODAL: EXPORT CSV FIELD PICKER POPUP */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 sm:p-7 text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F4FA] mb-4">
              <div>
                <h3 className="text-[18px] font-black text-[#0B1F3A]">
                  Export Campaign Leads CSV
                </h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Select which fields to include in your CSV export ({filteredLeads.length} records).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Toggle Buttons */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={handleSelectDefaultFields}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF] hover:bg-[#DCEBFF] transition cursor-pointer"
              >
                Default (Name, Email, Phone, Company)
              </button>
              <button
                type="button"
                onClick={handleSelectAllFields}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Select All
              </button>
            </div>

            {/* Field Checkboxes */}
            <div className="space-y-2.5 bg-[#F8FAFC] p-4 rounded-2xl border border-[#EAEFF6]">
              {[
                { key: 'name', label: 'Contact Person Name' },
                { key: 'company', label: 'Company / Enterprise Name' },
                { key: 'email', label: 'Corporate Email Address' },
                { key: 'phone', label: 'WhatsApp / Phone Number' },
                { key: 'country', label: 'Country / Territory' },
                { key: 'tier', label: 'Membership Tier' },
                { key: 'created_at', label: 'Account Registration Date' },
              ].map(({ key, label }) => {
                const checked = selectedFields[key];

                return (
                  <label
                    key={key}
                    onClick={() => handleToggleField(key)}
                    className="flex items-center gap-2.5 cursor-pointer text-[13px] font-medium text-[#0B1F3A] hover:text-[#0A6CFF] select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded border-[#CBD5E1] text-[#0A6CFF] focus:ring-[#0A6CFF] cursor-pointer"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0F4FA] mt-5">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2.5 rounded-full border border-[#E3E9F2] text-[#5B6B82] font-bold text-[13px] hover:bg-[#F3F6FB] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadCustomCsv}
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
