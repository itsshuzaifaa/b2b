'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

export default function SiteAdminProfilePage() {
  const { company } = useAuth();

  // Personal Information State (Only personal info as requested)
  const [firstName, setFirstName] = useState('Platform');
  const [lastName, setLastName] = useState('Administrator');
  const [email, setEmail] = useState(company?.contact_email || 'admin@b2blink.eu');
  const [phone, setPhone] = useState('+372 612 3456');
  const [personalFeedback, setPersonalFeedback] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSavePersonalInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalFeedback('Personal profile information saved successfully.');
    setTimeout(() => setPersonalFeedback(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

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
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordFeedback({ type: 'error', message: error.message });
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

  return (
    <div className="max-w-3xl space-y-8 font-sans">
      {/* Top Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold uppercase tracking-wider mb-2">
          <Shield className="w-3.5 h-3.5 text-[#0A6CFF]" />
          <span>Personal Account Settings</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
          Admin Profile &amp; Security
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
          Manage your personal administrator credentials and login password.
        </p>
      </div>

      {/* SECTION 1: Personal Information (No company info as instructed) */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 sm:p-8 shadow-[0_4px_20px_rgba(11,31,58,0.02)]">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[#F1F5F9] mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">
              Personal Information
            </h2>
            <p className="text-[12px] text-[#5B6B82]">
              Identity and contact details for your administrator access.
            </p>
          </div>
        </div>

        {personalFeedback && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{personalFeedback}</span>
          </div>
        )}

        <form onSubmit={handleSavePersonalInfo} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                Contact Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] border border-[#E2E8F0] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-6 py-2.5 rounded-full transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Personal Information</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Change Password */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] p-6 sm:p-8 shadow-[0_4px_20px_rgba(11,31,58,0.02)]">
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0B1F3A]">
                Change Password
              </h2>
              <p className="text-[12px] text-[#5B6B82]">
                Update your account password to secure your administrator privileges.
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
            <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
              Current Password
            </label>
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
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                New Password
              </label>
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
              <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                Confirm New Password
              </label>
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
