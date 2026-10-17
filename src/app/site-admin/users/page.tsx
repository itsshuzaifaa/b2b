'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminAccounts,
  saveAdminAccounts,
  suspendAccount,
  unsuspendAccount,
  deleteAccount,
  updateAccountTier,
  updateAccountApproval,
  type AdminClientAccount,
} from '@/lib/admin/admin-store';
import type { MembershipTier } from '@/types/database';
import {
  Search,
  Users,
  ShieldAlert,
  Trash2,
  Edit,
  Eye,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  X,
  Building2,
  Mail,
  Phone,
  FileText,
  ShieldCheck,
  Ban,
  Check,
} from 'lucide-react';

export default function SiteAdminUsersPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminClientAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer' | 'suspended' | 'pending'>('all');

  // Modals
  const [selectedDossier, setSelectedDossier] = useState<AdminClientAccount | null>(null);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState<AdminClientAccount | null>(null);
  const [editingTierAccount, setEditingTierAccount] = useState<AdminClientAccount | null>(null);
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('silver');
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/accounts');
      if (res.ok) {
        const data = await res.json();
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
          saveAdminAccounts(data.accounts);
          return;
        }
      }
    } catch {
      // fallback
    }
    setAccounts(getAdminAccounts());
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

  const handleVerifyAccount = async (acc: AdminClientAccount) => {
    updateAccountApproval(acc.id, 'approved');
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
    showNotice(`Account "${acc.name}" verified & activated! Approval email dispatched to ${acc.email}.`);
    loadData();
  };

  const handleToggleSuspend = async (acc: AdminClientAccount) => {
    if (acc.account_status === 'suspended') {
      unsuspendAccount(acc.id);
      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsuspend',
            companyId: acc.id,
            email: acc.email,
            contactName: acc.contact_name,
            companyName: acc.name,
          }),
        });
      } catch {}
      showNotice(`Account "${acc.name}" reactivated. Welcome notice dispatched.`);
    } else {
      suspendAccount(acc.id);
      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'suspend',
            companyId: acc.id,
            email: acc.email,
            contactName: acc.contact_name,
            companyName: acc.name,
          }),
        });
      } catch {}
      showNotice(`Account "${acc.name}" suspended. Suspension notice dispatched to ${acc.email}.`);
    }
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteAccount(id);
    setDeleteConfirmAccount(null);
    showNotice('Account successfully removed from platform.');
    loadData();
  };

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTierAccount) return;
    updateAccountTier(editingTierAccount.id, selectedTier);
    setEditingTierAccount(null);
    showNotice(`Membership tier updated to ${selectedTier.toUpperCase()} for ${editingTierAccount.name}`);
    loadData();
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.name.toLowerCase().includes(q) ||
        acc.contact_name.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.vat_number && acc.vat_number.toLowerCase().includes(q)) ||
        (acc.country && acc.country.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (roleFilter === 'seller') return acc.role === 'seller';
      if (roleFilter === 'buyer') return acc.role === 'buyer';
      if (roleFilter === 'suspended') return acc.account_status === 'suspended';
      if (roleFilter === 'pending') return acc.approval_status === 'pending' || acc.approval_status === 'pending_verification';

      return true;
    });
  }, [accounts, searchQuery, roleFilter]);

  const sellerCount = accounts.filter((a) => a.role === 'seller').length;
  const buyerCount = accounts.filter((a) => a.role === 'buyer').length;
  const suspendedCount = accounts.filter((a) => a.account_status === 'suspended').length;
  const pendingCount = accounts.filter((a) => a.approval_status === 'pending' || a.approval_status === 'pending_verification').length;

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Accounts Directory
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Real registered platform accounts. Audit client dossiers, verify wholesale documents, or manage access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#EBF3FF] text-[#0A6CFF] text-[12px] font-bold px-3.5 py-1.5 rounded-full">
            {accounts.length} active clients
          </div>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="mt-6 space-y-4">
        {/* Pills: Keep only All, Pending, and Suspended with shortened names */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('pending')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              roleFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            <span>Pending ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('suspended')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              roleFilter === 'suspended'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Suspended ({suspendedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact person, or email..."
            className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Accounts Table Card */}
      <div className="mt-6 bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                <th className="py-4 px-6">COMPANY / JURISDICTION</th>
                <th className="py-4 px-6">ROLE &amp; TIER</th>
                <th className="py-4 px-6">PRIMARY CONTACT</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">CATALOG LOTS</th>
                <th className="py-4 px-6 text-right">ADMIN ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#5B6B82]">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-[15px] text-[#0B1F3A]">No client accounts found</p>
                    <p className="text-[12px] mt-1">Try clearing filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSuspended = acc.account_status === 'suspended';

                  return (
                    <tr key={acc.id} className="hover:bg-[#F8FAFC]/70 transition group">
                      {/* Company & Country */}
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => setSelectedDossier(acc)}
                          className="font-bold text-[#0B1F3A] hover:text-[#0A6CFF] text-left transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{acc.name}</span>
                        </button>
                        <div className="text-[12px] text-[#8A9BB0] mt-0.5 flex items-center gap-1.5">
                          <span>{acc.country || 'European Union'}</span>
                          {acc.vat_number && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[11px]">{acc.vat_number}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Role & Tier */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                              acc.role === 'seller'
                                ? 'bg-blue-50 text-[#0A6CFF]'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {acc.role}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTierAccount(acc);
                              setSelectedTier(acc.membership_tier);
                            }}
                            className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-[#41536D] hover:bg-[#EAEFF6] transition cursor-pointer"
                            title="Click to change membership tier"
                          >
                            {acc.membership_tier}
                          </button>
                        </div>
                        <div className="text-[11px] text-[#8A9BB0] mt-1 font-medium">
                          {acc.total_spend_or_sales}
                        </div>
                      </td>

                      {/* Contact - Requirement 02: Real name shown */}
                      <td className="py-4 px-6 text-[#5B6B82]">
                        <div className="font-bold text-[#0B1F3A] text-[13px]">{acc.contact_name}</div>
                        <div className="text-[12px] text-[#0A6CFF]">{acc.email}</div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-red-200">
                            <Ban className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : acc.approval_status === 'pending' || acc.approval_status === 'pending_verification' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending KYC</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active / Verified</span>
                          </span>
                        )}
                      </td>

                      {/* Listings Count */}
                      <td className="py-4 px-6 text-[#0B1F3A] font-bold">
                        {acc.listings_count > 0 ? (
                          <span>{acc.listings_count} lots</span>
                        ) : (
                          <span className="text-[#8A9BB0] font-normal">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Verify Button for Pending Accounts */}
                          {(acc.approval_status === 'pending' || acc.approval_status === 'pending_verification') && (
                            <button
                              type="button"
                              onClick={() => handleVerifyAccount(acc)}
                              title="Verify wholesale documents & activate account"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs cursor-pointer mr-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Message Button */}
                          <button
                            type="button"
                            onClick={() => router.push(`/site-admin/messages?to=${acc.id}`)}
                            title="Open direct message thread"
                            className="p-2 rounded-xl text-slate-400 hover:text-[#0A6CFF] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Dossier Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDossier(acc)}
                            title="View client dossier"
                            className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Suspend / Unsuspend */}
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(acc)}
                            title={isSuspended ? 'Reactivate account' : 'Suspend account'}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-amber-500 hover:bg-amber-50'
                            }`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmAccount(acc)}
                            title="Delete account permanently"
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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

      {/* DOSSIER MODAL */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] font-black text-[16px] flex items-center justify-center">
                  {selectedDossier.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[17px] font-extrabold text-[#0B1F3A]">
                    {selectedDossier.name}
                  </h3>
                  <p className="text-[12px] text-[#5B6B82]">
                    Role: <strong className="uppercase">{selectedDossier.role}</strong> · {selectedDossier.membership_tier.toUpperCase()} Tier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDossier(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Registration No</span>
                  <p className="font-mono font-bold text-[#0B1F3A] mt-0.5">
                    {selectedDossier.company_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">VAT / Tax ID</span>
                  <p className="font-mono font-bold text-[#0A6CFF] mt-0.5">
                    {selectedDossier.vat_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Jurisdiction</span>
                  <p className="font-bold text-[#0B1F3A] mt-0.5">{selectedDossier.country}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Account Status</span>
                  <p className={`font-bold mt-0.5 ${selectedDossier.account_status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedDossier.account_status.toUpperCase()}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-[#8A9BB0] block mb-1">
                  Contact Information
                </span>
                <div className="p-3.5 rounded-xl border border-[#EAEFF6] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A9BB0]">Name:</span>
                    <strong className="text-[#0B1F3A]">{selectedDossier.contact_name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A9BB0]">Email:</span>
                    <span className="text-[#0A6CFF] font-semibold">{selectedDossier.email}</span>
                  </div>
                  {selectedDossier.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#8A9BB0]">Phone:</span>
                      <span className="text-[#0B1F3A] font-medium">{selectedDossier.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => {
                  const target = selectedDossier;
                  setSelectedDossier(null);
                  handleToggleSuspend(target);
                }}
                className={`text-[13px] font-bold transition ${
                  selectedDossier.account_status === 'suspended'
                    ? 'text-emerald-600 hover:underline'
                    : 'text-amber-600 hover:underline'
                }`}
              >
                {selectedDossier.account_status === 'suspended' ? 'Reactivate Client' : 'Suspend Access'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedDossier;
                  setSelectedDossier(null);
                  router.push(`/site-admin/messages?to=${target.id}`);
                }}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message Client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TIER MODAL */}
      {editingTierAccount && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <h3 className="text-[17px] font-bold text-[#0B1F3A]">
              Modify Membership Tier
            </h3>
            <p className="text-[12px] text-[#5B6B82] mt-0.5">
              Adjust quota permissions for <strong>{editingTierAccount.name}</strong>.
            </p>

            <form onSubmit={handleSaveTier} className="mt-5 space-y-4">
              <div className="space-y-2">
                {(['bronze', 'silver', 'gold'] as MembershipTier[]).map((tier) => (
                  <label
                    key={tier}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                      selectedTier === tier
                        ? 'border-[#0A6CFF] bg-[#EBF3FF]/40 text-[#0B1F3A]'
                        : 'border-[#EAEFF6] hover:bg-slate-50 text-[#5B6B82]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="tier"
                        value={tier}
                        checked={selectedTier === tier}
                        onChange={() => setSelectedTier(tier)}
                        className="text-[#0A6CFF] focus:ring-[#0A6CFF]"
                      />
                      <div>
                        <strong className="text-[14px] font-bold uppercase text-[#0B1F3A] block">
                          {tier} Tier
                        </strong>
                        <span className="text-[11px] text-[#8A9BB0]">
                          {tier === 'bronze' && '15 products quota, manual quoting'}
                          {tier === 'silver' && '50 products, CSV upload enabled'}
                          {tier === 'gold' && 'Unlimited listings, Hot Deals, priority ranking'}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTierAccount(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmAccount && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-[#0B1F3A] text-center">
              Delete Client Account?
            </h3>
            <p className="text-[13px] text-[#5B6B82] text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteConfirmAccount.name}</strong>?
              This will remove all associated product listings and quotes.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmAccount(null)}
                className="px-5 py-2.5 rounded-full bg-slate-100 text-[#0B1F3A] font-semibold text-[13px] hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmAccount.id)}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] shadow-xs transition cursor-pointer"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
