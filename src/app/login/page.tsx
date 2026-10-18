'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, type DemoRoleType } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Mail, Eye, EyeOff, RefreshCw, Clock } from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { switchDemoRole, refreshProfile, setAuthenticatedUser } = useAuth();

  // Mode: 'signin' | 'forgot_password' | 'verify_code'
  const [mode, setMode] = useState<'signin' | 'forgot_password' | 'verify_code'>('signin');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verification Code State (for unconfirmed users or users whose window closed during verification)
  const [verifyEmail, setVerifyEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Resend cooldown timer (1 minute = 60 seconds)
  const [countdown, setCountdown] = useState<number>(60);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  // Code expiration timer (15 minutes = 900 seconds)
  const [codeExpiresIn, setCodeExpiresIn] = useState<number>(15 * 60);

  // Format MM:SS helper
  const formatTime = (totalSeconds: number) => {
    const mins = Math.max(0, Math.floor(totalSeconds / 60));
    const secs = Math.max(0, totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check URL params or localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPendingEmail = localStorage.getItem('b2b_pending_verification_email');
      const paramVerify = searchParams.get('verify');
      const paramEmail = searchParams.get('email');

      if (paramVerify === 'true' || searchParams.get('mode') === 'verify') {
        const initialEmail = paramEmail || storedPendingEmail || '';
        if (initialEmail) {
          setVerifyEmail(initialEmail);
        }
        setMode('verify_code');
        setCodeExpiresIn(15 * 60);
      } else if (storedPendingEmail && !identifier) {
        setIdentifier(storedPendingEmail);
        setVerifyEmail(storedPendingEmail);
      }
    }
  }, [searchParams]);

  // Countdown timer for resending code (1 minute)
  useEffect(() => {
    if (countdown > 0 && mode === 'verify_code') {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, mode]);

  // Countdown timer for code expiration (15 minutes)
  useEffect(() => {
    if (codeExpiresIn > 0 && mode === 'verify_code') {
      const timer = setTimeout(() => setCodeExpiresIn(codeExpiresIn - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeExpiresIn, mode]);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Demo Switcher State
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const cleanIdentifier = identifier.trim();
      let resolvedEmail = cleanIdentifier;

      // If user typed a username (no '@'), resolve it to their account email
      if (!cleanIdentifier.includes('@')) {
        const lookupRes = await fetch('/api/auth/lookup-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanIdentifier }),
        });

        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.email) {
          setErrorMsg(lookupData.error || `No account found with username "${cleanIdentifier}".`);
          setLoading(false);
          return;
        }

        resolvedEmail = lookupData.email;
      }

      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        const errorMsgLower = (error.message || '').toLowerCase();
        const errorCode = (error as any).code || '';

        // If credentials are valid but account email has not been confirmed yet:
        if (
          errorCode === 'email_not_confirmed' ||
          errorMsgLower.includes('email not confirmed') ||
          errorMsgLower.includes('not confirmed')
        ) {
          setVerifyEmail(resolvedEmail);
          setMode('verify_code');
          setErrorMsg(null);
          setVerifyError(null);
          setOtp('');
          setResendNotice(null);
          setCountdown(60);
          setLoading(false);
          return;
        }

        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Incorrect username/email or password.');
        } else {
          setErrorMsg(error.message);
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_demo_role');
          localStorage.removeItem('b2b_pending_verification_email');
          sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_buyer');
          sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_guest');
        }
        if (authData?.user) {
          setAuthenticatedUser(authData.user);
        }
        router.push(redirectUrl || '/dashboard');
        router.refresh();
        return;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = verifyEmail.trim().toLowerCase();
    const cleanOtp = otp.trim().replace(/\s+/g, '');

    if (!targetEmail || !targetEmail.includes('@')) {
      setVerifyError('Please enter a valid corporate email address.');
      return;
    }

    if (!cleanOtp) {
      setVerifyError('Please enter the verification code from your email.');
      return;
    }

    if (codeExpiresIn <= 0) {
      setVerifyError('This verification code has expired (15-minute limit). Please click "Resend verification code" below to receive a new code.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      // Strictly validate with server verification store (enforcing 15-minute expiration & latest-code rule)
      const serverRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, code: cleanOtp }),
      });
      const serverData = await serverRes.json();
      if (!serverRes.ok) {
        setVerifyError(serverData.error || 'Invalid or expired verification code. Please check and try again.');
        setVerifyLoading(false);
        return;
      }

      const supabase = createClient();

      // Verify OTP with Supabase Auth (tries magiclink then signup)
      let verifyResult = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: cleanOtp,
        type: 'magiclink',
      });

      if (verifyResult.error) {
        verifyResult = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: cleanOtp,
          type: 'signup',
        });
      }

      if (verifyResult.error && !serverData.success) {
        setVerifyError(verifyResult.error.message || 'Invalid or expired verification code. Please check and try again.');
        setVerifyLoading(false);
        return;
      }

      // Success! Clear any local demo role and pending markers
      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2b_demo_role');
        localStorage.removeItem('b2b_pending_verification_email');
        sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_buyer');
        sessionStorage.removeItem('b2b_buyer_welcome_modal_seen_guest');
      }

      // Dispatch business verification documents email (KYC)
      try {
        await fetch('/api/auth/dispatch-kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail }),
        });
      } catch (kycErr) {
        console.warn('[KYC DISPATCH NOTICE]', kycErr);
      }

      if (verifyResult.data?.user) {
        setAuthenticatedUser(verifyResult.data.user);
      }

      router.push(redirectUrl || '/dashboard');
      router.refresh();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Failed to verify code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    const targetEmail = verifyEmail.trim().toLowerCase();
    if (!targetEmail || countdown > 0 || resending) return;

    setResending(true);
    setVerifyError(null);
    setResendNotice(null);

    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || 'Failed to resend code.');
      } else {
        setResendNotice(`A new verification code has been sent to ${targetEmail}. Any previous code has now expired.`);
        setCountdown(60); // 1 minute cooldown to request another code
        setCodeExpiresIn(15 * 60); // Fresh 15-minute validity for the new code
        setOtp('');
      }
    } catch {
      setVerifyError('Could not send code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    try {
      const cleanEmail = forgotEmail.trim().toLowerCase();
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Failed to send password reset email.');
      } else {
        setForgotSuccess(true);
      }
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleQuickDemoLogin = (role: DemoRoleType) => {
    switchDemoRole(role);
    if (redirectUrl) {
      router.push(redirectUrl);
    } else if (role === 'admin') {
      router.push('/site-admin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-14 sm:py-20 font-sans">
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

      {/* Main Card */}
      <div className="w-full max-w-[440px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10 transition-all">
        {mode === 'signin' ? (
          <>
            {/* Title & Subtitle */}
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Welcome back
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-7 font-normal">
              Sign in with your username or email address.
            </p>

            {/* Error Alert if any */}
            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Username or Email Address */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Username or email address
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. trader_nordic or name@company.eu"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Password with interactive Forgot Password Link */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[14px] font-bold text-[#0B1F3A]">
                    Password
                  </label>
                  <Link
                    href={identifier.includes('@') ? `/reset-password?email=${encodeURIComponent(identifier)}` : '/reset-password'}
                    className="text-[14px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full px-4 py-3 pr-11 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs mt-6 disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              {/* Pending Verification Code helper link */}
              <div className="mt-3.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (identifier && identifier.includes('@')) {
                      setVerifyEmail(identifier.trim().toLowerCase());
                    }
                    setMode('verify_code');
                    setErrorMsg(null);
                    setVerifyError(null);
                  }}
                  className="text-[13px] text-[#5B6B82] hover:text-[#0A6CFF] transition font-medium cursor-pointer"
                >
                  Pending account verification?{' '}
                  <span className="font-bold underline underline-offset-2 text-[#0A6CFF]">
                    Enter code to log in
                  </span>
                </button>
              </div>
            </form>

            {/* Card Footer: New to B2B LINK? Create an account */}
            <div className="mt-8 pt-6 border-t border-[#EAEFF6] text-center text-[14px] text-[#5B6B82]">
              <span>New to B2B LINK? </span>
              <Link
                href={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
                className="font-bold text-[#0A6CFF] hover:underline"
              >
                Create an account
              </Link>
            </div>
          </>
        ) : mode === 'verify_code' ? (
          /* VERIFICATION CODE MODE (For unconfirmed users upon signing in) */
          <div>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setVerifyError(null);
                setResendNotice(null);
              }}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#5B6B82] hover:text-[#0B1F3A] mb-5 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to sign in</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-[#EBF3FF] border border-[#D0E2FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-1.5">
                SECURITY VERIFICATION
              </div>
              <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
                Enter verification code
              </h1>
              <p className="text-[14px] text-[#5B6B82] leading-relaxed">
                Your account is registered! Please enter the 6-digit verification code sent to{' '}
                <strong className="text-[#0B1F3A] font-bold block sm:inline">
                  {verifyEmail || 'your email'}
                </strong>{' '}
                to complete sign in.
              </p>
            </div>

            {/* Error Alert */}
            {verifyError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            {/* Resend Notice */}
            {resendNotice && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-[13px] text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{resendNotice}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleVerifyCode} className="space-y-5">
              {!verifyEmail && (
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    Registered email address
                  </label>
                  <input
                    type="email"
                    required
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value.trim().toLowerCase())}
                    placeholder="name@company.eu"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-[13px] mb-2 px-0.5">
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

              <button
                type="submit"
                disabled={verifyLoading || !otp.trim() || !verifyEmail.trim() || codeExpiresIn <= 0}
                className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs mt-6 disabled:opacity-60 cursor-pointer"
              >
                {verifyLoading ? 'Verifying & signing in...' : 'Confirm Code & Log In'}
              </button>
            </form>

            {/* Resend Section */}
            <div className="mt-6 pt-5 border-t border-[#EAEFF6] text-center text-[13px] text-[#5B6B82]">
              {countdown > 0 ? (
                <p>
                  Didn’t receive the code? Resend in{' '}
                  <span className="font-bold text-[#0B1F3A] font-mono">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending || !verifyEmail.trim()}
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

            {/* Alternative link */}
            <div className="mt-4 pt-3 text-center text-[13px] text-[#5B6B82]">
              <button
                type="button"
                onClick={() => {
                  setVerifyEmail('');
                  setMode('signin');
                }}
                className="hover:text-[#0B1F3A] hover:underline"
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        ) : (
          /* FORGOT PASSWORD MODE */
          <div>
            {forgotSuccess ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 text-[#0A6CFF] flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7" />
                </div>
                <h2 className="text-[24px] sm:text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
                  Check your email
                </h2>
                <p className="text-[14px] text-[#5B6B82] mb-6 leading-relaxed">
                  We have sent a verification and password reset link to{' '}
                  <strong className="text-[#0B1F3A] font-bold">{forgotEmail}</strong>.
                  Please check your inbox (and spam folder) to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setForgotSuccess(false);
                    setErrorMsg(null);
                  }}
                  className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  Return to sign in
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setForgotError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#5B6B82] hover:text-[#0B1F3A] mb-5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to sign in</span>
                </button>

                <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  PASSWORD RECOVERY
                </div>
                <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  Reset your password
                </h1>
                <p className="text-[14px] text-[#5B6B82] mb-6 font-normal">
                  Type your registered account email. If an account exists, we will send you a verification link to reset your password.
                </p>

                {forgotError && (
                  <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                      Registered email address
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@company.eu"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs mt-6 disabled:opacity-60 cursor-pointer"
                  >
                    {forgotLoading ? 'Verifying account...' : 'Send Verification Email'}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-[#EAEFF6] text-center text-[14px] text-[#5B6B82]">
                  <span>Remember your password? </span>
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="font-bold text-[#0A6CFF] hover:underline"
                  >
                    Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] text-[#5B6B82]">
          Loading sign in...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
