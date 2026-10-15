'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { MOCK_CATEGORIES } from '@/lib/mock-data';
import type { UserRole, MembershipTier } from '@/types/database';
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
  CreditCard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  DEMO_TEST_CARD,
  processRegistrationCardCheckout,
  TIER_PRICING,
} from '@/lib/billing/billing-store';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { switchDemoRole } = useAuth();

  const initialRole = searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
  const initialTier = (searchParams.get('tier') as MembershipTier) || 'silver';

  // Step state: 1 to totalSteps
  const [step, setStep] = useState<number>(1);

  // Form State
  const [role, setRole] = useState<UserRole>(initialRole);
  const [membershipTier, setMembershipTier] = useState<MembershipTier>(initialTier);

  // Step 2: Company Details
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  // Step 3: Categories
  const [selectedNiches, setSelectedNiches] = useState<string[]>(['consumer-electronics']);

  // Step 4: First Name, Last Name, Phone Number, Address
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Step 5: Username (with real-time check), Email, Password, Retype Password
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 7 (Seller Paid Tiers): Card Checkout Details
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('12');
  const [cardExpYear, setCardExpYear] = useState('28');
  const [cardCvc, setCardCvc] = useState('');
  const [cardZip, setCardZip] = useState('');
  const [isTestCardApplied, setIsTestCardApplied] = useState(false);

  const applyTestCard = () => {
    setCardNumber(DEMO_TEST_CARD.cardNumber);
    setCardholderName(DEMO_TEST_CARD.cardholderName);
    setCardExpMonth(DEMO_TEST_CARD.expMonth);
    setCardExpYear(DEMO_TEST_CARD.expYear);
    setCardCvc(DEMO_TEST_CARD.cvc);
    setCardZip(DEMO_TEST_CARD.zip);
    setIsTestCardApplied(true);
    setErrorMsg(null);
  };

  // Real-time Username availability state
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  >('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const [hasManuallyEditedUsername, setHasManuallyEditedUsername] = useState(false);

  // Payment Confirmation state
  const [paymentConfirmation, setPaymentConfirmation] = useState<{
    amount: string;
    tierName: string;
    last4: string;
    txnId: string;
    email: string;
    role: string;
    redirectQuery: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(4);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Buyer: 2 steps total (1: Select Role, 2: Personal Account Info)
  // Seller: 6 or 7 steps (full company, niches, vetting & checkout)
  const totalSteps = role === 'buyer' ? 2 : (membershipTier === 'bronze' ? 6 : 7);

  // Auto-countdown timer for payment confirmation
  useEffect(() => {
    if (!paymentConfirmation) return;
    if (redirectCountdown <= 0) {
      router.push(
        `/verify-email?email=${encodeURIComponent(paymentConfirmation.email)}&role=${paymentConfirmation.role}${paymentConfirmation.redirectQuery}`
      );
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [paymentConfirmation, redirectCountdown, router]);

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
      setUsernameFeedback('Must be at least 3 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Only letters, numbers, underscores, dots, or hyphens.');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Checking availability...');

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (data.available) {
          setUsernameStatus('available');
          setUsernameFeedback('Username is available!');
        } else {
          setUsernameStatus('unavailable');
          setUsernameFeedback(data.reason || 'This username is already taken.');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setUsernameStatus('invalid');
          setUsernameFeedback('Could not verify availability.');
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [username]);

  const toggleNiche = (slug: string) => {
    if (selectedNiches.includes(slug)) {
      if (selectedNiches.length > 1) {
        setSelectedNiches(selectedNiches.filter((s) => s !== slug));
      }
    } else {
      setSelectedNiches([...selectedNiches, slug]);
    }
  };

  const handleNextStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // If Buyer on Step 2: Validate personal details and submit immediately!
    if (role === 'buyer' && step === 2) {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter your first and last name.');
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Please enter your phone number.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (usernameStatus !== 'available') {
        setErrorMsg(
          usernameStatus === 'checking'
            ? 'Checking username availability. Please wait a moment.'
            : usernameFeedback || 'Please choose an available username.'
        );
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
      return;
    }

    // Seller Step 2 Validation: Company Details
    if (step === 2 && role === 'seller') {
      if (!companyName.trim()) {
        setErrorMsg('Please enter your legal company name.');
        return;
      }
    }
    // Seller Step 3 Validation: Niches
    else if (step === 3 && role === 'seller') {
      if (selectedNiches.length === 0) {
        setErrorMsg('Please select at least one trading category.');
        return;
      }
    }
    // Seller Step 4 Validation: First Name, Last Name, Phone, Address
    else if (step === 4 && role === 'seller') {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter your first and last name.');
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Please enter your direct business phone number.');
        return;
      }
      if (!address.trim()) {
        setErrorMsg('Please enter your registered company address.');
        return;
      }
      if (!username.trim() || !hasManuallyEditedUsername) {
        const auto = generateUsernameFromName(firstName, lastName) || companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (auto) setUsername(auto);
      }
    }
    // Seller Step 5 Validation: Username, Email, Password, Confirm Password
    else if (step === 5 && role === 'seller') {
      if (usernameStatus !== 'available') {
        setErrorMsg(
          usernameStatus === 'checking'
            ? 'Checking username availability. Please wait a moment.'
            : usernameFeedback || 'Please choose an available username.'
        );
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid corporate email address.');
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
    }
    // Seller Step 6 Validation (Seller Plan Selection)
    else if (step === 6 && role === 'seller') {
      if (membershipTier === 'bronze') {
        void handleFinalSubmit();
        return;
      } else {
        if (!cardholderName.trim()) {
          setCardholderName(`${firstName} ${lastName}`.trim() || companyName || 'Trader Enterprise');
        }
        setStep(7);
        return;
      }
    }
    // Seller Step 7 Validation (Seller Paid Tier Card Checkout)
    else if (step === 7 && role === 'seller') {
      const cleanNum = cardNumber.replace(/\s+/g, '');
      if (cleanNum.length < 15) {
        setErrorMsg('Please enter a valid 16-digit card number or click "Auto-fill Test Card".');
        return;
      }
      if (!cardholderName.trim()) {
        setErrorMsg('Please enter the name on the card.');
        return;
      }
      if (!cardCvc.trim() || cardCvc.length < 3) {
        setErrorMsg('Please enter a valid 3-digit security code (CVC).');
        return;
      }
      void handleFinalSubmit();
      return;
    }

    // Step advancement
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
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
          email,
          password,
          username: cleanUsername,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          companyName,
          regNumber,
          vatNumber,
          role,
          membershipTier,
          selectedNiches,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed. Please check your details.');
        setLoading(false);
        return;
      }

      // Record card checkout & activate subscription if paid tier
      const createdCompanyId = data.companyId || `comp-${cleanUsername}`;
      if (role === 'seller' && membershipTier !== 'bronze') {
        processRegistrationCardCheckout({
          companyId: createdCompanyId,
          companyName: companyName || `${firstName} ${lastName}`,
          contactEmail: email,
          tier: membershipTier,
          cardData: {
            cardNumber: cardNumber.replace(/\s+/g, '') || DEMO_TEST_CARD.cardNumber.replace(/\s+/g, ''),
            cardholderName: cardholderName.trim() || `${firstName} ${lastName}`,
            expMonth: cardExpMonth || '12',
            expYear: cardExpYear || '28',
            brand: cardNumber.startsWith('5') ? 'mastercard' : 'visa',
          },
        });

        switchDemoRole('seller');
        const redirectQuery = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
        const cleanCard = cardNumber.replace(/\s+/g, '') || DEMO_TEST_CARD.cardNumber.replace(/\s+/g, '');
        setPaymentConfirmation({
          amount: membershipTier === 'gold' ? '179.00' : '79.00',
          tierName: membershipTier === 'gold' ? 'Gold Plan' : 'Silver Plan',
          last4: cleanCard.slice(-4),
          txnId: `TXN-${Date.now().toString().slice(-8)}`,
          email,
          role,
          redirectQuery,
        });
        setLoading(false);
        return;
      }

      // Switch context & navigate to email verification screen
      switchDemoRole(role === 'seller' ? 'seller' : 'buyer');
      const redirectQuery = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
      router.push(`/verify-email?email=${encodeURIComponent(email)}&role=${role}${redirectQuery}`);
    } catch (err) {
      console.error('Registration flow notice:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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

      {/* Main Sign Up Card */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10 transition-all">
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
        {redirectParam === '/requests/new' && (
          <div className="mb-5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 text-[13px] text-[#0A6CFF] font-medium">
            <span>Please create your account to post your WTB request. You will be redirected right back after registering!</span>
          </div>
        )}

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PAYMENT CONFIRMATION SCREEN */}
        {paymentConfirmation ? (
          <div className="py-2 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/70">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[12px] font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Payment Authorized &amp; Completed</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F3A] tracking-tight mb-2">
              Payment Confirmed
            </h1>
            <p className="text-[14px] text-[#5B6B82] max-w-sm mx-auto mb-6">
              Your £{paymentConfirmation.amount} subscription payment has been cleared successfully. Your {paymentConfirmation.tierName} is now active.
            </p>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] text-left text-[13px] space-y-2.5 mb-6">
              <div className="flex justify-between items-center text-[#5B6B82]">
                <span>Transaction Ref</span>
                <span className="font-mono font-bold text-[#0B1F3A]">{paymentConfirmation.txnId}</span>
              </div>
              <div className="flex justify-between items-center text-[#5B6B82]">
                <span>Payment Method</span>
                <span className="font-medium text-[#0B1F3A]">Card ending in •••• {paymentConfirmation.last4}</span>
              </div>
              <div className="flex justify-between items-center text-[#5B6B82]">
                <span>Amount Paid</span>
                <span className="font-extrabold text-emerald-600 text-[15px]">£{paymentConfirmation.amount}</span>
              </div>
              <div className="flex justify-between items-center text-[#5B6B82] pt-2 border-t border-[#EAEFF6]">
                <span>Billing Status</span>
                <span className="font-bold text-[#059669] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Cleared &amp; Invoiced
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                router.push(
                  `/verify-email?email=${encodeURIComponent(paymentConfirmation.email)}&role=${paymentConfirmation.role}${paymentConfirmation.redirectQuery}`
                );
              }}
              className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            >
              Continue to Account Verification &rarr;
            </button>
            <p className="text-[12px] text-[#8A9BB0] mt-3">
              Automatically continuing in {redirectCountdown} second{redirectCountdown === 1 ? '' : 's'}...
            </p>
          </div>
        ) : (
          <>
            {/* STEP 1: Account Type Selection */}
            {step === 1 && (
              <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 1 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              How will you use B2B LINK?
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Choose the account that fits. You can add the other later.
            </p>

            {/* Radio Cards Container */}
            <div className="space-y-3.5 mb-7">
              {/* Option 1: Buyer */}
              <div
                onClick={() => setRole('buyer')}
                className={`p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  role === 'buyer'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        role === 'buyer'
                          ? 'border-[#0A6CFF] bg-white'
                          : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {role === 'buyer' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0A6CFF]" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-[#0B1F3A]">
                        Buyer
                      </span>
                      <span className="bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold px-2 py-0.5 rounded-full">
                        Free
                      </span>
                    </div>
                    <p className="text-[14px] text-[#5B6B82] mt-1 leading-snug">
                      Browse stock lots, send inquiries and post buyer requests.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Seller */}
              <div
                onClick={() => setRole('seller')}
                className={`p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  role === 'seller'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        role === 'seller'
                          ? 'border-[#0A6CFF] bg-white'
                          : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {role === 'seller' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0A6CFF]" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-[16px] font-bold text-[#0B1F3A]">
                      Seller
                    </span>
                    <p className="text-[14px] text-[#5B6B82] mt-1 leading-snug">
                      List stock lots, upload catalogues and quote on buyer requests.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={() => handleNextStep()}
              className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2 FOR BUYER: Simple Personal Account Creation */}
        {step === 2 && role === 'buyer' && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 2 OF 2 &bull; BUYER ACCOUNT
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Create your account
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Enter your details to browse verified wholesale inventory, post WTB requests, and chat directly with suppliers.
            </p>

            <div className="space-y-4 mb-7">
              {/* Full Name: First & Last */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => handleNameChange(e.target.value, lastName)}
                    placeholder="e.g. Alex"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => handleNameChange(firstName, e.target.value)}
                    placeholder="e.g. Morgan"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              {/* Direct Phone Number */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Phone number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +44 7911 123456"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex@company.eu"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Username with Auto-generation & Live Validation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[14px] font-bold text-[#0B1F3A]">
                    Username
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateUsernameFromName(firstName, lastName);
                      if (gen) {
                        setUsername(gen);
                        setHasManuallyEditedUsername(false);
                      }
                    }}
                    className="text-[12px] font-bold text-[#0A6CFF] hover:underline"
                  >
                    Auto-generate from name
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setHasManuallyEditedUsername(true);
                      setUsername(e.target.value);
                    }}
                    placeholder="e.g. alex_morgan"
                    className={`w-full px-4 py-3 pr-10 text-[15px] bg-white border rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none transition font-medium ${
                      usernameStatus === 'available'
                        ? 'border-emerald-400 focus:border-emerald-500'
                        : usernameStatus === 'unavailable' || usernameStatus === 'invalid'
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E3E9F2] focus:border-[#0A6CFF]'
                    }`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-[#0A6CFF] animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    )}
                    {(usernameStatus === 'unavailable' || usernameStatus === 'invalid') && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                {usernameFeedback && (
                  <p
                    className={`text-[12px] mt-1.5 font-medium ${
                      usernameStatus === 'available'
                        ? 'text-emerald-600'
                        : usernameStatus === 'checking'
                        ? 'text-[#0A6CFF]'
                        : 'text-red-500'
                    }`}
                  >
                    {usernameFeedback}
                  </p>
                )}
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-4 py-3 pr-10 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Retype password"
                      className="w-full px-4 py-3 pr-10 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleNextStep()}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Creating Account...' : 'Create Free Buyer Account'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 FOR SELLER: Company Details */}
        {step === 2 && role === 'seller' && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 2 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Your business details
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Enter your legal company information for counterparty verification.
            </p>

            <div className="space-y-4 mb-7">
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Legal company name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Wholesale Trading OÜ"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Commercial registry code <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. EE-10293845"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  VAT number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g. EE102938456"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleNextStep()}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Category Niches */}
        {step === 3 && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 3 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              What do you trade in?
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Select the wholesale sectors relevant to your product lots.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-7">
              {MOCK_CATEGORIES.map((cat) => {
                const isChecked = selectedNiches.includes(cat.slug);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleNiche(cat.slug)}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? 'border-[#0A6CFF] bg-[#F8FAFF] text-[#0A6CFF]'
                        : 'border-[#E3E9F2] bg-white text-[#41536D] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <span className="text-[14px] font-bold">{cat.name}</span>
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isChecked
                          ? 'border-[#0A6CFF] bg-[#0A6CFF] text-white'
                          : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleNextStep()}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: First & Last Name, Phone Number, Address */}
        {step === 4 && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 4 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Contact & Address
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Enter your authorized representative name, direct phone, and address.
            </p>

            <div className="space-y-4 mb-7">
              {/* First Name & Last Name (Side by side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => handleNameChange(e.target.value, lastName)}
                    placeholder="e.g. Jeff"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => handleNameChange(firstName, e.target.value)}
                    placeholder="e.g. Miller"
                    className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>
              </div>

              {/* Phone / WhatsApp Number */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  WhatsApp / Phone number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +44 7911 123456 (with country code)"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
                <p className="text-[12px] text-[#5B6B82] mt-1.5 font-normal">
                  Used for urgent pallet delivery updates, supplier messaging, and WhatsApp trade broadcasts.
                </p>
              </div>

              {/* Registered Address */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Registered address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Narva mnt 5, 10117 Tallinn, Estonia"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleNextStep()}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Username (with real-time availability check), Email, Password, Retype Password */}
        {step === 5 && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 5 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Account credentials
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Create your unique trader username and security credentials.
            </p>

            <div className="space-y-4 mb-7">
              {/* Username with real-time debounced availability check */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={username}
                    onChange={(e) => {
                      setHasManuallyEditedUsername(true);
                      setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                    }}
                    placeholder="e.g. jeff_trader"
                    className={`w-full px-4 py-3 pr-11 text-[15px] bg-white border rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none transition font-medium ${
                      usernameStatus === 'available'
                        ? 'border-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-500/20'
                        : usernameStatus === 'unavailable' || usernameStatus === 'invalid'
                        ? 'border-red-400 focus:border-red-500 ring-1 ring-red-400/20'
                        : 'border-[#E3E9F2] focus:border-[#0A6CFF]'
                    }`}
                  />
                  {/* Status Indicator Icon */}
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-5 h-5 text-[#0A6CFF] animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {(usernameStatus === 'unavailable' || usernameStatus === 'invalid') && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Real-time feedback message */}
                {usernameFeedback && (
                  <p
                    className={`text-[12px] font-semibold mt-1.5 transition-all ${
                      usernameStatus === 'available'
                        ? 'text-emerald-600'
                        : usernameStatus === 'checking'
                        ? 'text-[#5B6B82]'
                        : 'text-red-600'
                    }`}
                  >
                    {usernameFeedback}
                  </p>
                )}
              </div>

              {/* Corporate Email */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Corporate email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@company.eu"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Create password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
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

              {/* Retype Password */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-2">
                  Retype password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full px-4 py-3 pr-11 text-[15px] bg-white border rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none transition font-medium ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E3E9F2] focus:border-[#0A6CFF]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0] hover:text-[#0B1F3A] transition p-1 cursor-pointer"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[12px] font-semibold text-red-600 mt-1.5">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={
                  loading ||
                  usernameStatus !== 'available' ||
                  !email ||
                  password.length < 6 ||
                  password !== confirmPassword
                }
                onClick={() => handleNextStep()}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {role === 'buyer'
                  ? loading
                    ? 'Creating account...'
                    : 'Complete Registration'
                  : 'Continue to Plans'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6 (SELLER ONLY): Plan Selection */}
        {step === 6 && role === 'seller' && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 6 OF 6
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Choose seller plan
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-6">
              Simple monthly subscription. Zero transaction commission.
            </p>

            {/* 3 Tier Options */}
            <div className="space-y-3 mb-7">
              {/* Bronze */}
              <div
                onClick={() => setMembershipTier('bronze')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  membershipTier === 'bronze'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="font-bold text-[15px] text-[#0B1F3A]">Bronze Tier</div>
                  <div className="text-[13px] text-[#5B6B82]">Up to 15 active listings &bull; 10 quotes/mo</div>
                </div>
                <div className="text-[16px] font-extrabold text-[#0B1F3A]">Free</div>
              </div>

              {/* Silver */}
              <div
                onClick={() => setMembershipTier('silver')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  membershipTier === 'silver'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] text-[#0B1F3A]">Silver Tier</span>
                    <span className="text-[10px] font-bold text-[#0A6CFF] bg-[#EBF3FF] px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <div className="text-[13px] text-[#5B6B82]">50 active listings &bull; CSV uploads &bull; 25 quotes/mo</div>
                </div>
                <div className="text-[16px] font-extrabold text-[#0B1F3A]">£79<span className="text-[12px] text-[#5B6B82] font-normal">/mo</span></div>
              </div>

              {/* Gold */}
              <div
                onClick={() => setMembershipTier('gold')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  membershipTier === 'gold'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="font-bold text-[15px] text-[#0B1F3A]">Gold Tier</div>
                  <div className="text-[13px] text-[#5B6B82]">Unlimited listings &bull; Spotlight badges &bull; 50 quotes/mo</div>
                </div>
                <div className="text-[16px] font-extrabold text-[#0B1F3A]">£179<span className="text-[12px] text-[#5B6B82] font-normal">/mo</span></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {membershipTier === 'bronze'
                  ? loading
                    ? 'Creating account...'
                    : 'Complete Free Registration'
                  : 'Continue to Card Checkout'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 7 (SELLER PAID TIERS): Card Checkout */}
        {step === 7 && role === 'seller' && (
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
              STEP 7 OF {totalSteps}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
              Payment details
            </h1>
            <p className="text-[15px] text-[#5B6B82] mb-5">
              Add your payment card to activate your {membershipTier === 'gold' ? 'Gold' : 'Silver'} subscription.
            </p>

            {/* Plan Summary Box */}
            <div className="bg-[#F8FAFF] border border-[#DCE7F6] rounded-2xl p-4 mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[15px] text-[#0B1F3A] capitalize">
                    {membershipTier} Membership
                  </span>
                  <span className="text-[11px] font-bold text-[#0A6CFF] bg-[#EBF3FF] px-2 py-0.5 rounded-full">
                    Monthly Plan
                  </span>
                </div>
                <div className="text-[12px] text-[#5B6B82] mt-0.5">
                  Renews monthly &bull; 0% transaction commission &bull; Cancel anytime
                </div>
              </div>
              <div className="text-right">
                <div className="text-[22px] font-black text-[#0B1F3A]">
                  £{membershipTier === 'gold' ? '179' : '79'}
                  <span className="text-[12px] font-normal text-[#5B6B82]">/mo</span>
                </div>
              </div>
            </div>

            {/* Test Card Quick Fill Banner */}
            <div className="mb-5 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-blue-900 font-medium">
                <Sparkles className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                <span>Test mode enabled: use dummy card</span>
              </div>
              <button
                type="button"
                onClick={applyTestCard}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[12px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>⚡ Auto-fill Test Card</span>
              </button>
            </div>

            {/* Card Inputs */}
            <div className="space-y-4 mb-7">
              {/* Cardholder Name */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-1.5">
                  Cardholder name
                </label>
                <input
                  type="text"
                  required
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="e.g. Jeff Miller or Enterprise Ltd"
                  className="w-full px-4 py-3 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                />
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-[14px] font-bold text-[#0B1F3A] mb-1.5">
                  Card number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      const formatted = v.replace(/(.{4})/g, '$1 ').trim();
                      setCardNumber(formatted);
                    }}
                    placeholder="4242 •••• •••• 4242"
                    className="w-full px-4 py-3 pr-11 text-[15px] bg-white border border-[#E3E9F2] rounded-2xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-mono font-medium"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A9BB0]">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Expiry & CVC & ZIP (3 Columns) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Expires
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="MM"
                      value={cardExpMonth}
                      onChange={(e) => setCardExpMonth(e.target.value)}
                      className="w-full px-3 py-3 text-center text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                    <span className="text-[#8A9BB0]">/</span>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="YY"
                      value={cardExpYear}
                      onChange={(e) => setCardExpYear(e.target.value)}
                      className="w-full px-3 py-3 text-center text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    CVC / CVV
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="123"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-3 text-center text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Postal code
                  </label>
                  <input
                    type="text"
                    placeholder="10117"
                    value={cardZip}
                    onChange={(e) => setCardZip(e.target.value)}
                    className="w-full px-3 py-3 text-center text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Security Guarantee Note */}
            <div className="flex items-center gap-2 text-[12px] text-[#5B6B82] mb-6">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Encrypted checkout. One active card stays on file for subscription.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="w-12 h-12 rounded-full border border-[#E3E9F2] bg-white hover:bg-[#F3F6FB] flex items-center justify-center text-[#5B6B82] shrink-0 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="flex-1 min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {loading
                  ? 'Processing payment...'
                  : `Pay £${membershipTier === 'gold' ? '179' : '79'} & Complete Registration`}
              </button>
            </div>
          </div>
        )}
          </>
        )}

        {/* Card Footer: Already registered? Sign in */}
        <div className="mt-8 pt-6 border-t border-[#EAEFF6] text-center text-[14px] text-[#5B6B82]">
          <span>Already registered? </span>
          <Link
            href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}
            className="font-bold text-[#0A6CFF] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] text-[#5B6B82]">
          Loading registration...
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
