'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  changePlan,
  getCompanyCards,
  addPaymentCard,
  TIER_PRICING,
  DEMO_TEST_CARD,
  type PaymentCard,
} from '@/lib/billing/billing-store';
import {
  X,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CreditCard,
  Plus,
} from 'lucide-react';
import type { MembershipTier } from '@/types/database';

interface UpgradeMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  targetTier?: 'silver' | 'gold';
  goldOnly?: boolean;
}

export function UpgradeMembershipModal({
  isOpen,
  onClose,
  title = 'Unlock Limit Reached',
  subtitle = 'You have used your 2 free contact unlocks on the Bronze plan. Upgrade to view direct supplier details, phone numbers, and submit wholesale bids.',
  targetTier,
  goldOnly = false,
}: UpgradeMembershipModalProps) {
  const router = useRouter();
  const { company, isLoggedIn, updateProfile, refreshProfile } = useAuth();

  const currentTier = ((company?.membership_tier || company?.tier || 'bronze') as string).toLowerCase();
  const isGoldOnly = Boolean(
    goldOnly ||
    targetTier === 'gold' ||
    currentTier === 'silver' ||
    (title && /gold\s+tier|gold\s+exclusive|broadcast/i.test(title))
  );

  const [step, setStep] = useState<'select_tier' | 'confirm_payment'>('select_tier');
  const [selectedTier, setSelectedTier] = useState<MembershipTier>(isGoldOnly ? 'gold' : 'silver');
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('new');

  // New card form state
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardholderName, setNewCardholderName] = useState('');
  const [newCardExpMonth, setNewCardExpMonth] = useState('12');
  const [newCardExpYear, setNewCardExpYear] = useState('28');
  const [newCardCvc, setNewCardCvc] = useState('');

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Load saved payment cards
  useEffect(() => {
    if (!isOpen) {
      setStep('select_tier');
      setStatusMsg(null);
      setIsUpgrading(false);
      return;
    }

    if (isGoldOnly) {
      setSelectedTier('gold');
    }

    if (company?.id) {
      const savedCards = getCompanyCards(company.id, company.email);
      setCards(savedCards);
      if (savedCards.length > 0) {
        const defaultCard = savedCards.find((c) => c.isDefault) || savedCards[0];
        setSelectedCardId(defaultCard.id);
      } else {
        setSelectedCardId('new');
      }
    }
  }, [isOpen, isGoldOnly, company]);

  if (!isOpen) return null;

  const handleProceedToPayment = (tier: 'silver' | 'gold') => {
    if (!isLoggedIn || !company) {
      router.push(`/login?redirect=/marketplace`);
      return;
    }
    setSelectedTier(tier);
    setStep('confirm_payment');
    setStatusMsg(null);
  };

  const handleApplyDemoCard = () => {
    setNewCardNumber(DEMO_TEST_CARD.cardNumber);
    setNewCardholderName(DEMO_TEST_CARD.cardholderName);
    setNewCardExpMonth(DEMO_TEST_CARD.expMonth);
    setNewCardExpYear(DEMO_TEST_CARD.expYear);
    setNewCardCvc(DEMO_TEST_CARD.cvc);
  };

  const handleExecuteUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setIsUpgrading(true);
    setStatusMsg(null);

    let activeCardId = selectedCardId;
    let cardLast4 = '4242';

    // 1. If using a new card, validate and store it
    if (selectedCardId === 'new') {
      const cleanNum = newCardNumber.replace(/\s+/g, '');
      if (cleanNum.length < 15) {
        setStatusMsg({ type: 'error', text: 'Please enter a valid 15 or 16-digit card number.' });
        setIsUpgrading(false);
        return;
      }
      if (!newCardholderName.trim()) {
        setStatusMsg({ type: 'error', text: 'Cardholder name is required.' });
        setIsUpgrading(false);
        return;
      }
      if (!newCardCvc.trim() || newCardCvc.length < 3) {
        setStatusMsg({ type: 'error', text: 'Please enter a valid 3 or 4-digit CVC code.' });
        setIsUpgrading(false);
        return;
      }

      const cardRes = addPaymentCard(
        company.id,
        {
          cardNumber: cleanNum,
          cardholderName: newCardholderName.trim(),
          expMonth: newCardExpMonth,
          expYear: newCardExpYear,
          brand: cleanNum.startsWith('5') ? 'mastercard' : 'visa',
          setAsDefault: true,
        },
        company.email
      );

      if (!cardRes.success || !cardRes.card) {
        setStatusMsg({ type: 'error', text: cardRes.error || 'Failed to verify card details.' });
        setIsUpgrading(false);
        return;
      }

      activeCardId = cardRes.card.id;
      cardLast4 = cardRes.card.last4;
    } else {
      const chosen = cards.find((c) => c.id === selectedCardId);
      if (chosen) {
        cardLast4 = chosen.last4;
      }
    }

    try {
      // 2. Change plan in local billing store and record payment
      const res = changePlan(company.id, selectedTier, company.name, company.email);
      if (!res.success) {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to update plan.' });
        setIsUpgrading(false);
        return;
      }

      // 3. Update company profile and sync with backend Supabase Auth & Companies table
      await updateProfile({
        tier: selectedTier,
        membership_tier: selectedTier,
      });

      // 4. Trigger /api/billing/activate-tier to sync and send official upgrade email
      if (company.email) {
        try {
          await fetch('/api/billing/activate-tier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              email: company.email,
              tier: selectedTier,
              companyName: company.name || company.company_name,
              contactName: company.contact_name,
              cardLast4,
            }),
          });
        } catch (apiErr) {
          console.warn('[UPGRADE API SYNC NOTICE]', apiErr);
        }
      }

      setStatusMsg({
        type: 'success',
        text: `Successfully upgraded to ${selectedTier.toUpperCase()} VIP Tier! Perks are active and receipt sent to ${company.email || 'your email'}.`,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('b2b_billing_update'));
        window.dispatchEvent(new CustomEvent('b2b_admin_update'));
      }

      await refreshProfile();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'An unexpected error occurred while processing membership upgrade.',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const planPricing = TIER_PRICING[selectedTier] || TIER_PRICING.gold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full ${step === 'confirm_payment' ? 'max-w-xl' : isGoldOnly ? 'max-w-md' : 'max-w-2xl'} bg-white rounded-[32px] border border-[#E3E9F2] shadow-2xl p-6 sm:p-8 overflow-hidden max-h-[90vh] overflow-y-auto`}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#F3F6FB] hover:bg-[#E2E8F0] text-[#5B6B82] flex items-center justify-center transition-colors cursor-pointer z-10"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: SELECT TIER */}
        {step === 'select_tier' && (
          <>
            {/* Modal Header */}
            <div className="text-center max-w-lg mx-auto mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-extrabold uppercase tracking-wider mb-3">
                <Lock className="w-3.5 h-3.5" />
                Membership Upgrade Required
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A] tracking-tight">
                {title}
              </h2>
              <p className="text-sm text-[#5B6B82] mt-2 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Feedback message */}
            {statusMsg && (
              <div
                className={`mb-6 p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Tier Cards Grid */}
            <div className={isGoldOnly ? 'w-full mb-6' : 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6'}>
              {/* Silver Tier Card (Hidden if Gold is required) */}
              {!isGoldOnly && (
                <div
                  onClick={() => setSelectedTier('silver')}
                  className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                    selectedTier === 'silver'
                      ? 'border-[#0A6CFF] bg-[#F4F8FF] shadow-md ring-2 ring-[#0A6CFF]/20'
                      : 'border-[#E3E9F2] bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-[#0A6CFF]">
                        Silver Tier
                      </span>
                      <span className="text-xs font-bold text-slate-500">Popular</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-[#0B1F3A]">€79</span>
                      <span className="text-xs font-bold text-[#5B6B82]">/ month</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-[#0B1F3A] font-semibold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                        <span><strong>20 Contact Unlocks</strong> per month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                        <span>50 Active Product Listings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                        <span>CSV Bulk Catalog Upload</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                        <span>Direct WhatsApp & Phone access</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProceedToPayment('silver');
                    }}
                    className="mt-5 w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0A6CFF] hover:bg-[#0857cf] text-white transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Select Silver (€79/mo)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Gold Tier Card */}
              <div
                onClick={() => setSelectedTier('gold')}
                className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between relative ${
                  selectedTier === 'gold'
                    ? 'border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                    : 'border-[#E3E9F2] bg-white hover:border-slate-300'
                }`}
              >
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                  Unlimited Access
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600">
                      Gold Tier
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-extrabold text-[#0B1F3A]">€179</span>
                    <span className="text-xs font-bold text-[#5B6B82]">/ month</span>
                  </div>

                  <div className="space-y-2.5 text-xs text-[#0B1F3A] font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span><strong>Unlimited Contact Unlocks</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span><strong>Internal Network Broadcasts (WTB & WTS)</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Unlimited Product Listings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Priority Spotlight & Hot Placement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Verified EU Gold Supplier Badge</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProceedToPayment('gold');
                  }}
                  className="mt-5 w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0B1F3A] hover:bg-[#152a4a] text-white transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Select Gold (€179/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Footer info */}
            <div className="border-t border-[#EAEFF6] pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6B82] gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Cancel anytime from your billing portal • Instant activation</span>
              </div>
              <Link
                href="/dashboard/billing"
                onClick={onClose}
                className="text-[#0A6CFF] font-bold hover:underline"
              >
                Manage Billing & Invoices &rarr;
              </Link>
            </div>
          </>
        )}

        {/* STEP 2: CONFIRM PAYMENT & SELECT CARD */}
        {step === 'confirm_payment' && (
          <form onSubmit={handleExecuteUpgrade} className="space-y-5">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between border-b border-[#EAEFF6] pb-4">
              <button
                type="button"
                onClick={() => {
                  setStep('select_tier');
                  setStatusMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B82] hover:text-[#0B1F3A] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Plans</span>
              </button>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0A6CFF] bg-[#EBF3FF] px-2.5 py-0.5 rounded-full">
                Step 2 of 2: Payment
              </span>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1F3A] tracking-tight">
                Confirm & Activate {planPricing.name}
              </h3>
              <p className="text-xs text-[#5B6B82] mt-1">
                Verify your payment method. Billed €{planPricing.price}/month recurring. Cancel anytime.
              </p>
            </div>

            {/* Feedback alert */}
            {statusMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Plan Summary Card */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  Selected Package
                </span>
                <div className="text-base font-extrabold text-[#0B1F3A] mt-1">
                  {planPricing.name}
                </div>
                <div className="text-xs text-[#5B6B82]">
                  {selectedTier === 'gold' ? 'Unlimited broadcasts & unlocks' : '20 unlocks & 50 listings'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#0B1F3A]">
                  €{planPricing.price}
                </div>
                <div className="text-[11px] text-[#5B6B82] font-medium">per month</div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs font-extrabold text-[#0B1F3A] uppercase tracking-wider mb-2">
                Select Payment Method
              </label>

              {cards.length > 0 && (
                <div className="space-y-2 mb-3">
                  {cards.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                        selectedCardId === c.id
                          ? 'border-[#0A6CFF] bg-[#F0F7FF] ring-2 ring-[#0A6CFF]/20'
                          : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment_card"
                          value={c.id}
                          checked={selectedCardId === c.id}
                          onChange={() => setSelectedCardId(c.id)}
                          className="w-4 h-4 text-[#0A6CFF] cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#5B6B82]" />
                          <span className="text-xs font-bold text-[#0B1F3A] capitalize">
                            {c.brand} ending in {c.last4}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#5B6B82]">
                          Exp {c.expMonth}/{c.expYear}
                        </span>
                        {c.isDefault && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </label>
                  ))}

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedCardId === 'new'
                        ? 'border-[#0A6CFF] bg-[#F0F7FF] ring-2 ring-[#0A6CFF]/20'
                        : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_card"
                      value="new"
                      checked={selectedCardId === 'new'}
                      onChange={() => setSelectedCardId('new')}
                      className="w-4 h-4 text-[#0A6CFF] cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#0A6CFF]" />
                      <span className="text-xs font-bold text-[#0B1F3A]">
                        Use a new payment card
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* New Card Form Fields */}
              {(selectedCardId === 'new' || cards.length === 0) && (
                <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#0B1F3A] uppercase tracking-wider">
                      Card Details
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyDemoCard}
                      className="text-[11px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                    >
                      Fill Demo Card
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5B6B82] mb-1">
                      Card Number
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-[#8A9BB0] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono font-medium focus:outline-none focus:border-[#0A6CFF]"
                        maxLength={19}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5B6B82] mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newCardholderName}
                      onChange={(e) => setNewCardholderName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A6CFF]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5B6B82] mb-1">
                        Exp Month
                      </label>
                      <input
                        type="text"
                        placeholder="12"
                        value={newCardExpMonth}
                        onChange={(e) => setNewCardExpMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono text-center focus:outline-none focus:border-[#0A6CFF]"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5B6B82] mb-1">
                        Exp Year
                      </label>
                      <input
                        type="text"
                        placeholder="28"
                        value={newCardExpYear}
                        onChange={(e) => setNewCardExpYear(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono text-center focus:outline-none focus:border-[#0A6CFF]"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5B6B82] mb-1">
                        CVC
                      </label>
                      <input
                        type="password"
                        placeholder="123"
                        value={newCardCvc}
                        onChange={(e) => setNewCardCvc(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono text-center focus:outline-none focus:border-[#0A6CFF]"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Total Due & Confirmation */}
            <div className="border-t border-[#EAEFF6] pt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#5B6B82]">Due Today:</span>
                <span className="font-extrabold text-[#0B1F3A]">€{planPricing.price}.00 EUR</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8A9BB0] mb-4">
                <span>VAT Reverse Charge:</span>
                <span>0% Applied (B2B)</span>
              </div>

              <button
                type="submit"
                disabled={isUpgrading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#0A6CFF] hover:bg-[#0857cf] text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Upgrade...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay €{planPricing.price}.00 & Upgrade to {selectedTier.toUpperCase()}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8A9BB0] mt-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Encrypted • Instant Perks Activation</span>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
