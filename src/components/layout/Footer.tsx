'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/site-admin') || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-[#050F1F] text-[#B7C4D8] border-t border-[#0B1F3A]">
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-14">
          {/* Column 1: Brand Info & Tile */}
          <div className="md:col-span-2 space-y-4">
            {/* Logo in a small white rounded tile */}
            <div className="inline-block bg-white rounded-xl p-2.5 shadow-sm">
              <Link href="/" className="block">
                <Image
                  src="/b2b-link-logo-tight.png"
                  alt="B2B LINK OÜ"
                  width={130}
                  height={38}
                  className="h-7 w-auto object-contain"
                  style={{ width: 'auto' }}
                />
              </Link>
            </div>

            <div className="space-y-1.5 text-[13px] text-[#B7C4D8] leading-relaxed max-w-sm pt-1">
              <p className="font-semibold text-white">B2B LINK OÜ</p>
              <p>Registered in the Republic of Estonia. Registry code EE-10293845</p>
              <p>Sepapaja 6, Tallinn 15551, Harjumaa, Estonia</p>
              <p>
                <a
                  href="mailto:jeff@b2blink.com"
                  className="text-[#00C2FF] hover:underline"
                >
                  jeff@b2blink.com
                </a>
              </p>
            </div>
          </div>

          {/* Column 2: Marketplace */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white mb-4">
              Marketplace
            </h5>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <Link href="/marketplace" className="text-[#D3DEEE] hover:text-white transition-colors">
                  Browse listings
                </Link>
              </li>
              <li>
                <Link href="/requests" className="text-[#D3DEEE] hover:text-white transition-colors">
                  Buyer requests
                </Link>
              </li>
              <li>
                <Link href="/#membership" className="text-[#D3DEEE] hover:text-white transition-colors">
                  Membership
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white mb-4">
              Company
            </h5>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <Link href="/#about" className="text-[#D3DEEE] hover:text-white transition-colors">
                  About the network
                </Link>
              </li>
              <li>
                <Link href="/#guidelines" className="text-[#D3DEEE] hover:text-white transition-colors">
                  Vetting standards
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#D3DEEE] hover:text-white transition-colors">
                  Contact desk
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Thin divider above the legal line */}
        <div className="mt-14 pt-8 border-t border-white/10 text-[13px] text-[#5B6B82] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p>
            &copy; 2026 B2B LINK OÜ. Europe&apos;s verified wholesale trading and Want-To-Buy demand network. 0% transaction commission.
          </p>
          <p className="text-[12px] text-[#5B6B82]">
            Parties are responsible for their own due diligence.
          </p>
        </div>
      </div>
    </footer>
  );
}
