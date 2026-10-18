'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  ShieldCheck,
  Percent,
  MessageSquare,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface WelcomeModalProps {
  buyerName: string;
  buyerEmail: string;
  companyId?: string;
}

export function WelcomeModal({ buyerName, buyerEmail, companyId }: WelcomeModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = `b2b_buyer_welcome_modal_${buyerEmail || companyId || 'buyer'}`;
    const alreadyDismissed = sessionStorage.getItem(storageKey);

    if (!alreadyDismissed) {
      // Delay slightly until all dashboard resources and fonts render smoothly
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [buyerEmail, companyId]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      const storageKey = `b2b_buyer_welcome_modal_${buyerEmail || companyId || 'buyer'}`;
      sessionStorage.setItem(storageKey, 'true');
    }
    setIsOpen(false);
  };

  const handleOpenJeffChat = () => {
    handleDismiss();
    router.push('/dashboard/inquiries');
  };

  const handleGoToMarketplace = () => {
    handleDismiss();
    router.push('/marketplace');
  };

  if (!isOpen) return null;

  const firstName = buyerName.split(' ')[0] || 'Buyer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="w-full max-w-[560px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_20px_60px_rgba(11,31,58,0.25)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header Banner: Deep Navy with Cyan Accents */}
        <div className="bg-[#0B1F3A] text-white p-6 sm:p-7 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close welcome popup"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#00C2FF] bg-[#00C2FF]/10 px-2.5 py-0.5 rounded-full border border-[#00C2FF]/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#00C2FF]" />
              <span>GLOBAL VERIFIED WHOLESALE NETWORK</span>
            </span>
          </div>

          <div className="flex items-start gap-3.5 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-[#00C2FF]/20 border border-[#00C2FF]/40 text-[#00C2FF] font-black text-[15px] flex items-center justify-center shrink-0 shadow-inner">
              B2B
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight text-white leading-snug">
                Welcome to B2B LINK
              </h2>
              <p className="text-[13px] text-[#A7BFDE] mt-0.5">
                From <strong className="text-white font-semibold">B2B LINK Support Team</strong> · Wholesale Platform Desk
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-5">
          <p className="text-[14px] text-[#41536D] leading-relaxed">
            Your unified wholesale account is active. Connect directly with global trading partners to buy and sell products with zero broker fees.
          </p>

          {/* 5 Core Features from Message 7 Specification */}
          <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#0B1F3A]">Live Trading Board</h4>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Browse current BUY and SELL listings from B2B LINK members.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#0B1F3A]">Buyer-Seller Match</h4>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Receive relevant matches based on the products you are buying or selling.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#0B1F3A]">Fast Product Posting</h4>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Use EAN/UPC and product information to create listings quickly.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#0B1F3A]">Direct Contact</h4>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Connect directly with relevant trading partners.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#0B1F3A]">0% Transaction Commission</h4>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  B2B LINK does not charge commission on trades between members.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleGoToMarketplace}
              className="w-full min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Go to Trading Board</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleOpenJeffChat}
              className="w-full min-h-[40px] rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0A6CFF] font-bold text-[13px] flex items-center justify-center gap-2 transition-colors border border-[#0A6CFF]/20 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Welcome Message from Support Team</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full text-center text-[12px] font-semibold text-[#5B6B82] hover:text-[#0B1F3A] py-1 transition cursor-pointer"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
