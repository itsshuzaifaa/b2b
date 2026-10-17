'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Cookie,
  ShieldCheck,
  Sliders,
  Check,
  X,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  getSavedCookieConsent,
  saveCookieConsent,
  acceptAllCookies,
  rejectNonEssentialCookies,
  OPEN_PREFERENCES_EVENT,
  type CookieConsentState,
} from '@/lib/cookies/consent';

export function CookieConsentBanner() {
  const [hasDecided, setHasDecided] = useState<boolean | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  // Individual toggle states in preferences modal
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = getSavedCookieConsent();
    if (existing) {
      setHasDecided(true);
      setFunctional(existing.functional);
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    } else {
      setHasDecided(false);
    }

    const handleOpenPreferences = () => {
      const current = getSavedCookieConsent();
      if (current) {
        setFunctional(current.functional);
        setAnalytics(current.analytics);
        setMarketing(current.marketing);
      }
      setShowPreferences(true);
    };

    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setFunctional(true);
    setAnalytics(true);
    setMarketing(true);
    setHasDecided(true);
    setShowPreferences(false);
  };

  const handleRejectNonEssential = () => {
    rejectNonEssentialCookies();
    setFunctional(false);
    setAnalytics(false);
    setMarketing(false);
    setHasDecided(true);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    saveCookieConsent({ functional, analytics, marketing });
    setHasDecided(true);
    setShowPreferences(false);
  };

  // Don't render until client hydration check runs
  if (hasDecided === null) return null;

  return (
    <>
      {/* 1. Main Bottom Consent Banner (Shown if user hasn't decided yet and preferences modal isn't open) */}
      {!hasDecided && !showPreferences && (
        <aside
          role="region"
          aria-label="Cookie consent banner"
          className="fixed bottom-0 inset-x-0 z-[999] p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="max-w-[1080px] mx-auto bg-white rounded-2xl sm:rounded-3xl border border-[#D9E2EC] shadow-[0_16px_40px_rgba(11,31,58,0.18)] p-5 sm:p-6 md:p-7 pointer-events-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left text column */}
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-center gap-2 text-[#0A6CFF]">
                  <Cookie className="w-5 h-5" />
                  <h3 className="text-[17px] sm:text-[18px] font-extrabold text-[#0B1F3A] tracking-tight">
                    We use cookies
                  </h3>
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#41536D] leading-relaxed">
                  B2B LINK uses necessary cookies to operate and secure the platform. With your permission, we may
                  also use optional cookies to understand how the website is used and improve your experience.
                </p>
                <div className="pt-1">
                  <Link
                    href="/cookies"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0A6CFF] hover:underline"
                  >
                    <span>Read our full Cookie Policy</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Right buttons row (PDF page 3: Accept All | Reject Non-Essential | Manage Preferences) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:shrink-0">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="px-5 py-2.5 sm:py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13.5px] transition-colors shadow-sm cursor-pointer text-center"
                >
                  Accept All
                </button>

                <button
                  type="button"
                  onClick={handleRejectNonEssential}
                  className="px-5 py-2.5 sm:py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13.5px] transition-colors cursor-pointer text-center"
                >
                  Reject Non-Essential
                </button>

                <button
                  type="button"
                  onClick={() => setShowPreferences(true)}
                  className="px-4 py-2.5 sm:py-3 rounded-full border border-slate-300 hover:border-slate-400 bg-white text-[#41536D] hover:text-[#0B1F3A] font-semibold text-[13.5px] transition-colors cursor-pointer text-center"
                >
                  Manage Preferences
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 2. Manage Preferences Modal (Accessible via Banner or Footer "Cookie Settings") */}
      {showPreferences && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
          className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            className="w-full max-w-2xl bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_25px_60px_rgba(11,31,58,0.25)] overflow-hidden my-auto relative transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 sm:p-7 border-b border-slate-100 bg-[#F8FAFC] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#0A6CFF]">
                  <Sliders className="w-5 h-5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                    Privacy & Preferences
                  </span>
                </div>
                <h2 id="cookie-preferences-title" className="text-[20px] sm:text-[22px] font-black text-[#0B1F3A] tracking-tight">
                  Cookie Settings
                </h2>
                <p className="text-[13px] text-[#5B6B82] leading-relaxed">
                  Manage which cookies you allow on B2B LINK. Strictly necessary cookies are required to operate the platform and cannot be disabled.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                aria-label="Close preferences"
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cookie Categories Accordion / Toggles (From PDF Section 3) */}
            <div className="p-6 sm:p-7 space-y-4 max-h-[55vh] overflow-y-auto">
              {/* Category 1: Strictly Necessary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#0A6CFF]" />
                    <h3 className="text-[14px] font-bold text-[#0B1F3A]">Strictly Necessary Cookies</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-200 text-[#0B1F3A] font-bold text-[11px] uppercase tracking-wide">
                    Always Active
                  </span>
                </div>
                <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                  These cookies are required for the website and platform to function properly. They may be used for user authentication, account login, security, session management, fraud prevention, saving cookie preferences and maintaining essential platform functions.
                </p>
              </div>

              {/* Category 2: Functional Cookies */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[14px] font-bold text-[#0B1F3A]">Functional Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={functional}
                      onChange={(e) => setFunctional(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6CFF]"></div>
                  </label>
                </div>
                <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                  Functional cookies help remember choices you make when using B2B LINK, such as language, display settings, account preferences and previously selected options.
                </p>
              </div>

              {/* Category 3: Analytics Cookies */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[14px] font-bold text-[#0B1F3A]">Analytics Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6CFF]"></div>
                  </label>
                </div>
                <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                  Analytics cookies help us understand how visitors use the B2B LINK website and platform, including which pages are visited most often, how users navigate the website, error reporting and performance metrics.
                </p>
              </div>

              {/* Category 4: Marketing Cookies */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[14px] font-bold text-[#0B1F3A]">Marketing Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6CFF]"></div>
                  </label>
                </div>
                <p className="text-[12px] text-[#5B6B82] leading-relaxed">
                  If B2B LINK uses advertising or marketing technologies, these cookies help measure campaigns or display relevant wholesale trade opportunities.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-5 sm:p-6 border-t border-slate-100 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3">
              <Link
                href="/cookies"
                onClick={() => setShowPreferences(false)}
                className="text-[12.5px] font-semibold text-[#5B6B82] hover:text-[#0A6CFF] flex items-center gap-1"
              >
                <span>Read Cookie Policy</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleRejectNonEssential}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                >
                  Reject All
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                >
                  Accept All
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
