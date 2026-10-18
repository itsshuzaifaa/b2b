import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Search,
  Users,
  Zap,
  Sparkles,
  Building2,
  Lock,
  FileCheck,
  Check,
  ShieldAlert,
  Percent,
  Cpu,
  Mail,
  MapPin,
  TrendingUp,
  SlidersHorizontal,
  BellRing,
  Headphones,
  FileSpreadsheet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About B2B LINK — Global Wholesale Electronics Trading Platform',
  description:
    'B2B LINK connects verified buyers and sellers in the wholesale electronics market with 42+ years of combined industry experience, 0% commission, and direct trading.',
};

export default function AboutPage() {
  const providedFeatures = [
    {
      title: 'Verified Business Membership',
      description: 'Comprehensive business checks including registry, VAT, and contact validation.',
      icon: ShieldCheck,
      badge: 'Trust & Safety',
    },
    {
      title: 'Live BUY and SELL Listings',
      description: 'Real-time inventory and demand requests posted by verified global traders.',
      icon: TrendingUp,
      badge: 'Live Market',
    },
    {
      title: 'Buyer-Seller Match',
      description: 'Intelligent matching algorithm linking active inventory with targeted procurement requests.',
      icon: Zap,
      badge: 'Core Feature',
    },
    {
      title: 'Multimodal Product Search',
      description: 'Fast, precise queries by category, EAN/UPC barcode, item code, or full description.',
      icon: Search,
      badge: 'Precision',
    },
    {
      title: 'Product Auto-Fill',
      description: 'Automated data completion where reliable catalog and manufacturer data is available.',
      icon: Cpu,
      badge: 'Time-Saver',
    },
    {
      title: 'Direct Member Access',
      description: 'Unfiltered, direct communication with relevant commercial buyers and sellers.',
      icon: Users,
      badge: 'No Middlemen',
    },
    {
      title: 'Saved Searches & Alerts',
      description: 'Instant notification whenever matching electronics stock or buyer requests hit the board.',
      icon: BellRing,
      badge: 'Automation',
    },
    {
      title: 'Dedicated Member Support',
      description: 'Direct assistance from our wholesale desk team to keep your operations moving.',
      icon: Headphones,
      badge: 'Support',
    },
    {
      title: 'Sourcing Assistance',
      description: 'Premium stock discovery and priority sourcing on eligible membership tiers.',
      icon: Sparkles,
      badge: 'Premium Tiers',
    },
    {
      title: 'Professional Reporting Tools',
      description: 'Activity, contact management, and reporting to maintain a high-value network.',
      icon: FileSpreadsheet,
      badge: 'Tools',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Post what you have',
      subtitle: 'Upload active stock lists or single lots with EANs, specs, and volume.',
    },
    {
      number: '02',
      title: 'Post what you need',
      subtitle: 'Publish Want-To-Buy (WTB) procurement requests to verified global distributors.',
    },
    {
      number: '03',
      title: 'Find relevant matches',
      subtitle: 'Background technology matches supply to demand automatically with zero noise.',
    },
    {
      number: '04',
      title: 'Contact the trader',
      subtitle: 'Connect directly with verified decision-makers without gatekeepers.',
    },
    {
      number: '05',
      title: 'Trade directly',
      subtitle: 'Agree on price, shipping, and payment terms directly with 0% platform commission.',
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24 font-sans selection:bg-[#0A6CFF] selection:text-white">
      {/* 
        HERO BANNER WRAPPER
        - Space on sides, top and corners is pure bg-white matching the menu navbar bg perfectly
        - 98% width (1% left padding + 1% right padding = 98% inner width)
        - 1% margin/gap from top
        - 10px minimal border radius on the banner
      */}
      <div className="w-full bg-white pt-[1%] px-[1%]">
        <div className="w-full rounded-[10px] overflow-hidden bg-[#0B1F3A] text-white pt-28 sm:pt-32 pb-14 sm:pb-16 border border-slate-800 shadow-[0_20px_50px_rgba(11,31,58,0.18)] relative">
          {/* Subtle decorative glow overlay */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-radial from-[#0A6CFF]/20 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-radial from-[#00E5FF]/10 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="max-w-3xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#00E5FF] text-[12px] font-bold uppercase tracking-wider mb-4">
                <span className="flex h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse" />
                <span>About B2B LINK</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-extrabold tracking-[-0.025em] text-white leading-tight">
                Wholesale Electronics Trading, Built for Speed &amp; Simplicity
              </h1>

              {/* Document Lead Paragraph */}
              <p className="mt-4 text-[16px] sm:text-[17px] text-slate-300 leading-relaxed font-normal max-w-2xl">
                B2B LINK connects verified buyers and sellers in the wholesale electronics market. Backed by more than 42 years of combined industry experience, our team understands the day-to-day needs of professional traders and has built B2B LINK to make wholesale trading faster, simpler and more efficient.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2.5 bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] px-7 py-3.5 rounded-full shadow-lg shadow-blue-500/25 transition shrink-0"
                >
                  <span>Apply for Membership</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/requests"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-[15px] px-6 py-3.5 rounded-full border border-white/15 transition shrink-0"
                >
                  <span>Browse Buyer Requests</span>
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 text-slate-300 hover:text-white font-medium text-[15px] px-4 py-3.5 transition shrink-0"
                >
                  <span>View Live Marketplace &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Quick Hero Highlights Panel */}
            <div className="lg:w-[380px] shrink-0 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>The B2B LINK Standard</span>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0A6CFF]/20 border border-[#0A6CFF]/40 text-[#00E5FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    42+
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-[15px]">Years Combined Experience</h4>
                    <p className="text-slate-400 text-[13px] leading-snug mt-0.5">
                      Built by seasoned wholesale electronics traders who know the market.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0A6CFF]/20 border border-[#0A6CFF]/40 text-[#00E5FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    0%
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-[15px]">Zero Transaction Commission</h4>
                    <p className="text-slate-400 text-[13px] leading-snug mt-0.5">
                      We never take a cut. All transactions remain direct between members.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0A6CFF]/20 border border-[#0A6CFF]/40 text-[#00E5FF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-[15px]">Verified Members Only</h4>
                    <p className="text-slate-400 text-[13px] leading-snug mt-0.5">
                      Rigorous checks on registration, VAT, company domains, and banking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 text-xs text-slate-400 italic">
                &ldquo;We believe a wholesale trading platform should save time, not create more administration.&rdquo;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-16">
        {/* SECTION 1: OUR GOAL & MISSION CALLOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-white rounded-3xl p-8 sm:p-10 border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.04)] flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0A6CFF] block mb-2">
                Our Core Mission
              </span>
              <h2 className="text-[26px] sm:text-[32px] font-extrabold text-[#0B1F3A] leading-snug">
                Helping businesses connect directly without unnecessary complexity.
              </h2>
              <div className="mt-5 space-y-4 text-[15px] text-[#41536D] leading-relaxed">
                <p>
                  Our goal is simple: help businesses find the right trading partners, share stock or buying requirements, and connect directly without unnecessary complexity.
                </p>
                <p>
                  B2B LINK is designed around the way professional traders actually work. Members can post BUY or SELL requirements, search by category, EAN/UPC, item code or description, receive relevant buyer-seller matches, and contact other members directly.
                </p>
              </div>
            </div>

            <div className="mt-8 p-5 rounded-2xl bg-[#F8FAFD] border border-[#E3E9F2] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <p className="text-[14px] text-[#0B1F3A] font-semibold leading-relaxed">
                We believe a wholesale trading platform should save time, not create more administration.
              </p>
            </div>
          </div>

          {/* BUILT AROUND INDUSTRY EXPERIENCE */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0B1F3A] to-[#122A4E] text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-[0_10px_30px_rgba(11,31,58,0.08)] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#00E5FF] text-[11px] font-bold uppercase tracking-wider mb-4">
                <Building2 className="w-3.5 h-3.5" />
                <span>Industry Foundation</span>
              </div>
              <h3 className="text-[24px] sm:text-[28px] font-bold leading-tight text-white mb-4">
                Built Around Industry Experience
              </h3>
              <p className="text-[14.5px] text-slate-300 leading-relaxed">
                The B2B LINK team brings together more than <strong>42 years of combined experience</strong> in the wholesale electronics industry.
              </p>
              <p className="mt-3.5 text-[14.5px] text-slate-300 leading-relaxed">
                That experience gives us a practical understanding of what matters most to traders: speed, accurate information, reliable contacts and fresh market opportunities. B2B LINK has been built around those principles.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[13.5px] text-[#00E5FF] font-medium leading-relaxed">
                Our aim is not to add unnecessary systems or processes. It is to help buyers and sellers find each other, identify relevant opportunities and move quickly.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: WHAT B2B LINK PROVIDES */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0A6CFF] block mb-2">
              Platform Features
            </span>
            <h2 className="text-[28px] sm:text-[34px] font-extrabold text-[#0B1F3A] tracking-[-0.02em]">
              What B2B LINK Provides
            </h2>
            <p className="mt-2 text-[15px] text-[#5B6B82]">
              Professional tools and capabilities engineered exclusively for electronics wholesale trading.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {providedFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white rounded-2xl p-6 border border-[#EAEFF6] shadow-xs hover:shadow-md hover:border-[#D0E2FF] transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-[#EBF3FF] group-hover:bg-[#0A6CFF] text-[#0A6CFF] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-[#F3F6FB] text-[#5B6B82] px-2.5 py-1 rounded-full border border-[#E3E9F2]">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-bold text-[#0B1F3A] group-hover:text-[#0A6CFF] transition-colors mb-2">
                      {feat.title}
                    </h3>
                    <p className="text-[13.5px] text-[#5B6B82] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#F3F6FB] flex items-center gap-1.5 text-[12px] font-semibold text-[#0A6CFF]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Included in membership</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: SIMPLE BY DESIGN (5-STEP TRADING FLOW) */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.04)]">
          <div className="max-w-3xl mb-10">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0A6CFF] block mb-2">
              Workflow
            </span>
            <h2 className="text-[28px] sm:text-[34px] font-extrabold text-[#0B1F3A] tracking-[-0.02em]">
              Simple by Design
            </h2>
            <p className="mt-2 text-[15px] sm:text-[16px] text-[#41536D] leading-relaxed">
              Professional traders are busy, so B2B LINK is designed to be straightforward and easy to use.
            </p>
          </div>

          {/* 5 Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {steps.map((step, idx) => (
              <div
                key={step.number}
                className="bg-[#F8FAFD] rounded-2xl p-5 border border-[#E3E9F2] relative hover:border-[#0A6CFF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-black text-[#0A6CFF] bg-[#EBF3FF] px-2.5 py-0.5 rounded-md">
                      Step {step.number}
                    </span>
                    {idx < steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-[#BAC7D5] hidden lg:block" />
                    )}
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0B1F3A] mb-1.5">
                    {step.title}
                  </h4>
                  <p className="text-[12.5px] text-[#5B6B82] leading-snug">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Philosophy Bar */}
          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#0B1F3A] to-[#122A4E] text-white flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-[14px] text-slate-300 leading-relaxed">
                Our technology works in the background to improve product information, search and matching while keeping the member experience simple.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-[13px] font-black tracking-wide uppercase shrink-0">
              <Zap className="w-4 h-4 text-[#00E5FF]" />
              <span>Fast to Post. Fast to Match. Fast to Trade.</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: TRUST & VERIFICATION + OUR ROLE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* VERIFIED MEMBERS */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.04)] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0A6CFF] text-[12px] font-bold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-4 h-4" />
                <span>Verification &amp; Due Diligence</span>
              </div>
              <h3 className="text-[24px] sm:text-[28px] font-extrabold text-[#0B1F3A] mb-3">
                Verified Members
              </h3>
              <p className="text-[15px] font-semibold text-[#0B1F3A] mb-3">
                Trust is important in B2B trading.
              </p>
              <p className="text-[14.5px] text-[#41536D] leading-relaxed mb-4">
                Companies are reviewed before receiving Verified Member status. Checks may include:
              </p>

              <div className="space-y-2.5 mb-6">
                {[
                  'Official company registration details & chamber of commerce records',
                  'VAT and tax identification numbers where applicable',
                  'Verified business contact details & authorized personnel',
                  'Corporate email domain and corporate website checks',
                  'Bank account verification & payment origin integrity',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-[13.5px] text-[#41536D]">
                    <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF8EE] border border-[#FFE8C2] text-[#8C5800] text-[13px] leading-relaxed">
              <div className="flex items-center gap-2 font-bold mb-1 text-[#6B4300]">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#E08A00]" />
                <span>Due Diligence Advisory</span>
              </div>
              Verified Member status confirms that B2B LINK has carried out its membership checks. It does not guarantee a company, product or transaction. Members remain responsible for carrying out their own due diligence before entering into any purchase or sale.
            </div>
          </div>

          {/* OUR ROLE & PLATFORM NEUTRALITY */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.04)] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#0B1F3A] text-[12px] font-bold uppercase tracking-wider mb-4">
                <SlidersHorizontal className="w-4 h-4 text-[#0A6CFF]" />
                <span>Platform Governance</span>
              </div>
              <h3 className="text-[24px] sm:text-[28px] font-extrabold text-[#0B1F3A] mb-3">
                Our Role
              </h3>
              <p className="text-[15px] font-semibold text-[#0B1F3A] mb-3">
                B2B LINK is a business membership network and trading platform.
              </p>
              <div className="space-y-3.5 text-[14.5px] text-[#41536D] leading-relaxed">
                <p>
                  We connect buyers and sellers and provide tools that help members identify suitable trading opportunities.
                </p>
                <p>
                  B2B LINK does not act as the buyer or seller in transactions between members and does not handle transaction funds, shipping, logistics or trade documentation.
                </p>
                <p>
                  Once connected, members communicate and trade directly with each other on terms they agree themselves.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-[#F8FAFD] border border-[#E3E9F2]">
              <p className="text-[13.5px] text-[#0B1F3A] font-medium leading-relaxed">
                <strong>Our mandate:</strong> Maintain the network, verify members, improve marketplace data, support members and help identify relevant trading opportunities.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 5: DIRECT TRADING & OUR APPROACH */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* DIRECT TRADING */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-8 sm:p-10 border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.04)] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3FF] border border-[#D0E2FF] text-[#0A6CFF] text-[12px] font-bold uppercase tracking-wider mb-4">
                <Percent className="w-4 h-4" />
                <span>0% Commission Model</span>
              </div>
              <h3 className="text-[24px] sm:text-[28px] font-extrabold text-[#0B1F3A] mb-3">
                Direct Trading
              </h3>
              <div className="space-y-4 text-[15px] text-[#41536D] leading-relaxed">
                <p className="font-semibold text-[#0B1F3A]">
                  B2B LINK does not charge commission on transactions between members.
                </p>
                <p>
                  Buyers and sellers negotiate directly and agree their own price, quantity, payment terms, delivery terms and other commercial conditions.
                </p>
                <p>
                  This keeps the trading relationship where it belongs — directly between buyer and seller.
                </p>
              </div>
            </div>

            <div className="mt-8 p-5 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF]">Transparent Pricing</div>
                <div className="text-[18px] font-bold text-white mt-0.5">Fixed Annual / Monthly Membership</div>
              </div>
              <div className="text-right">
                <div className="text-[24px] font-black text-[#00E5FF]">0%</div>
                <div className="text-[11px] text-slate-300">Cut per deal</div>
              </div>
            </div>
          </div>

          {/* OUR APPROACH & PHILOSOPHY */}
          <div className="lg:col-span-7 bg-[#0B1F3A] text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-[0_10px_30px_rgba(11,31,58,0.08)] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-[#0A6CFF]/20 to-transparent blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#00E5FF] block mb-2">
                Our Approach
              </span>
              <p className="text-[14px] text-slate-400 font-medium">Our philosophy is simple:</p>
              <h3 className="text-[30px] sm:text-[38px] font-extrabold text-white tracking-tight mt-1 mb-5">
                Simple outside. Intelligent inside.
              </h3>

              <div className="space-y-4 text-[15px] text-slate-300 leading-relaxed max-w-xl">
                <p>
                  We use technology to reduce work for traders, not create more of it.
                </p>
                <p>
                  B2B LINK is focused on building a professional, efficient and trusted wholesale network where businesses can find opportunities, make connections and trade directly.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-bold text-white text-[16px]">B2B LINK OÜ</div>
                <div className="text-xs text-slate-400">Tallinn, Republic of Estonia &bull; Registry code EE-10293845</div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/register"
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-5 py-2.5 rounded-full transition shadow-sm"
                >
                  Join the Network
                </Link>
                <Link
                  href="/contact"
                  className="bg-white/10 hover:bg-white/15 text-white font-medium text-[13px] px-5 py-2.5 rounded-full border border-white/15 transition"
                >
                  Contact Desk
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM CALL TO ACTION CARD */}
        <div className="rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#122A4E] to-[#0B1F3A] text-white p-8 sm:p-12 border border-slate-800 shadow-xl text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#00E5FF] block">
              Start Wholesale Trading Today
            </span>
            <h2 className="text-[28px] sm:text-[36px] font-extrabold text-white tracking-tight">
              Ready to Connect with Global Electronics Traders?
            </h2>
            <p className="text-[15px] text-slate-300 leading-relaxed">
              Join verified distributors, retailers, and volume traders worldwide. Post live stock, fulfill WTB requests, and conduct 100% direct business.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] px-8 py-3.5 rounded-full shadow-lg shadow-blue-500/25 transition"
              >
                <span>Create Verified Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/requests"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-[15px] px-7 py-3.5 rounded-full border border-white/15 transition"
              >
                <span>Browse Buyer Demands</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
