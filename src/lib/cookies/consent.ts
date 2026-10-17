'use client';

export interface CookieConsentState {
  necessary: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

export const COOKIE_CONSENT_KEY = 'b2b_cookie_consent_v1';
export const COOKIE_NAME = 'b2b_cookie_consent';
export const CONSENT_VERSION = '1.0';

export const OPEN_PREFERENCES_EVENT = 'b2b_open_cookie_preferences';
export const CONSENT_UPDATED_EVENT = 'b2b_cookie_consent_update';

/**
 * Reads consent cookie from document.cookie
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Writes consent cookie with 1-year expiration, Lax SameSite, secure in HTTPS
 */
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

/**
 * Updates Google Consent Mode (gtag) if Google Analytics / Tag Manager is present
 */
function syncWithGtag(consent: { functional: boolean; analytics: boolean; marketing: boolean }) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    try {
      (window as any).gtag('consent', 'update', {
        analytics_storage: consent.analytics ? 'granted' : 'denied',
        ad_storage: consent.marketing ? 'granted' : 'denied',
        ad_user_data: consent.marketing ? 'granted' : 'denied',
        ad_personalization: consent.marketing ? 'granted' : 'denied',
        functionality_storage: consent.functional ? 'granted' : 'denied',
        personalization_storage: consent.functional ? 'granted' : 'denied',
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Returns saved consent state or null if user hasn't made a decision yet
 */
export function getSavedCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Try localStorage
    const local = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (local) {
      const parsed = JSON.parse(local) as CookieConsentState;
      if (parsed && typeof parsed.necessary === 'boolean') {
        return parsed;
      }
    }

    // 2. Fallback to cookie
    const rawCookie = getCookie(COOKIE_NAME);
    if (rawCookie) {
      const parsed = JSON.parse(rawCookie) as CookieConsentState;
      if (parsed && typeof parsed.necessary === 'boolean') {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

/**
 * Saves consent selections across localStorage and document cookie, and notifies application
 */
export function saveCookieConsent(choices: {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}): CookieConsentState {
  const state: CookieConsentState = {
    necessary: true, // Strictly necessary is always true
    functional: Boolean(choices.functional),
    analytics: Boolean(choices.analytics),
    marketing: Boolean(choices.marketing),
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(state);
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, serialized);
    } catch {
      // Storage quota or private browsing
    }
    setCookie(COOKIE_NAME, serialized);
    syncWithGtag(state);

    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: state }));
  }

  return state;
}

/**
 * Accept all cookies (functional, analytics, marketing)
 */
export function acceptAllCookies(): CookieConsentState {
  return saveCookieConsent({ functional: true, analytics: true, marketing: true });
}

/**
 * Reject non-essential cookies (only strictly necessary remains active)
 */
export function rejectNonEssentialCookies(): CookieConsentState {
  return saveCookieConsent({ functional: false, analytics: false, marketing: false });
}

/**
 * Checks if a specific cookie category has been granted consent
 */
export function hasCookieConsent(category: 'necessary' | 'functional' | 'analytics' | 'marketing'): boolean {
  if (category === 'necessary') return true;
  const consent = getSavedCookieConsent();
  if (!consent) return false;
  return Boolean(consent[category]);
}

/**
 * Opens the Cookie Settings / Preferences dialog from anywhere (e.g. Footer link)
 */
export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
  }
}
