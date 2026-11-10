'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { isAccountDeleted } from '@/lib/admin/admin-store';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import type { Company, ApprovalStatus } from '@/types/database';
import { getUnreadInquiriesCountForUser, syncWithSupabase } from '@/lib/messaging/messaging-store';
import { WelcomeModal } from '@/components/modals/WelcomeModal';
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
  Menu,
  X,
  Zap,
} from 'lucide-react';

function PendingVerificationScreen({
  company,
  onRefresh,
  isChecking,
  onSignOut,
}: {
  company: Company;
  onRefresh: () => void;
  isChecking: boolean;
  onSignOut: () => void;
}) {
  const companyName = company.name || company.company_name || 'Your Company';
  const mailto = `mailto:newcustomers@b2blink.eu?subject=${encodeURIComponent(
    `Verification Inquiry - ${companyName} (${company.email}) - B2B LINK`
  )}`;

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto space-y-6 animate-fade-in text-[#0B1F3A]">
      {/* Top Status Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5 text-amber-600" />
          <span>Account Status · Pending Business Verification</span>
        </div>
        <h2 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] tracking-tight leading-tight">
          Business Verification In Progress
        </h2>
        <p className="text-[14px] text-[#5B6B82] max-w-lg mx-auto leading-relaxed">
          Your email has been verified. The B2B LINK Verification Team is currently reviewing your company registration and wholesale credentials.
        </p>
      </div>

      {/* Live Polling Status Banner */}
      <div className="bg-[#EBF3FF] border border-[#BFDBFE] rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-[#1E3A8A]">
        <div className="w-10 h-10 rounded-xl bg-[#0A6CFF] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
        </div>
        <div className="text-[13px] leading-relaxed">
          <div className="font-extrabold text-[14px] text-[#0B1F3A] mb-0.5 flex items-center gap-2">
            <span>Automatic Live Verification Active</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[#3B5278]">
            We check your approval status automatically every 25 seconds and whenever you return to this window. As soon as compliance approves your account, your dashboard will unlock immediately without any manual page reload.
          </p>
        </div>
      </div>

      {/* Required Checks 2x2 Grid */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6">
        <div className="text-[13px] font-extrabold text-[#0B1F3A] uppercase tracking-wide mb-3.5 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0A6CFF]" />
          <span>Standard Business Verification Checks</span>
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
          href={mailto}
          className="w-full sm:w-auto flex-1 min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
        >
          <Mail className="w-4 h-4" />
          <span>Contact Verification Team</span>
        </a>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isChecking}
          className="w-full sm:w-auto px-5 min-h-[46px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-[#0A6CFF]' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Check Status Now'}</span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full sm:w-auto px-4 min-h-[46px] rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}

function RejectedVerificationScreen({
  company,
  onRefresh,
  isChecking,
  onSignOut,
}: {
  company: Company;
  onRefresh: () => void;
  isChecking: boolean;
  onSignOut: () => void;
}) {
  const companyName = company.name || company.company_name || 'Your Company';
  const reason = company.rejection_reason || 'Application did not meet official business verification criteria.';
  const appealMailto = `mailto:compliance@b2blink.eu?subject=${encodeURIComponent(
    `Appeal Verification Decision - ${companyName} (${company.email})`
  )}&body=${encodeURIComponent(
    `Dear B2B LINK Compliance Team,\n\nI would like to appeal the verification decision for our account:\n\nCompany Name: ${companyName}\nRegistered Email: ${company.email}\nReason Provided: ${reason}\n\nAttached please find our official business documentation:\n- [Certificate of Incorporation / Registry Extract]\n- [VAT / Tax Registration Certificate]\n- [Proof of Operating Address]\n\nThank you,\n${company.contact_name || 'Representative'}`
  )}`;

  return (
    <div className="py-6 sm:py-10 max-w-2xl mx-auto space-y-6 animate-fade-in text-[#0B1F3A]">
      {/* Top Status Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-300 text-rose-700 text-[11px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
          <X className="w-3.5 h-3.5 text-rose-600" />
          <span>Account Status · Application Declined</span>
        </div>
        <h2 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] tracking-tight leading-tight">
          Business Verification Declined
        </h2>
        <p className="text-[14px] text-[#5B6B82] max-w-lg mx-auto leading-relaxed">
          Following compliance review, your business registration could not be verified for active platform trading at this time.
        </p>
      </div>

      {/* Decision Reason Card */}
      <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 space-y-2 text-left">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
          Reason for Decision
        </div>
        <div className="text-[14px] font-semibold text-[#0B1F3A] leading-relaxed">
          &ldquo;{reason}&rdquo;
        </div>
      </div>

      {/* How to Appeal Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-left text-[13px] text-slate-700">
        <div className="font-extrabold text-[14px] text-[#0B1F3A]">
          How to Appeal This Decision
        </div>
        <p className="text-[#5B6B82] leading-relaxed">
          If you believe this decision was reached in error or you have updated documentation to submit, you can file an appeal directly to our compliance department:
        </p>
        <div className="space-y-1.5 text-[12px] pt-1">
          <div><strong>1.</strong> Review the specific reason cited above.</div>
          <div><strong>2.</strong> Gather your official registry extract, VAT registration, or operating address proof.</div>
          <div><strong>3.</strong> Click below to draft an appeal email with your supporting documents attached.</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <a
          href={appealMailto}
          className="w-full sm:w-auto flex-1 min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
        >
          <Mail className="w-4 h-4" />
          <span>Submit Appeal by Email</span>
        </a>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isChecking}
          className="w-full sm:w-auto px-5 min-h-[46px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-[#0A6CFF]' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Check Status'}</span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full sm:w-auto px-4 min-h-[46px] rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}

function SuspendedAccountScreen({
  company,
  onRefresh,
  isChecking,
  onSignOut,
}: {
  company: Company;
  onRefresh: () => void;
  isChecking: boolean;
  onSignOut: () => void;
}) {
  const companyName = company.name || company.company_name || 'Your Company';
  const reason = company.rejection_reason || 'Account suspended by compliance officer.';
  const complianceMailto = `mailto:compliance@b2blink.eu?subject=${encodeURIComponent(
    `Suspension Inquiry - ${companyName} (${company.email}) - B2B LINK`
  )}`;

  return (
    <div className="py-6 sm:py-12 max-w-2xl mx-auto text-center space-y-6 animate-fade-in text-[#0B1F3A]">
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
        <LogOut className="w-8 h-8" />
      </div>
      <div>
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
          Account Suspended
        </span>
        <h2 className="text-[26px] sm:text-[32px] font-black text-[#0B1F3A] mt-3">
          Platform Access Temporarily Suspended
        </h2>
        <p className="text-[14px] text-[#5B6B82] mt-2 leading-relaxed max-w-lg mx-auto">
          Your B2B LINK account ({companyName}) has been temporarily suspended while compliance reviews an account or verification matter.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left text-[13px] text-slate-700 space-y-2">
        <div><strong>Account:</strong> {companyName}</div>
        <div><strong>Email:</strong> {company.email}</div>
        <div><strong>Reason:</strong> {reason}</div>
        <div><strong>Compliance Contact:</strong> <a href={complianceMailto} className="text-[#0A6CFF] font-semibold hover:underline">compliance@b2blink.eu</a></div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <a
          href={complianceMailto}
          className="w-full sm:w-auto bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] px-6 py-3 rounded-full transition cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          <span>Contact Compliance Team</span>
        </a>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isChecking}
          className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-[#0A6CFF]' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Check Status'}</span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] px-6 py-3 rounded-full transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { company, signOut, role, isLoading, refreshProfile } = useAuth();
  const isBuyer = role === 'buyer' || company?.role === 'buyer';

  // Client mounting state to prevent hydration mismatches with cached profiles
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState<boolean>(false);

  // Sidebar collapse state (desktop) & Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [matchesCount, setMatchesCount] = useState<number>(0);
  const [unreadInquiriesCount, setUnreadInquiriesCount] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If user is completely unauthenticated on dashboard, redirect to login cleanly after grace period
  useEffect(() => {
    if (!isLoading && !company && isMounted) {
      // Check if there's cached company data in localStorage before forcing redirect
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('b2b_cached_company');
        if (cached) return;
      }
      const timer = setTimeout(() => {
        router.push('/login');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, company, isMounted, router]);

  const handleRefreshVerificationStatus = async () => {
    setIsCheckingVerification(true);
    try {
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.company) {
          await refreshProfile();
          if (data.company.approval_status === 'approved') {
            sessionStorage.setItem('b2b_just_verified', 'true');
            sessionStorage.setItem('b2b_show_onboarding', 'true');
            window.dispatchEvent(new Event('b2b_trade_matches_updated'));
            window.dispatchEvent(new Event('b2b_inquiry_update'));
            setIsCheckingVerification(false);
            return;
          }
        }
      }
      await refreshProfile();
    } catch {
      await refreshProfile();
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Sync real-time unread inquiries count
  useEffect(() => {
    const updateUnread = () => {
      if (company) {
        const count = getUnreadInquiriesCountForUser(company);
        setUnreadInquiriesCount(count);
      }
    };

    updateUnread();
    window.addEventListener('b2b_inquiry_update', updateUnread);
    window.addEventListener('storage', updateUnread);

    // Light background sync every 5 seconds to catch counterparty & admin messages
    const interval = setInterval(() => {
      if (company) {
        void syncWithSupabase(
          role || undefined,
          company.id,
          company.email,
          company.membership_tier || company.tier || 'bronze',
          company.created_at
        ).then(() => {
          updateUnread();
        });
      }
    }, 5000);

    return () => {
      window.removeEventListener('b2b_inquiry_update', updateUnread);
      window.removeEventListener('storage', updateUnread);
      clearInterval(interval);
    };
  }, [company, role]);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

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
  const rawTier = ((company?.membership_tier || company?.tier || 'bronze') as string).toLowerCase();
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
    { label: 'Matching stock', href: '/dashboard/matches', icon: Zap },
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

  // Sync smart matches count
  useEffect(() => {
    const checkMatches = () => {
      if (!company) return;
      const params = new URLSearchParams();
      if (company.id) params.set('companyId', company.id);
      if (company.email) params.set('email', company.email);
      fetch(`/api/matches?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.matches)) {
            setMatchesCount(d.matches.length);
          }
        })
        .catch(() => {});
    };
    checkMatches();
    window.addEventListener('b2b_trade_matches_updated', checkMatches);
    return () => window.removeEventListener('b2b_trade_matches_updated', checkMatches);
  }, [company?.id, company?.email]);

  // Authoritative single source of truth: companies.approval_status
  const approvalStatus: ApprovalStatus = role === 'admin' ? 'approved' : (company?.approval_status || 'pending');
  const isApproved = approvalStatus === 'approved';
  const isPending = approvalStatus === 'pending';
  const isRejected = approvalStatus === 'rejected';
  const isSuspended = approvalStatus === 'suspended';

  // Polling while status is pending (every 25s), or rejected/suspended (every 60s), and on window focus.
  // When it becomes approved, unlocks the user and refreshes data automatically with no manual reload.
  // Stop polling once approved.
  useEffect(() => {
    if (!company || role === 'admin' || company.approval_status === 'approved') {
      return;
    }

    let isMounted = true;
    const currentStatus = company.approval_status;
    const pollIntervalMs = currentStatus === 'pending' ? 25000 : 60000;

    const pollStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.authenticated && data.company) {
          const newStatus: ApprovalStatus = data.company.approval_status;
          if (newStatus !== currentStatus) {
            await refreshProfile();
            if (newStatus === 'approved') {
              sessionStorage.setItem('b2b_just_verified', 'true');
              sessionStorage.setItem('b2b_show_onboarding', 'true');
            }
            window.dispatchEvent(new Event('b2b_trade_matches_updated'));
            window.dispatchEvent(new Event('b2b_inquiry_update'));
            window.dispatchEvent(new Event('b2b_company_updated'));
          }
        }
      } catch (err) {
        console.warn('[VERIFICATION POLL NOTICE]', err);
      }
    };

    // Auto poll at appropriate interval (25s for pending, 60s for rejected/suspended)
    const intervalId = setInterval(pollStatus, pollIntervalMs);

    // Poll on window focus
    const handleFocus = () => {
      void pollStatus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [company?.approval_status, company?.id, role, refreshProfile]);

  // Auto-dispatch KYC Document Request email if account is pending verification and not yet dispatched
  useEffect(() => {
    if (company?.email && isPending) {
      fetch('/api/auth/dispatch-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: company.email }),
      }).catch((err) => {
        console.warn('[DASHBOARD KYC DISPATCH NOTICE]', err);
      });
    }
  }, [company?.email, isPending]);

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

  const targetCompanyName = company?.name || company?.company_name || '';
  const verificationMailto = `mailto:newcustomers@b2blink.eu?subject=${encodeURIComponent(
    `Action Required: Submit verification documents to activate your account${targetCompanyName ? ` - ${targetCompanyName}` : ''} - B2B LINK`
  )}`;

  // Gate state: show a skeleton while loading, never the dashboard or the modal until /api/auth/me returns, so there is no flash
  if (isLoading || !company) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#050E1D] text-white flex flex-col md:flex-row p-2 sm:p-4 lg:p-5 gap-2 sm:gap-6 font-sans">
      {/* ========================================================= */}
      {/* MOBILE TOP BAR (< md)                                     */}
      {/* ========================================================= */}
      <div className="md:hidden flex items-center justify-between bg-white rounded-2xl py-2 px-3.5 shadow-sm shrink-0">
        <Link href="/dashboard" className="flex items-center">
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
          {/* Quick Messages Bell/Inbox on Mobile Header with WhatsApp-style Red Badge */}
          <Link
            href="/dashboard/inquiries"
            aria-label="Messages & Inquiries"
            className="relative p-1.5 rounded-xl bg-slate-100 text-[#0B1F3A] hover:bg-slate-200 transition cursor-pointer flex items-center justify-center"
          >
            <Inbox className="w-5 h-5 text-[#0B1F3A]" />
            {unreadInquiriesCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[9px] font-black min-w-[17px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
                {unreadInquiriesCount}
              </span>
            )}
          </Link>
          <span suppressHydrationWarning className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#0A6CFF]/10 text-[#0A6CFF] border border-[#0A6CFF]/20">
            {membershipTier}
          </span>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
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

              <div className="text-[11px] font-bold tracking-[0.14em] text-[#64748B] uppercase px-2 mb-2 select-none flex items-center justify-between">
                <span>TRADING PLATFORM</span>
                {!isApproved && (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                    LOCKED
                  </span>
                )}
              </div>

              {/* Navigation links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const isLockedItem = !isApproved && item.href !== '/dashboard' && item.href !== '/dashboard/profile';

                  return (
                    <Link
                      key={item.href}
                      href={isLockedItem ? '/dashboard' : item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-[13.5px] transition ${
                        active
                          ? 'bg-[#0A6CFF] text-white shadow-sm'
                          : isLockedItem
                          ? 'text-slate-500 hover:text-slate-400'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {(item.href === '/dashboard' || item.href === '/dashboard/matches') && matchesCount > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center animate-pulse">
                          {matchesCount}
                        </span>
                      )}
                      {item.href === '/dashboard/inquiries' && unreadInquiriesCount > 0 && (
                        <span className="bg-[#EF4444] text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                          {unreadInquiriesCount}
                        </span>
                      )}
                      {isLockedItem && (
                        <span className="text-[9px] text-amber-400/80 font-normal">KYC</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Bottom info & Logout */}
            <div className="pt-4 border-t border-slate-800 mt-4 space-y-3">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>Contact unlocks</span>
                  <span suppressHydrationWarning className="bg-[#0A6CFF] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                    {membershipTier}
                  </span>
                </div>
                <p suppressHydrationWarning className="text-[10.5px] text-slate-400">
                  {maxUnlocks === Infinity ? 'Unlimited unlocks' : `${unlockedCount} of ${maxUnlocks} used`}
                </p>
              </div>

              <div className="flex items-center gap-2.5 px-1">
                <div className="w-8 h-8 rounded-full bg-[#0A6CFF] text-white font-extrabold text-[12px] flex items-center justify-center shrink-0">
                  <span suppressHydrationWarning>{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div suppressHydrationWarning className="text-[12px] font-bold text-white truncate">{sellerFullName}</div>
                  <div suppressHydrationWarning className="text-[10.5px] text-slate-400 truncate">{companyName}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/25 text-red-400 hover:text-white font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
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
              {!isApproved && (
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
              const isLockedItem = !isApproved && item.href !== '/dashboard' && item.href !== '/dashboard/profile';

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
                    {isCollapsed && (item.href === '/dashboard' || item.href === '/dashboard/matches') && matchesCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#050E1D] animate-pulse" />
                    )}
                    {isCollapsed && item.href === '/dashboard/inquiries' && unreadInquiriesCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#EF4444] text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-[#050E1D] shadow-xs animate-pulse">
                        {unreadInquiriesCount}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span>{item.label}</span>
                      {(item.href === '/dashboard' || item.href === '/dashboard/matches') && matchesCount > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center animate-pulse">
                          {matchesCount}
                        </span>
                      )}
                      {item.href === '/dashboard/inquiries' && unreadInquiriesCount > 0 && (
                        <span className="bg-[#EF4444] text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                          {unreadInquiriesCount}
                        </span>
                      )}
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
                <span suppressHydrationWarning className="bg-[#0A6CFF] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {membershipTier}
                </span>
              </div>
              <p suppressHydrationWarning className="text-[11px] text-slate-400 mb-2 font-medium">
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
              <span suppressHydrationWarning className="text-[10px] font-extrabold">{membershipTier[0]}</span>
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
                    <span suppressHydrationWarning>{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div suppressHydrationWarning className="text-[13px] font-bold text-white leading-tight truncate">
                    {sellerFullName}
                  </div>
                  <div suppressHydrationWarning className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">
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
                  <span suppressHydrationWarning>{initials}</span>
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
      <main className="flex-1 w-full min-h-0 h-full max-h-[calc(100dvh-4.5rem)] md:max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2.5rem)] bg-white rounded-[22px] sm:rounded-[32px] md:rounded-[36px] p-4 sm:p-6 md:p-8 lg:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[#0B1F3A] overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        {isApproved ? (
          children
        ) : isPending ? (
          <PendingVerificationScreen
            company={company}
            onRefresh={handleRefreshVerificationStatus}
            isChecking={isCheckingVerification}
            onSignOut={handleSignOut}
          />
        ) : isRejected ? (
          <RejectedVerificationScreen
            company={company}
            onRefresh={handleRefreshVerificationStatus}
            isChecking={isCheckingVerification}
            onSignOut={handleSignOut}
          />
        ) : (
          <SuspendedAccountScreen
            company={company}
            onRefresh={handleRefreshVerificationStatus}
            isChecking={isCheckingVerification}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Onboarding Feature Tour Modal (Only opens after account is confirmed verified and loading into dashboard) */}
      {isApproved && (
        <WelcomeModal
          buyerName={sellerFullName}
          buyerEmail={company?.email || ''}
          companyId={company?.id}
          role={company?.role}
          isVerified={isApproved}
        />
      )}
    </div>
  );
}
