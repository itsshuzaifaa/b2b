'use client';

import React, { useEffect } from 'react';
import { X, Scale, ShieldCheck, Check, Clock } from 'lucide-react';
import { TermsDocument } from '@/components/legal/TermsDocument';
import { PrivacyDocument } from '@/components/legal/PrivacyDocument';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy' | null;
  onAccept?: () => void;
}

export function LegalModal({ isOpen, onClose, type, onAccept }: LegalModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !type) return null;

  const isTerms = type === 'terms';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-[#0B1F3A]/80 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-[28px] shadow-[0_25px_60px_rgba(11,31,58,0.35)] border border-[#EAEFF6] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#F1F5F9] bg-[#FFFFFF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A6CFF]/10 text-[#0A6CFF] flex items-center justify-center shrink-0">
              {isTerms ? <Scale className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#0A6CFF]">
                  B2B LINK OÜ &bull; LEGAL POLICY
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] font-semibold bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  <span>Oct 2026</span>
                </span>
              </div>
              <h2 className="text-[18px] sm:text-[20px] font-black text-[#0B1F3A] leading-tight">
                {isTerms ? 'Terms & Conditions' : 'Privacy Policy'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full text-[#64748B] hover:text-[#0B1F3A] hover:bg-[#F3F6FB] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vertically Scrollable Content Body - Optimized for smooth 60fps scrolling */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain p-6 sm:p-10 select-text"
          style={{
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            transform: 'translateZ(0)',
          }}
        >
          {isTerms ? <TermsDocument /> : <PrivacyDocument />}
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-[12px] text-[#64748B]">
            Official document &bull; Close or agree below to complete your registration.
          </p>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 border border-[#CBD5E1] text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
            >
              Close
            </button>
            {onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>I Understand &amp; Agree</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
