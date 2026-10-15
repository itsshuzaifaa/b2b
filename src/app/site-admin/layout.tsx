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
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ExternalLink,
  Share2,
  UserCheck,
} from 'lucide-react';

export default function SiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, switchDemoRole } = useAuth();

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

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

  // Requirement 03 & 09: NO badges in screen titles, NO vetting queue
  // Requirement 06: Include 'Edit profile' (personal account only)
  const navItems = [
    { label: 'Overview', href: '/site-admin', icon: LayoutGrid },
    { label: 'Accounts (Buyers & Sellers)', href: '/site-admin/users', icon: Users },
    { label: 'Payment records', href: '/site-admin/payments', icon: CreditCard },
    { label: 'Campaign leads (Email & WA)', href: '/site-admin/campaigns', icon: Share2 },
    { label: 'Listing moderation', href: '/site-admin/listings', icon: ShieldAlert },
    { label: 'Seller messaging', href: '/site-admin/messages', icon: MessageSquare },
    { label: 'Edit profile', href: '/site-admin/profile', icon: UserCheck },
  ];

  const handleExitAdmin = async () => {
    switchDemoRole('guest');
    await signOut();
    router.push('/');
  };

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

          {/* Navigation Links - Clean, NO Badges */}
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
                  </div>
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar */}
        <div className="pt-5 border-t border-slate-800/60 mt-4">
          {/* Requirement 07: Removed "Platform Engine etc." text */}

          {/* Admin User Profile Info */}
          {!isCollapsed ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A6CFF] to-[#00E5FF] text-[#050E1D] font-black text-[13px] flex items-center justify-center shrink-0 shadow-xs">
                  JD
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-white leading-tight truncate">
                    Platform Administrator
                  </div>
                  <div className="text-[11px] text-[#00E5FF] font-semibold leading-tight truncate mt-0.5">
                    admin@b2blink.eu
                  </div>
                </div>
              </div>

              {/* Requirement 08: Fullwidth button for public site above red signout button */}
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
                title="Platform Administrator (admin@b2blink.eu)"
              >
                JD
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
      <main className="flex-1 h-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2.5rem)] bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 lg:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[#0B1F3A] overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
