'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createWtbRequest } from '@/lib/actions/wtb';
import { useAuth } from '@/lib/auth/auth-context';
import { MOCK_CATEGORIES } from '@/lib/mock-data';
import {
  Upload,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface PhotoItem {
  id: string;
  name: string;
  url: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDateString(d: Date): string {
  const day = d.getDate();
  const month = SHORT_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function NewWtbRequestContent() {
  const router = useRouter();
  const { company, isLoggedIn, isLoading } = useAuth();

  // Force account creation / authentication before posting a WTB Request
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/register?redirect=/requests/new&role=buyer');
    }
  }, [isLoading, isLoggedIn, router]);

  // Step state: 1 to 5
  const [step, setStep] = useState<number>(1);

  // Step 1: What do you need? (Start completely empty, placeholders only)
  const [productName, setProductName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [barcodeOrSku, setBarcodeOrSku] = useState('');

  // Step 2: Quantity and target price (Start completely empty, placeholders only)
  const [targetQuantity, setTargetQuantity] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [neededBy, setNeededBy] = useState<string>('');

  // Calendar popover state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const calendarRef = useRef<HTMLDivElement | null>(null);

  // Step 3: Add photos and notes (Start with empty photos array)
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Step 4: Your contact details (Use authenticated company if available, else empty)
  const [contactPerson, setContactPerson] = useState(company?.contact_name || '');
  const [corporateEmail, setCorporateEmail] = useState(company?.email || '');
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(company?.phone || '');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-sync company contact details if user logs in
  useEffect(() => {
    if (company?.contact_name) setContactPerson(company.contact_name);
    if (company?.email) setCorporateEmail(company.email);
    if (company?.phone) setPhoneWhatsapp(company.phone);
  }, [company]);

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Photo selection & drag drop
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: PhotoItem[] = [];

    Array.from(files).forEach((file, idx) => {
      if (photos.length + newItems.length >= 5) return;
      if (file.size > 10 * 1024 * 1024) return; // 10MB limit
      const url = URL.createObjectURL(file);
      newItems.push({
        id: `upload-${Date.now()}-${idx}`,
        name: file.name,
        url,
      });
    });

    if (newItems.length > 0) {
      setPhotos((prev) => [...prev, ...newItems].slice(0, 5));
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Calculated Order Value
  const parsedPrice = parseFloat(targetPrice) || 0;
  const parsedQuantity = parseInt(targetQuantity, 10) || 0;
  const estimatedOrderValue = parsedQuantity * parsedPrice;

  // Selected Category Name
  const selectedCategoryObj = MOCK_CATEGORIES.find((c) => c.slug === categorySlug);
  const categoryName = selectedCategoryObj?.name || 'Uncategorized';

  // Calendar Helpers
  const viewYear = calendarViewDate.getFullYear();
  const viewMonth = calendarViewDate.getMonth();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Monday as first day: 0=Sun -> 6, 1=Mon -> 0, etc.
  const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const isPastDay = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cellDate = new Date(viewYear, viewMonth, day);
    return cellDate < today;
  };

  const isTodayDay = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  const isSelectedDay = (day: number) => {
    const cellFormatted = formatDateString(new Date(viewYear, viewMonth, day));
    return neededBy === cellFormatted;
  };

  const handleSelectDay = (day: number) => {
    const chosen = new Date(viewYear, viewMonth, day);
    setNeededBy(formatDateString(chosen));
    setIsCalendarOpen(false);
  };

  const handlePresetDays = (daysFromNow: number) => {
    const chosen = new Date();
    chosen.setDate(chosen.getDate() + daysFromNow);
    setNeededBy(formatDateString(chosen));
    setCalendarViewDate(chosen);
    setIsCalendarOpen(false);
  };

  // Step validations
  const handleContinue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (step === 1) {
      if (!productName.trim()) {
        setErrorMsg('Please enter the product name and model.');
        return;
      }
      if (!categorySlug) {
        setErrorMsg('Please select a category.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!parsedQuantity || parsedQuantity <= 0) {
        setErrorMsg('Please specify a target volume greater than 0.');
        return;
      }
      if (!parsedPrice || parsedPrice <= 0) {
        setErrorMsg('Please enter a valid target price per unit.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (!contactPerson.trim()) {
        setErrorMsg('Please enter the contact person name.');
        return;
      }
      if (!corporateEmail.trim() || !corporateEmail.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      setStep(5);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const combinedNotes = [
        neededBy ? `Needed by: ${neededBy.trim()}` : '',
        deliveryNotes ? `Delivery requirements & notes: ${deliveryNotes.trim()}` : '',
        photos.length > 0 ? `Attached Photos: ${photos.length} image(s)` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await createWtbRequest({
        productName: productName.trim(),
        categorySlug,
        targetQuantity: parsedQuantity,
        targetPrice: parsedPrice,
        barcodeOrSku: barcodeOrSku.trim() || undefined,
        notes: combinedNotes || undefined,
        buyerName: contactPerson.trim(),
        buyerEmail: corporateEmail.trim(),
        buyerPhone: phoneWhatsapp.trim() || undefined,
        buyerCompany: company?.name || `${contactPerson.trim()} Commercial`,
        buyerCompanyId: company?.id,
        buyerUserId: company?.user_id || undefined,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(res.error || 'Failed to publish request. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0A6CFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] font-semibold text-[#5B6B82]">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not logged in gate: prompt account creation and redirect
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 sm:py-16 font-sans">
        <div className="mb-7">
          <Link href="/" className="inline-block">
            <Image
              src="/b2b-link-logo-tight.png"
              alt="B2B LINK"
              width={140}
              height={44}
              priority
              className="h-10 w-auto object-contain"
              style={{ width: 'auto' }}
            />
          </Link>
        </div>
        <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF3FF] border border-[#D0E2FF] flex items-center justify-center text-[#0A6CFF] mx-auto mb-5">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
            Account Required to Post WTB
          </h1>
          <p className="text-[14px] text-[#5B6B82] leading-relaxed mb-6">
            To submit wholesale procurement requests and receive supplier quotes, please create your verified buyer account or sign in. You will be automatically redirected right back here immediately after!
          </p>
          <div className="space-y-3">
            <Link
              href="/register?redirect=/requests/new&role=buyer"
              className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span>Create Free Buyer Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login?redirect=/requests/new"
              className="w-full min-h-[48px] rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center transition"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col justify-center items-center px-4 py-12 sm:py-16 font-sans">
      {/* Centered Logo above Card */}
      <div className="mb-7">
        <Link href="/" className="inline-block">
          <Image
            src="/b2b-link-logo-tight.png"
            alt="B2B LINK"
            width={140}
            height={44}
            priority
            className="h-10 w-auto object-contain"
            style={{ width: 'auto' }}
          />
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-8 sm:p-10 transition-all">
        {isSuccess ? (
          /* SUCCESS STATE */
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-2 leading-tight">
              Request Published!
            </h1>
            <p className="text-[14px] text-[#5B6B82] leading-relaxed mb-6">
              Your procurement request for <strong className="text-[#0B1F3A] font-bold">{productName}</strong> is now broadcast on the Buyer Demand Board. Verified sellers in{' '}
              <strong className="text-[#0B1F3A] font-bold">{categoryName}</strong> have been alerted.
            </p>

            <div className="space-y-3">
              <Link
                href="/requests"
                className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs"
              >
                View Requests Board
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setStep(1);
                  setProductName('');
                  setCategorySlug('');
                  setBarcodeOrSku('');
                  setTargetQuantity('');
                  setTargetPrice('');
                  setNeededBy('');
                  setPhotos([]);
                  setDeliveryNotes('');
                }}
                className="w-full text-center text-[14px] font-semibold text-[#5B6B82] hover:text-[#0B1F3A] pt-1 transition cursor-pointer"
              >
                Post another request
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Segmented 5-Step Progress Bar */}
            <div className="flex items-center gap-2 mb-7">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                    i <= step ? 'bg-[#0A6CFF]' : 'bg-[#E5ECF6]'
                  }`}
                />
              ))}
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[13px] text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: What do you need? */}
            {step === 1 && (
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  STEP 1 OF 5 &middot; BUYER REQUEST
                </div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  What do you need?
                </h1>
                <p className="text-[15px] text-[#5B6B82] mb-6 font-normal">
                  Describe the product so matching sellers can quote accurately.
                </p>

                <div className="space-y-4 mb-7">
                  {/* Product name and model */}
                  <div>
                    <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                      Product name and model
                    </label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Wireless Noise-Cancelling Headphones, Black"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={categorySlug}
                        onChange={(e) => setCategorySlug(e.target.value)}
                        className={`w-full appearance-none px-4 py-3 pr-10 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] transition font-medium cursor-pointer focus:outline-none focus:border-[#0A6CFF] ${
                          categorySlug ? 'text-[#0B1F3A]' : 'text-[#94A3B8]'
                        }`}
                      >
                        <option value="" disabled className="text-[#94A3B8]">
                          Select category
                        </option>
                        {MOCK_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.slug} className="text-[#0B1F3A]">
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#5B6B82] pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* EAN / UPC barcode */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[14px] font-semibold text-[#0B1F3A]">
                        EAN / UPC barcode
                      </label>
                      <span className="text-[13px] text-[#94A3B8] font-normal">Optional</span>
                    </div>
                    <input
                      type="text"
                      value={barcodeOrSku}
                      onChange={(e) => setBarcodeOrSku(e.target.value)}
                      placeholder="5013493405928"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                    <p className="text-[13px] text-[#5B6B82] mt-1.5 leading-snug">
                      Sellers who hold this barcode are alerted straight away.
                    </p>
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  Continue
                </button>

                {/* Cancel link */}
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full text-center text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 mt-4 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* STEP 2: Quantity and target price */}
            {step === 2 && (
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  STEP 2 OF 5 &middot; BUYER REQUEST
                </div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  Quantity and target price
                </h1>
                <p className="text-[15px] text-[#5B6B82] mb-6 font-normal">
                  Tell sellers how many you need and what you can pay.
                </p>

                <div className="space-y-4 mb-5">
                  {/* Two column grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                        Target volume (units)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={targetQuantity}
                        onChange={(e) => setTargetQuantity(e.target.value)}
                        placeholder="100"
                        className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                        Target price per unit (£)
                      </label>
                      <input
                        type="text"
                        required
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="50.00"
                        className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                    </div>
                  </div>

                  {/* Needed by with Calendar Date Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[14px] font-semibold text-[#0B1F3A]">
                        Needed by
                      </label>
                      <span className="text-[13px] text-[#94A3B8] font-normal">Optional</span>
                    </div>

                    <div className="relative" ref={calendarRef}>
                      <button
                        type="button"
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="w-full px-4 py-3 pr-10 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-left flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#0A6CFF] transition font-medium select-none"
                      >
                        <span className={neededBy ? 'text-[#0B1F3A]' : 'text-[#94A3B8]'}>
                          {neededBy || 'e.g. 30 Nov 2026'}
                        </span>
                        <div className="flex items-center gap-1.5 text-[#5B6B82]">
                          {neededBy && (
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNeededBy('');
                              }}
                              className="p-0.5 hover:text-red-600 rounded-full transition"
                              title="Clear date"
                            >
                              <X className="w-4 h-4" />
                            </span>
                          )}
                          <CalendarIcon className="w-5 h-5 text-[#5B6B82]" />
                        </div>
                      </button>

                      {/* Interactive Calendar Popover */}
                      {isCalendarOpen && (
                        <div className="absolute top-full mt-2 left-0 right-0 sm:right-auto sm:w-[320px] z-50 bg-white rounded-[22px] shadow-[0_16px_40px_rgba(11,31,58,0.16)] border border-[#E2E8F0] p-4 animate-in fade-in zoom-in-95 duration-150">
                          {/* Month / Year Header */}
                          <div className="flex items-center justify-between mb-3 px-1">
                            <button
                              type="button"
                              onClick={handlePrevMonth}
                              className="w-8 h-8 rounded-full hover:bg-[#F1F5F9] text-[#0B1F3A] flex items-center justify-center transition cursor-pointer"
                              title="Previous month"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="text-[14px] font-bold text-[#0B1F3A]">
                              {MONTH_NAMES[viewMonth]} {viewYear}
                            </div>
                            <button
                              type="button"
                              onClick={handleNextMonth}
                              className="w-8 h-8 rounded-full hover:bg-[#F1F5F9] text-[#0B1F3A] flex items-center justify-center transition cursor-pointer"
                              title="Next month"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Weekdays */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-[#8A9BB0] mb-2">
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                              <div key={d} className="py-1">
                                {d}
                              </div>
                            ))}
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[13px] mb-3">
                            {Array.from({ length: startDayOffset }).map((_, idx) => (
                              <div key={`empty-${idx}`} className="w-8 h-8" />
                            ))}
                            {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map((day) => {
                              const isPast = isPastDay(day);
                              const isSelected = isSelectedDay(day);
                              const isToday = isTodayDay(day);

                              return (
                                <button
                                  key={day}
                                  type="button"
                                  disabled={isPast}
                                  onClick={() => handleSelectDay(day)}
                                  className={`w-8 h-8 mx-auto rounded-full text-[13px] flex items-center justify-center transition cursor-pointer font-medium ${
                                    isSelected
                                      ? 'bg-[#0A6CFF] text-white font-bold shadow-xs'
                                      : isPast
                                      ? 'text-[#CBD5E1] cursor-not-allowed'
                                      : isToday
                                      ? 'border border-[#0A6CFF] text-[#0A6CFF] font-bold hover:bg-[#0A6CFF]/10'
                                      : 'text-[#0B1F3A] hover:bg-[#F1F5F9]'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>

                          {/* Quick Presets */}
                          <div className="pt-3 border-t border-[#EEF2F6] flex flex-wrap items-center justify-between gap-1 text-[12px] font-semibold">
                            <button
                              type="button"
                              onClick={() => handlePresetDays(0)}
                              className="px-2.5 py-1 rounded-lg text-[#0A6CFF] hover:bg-[#EBF3FF] transition cursor-pointer"
                            >
                              Today
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetDays(14)}
                              className="px-2.5 py-1 rounded-lg text-[#5B6B82] hover:text-[#0B1F3A] hover:bg-[#F1F5F9] transition cursor-pointer"
                            >
                              +2 Wks
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetDays(30)}
                              className="px-2.5 py-1 rounded-lg text-[#5B6B82] hover:text-[#0B1F3A] hover:bg-[#F1F5F9] transition cursor-pointer"
                            >
                              +1 Mo
                            </button>
                            {neededBy && (
                              <button
                                type="button"
                                onClick={() => {
                                  setNeededBy('');
                                  setIsCalendarOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 transition cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estimated Order Value Box */}
                <div className="p-4 sm:p-5 rounded-[18px] bg-[#F1F5F9] flex items-center justify-between mb-7">
                  <div>
                    <div className="text-[12px] font-medium text-[#5B6B82] mb-0.5">
                      Estimated order value
                    </div>
                    <div className="text-[24px] font-extrabold text-[#0B1F3A] leading-tight">
                      £{estimatedOrderValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-[13px] font-medium text-[#5B6B82] text-right">
                    {parsedQuantity > 0 && parsedPrice > 0
                      ? `${parsedQuantity.toLocaleString()} units × £${parsedPrice.toFixed(2)}`
                      : '0 units × £0.00'}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  Continue
                </button>

                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 mt-4 transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}

            {/* STEP 3: Add photos and notes */}
            {step === 3 && (
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  STEP 3 OF 5 &middot; BUYER REQUEST
                </div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  Add photos and notes
                </h1>
                <p className="text-[15px] text-[#5B6B82] mb-6 font-normal">
                  Photos help sellers confirm they have the right product.
                </p>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {/* Drag and drop upload zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(e.dataTransfer.files);
                  }}
                  className="border-2 border-dashed border-[#CBD5E1] rounded-[22px] p-6 sm:p-7 text-center bg-transparent hover:bg-[#F8FAFF] transition cursor-pointer mb-5"
                >
                  <div className="w-12 h-12 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="text-[14px] font-bold text-[#0B1F3A]">
                    Drag images here or <span className="text-[#0A6CFF] hover:underline">browse</span>
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-1">
                    PNG or JPG, up to 5 images, 10 MB each
                  </div>
                </div>

                {/* Thumbnails list with black circular × remove badge */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3.5 mb-5">
                    {photos.map((item) => (
                      <div
                        key={item.id}
                        className="relative w-15 h-15 rounded-[16px] bg-[#DDE5F2] border border-[#CBD5E1] flex items-center justify-center shadow-2xs"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-[15px]"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(item.id);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center shadow-xs hover:bg-red-600 transition cursor-pointer z-10"
                        >
                          <X className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery requirements and notes */}
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[14px] font-semibold text-[#0B1F3A]">
                      Delivery requirements and notes
                    </label>
                    <span className="text-[13px] text-[#94A3B8] font-normal">Optional</span>
                  </div>
                  <textarea
                    rows={3}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Packaging, delivery address (UK/EU), payment preference"
                    className="w-full px-4 py-3 text-[14px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium resize-none"
                  />
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  Continue
                </button>

                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full text-center text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 mt-4 transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}

            {/* STEP 4: Your contact details */}
            {step === 4 && (
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  STEP 4 OF 5 &middot; BUYER REQUEST
                </div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  Your contact details
                </h1>
                <p className="text-[15px] text-[#5B6B82] mb-6 font-normal">
                  Sellers will use these to send you their quotes.
                </p>

                <div className="space-y-4 mb-7">
                  {/* Contact person */}
                  <div>
                    <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                      Contact person
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Lars Lindqvist"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>

                  {/* Email address */}
                  <div>
                    <label className="block text-[14px] font-semibold text-[#0B1F3A] mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      value={corporateEmail}
                      onChange={(e) => setCorporateEmail(e.target.value)}
                      placeholder="e.g. name@example.com"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>

                  {/* Phone / WhatsApp */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[14px] font-semibold text-[#0B1F3A]">
                        Phone / WhatsApp
                      </label>
                      <span className="text-[13px] text-[#94A3B8] font-normal">Optional</span>
                    </div>
                    <input
                      type="tel"
                      value={phoneWhatsapp}
                      onChange={(e) => setPhoneWhatsapp(e.target.value)}
                      placeholder="+44 7911 123456"
                      className="w-full px-4 py-3 text-[15px] bg-white border border-[#E2E8F0] rounded-[16px] text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  Continue
                </button>

                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full text-center text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 mt-4 transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}

            {/* STEP 5: Review your request */}
            {step === 5 && (
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] mb-2">
                  STEP 5 OF 5 &middot; BUYER REQUEST
                </div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] mb-1.5 leading-tight">
                  Review your request
                </h1>
                <p className="text-[15px] text-[#5B6B82] mb-6 font-normal">
                  Check the details, then publish to matching sellers.
                </p>

                {/* Summary Table List */}
                <div className="divide-y divide-[#EEF2F6] mb-8 text-[14px]">
                  {/* Product */}
                  <div className="py-3.5 flex items-start justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Product</span>
                    <span className="font-bold text-[#0B1F3A] text-right">
                      {productName || '—'}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Category</span>
                    <span className="font-semibold text-[#0B1F3A] text-right">
                      {categoryName}
                    </span>
                  </div>

                  {/* Quantity */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Quantity</span>
                    <span className="font-semibold text-[#0B1F3A] text-right">
                      {parsedQuantity > 0 ? `${parsedQuantity.toLocaleString()} units` : '—'}
                    </span>
                  </div>

                  {/* Target price */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Target price</span>
                    <span className="font-semibold text-[#0B1F3A] text-right">
                      {parsedPrice > 0 ? `£${parsedPrice.toFixed(2)} per unit` : '—'}
                    </span>
                  </div>

                  {/* Photos */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Photos</span>
                    <span className="font-semibold text-[#0B1F3A] text-right">
                      {photos.length > 0 ? `${photos.length} attached` : 'None attached'}
                    </span>
                  </div>

                  {/* Contact */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <span className="text-[#64748B] shrink-0 font-normal">Contact</span>
                    <span className="font-semibold text-[#0B1F3A] text-right">
                      {contactPerson || '—'}
                    </span>
                  </div>
                </div>

                {/* Publish request button */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handlePublish}
                  className="w-full min-h-[50px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? 'Publishing request...' : 'Publish request'}
                </button>

                {/* Edit details link */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-[14px] font-semibold text-[#0B1F3A] hover:opacity-75 mt-4 transition cursor-pointer"
                >
                  Edit details
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function NewWtbRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] text-[#5B6B82]">
          Loading request form...
        </div>
      }
    >
      <NewWtbRequestContent />
    </Suspense>
  );
}
