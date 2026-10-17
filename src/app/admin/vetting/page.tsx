'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSellerVetting } from '@/lib/actions/admin';
import { MOCK_COMPANIES } from '@/lib/mock-data';
import type { Company } from '@/types/database';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CreditCard,
} from 'lucide-react';

export default function AdminVettingPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Company[]>(MOCK_COMPANIES.filter((c) => c.role === 'seller'));
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleDecision = async (companyId: string, status: 'approved' | 'rejected') => {
    setProcessingId(companyId);
    setFeedback(null);
    try {
      const res = await updateSellerVetting(companyId, status, status === 'rejected' ? 'VAT documents incomplete.' : undefined);
      if (res.success) {
        setSellers((prev) =>
          prev.map((s) => (s.id === companyId ? { ...s, approval_status: status } : s))
        );
        setFeedback(`Company ${status === 'approved' ? 'approved & certified' : 'rejected'}. Decision email triggered.`);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessingId(null);
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
                Compliance Protocol
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1 text-white">Seller Vetting Queue</h1>
              <p className="text-xs text-slate-400 mt-1">
                Audit pending commercial registrations, verified Wise payment statuses, and grant listing rights.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          {feedback && (
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs font-semibold text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-[#0066FF]" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {sellers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No seller accounts currently awaiting verification or certification.
              </div>
            ) : (
              sellers.map((seller) => {
              const isPending = seller.approval_status === 'pending';
              const isApproved = seller.approval_status === 'approved';

              return (
                <div key={seller.id} className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition">
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">{seller.name}</h3>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : isApproved
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-red-50 text-red-800 border-red-300'
                        }`}
                      >
                        {seller.approval_status}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {seller.membership_tier} Tier
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                      <div>Contact: <strong>{seller.contact_name}</strong></div>
                      <div>Email: <strong className="text-[#0066FF]">{seller.email}</strong></div>
                      <div>Niches: <strong>{seller.categories?.join(', ') || 'General Wholesale'}</strong></div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      <span>Wise Settlement Reference: <code>ACT-{seller.id.slice(0, 8).toUpperCase()}</code></span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleDecision(seller.id, 'approved')}
                          disabled={processingId === seller.id}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve & Activate</span>
                        </button>
                        <button
                          onClick={() => handleDecision(seller.id, 'rejected')}
                          disabled={processingId === seller.id}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-500">
                          Status: {seller.approval_status}
                        </span>
                        <button
                          onClick={() => handleDecision(seller.id, isApproved ? 'rejected' : 'approved')}
                          className="text-[#0066FF] hover:underline font-bold text-xs ml-2"
                        >
                          Toggle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
