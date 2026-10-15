'use client';

import React from 'react';
import { ShieldCheck, X, Sparkles, LogIn, ArrowRight } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export function AuthGateModal({
  isOpen,
  onClose,
  title = 'Verified Wholesale Access Required',
  subtitle = 'Create a free B2B account to view full wholesale prices, browse 1,000+ verified listings, and submit sourcing requests.',
}: AuthGateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Accent Banner */}
        <div className="bg-[#0B132B] px-6 py-6 text-white text-center border-b border-slate-800">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-[#00D2FF]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#00D2FF] px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-800/60">
            Exclusive B2B Trade Gate
          </span>
          <h3 className="text-xl font-bold mt-2 text-white">{title}</h3>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          <p className="text-sm text-slate-600 text-center leading-relaxed mb-6">
            {subtitle}
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-6 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#0066FF]" />
              <span>Full volume pricing & pallet tiers unlocked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#0066FF]" />
              <span>Direct seller communication & quotation submissions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#0066FF]" />
              <span>Post unlimited Want-To-Buy (WTB) requests free</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/register"
              className="flex-1 flex items-center justify-center gap-2 bg-[#0066FF] hover:bg-blue-700 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-sm transition"
            >
              <Sparkles className="w-4 h-4 text-[#00D2FF]" />
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/login"
              className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm py-3 px-5 rounded-xl border border-slate-200 transition"
            >
              <LogIn className="w-4 h-4 text-slate-500" />
              <span>Sign In</span>
            </a>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            Free membership for commercial buyers &bull; Zero commission fees
          </p>
        </div>
      </div>
    </div>
  );
}
