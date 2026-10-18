'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { processRegistrationCardCheckout } from '@/lib/billing/billing-store';
import type { MembershipTier } from '@/types/database';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
  Check,
  Loader2,
  Clock,
  ShieldAlert,
} from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile, setAuthenticatedUser } = useAuth();

  const searchEmail = searchParams.get('email') || '';
  const searchTier = (searchParams.get('tier') || '').toLowerCase();
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState(searchEmail);
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('bronze');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');

  // Lifecycle phase: 'verify' -> 'payment' (for paid tiers) -> 'payment_success' | 'verify_success'
  const [phase, setPhase] = useState<'verify' | 'payment' | 'payment_success' | 'verify_success'>('verify');

  // Load email and pending tier details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!email) {
        const savedEmail = localStorage.getItem('b2b_pending_verification_email');
        if (savedEmail) setEmail(savedEmail);
      }
      const savedTier = localStorage.getItem('b2b_pending_tier') || searchTier;
      if (savedTier === 'silver' || savedTier === 'gold') {
        setSelectedTier(savedTier as MembershipTier);
      } else {
        setSelectedTier('bronze');
      }

      const savedCompanyId = localStorage.getItem('b2b_pending_company_id');
      if (savedCompanyId) setCompanyId(savedCompanyId);

      const savedCompName = localStorage.getItem('b2b_pending_company_name');
      if (savedCompName) setCompanyName(savedCompName);

      const savedContName = localStorage.getItem('b2b_pending_contact_name');
      if (savedContName) setContactName(savedContName);
    }
  }, [email, searchTier]);

  // OTP Verification state
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resend Cooldown Timer (1 minute = 60 seconds)
  const [countdown, setCountdown] = useState<number>(60);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Code Expiration Timer (15 minutes = 900 seconds)
  const [codeExpiresIn, setCodeExpiresIn] = useState<number>(15 * 60);

  // Format MM:SS helper
  const formatTime = (totalSeconds: number) => {
    const mins = Math.max(0, Math.floor(totalSeconds / 60));
    const secs = Math.max(0, totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Card Payment States (For Silver / Gold packages)
  const [cardholderName, setCardholderName] = useState(contactName || companyName || 'Wholesale Member');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('12');
  const [cardExpYear, setCardExpYear] = useState('28');
  const [cardCvc, setCardCvc] = useState('');
  const [cardZip, setCardZip] = useState('10117');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentDeclineNotice, setPaymentDeclineNotice] = useState<string | null>(null);
  const [declineCount, setDeclineCount] = useState<number>(0);
  const [sampleCardLoaded, setSampleCardLoaded] = useState(false);

  // Update cardholder name when loaded
  useEffect(() => {
    if (!cardholderName || cardholderName === 'Wholesale Member') {
      if (contactName) setCardholderName(contactName);
      else if (companyName) setCardholderName(companyName);
    }
  }, [contactName, companyName, cardholderName]);

  // Resend cooldown timer (1 minute)
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Code expiration countdown timer (15 minutes)
  useEffect(() => {
    if (codeExpiresIn > 0 && phase === 'verify') {
      const timer = setTimeout(() => setCodeExpiresIn(codeExpiresIn - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeExpiresIn, phase]);

  // Autofill Test Card handler
  const handleAutofillTestCard = () => {
    setCardholderName(contactName || companyName || 'Habib Rehman');
    setCardNumber('4242 4242 4242 4242');
    setCardExpMonth('12');
    setCardExpYear('28');
    setCardCvc('123');
    setCardZip('10117');
    setSampleCardLoaded(true);
    setErrorMsg(null);
    setPaymentDeclineNotice(null);
  };

  // Helper to dispatch KYC Document Request email
  const triggerKycEmail = async (targetEmail: string) => {
    try {
      await fetch('/api/auth/dispatch-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
    } catch (kycErr) {
      console.warn('[KYC DISPATCH NOTICE]', kycErr);
    }
  };

  // 1. Verify OTP handler
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp.trim()) {
      setErrorMsg('Please enter the verification code from your email.');
      return;
    }

    if (codeExpiresIn <= 0) {
      setErrorMsg('This verification code has expired (15-minute limit). Please click "Resend verification code" below to receive a new code.');
      return;
    }

    setVerifying(true);
    setErrorMsg(null);

    try {
      const cleanOtp = otp.trim().replace(/\s+/g, '');

      // Strictly validate with server verification store (enforcing 15-minute expiration & latest-code rule)
      const serverRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: cleanOtp }),
      });
      const serverData = await serverRes.json();
      if (!serverRes.ok) {
        setErrorMsg(serverData.error || 'Invalid or expired verification code. Please check and try again.');
        setVerifying(false);
        return;
      }

      const supabase = createClient();

      // Complete Supabase client authentication
      let verifyResult = await supabase.auth.verifyOtp({
        email,
        token: cleanOtp,
        type: 'magiclink',
      });

      if (verifyResult.error) {
        verifyResult = await supabase.auth.verifyOtp({
          email,
          token: cleanOtp,
          type: 'signup',
        });
      }

      if (verifyResult.error && !serverData.success) {
        setErrorMsg(verifyResult.error.message || 'Invalid or expired verification code. Please check and try again.');
        setVerifying(false);
        return;
      }

      if (verifyResult.data?.user) {
        setAuthenticatedUser(verifyResult.data.user);
      }

      // If user selected a paid package (Silver or Gold), transition directly to payment in the same box!
      if (selectedTier === 'silver' || selectedTier === 'gold') {
        setPhase('payment');
        setVerifying(false);
        return;
      }

      // Free Bronze tier: Mark verified and proceed to dashboard
      setPhase('verify_success');
      await triggerKycEmail(email);

      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2b_pending_verification_email');
        localStorage.removeItem('b2b_pending_tier');
        localStorage.removeItem('b2b_demo_role');
      }

      await refreshProfile();

      setTimeout(() => {
        router.push(redirectParam || '/dashboard');
      }, 1600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to verify code.');
    } finally {
      setVerifying(false);
    }
  };

  // 2. Resend verification code
  const handleResendCode = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);
    setResendNotice(null);

    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to resend code.');
      } else {
        setResendNotice('New verification code sent! The previous code has now expired.');
        setCountdown(60); // 1 minute cooldown to request another code
        setCodeExpiresIn(15 * 60); // Fresh 15-minute validity for the new code
        setOtp('');
      }
    } catch {
      setErrorMsg('Could not send code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // 3. Fallback: Continue with Free Bronze Account
  const handleContinueWithFree = async () => {
    setProcessingPayment(true);
    setErrorMsg(null);
    setPaymentDeclineNotice(null);

    try {
      // Ensure account tier remains strictly bronze in database
      await fetch('/api/billing/activate-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          companyId,
          tier: 'bronze',
        }),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('b2b_registered_tier', 'bronze');
        localStorage.removeItem('b2b_pending_tier');
        localStorage.removeItem('b2b_pending_verification_email');
        localStorage.removeItem('b2b_demo_role');
      }

      await triggerKycEmail(email);
      await refreshProfile();
      router.push(redirectParam || '/dashboard');
    } catch {
      router.push(redirectParam || '/dashboard');
    } finally {
      setProcessingPayment(false);
    }
  };

  // 4. Process Card Payment for Silver / Gold package
  const handleProcessPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setPaymentDeclineNotice(null);

    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (!cardholderName.trim()) {
      setErrorMsg('Please enter the name on your card.');
      return;
    }
    if (cleanCard.length < 15) {
      setErrorMsg('Please enter a valid card number (or click Autofill Test Card).');
      return;
    }
    const m = parseInt(cardExpMonth, 10);
    if (!cardExpMonth || isNaN(m) || m < 1 || m > 12) {
      setErrorMsg('Please enter a valid expiry month (01-12).');
      return;
    }
    if (!cardExpYear || cardExpYear.length < 2) {
      setErrorMsg('Please enter a valid 2-digit expiry year (e.g. 28).');
      return;
    }
    if (!cardCvc || cardCvc.length < 3) {
      setErrorMsg('Please enter a valid 3 or 4-digit CVC code.');
      return;
    }

    // Check for simulated decline card (ends in 0002)
    if (cleanCard.endsWith('0002')) {
      setDeclineCount((prev) => prev + 1);
      setPaymentDeclineNotice('Your card was declined by the card issuer. Please check your card details or try a different card.');
      return;
    }

    setProcessingPayment(true);

    try {
      const brand = cleanCard.startsWith('5') ? 'mastercard' : cleanCard.startsWith('3') ? 'amex' : 'visa';

      // 1. Activate Paid Tier in Database
      const activateRes = await fetch('/api/billing/activate-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          companyId,
          tier: selectedTier,
          companyName: companyName || cardholderName,
          contactName: contactName || cardholderName,
          cardLast4: cleanCard.slice(-4),
          isSignup: true,
        }),
      });

      const activateData = await activateRes.json();
      if (!activateRes.ok) {
        setDeclineCount((prev) => prev + 1);
        const errorText = activateData.error && !activateData.error.includes('column') && !activateData.error.includes('does not exist')
          ? activateData.error
          : 'Your card was declined by your bank or card issuer. Please try a different card.';
        setPaymentDeclineNotice(errorText);
        setProcessingPayment(false);
        return;
      }

      // 2. Record Card & Subscription in Billing Store
      const effectiveCompanyId = companyId || activateData.company?.id || email;
      processRegistrationCardCheckout({
        companyId: effectiveCompanyId,
        companyName: companyName || cardholderName,
        contactEmail: email,
        tier: selectedTier,
        cardData: {
          cardNumber: cleanCard,
          cardholderName: cardholderName.trim(),
          expMonth: cardExpMonth.trim(),
          expYear: cardExpYear.trim(),
          brand,
        },
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('b2b_registered_tier', selectedTier);
        localStorage.removeItem('b2b_pending_tier');
        localStorage.removeItem('b2b_pending_verification_email');
        localStorage.removeItem('b2b_demo_role');
      }

      await triggerKycEmail(email);
      await refreshProfile();

      // Transition to banking-style success animation inside the same box!
      setPhase('payment_success');

      // Auto redirect to dashboard after 2.8s
      setTimeout(() => {
        router.push(redirectParam || '/dashboard');
      }, 2800);
    } catch (err) {
      setDeclineCount((prev) => prev + 1);
      setPaymentDeclineNotice(err instanceof Error ? err.message : 'Your card was declined. Please check your details or try a different card.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const planPriceEur = selectedTier === 'silver' ? '€79' : '€179';
  const planName = selectedTier === 'silver' ? 'Silver Membership' : 'Gold VIP Membership';

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 sm:py-16 font-sans">
      {/* Centered Logo above Card */}
      <div className="mb-7">
        <Link href="/" className="inline-block">
          <Image
            src="/b2b-link-logo-tight.png"
            alt="B2B LINK"
            width={150}
            height={46}
            priority
            className="h-10 w-auto object-contain"
            style={{ width: 'auto' }}
          />
        </Link>
      </div>

      {/* Main Container Box */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_12px_36px_rgba(11,31,58,0.06)] p-7 sm:p-9 transition-all duration-300">
        
        {/* ========================================================================= */}
        {/* PHASE 1: OTP Email Verification                                           */}
        {/* ========================================================================= */}
        {phase === 'verify' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-[#EBF3FF] border border-[#D0E2FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-1.5">
                SECURITY VERIFICATION
              </div>
              <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
                Check your inbox
              </h1>
              <p className="text-[14px] text-[#5B6B82] leading-relaxed">
                We sent a 6-digit verification code to{' '}
                <strong className="text-[#0B1F3A] font-bold block sm:inline">{email || 'your email'}</strong>.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resend Notice */}
            {resendNotice && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-[13px] text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{resendNotice}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {!searchEmail && (
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Account email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                    placeholder="name@company.eu"
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5 px-0.5">
                  <label className="font-bold text-[#0B1F3A]">
                    Verification code
                  </label>
                  {codeExpiresIn > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#5B6B82] bg-[#F1F5F9] px-2.5 py-0.5 rounded-full border border-[#E2E8F0]">
                      <Clock className="w-3 h-3 text-[#0A6CFF]" />
                      <span>Expires in <strong className="text-[#0B1F3A] font-mono">{formatTime(codeExpiresIn)}</strong></span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3 text-red-600" />
                      <span>Code expired (15m limit)</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={12}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder="Enter code"
                  className={`w-full px-4 py-3.5 text-[22px] tracking-[0.2em] text-center font-mono font-bold bg-[#F8FAFF] border-2 rounded-2xl text-[#0B1F3A] placeholder:text-[#CBD5E1] focus:outline-none transition ${
                    codeExpiresIn <= 0
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-[#E3E9F2] focus:border-[#0A6CFF] focus:bg-white'
                  }`}
                />
                {codeExpiresIn <= 0 && (
                  <p className="mt-2 text-[12px] text-red-600 font-semibold text-center animate-in fade-in">
                    This verification code has expired after 15 minutes. Please click &ldquo;Resend verification code&rdquo; below.
                  </p>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={verifying || !otp.trim() || !email.trim() || codeExpiresIn <= 0}
                className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs mt-6 disabled:opacity-50 cursor-pointer"
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying code...</span>
                  </span>
                ) : (
                  <span>Verify Email &amp; Continue</span>
                )}
              </button>
            </form>

            {/* Resend Code Section */}
            <div className="mt-5 pt-4 border-t border-[#EAEFF6] text-center text-[13px] text-[#5B6B82]">
              {countdown > 0 ? (
                <p>
                  Didn’t receive the code? Resend in{' '}
                  <span className="font-bold text-[#0B1F3A] font-mono">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending || !email.trim()}
                  className="inline-flex items-center gap-1.5 font-bold text-[#0A6CFF] hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>Resend verification code</span>
                </button>
              )}
              <div className="text-[11.5px] text-[#8A9BB0] mt-1.5">
                Each code is valid for 15 minutes. Requesting a new code expires the previous one.
              </div>
            </div>

            {/* Links */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[13px] text-[#5B6B82]">
              <Link href="/login" className="font-semibold text-[#0A6CFF] hover:underline">
                Sign in with password
              </Link>
              <Link href="/register" className="hover:text-[#0B1F3A] hover:underline">
                Return to register
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PHASE 2: Post-Verification Payment Step (For Silver / Gold packages)       */}
        {/* ========================================================================= */}
        {phase === 'payment' && (
          <div>
            {/* Top Email Verified Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Email Verified</span>
            </div>

            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-1">
                PACKAGE ACTIVATION
              </div>
              <h1 className="text-[24px] sm:text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1 leading-tight">
                Activate {selectedTier === 'silver' ? 'Silver' : 'Gold'} Package
              </h1>
              <p className="text-[13px] text-[#5B6B82] leading-snug">
                Your email is confirmed. Add your corporate payment method to activate your wholesale membership.
              </p>
            </div>

            {/* Plan Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-[#14325A] text-white mb-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                    {selectedTier === 'silver' ? 'Silver Tier' : 'Gold VIP Tier'}
                  </div>
                  <h3 className="text-[18px] font-black text-white mt-0.5">
                    {planName}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {selectedTier === 'silver'
                      ? '50 Active Listings • 20 Contact Unlocks • CSV Uploads'
                      : 'Unlimited Listings • Unlimited Contacts • Hot Deal Spotlight'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[26px] font-black text-white leading-none">
                    {planPriceEur}
                  </div>
                  <div className="text-[11px] text-blue-200 font-medium">/ month</div>
                </div>
              </div>
            </div>

            {/* Test Sandbox Notice & Autofill Button */}
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 mb-5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[15px]">🧪</span>
                  <div>
                    <span className="text-[12px] font-bold text-amber-950 block leading-tight">Test Sandbox Mode</span>
                    <span className="text-[11px] text-amber-800 leading-none">Demo card available for testing</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutofillTestCard}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Autofill Test Card</span>
                </button>
              </div>

              {sampleCardLoaded && (
                <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sample Visa ending in 4242 loaded</span>
                </div>
              )}
            </div>

            {/* Decline Notice Alert */}
            {paymentDeclineNotice && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 animate-in fade-in">
                <div className="flex items-start gap-2 text-[13px] font-bold mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>Card Declined</span>
                </div>
                <p className="text-[12px] text-red-600 leading-snug">
                  {paymentDeclineNotice}
                </p>
              </div>
            )}

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-[12px] text-red-700">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Card Form */}
            <form onSubmit={handleProcessPayment} className="space-y-3.5">
              {/* Cardholder Name */}
              <div>
                <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1">
                  Name on card <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="e.g. Alexander Weber"
                    className="w-full px-3.5 py-2.5 text-[13px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Card Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-bold text-[#0B1F3A]">
                    Card number <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {cardNumber.replace(/\s+/g, '').startsWith('4')
                      ? 'Visa'
                      : cardNumber.replace(/\s+/g, '').startsWith('5')
                      ? 'Mastercard'
                      : 'Credit or Debit'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setCardNumber(v.replace(/(.{4})/g, '$1 ').trim());
                    }}
                    placeholder="4242 •••• •••• 4242"
                    className="w-full pl-9 pr-3.5 py-2.5 text-[13px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] font-mono transition"
                  />
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Expiry, CVC & ZIP */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#0B1F3A] mb-1">
                    Expires <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="MM"
                      value={cardExpMonth}
                      onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-1.5 py-2.5 text-center text-[12px] bg-white border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                    />
                    <span className="text-slate-400 font-bold">/</span>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="YY"
                      value={cardExpYear}
                      onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-1.5 py-2.5 text-center text-[12px] bg-white border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#0B1F3A] mb-1">
                    CVC <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="123"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-2 py-2.5 text-center text-[12px] bg-white border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                    />
                    <Lock className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#0B1F3A] mb-1">
                    Postal code
                  </label>
                  <input
                    type="text"
                    placeholder="10117"
                    value={cardZip}
                    onChange={(e) => setCardZip(e.target.value)}
                    className="w-full px-2 py-2.5 text-center text-[12px] bg-white border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authorizing Card...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Pay &amp; Activate {planName} ({planPriceEur})</span>
                    </>
                  )}
                </button>

                {/* Subtle fallback link for free account only shown after 2 or more card declines */}
                {declineCount >= 2 && (
                  <div className="pt-1.5 text-center animate-in fade-in">
                    <button
                      type="button"
                      onClick={handleContinueWithFree}
                      disabled={processingPayment}
                      className="text-[12px] text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer transition"
                    >
                      Having trouble with your card? Continue with Free Account (Bronze)
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-[#64748B] border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-Bit Encrypted</span>
                </span>
                <span>Billed monthly &bull; Cancel anytime</span>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PHASE 3: Banking-Style Payment Successful Animation                        */}
        {/* ========================================================================= */}
        {phase === 'payment_success' && (
          <div className="text-center py-5">
            {/* Banking-App Animated Green Circular Icon with Arrow */}
            <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
              {/* Outer soft pulse ring */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
              
              {/* Main solid green banking circle */}
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#10B981] text-white shadow-[0_12px_32px_rgba(16,185,129,0.38)] ring-4 ring-emerald-400/40 flex items-center justify-center animate-in zoom-in-50 duration-500 ease-out">
                {/* Banking arrow / confirmation icon */}
                <ArrowUpRight className="w-11 h-11 text-white stroke-[2.75] animate-in fade-in duration-700" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold mb-2">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedTier.toUpperCase()} MEMBERSHIP ACTIVE</span>
            </div>

            <h1 className="text-[26px] sm:text-[28px] font-black text-[#0B1F3A] tracking-[-0.025em] mb-1 leading-tight">
              Payment Successful!
            </h1>

            <div className="text-[22px] font-black text-[#0A6CFF] my-2">
              {planPriceEur}.00 EUR
            </div>

            <p className="text-[13px] text-[#5B6B82] max-w-sm mx-auto mb-4 leading-relaxed">
              Your {selectedTier === 'silver' ? 'Silver' : 'Gold'} membership package has been activated. A receipt has been issued to <strong className="text-[#0B1F3A]">{email}</strong>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 text-left text-[12.5px] text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold">Next Step: Business Verification</span>
                <p className="text-amber-800 text-[11.5px] mt-0.5">
                  Your account is awaiting business verification by the B2B LINK Verification Team. Please verify your company documents on the dashboard popup.
                </p>
              </div>
            </div>

            {/* Smooth transition progress indicator */}
            <div className="mb-5 px-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#5B6B82] mb-1.5">
                <span>Entering your trading dashboard...</span>
                <span className="text-[#0A6CFF]">100%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 animate-in slide-in-from-left w-full" />
              </div>
            </div>

            <Link
              href={redirectParam || '/dashboard'}
              className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PHASE 4: Standard Email Verified (Free Bronze tier)                        */}
        {/* ========================================================================= */}
        {phase === 'verify_success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
              Email Verified!
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              {redirectParam
                ? 'Your corporate account is now activated. Redirecting you to complete your WTB request...'
                : 'Your corporate account is now activated. Entering your dashboard...'}
            </p>
            <Link
              href={redirectParam || '/dashboard'}
              className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span>{redirectParam ? 'Continue to WTB Request' : 'Go to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] text-[#5B6B82]">
          Loading verification...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
