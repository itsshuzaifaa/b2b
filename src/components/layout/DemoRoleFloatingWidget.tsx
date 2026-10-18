'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type DemoRoleType } from '@/lib/auth/auth-context';
import {
  Sparkles,
  ChevronUp,
  X,
  Check,
  LogOut,
  KeyRound,
} from 'lucide-react';

export function DemoRoleFloatingWidget() {
  const router = useRouter();
  const { demoRole, switchDemoRole, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreds, setShowCreds] = useState(false);

  const roles = [
    {
      id: 'guest',
      label: 'Guest / Public',
      desc: 'Free access gated (Landing & Pricing)',
      badge: 'Public',
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'buyer',
      label: 'Verified Buyer',
      desc: 'Full catalog, inquiry & post WTB',
      badge: 'Free Member',
      badgeColor: 'bg-blue-50 text-[#0066FF]',
    },
    {
      id: 'seller_pending',
      label: 'Pending Seller',
      desc: 'Wise payment gate preview',
      badge: 'Wise Gate',
      badgeColor: 'bg-amber-50 text-amber-700',
    },
    {
      id: 'seller_approved',
      label: 'Approved Seller',
      desc: 'Gold VIP quota & listing rights',
      badge: 'Gold VIP',
      badgeColor: 'bg-emerald-50 text-emerald-700',
    },
    {
      id: 'admin',
      label: 'Platform Admin',
      desc: 'Jeff vetting & member manager',
      badge: 'Jeff Desk',
      badgeColor: 'bg-slate-900 text-[#00D2FF]',
    },
  ];

  const handleSelectRole = (roleId: string) => {
    switchDemoRole(roleId as DemoRoleType);
    if (roleId === 'admin') {
      router.push('/admin');
    }
  };

  const currentRoleObj = roles.find((r) => r.id === demoRole) || roles[0];

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end">
      {/* Expanded Popover Modal */}
      {isOpen && (
        <div className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 mb-2 sm:mb-3 text-slate-900 animate-in fade-in slide-in-from-bottom-3 duration-200 max-h-[80dvh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0B132B] flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  Evaluator Testing Suite
                </h4>
                <p className="text-[10px] text-slate-500">
                  Switch roles instantly to test gating & views
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Selectors */}
          <div className="space-y-1.5 mb-3">
            {roles.map((item) => {
              const isSelected = demoRole === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectRole(item.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-[#0066FF] shadow-2xs'
                      : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200/70'
                  }`}
                >
                  <div className="pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {item.label}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Credentials Toggle Accordion */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreds(!showCreds)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-slate-900 py-1"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0066FF]" />
                <span>Live Supabase Credentials</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {showCreds ? 'Hide' : 'View'}
              </span>
            </button>

            {showCreds && (
              <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] space-y-2">
                <div>
                  <div className="text-[#00D2FF] font-bold text-[10px] uppercase">
                    Admin (Jeff Vetting)
                  </div>
                  <div className="text-slate-200 font-mono text-[10px]">
                    admin@b2blink.eu &bull; AdminPassword2026!
                  </div>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold text-[10px] uppercase">
                    Seller (Pending Wise)
                  </div>
                  <div className="text-slate-200 font-mono text-[10px]">
                    seller@nordictech.eu &bull; SellerPassword2026!
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                void signOut();
                switchDemoRole('guest');
              }}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 font-medium transition"
            >
              <LogOut className="w-3 h-3" />
              <span>Reset to Guest</span>
            </button>

            <span className="text-[10px] text-slate-400">
              B2B LINK OÜ Desk
            </span>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 bg-[#0B132B] hover:bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 transition transform hover:scale-105 active:scale-95 group"
        title="Toggle Demo Testing Options"
      >
        <span className="flex h-2 w-2 rounded-full bg-[#00D2FF] animate-pulse" />
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="text-slate-400 text-[11px]">Role:</span>
          <span className="text-[#00D2FF] font-bold">
            {currentRoleObj.label}
          </span>
        </div>
        <ChevronUp
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
