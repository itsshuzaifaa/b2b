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
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<DemoRoleType>('guest');

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
          setCompany(data.company);
          setDemoRole(data.company.role as DemoRoleType);
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
        const metaRole = (meta.role || 'buyer') as UserRole;
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
          tier: (metaRole === 'seller' ? (meta.membership_tier || 'silver') : 'bronze') as MembershipTier,
          membership_tier: (metaRole === 'seller' ? (meta.membership_tier || 'silver') : 'bronze') as MembershipTier,
          approval_status: 'approved',
          categories: meta.selectedNiches || [],
          created_at: user.created_at || new Date().toISOString(),
        };
        setCompany(normalized);
        setDemoRole(metaRole as DemoRoleType);
        setIsLoading(false);
        return;
      }

      // 3. User is not logged in: guest state (no mock company forced)
      setCompany(null);
      setDemoRole('guest');
    } catch {
      setCompany(null);
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
    const metaRole = (meta.role || 'buyer') as UserRole;
    const normalized: Company = {
      id: user.id,
      user_id: user.id,
      name: meta.company_name || meta.contact_name || user.email?.split('@')[0] || 'Member Account',
      contact_name: meta.contact_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || '',
      email: user.email || '',
      phone: meta.phone || null,
      role: metaRole,
      membership_tier: (metaRole === 'seller' ? (meta.membership_tier || 'silver') : 'bronze') as MembershipTier,
      approval_status: metaRole === 'buyer' ? 'approved' : 'pending',
      categories: meta.selectedNiches || [],
      created_at: user.created_at || new Date().toISOString(),
    };
    setCompany(normalized);
    setDemoRole(metaRole as DemoRoleType);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSession();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        setAuthenticatedUser(session.user);
        void loadSession();
      } else if (event === 'SIGNED_OUT') {
        setCompany(null);
        setDemoRole('guest');
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSession, setAuthenticatedUser]);

  const switchDemoRole = (newRole: DemoRoleType) => {
    setDemoRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('b2b_demo_role', newRole);
    }
    setCompany(getCompanyForDemoRole(newRole));
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
    }
    setCompany(null);
    setDemoRole('guest');
  };

  const refreshProfile = async () => {
    await loadSession();
  };

  const updateProfile = async (updatedData: Partial<Company>) => {
    setCompany((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedData };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`b2b_profile_override_${updated.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      if (company?.id) {
        const supabase = createClient();
        await supabase
          .from('companies')
          .update(updatedData as unknown as Record<string, unknown>)
          .eq('id', company.id);
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
