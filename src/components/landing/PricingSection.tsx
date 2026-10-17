'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';

export function PricingSection() {
  const tiers = [
    {
      name: 'Bronze',
      subtitle: 'For verified European businesses testing the board.',
      price: 'Free',
      period: 'forever',
      isFeatured: false,
      badge: 'Standard Access',
      features: [
        'Unified account: Buy & Sell simultaneously',
        'Up to 15 active trading board listings',
        '10 WTB quotes & lead unlocks per month',
        'Direct member-to-member messaging',
        'Official Verified Member badge',
        '0% transaction commission on all deals',
      ],
      ctaText: 'Start Free with Bronze',
      href: '/register?tier=bronze',
    },
    {
      name: 'Silver',
      subtitle: 'For active European wholesalers moving steady volume.',
      price: '£79',
      period: '/ month',
      isFeatured: true,
      badge: 'Recommended',
      features: [
        'Unified account: Buy & Sell simultaneously',
        'Up to 50 active trading board listings',
        '25 WTB quotes & lead unlocks per month',
        'Full CSV catalog & wholesale stock upload',
        'Automated niche WTB & inventory alerts',
        '0% transaction commission on all deals',
      ],
      ctaText: 'Activate Silver',
      href: '/register?tier=silver',
    },
    {
      name: 'Gold',
      subtitle: 'For high-volume distributors and enterprise sourcing desks.',
      price: '£179',
      period: '/ month',
      isFeatured: false,
      badge: 'Enterprise Volume',
      features: [
        'Unified account: Buy & Sell simultaneously',
        'Unlimited active trading board listings',
        'Unlimited WTB quotes & contact unlocks',
        'Live board spotlight & top listing placement',
        'Priority review within 4h & account manager',
        '0% transaction commission on all deals',
      ],
      ctaText: 'Activate Gold',
      href: '/register?tier=gold',
    },
  ];

  return (
    <section id="membership" className="bg-[#F3F6FB] py-[72px] lg:py-[104px]">
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#0A6CFF] text-[13px] font-bold mb-3 border border-blue-100">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNIFIED COMMERCIAL MEMBERSHIP</span>
          </div>
          <h2 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
            Transparent monthly plans. 0% commission.
          </h2>
          <p className="mt-3 text-[15px] sm:text-[16px] text-[#5B6B82] leading-relaxed">
            Every verified business account has full dual capabilities to both source (WTB) and sell wholesale stock. Trade directly with vetted European partners with zero hidden fees.
          </p>
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier) => {
            if (tier.isFeatured) {
              // Silver: Featured Plan (Navy background, white text, cyan bullets, blue button)
              return (
                <div
                  key={tier.name}
                  className="rounded-[28px] border-[1.5px] border-[#0A6CFF] bg-[#0B1F3A] text-white p-8 lg:p-9 flex flex-col justify-between shadow-2xl relative md:-translate-y-2"
                >
                  <div>
                    {/* Tier Name */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[22px] font-bold text-white">
                        {tier.name}
                      </h3>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C2FF] bg-[#00C2FF]/15 px-3 py-1 rounded-full">
                        {tier.badge}
                      </span>
                    </div>

                    {/* Subtitle */}
                    <p className="text-[14px] text-[#D3DEEE] leading-relaxed min-h-[42px]">
                      {tier.subtitle}
                    </p>

                    {/* Price */}
                    <div className="my-7 flex items-baseline gap-2">
                      <span className="text-[48px] font-extrabold text-white leading-none tracking-tight">
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className="text-[15px] font-medium text-[#B7C4D8]">
                          {tier.period}
                        </span>
                      )}
                    </div>

                    {/* Bullets with small cyan dots */}
                    <ul className="space-y-3.5 mb-10">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-[14.5px] text-[#D3DEEE]">
                          <span className="w-2 h-2 rounded-full bg-[#00C2FF] shrink-0 mt-2" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Solid Blue Button */}
                  <Link
                    href={tier.href}
                    className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs"
                  >
                    {tier.ctaText}
                  </Link>
                </div>
              );
            }

            // Standard Plans: Bronze & Gold
            return (
              <div
                key={tier.name}
                className="rounded-[28px] border-[1.5px] border-[#E3E9F2] bg-white text-[#41536D] p-8 lg:p-9 flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div>
                  {/* Tier Name */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[22px] font-bold text-[#0B1F3A]">
                      {tier.name}
                    </h3>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] bg-slate-100 px-3 py-1 rounded-full">
                      {tier.badge}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <p className="text-[14px] text-[#5B6B82] leading-relaxed min-h-[42px]">
                    {tier.subtitle}
                  </p>

                  {/* Price */}
                  <div className="my-7 flex items-baseline gap-2">
                    <span className="text-[48px] font-extrabold text-[#0B1F3A] leading-none tracking-tight">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-[15px] font-medium text-[#5B6B82]">
                        {tier.period}
                      </span>
                    )}
                  </div>

                  {/* Bullets with small blue dots */}
                  <ul className="space-y-3.5 mb-10">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14.5px] text-[#41536D]">
                        <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0 mt-2" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Button */}
                <Link
                  href={tier.href}
                  className="w-full min-h-[48px] rounded-full border border-[#CBD5E1] bg-white hover:bg-[#F3F6FB] hover:border-[#0B1F3A] text-[#0B1F3A] font-bold text-[15px] flex items-center justify-center transition-colors"
                >
                  {tier.ctaText}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Caption */}
        <div className="mt-12 text-center text-[13px] text-[#5B6B82] max-w-xl mx-auto space-y-1">
          <p>
            Official invoices issued by the <strong>B2B LINK Membership Team</strong>. Billed directly via Wise Business transfer in GBP, EUR, or USD with verified proforma receipt.
          </p>
          <p className="text-slate-400">
            Need custom enterprise volume or multi-seat procurement licenses? Contact{' '}
            <a href="mailto:membership@b2blink.eu" className="text-[#0A6CFF] font-medium hover:underline">
              membership@b2blink.eu
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
