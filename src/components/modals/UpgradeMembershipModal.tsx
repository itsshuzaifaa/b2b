'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { changePlan, getCompanyCards } from '@/lib/billing/billing-store';
import {
  X,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  CreditCard,
} from 'lucide-react';
import type { MembershipTier } from '@/types/database';

interface UpgradeMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export function UpgradeMembershipModal({
  isOpen,
  onClose,
  title = 'Unlock Limit Reached',
  subtitle = 'You have used your 2 free contact unlocks on the Bronze plan. Upgrade to view direct supplier details, phone numbers, and submit wholesale bids.',
}: UpgradeMembershipModalProps) {
  const router = useRouter();
  const { company, isLoggedIn, refreshProfile } = useAuth();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('silver');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleInstantUpgrade = async (tier: 'silver' | 'gold') => {
    if (!isLoggedIn || !company) {
      router.push(`/login?redirect=/marketplace`);
      return;
    }

    const cards = getCompanyCards(company.id);
    if (cards.length === 0) {
      // Direct user to billing to add payment method and upgrade
      router.push(`/dashboard/billing?upgrade=${tier}`);
      onClose();
      return;
    }

    setIsUpgrading(true);
    setStatusMsg(null);

    try {
      const res = changePlan(company.id, tier, company.name, company.email);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `Successfully upgraded to ${tier.toUpperCase()} membership! Contact unlocks are now active.`,
        });
        await refreshProfile();
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1200);
      } else {
        setStatusMsg({
          type: 'error',
          text: res.error || 'Failed to update plan. Please review billing settings.',
        });
      }
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'An unexpected error occurred while processing membership upgrade.',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-[32px] border border-[#E3E9F2] shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#F3F6FB] hover:bg-[#E2E8F0] text-[#5B6B82] flex items-center justify-center transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-extrabold uppercase tracking-wider mb-3">
            <Lock className="w-3.5 h-3.5" />
            Membership Upgrade Required
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A] tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-[#5B6B82] mt-2 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Feedback message */}
        {statusMsg && (
          <div
            className={`mb-6 p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Silver Tier Card */}
          <div
            onClick={() => setSelectedTier('silver')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
              selectedTier === 'silver'
                ? 'border-[#0A6CFF] bg-[#F4F8FF] shadow-md ring-2 ring-[#0A6CFF]/20'
                : 'border-[#E3E9F2] bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#0A6CFF]">
                  Silver Tier
                </span>
                <span className="text-xs font-bold text-slate-500">Popular</span>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-extrabold text-[#0B1F3A]">£79</span>
                <span className="text-xs font-bold text-[#5B6B82]">/ month</span>
              </div>

              <div className="space-y-2.5 text-xs text-[#0B1F3A] font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span><strong>20 Contact Unlocks</strong> per month</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span>50 Active Product Listings</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span>CSV Bulk Catalog Upload</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span>Direct WhatsApp & Phone access</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isUpgrading}
              onClick={(e) => {
                e.stopPropagation();
                handleInstantUpgrade('silver');
              }}
              className="mt-5 w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0A6CFF] hover:bg-[#0857cf] text-white transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              {isUpgrading && selectedTier === 'silver' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Select Silver (£79/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Gold Tier Card */}
          <div
            onClick={() => setSelectedTier('gold')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between relative ${
              selectedTier === 'gold'
                ? 'border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                : 'border-[#E3E9F2] bg-white hover:border-slate-300'
            }`}
          >
            <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
              Unlimited Access
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-600">
                  Gold Tier
                </span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-extrabold text-[#0B1F3A]">£179</span>
                <span className="text-xs font-bold text-[#5B6B82]">/ month</span>
              </div>

              <div className="space-y-2.5 text-xs text-[#0B1F3A] font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>Unlimited Contact Unlocks</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Unlimited Product Listings</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Priority Spotlight & Hot Placement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Verified EU Gold Supplier Badge</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isUpgrading}
              onClick={(e) => {
                e.stopPropagation();
                handleInstantUpgrade('gold');
              }}
              className="mt-5 w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0B1F3A] hover:bg-[#152a4a] text-white transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              {isUpgrading && selectedTier === 'gold' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Select Gold (£179/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-[#EAEFF6] pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6B82] gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Cancel anytime from your billing portal • Instant activation</span>
          </div>
          <Link
            href="/dashboard/billing"
            onClick={onClose}
            className="text-[#0A6CFF] font-bold hover:underline"
          >
            Manage Billing & Invoices &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
