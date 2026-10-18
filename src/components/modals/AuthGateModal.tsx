'use client';

import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  redirectUrl?: string;
}

export function AuthGateModal({
  isOpen,
  onClose,
  title = 'Verified Wholesale Access Required',
  subtitle = 'Sign in or create a free commercial account to view full lot specifications, unlock direct contact details, and send quotations or inquiries.',
  redirectUrl,
}: AuthGateModalProps) {
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-[480px] bg-white rounded-[32px] shadow-[0_25px_60px_rgba(11,31,58,0.2)] border border-[#EAEFF6] p-7 sm:p-9 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-full text-[#5B6B82] hover:text-[#0B1F3A] hover:bg-[#F3F6FB] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Dark Heading (Website Design Language) */}
        <div className="text-center pt-2">
          <h3 className="text-[24px] sm:text-[27px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            {title}
          </h3>
          <p className="mt-2.5 text-[14px] sm:text-[15px] text-[#5B6B82] leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Benefits Checklist */}
        <div className="bg-[#F8FAFD] border border-[#EAEFF6] rounded-2xl p-4 sm:p-5 my-6 space-y-3 text-[13.5px] text-[#41536D]">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
            <span>Full volume pricing &amp; pallet tiers unlocked</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
            <span>Direct seller communication &amp; quotation submissions</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#0A6CFF] shrink-0" />
            <span>Post unlimited Want-To-Buy (WTB) requests free</span>
          </div>
        </div>

        {/* Full-Width Action Button */}
        <a
          href={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
          className="w-full flex items-center justify-center gap-2 bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] py-3.5 px-6 rounded-full shadow-lg shadow-blue-500/20 transition-colors"
        >
          <span>Create Free Account</span>
        </a>

        {/* Small Underlined Sign In Link */}
        <div className="mt-4 text-center">
          <a
            href={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : '/login'}
            className="text-[13px] text-[#5B6B82] hover:text-[#0B1F3A] transition-colors"
          >
            Already have an account?{' '}
            <span className="font-semibold text-[#0B1F3A] underline underline-offset-4">
              Sign in
            </span>
          </a>
        </div>

        {/* Bottom Micro Copy */}
        <p className="text-center text-[11px] text-[#8C9AA8] mt-4">
          Free membership for commercial buyers &bull; Zero commission fees
        </p>
      </div>
    </div>
  );
}
