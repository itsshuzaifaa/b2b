'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { AlertCircle, CheckCircle2, Mail, RefreshCw, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { switchDemoRole, refreshProfile, setAuthenticatedUser } = useAuth();

  const email = searchParams.get('email') || '';
  const role = searchParams.get('role') || 'buyer';
  const redirectParam = searchParams.get('redirect');

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Resend Cooldown Timer (60 seconds)
  const [countdown, setCountdown] = useState<number>(60);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp.trim()) {
      setErrorMsg('Please enter the verification code from your email.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const cleanOtp = otp.trim().replace(/\s+/g, '');

      // Verify OTP with Supabase Auth (tries magiclink then signup)
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

      if (verifyResult.error) {
        setErrorMsg(verifyResult.error.message || 'Invalid or expired verification code. Please check and try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('b2b_demo_role');
      }
      if (verifyResult.data?.user) {
        setAuthenticatedUser(verifyResult.data.user);
      }
      setTimeout(() => {
        router.push(redirectParam || '/dashboard');
      }, 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

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
        setResendNotice('New verification code sent! Please check your inbox.');
        setCountdown(60);
      }
    } catch {
      setErrorMsg('Could not send code. Please try again.');
    } finally {
      setResending(false);
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
      <div className="w-full max-w-[460px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10 transition-all">
        {success ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
              Email Verified!
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
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
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EBF3FF] border border-[#D0E2FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-5">
              <Mail className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                SECURITY VERIFICATION
              </div>
              <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
                Check your inbox
              </h1>
              <p className="text-[14px] text-[#5B6B82] leading-relaxed">
                We sent a verification code to{' '}
                <strong className="text-[#0B1F3A] font-bold block sm:inline">{email || 'your email'}</strong>.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resend Notice */}
            {resendNotice && (
              <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-[13px] text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{resendNotice}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] text-center mb-2">
                  Enter verification code
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={12}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder="Enter code"
                  className="w-full px-4 py-3.5 text-[22px] tracking-[0.2em] text-center font-mono font-bold bg-[#F8FAFF] border-2 border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#0A6CFF] focus:bg-white transition"
                />
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={loading || !otp.trim()}
                className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs mt-6 disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Verifying code...' : 'Verify & Continue'}
              </button>
            </form>

            {/* Resend Code Section */}
            <div className="mt-6 pt-5 border-t border-[#EAEFF6] text-center text-[13px] text-[#5B6B82]">
              {countdown > 0 ? (
                <p>
                  Didn’t receive the code? Resend in{' '}
                  <span className="font-bold text-[#0B1F3A]">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 font-bold text-[#0A6CFF] hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>Resend verification code</span>
                </button>
              )}
            </div>

            {/* Change Email / Back link */}
            <div className="mt-4 text-center text-[13px] text-[#5B6B82]">
              <Link href="/register" className="font-semibold hover:text-[#0B1F3A] hover:underline">
                Wrong email? Return to registration
              </Link>
            </div>
          </>
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
