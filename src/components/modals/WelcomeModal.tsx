'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Store,
  PlusCircle,
  Zap,
  MessageSquare,
  Percent,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface WelcomeModalProps {
  buyerName?: string;
  buyerEmail?: string;
  companyId?: string;
  role?: string;
  isVerified?: boolean;
}

interface TourStep {
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  headline: string;
  description: string;
  keyFeatures: string[];
  actionLabel: string;
  actionHref?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Live Trading Board',
    badge: 'Step 1 of 4 · Marketplace',
    icon: Store,
    accentColor: '#0A6CFF',
    headline: '400+ Verified Wholesale Lots & Sourcing Demand',
    description:
      'Access real-time Want-To-Buy (WTB) procurement requests and Want-To-Sell (WTS) stock lots directly from qualified European distributors and brand aggregators.',
    keyFeatures: [
      'Filter by brand, category, condition, and warehouse country',
      'Direct one-click access to counterparty company and contact data',
      'Complete visibility over wholesale quantities and target pricing',
    ],
    actionLabel: 'Next: Posting Inventory & Requests',
  },
  {
    title: 'Fast 1-Click Posting',
    badge: 'Step 2 of 4 · Publishing',
    icon: PlusCircle,
    accentColor: '#10B981',
    headline: 'Publish Wholesale Lots or Sourcing Orders in Seconds',
    description:
      'List your available inventory lots or post sourcing requests using our streamlined catalog system with EAN / UPC barcode autofill and customized MOQs.',
    keyFeatures: [
      'Instant catalog lookup via EAN/UPC barcodes',
      'Automatic 14-day listing lifecycle with safe 30-day recovery window',
      'Unlimited WTB demand posting for fast procurement',
    ],
    actionLabel: 'Next: Smart Counterparty Matching',
  },
  {
    title: 'Smart Trading Match Engine',
    badge: 'Step 3 of 4 · Automated Engine',
    icon: Zap,
    accentColor: '#6366F1',
    headline: 'Instant Automated Counterparty Matching',
    description:
      'Our intelligent matching engine automatically links your physical stock lots with active buyer purchase orders in real time, notifying both parties immediately.',
    keyFeatures: [
      'Bundled match previews directly on your dashboard',
      'Instant automated email alerts when a counterparty submits a match',
      'Filter and view all matched stocks in one dedicated view',
    ],
    actionLabel: 'Next: Direct Inquiries & Zero Fees',
  },
  {
    title: 'Direct Trade Chat & 0% Fees',
    badge: 'Step 4 of 4 · Deal Settlement',
    icon: MessageSquare,
    accentColor: '#8B5CF6',
    headline: 'Trade Directly Principal-to-Principal with Zero Commission',
    description:
      'Negotiate terms, arrange logistics, and close deals directly with trading counterparties through private in-app trade inquiries. B2B LINK never takes a commission cut.',
    keyFeatures: [
      '100% confidential trade inquiries between buyer and seller',
      '0% broker commission on all transaction volume',
      'Unread tracking that resets to zero when you reply',
    ],
    actionLabel: 'Get Started & Explore Dashboard',
  },
];

