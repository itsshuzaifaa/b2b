'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { role, isLoggedIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAuthenticatedNav = mounted && isLoggedIn;

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/site-admin') || pathname.startsWith('/admin')) {
    return null;
  }

  const navLinks = [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Buyer requests', href: '/requests' },
    { label: 'Membership', href: '/#membership' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      {/* Floating 80% Bar attached to top */}
      <div className="w-[94%] sm:w-[88%] lg:w-[80%] max-w-[1160px] h-[64px] bg-white/96 backdrop-blur-md shadow-[0_8px_30px_rgba(11,31,58,0.06)] rounded-t-none rounded-b-[32px] border-b border-x border-[#EAEFF6] px-6 sm:px-8 flex items-center justify-between pointer-events-auto transition-all">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center group select-none">
          <Image
            src="/b2b-link-logo-tight.png"
            alt="B2B LINK OÜ"
            width={140}
            height={42}
            priority
            className="h-8 sm:h-9 w-auto object-contain"
            style={{ width: 'auto' }}
          />
        </Link>

        {/* Center Navigation Links: 15px, weight 500 */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-9">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[15px] font-medium transition-colors ${
                  isActive
                    ? 'text-[#0A6CFF] font-semibold'
                    : 'text-[#41536D] hover:text-[#0B1F3A]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action: Sign in & Create account -> Post a WTB request & Dashboard */}
        <div className="hidden sm:flex items-center gap-6">
          {showAuthenticatedNav ? (
            <>
              <Link
                href="/requests/new"
                className="text-[15px] font-medium text-[#41536D] hover:text-[#0B1F3A] transition-colors whitespace-nowrap"
              >
                Post a WTB request
              </Link>
              <Link
                href={role === 'admin' ? '/site-admin' : '/dashboard'}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[15px] font-bold px-5 py-2 rounded-full transition-colors shadow-xs whitespace-nowrap"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[15px] font-medium text-[#41536D] hover:text-[#0B1F3A] transition-colors whitespace-nowrap"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[15px] font-bold px-5 py-2 rounded-full transition-colors shadow-xs whitespace-nowrap"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full text-[#41536D] hover:text-[#0B1F3A] hover:bg-[#F3F6FB] transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[72px] w-[94%] sm:w-[88%] bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-[#EAEFF6] p-5 space-y-4 animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-medium text-[#41536D] hover:text-[#0A6CFF] py-1 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t border-[#EAEFF6] flex flex-col gap-2.5">
            {showAuthenticatedNav ? (
              <>
                <Link
                  href="/requests/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center border border-[#E3E9F2] text-[#0B1F3A] py-2.5 rounded-full text-[15px] font-medium hover:bg-[#F3F6FB]"
                >
                  Post a WTB request
                </Link>
                <Link
                  href={role === 'admin' ? '/site-admin' : '/dashboard'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center bg-[#0A6CFF] text-white py-2.5 rounded-full text-[15px] font-bold"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center border border-[#E3E9F2] text-[#0B1F3A] py-2.5 rounded-full text-[15px] font-medium hover:bg-[#F3F6FB]"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center bg-[#0A6CFF] text-white py-2.5 rounded-full text-[15px] font-bold"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
