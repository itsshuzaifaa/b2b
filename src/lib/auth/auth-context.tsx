'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MOCK_COMPANIES } from '@/lib/mock-data';
import { getAdminAccounts } from '@/lib/admin/admin-store';
import type { Company, UserRole, MembershipTier, ApprovalStatus } from '@/types/database';

export type DemoRoleType = 'guest' | 'buyer' | 'seller' | 'seller_pending' | 'seller_approved' | 'admin';

interface AuthContextType {
  company: Company | null;
  role: UserRole | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  demoRole: DemoRoleType;
  switchDemoRole: (role: DemoRoleType) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updatedData: Partial<Company>) => Promise<void>;
  setAuthenticatedUser: (user: any) => void;
}

const AuthContext = createContext<AuthContextType>({
  company: null,
  role: null,
  isLoggedIn: false,
  isLoading: true,
  demoRole: 'guest',
  switchDemoRole: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: async () => {},
  setAuthenticatedUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('b2b_cached_company');
        if (cached) {
          const parsed = JSON.parse(cached);
          try {
            const accounts = getAdminAccounts();
            const match = accounts.find((a) =>
              (a.id && a.id === parsed.id) ||
              (a.email && parsed.email && a.email.toLowerCase() === parsed.email.toLowerCase())
            );
            if (match && match.approval_status) {
              parsed.approval_status = match.approval_status;
            }
          } catch {}
          return parsed;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('b2b_cached_company');
        if (cached) return false;
      } catch {
        // ignore
      }
    }
    return true;
  });

  const [demoRole, setDemoRole] = useState<DemoRoleType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('b2b_cached_company');
        if (cached) {
          const parsed = JSON.parse(cached);
          return (parsed.role as DemoRoleType) || 'guest';
        }
      } catch {
        // ignore
      }
    }
    return 'guest';
  });

  const resolveVerifiedStatus = (userId?: string, email?: string, currentStatus?: string): ApprovalStatus => {
    if (typeof window === 'undefined') return (currentStatus || 'pending') as ApprovalStatus;
    try {
      const accounts = getAdminAccounts();
      const match = accounts.find((a) =>
        (userId && a.id === userId) ||
        (email && a.email && a.email.toLowerCase() === email.toLowerCase())
      );
      if (match && match.approval_status) {
        return match.approval_status;
      }
    } catch {
      // ignore
    }
    return (currentStatus || 'pending') as ApprovalStatus;
  };

  const resolveEffectiveTier = (companyId?: string, email?: string, currentTier?: string): MembershipTier => {
    if (typeof window === 'undefined') return (currentTier || 'bronze') as MembershipTier;
    try {
      const regTier = localStorage.getItem('b2b_registered_tier') as MembershipTier;
      if (regTier === 'gold') return 'gold';
      if (regTier === 'silver' && currentTier !== 'gold') return 'silver';

      const accounts = getAdminAccounts();
      const match = accounts.find((a) =>
        (companyId && a.id === companyId) ||
        (email && a.email && a.email.toLowerCase() === email.toLowerCase())
      );
      if (match?.membership_tier === 'gold') return 'gold';
      if (match?.membership_tier === 'silver' && currentTier !== 'gold') return 'silver';

      if (companyId) {
        const saved = localStorage.getItem(`b2b_profile_override_${companyId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.tier === 'gold' || parsed.membership_tier === 'gold') return 'gold';
          if ((parsed.tier === 'silver' || parsed.membership_tier === 'silver') && currentTier !== 'gold') return 'silver';
        }
      }
    } catch {
      // ignore
    }
    return (currentTier || 'bronze') as MembershipTier;
  };

  const getCompanyForDemoRole = (dRole: DemoRoleType): Company | null => {
    let baseCompany: Company | null = null;
    switch (dRole) {
      case 'buyer':
        baseCompany = MOCK_COMPANIES.find((c) => c.role === 'buyer') || null;
        break;
      case 'seller':
      case 'seller_approved':
        baseCompany = MOCK_COMPANIES.find((c) => c.role === 'seller' && c.approval_status === 'approved') || null;
        break;
      case 'seller_pending':
        baseCompany = MOCK_COMPANIES.find((c) => c.approval_status === 'pending') || null;
        break;
      case 'admin':
        baseCompany = MOCK_COMPANIES.find((c) => c.role === 'admin') || null;
        break;
      case 'guest':
      default:
        return null;
    }

    if (baseCompany && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`b2b_profile_override_${baseCompany.id}`);
        if (saved) {
          return { ...baseCompany, ...JSON.parse(saved) };
        }
      } catch {
        // ignore
      }
    }
    return baseCompany;
  };

  const loadSession = useCallback(async () => {
    try {
      // 1. Primary: fetch user session & company from secure server endpoint
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.company) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('b2b_demo_role');
          }
          let resolvedCompany = data.company;
          // Check local verification & tier overrides
          const verifiedStatus = resolveVerifiedStatus(resolvedCompany.id, resolvedCompany.email, resolvedCompany.approval_status);
          const effectiveTier = resolveEffectiveTier(resolvedCompany.id, resolvedCompany.email, resolvedCompany.tier || resolvedCompany.membership_tier);
          resolvedCompany = {
            ...resolvedCompany,
            tier: effectiveTier,
            membership_tier: effectiveTier,
            approval_status: verifiedStatus,
          };

          setCompany(resolvedCompany);
          if (typeof window !== 'undefined') {
            localStorage.setItem('b2b_cached_company', JSON.stringify(resolvedCompany));
          }
          setDemoRole(resolvedCompany.role as DemoRoleType);
          setIsLoading(false);
          return;
        }
      }

      // 2. Direct Supabase Client check as fallback
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_demo_role');
        }
        const meta = user.user_metadata || {};
        const metaRole = (meta.role || 'seller') as UserRole;
        const initialStatus = meta.approval_status || (metaRole === 'admin' ? 'approved' : 'pending');
        const effectiveStatus = resolveVerifiedStatus(user.id, user.email, initialStatus);
        const effectiveTier = resolveEffectiveTier(user.id, user.email, meta.membership_tier || meta.tier);

        const normalized: Company = {
          id: user.id,
          user_id: user.id,
          name: meta.company_name || meta.contact_name || user.email?.split('@')[0] || 'Member Account',
          company_name: meta.company_name || meta.contact_name || user.email?.split('@')[0] || 'Member Account',
          company_number: meta.regNumber || null,
          vat_number: meta.vatNumber || null,
          address: meta.address || null,
          contact_name: meta.contact_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || '',
          email: user.email || '',
          phone: meta.phone || null,
          role: metaRole,
          tier: effectiveTier,
          membership_tier: effectiveTier,
          approval_status: effectiveStatus,
          categories: meta.selectedNiches || [],
          created_at: user.created_at || new Date().toISOString(),
        };
        setCompany(normalized);
        if (typeof window !== 'undefined') {
          localStorage.setItem('b2b_cached_company', JSON.stringify(normalized));
        }
        setDemoRole(metaRole as DemoRoleType);
        setIsLoading(false);
        return;
      }

      // 3. User is not logged in: guest state (no mock company forced)
      setCompany(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2b_cached_company');
      }
      setDemoRole('guest');
    } catch {
      setCompany(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2b_cached_company');
      }
      setDemoRole('guest');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setAuthenticatedUser = useCallback((user: any) => {
    if (!user) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('b2b_demo_role');
    }
    const meta = user.user_metadata || {};
    const metaRole = (meta.role || 'seller') as UserRole;
    const initialStatus = meta.approval_status || (metaRole === 'admin' ? 'approved' : 'pending');
    const effectiveStatus = resolveVerifiedStatus(user.id, user.email, initialStatus);
    const effectiveTier = resolveEffectiveTier(user.id, user.email, meta.membership_tier || meta.tier);

    const normalized: Company = {
      id: user.id,
      user_id: user.id,
      name: meta.company_name || meta.contact_name || user.email?.split('@')[0] || 'Member Account',
      company_name: meta.company_name || meta.contact_name || user.email?.split('@')[0] || 'Member Account',
      company_number: meta.regNumber || null,
      vat_number: meta.vatNumber || null,
      address: meta.address || null,
      contact_name: meta.contact_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || '',
      email: user.email || '',
      phone: meta.phone || null,
      role: metaRole,
      tier: effectiveTier,
      membership_tier: effectiveTier,
      approval_status: effectiveStatus,
      categories: meta.selectedNiches || [],
      created_at: user.created_at || new Date().toISOString(),
    };
    setCompany(normalized);
    if (typeof window !== 'undefined') {
      localStorage.setItem('b2b_cached_company', JSON.stringify(normalized));
    }
    setDemoRole(metaRole as DemoRoleType);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSession();

    // Listen for live admin verification/approval events
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ companyId: string; status: ApprovalStatus }>;
      if (customEvent.detail) {
        setCompany((prev) => {
          if (!prev) return null;
          if (prev.id === customEvent.detail.companyId) {
            const updated = { ...prev, approval_status: customEvent.detail.status };
            try {
              localStorage.setItem('b2b_cached_company', JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          }
          return prev;
        });
      }
    };

    window.addEventListener('b2b_account_status_change', handleStatusChange);

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        setAuthenticatedUser(session.user);
        void loadSession();
      } else if (event === 'SIGNED_OUT') {
        setCompany(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_cached_company');
        }
        setDemoRole('guest');
        setIsLoading(false);
      }
    });

    return () => {
      window.removeEventListener('b2b_account_status_change', handleStatusChange);
      subscription.unsubscribe();
    };
  }, [loadSession, setAuthenticatedUser]);

  const switchDemoRole = (newRole: DemoRoleType) => {
    setDemoRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('b2b_demo_role', newRole);
    }
    const comp = getCompanyForDemoRole(newRole);
    setCompany(comp);
    if (typeof window !== 'undefined' && comp) {
      localStorage.setItem('b2b_cached_company', JSON.stringify(comp));
    }
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('b2b_demo_role');
      localStorage.removeItem('b2b_seller_sidebar_collapsed');
      localStorage.removeItem('b2b_cached_company');
      localStorage.removeItem('b2b_live_inquiries_real_v3');
      localStorage.removeItem('b2b_live_inquiries_real_v2');
      localStorage.removeItem('b2b_live_inquiries_real_v1');
      localStorage.removeItem('b2b_pending_verification_email');
      sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_buyer');
      sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_guest');

      // Clean up any user-specific quote or lead storage keys
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('b2b_received_quotes_') || k.startsWith('b2b_unlocked_leads_') || k.startsWith('b2b_profile_override_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
    setCompany(null);
    setDemoRole('guest');
  };

  const refreshProfile = async () => {
    await loadSession();
  };

  const updateProfile = async (updatedData: Partial<Company>) => {
    const newTier = updatedData.membership_tier || updatedData.tier;

    setCompany((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        ...updatedData,
        ...(newTier ? { tier: newTier, membership_tier: newTier } : {}),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`b2b_profile_override_${updated.id}`, JSON.stringify(updated));
        localStorage.setItem('b2b_cached_company', JSON.stringify(updated));
        if (newTier) {
          localStorage.setItem('b2b_registered_tier', newTier);
        }
      }
      return updated;
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('b2b_billing_update'));
      window.dispatchEvent(new CustomEvent('b2b_admin_update'));
    }

    const targetId = company?.id || (updatedData as any)?.id;
    const targetEmail = company?.email || company?.contact_email || (updatedData as any)?.email;

    if (newTier && (targetId || targetEmail)) {
      try {
        await fetch('/api/billing/activate-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: targetId,
            email: targetEmail,
            tier: newTier,
            companyName: company?.name || company?.company_name || (updatedData as any)?.name,
            contactName: company?.contact_name || (updatedData as any)?.contact_name,
          }),
        });
      } catch (err) {
        console.warn('[UPDATE PROFILE ACTIVATE TIER NOTICE]', err);
      }
    }

    try {
      if (company?.id) {
        const supabase = createClient();
        const payload: Record<string, unknown> = { ...(updatedData as Record<string, unknown>) };
        // Delete membership_tier from direct update because companies table only has 'tier' column
        delete payload.membership_tier;
        if (newTier) {
          payload.tier = newTier;
        }
        if (Object.keys(payload).length > 0) {
          await supabase
            .from('companies')
            .update(payload)
            .eq('id', company.id);
        }
      }
    } catch {
      // Ignored
    }
  };

  return (
    <AuthContext.Provider
      value={{
        company,
        role: company ? company.role : null,
        isLoggedIn: !!company,
        isLoading,
        demoRole,
        switchDemoRole,
        signOut,
        refreshProfile,
        updateProfile,
        setAuthenticatedUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
