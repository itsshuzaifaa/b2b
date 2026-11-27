'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldCheck,
  User,
  Phone,
  Briefcase,
  Camera,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
} from 'lucide-react';

function StaffSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [permissionLabels, setPermissionLabels] = useState<string[]>([]);

  // Setup form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Avatar file & preview
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError('Missing invitation token. Please open the exact link from your invitation email.');
      setValidating(false);
      return;
    }

    fetch(`/api/auth/staff-setup?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setTokenError(data.error || 'This invitation link is invalid or has expired.');
        } else {
          setInvitedEmail(data.email || '');
          setPermissionLabels(Array.isArray(data.permissionLabels) ? data.permissionLabels : []);
        }
      })
      .catch(() => {
        setTokenError('Unable to verify invitation right now. Please try again.');
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Profile picture must be smaller than 5 MB.');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (fullName.trim().length < 2) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('fullName', fullName.trim());
      formData.append('phone', phone.trim());
      formData.append('jobTitle', jobTitle.trim());
      formData.append('password', password);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch('/api/auth/staff-setup', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to complete account setup.');
        setSubmitting(false);
        return;
      }

      // Sign in automatically with the newly set password
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email || invitedEmail,
        password,
      });

      setSuccessMsg('Account activated! Redirecting you to the Admin Portal...');
      setTimeout(() => {
        if (!signInErr) {
          router.push(data.landingRoute || '/site-admin');
          router.refresh();
        } else {
          router.push('/login?redirect=/site-admin');
        }
      }, 1200);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 font-sans">
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

      <div className="w-full max-w-[540px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10">
        {validating ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-9 h-9 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[14px] font-semibold text-[#5B6B82]">Verifying your staff invitation...</p>
          </div>
        ) : tokenError ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-[22px] font-extrabold text-[#0B1F3A]">Invitation Unavailable</h1>
            <p className="text-[14px] text-[#5B6B82] leading-relaxed">{tokenError}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[14px] transition"
            >
              <span>Go to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : successMsg ? (
          <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-[24px] font-extrabold text-[#0B1F3A]">Welcome to the Team!</h1>
            <p className="text-[14px] text-[#5B6B82]">{successMsg}</p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#0A6CFF] text-[11px] font-extrabold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Staff Account Onboarding</span>
            </div>

            <h1 className="text-[26px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
              Set Up Your Staff Profile
            </h1>
            <p className="text-[14px] text-[#5B6B82] mt-1 mb-6">
              Invited email: <strong className="text-[#0B1F3A]">{invitedEmail}</strong>
            </p>

            {/* Granted Permissions Preview */}
            {permissionLabels.length > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0A6CFF] mb-2">
                  Assigned Admin Permissions ({permissionLabels.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {permissionLabels.slice(0, 8).map((lbl) => (
                    <span
                      key={lbl}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[#0B1F3A]"
                    >
                      {lbl}
                    </span>
                  ))}
                  {permissionLabels.length > 8 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#0A6CFF]">
                      +{permissionLabels.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {submitError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Profile Picture Picker */}
              <div className="flex items-center gap-4 pb-2">
                <div className="w-16 h-16 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-slate-300" />
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] text-[12.5px] font-bold cursor-pointer transition">
                    <Camera className="w-4 h-4 text-[#0A6CFF]" />
                    <span>{avatarFile ? 'Change Profile Picture' : 'Upload Profile Picture'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-1">Optional. JPG, PNG or WebP up to 5 MB.</p>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Full Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Job Title / Role</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Operations Analyst"
                      className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                    />
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Phone Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+44 20 7946 0921"
                      className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Create Password * <span className="text-xs font-normal text-slate-500">(min 8 chars)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
                    className="w-full pl-10 pr-11 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-md shadow-[#0A6CFF]/20 cursor-pointer disabled:opacity-60 mt-2"
              >
                <span>{submitting ? 'Activating Staff Account...' : 'Complete Setup & Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function StaffSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#0A6CFF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StaffSetupContent />
    </Suspense>
  );
}
