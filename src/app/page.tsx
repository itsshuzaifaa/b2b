'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LiveTradingBoard } from '@/components/landing/LiveTradingBoard';
import { PricingSection } from '@/components/landing/PricingSection';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. HERO SECTION */}
      <section className="relative text-white pt-36 sm:pt-40 lg:pt-44 pb-20 sm:pb-24 lg:pb-28 overflow-hidden rounded-b-[32px] lg:rounded-b-[56px] shadow-xl">
        {/* Full-width warehouse photo */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-warehouse.jpg"
            alt="European Logistics Warehouse"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Dark Overlay specified: linear-gradient 115deg + bottom fade 180deg */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(115deg, rgba(7,22,44,.94) 0%, rgba(11,31,58,.82) 45%, rgba(10,108,255,.55) 100%), linear-gradient(180deg, rgba(7,22,44,0) 60%, rgba(7,22,44,.85) 100%)',
            }}
          />
        </div>

        {/* Centred Hero Content */}
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8 relative z-10 text-center">
          {/* Eyebrow Label: 13px, weight 700, uppercase, letter-spacing 0.12em, cyan on dark */}
          <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#00C2FF] mb-5">
            EUROPE&apos;S VETTED WHOLESALE NETWORK
          </div>

          {/* H1: 68px / line-height 1.04 (46px under 1000px, 38px on phones), weight 800, letter-spacing -0.025em */}
          <h1 className="text-[38px] md:text-[46px] lg:text-[68px] leading-[1.04] font-extrabold tracking-[-0.025em] text-white max-w-4xl mx-auto">
            The link between businesses.{' '}
            <span className="text-[#00C2FF]">For wholesale.</span>
          </h1>

          {/* Hero Paragraph: 19px */}
          <p className="mt-6 text-[17px] sm:text-[19px] text-[#D3DEEE] leading-relaxed max-w-2xl mx-auto font-normal">
            Browse verified stock lots or post what you need. Deal directly with
            vetted European sellers, with no commission on any trade.
          </p>

          {/* Buttons: Pill shape, min-height 48px, 15px bold. Solid blue & white outline */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/marketplace"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
            >
              Browse listings
            </Link>

            <Link
              href="/requests?create=true"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full border-2 border-white/80 hover:bg-white/10 text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors"
            >
              Post a buyer request
            </Link>
          </div>

          {/* Three Trust Points: Plain white text with a small cyan dot */}
          <div className="mt-14 pt-2 flex flex-wrap items-center justify-center gap-7 sm:gap-10 text-[14px] sm:text-[15px] text-white font-medium">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#00C2FF] inline-block shrink-0" />
              <span>Manually vetted sellers</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#00C2FF] inline-block shrink-0" />
              <span>0% transaction fees</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#00C2FF] inline-block shrink-0" />
              <span>Registered in Estonia (EU)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIVE TRADING BOARD (Soft #F3F6FB Background) */}
      <LiveTradingBoard />

      {/* 3. TWO WAYS IN SECTION (White Background) */}
      <section className="bg-white py-[72px] lg:py-[104px]">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
          {/* Section Header */}
          <div className="mb-12">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2.5">
              TWO WAYS IN
            </span>
            <h2 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
              Whichever side of the trade you&apos;re on
            </h2>
          </div>

          {/* Two Panels: Radius 32px, Padding 56px 48px */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Left Panel: FOR SELLERS (Navy #0B1F3A with white text, blue button) */}
            <div className="bg-[#0B1F3A] text-white rounded-[32px] p-7 sm:p-10 lg:p-[56px_48px] flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#00C2FF] block mb-4">
                  FOR SELLERS
                </span>

                {/* Two-panel H2: 34px / 1.15 */}
                <h3 className="text-[26px] sm:text-[30px] lg:text-[34px] leading-[1.15] font-extrabold text-white tracking-[-0.025em] mb-4">
                  Put your stock in front of real buyers
                </h3>

                <p className="text-[15px] sm:text-[16px] text-[#D3DEEE] leading-relaxed mb-8">
                  List stock lots with MOQ and per-piece pricing, and receive inquiries straight from trade buyers.
                </p>

                {/* Bullets with cyan dots */}
                <ul className="space-y-4 text-[15px] text-[#D3DEEE] mb-10">
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#00C2FF] shrink-0" />
                    <span>Verified seller badge</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#00C2FF] shrink-0" />
                    <span>Direct buyer messaging</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#00C2FF] shrink-0" />
                    <span>Automatic alerts when a request matches your stock</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/register?role=seller"
                  className="w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
                >
                  Register as a seller
                </Link>
              </div>
            </div>

            {/* Right Panel: FOR BUYERS (#F3F6FB with navy button) */}
            <div className="bg-[#F3F6FB] border border-[#E3E9F2] text-[#41536D] rounded-[32px] p-7 sm:p-10 lg:p-[56px_48px] flex flex-col justify-between">
              <div>
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-4">
                  FOR BUYERS
                </span>

                {/* Two-panel H2: 34px / 1.15 */}
                <h3 className="text-[26px] sm:text-[30px] lg:text-[34px] leading-[1.15] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-4">
                  Can&apos;t find it? Let sellers come to you
                </h3>

                <p className="text-[15px] sm:text-[16px] text-[#41536D] leading-relaxed mb-8">
                  Post a want-to-buy request with your target price and quantity. Matching sellers get notified at once.
                </p>

                {/* Bullets with blue dots */}
                <ul className="space-y-4 text-[15px] text-[#41536D] mb-10">
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0" />
                    <span>Free to register as a buyer</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0" />
                    <span>Quotes from vetted sellers only</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0" />
                    <span>No middlemen, no markups</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  href="/requests?create=true"
                  className="w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[#0B1F3A] hover:bg-[#07162C] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
                >
                  Post a WTB request
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MEMBERSHIP SECTION (Soft #F3F6FB Background) */}
      <PricingSection />

      {/* 5. CLOSING CTA BANNER (White Section Background, 80% Width Navy Banner) */}
      <section className="bg-white py-[72px] lg:py-[104px]">
        <div className="w-[92%] sm:w-[85%] lg:w-[80%] max-w-[1160px] mx-auto p-9 sm:p-14 lg:p-16 rounded-[40px] bg-[#0B1F3A] text-white text-center shadow-2xl relative overflow-hidden">
          {/* Centred Headline: Closing CTA H2: 46px (32px on phones), weight 800 */}
          <h2 className="text-[32px] lg:text-[46px] leading-[1.1] font-extrabold text-white tracking-[-0.025em] mb-4">
            Ready to trade directly?
          </h2>

          {/* One line of copy */}
          <p className="text-[15px] sm:text-[16px] text-[#D3DEEE] max-w-xl mx-auto mb-9 leading-relaxed">
            Join the network in minutes. Our desk reviews every seller within 24 hours.
          </p>

          {/* Two Buttons: Solid Blue and White Outline on Dark */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register?role=seller"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
            >
              Register as a seller
            </Link>

            <Link
              href="/requests?create=true"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full border-2 border-white/80 hover:bg-white/10 text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors"
            >
              Post a buyer request
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
