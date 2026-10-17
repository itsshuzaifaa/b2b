import React from 'react';
import Link from 'next/link';
import { PricingSection } from '@/components/landing/PricingSection';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Mail,
  Zap,
  Globe,
  RefreshCw,
  Building2,
} from 'lucide-react';

export const metadata = {
  title: 'Membership & Pricing Plans | B2B LINK OÜ',
  description:
    'Transparent membership tiers for European wholesale traders. Unified accounts that buy & sell with 0% transaction commission.',
};

export default function MembershipPage() {
  const comparisonFeatures = [
    { name: 'Dual Buying & Selling Capabilities', bronze: 'Full', silver: 'Full', gold: 'Full' },
    { name: 'Active Trading Board Listings', bronze: 'Up to 15', silver: 'Up to 50', gold: 'Unlimited' },
    { name: 'WTB Quotes & Lead Unlocks / Month', bronze: '10 / month', silver: '25 / month', gold: 'Unlimited' },
    { name: 'Direct Member-to-Member Messaging', bronze: 'Yes', silver: 'Yes', gold: 'Yes' },
    { name: 'Official Verified Member Badge', bronze: 'Yes', silver: 'Yes', gold: 'Priority Spotlight' },
    { name: 'Transaction Commission', bronze: '0%', silver: '0%', gold: '0%' },
    { name: 'CSV Catalog & Inventory Upload', bronze: '—', silver: 'Full Access', gold: 'Full Access' },
    { name: 'Automated Niche WTB & Stock Alerts', bronze: '—', silver: 'Yes', gold: 'Instant Real-Time' },
    { name: 'Listing Spotlight on Live Trading Board', bronze: '—', bronzeSub: 'Standard', silver: 'Featured', gold: 'Top 3 Pin & Highlight' },
    { name: 'Business Verification Speed', bronze: 'Standard (1-2 days)', silver: 'Express (12h)', gold: 'Priority (under 4h)' },
    { name: 'Dedicated Trade Account Manager', bronze: '—', silver: 'Email & Ticket', gold: 'Dedicated Desk + Direct Phone' },
  ];

  const faqs = [
    {
      q: 'Do I need separate accounts for buying and selling?',
      a: 'No. Every verified business account on B2B LINK is unified. Once your company is verified by the B2B LINK Verification Team, you can both post sourcing requests (WTBs) and list wholesale inventory for sale from a single dashboard login.',
    },
    {
      q: 'How does the 0% commission model work?',
      a: 'B2B LINK operates on transparent, flat monthly memberships. We take 0% commission on any transactions or contracts you negotiate with other members. You keep 100% of your deal margin.',
    },
    {
      q: 'How are membership fees invoiced and paid?',
      a: 'All invoices are issued by the B2B LINK Membership Team in EUR, GBP, or USD. Subscriptions are billed directly via Wise Business transfer or company credit card with official EU VAT-compliant proforma documentation.',
    },
    {
      q: 'Can I upgrade, downgrade, or cancel at any time?',
      a: 'Yes. You can upgrade immediately to unlock additional listing capacity or lead quotas. Downgrades and cancellations take effect at the end of your current monthly billing period with no penalty fees.',
    },
    {
      q: 'What is required for the Verified Member badge?',
      a: 'To maintain platform safety, companies submit proof of commercial registration (commercial registry excerpt) and VAT/tax number. The B2B LINK Verification Team reviews and approves applications within 1–2 business days.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F3F6FB] pt-24 pb-20">
      {/* Hero Section */}
      <section className="bg-[#0B1F3A] text-white pt-16 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-[#60A5FA] text-[13px] font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNIFIED COMMERCIAL TRADING MEMBERSHIP</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Transparent Plans for European Wholesale Traders
          </h1>
          <p className="mt-4 text-slate-300 max-w-2xl mx-auto text-[15px] sm:text-[17px] leading-relaxed">
            One account for both buying and selling. Enjoy verified member matchmaking, unlimited dealmaking, and 0% platform transaction commission.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[13px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vetted B2B Companies Only
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <Zap className="w-4 h-4 text-blue-400" /> 0% Transaction Fees
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <RefreshCw className="w-4 h-4 text-cyan-400" /> Unified Buy & Sell
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <PricingSection />

      {/* Feature Comparison Matrix */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 mt-12 sm:mt-16">
        <div className="bg-white rounded-[32px] border border-[#CBD5E1] p-6 sm:p-10 shadow-[0_4px_24px_rgba(11,31,58,0.04)]">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] tracking-tight">
              Compare Membership Features
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#64748B] mt-2">
              Everything you need to source inventory and distribute wholesale lots across Europe.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[12px] font-black uppercase tracking-wider text-[#64748B]">
                  <th className="py-4 px-4 w-[40%]">Feature</th>
                  <th className="py-4 px-4 w-[20%] text-center text-[#0B1F3A]">Bronze</th>
                  <th className="py-4 px-4 w-[20%] text-center text-[#0A6CFF] bg-[#EBF3FF] rounded-t-xl">
                    Silver (Popular)
                  </th>
                  <th className="py-4 px-4 w-[20%] text-center text-[#0B1F3A]">Gold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[14px]">
                {comparisonFeatures.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-[#0B1F3A]">{row.name}</td>
                    <td className="py-4 px-4 text-center text-[#64748B] font-medium">{row.bronze}</td>
                    <td className="py-4 px-4 text-center font-extrabold text-[#0A6CFF] bg-[#EBF3FF]/50">
                      {row.silver}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-[#0B1F3A]">{row.gold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 mt-16 sm:mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#0A6CFF] text-[12px] font-bold mb-3 border border-blue-100">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>COMMONLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-[28px] sm:text-[34px] font-black text-[#0B1F3A] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-[14px] sm:text-[15px] text-[#64748B] mt-2">
            Clear, transparent answers about our membership, billing, and verification standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-[24px] border border-[#CBD5E1] p-6 sm:p-7 shadow-xs hover:border-[#0A6CFF]/50 transition"
            >
              <h3 className="text-[16px] sm:text-[17px] font-extrabold text-[#0B1F3A] mb-2.5">
                {faq.q}
              </h3>
              <p className="text-[14px] text-[#64748B] leading-relaxed font-normal">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise Contact CTA */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 mt-16 sm:mt-20">
        <div className="bg-[#0B1F3A] rounded-[32px] p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="max-w-xl">
            <h3 className="text-[24px] sm:text-[30px] font-black tracking-tight leading-tight">
              Have questions or need enterprise procurement volume?
            </h3>
            <p className="mt-2 text-slate-300 text-[14px] sm:text-[15px] leading-relaxed">
              Our B2B LINK Membership Team assists high-volume brokers, distributors, and purchasing syndicates with customized billing terms, API catalog access, and dedicated account onboarding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <a
              href="mailto:membership@b2blink.eu"
              className="px-7 py-3.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14.5px] flex items-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Membership Team</span>
            </a>
            <Link
              href="/register?tier=silver"
              className="px-7 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[14.5px] transition"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
