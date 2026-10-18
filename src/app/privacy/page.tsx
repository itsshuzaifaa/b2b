'use client';

import React from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { PrivacyDocument } from '@/components/legal/PrivacyDocument';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] pt-28 sm:pt-32 lg:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb / Top Meta */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
            <Link href="/" className="hover:text-[#0A6CFF] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#0B1F3A] font-semibold">Privacy Policy</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3FF] border border-[#BFDBFE] text-[#0A6CFF] text-[12px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated: October 2026</span>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_12px_40px_rgba(11,31,58,0.06)] p-6 sm:p-10 md:p-14">
          <PrivacyDocument />
        </div>
      </div>
    </div>
  );
}