export function WelcomeModal({
  buyerName = 'Partner',
  buyerEmail = '',
  companyId = '',
  isVerified = false,
}: WelcomeModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'stepper' | 'summary'>('stepper');

  const cleanEmail = buyerEmail?.trim().toLowerCase();
  const userKey = cleanEmail || companyId;
  const STORAGE_KEY = userKey ? `b2b_onboarding_completed_${userKey}` : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. NEVER open or process if account is not verified
    if (!isVerified) {
      setIsOpen(false);
      return;
    }

    // 2. Wait until user identification is resolved (avoid global_user race condition)
    if (!userKey || !STORAGE_KEY) {
      return;
    }

    // 3. Check for fresh verification triggers (from /verify-email or admin approval)
    const urlParams = new URLSearchParams(window.location.search);
    const hasOnboardingParam = urlParams.get('onboarding') === 'true';
    const justVerified =
      sessionStorage.getItem('b2b_just_verified') === 'true' ||
      sessionStorage.getItem('b2b_show_onboarding') === 'true';

    if (justVerified || hasOnboardingParam) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        if (cleanEmail) localStorage.removeItem(`b2b_onboarding_completed_${cleanEmail}`);
        if (companyId) localStorage.removeItem(`b2b_onboarding_completed_${companyId}`);
        sessionStorage.removeItem('b2b_just_verified');
        sessionStorage.removeItem('b2b_show_onboarding');
      } catch {}
    }

    // 4. Check if user already completed or dismissed the onboarding
    const alreadyCompleted =
      localStorage.getItem(STORAGE_KEY) === 'true' ||
      sessionStorage.getItem(STORAGE_KEY) === 'true' ||
      (cleanEmail && localStorage.getItem(`b2b_onboarding_completed_${cleanEmail}`) === 'true') ||
      (companyId && localStorage.getItem(`b2b_onboarding_completed_${companyId}`) === 'true');

    if (!alreadyCompleted) {
      // Delay slightly (500ms) as the user loads into the verified account so the dashboard settles
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVerified, userKey, STORAGE_KEY, cleanEmail, companyId]);

  // Support manual tour re-opening from anywhere in the application
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleManualOpen = () => {
      if (isVerified) {
        setCurrentStepIndex(0);
        setIsOpen(true);
      }
    };
    window.addEventListener('b2b_open_onboarding', handleManualOpen);
    return () => window.removeEventListener('b2b_open_onboarding', handleManualOpen);
  }, [isVerified]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      try {
        if (STORAGE_KEY) {
          localStorage.setItem(STORAGE_KEY, 'true');
          sessionStorage.setItem(STORAGE_KEY, 'true');
        }
        if (cleanEmail) {
          localStorage.setItem(`b2b_onboarding_completed_${cleanEmail}`, 'true');
          sessionStorage.setItem(`b2b_onboarding_completed_${cleanEmail}`, 'true');
        }
        if (companyId) {
          localStorage.setItem(`b2b_onboarding_completed_${companyId}`, 'true');
          sessionStorage.setItem(`b2b_onboarding_completed_${companyId}`, 'true');
        }
      } catch {}
    }
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (!isOpen || !isVerified) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const firstName = buyerName.split(' ')[0] || 'Partner';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 pointer-events-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[620px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_24px_70px_rgba(11,31,58,0.3)] overflow-hidden relative flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="bg-[#0B1F3A] text-white p-6 sm:p-7 relative overflow-hidden shrink-0">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-10 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Close / Cancel Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cancel onboarding tour"
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer group"
            title="Skip Tour"
          >
            <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>

          {/* Top Pills & View Mode Switch */}
          <div className="flex items-center justify-between pr-10 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/35 flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>ACCOUNT VERIFIED</span>
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#00C2FF] bg-[#00C2FF]/10 px-3 py-1 rounded-full border border-[#00C2FF]/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00C2FF]" />
                <span>ONBOARDING TOUR</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === 'stepper' ? 'summary' : 'stepper'))}
              className="text-[11.5px] font-bold text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
            >
              <Layers className="w-3 h-3" />
              <span>{viewMode === 'stepper' ? 'Overview' : 'Step-by-Step'}</span>
            </button>
          </div>

          <div className="flex items-start gap-4 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00C2FF]/30 to-[#0A6CFF]/40 border border-[#00C2FF]/40 text-[#00C2FF] font-black text-[16px] flex items-center justify-center shrink-0 shadow-inner">
              B2B
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-black tracking-tight text-white leading-tight">
                Account Verified — Welcome to B2B LINK, {firstName}!
              </h2>
              <p className="text-[13px] text-[#A7BFDE] mt-1 font-medium">
                Your wholesale account is fully verified and active. Here is a quick 1-minute walkthrough of your platform capabilities.
              </p>
            </div>
          </div>

          {/* Step Progress Bar (when in stepper mode) */}
          {viewMode === 'stepper' && (
            <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
              {TOUR_STEPS.map((step, idx) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full flex-1 transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'bg-[#00C2FF] shadow-[0_0_8px_#00C2FF]'
                      : idx < currentStepIndex
                      ? 'bg-blue-400/60'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title={step.title}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto max-h-[460px]">
          {viewMode === 'stepper' ? (
            /* STEPPER VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#0A6CFF] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60">
                  {currentStep.badge}
                </span>
                <span className="text-[12px] font-bold text-[#8A9BB0]">
                  {currentStepIndex + 1} / {TOUR_STEPS.length}
                </span>
              </div>

              {/* Step Card */}
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] shadow-2xs">
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${currentStep.accentColor}15`, color: currentStep.accentColor }}
                  >
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] sm:text-[17px] font-black text-[#0B1F3A] leading-snug">
                      {currentStep.headline}
                    </h3>
                    <p className="text-[13px] text-[#5B6B82] mt-1 leading-relaxed">
                      {currentStep.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EAEFF6] space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A9BB0] block">
                    Key Capabilities:
                  </span>
                  {currentStep.keyFeatures.map((feat) => (
                    <div key={feat} className="flex items-start gap-2 text-[12.5px] text-[#0B1F3A] font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ALL-IN-ONE SUMMARY VIEW */
            <div className="space-y-3 animate-in fade-in duration-200">
              <p className="text-[13.5px] text-[#5B6B82] leading-relaxed">
                Connect directly with European wholesalers, consumer electronics distributors, and vetted buyers with zero broker fees:
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {TOUR_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-start gap-3 hover:border-blue-200 transition"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${step.accentColor}15`, color: step.accentColor }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-[13.5px] font-bold text-[#0B1F3A]">{step.title}</h4>
                        <p className="text-[12px] text-[#5B6B82] mt-0.5 leading-snug">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 sm:p-6 bg-slate-50 border-t border-[#EAEFF6] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {viewMode === 'stepper' ? (
            <>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-2 text-[12px] font-bold text-[#5B6B82] hover:text-[#0B1F3A] transition cursor-pointer"
                >
                  Skip Tour
                </button>
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-4 py-2 text-[12px] font-bold bg-white hover:bg-slate-100 border border-[#CBD5E1] text-[#0B1F3A] rounded-full flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer ml-auto"
              >
                <span>{currentStep.actionLabel}</span>
                {currentStepIndex < TOUR_STEPS.length - 1 ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 text-[12px] font-bold text-[#5B6B82] hover:text-[#0B1F3A] transition cursor-pointer"
              >
                Cancel & Close
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Explore Platform Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
