'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ShieldCheck,
  Send,
  RefreshCw,
} from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  // Mode: 'code' (email verification code) | 'old_password' (current password)
  const [mode, setMode] = useState<'code' | 'old_password'>('code');

  // Common inputs
  const [email, setEmail] = useState(emailParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Mode: Code states
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Mode: Old Password states
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);

  // Action states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync email param if passed in URL
  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [emailParam, email]);

  // Handle resend countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check if user came from a Supabase direct recovery magic link
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setCodeSent(true);
      }
    });
  }, []);

  // Handler: Send 6-digit OTP code to registered email
  const handleSendCode = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid registered corporate email address.');
      return;
    }

    setIsSendingCode(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to send verification code. Please try again.');
      } else {
        setCodeSent(true);
        setCountdown(60);
        setInfoMsg(`Verification code sent to ${cleanEmail}. Please enter the 6 digits below.`);
        // In local development, if devOtp provided, log for convenience
        if (data.devOtp) {
          console.info('[DEV OTP NOTIFICATION]', data.devOtp);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Handler: Submit Reset Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please retype carefully.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'code') {
        if (!code.trim()) {
          setErrorMsg('Please enter the 6-digit verification code sent to your email.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify_code_and_reset',
            email: cleanEmail,
            code: code.trim(),
            newPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          setErrorMsg(data.error || 'Verification failed. Please check the code and try again.');
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        }
      } else {
        // Mode === 'old_password'
        if (!oldPassword) {
          setErrorMsg('Please enter your current/old password.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_with_old_password',
            email: cleanEmail,
            oldPassword,
            newPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          setErrorMsg(data.error || 'Failed to update password. Please check your credentials.');
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 sm:py-16 font-sans">
      {/* Centered Logo */}
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

      {/* Card */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-7 sm:p-9">
        {success ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
              Password updated!
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6 leading-relaxed">
              Your account password has been reset successfully. Redirecting you to sign in...
            </p>
            <Link
              href="/login"
              className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span>Sign in now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>SECURITY RECOVERY</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Reset your password
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6 font-normal">
              Choose your preferred verification method to securely set a new password.
            </p>

            {/* Method Tabs */}
            <div className="flex rounded-2xl bg-[#F3F6FB] p-1 mb-6 border border-[#EAEFF6]">
              <button
                type="button"
                onClick={() => {
                  setMode('code');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'code'
                    ? 'bg-white text-[#0B1F3A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('old_password');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'old_password'
                    ? 'bg-white text-[#0B1F3A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Old Password</span>
              </button>
            </div>

            {/* Messages */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-[13px] text-blue-700">
                <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                  Registered account email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-2.5 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* MODE 1: EMAIL VERIFICATION CODE */}
              {mode === 'code' && (
                <>
                  {!codeSent ? (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={isSendingCode || !email.includes('@')}
                        className="w-full min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14.5px] flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-60 cursor-pointer"
                      >
                        {isSendingCode ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Sending verification code...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Send verification code to email</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Code Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[13.5px] font-bold text-[#0B1F3A]">
                            6-digit verification code
                          </label>
                          <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={isSendingCode || countdown > 0}
                            className="text-[12px] font-bold text-[#0A6CFF] hover:underline disabled:text-[#94A3B8] cursor-pointer"
                          >
                            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 592814"
                          className="w-full px-4 py-2.5 text-[18px] tracking-[0.25em] text-center font-mono font-bold bg-[#F8FAFC] border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] placeholder:tracking-normal focus:outline-none focus:border-[#0A6CFF] transition"
                        />
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                          New password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            className="w-full px-4 py-2.5 pr-11 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                          Confirm new password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your new password"
                            className="w-full px-4 py-2.5 pr-11 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                            title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-[12px] font-semibold text-red-600 mt-1">
                            Passwords do not match.
                          </p>
                        )}
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={loading || !code || !newPassword || newPassword !== confirmPassword}
                        className="w-full min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14.5px] flex items-center justify-center transition-colors shadow-xs mt-5 disabled:opacity-60 cursor-pointer"
                      >
                        {loading ? 'Verifying & resetting...' : 'Reset password with code'}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* MODE 2: OLD / CURRENT PASSWORD */}
              {mode === 'old_password' && (
                <>
                  {/* Old Password Input */}
                  <div>
                    <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                      Current / Old password
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-4 py-2.5 pr-11 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                        title={showOldPassword ? 'Hide password' : 'Show password'}
                      >
                        {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password Input */}
                  <div>
                    <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-4 py-2.5 pr-11 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password Input */}
                  <div>
                    <label className="block text-[13.5px] font-bold text-[#0B1F3A] mb-1.5">
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        className="w-full px-4 py-2.5 pr-11 text-[14.5px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[12px] font-semibold text-red-600 mt-1">
                        Passwords do not match.
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !oldPassword || !newPassword || newPassword !== confirmPassword}
                    className="w-full min-h-[46px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14.5px] flex items-center justify-center transition-colors shadow-xs mt-5 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? 'Updating password...' : 'Update password with old password'}
                  </button>
                </>
              )}
            </form>

            {/* Footer */}
            <div className="mt-7 pt-5 border-t border-[#EAEFF6] text-center text-[13.5px] text-[#5B6B82]">
              <Link href="/login" className="font-bold text-[#0A6CFF] hover:underline">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] text-[#5B6B82]">
          Loading security recovery...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
