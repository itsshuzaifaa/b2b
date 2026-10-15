'use client';

import React from 'react';
import Link from 'next/link';

export function PricingSection() {
  const tiers = [
    {
      name: 'Bronze',
      subtitle: 'For traders testing the marketplace.',
      price: 'Free',
      period: '',
      isFeatured: false,
      features: [
        'Up to 15 active listings',
        '10 WTB quotes per month',
        'Direct buyer messaging',
        'Verified seller badge',
      ],
      ctaText: 'Start with Bronze',
      href: '/register?tier=bronze&role=seller',
    },
    {
      name: 'Silver',
      subtitle: 'For active wholesalers moving steady volume.',
      price: '£79',
      period: '/ month',
      isFeatured: true,
      features: [
        'Up to 50 active listings',
        '25 WTB quotes per month',
        'Full CSV catalog upload',
        'Automated niche WTB alerts',
      ],
      ctaText: 'Activate Silver',
      href: '/register?tier=silver&role=seller',
    },
    {
      name: 'Gold',
      subtitle: 'For high-volume distributors and liquidators.',
      price: '£179',
      period: '/ month',
      isFeatured: false,
      features: [
        'Unlimited active listings',
        '50 WTB quotes per month',
        'Hot listing spotlight badge',
        'Priority review within 4 hours',
      ],
      ctaText: 'Activate Gold',
      href: '/register?tier=gold&role=seller',
    },
  ];

  return (
    <section id="membership" className="bg-[#F3F6FB] py-[72px] lg:py-[104px]">
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2.5">
            MEMBERSHIP
          </span>
          <h2 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
            Simple monthly plans. Zero commission.
          </h2>
          <p className="mt-3 text-[15px] text-[#5B6B82]">
            Straightforward pricing for sellers. Commercial buyers always join and trade for free.
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
                      <h3 className="text-[20px] font-bold text-white">
                        {tier.name}
                      </h3>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C2FF] bg-[#00C2FF]/15 px-3 py-1 rounded-full">
                        Recommended
                      </span>
                    </div>

                    {/* Subtitle */}
                    <p className="text-[14px] text-[#D3DEEE] leading-relaxed min-h-[42px]">
                      {tier.subtitle}
                    </p>

                    {/* Price */}
                    <div className="my-8 flex items-baseline gap-2">
                      <span className="text-[48px] font-extrabold text-white leading-none tracking-tight">
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className="text-[15px] font-medium text-[#B7C4D8]">
                          {tier.period}
                        </span>
                      )}
                    </div>

                    {/* 4 Bullets with small cyan dots */}
                    <ul className="space-y-4 mb-10">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-[15px] text-[#D3DEEE]">
                          <span className="w-2 h-2 rounded-full bg-[#00C2FF] shrink-0" />
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

            // Standard Plans: Bronze & Gold (White background, 1.5px border, small blue dots)
            return (
              <div
                key={tier.name}
                className="rounded-[28px] border-[1.5px] border-[#E3E9F2] bg-white text-[#41536D] p-8 lg:p-9 flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div>
                  {/* Tier Name */}
                  <h3 className="text-[20px] font-bold text-[#0B1F3A] mb-2">
                    {tier.name}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-[14px] text-[#5B6B82] leading-relaxed min-h-[42px]">
                    {tier.subtitle}
                  </p>

                  {/* Price */}
                  <div className="my-8 flex items-baseline gap-2">
                    <span className="text-[48px] font-extrabold text-[#0B1F3A] leading-none tracking-tight">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-[15px] font-medium text-[#5B6B82]">
                        {tier.period}
                      </span>
                    )}
                  </div>

                  {/* 4 Bullets with small blue dots */}
                  <ul className="space-y-4 mb-10">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-[15px] text-[#41536D]">
                        <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Button */}
                <Link
                  href={tier.href}
                  className="w-full min-h-[48px] rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] hover:border-[#0B1F3A] text-[#0B1F3A] font-bold text-[15px] flex items-center justify-center transition-colors"
                >
                  {tier.ctaText}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Caption */}
        <p className="mt-12 text-center text-[13px] text-[#5B6B82]">
          Billed directly via Wise Business transfer in GBP, EUR, or USD with verified proforma receipt.
        </p>
      </div>
    </section>
  );
}
