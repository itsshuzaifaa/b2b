'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateSellerTier } from '@/lib/actions/admin';
import type { MembershipTier } from '@/types/database';
import { ArrowLeft, Users, CheckCircle2 } from 'lucide-react';
import {
  getAdminAccounts,
  updateAccountTier as storeUpdateTier,
  type AdminClientAccount,
} from '@/lib/admin/admin-store';

export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<AdminClientAccount[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    setMembers(getAdminAccounts());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    return () => window.removeEventListener('b2b_admin_update', loadData);
  }, []);

  const handleTierChange = async (companyId: string, newTier: MembershipTier) => {
    try {
      storeUpdateTier(companyId, newTier);
      const res = await updateSellerTier(companyId, newTier);
      setFeedback(`Updated ${companyId} tier to ${newTier.toUpperCase()}`);
      loadData();
    } catch {
      setFeedback('Failed to update membership tier.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push('/admin')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0066FF] mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Control Center</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#0B132B] px-8 py-6 text-white border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
                Membership Control
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1 text-white">Member & Tier Manager</h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure commercial tier limits: Bronze (15 listings), Silver (50 listings + CSV), Gold (Unlimited + Hot).
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 text-[#00D2FF] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {feedback && (
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Vetting Status</th>
                  <th className="px-4 py-4">Current Membership Tier</th>
                  <th className="px-6 py-4 text-right">Change Tier Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-4 capitalize font-semibold">{m.role}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          m.approval_status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {m.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold uppercase text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                        {m.membership_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={m.membership_tier}
                        onChange={(e) => handleTierChange(m.id, e.target.value as MembershipTier)}
                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                      >
                        <option value="bronze">Bronze (Free / 15)</option>
                        <option value="silver">Silver (€79 / 50)</option>
                        <option value="gold">Gold VIP (€179 / Unlimited)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
