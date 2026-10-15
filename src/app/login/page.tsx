'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, type DemoRoleType } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Mail, Eye, EyeOff } from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { switchDemoRole, refreshProfile, setAuthenticatedUser } = useAuth();

  // Mode: 'signin' or 'forgot_password'
  const [mode, setMode] = useState<'signin' | 'forgot_password'>('signin');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Incorrect username/email or password.');
        } else {
          setErrorMsg(error.message);
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_demo_role');
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
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setForgotError(null);
                      setForgotSuccess(false);
                      if (identifier.includes('@')) {
                        setForgotEmail(identifier);
                      }
                    }}
                    className="text-[14px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    Forgot password?
                  </button>
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
