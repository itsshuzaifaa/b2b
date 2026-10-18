'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  LayoutGrid,
  Users,
  CreditCard,
  ShieldAlert,
  MessageSquare,
  FileCheck2,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Shield,
  ExternalLink,
  Share2,
  Menu,
  X,
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, switchDemoRole } = useAuth();

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Restore collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('b2b_admin_sidebar_collapsed');
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
        localStorage.setItem('b2b_admin_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutGrid },
    { label: 'Accounts (Buyers & Sellers)', href: '/admin/users', icon: Users, badge: '9' },
    { label: 'Campaign leads (Email & WA)', href: '/admin/campaigns', icon: Share2, badge: 'Leads' },
    { label: 'Payment records', href: '/admin/payments', icon: CreditCard, badge: 'Wise' },
    { label: 'Listing moderation', href: '/admin/listings', icon: ShieldAlert },
    { label: 'Seller messaging', href: '/admin/messages', icon: MessageSquare, badge: 'Live' },
    { label: 'Vetting queue', href: '/admin/vetting', icon: FileCheck2 },
  ];

  const handleExitAdmin = async () => {
    switchDemoRole('guest');
    await signOut();
    router.push('/');
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#050E1D] text-white flex flex-col md:flex-row p-2 sm:p-4 lg:p-5 gap-2 sm:gap-6 font-sans">
      {/* ========================================================= */}
      {/* MOBILE TOP BAR (Visible only on < md screens)            */}
      {/* ========================================================= */}
      <div className="md:hidden flex items-center justify-between bg-[#0B1528] border border-white/10 rounded-2xl px-3.5 py-2.5 shrink-0 z-20 shadow-md">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="bg-white rounded-xl py-1 px-2.5 flex items-center">
            <Image
              src="/b2b-link-logo-tight.png"
              alt="B2B LINK"
              width={86}
              height={24}
              priority
              className="h-5 w-auto object-contain"
            />
          </div>
          <span className="bg-[#0A6CFF]/20 text-[#00E5FF] text-[9.5px] font-extrabold px-2 py-0.5 rounded-md border border-[#0A6CFF]/30 tracking-wider">
            ADMIN DESK
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition cursor-pointer"
          aria-label="Open Admin Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ========================================================= */}
      {/* MOBILE SLIDE-OUT DRAWER                                   */}
      {/* ========================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-[280px] max-w-[85vw] h-full bg-[#050E1D] text-white p-4 flex flex-col justify-between overflow-y-auto z-10 shadow-2xl animate-in slide-in-from-left duration-250">
            <div>
              {/* Header with Logo and Close Button */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="bg-white rounded-xl py-1.5 px-3">
                  <Image
                    src="/b2b-link-logo-tight.png"
                    alt="B2B LINK"
                    width={100}
                    height={28}
                    className="h-5 w-auto object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between px-2 mb-2 select-none">
                <span className="text-[11px] font-bold tracking-[0.14em] text-[#64748B] uppercase">
                  ADMIN CONTROL
                </span>
                <span className="bg-[#0A6CFF]/20 text-[#00E5FF] text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-[#0A6CFF]/30">
                  ROOT
                </span>
              </div>

              {/* Navigation links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-[13.5px] transition ${
                        active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto bg-[#00E5FF] text-[#050E1D] text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Bottom info & Actions */}
            <div className="pt-4 border-t border-slate-800 mt-4 space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[12px] flex items-center justify-center shrink-0">
                  JV
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-white truncate">Jeff Vetting Director</div>
                  <div className="text-[10.5px] text-slate-400 truncate">Platform Administrator</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  target="_blank"
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 text-center font-bold text-[11px] transition"
                >
                  Public Site
                </Link>
                <button
                  type="button"
                  onClick={handleExitAdmin}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/25 text-red-400 hover:text-white font-bold text-[11px] transition cursor-pointer"
                >
                  Exit Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR                                           */}
      {/* ========================================================= */}
      <aside
        className={`hidden md:flex shrink-0 h-full flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:w-[76px]' : 'md:w-[250px] lg:w-[270px]'
        }`}
      >
        {/* Top of Sidebar */}
        <div>
          {/* Logo Container */}
          <div className="flex items-center justify-between mb-6">
            {!isCollapsed ? (
              <div className="w-full bg-white rounded-2xl py-2.5 px-4 shadow-sm flex items-center justify-between">
                <Link href="/admin" className="flex items-center">
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
            <div className="flex items-center justify-between px-3 mb-2.5 select-none">
              <span className="text-[11px] font-bold tracking-[0.14em] text-[#64748B] uppercase">
                ADMIN CONTROL
              </span>
              <span className="bg-[#0A6CFF]/20 text-[#00E5FF] text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-[#0A6CFF]/30">
                ROOT DESK
              </span>
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
                    {isCollapsed && item.badge && (
                      <span className="absolute -top-1.5 -right-2 bg-[#00E5FF] text-[#050E1D] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto bg-[#00E5FF] text-[#050E1D] text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                          {item.badge}
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
          {/* Quick Platform Status */}
          {!isCollapsed ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Platform Engine</span>
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase">
                  Healthy
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                0% Transaction Fee Policy Active
              </p>
            </div>
          ) : (
            <div
              className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-emerald-400"
              title="Platform Engine: Healthy"
            >
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          )}

          {/* Admin User Profile Info */}
          {!isCollapsed ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[13px] flex items-center justify-center shrink-0 shadow-xs">
                  JV
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-white leading-tight truncate">
                    Jeff Vetting Director
                  </div>
                  <div className="text-[11px] text-[#00E5FF] font-semibold leading-tight truncate mt-0.5">
                    Platform Administrator
                  </div>
                </div>
              </div>

              {/* Log out / Switch role */}
              <div className="flex items-center justify-between mt-3 px-1 text-[12px] font-medium text-slate-400">
                <button
                  type="button"
                  onClick={handleExitAdmin}
                  className="hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
                <Link
                  href="/"
                  className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                  target="_blank"
                >
                  <span>Public site</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[13px] flex items-center justify-center shrink-0"
                title="Jeff Vetting Director (Platform Administrator)"
              >
                JV
              </div>
              <button
                type="button"
                onClick={handleExitAdmin}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
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
      <main className="flex-1 h-full max-h-[calc(100dvh-4.5rem)] md:max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] lg:max-h-[calc(100dvh-2.5rem)] bg-white rounded-[22px] sm:rounded-[32px] md:rounded-[36px] p-4 sm:p-6 md:p-8 lg:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[#0B1F3A] overflow-y-auto overflow-x-hidden min-w-0">
        {children}
      </main>
    </div>
  );
}
