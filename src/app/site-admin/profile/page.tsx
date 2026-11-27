'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  Save,
  Camera,
} from 'lucide-react';

export default function SiteAdminProfilePage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [personalFeedback, setPersonalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile) {
          setFullName(data.profile.full_name || '');
          setEmail(data.profile.email || '');
          setPhone(data.profile.phone || '');
          setJobTitle(data.profile.job_title || '');
          setAvatarUrl(data.profile.avatar_url || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPersonalFeedback({ type: 'error', message: 'Profile picture must be under 5 MB.' });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalFeedback(null);
    setSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('phone', phone.trim());
      formData.append('jobTitle', jobTitle.trim());
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPersonalFeedback({ type: 'error', message: data.error || 'Failed to save profile.' });
      } else {
        if (data.profile?.avatar_url) {
          setAvatarUrl(data.profile.avatar_url);
          setAvatarPreview(null);
          setAvatarFile(null);
        }
        setPersonalFeedback({ type: 'success', message: 'Personal profile information saved successfully.' });
        setTimeout(() => setPersonalFeedback(null), 4000);
      }
    } catch (err) {
      setPersonalFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'Please enter your current password.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match. Please verify.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_with_old_password',
          email,
          oldPassword: currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setPasswordFeedback({ type: 'error', message: data.error || 'Failed to update password.' });
      } else {
        setPasswordFeedback({ type: 'success', message: 'Password has been updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const displayAvatar = avatarPreview || avatarUrl;

  return (
    <div className="max-w-3xl space-y-8 font-sans">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold uppercase tracking-wider mb-2">
          <Shield className="w-3.5 h-3.5 text-[#0A6CFF]" />
          <span>Personal Account Settings</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
          Admin Profile &amp; Security
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
          Manage your personal administrator details, profile picture, and login password.
        </p>
      </div>

      {/* SECTION 1: Personal Information */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 sm:p-8 shadow-[0_4px_20px_rgba(11,31,58,0.02)]">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[#F1F5F9] mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">Personal Information</h2>
            <p className="text-[12px] text-[#5B6B82]">
              Identity and contact details for your administrator access.
            </p>
          </div>
        </div>

        {personalFeedback && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-[13px] font-semibold flex items-center gap-2 ${
              personalFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {personalFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{personalFeedback.message}</span>
          </div>
        )}

        {loadingProfile ? (
          <div className="py-8 text-center text-[13px] text-[#5B6B82]">Loading profile...</div>
        ) : (
          <form onSubmit={handleSavePersonalInfo} className="space-y-5">
            {/* Avatar Picker */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Admin avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold">
                    {(fullName || email || 'AD').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] text-[12.5px] font-bold cursor-pointer transition">
                  <Camera className="w-4 h-4 text-[#0A6CFF]" />
                  <span>{displayAvatar ? 'Change Profile Picture' : 'Upload Profile Picture'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-[#64748B] mt-1">JPG, PNG, or WebP up to 5 MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Platform Administrator"
                  className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Admin Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] bg-slate-50 rounded-xl text-[#5B6B82] font-medium"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+372 612 3456"
                  className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Saving...' : 'Save Personal Information'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SECTION 2: Change Password */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 sm:p-8 shadow-[0_4px_20px_rgba(11,31,58,0.02)]">
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">Change Password</h2>
              <p className="text-[12px] text-[#5B6B82]">
                Verify your current password to set a new administrator password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-[12px] font-bold text-[#0A6CFF] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showPasswords ? 'Hide passwords' : 'Show passwords'}</span>
          </button>
        </div>

        {passwordFeedback && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center gap-2 text-[13px] font-semibold ${
              passwordFeedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {passwordFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{passwordFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Current Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="bg-[#0B1F3A] hover:bg-[#132A4C] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4 text-[#00E5FF]" />
              <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
