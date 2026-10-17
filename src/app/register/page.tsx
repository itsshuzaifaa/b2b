'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { ALL_COUNTRY_CODES } from '@/lib/constants/country-codes';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  XCircle,
  Eye,
  EyeOff,
  Search,
  X,
  Building2,
  User,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  Tag,
  ChevronDown,
  Sparkles,
  Zap,
  Crown,
} from 'lucide-react';

const COUNTRY_CODES = ALL_COUNTRY_CODES;

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { switchDemoRole } = useAuth();

  // 5-Step Flow as requested by user:
  // Step 1: Personal Details (Name, Phone, Email)
  // Step 2: Business Details (Company Name, Registration Number, VAT/Tax Number)
  // Step 3: Address & Categories (Registered Business Address, 60+ Wholesale Categories)
  // Step 4: Membership Package Selection (Bronze, Silver, Gold with full advertised benefits)
  // Step 5: Account Credentials (Username, Password)
  const [step, setStep] = useState<number>(1);
  const totalSteps = 5;

  // Step 1: Personal Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+44');
  const [phoneLocal, setPhoneLocal] = useState('');
  const phone = phoneLocal ? `${countryCode} ${phoneLocal.trim()}`.trim() : '';
  const [email, setEmail] = useState('');

  // Step 2: Business Details
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  // Step 3: Address, Wholesale Categories & Credentials
  const [address, setAddress] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([
    'consumer-electronics',
    'smartphones-tablets',
  ]);
  const [customOtherNiche, setCustomOtherNiche] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Country code dropdown state
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const [username, setUsername] = useState('');
  const [selectedTier, setSelectedTier] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  >('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const [hasManuallyEditedUsername, setHasManuallyEditedUsername] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-generate username from user's full name
  const generateUsernameFromName = (first: string, last: string) => {
    const cleanFirst = first.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = last.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanFirst && !cleanLast) return '';
    if (cleanFirst && cleanLast) return `${cleanFirst}_${cleanLast}`;
    return cleanFirst || cleanLast;
  };

  const handleNameChange = (newFirst: string, newLast: string) => {
    setFirstName(newFirst);
    setLastName(newLast);
    if (!hasManuallyEditedUsername) {
      const generated = generateUsernameFromName(newFirst, newLast);
      if (generated) {
        setUsername(generated);
      }
    }
  };

  // Real-time debounced username validation
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();

    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Letters, numbers, and underscores only.');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Checking availability...');

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.available) {
          setUsernameStatus('available');
          setUsernameFeedback('Username is available!');
        } else {
          setUsernameStatus('unavailable');
          setUsernameFeedback(data.message || 'Username already taken.');
        }
      } catch {
        setUsernameStatus('available');
        setUsernameFeedback('');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const toggleNiche = (slug: string) => {
    setSelectedNiches((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const removeNiche = (slug: string) => {
    setSelectedNiches((prev) => prev.filter((s) => s !== slug));
  };

  // Filter categories by search query
  const filteredCategories = WHOLESALE_CATEGORIES.filter((cat) => {
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.sector.toLowerCase().includes(q)
    );
  });

  // Filter country codes by search query
  const filteredCountries = COUNTRY_CODES.filter((c) => {
    const q = countrySearchQuery.toLowerCase().trim();
    if (!q) return true;
    const cleanQ = q.replace(/^\+/, '');
    const cleanCode = c.code.replace(/^\+/, '');
    return (
      c.country.toLowerCase().includes(q) ||
      c.iso.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      cleanCode.includes(cleanQ)
    );
  });

  const handleNextStep = () => {
    setErrorMsg(null);

    // Step 1 Validation: Personal Details
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter your first and last name.');
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Please enter your direct contact phone number.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid corporate email address.');
        return;
      }

      // Auto-set username if empty
      if (!username.trim()) {
        const auto = generateUsernameFromName(firstName, lastName);
        if (auto) setUsername(auto);
      }

      setStep(2);
      return;
    }

    // Step 2 Validation: Business Details
    if (step === 2) {
      if (!companyName.trim()) {
        setErrorMsg('Please enter your legal business or company name.');
        return;
      }
      if (!regNumber.trim()) {
        setErrorMsg('Please enter your company registration number.');
        return;
      }
      if (!vatNumber.trim()) {
        setErrorMsg('Please enter your VAT or Tax Identification number.');
        return;
      }

      setStep(3);
      return;
    }

    // Step 3 Validation: Address & Wholesale Categories
    if (step === 3) {
      if (!address.trim()) {
        setErrorMsg('Please enter your registered business address.');
        return;
      }
      if (selectedNiches.length === 0) {
        setErrorMsg('Please select at least one wholesale product category.');
        return;
      }
      if (selectedNiches.includes('other') && !customOtherNiche.trim()) {
        setErrorMsg('Please specify your custom wholesale category name.');
        return;
      }

      setStep(4);
      return;
    }

    // Step 4 Validation: Membership Package
    if (step === 4) {
      if (!selectedTier) {
        setSelectedTier('bronze');
      }

      setStep(5);
      return;
    }

    // Step 5 Validation: Account Credentials (Username & Password)
    if (step === 5) {
      if (!username.trim()) {
        setErrorMsg('Please enter a username for your account.');
        return;
      }
      if (usernameStatus === 'unavailable' || usernameStatus === 'invalid') {
        setErrorMsg(usernameFeedback || 'Please choose an available username.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please retype carefully.');
        return;
      }

      void handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          username: cleanUsername,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          companyName: companyName.trim(),
          regNumber: regNumber.trim(),
          vatNumber: vatNumber.trim(),
          role: 'seller', // Unified account for both buying and selling
          membershipTier: selectedTier, // User-selected membership package
          selectedNiches: selectedNiches.map((niche) =>
            niche === 'other' && customOtherNiche.trim() ? customOtherNiche.trim() : niche
          ),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed. Please check your details.');
        setLoading(false);
        return;
      }

      // Switch auth context & redirect to verification screen
      switchDemoRole('seller');
      const redirectQuery = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&role=seller${redirectQuery}`);
    } catch (err) {
      console.error('Registration exception:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Main Sign Up Card */}
      <div className={`w-full ${step === 4 ? 'max-w-[1040px]' : 'max-w-[540px]'} bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-6 sm:p-10 transition-all duration-300`}>
        {/* Dynamic Segmented Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                idx <= step ? 'bg-[#0A6CFF]' : 'bg-[#EAEFF6]'
              }`}
            />
          ))}
        </div>

        {/* Contextual notice if redirected from WTB Request */}
        {(redirectParam === '/requests/new' || redirectParam?.startsWith('/requests')) && (
          <div className="mb-5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 text-[13px] text-[#0A6CFF] font-medium">
            <span>Please create your account to post your WTB request. You will be redirected right back after registering!</span>
          </div>
        )}

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: Personal Details (First Name, Last Name, Phone, Email)             */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>STEP 1 OF 5 &bull; PERSONAL DETAILS</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Create your B2B LINK Account
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              Enter your contact details. One unified account enables you to buy and sell wholesale across Europe.
            </p>

            <div className="space-y-4 mb-7">
              {/* Contact Name (First & Last) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => handleNameChange(e.target.value, lastName)}
                    placeholder="e.g. Alexander"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => handleNameChange(firstName, e.target.value)}
                    placeholder="e.g. Weber"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              {/* Direct Phone Number with Country Code Extension Selector */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Direct phone number <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-2xl border border-[#E3E9F2] bg-white focus-within:border-[#0A6CFF] transition">
                  {/* Country Dial Code Selector - Shows ONLY country code number and flag when closed */}
                  <div ref={countryDropdownRef} className="relative shrink-0 border-r border-[#E3E9F2]">
                    <button
                      type="button"
                      onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      className="h-full px-3.5 py-3 text-[14px] font-bold text-[#0B1F3A] bg-slate-50 hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer rounded-l-2xl select-none"
                      title={`Selected country code: ${countryCode}`}
                      aria-haspopup="listbox"
                      aria-expanded={isCountryDropdownOpen}
                    >
                      <span className="text-[16px] leading-none">
                        {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag || '🌐'}
                      </span>
                      <span>{countryCode}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                          isCountryDropdownOpen ? 'rotate-180 text-[#0A6CFF]' : ''
                        }`}
                      />
                    </button>

                    {/* Full Searchable Dropdown Menu with Full Country Names */}
                    {isCountryDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 z-50 w-72 max-w-[85vw] bg-white rounded-2xl border border-[#EAEFF6] shadow-[0_15px_40px_rgba(11,31,58,0.16)] p-2 animate-in fade-in zoom-in-95 duration-150">
                        <div className="relative mb-2 px-1 pt-1">
                          <input
                            type="text"
                            value={countrySearchQuery}
                            onChange={(e) => setCountrySearchQuery(e.target.value)}
                            placeholder="Search country or code..."
                            className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl text-[#0B1F3A] placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF] focus:bg-white transition"
                            autoFocus
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
                          {filteredCountries.length === 0 ? (
                            <p className="py-3 text-center text-[12px] text-slate-400 font-medium">
                              No countries found
                            </p>
                          ) : (
                            filteredCountries.map((item) => (
                              <button
                                key={`${item.code}-${item.country}`}
                                type="button"
                                onClick={() => {
                                  setCountryCode(item.code);
                                  setIsCountryDropdownOpen(false);
                                  setCountrySearchQuery('');
                                }}
                                className={`w-full px-2.5 py-2 rounded-xl text-[13px] flex items-center justify-between transition cursor-pointer text-left ${
                                  countryCode === item.code
                                    ? 'bg-[#EBF3FF] text-[#0A6CFF] font-bold'
                                    : 'hover:bg-slate-50 text-[#0B1F3A]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <span className="text-[16px] leading-none shrink-0">{item.flag}</span>
                                  <span className="truncate">{item.country}</span>
                                </div>
                                <span className="font-bold shrink-0 text-slate-500 text-[12px]">{item.code}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Local Phone Number Input */}
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      required
                      value={phoneLocal}
                      onChange={(e) => setPhoneLocal(e.target.value)}
                      placeholder="e.g. 7946 0912 or 171 123456"
                      className="w-full px-4 py-3 text-[15px] bg-transparent text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none font-medium rounded-r-2xl"
                    />
                  </div>
                </div>
                <p className="text-[12px] text-[#5B6B82] mt-1.5">
                  Selected format: <strong className="text-[#0B1F3A]">{countryCode} {phoneLocal || '...'}</strong>
                </p>
              </div>

              {/* Corporate Email Address */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Corporate email address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-11 pr-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[12px] text-[#5B6B82] mt-1.5">
                  We will send a one-time verification code to this email.
                </p>
              </div>
            </div>

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
            >
              <span>Continue to Business Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: Business Details (Company Name, Registration No, VAT/Tax No)       */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>STEP 2 OF 5 &bull; BUSINESS DETAILS</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Business Information
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              Enter your official wholesale enterprise details for commercial verification.
            </p>

            <div className="space-y-4 mb-7">
              {/* Company Legal Name */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Legal company name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Wholesale Trading Ltd"
                    className="w-full pl-11 pr-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Company Registration Number */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Company registration number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. 12345678 or HRB 98765"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
                <p className="text-[12px] text-[#5B6B82] mt-1.5">
                  Companies House, Handelsregister, or national commercial registry number.
                </p>
              </div>

              {/* VAT / Tax ID Number */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  VAT / Tax identification number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g. GB123456789 or DE987654321"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
                <p className="text-[12px] text-[#5B6B82] mt-1.5">
                  Used for European VIES tax status & wholesale invoice compliance.
                </p>
              </div>
            </div>

            {/* Step 2 Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 min-h-[50px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Continue to Step 3</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: Address & Wholesale Product Categories                            */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>STEP 3 OF 5 &bull; ADDRESS & CATEGORIES</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Address & Trading Sectors
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              Enter your registered trading address and select the wholesale product categories your business deals in.
            </p>

            <div className="space-y-5 mb-7">
              {/* Business Address */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Registered business address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 100 Commercial Way, Logistics Park, London EC1"
                    className="w-full pl-11 pr-4 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Searchable Wholesale Categories Multi-Select Dropdown */}
              <div ref={categoryDropdownRef} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-bold text-[#0B1F3A]">
                    Wholesale product categories <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[12px] text-[#0A6CFF] font-semibold">
                    {selectedNiches.length} selected
                  </span>
                </div>

                {/* Selected Category Tags Chips */}
                {selectedNiches.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-24 overflow-y-auto p-1">
                    {selectedNiches.map((nicheId) => {
                      const cat = WHOLESALE_CATEGORIES.find((c) => c.id === nicheId);
                      return (
                        <span
                          key={nicheId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EBF3FF] border border-[#BFDBFE] text-[#0A6CFF] text-[12px] font-bold animate-in fade-in"
                        >
                          <span>{cat?.name || nicheId}</span>
                          <button
                            type="button"
                            onClick={() => removeNiche(nicheId)}
                            className="hover:text-red-500 transition cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search Input Box */}
                <div className="relative">
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    placeholder="Search 60+ wholesale sectors (e.g. Electronics, FMCG, Solar)..."
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-slate-50 hover:bg-white focus:bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Dropdown Menu */}
                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-white border border-[#EAEFF6] rounded-2xl shadow-[0_15px_40px_rgba(11,31,58,0.12)] max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>Available Wholesale Sectors</span>
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-600 text-[11px]"
                      >
                        Done
                      </button>
                    </div>

                    {filteredCategories.length === 0 ? (
                      <div className="py-4 text-center text-[13px] text-slate-400">
                        No wholesale categories found matching &quot;{categorySearchQuery}&quot;
                      </div>
                    ) : (
                      filteredCategories.map((cat) => {
                        const isSelected = selectedNiches.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleNiche(cat.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#EBF3FF] text-[#0A6CFF] font-bold'
                                : 'hover:bg-slate-50 text-[#0B1F3A]'
                            }`}
                          >
                            <div>
                              <div>{cat.name}</div>
                              <div className="text-[10px] text-slate-400">{cat.sector}</div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                isSelected
                                  ? 'bg-[#0A6CFF] border-[#0A6CFF] text-white'
                                  : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedNiches.includes('other') && (
                  <div className="mt-3 animate-in fade-in">
                    <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1">
                      Specify Category / Sector <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customOtherNiche}
                      onChange={(e) => setCustomOtherNiche(e.target.value)}
                      placeholder="Type your category (e.g. Solar Panels, Medical Labs, Vintage Goods...)"
                      className="w-full px-4 py-2.5 text-[14px] bg-slate-50 border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 min-h-[50px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Continue to Step 4</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: Choose Membership Package ONLY                                    */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>STEP 4 OF 5 &bull; MEMBERSHIP PACKAGE</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
              <h1 className="text-[26px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
                Select Your Membership Package
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6CFF] bg-[#EBF3FF] px-3 py-1 rounded-full w-fit">
                Switch Anytime
              </span>
            </div>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              Choose the package that fits your deal volume. Every tier allows both buying & selling wholesale on B2B LINK.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch mb-8">
              {/* Bronze Tier (Free Forever) */}
              <div
                onClick={() => setSelectedTier('bronze')}
                className={`rounded-3xl p-6 sm:p-7 transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedTier === 'bronze'
                    ? 'border-2 border-[#0A6CFF] bg-gradient-to-b from-[#F5F9FF] to-white ring-4 ring-[#0A6CFF]/15 shadow-md'
                    : 'border border-[#E3E9F2] bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[18px] font-black text-[#0B1F3A]">Bronze Plan</span>
                    <span className="text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                      Free Forever
                    </span>
                  </div>
                  <p className="text-[13px] text-[#5B6B82] mb-5 leading-snug">
                    Starter access for new traders and brokers testing verified market liquidity.
                  </p>

                  <div className="mb-6 flex items-baseline gap-1.5 pb-5 border-b border-slate-100">
                    <span className="text-[36px] font-black text-[#0B1F3A] leading-none">£0</span>
                    <span className="text-[13px] font-semibold text-slate-500">/ month (Free)</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Included Benefits:
                    </div>
                    <ul className="text-[13px] text-[#0B1F3A] space-y-2.5">
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">2 Free Contact Unlocks</strong> to reveal verified seller direct phone, email & WhatsApp
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">15 Active Marketplace Listings</strong> with photo galleries & technical specs
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">10 Monthly WTB Quotes</strong> to bid on international procurement tenders
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Direct Inquiry Messaging</strong> with linked counter-parties
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Standard KYC Verification</strong> for compliant B2B trading
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Zero Commissions</strong> — you retain 100% of your gross margins
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3">
                  <div
                    className={`w-full py-3 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition select-none ${
                      selectedTier === 'bronze'
                        ? 'bg-[#0A6CFF] text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-[#0B1F3A]'
                    }`}
                  >
                    {selectedTier === 'bronze' ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Selected Plan</span>
                      </>
                    ) : (
                      <span>Select Bronze (Free)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Silver Tier (Most Popular) */}
              <div
                onClick={() => setSelectedTier('silver')}
                className={`rounded-3xl p-6 sm:p-7 transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedTier === 'silver'
                    ? 'border-2 border-[#0A6CFF] bg-gradient-to-b from-[#F0F7FF] to-white ring-4 ring-[#0A6CFF]/20 shadow-xl'
                    : 'border-2 border-[#0A6CFF]/40 bg-white hover:border-[#0A6CFF] shadow-sm'
                }`}
              >
                {/* Popular Badge */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0A6CFF] text-white text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Most Popular &bull; High Value</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-[18px] font-black text-[#0B1F3A]">Silver Plan</span>
                    <span className="text-[11px] font-extrabold uppercase bg-blue-100 text-[#0A6CFF] px-3 py-1 rounded-full border border-blue-200">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[13px] text-[#5B6B82] mb-5 leading-snug">
                    For growing wholesalers and active distributors scaling steady volume.
                  </p>

                  <div className="mb-6 flex items-baseline gap-1.5 pb-5 border-b border-slate-100">
                    <span className="text-[36px] font-black text-[#0B1F3A] leading-none">£79</span>
                    <span className="text-[13px] font-semibold text-slate-500">/ month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0A6CFF]">
                      Everything in Bronze, plus:
                    </div>
                    <ul className="text-[13px] text-[#0B1F3A] space-y-2.5">
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold text-[#0A6CFF]">20 Contact Unlocks / month</strong> (10x capacity to connect with top volume buyers)
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">50 Active Marketplace Listings</strong> across multiple sectors & brands
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">CSV / Excel Bulk Product Import</strong> — upload hundreds of SKUs instantly
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Priority Search & Category Placement</strong> ahead of free listings
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Real-Time WTB Alerts</strong> when matching buyers post purchasing requests
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Verified Wholesaler Partner Badge</strong> on your storefront
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#0A6CFF]/15 text-[#0A6CFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Fast-Track 24h KYC Approval</strong> by the compliance team
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3">
                  <div
                    className={`w-full py-3 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition select-none ${
                      selectedTier === 'silver'
                        ? 'bg-[#0A6CFF] text-white shadow-md'
                        : 'bg-[#0B1F3A] hover:bg-[#142B4E] text-white'
                    }`}
                  >
                    {selectedTier === 'silver' ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Selected Plan</span>
                      </>
                    ) : (
                      <span>Select Silver Plan</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Gold Tier (Unlimited Scale) */}
              <div
                onClick={() => setSelectedTier('gold')}
                className={`rounded-3xl p-6 sm:p-7 transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedTier === 'gold'
                    ? 'border-2 border-amber-500 bg-gradient-to-b from-[#FFFDF5] to-white ring-4 ring-amber-500/15 shadow-xl'
                    : 'border border-[#E3E9F2] bg-white hover:border-amber-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[18px] font-black text-[#0B1F3A]">Gold Plan</span>
                    <span className="text-[11px] font-extrabold uppercase bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                      <Crown className="w-3 h-3 fill-current" />
                      <span>Unlimited Scale</span>
                    </span>
                  </div>
                  <p className="text-[13px] text-[#5B6B82] mb-5 leading-snug">
                    For volume distributors, master liquidators & global import/export houses.
                  </p>

                  <div className="mb-6 flex items-baseline gap-1.5 pb-5 border-b border-slate-100">
                    <span className="text-[36px] font-black text-[#0B1F3A] leading-none">£179</span>
                    <span className="text-[13px] font-semibold text-slate-500">/ month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                      Everything in Silver, plus:
                    </div>
                    <ul className="text-[13px] text-[#0B1F3A] space-y-2.5">
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold text-amber-700">UNLIMITED Contact Unlocks</strong> — no limits, unlock any seller or buyer anytime
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold text-amber-700">UNLIMITED Active Listings</strong> — host entire inventory catalogs with zero caps
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Hot Deal Spotlight Promotion</strong> on homepage & category headers
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Dedicated Senior Concierge</strong> (Direct VIP line to Jeff & trade desk)
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Instant High-Volume Deal Routing</strong> on major procurement requests
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">Cross-Border Escrow & Advisory Support</strong> for international shipments
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>
                          <strong className="font-bold">VIP Same-Day Fast-Track KYC Approval</strong>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3">
                  <div
                    className={`w-full py-3 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition select-none ${
                      selectedTier === 'gold'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-[#0B1F3A]'
                    }`}
                  >
                    {selectedTier === 'gold' ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Selected Plan</span>
                      </>
                    ) : (
                      <span>Select Gold Plan</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 min-h-[50px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Continue to Step 5</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: Account Credentials (Username & Password)                         */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>STEP 5 OF 5 &bull; ACCOUNT CREDENTIALS</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Create Your Login Credentials
            </h1>
            <p className="text-[14px] text-[#5B6B82] mb-6">
              Set your unique trading handle and create a strong password to secure your account.
            </p>

            <div className="space-y-4 mb-7">
              {/* Username Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-bold text-[#0B1F3A]">
                    Account username <span className="text-red-500">*</span>
                  </label>
                  {usernameStatus === 'checking' && (
                    <span className="text-[12px] text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Checking...</span>
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[12px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Available</span>
                    </span>
                  )}
                  {usernameStatus === 'unavailable' && (
                    <span className="text-[12px] text-red-600 font-bold flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      <span>Taken</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#94A3B8]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setHasManuallyEditedUsername(true);
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    }}
                    placeholder="trading_admin"
                    className="w-full pl-9 pr-4 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              {/* Password & Confirm Password (Side by side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-4 pr-10 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                    Confirm password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-4 pr-10 py-3 text-[14px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(4)}
                className="w-1/3 min-h-[50px] rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="w-2/3 min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Send Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Bottom Link to Sign In */}
        <div className="mt-7 pt-5 border-t border-[#EAEFF6] text-center">
          <p className="text-[14px] text-[#5B6B82]">
            Already registered?{' '}
            <Link
              href="/login"
              className="text-[#0A6CFF] hover:text-[#0857cf] font-bold transition hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0A6CFF] border-t-transparent animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
