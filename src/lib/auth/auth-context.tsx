'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MOCK_COMPANIES } from '@/lib/mock-data';
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
  // Gate state: Start with null company and isLoading = true.
  // We NEVER resolve gate state or render dashboard/modals until /api/auth/me returns to eliminate any flash.
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoRole, setDemoRole] = useState<DemoRoleType>('guest');

  const resolveEffectiveTier = (companyId?: string, email?: string, currentTier?: string): MembershipTier => {
    if (typeof window === 'undefined') return (currentTier || 'bronze') as MembershipTier;
    try {
      const regTier = localStorage.getItem('b2b_registered_tier') as MembershipTier;
      if (regTier === 'gold') return 'gold';
      if (regTier === 'silver' && currentTier !== 'gold') return 'silver';

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

  const signOut = useCallback(async () => {
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
      localStorage.removeItem('b2b_pending_signup_email');
      localStorage.removeItem('b2b_admin_deleted_accounts_v4');
      sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_buyer');
      sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_guest');

      // Clean up any user-specific quote or lead storage keys and legacy verification flags
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith('b2b_received_quotes_') ||
              k.startsWith('b2b_unlocked_leads_') ||
              k.startsWith('b2b_profile_override_') ||
              k.startsWith('b2b_account_verified_') ||
              k.startsWith('b2b_email_verified_'))
          ) {
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
  }, []);

  const loadSession = useCallback(async () => {
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    try {
      // 1. Primary: fetch user session & company from secure server endpoint
      // companies.approval_status in database is the single authoritative source of truth.
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
          const resolvedCompany: Company = data.company;
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
        const appMeta = user.app_metadata || {};
        // SECURITY: Admin role is strictly derived from server app_metadata, never user_metadata.
        const isAppAdmin = appMeta.role === 'admin' || appMeta.is_admin === true;
        const metaRole = (isAppAdmin ? 'admin' : (meta.role === 'buyer' ? 'buyer' : 'seller')) as UserRole;
        // User metadata is NOT used to make approval decision: defaults to pending until /api/auth/me verifies
        const effectiveStatus: ApprovalStatus = metaRole === 'admin' ? 'approved' : 'pending';
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
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }
  }, []);

  const setAuthenticatedUser = useCallback((user: any) => {
    if (!user) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('b2b_demo_role');
    }
    const meta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    // SECURITY: Admin role is strictly derived from server app_metadata, never user_metadata.
    const isAppAdmin = appMeta.role === 'admin' || appMeta.is_admin === true;
    const metaRole = (isAppAdmin ? 'admin' : (meta.role === 'buyer' ? 'buyer' : 'seller')) as UserRole;
    // User metadata is NOT used to make approval decision: defaults to pending until /api/auth/me verifies
    const effectiveStatus: ApprovalStatus = metaRole === 'admin' ? 'approved' : 'pending';
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
    // Immediately trigger server verification from /api/auth/me
    void loadSession();
  }, [loadSession]);

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
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
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

  // Real-time synchronization with server database on admin updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleServerSync = () => {
      void loadSession();
    };

    window.addEventListener('b2b_admin_update', handleServerSync);
    return () => {
      window.removeEventListener('b2b_admin_update', handleServerSync);
    };
  }, [loadSession]);

  // Presence heartbeat: tracks online status to suppress email notifications while user is active
  useEffect(() => {
    if (!company?.email) return;

    const pingPresence = () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/presence',
            new Blob([JSON.stringify({ email: company.email, userId: company.id })], {
              type: 'application/json',
            })
          );
        } else {
          fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: company.email, userId: company.id }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    pingPresence();
    const interval = setInterval(pingPresence, 45000);

    const handleActivity = () => {
      pingPresence();
    };
    window.addEventListener('focus', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [company?.email, company?.id]);

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
