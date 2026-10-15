'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  LayoutGrid,
  Store,
  FileText,
  Inbox,
  Package,
  User,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { company, signOut, role, isLoading } = useAuth();
  const isBuyer = role === 'buyer' || company?.role === 'buyer';

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Restore collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('b2b_seller_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('b2b_seller_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const sellerFullName = company?.contact_name || company?.name || company?.email?.split('@')[0] || (isBuyer ? 'Buyer Account' : 'Seller Account');
  const companyName = isBuyer ? 'Verified Buyer' : (company?.name || 'Seller Enterprise');
  const membershipTier = company?.membership_tier
    ? company.membership_tier.toUpperCase()
    : 'BRONZE';

  // Compute initials
  const initials =
    sellerFullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'EU';

  // Check active link
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const sellerNavItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutGrid },
    { label: 'Marketplace', href: '/dashboard/marketplace', icon: Store },
    { label: 'Quotes', href: '/dashboard/quotes', icon: FileText },
    { label: 'Buyer inquiries', href: '/dashboard/inquiries', icon: Inbox },
    { label: 'Product listings', href: '/dashboard/listings', icon: Package },
    { label: 'Billing & Plans', href: '/dashboard/billing', icon: CreditCard },
    { label: 'Edit profile', href: '/dashboard/profile', icon: User },
  ];

  const buyerNavItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutGrid },
    { label: 'Marketplace', href: '/marketplace', icon: Store },
    { label: 'Inquiries', href: '/dashboard/inquiries', icon: Inbox },
    { label: 'My WTB requests', href: '/dashboard/requests', icon: FileText },
    { label: 'Edit profile', href: '/dashboard/profile', icon: User },
  ];

  const navItems = isBuyer ? buyerNavItems : sellerNavItems;

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#050E1D] text-white flex flex-col md:flex-row p-3 sm:p-4 lg:p-5 gap-4 sm:gap-6 font-sans">
      {/* ========================================================= */}
      {/* SIDEBAR                                                  */}
      {/* ========================================================= */}
      <aside
        className={`shrink-0 h-full flex flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-full md:w-[76px]' : 'w-full md:w-[250px] lg:w-[270px]'
        }`}
      >
        {/* Top of Sidebar */}
        <div>
          {/* Logo Container */}
          <div className="flex items-center justify-between mb-6">
            {!isCollapsed ? (
              <div className="w-full bg-white rounded-2xl py-2.5 px-4 shadow-sm flex items-center justify-between">
                <Link href="/" className="flex items-center">
                  <Image
                    src="/b2b-link-logo-tight.png"
                    alt="B2B LINK"
                    width={120}
                    height={36}
                    priority
                    className="h-7 w-auto object-contain"
                    style={{ width: 'auto' }}
                  />
                </Link>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Collapse sidebar to icons"
                  className="p-1 rounded-lg text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-2">
                <div
                  onClick={toggleSidebar}
                  title="Expand sidebar"
                  className="w-12 h-12 bg-white rounded-2xl p-1.5 shadow-sm flex items-center justify-center cursor-pointer hover:opacity-90 transition"
                >
                  <Image
                    src="/b2b-link-logo-tight.png"
                    alt="B2B LINK"
                    width={38}
                    height={38}
                    className="w-full h-auto object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Expand sidebar"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Section Header */}
          {!isCollapsed ? (
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#64748B] uppercase px-3 mb-2.5 select-none">
              {isBuyer ? 'BUYER MENU' : 'SELLER MENU'}
            </div>
          ) : (
            <div className="w-6 h-[1px] bg-slate-800 mx-auto my-3" />
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center transition cursor-pointer ${
                    isCollapsed
                      ? 'justify-center w-12 h-12 mx-auto rounded-2xl relative ' +
                        (active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/5')
                      : 'gap-3 px-4 py-3 rounded-2xl font-bold text-[14px] ' +
                        (active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold')
                  }`}
                  title={item.label}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                    {isCollapsed && 'badge' in item && (item as any).badge && (
                      <span className="absolute -top-1.5 -right-2 bg-[#00E5FF] text-[#050E1D] text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                        {(item as any).badge}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {'badge' in item && (item as any).badge && (
                        <span className="ml-auto bg-[#00E5FF] text-[#050E1D] text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                          {(item as any).badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar */}
        <div className="pt-6 border-t border-slate-800/60 mt-6">
          {/* Quote Quota Card (Hidden for buyers) */}
          {!isBuyer && (
            !isCollapsed ? (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-bold text-white">Quote quota</span>
                  <span className="bg-[#D97706] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide">
                    {membershipTier}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">
                  2 of 50 used this month
                </p>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0A6CFF] rounded-full w-[4%]" />
                </div>
              </div>
            ) : (
              <div
                className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-amber-400 relative"
                title="Quote quota: 2 of 50 used (GOLD)"
              >
                <span className="text-[10px] font-extrabold">{membershipTier[0]}</span>
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#0A6CFF]" />
              </div>
            )
          )}

          {/* User Profile Info */}
          {!isCollapsed ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full bg-[#0A6CFF] text-white font-extrabold text-[13px] flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                  {company?.website && (company.website.startsWith('http') || company.website.startsWith('data:image')) ? (
                    <Image
                      src={company.website}
                      alt={companyName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-white leading-tight truncate">
                    {sellerFullName}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">
                    {companyName}
                  </div>
                </div>
              </div>

              {/* Red Log out button */}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/25 hover:border-red-600 text-red-400 hover:text-white font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-9 h-9 rounded-full bg-[#0A6CFF] text-white font-extrabold text-[13px] flex items-center justify-center shrink-0 overflow-hidden border border-white/10"
                title={`${sellerFullName} (${companyName})`}
              >
                {company?.website && (company.website.startsWith('http') || company.website.startsWith('data:image')) ? (
                  <Image
                    src={company.website}
                    alt={companyName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Log out"
                className="w-9 h-9 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/25 text-red-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN WHITE CANVAS CONTENT                                */}
      {/* ========================================================= */}
      <main className="flex-1 h-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2.5rem)] bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 lg:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[#0B1F3A] overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
