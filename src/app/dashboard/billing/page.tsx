'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getCompanyCards,
  getCompanySubscription,
  addPaymentCard,
  removePaymentCard,
  setDefaultCard,
  cancelSubscription,
  reactivateSubscription,
  changePlan,
  DEMO_TEST_CARD,
  TIER_PRICING,
  type PaymentCard,
  type UserSubscription,
} from '@/lib/billing/billing-store';
import { getAdminPayments, type AdminPaymentRecord } from '@/lib/admin/admin-store';
import type { MembershipTier } from '@/types/database';
import {
  CreditCard,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  X,
  FileText,
  Download,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';

export default function DashboardBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px] text-[#5B6B82] font-semibold text-sm">
          Loading billing settings...
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const { company, updateProfile } = useAuth();
  const companyId = company?.id || '';
  const companyName = company?.name || company?.company_name || 'Wholesale Member';
  const contactEmail = company?.email || '';
  const effectiveCompanyTier = (company?.membership_tier || company?.tier || 'bronze') as MembershipTier;

  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<AdminPaymentRecord | null>(null);

  // Add Card Form State
  const [pendingPlanTier, setPendingPlanTier] = useState<MembershipTier | null>(null);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardholderName, setNewCardholderName] = useState('');
  const [newCardExpMonth, setNewCardExpMonth] = useState('12');
  const [newCardExpYear, setNewCardExpYear] = useState('28');
  const [newCardCvc, setNewCardCvc] = useState('');
  const [newCardZip, setNewCardZip] = useState('10117');
  const [newCardSetDefault, setNewCardSetDefault] = useState(true);

  // Change Plan State
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('silver');

  const loadData = () => {
    const cList = getCompanyCards(companyId, contactEmail, company?.id);
    const sub = getCompanySubscription(companyId, contactEmail, effectiveCompanyTier);
    setCards(cList);
    setSubscription(sub);

    // Filter relevant payments
    const allPay = getAdminPayments();
    const myPay = allPay.filter(
      (p) =>
        (companyId && p.company_id === companyId) ||
        (contactEmail && p.contact_email?.toLowerCase() === contactEmail.toLowerCase().trim()) ||
        (companyName && p.company_name?.toLowerCase() === companyName.toLowerCase().trim())
    );
    setPayments(myPay);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_billing_update', loadData);
    window.addEventListener('b2b_admin_update', loadData);
    return () => {
      window.removeEventListener('b2b_billing_update', loadData);
      window.removeEventListener('b2b_admin_update', loadData);
    };
  }, [companyId, contactEmail, effectiveCompanyTier]);

  // Handle URL ?upgrade=gold or ?upgrade=silver query param
  useEffect(() => {
    const upgradeParam = searchParams?.get('upgrade');
    if (upgradeParam === 'gold' || upgradeParam === 'silver') {
      setSelectedTier(upgradeParam as MembershipTier);
      setShowPlanModal(true);
    }
  }, [searchParams]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleApplyTestCard = () => {
    setNewCardNumber(DEMO_TEST_CARD.cardNumber);
    setNewCardholderName(DEMO_TEST_CARD.cardholderName);
    setNewCardExpMonth(DEMO_TEST_CARD.expMonth);
    setNewCardExpYear(DEMO_TEST_CARD.expYear);
    setNewCardCvc(DEMO_TEST_CARD.cvc);
    setNewCardZip(DEMO_TEST_CARD.zip);
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = newCardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 15) {
      showNotification('error', 'Please enter a valid card number.');
      return;
    }
    if (!newCardholderName.trim()) {
      showNotification('error', 'Cardholder name is required.');
      return;
    }

    const res = addPaymentCard(
      companyId,
      {
        cardNumber: cleanNum,
        cardholderName: newCardholderName.trim(),
        expMonth: newCardExpMonth,
        expYear: newCardExpYear,
        brand: cleanNum.startsWith('5') ? 'mastercard' : 'visa',
        setAsDefault: newCardSetDefault,
      },
      contactEmail
    );

    if (res.success) {
      if (pendingPlanTier && pendingPlanTier !== 'bronze') {
        const planRes = changePlan(companyId, pendingPlanTier, companyName, contactEmail);
        if (planRes.success) {
          await updateProfile({ membership_tier: pendingPlanTier, tier: pendingPlanTier });

          try {
            await fetch('/api/billing/activate-tier', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                email: contactEmail,
                tier: pendingPlanTier,
                companyName,
                contactName: company?.contact_name,
                cardLast4: res.card?.last4 || '4242',
              }),
            });
          } catch (err) {
            console.warn('[BILLING ACTIVATE TIER NOTICE]', err);
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('b2b_admin_update'));
          }

          showNotification(
            'success',
            `Card saved and ${TIER_PRICING[pendingPlanTier].name} activated! Perks are now unlocked.`
          );
        } else {
          showNotification('success', `Payment card ending in ${res.card?.last4} added successfully.`);
        }
        setPendingPlanTier(null);
      } else {
        showNotification('success', `Payment card ending in ${res.card?.last4} added successfully.`);
      }
      setShowAddCardModal(false);
      setNewCardNumber('');
      setNewCardholderName('');
      setNewCardCvc('');
      loadData();
    } else {
      showNotification('error', res.error || 'Failed to add card.');
    }
  };

  const handleRemoveCard = (cardId: string) => {
    const res = removePaymentCard(companyId, cardId, contactEmail);
    if (!res.success) {
      showNotification('error', res.error || 'Cannot remove card.');
    } else {
      showNotification('success', 'Card removed from your account.');
      loadData();
    }
  };

  const handleSetDefault = (cardId: string) => {
    const res = setDefaultCard(companyId, cardId, contactEmail);
    if (res.success) {
      showNotification('success', 'Default subscription card updated.');
      loadData();
    }
  };

  const handleConfirmCancelSubscription = async () => {
    // End subscription once the 30 days are over; do NOT demote immediately
    const res = cancelSubscription(companyId, false);
    if (res.success) {
      showNotification(
        'success',
        `Auto-renewal canceled. Your ${TIER_PRICING[currentTier].name} benefits remain fully active until ${subscription?.currentPeriodEnd}. You will not be charged again.`
      );
      setShowCancelModal(false);
      loadData();
    } else {
      showNotification('error', res.error || 'Failed to cancel subscription.');
    }
  };

  const handleReactivateRenewal = () => {
    const res = reactivateSubscription(companyId);
    if (res.success) {
      showNotification(
        'success',
        `Auto-renewal reactivated! Your ${TIER_PRICING[currentTier].name} will renew automatically each month.`
      );
      loadData();
    } else {
      showNotification('error', res.error || 'Failed to reactivate renewal.');
    }
  };

  const handleConfirmPlanChange = async () => {
    if (selectedTier !== 'bronze' && cards.length === 0) {
      // Open card entry popup directly instead of confusing the customer
      setPendingPlanTier(selectedTier);
      setShowPlanModal(false);
      setShowAddCardModal(true);
      return;
    }

    const res = changePlan(companyId, selectedTier, companyName, contactEmail);
    if (res.success) {
      await updateProfile({ membership_tier: selectedTier, tier: selectedTier });

      try {
        await fetch('/api/billing/activate-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            email: contactEmail,
            tier: selectedTier,
            companyName,
            contactName: company?.contact_name,
            cardLast4: cards[0]?.last4 || '4242',
          }),
        });
      } catch (err) {
        console.warn('[BILLING ACTIVATE TIER NOTICE]', err);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('b2b_admin_update'));
      }

      showNotification(
        'success',
        `Membership plan updated to ${TIER_PRICING[selectedTier].name}! Card charged and perks activated.`
      );
      setShowPlanModal(false);
      loadData();
    } else {
      showNotification('error', res.error || 'Could not update plan.');
    }
  };

  const currentTier = (effectiveCompanyTier !== 'bronze' ? effectiveCompanyTier : (subscription?.tier || 'bronze')) as MembershipTier;
  const isPaidActive = currentTier !== 'bronze' && (subscription?.status === 'active' || subscription?.cancelAtPeriodEnd || effectiveCompanyTier !== 'bronze');
  const isCancelingAtPeriodEnd = Boolean(subscription?.cancelAtPeriodEnd && currentTier !== 'bronze');

  return (
    <div className="h-full overflow-y-auto max-w-[1200px] mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EAEFF6]">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Billing & Subscriptions
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Manage your card checkout, recurring subscription, and tax invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedTier(currentTier === 'gold' ? 'silver' : 'gold');
            setShowPlanModal(true);
          }}
          className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] px-5 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition shrink-0 self-start sm:self-auto"
        >
          <Zap className="w-4 h-4" />
          <span>{isPaidActive ? 'Change Plan' : 'Upgrade Plan'}</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mt-6 p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="text-[14px] font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* Grid: Current Plan & Subscription Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Card 1: Active Subscription Plan */}
        <div className="lg:col-span-2 bg-white rounded-[28px] p-6 sm:p-8 border border-[#EAEFF6] shadow-[0_4px_24px_rgba(11,31,58,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#5B6B82]">
                Active Package
              </span>
              <span
                className={`text-[12px] font-bold px-3 py-1 rounded-full capitalize ${
                  isCancelingAtPeriodEnd
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : subscription?.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : subscription?.status === 'canceled'
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-blue-50 text-[#0A6CFF] border border-blue-200'
                }`}
              >
                {isCancelingAtPeriodEnd
                  ? `Active until ${subscription?.currentPeriodEnd} (Auto-Renew Off)`
                  : subscription?.status === 'active'
                  ? '● Subscription Active'
                  : subscription?.status === 'canceled'
                  ? 'Canceled (Demoted to Bronze)'
                  : 'Free Package'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-6 border-b border-[#F0F4FA]">
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0B1F3A] capitalize">
                  {TIER_PRICING[currentTier].name}
                </h2>
                <p className="text-[14px] text-[#5B6B82] mt-1">
                  {currentTier === 'gold'
                    ? 'Unlimited listings, priority spotlights & 50 RFQ quotes/mo'
                    : currentTier === 'silver'
                    ? '50 active listings, CSV batch uploads & 25 RFQ quotes/mo'
                    : '15 active listings, 10 RFQ quotes/mo (Basic free trading package)'}
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-[32px] font-black text-[#0B1F3A]">
                  £{TIER_PRICING[currentTier].price}
                </span>
                <span className="text-[14px] text-[#5B6B82] font-medium">/month</span>
              </div>
            </div>

            {/* Subscription Period & Policy info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 text-[13px]">
              <div>
                <div className="text-[#8A9BB0] font-medium">Next Billing Date</div>
                <div className="text-[#0B1F3A] font-bold mt-0.5">
                  {isCancelingAtPeriodEnd
                    ? `None (Expires ${subscription?.currentPeriodEnd})`
                    : isPaidActive
                    ? subscription?.currentPeriodEnd || 'In 30 days'
                    : 'None (Free Package)'}
                </div>
              </div>
              <div>
                <div className="text-[#8A9BB0] font-medium">Commission Rate</div>
                <div className="text-[#0B1F3A] font-bold mt-0.5">0% (Zero platform trade fees)</div>
              </div>
            </div>
          </div>

          {/* Footer Actions for Subscription */}
          <div className="pt-4 border-t border-[#F0F4FA] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-[#8A9BB0]">
              {isCancelingAtPeriodEnd
                ? `Auto-renewal is off. No further charges will occur. Full ${TIER_PRICING[currentTier].name} benefits remain active until ${subscription?.currentPeriodEnd}.`
                : isPaidActive
                ? 'Card will automatically renew each month. You can cancel anytime.'
                : 'Upgrade anytime to unlock CSV batch importing and unlimited products.'}
            </div>

            <div className="flex items-center gap-3">
              {isCancelingAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={handleReactivateRenewal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reactivate Auto-Renewal</span>
                </button>
              ) : isPaidActive ? (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[13px] font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Cancel Subscription
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier('silver');
                    setShowPlanModal(true);
                  }}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Activate Paid Plan</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Tier Features & Limits Summary */}
        <div className="bg-[#0B1F3A] text-white rounded-[28px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_4px_24px_rgba(11,31,58,0.08)]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#00D2FF]">
              Included Capabilities
            </div>
            <div className="text-[20px] font-black mt-1">Tier Limits</div>
            <div className="mt-5 space-y-3.5 text-[13px]">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <span className="text-slate-300">Listing Capacity</span>
                <span className="font-bold text-white">
                  {currentTier === 'gold' ? 'Unlimited' : currentTier === 'silver' ? '50 items' : '15 items'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <span className="text-slate-300">Monthly RFQ Quotes</span>
                <span className="font-bold text-white">
                  {currentTier === 'gold' ? '50 quotes' : currentTier === 'silver' ? '25 quotes' : '10 quotes'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <span className="text-slate-300">CSV Bulk Uploads</span>
                <span className={`font-bold ${currentTier !== 'bronze' ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {currentTier !== 'bronze' ? 'Enabled' : 'Disabled (Silver+)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Spotlight / Hot Badges</span>
                <span className={`font-bold ${currentTier === 'gold' ? 'text-amber-400' : 'text-slate-500'}`}>
                  {currentTier === 'gold' ? 'Unlimited' : 'Disabled (Gold only)'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[12px] text-slate-400">Need higher quotes?</span>
            <button
              onClick={() => {
                setSelectedTier(currentTier === 'silver' ? 'gold' : 'silver');
                setShowPlanModal(true);
              }}
              className="text-[#00D2FF] hover:underline text-[12px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Switch package</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* PAYMENT METHODS (CARDS ON FILE)            */}
      {/* ========================================== */}
      <div className="mt-10 bg-white rounded-[28px] p-6 sm:p-8 border border-[#EAEFF6] shadow-[0_4px_24px_rgba(11,31,58,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#F0F4FA]">
          <div>
            <h2 className="text-[20px] font-extrabold text-[#0B1F3A]">Payment Cards</h2>
            <p className="text-[13px] text-[#5B6B82] mt-0.5">
              Add or remove cards. At least one card must stay on file for an active subscription.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPendingPlanTier(null);
              setShowAddCardModal(true);
            }}
            className="bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[13px] px-4 py-2.5 rounded-full flex items-center gap-2 cursor-pointer transition shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-[#0A6CFF]" />
            <span>Add Payment Card</span>
          </button>
        </div>

        {/* List of Saved Cards */}
        {cards.length === 0 ? (
          <div className="text-center py-10 bg-[#F8FAFF] rounded-2xl border border-dashed border-[#DCE7F6]">
            <CreditCard className="w-8 h-8 text-[#8A9BB0] mx-auto mb-2" />
            <p className="text-[14px] font-bold text-[#0B1F3A]">No payment cards on file</p>
            <p className="text-[12px] text-[#5B6B82] mt-0.5">Add a credit or debit card to activate subscriptions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => {
              const isOnlyCard = cards.length <= 1;
              const isProtectedCard = isPaidActive && isOnlyCard;

              return (
                <div
                  key={c.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    c.isDefault ? 'border-[#0A6CFF] bg-[#F8FAFF]' : 'border-[#EAEFF6] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-9 rounded-lg bg-[#0B1F3A] flex items-center justify-center text-white shrink-0 font-bold text-[11px] tracking-wider uppercase">
                      {c.brand === 'visa' ? 'VISA' : 'MC'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[15px] text-[#0B1F3A]">
                          •••• •••• •••• {c.last4}
                        </span>
                        {c.isDefault && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0A6CFF] text-white px-2 py-0.5 rounded-full">
                            Default / Subscription
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#5B6B82] mt-0.5">
                        Expires {c.expMonth}/{c.expYear} &bull; {c.cardholderName}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {!c.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(c.id)}
                        className="text-[12px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isProtectedCard}
                      onClick={() => handleRemoveCard(c.id)}
                      title={
                        isProtectedCard
                          ? 'One card must stay on file for your active subscription.'
                          : 'Remove card'
                      }
                      className={`p-2 rounded-xl border transition ${
                        isProtectedCard
                          ? 'opacity-40 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'border-red-200 text-red-600 hover:bg-red-50 cursor-pointer'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isPaidActive && cards.length === 1 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-[12px] text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your active subscription requires at least one payment method on file. To remove this card, add a
              replacement card first or cancel your subscription.
            </span>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* BILLING HISTORY / INVOICES TABLE           */}
      {/* ========================================== */}
      <div className="mt-10 bg-white rounded-[28px] p-6 sm:p-8 border border-[#EAEFF6] shadow-[0_4px_24px_rgba(11,31,58,0.03)]">
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-[#F0F4FA]">
          <div>
            <h2 className="text-[20px] font-extrabold text-[#0B1F3A]">Billing History & Invoices</h2>
            <p className="text-[13px] text-[#5B6B82] mt-0.5">
              Official commercial receipts and monthly subscription statements.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-10 text-[#8A9BB0] text-[13px]">
            No payment history recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F8FAFF] text-[#5B6B82] font-semibold uppercase text-[11px] tracking-wider border-b border-[#EAEFF6]">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FA] text-[#0B1F3A]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAFF] transition">
                    <td className="px-5 py-4 font-mono font-bold text-[#0A6CFF]">{p.invoice_number}</td>
                    <td className="px-4 py-4 text-[#5B6B82]">{p.created_at}</td>
                    <td className="px-4 py-4 font-medium">{p.plan_or_service}</td>
                    <td className="px-4 py-4 font-extrabold">£{p.amount_gbp.toFixed(2)}</td>
                    <td className="px-4 py-4 text-[#5B6B82]">{p.payment_method}</td>
                    <td className="px-4 py-4">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(p)}
                        className="text-[#0A6CFF] hover:underline font-bold text-[12px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL: ADD PAYMENT CARD                    */}
      {/* ========================================== */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-[480px] w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowAddCardModal(false)}
              className="absolute right-5 top-5 text-[#8A9BB0] hover:text-[#0B1F3A] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-[22px] font-extrabold text-[#0B1F3A]">
              {pendingPlanTier ? `Payment Details for ${TIER_PRICING[pendingPlanTier].name}` : 'Add Payment Card'}
            </h3>
            <p className="text-[13px] text-[#5B6B82] mt-1 mb-5">
              {pendingPlanTier
                ? `Enter your card details to activate ${TIER_PRICING[pendingPlanTier].name} (£${TIER_PRICING[pendingPlanTier].price}/month). Billed monthly, cancel anytime.`
                : 'Securely save a business credit or debit card for recurring membership.'}
            </p>

            {/* Plan Summary Badge when activating a tier */}
            {pendingPlanTier && (
              <div className="mb-4 p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0A6CFF]" />
                  <span className="font-bold text-[14px] text-[#0B1F3A]">
                    {TIER_PRICING[pendingPlanTier].name} Membership
                  </span>
                </div>
                <div className="text-[15px] font-black text-[#0A6CFF]">
                  £{TIER_PRICING[pendingPlanTier].price}
                  <span className="text-[12px] font-normal text-[#5B6B82]">/mo</span>
                </div>
              </div>
            )}

            {/* Test Card Quick Fill Button */}
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
              <span className="text-[12px] text-blue-900 font-medium">Use demo test card</span>
              <button
                type="button"
                onClick={handleApplyTestCard}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[12px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <span>⚡ Auto-fill Test Card</span>
              </button>
            </div>

            <form onSubmit={handleAddCardSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  value={newCardholderName}
                  onChange={(e) => setNewCardholderName(e.target.value)}
                  placeholder="e.g. Jeff Miller or Enterprise Ltd"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  required
                  maxLength={19}
                  value={newCardNumber}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                    setNewCardNumber(v.replace(/(.{4})/g, '$1 ').trim());
                  }}
                  placeholder="4242 •••• •••• 4242"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#E3E9F2] rounded-xl text-[#0B1F3A] font-mono focus:outline-none focus:border-[#0A6CFF]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1">Expires</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="MM"
                      value={newCardExpMonth}
                      onChange={(e) => setNewCardExpMonth(e.target.value)}
                      className="w-full px-2 py-2 text-center text-[13px] border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                    />
                    <span>/</span>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="YY"
                      value={newCardExpYear}
                      onChange={(e) => setNewCardExpYear(e.target.value)}
                      className="w-full px-2 py-2 text-center text-[13px] border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1">CVC</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="123"
                    value={newCardCvc}
                    onChange={(e) => setNewCardCvc(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-center text-[13px] border border-[#E3E9F2] rounded-xl font-mono focus:outline-none focus:border-[#0A6CFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0B1F3A] mb-1">ZIP / Postal</label>
                  <input
                    type="text"
                    placeholder="10117"
                    value={newCardZip}
                    onChange={(e) => setNewCardZip(e.target.value)}
                    className="w-full px-3 py-2 text-center text-[13px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[#0B1F3A]">
                  <input
                    type="checkbox"
                    checked={newCardSetDefault}
                    onChange={(e) => setNewCardSetDefault(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#0A6CFF] focus:ring-[#0A6CFF]"
                  />
                  <span>Set as default card for subscription renewal</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="w-1/2 py-2.5 rounded-full border border-[#E3E9F2] text-[#5B6B82] font-bold text-[14px] hover:bg-[#F3F6FB] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] transition cursor-pointer shadow-xs"
                >
                  {pendingPlanTier ? `Pay £${TIER_PRICING[pendingPlanTier].price} & Activate Plan` : 'Save Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CANCEL SUBSCRIPTION CONFIRMATION    */}
      {/* ========================================== */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-[480px] w-full p-6 sm:p-8 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-[22px] font-extrabold text-[#0B1F3A]">Cancel Auto-Renewal?</h3>
            <p className="text-[14px] text-[#5B6B82] mt-2 leading-relaxed">
              Are you sure you want to cancel automatic renewal for your <strong className="text-[#0B1F3A] capitalize">{TIER_PRICING[currentTier].name}</strong>?
            </p>

            <div className="my-5 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-[13px] text-amber-950 space-y-2.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-700" />
                <span>30-Day Period Retention Policy</span>
              </div>
              <p className="leading-relaxed">
                Because you were already charged for your billing period, your <strong className="font-bold text-[#0B1F3A]">{TIER_PRICING[currentTier].name} benefits remain 100% active until {subscription?.currentPeriodEnd}</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[12px] text-amber-900">
                <li>Your card will <strong className="font-bold">not</strong> be charged again.</li>
                <li>All active listings, quotation desks, and supplier perks remain active until {subscription?.currentPeriodEnd}.</li>
                <li>Once the 30 days are over, your plan will quietly switch to Bronze (Free) without recurring charges.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-1/2 py-2.5 rounded-full border border-[#E3E9F2] text-[#0B1F3A] font-bold text-[14px] hover:bg-[#F3F6FB] transition cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelSubscription}
                className="w-1/2 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[14px] transition cursor-pointer shadow-xs"
              >
                Cancel Auto-Renewal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CHANGE / UPGRADE PLAN               */}
      {/* ========================================== */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-[520px] w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowPlanModal(false)}
              className="absolute right-5 top-5 text-[#8A9BB0] hover:text-[#0B1F3A] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-[22px] font-extrabold text-[#0B1F3A]">Choose Membership Plan</h3>
            <p className="text-[13px] text-[#5B6B82] mt-1 mb-5">
              Select your commercial package. Billed monthly with zero transaction commission.
            </p>

            {/* 3 Tier Options */}
            <div className="space-y-3 mb-6">
              {/* Bronze */}
              <div
                onClick={() => setSelectedTier('bronze')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                  selectedTier === 'bronze'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="font-bold text-[15px] text-[#0B1F3A]">Bronze Tier</div>
                  <div className="text-[12px] text-[#5B6B82]">15 active listings &bull; 10 quotes/mo</div>
                </div>
                <div className="font-black text-[16px] text-[#0B1F3A]">Free</div>
              </div>

              {/* Silver */}
              <div
                onClick={() => setSelectedTier('silver')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                  selectedTier === 'silver'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] text-[#0B1F3A]">Silver Tier</span>
                    <span className="text-[10px] font-bold text-[#0A6CFF] bg-[#EBF3FF] px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  </div>
                  <div className="text-[12px] text-[#5B6B82]">50 active listings &bull; CSV uploads &bull; 25 quotes/mo</div>
                </div>
                <div className="font-black text-[16px] text-[#0B1F3A]">
                  £79<span className="text-[12px] font-normal text-[#5B6B82]">/mo</span>
                </div>
              </div>

              {/* Gold */}
              <div
                onClick={() => setSelectedTier('gold')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                  selectedTier === 'gold'
                    ? 'border-[#0A6CFF] bg-[#F8FAFF]'
                    : 'border-[#E3E9F2] bg-white hover:border-[#CBD5E1]'
                }`}
              >
                <div>
                  <div className="font-bold text-[15px] text-[#0B1F3A]">Gold VIP Tier</div>
                  <div className="text-[12px] text-[#5B6B82]">Unlimited listings &bull; Spotlight badges &bull; 50 quotes/mo</div>
                </div>
                <div className="font-black text-[16px] text-[#0B1F3A]">
                  £179<span className="text-[12px] font-normal text-[#5B6B82]">/mo</span>
                </div>
              </div>
            </div>

            {selectedTier !== 'bronze' && (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 mb-5 flex items-center justify-between text-xs">
                <span className="text-[#5B6B82] font-medium">Payment Method:</span>
                {cards.length > 0 ? (
                  <span className="font-bold text-[#0B1F3A] flex items-center gap-1.5 capitalize">
                    <CreditCard className="w-3.5 h-3.5 text-[#0A6CFF]" />
                    {cards.find((c) => c.isDefault)?.brand || cards[0].brand} ending in {cards.find((c) => c.isDefault)?.last4 || cards[0].last4}
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold">
                    Card will be requested next
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="w-1/2 py-2.5 rounded-full border border-[#E3E9F2] text-[#5B6B82] font-bold text-[14px] hover:bg-[#F3F6FB] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                className="w-1/2 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] transition cursor-pointer"
              >
                {selectedTier === 'bronze' ? 'Downgrade to Free' : `Activate ${TIER_PRICING[selectedTier].name}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: VIEW OFFICIAL INVOICE RECEIPT       */}
      {/* ========================================== */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-[500px] w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute right-5 top-5 text-[#8A9BB0] hover:text-[#0B1F3A] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between border-b border-[#EAEFF6] pb-4 mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6CFF]">
                  B2B LINK OÜ &bull; Commercial Receipt
                </span>
                <h3 className="text-[20px] font-black text-[#0B1F3A] mt-0.5">
                  {selectedReceipt.invoice_number}
                </h3>
              </div>
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                {selectedReceipt.status}
              </span>
            </div>

            <div className="space-y-3 text-[13px] text-[#0B1F3A]">
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Subscriber:</span>
                <span className="font-bold">{selectedReceipt.company_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Transaction Date:</span>
                <span>{selectedReceipt.created_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Payment Method:</span>
                <span className="font-medium">{selectedReceipt.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Transaction Ref:</span>
                <span className="font-mono text-[12px]">{selectedReceipt.transaction_id}</span>
              </div>
              <div className="flex justify-between border-t border-[#F0F4FA] pt-3 text-[15px] font-black">
                <span>Total Settled:</span>
                <span className="text-[#0A6CFF]">£{selectedReceipt.amount_gbp.toFixed(2)} GBP</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EAEFF6] flex items-center justify-between">
              <span className="text-[11px] text-[#8A9BB0]">VAT 0% Reverse Charge Applied</span>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] text-[12px] font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
