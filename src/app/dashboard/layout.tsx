'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getAdminAccounts } from '@/lib/admin/admin-store';
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
  ShieldAlert,
  Mail,
  Lock,
  RefreshCw,
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
  const rawTier = ((company?.membership_tier || company?.tier || (typeof window !== 'undefined' ? localStorage.getItem('b2b_registered_tier') : null) || 'bronze') as string).toLowerCase();
  const membershipTier = rawTier === 'gold' ? 'GOLD' : rawTier === 'silver' ? 'SILVER' : 'BRONZE';

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

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutGrid },
    { label: 'Marketplace', href: '/marketplace', icon: Store },
    { label: 'Product listings', href: '/dashboard/listings', icon: Package },
    { label: 'WTB Requests', href: '/requests', icon: FileText },
    { label: 'Inquiries & Quotes', href: '/dashboard/inquiries', icon: Inbox },
    { label: 'Billing & Plans', href: '/dashboard/billing', icon: CreditCard },
    { label: 'Edit profile', href: '/dashboard/profile', icon: User },
  ];

  // Check verification & suspension states
  // Crucial: A verified account must NEVER see the restriction popup even for a split second.
  // 1. If auth is still loading or company is not loaded yet, never assume pending verification.
  // 2. Check local admin accounts store to see if this user was approved by admin.
  // 3. If approval_status is 'approved' or user is verified in admin store, never lock.
  const [adminUpdateTrigger, setAdminUpdateTrigger] = useState<number>(0);

  useEffect(() => {
    const handleAdminUpdate = () => setAdminUpdateTrigger((prev) => prev + 1);
    window.addEventListener('b2b_admin_update', handleAdminUpdate);
    window.addEventListener('b2b_account_status_change', handleAdminUpdate);
    return () => {
      window.removeEventListener('b2b_admin_update', handleAdminUpdate);
      window.removeEventListener('b2b_account_status_change', handleAdminUpdate);
    };
  }, []);

  const adminStoreAccount = React.useMemo(() => {
    if (typeof window === 'undefined' || !company) return null;
    try {
      const accounts = getAdminAccounts();
      return (
        accounts.find((a) =>
          (a.id && a.id === company.id) ||
          (a.email && company.email && a.email.toLowerCase() === company.email.toLowerCase())
        ) || null
      );
    } catch {
      return null;
    }
  }, [company, adminUpdateTrigger]);

  const isVerifiedInAdminStore = adminStoreAccount?.approval_status === 'approved';

  const effectiveApprovalStatus = (
    role === 'admin'
      ? 'approved'
      : (adminStoreAccount?.approval_status || company?.approval_status || (isLoading ? 'loading' : 'pending'))
  );

  const isPendingVerification = (
    !isLoading &&
    !!company &&
    role !== 'admin' &&
    !isVerifiedInAdminStore &&
    effectiveApprovalStatus !== 'approved' &&
    (effectiveApprovalStatus === 'pending' || effectiveApprovalStatus === 'pending_verification')
  );

  const isSuspended = (
    !isLoading &&
    !!company &&
    (effectiveApprovalStatus === 'suspended' || effectiveApprovalStatus === 'rejected')
  );

  // Auto-dispatch KYC Document Request email if account is pending verification and not yet dispatched
  useEffect(() => {
    if (company?.email && isPendingVerification) {
      fetch('/api/auth/dispatch-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: company.email }),
      }).catch((err) => {
        console.warn('[DASHBOARD KYC DISPATCH NOTICE]', err);
      });
    }
  }, [company?.email, isPendingVerification]);

  // Lead unlock stats for unified counter
  const [remainingUnlocks, setRemainingUnlocks] = useState<number>(2);
  const [unlockedCount, setUnlockedCount] = useState<number>(0);

  useEffect(() => {
    if (!company) return;
    const updateStats = () => {
      try {
        const raw = localStorage.getItem(`b2b_unlocked_leads_${company.id || 'guest'}`);
        const list = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(list) ? list.length : 0;
        setUnlockedCount(count);

        const currentTier = ((company.membership_tier || company.tier || 'bronze') as string).toLowerCase();
        if (currentTier === 'gold') {
          setRemainingUnlocks(Infinity);
        } else if (currentTier === 'silver') {
          setRemainingUnlocks(Math.max(0, 20 - count));
        } else {
          setRemainingUnlocks(Math.max(0, 2 - count));
        }
      } catch {
        // ignore
      }
    };

    updateStats();
    window.addEventListener('b2b_lead_unlock_update', updateStats);
    window.addEventListener('b2b_billing_update', updateStats);
    return () => {
      window.removeEventListener('b2b_lead_unlock_update', updateStats);
      window.removeEventListener('b2b_billing_update', updateStats);
    };
  }, [company]);

  const maxUnlocks =
    rawTier === 'gold'
      ? Infinity
      : rawTier === 'silver'
      ? 20
      : 2;

  const verificationMailto = 'mailto:newcustomers@b2blink.eu';

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
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#64748B] uppercase px-3 mb-2.5 select-none flex items-center justify-between">
              <span>TRADING PLATFORM</span>
              {isPendingVerification && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                  LOCKED
                </span>
              )}
            </div>
          ) : (
            <div className="w-6 h-[1px] bg-slate-800 mx-auto my-3" />
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const isLockedItem = isPendingVerification && item.href !== '/dashboard' && item.href !== '/dashboard/profile';

              return (
                <Link
                  key={item.href}
                  href={isLockedItem ? '/dashboard' : item.href}
                  className={`w-full flex items-center transition cursor-pointer ${
                    isCollapsed
                      ? 'justify-center w-12 h-12 mx-auto rounded-2xl relative ' +
                        (active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : isLockedItem
                          ? 'text-slate-600 hover:text-slate-400'
                          : 'text-slate-300 hover:text-white hover:bg-white/5')
                      : 'gap-3 px-4 py-3 rounded-2xl font-bold text-[14px] ' +
                        (active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : isLockedItem
                          ? 'text-slate-500 hover:text-slate-400 font-medium'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold')
                  }`}
                  title={isLockedItem ? `${item.label} (Verification Required)` : item.label}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span>{item.label}</span>
                      {isLockedItem && (
                        <span className="text-[10px] text-amber-400/80 font-normal">KYC</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar */}
        <div className="pt-6 border-t border-slate-800/60 mt-6">
          {/* Contact Unlocks Quota Card */}
          {!isCollapsed ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-white">Contact unlocks</span>
                <span className="bg-[#0A6CFF] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {membershipTier}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 font-medium">
                {maxUnlocks === Infinity
                  ? 'Unlimited unlocks active'
                  : `${unlockedCount} of ${maxUnlocks} used (${remainingUnlocks} remaining)`}
              </p>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00E5FF] rounded-full transition-all"
                  style={{
                    width: maxUnlocks === Infinity ? '100%' : `${Math.min(100, (unlockedCount / maxUnlocks) * 100)}%`,
                  }}
                />
              </div>
              {maxUnlocks !== Infinity && remainingUnlocks <= 1 && (
                <Link
                  href="/dashboard/billing"
                  className="block mt-2.5 text-center py-1 text-[11px] font-bold text-[#00E5FF] hover:underline"
                >
                  Upgrade to unlock more &rarr;
                </Link>
              )}
            </div>
          ) : (
            <div
              className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-cyan-400 relative"
              title={`Contact unlocks: ${unlockedCount} used (${membershipTier})`}
            >
              <span className="text-[10px] font-extrabold">{membershipTier[0]}</span>
              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
            </div>
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
        {/* If account is suspended, show suspension banner */}
        {isSuspended ? (
          <div className="py-12 max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <LogOut className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                Account Suspended
              </span>
              <h2 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] mt-3">
                Platform Access Temporarily Suspended
              </h2>
              <p className="text-[14px] text-[#5B6B82] mt-2 leading-relaxed">
                Your B2B LINK account ({companyName}) has been temporarily suspended while we review an account or verification matter. Please contact the B2B LINK Verification Team for further information.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left text-[13px] text-slate-700 space-y-2">
              <div><strong>Account Email:</strong> {company?.email}</div>
              <div><strong>Verification Team:</strong> <a href={verificationMailto} className="text-[#0A6CFF] font-semibold hover:underline">newcustomers@b2blink.eu</a></div>
              <div><strong>Status:</strong> Suspended (Under Review)</div>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <a
                href={verificationMailto}
                className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-6 py-3 rounded-full transition cursor-pointer inline-flex items-center justify-center"
              >
                Contact Verification Team
              </a>
              <button
                type="button"
                onClick={handleSignOut}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] px-6 py-3 rounded-full transition"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          children
        )}

        {/* ========================================================= */}
        {/* NON-CANCELLABLE BLOCKING VERIFICATION MODAL POPUP         */}
        {/* ========================================================= */}
        {isPendingVerification && (
          <div className="fixed inset-0 z-[100] bg-[#050E1D]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
            {/* Modal Card - Uncancellable: No X button, no backdrop click-away */}
            <div
              className="w-full max-w-2xl bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_25px_70px_rgba(11,31,58,0.25)] p-6 sm:p-9 text-[#0B1F3A] my-auto relative space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Status Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Account Status · Pending Verification</span>
                </div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] tracking-tight leading-tight">
                  Business Verification In Progress
                </h2>
                <p className="text-[14px] text-[#5B6B82] max-w-lg mx-auto leading-relaxed">
                  Your email address has been verified, and your account is now awaiting business verification by the B2B LINK Verification Team.
                </p>
              </div>

              {/* Email Notice Card */}
              <div className="bg-[#EBF3FF] border border-[#BFDBFE] rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-[#1E3A8A]">
                <div className="w-10 h-10 rounded-xl bg-[#0A6CFF] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="text-[13px] leading-relaxed">
                  <div className="font-extrabold text-[14px] text-[#0B1F3A] mb-0.5">
                    Verification Team Review
                  </div>
                  <p className="text-[#3B5278]">
                    Our Verification Team checks company registration details, VAT details where applicable, business contact information, company email/domain and bank account information. If additional information or documents are required, we will contact you directly at <strong className="text-[#0B1F3A]">{company?.email}</strong>.
                  </p>
                </div>
              </div>

              {/* Required Documents 2x2 Grid */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                <div className="text-[13px] font-extrabold text-[#0B1F3A] uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#0A6CFF]" />
                  <span>Business Verification Checks</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[11px] font-bold">1</span>
                    <div>
                      <div className="text-[12px] font-bold text-[#0B1F3A]">Company Registration</div>
                      <div className="text-[11px] text-[#5B6B82]">Certificate of Incorporation or official registry extract</div>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[11px] font-bold">2</span>
                    <div>
                      <div className="text-[12px] font-bold text-[#0B1F3A]">VAT / Tax Details</div>
                      <div className="text-[11px] text-[#5B6B82]">National business tax or VAT registration</div>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[11px] font-bold">3</span>
                    <div>
                      <div className="text-[12px] font-bold text-[#0B1F3A]">Business Contact & Domain</div>
                      <div className="text-[11px] text-[#5B6B82]">Corporate website domain and verified trading contact</div>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[11px] font-bold">4</span>
                    <div>
                      <div className="text-[12px] font-bold text-[#0B1F3A]">Bank Account Information</div>
                      <div className="text-[11px] text-[#5B6B82]">Corporate bank details or official statement header</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <a
                  href={verificationMailto}
                  className="w-full sm:w-auto flex-1 min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Contact Verification Team</span>
                </a>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-5 min-h-[46px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh Status</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full sm:w-auto px-4 min-h-[46px] rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
