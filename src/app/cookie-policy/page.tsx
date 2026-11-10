import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Cookie } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy | B2B LINK OÜ',
  description: 'Cookie Policy for B2B LINK wholesale marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-[70vh] bg-[#F8FAFC] py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Cookie className="w-8 h-8 text-[#0A6CFF]" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0B1F3A] tracking-tight">
          Cookie Policy
        </h1>
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium">
          This page is a placeholder. The final legal text will be provided before launch.
        </div>
        <p className="mt-6 text-sm text-[#5B6B82] leading-relaxed">
          Information regarding our technical cookies, preference settings, and GDPR-compliant consent framework will be detailed here prior to production launch.
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
