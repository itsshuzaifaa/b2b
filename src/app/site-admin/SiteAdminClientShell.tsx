'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getUnreadInquiriesCountForAdmin } from '@/lib/messaging/messaging-store';
import {
  LayoutGrid,
  Users,
  CreditCard,
  ShieldAlert,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ExternalLink,
  Share2,
  UserCheck,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';

interface SiteAdminClientShellProps {
  children: React.ReactNode;
  userEmail: string;
}

export function SiteAdminClientShell({ children, userEmail }: SiteAdminClientShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, switchDemoRole } = useAuth();

  // Sidebar collapse state (desktop) & Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState<number>(0);

  // Sync unread admin messages
  useEffect(() => {
    const updateCount = () => {
      setUnreadAdminCount(getUnreadInquiriesCountForAdmin());
    };
    updateCount();
    window.addEventListener('b2b_inquiry_update', updateCount);
    window.addEventListener('storage', updateCount);
    const interval = setInterval(updateCount, 4000);
    return () => {
      window.removeEventListener('b2b_inquiry_update', updateCount);
      window.removeEventListener('storage', updateCount);
      clearInterval(interval);
    };
  }, []);

  // Auto-close mobile drawer on route transition
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Restore collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('b2b_site_admin_sidebar_collapsed');
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
        localStorage.setItem('b2b_site_admin_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/site-admin') {
      return pathname === '/site-admin';
    }
    return pathname.startsWith(href);
  };

  const navItems = [
    { label: 'Overview', href: '/site-admin', icon: LayoutGrid },
    { label: 'Accounts (Buyers & Sellers)', href: '/site-admin/users', icon: Users },
    { label: 'Payment records', href: '/site-admin/payments', icon: CreditCard },
    { label: 'Campaign leads (Email & WA)', href: '/site-admin/campaigns', icon: Share2 },
    { label: 'Customer Queries', href: '/site-admin/queries', icon: HelpCircle },
    { label: 'Listing moderation', href: '/site-admin/listings', icon: ShieldAlert },
    { label: 'Seller messaging', href: '/site-admin/messages', icon: MessageSquare },
    { label: 'Edit profile', href: '/site-admin/profile', icon: UserCheck },
  ];

  const handleExitAdmin = async () => {
    try {
      sessionStorage.removeItem('b2b_site_admin_auth');
      localStorage.removeItem('b2b_site_admin_auth');
    } catch {
      // ignore
    }
    switchDemoRole('guest');
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = (() => {
    const parts = userEmail.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userEmail.slice(0, 2).toUpperCase();
  })();

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#050E1D] text-white flex flex-col md:flex-row p-2 sm:p-4 lg:p-5 gap-2 sm:gap-6 font-sans">
      {/* ========================================================= */}
      {/* MOBILE TOP BAR (< md)                                     */}
      {/* ========================================================= */}
      <div className="md:hidden flex items-center justify-between bg-white rounded-2xl py-2 px-3.5 shadow-sm shrink-0">
        <Link href="/site-admin" className="flex items-center">
          <Image
            src="/b2b-link-logo-tight.png"
            alt="B2B LINK"
            width={110}
            height={32}
            priority
            className="h-6 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
            ROOT DESK
          </span>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open admin navigation menu"
            className="p-1.5 rounded-xl bg-slate-100 text-[#0B1F3A] hover:bg-slate-200 transition cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
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
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.href === '/site-admin/messages' && unreadAdminCount > 0 && (
                        <span className="bg-[#EF4444] text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                          {unreadAdminCount}
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
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-white truncate">Platform Administrator</div>
                  <div className="text-[10.5px] text-slate-400 truncate">{userEmail}</div>
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
                <Link href="/site-admin" className="flex items-center">
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
                    {isCollapsed && item.href === '/site-admin/messages' && unreadAdminCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#EF4444] text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-[#050E1D] shadow-xs animate-pulse">
                        {unreadAdminCount}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {item.href === '/site-admin/messages' && unreadAdminCount > 0 && (
                        <span className="bg-[#EF4444] text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                          {unreadAdminCount}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar */}
        <div className="pt-5 border-t border-slate-800/60 mt-4">
          {/* Admin User Profile Info */}
          {!isCollapsed ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[13px] flex items-center justify-center shrink-0 shadow-xs">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-white leading-tight truncate">
                    Platform Administrator
                  </div>
                  <div className="text-[11px] text-[#00E5FF] font-semibold leading-tight truncate mt-0.5">
                    {userEmail}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Link
                  href="/"
                  target="_blank"
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Public website</span>
                </Link>

                <button
                  type="button"
                  onClick={handleExitAdmin}
                  className="w-full py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/25 hover:border-red-600 text-red-400 hover:text-white font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[13px] flex items-center justify-center shrink-0"
                title={`Platform Administrator (${userEmail})`}
              >
                {initials}
              </div>
              <Link
                href="/"
                target="_blank"
                title="Public website"
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#00E5FF]" />
              </Link>
              <button
                type="button"
                onClick={handleExitAdmin}
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
      <main className="flex-1 w-full min-h-0 h-full max-h-[calc(100dvh-4.5rem)] md:max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2.5rem)] bg-white rounded-[22px] sm:rounded-[32px] md:rounded-[36px] p-4 sm:p-6 md:p-8 lg:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[#0B1F3A] overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        {children}
      </main>
    </div>
  );
}
