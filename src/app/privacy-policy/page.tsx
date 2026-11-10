import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | B2B LINK OÜ',
  description: 'Privacy Policy for B2B LINK wholesale marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[70vh] bg-[#F8FAFC] py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-[#0A6CFF]" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0B1F3A] tracking-tight">
          Privacy Policy
        </h1>
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium">
          This page is a placeholder. The final legal text will be provided before launch.
        </div>
        <p className="mt-6 text-sm text-[#5B6B82] leading-relaxed">
          B2B LINK OÜ is committed to protecting your commercial business and personal data in strict compliance with the General Data Protection Regulation (GDPR) and Estonian data privacy laws.
        </p>
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#0A6CFF] hover:text-[#0857CF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
