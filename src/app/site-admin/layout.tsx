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
  HelpCircle,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function SiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, switchDemoRole } = useAuth();

  // Authentication State for Site Admin (admin@b2blink.co.uk / 12345)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('admin@b2blink.co.uk');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Restore session & collapse preference from localStorage
  useEffect(() => {
    try {
      const auth =
        sessionStorage.getItem('b2b_site_admin_auth') ||
        localStorage.getItem('b2b_site_admin_auth');
      setIsAdminAuthenticated(auth === 'true');

      const saved = localStorage.getItem('b2b_site_admin_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      setIsAdminAuthenticated(false);
    }
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      adminEmail.trim().toLowerCase() === 'admin@b2blink.co.uk' &&
      adminPassword === '12345'
    ) {
      try {
        sessionStorage.setItem('b2b_site_admin_auth', 'true');
        localStorage.setItem('b2b_site_admin_auth', 'true');
      } catch {}
      setIsAdminAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError('Invalid credentials. Use admin@b2blink.co.uk with password 12345.');
    }
  };

  const handleFillDemoAdmin = () => {
    setAdminEmail('admin@b2blink.co.uk');
    setAdminPassword('12345');
    setLoginError(null);
  };

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
    } catch {}
    setIsAdminAuthenticated(false);
    switchDemoRole('guest');
    await signOut();
  };

  // 1. Loading state while checking localStorage session
  if (isAdminAuthenticated === null) {
    return (
      <>
        <div className="min-h-screen bg-[#050E1D] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#0A6CFF] border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="hidden" aria-hidden="true">
          {children}
        </div>
      </>
    );
  }

  // 2. Login Screen Gate for Site Admin
  if (!isAdminAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-[#050E1D] text-white flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0A6CFF]/15 rounded-full blur-[130px] pointer-events-none" />

        <div className="w-full max-w-[440px] relative z-10">
          {/* Logo Card */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center bg-white rounded-2xl py-3 px-6 shadow-xl mb-4">
              <Image
                src="/b2b-link-logo-tight.png"
                alt="B2B LINK"
                width={130}
                height={40}
                priority
                className="h-8 w-auto object-contain"
                style={{ width: 'auto' }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="bg-[#0A6CFF]/20 text-[#00E5FF] text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#0A6CFF]/30 tracking-wider">
                ROOT EXECUTIVE DESK
              </span>
            </div>
            <h1 className="text-[26px] font-black text-white mt-3 tracking-tight">
              Site Administration Login
            </h1>
            <p className="text-[13px] text-slate-400 mt-1 max-w-sm mx-auto">
              Compliance oversight, user account management, and financial settlements.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-[#0B1A30] border border-white/10 rounded-[28px] p-7 sm:p-8 shadow-2xl backdrop-blur-md">
            {loginError && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[12px] font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@b2blink.co.uk"
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Master Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A6CFF] transition font-mono tracking-widest"
                  />
                </div>
              </div>

              {/* Demo Quick Fill Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleFillDemoAdmin}
                  className="text-[12px] font-bold text-[#00E5FF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autofill credentials (admin@b2blink.co.uk / 12345)</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] transition cursor-pointer shadow-lg shadow-[#0A6CFF]/25 flex items-center justify-center gap-2"
                >
                  <span>Sign In to Site-Admin Desk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 text-center">
              <Link
                href="/"
                className="text-[12px] font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Return to Public Marketplace</span>
              </Link>
            </div>
          </div>
        </div>
        </div>
        <div className="hidden" aria-hidden="true">
          {children}
        </div>
      </>
    );
  }

  // 3. Authenticated Full Site Admin Canvas
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
                    admin@b2blink.co.uk
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
                title="Platform Administrator (admin@b2blink.co.uk)"
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
