'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  CheckCircle2,
  Upload,
  ShieldCheck,
  User,
  Mail,
  Phone,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react';

const PRESET_LOGOS = [
  { label: 'Nordic Tech', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200' },
  { label: 'Electro Blue', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200' },
  { label: 'Global Trade', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200' },
];

export default function DashboardProfilePage() {
  const router = useRouter();
  const { company, role, demoRole, updateProfile } = useAuth();
  const isBuyer = role === 'buyer' || company?.role === 'buyer' || demoRole === 'buyer';

  // Form states
  const [tradeName, setTradeName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [aboutCompany, setAboutCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Password Reset states
  const [pwdMode, setPwdMode] = useState<'old_password' | 'code'>('old_password');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdCode, setPwdCode] = useState('');
  const [isSendingPwdCode, setIsSendingPwdCode] = useState(false);
  const [pwdCodeSent, setPwdCodeSent] = useState(false);
  const [pwdCountdown, setPwdCountdown] = useState(0);
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Countdown for code resend
  useEffect(() => {
    if (pwdCountdown > 0) {
      const t = setTimeout(() => setPwdCountdown(pwdCountdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [pwdCountdown]);

  const handleSendPwdCode = async () => {
    setPwdError(null);
    setPwdSuccess(null);
    const targetEmail = (corporateEmail || company?.email || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setPwdError('Please enter a valid corporate email address in your profile first.');
      return;
    }
    setIsSendingPwdCode(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_code', email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPwdError(data.error || 'Failed to dispatch verification code.');
      } else {
        setPwdCodeSent(true);
        setPwdCountdown(60);
        setPwdSuccess(`6-digit verification code sent to ${targetEmail}. Please check your inbox.`);
      }
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setIsSendingPwdCode(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    const targetEmail = (corporateEmail || company?.email || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setPwdError('Valid email is required to update password.');
      return;
    }

    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match. Please verify.');
      return;
    }

    setIsUpdatingPwd(true);
    try {
      if (pwdMode === 'old_password') {
        if (!oldPassword) {
          setPwdError('Please enter your current password.');
          setIsUpdatingPwd(false);
          return;
        }

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_with_old_password',
            email: targetEmail,
            oldPassword,
            newPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          setPwdError(data.error || 'Incorrect current password or update failed.');
        } else {
          setPwdSuccess('Your password has been changed successfully!');
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }
      } else {
        // Mode === 'code'
        if (!pwdCode.trim()) {
          setPwdError('Please enter the 6-digit verification code sent to your email.');
          setIsUpdatingPwd(false);
          return;
        }

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify_code_and_reset',
            email: targetEmail,
            code: pwdCode.trim(),
            newPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          setPwdError(data.error || 'Invalid code or reset failed.');
        } else {
          setPwdSuccess('Your password has been reset successfully!');
          setPwdCode('');
          setNewPassword('');
          setConfirmPassword('');
          setPwdCodeSent(false);
        }
      }
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'An error occurred while updating password.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  // Sync initial state from real auth company
  useEffect(() => {
    if (company) {
      const isBuyerAccount = role === 'buyer' || company.role === 'buyer' || demoRole === 'buyer';
      const initialName = company.contact_name || company.name || (isBuyerAccount ? 'Buyer Member' : '');
      setContactPerson(initialName);
      setTradeName(company.company_name || company.name || '');
      setCorporateEmail(company.contact_email || company.email || '');
      setPhoneWhatsApp(company.phone || '');

      if (!isBuyerAccount) {
        setRegNumber(company.company_number || '');
        setVatNumber(company.vat_number || '');
        setAboutCompany(company.address || '');
      } else {
        setRegNumber('');
        setVatNumber('');
        setAboutCompany('');
      }

      if (company.website && (company.website.startsWith('http') || company.website.startsWith('data:image'))) {
        setLogoUrl(company.website);
      } else {
        setLogoUrl('');
      }
    }
  }, [company, role, demoRole]);

  // Compute 2-letter monogram for avatar fallback
  const effectiveName = isBuyer ? contactPerson : tradeName;
  const monogram =
    (effectiveName || 'User')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || (isBuyer ? 'BY' : 'NE');

  // Handle local file upload for logo / avatar
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be under 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (isBuyer) {
        await updateProfile({
          name: contactPerson.trim(),
          contact_name: contactPerson.trim(),
          email: corporateEmail.trim(),
          phone: phoneWhatsApp.trim(),
          website: logoUrl.trim() || undefined,
          company_number: null,
          vat_number: null,
          address: null,
        });
      } else {
        await updateProfile({
          name: tradeName.trim(),
          contact_name: contactPerson.trim(),
          email: corporateEmail.trim(),
          phone: phoneWhatsApp.trim(),
          vat_number: vatNumber.trim(),
          company_number: regNumber.trim(),
          address: aboutCompany.trim(),
          website: logoUrl.trim() || undefined,
        });
      }

      setSavedNotice(true);
      setTimeout(() => {
        setSavedNotice(false);
      }, 3000);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  const membershipTier = (company?.tier || company?.membership_tier || 'silver').toUpperCase();

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Edit profile
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            {isBuyer
              ? 'Updates to your personal name and contact details take effect in real time.'
              : 'Updates to your company name, logo, and contact details take effect in real time.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="bg-white hover:bg-[#F8FAFC] text-[#0B1F3A] border border-[#EAEFF6] font-bold text-[13px] px-6 py-2.5 rounded-full transition cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-6 py-2.5 rounded-full transition cursor-pointer shadow-xs disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[14px] font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            {isBuyer
              ? 'Personal profile changes updated across your account and inquiries!'
              : 'Profile changes updated across your account, sidebar, and buyer catalog views!'}
          </span>
        </div>
      )}

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-7">
        {/* LEFT COLUMN: Profile Form + Password Security Card (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <form onSubmit={handleSave} className="space-y-8">
          {isBuyer ? (
            /* ======================================================== */
            /* BUYER FORM: PERSONAL INFORMATION ONLY                   */
            /* ======================================================== */
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-1 border-b border-[#F1F5F9]">
                <User className="w-4 h-4 text-[#0A6CFF]" />
                <h2 className="text-[16px] font-bold text-[#0B1F3A]">Personal Information</h2>
              </div>

              {/* Profile Photo / Avatar Upload Block */}
              <div className="flex items-center gap-5 p-4.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                <div className="relative w-16 h-16 rounded-full bg-[#0A6CFF] text-white font-extrabold text-[20px] flex items-center justify-center shrink-0 tracking-wider shadow-xs overflow-hidden border-2 border-white ring-2 ring-[#EAEFF6]">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Profile Photo" fill className="object-cover" />
                  ) : (
                    <span>{monogram}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoFileChange}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white hover:bg-[#F8FAFC] border border-[#EAEFF6] text-[#0B1F3A] font-bold text-[13px] px-4 py-2 rounded-full cursor-pointer transition shadow-2xs flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#0A6CFF]" />
                      <span>Upload Profile Photo</span>
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="text-[12px] text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        Reset to Monogram
                      </button>
                    )}
                  </div>

                  <p className="text-[12px] text-[#8A9BB0] mt-1.5 font-medium">
                    PNG or JPG, square works best. Max 5MB.
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Full name *
                </label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Email Address & Phone (2-col) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Email address *
                  </label>
                  <input
                    type="email"
                    required
                    value={corporateEmail}
                    onChange={(e) => setCorporateEmail(e.target.value)}
                    placeholder="e.g. name@example.com"
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phoneWhatsApp}
                    onChange={(e) => setPhoneWhatsApp(e.target.value)}
                    placeholder="e.g. +44 7911 123456"
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] text-[13px] text-[#5B6B82] leading-relaxed">
                <span className="font-semibold text-[#0B1F3A]">Buyer Account Note:</span> Company trade name, corporate registration number, and VAT details are not required for buyer accounts. We only maintain your personal contact details to manage communications with suppliers.
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* SELLER FORM: FULL COMPANY & CONTACT PROFILE             */
            /* ======================================================== */
            <>
              {/* Section 1: Company */}
              <div className="space-y-5">
                <h2 className="text-[16px] font-bold text-[#0B1F3A]">Company Profile</h2>

                {/* Logo Upload Block */}
                <div className="flex items-center gap-5 p-4.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                  {/* Logo / Monogram Box */}
                  <div className="relative w-16 h-16 rounded-2xl bg-[#0B1F3A] text-white font-extrabold text-[20px] flex items-center justify-center shrink-0 tracking-wider shadow-xs overflow-hidden border border-[#EAEFF6]">
                    {logoUrl ? (
                      <Image src={logoUrl} alt="Company Logo" fill className="object-cover" />
                    ) : (
                      <span>{monogram}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileChange}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white hover:bg-[#F8FAFC] border border-[#EAEFF6] text-[#0B1F3A] font-bold text-[13px] px-4 py-2 rounded-full cursor-pointer transition shadow-2xs flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#0A6CFF]" />
                        <span>Upload Logo File</span>
                      </button>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-[12px] text-red-600 hover:underline font-semibold cursor-pointer"
                        >
                          Reset to Monogram
                        </button>
                      )}
                    </div>

                    <p className="text-[12px] text-[#8A9BB0] mt-1.5 font-medium">
                      PNG or JPG, square works best. Max 5MB.
                    </p>
                  </div>
                </div>

                {/* Company Trade Name */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Company trade name *
                  </label>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>

                {/* Registration & VAT Numbers (2-col) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Company registration number
                    </label>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      EU / UK VAT number
                    </label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                </div>

                {/* About Your Company */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    About your company &amp; supply terms
                  </label>
                  <textarea
                    rows={3}
                    value={aboutCompany}
                    onChange={(e) => setAboutCompany(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Section 2: Contact */}
              <div className="space-y-5 pt-4">
                <h2 className="text-[16px] font-bold text-[#0B1F3A]">Authorized Representative &amp; Contact</h2>

                {/* Contact Person & Email (2-col) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Contact person name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Corporate email address *
                    </label>
                    <input
                      type="email"
                      required
                      value={corporateEmail}
                      onChange={(e) => setCorporateEmail(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                </div>

                {/* Phone / WhatsApp */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phoneWhatsApp}
                    onChange={(e) => setPhoneWhatsApp(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] shadow-xs cursor-pointer transition disabled:opacity-60"
          >
            {isSaving ? 'Updating Profile...' : isBuyer ? 'Save Personal Profile' : 'Save Profile Changes'}
          </button>
        </form>

          {/* PASSWORD & SECURITY CARD */}
          <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-7 sm:p-8 shadow-[0_4px_20px_rgba(11,31,58,0.03)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0A6CFF] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-[#0B1F3A]">Password & Security</h2>
                  <p className="text-[12.5px] text-[#5B6B82]">
                    Reset or change password for account <strong className="text-[#0B1F3A]">{corporateEmail || company?.email || 'your account'}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Tabs: Old Password vs Email Verification Code */}
            <div className="flex rounded-2xl bg-[#F3F6FB] p-1 mb-5 border border-[#EAEFF6] max-w-md">
              <button
                type="button"
                onClick={() => {
                  setPwdMode('old_password');
                  setPwdError(null);
                  setPwdSuccess(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-[12.5px] font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  pwdMode === 'old_password'
                    ? 'bg-white text-[#0B1F3A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Current Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPwdMode('code');
                  setPwdError(null);
                  setPwdSuccess(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-[12.5px] font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  pwdMode === 'code'
                    ? 'bg-white text-[#0B1F3A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Verification Code</span>
              </button>
            </div>

            {/* Status alerts */}
            {pwdError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-[13px] text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {pwdMode === 'old_password' ? (
                /* METHOD 1: CURRENT / OLD PASSWORD */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                      Current password *
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPwd ? 'text' : 'password'}
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full px-4 py-2.5 pr-11 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPwd(!showOldPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                        title={showOldPwd ? 'Hide' : 'Show'}
                      >
                        {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        New password *
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPwd ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full px-4 py-2.5 pr-11 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPwd(!showNewPwd)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                          title={showNewPwd ? 'Hide' : 'Show'}
                        >
                          {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Confirm new password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPwd ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full px-4 py-2.5 pr-11 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                          title={showConfirmPwd ? 'Hide' : 'Show'}
                        >
                          {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPwd || !oldPassword || !newPassword || newPassword !== confirmPassword}
                    className="py-3 px-6 rounded-full bg-[#0B1F3A] hover:bg-[#08172b] text-white font-bold text-[13px] shadow-xs cursor-pointer transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isUpdatingPwd ? 'Updating password...' : 'Update Password using Old Password'}
                  </button>
                </div>
              ) : (
                /* METHOD 2: EMAIL VERIFICATION CODE */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                    <div>
                      <div className="text-[12px] font-bold text-[#8A9BB0] uppercase tracking-wider">
                        Registered email
                      </div>
                      <div className="text-[14px] font-bold text-[#0B1F3A] mt-0.5">
                        {corporateEmail || company?.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendPwdCode}
                      disabled={isSendingPwdCode || pwdCountdown > 0}
                      className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      {isSendingPwdCode ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : pwdCountdown > 0 ? (
                        <span>Resend in {pwdCountdown}s</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{pwdCodeSent ? 'Resend code' : 'Send verification code'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {pwdCodeSent && (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                          6-digit verification code from email *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={pwdCode}
                          onChange={(e) => setPwdCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 849201"
                          className="w-full max-w-[220px] px-4 py-2.5 text-[18px] tracking-[0.25em] text-center font-mono font-bold bg-[#F8FAFC] border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                            New password *
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPwd ? 'text' : 'password'}
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Min 6 characters"
                              className="w-full px-4 py-2.5 pr-11 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPwd(!showNewPwd)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                              title={showNewPwd ? 'Hide' : 'Show'}
                            >
                              {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                            Confirm new password *
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPwd ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className="w-full px-4 py-2.5 pr-11 text-[14px] bg-white border border-[#EAEFF6] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                              title={showConfirmPwd ? 'Hide' : 'Show'}
                            >
                              {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isUpdatingPwd || !pwdCode || !newPassword || newPassword !== confirmPassword}
                        className="py-3 px-6 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] shadow-xs cursor-pointer transition disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {isUpdatingPwd ? 'Verifying & resetting...' : 'Confirm & Reset Password with Code'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Preview Card (4 Cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-7 text-center shadow-[0_4px_20px_rgba(11,31,58,0.03)] sticky top-6">
            {isBuyer ? (
              /* ======================================================== */
              /* BUYER PREVIEW: PERSONAL PROFILE ONLY                    */
              /* ======================================================== */
              <>
                {/* Centered User Avatar */}
                <div className="relative w-20 h-20 rounded-full bg-[#0A6CFF] text-white font-extrabold text-[24px] flex items-center justify-center mx-auto mb-4 tracking-wider shadow-xs overflow-hidden border-2 border-white ring-2 ring-[#EAEFF6]">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Profile preview" fill className="object-cover" />
                  ) : (
                    <span>{monogram}</span>
                  )}
                </div>

                {/* Full Name & Role */}
                <h3 className="text-[19px] font-extrabold text-[#0B1F3A] leading-snug">
                  {contactPerson || 'Buyer Member'}
                </h3>
                <p className="text-[12px] font-semibold text-[#0A6CFF] mt-1">
                  Verified Buyer
                </p>
                <p className="text-[11px] text-[#8A9BB0] font-mono mt-0.5">
                  Account ID: {company?.id || 'buyer-account'}
                </p>

                {/* Badges */}
                <div className="flex items-center justify-center gap-2 mt-3.5 mb-5">
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Active</span>
                  </span>
                  <span className="bg-[#EFF6FF] text-[#0A6CFF] text-[11px] font-bold px-3 py-1 rounded-full border border-blue-200">
                    BUYER
                  </span>
                </div>

                {/* Personal Contact Details Box */}
                <div className="space-y-2 pt-3 border-t border-[#F8FAFC] text-left">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#EAEFF6]">
                    <Mail className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                    <span className="text-[12px] font-medium text-[#41536D] truncate">
                      {corporateEmail || 'No email specified'}
                    </span>
                  </div>
                  {phoneWhatsApp && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#EAEFF6]">
                      <Phone className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                      <span className="text-[12px] font-medium text-[#41536D] truncate">
                        {phoneWhatsApp}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#8A9BB0] leading-relaxed text-center">
                  Personal profile details are kept private and only shared with suppliers when you send an inquiry.
                </div>
              </>
            ) : (
              /* ======================================================== */
              /* SELLER PREVIEW: COMPANY PREVIEW                         */
              /* ======================================================== */
              <>
                {/* Centered Avatar / Logo */}
                <div className="relative w-20 h-20 rounded-2xl bg-[#0B1F3A] text-white font-extrabold text-[24px] flex items-center justify-center mx-auto mb-4 tracking-wider shadow-xs overflow-hidden border border-[#EAEFF6]">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Logo preview" fill className="object-cover" />
                  ) : (
                    <span>{monogram}</span>
                  )}
                </div>

                {/* Title & Account ID */}
                <h3 className="text-[18px] font-extrabold text-[#0B1F3A] leading-snug">
                  {tradeName}
                </h3>
                <p className="text-[12px] text-[#8A9BB0] mt-1 font-medium">
                  Representative: {contactPerson}
                </p>
                <p className="text-[11px] text-[#8A9BB0] font-mono mt-0.5">
                  Account ID: {company?.id || 'comp-nordic-tech'}
                </p>

                {/* Verification & Tier Badges */}
                <div className="flex items-center justify-center gap-2 mt-3.5 mb-5">
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Active</span>
                  </span>
                  <span className="bg-[#FFFBEB] text-[#D97706] text-[11px] font-bold px-3 py-1 rounded-full border border-amber-200">
                    {membershipTier}
                  </span>
                </div>

                {/* Categories Tags */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-[#F8FAFC]">
                  <span className="bg-[#F3F6FB] text-[#41536D] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#EAEFF6]">
                    Consumer Electronics
                  </span>
                  <span className="bg-[#F3F6FB] text-[#41536D] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#EAEFF6]">
                    Home & Kitchen
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
