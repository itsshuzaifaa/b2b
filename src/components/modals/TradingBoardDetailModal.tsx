'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  isLeadUnlocked,
  unlockLead,
  getRemainingUnlocks,
} from '@/lib/leads/unlock-store';
import { startMarketplaceInquiry, dispatchWtbLeadToBuyerDashboard } from '@/lib/messaging/messaging-store';
import { createProductInquiry } from '@/lib/actions/inquiries';
import { submitQuotation } from '@/lib/actions/quotations';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import type { TradingBoardItem } from '@/lib/trading-board-data';
import type { Product, WtbRequest, MembershipTier } from '@/types/database';
import {
  X,
  Lock,
  Unlock,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  Barcode,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface TradingBoardDetailModalProps {
  item: TradingBoardItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TradingBoardDetailModal({ item, isOpen, onClose }: TradingBoardDetailModalProps) {
  const router = useRouter();
  const { isLoggedIn, company } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number>(10);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [notes, setNotes] = useState('');

  const tier = (company?.membership_tier || company?.tier || 'bronze') as MembershipTier;
  const remainingUnlocks = company ? getRemainingUnlocks(company.id, tier) : 2;

  useEffect(() => {
    if (!item) return;
    setUnitPrice(item.price ? String(item.price) : '');
    setTargetQuantity(item.moq || 10);
    setIsSuccess(false);
    setErrorMsg(null);

    if (company?.id) {
      const unlocked = isLeadUnlocked(company.id, item.id);
      setIsUnlocked(unlocked || tier === 'gold');
    } else {
      setIsUnlocked(false);
    }
  }, [item, company, tier]);

  useEffect(() => {
    if (!isOpen || !item) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, item, onClose]);

  if (!isOpen || !item) return null;

  const isBuy = item.type === 'BUY';
  const parsedPrice = parseFloat(unitPrice) || item.price || 0;
  const estimatedTotal = (parsedPrice * targetQuantity).toFixed(2);

  // Handle unlock click
  const handleUnlock = () => {
    if (!company) {
      router.push('/login?redirect=/marketplace');
      return;
    }

    if (remainingUnlocks > 0 || tier === 'gold') {
      const res = unlockLead(company.id, item.id, tier);
      if (res.success) {
        setIsUnlocked(true);
      } else {
        setUpgradeModalOpen(true);
      }
    } else {
      setUpgradeModalOpen(true);
    }
  };

  // Direct email parameters
  const emailSubject = encodeURIComponent(
    isBuy
      ? `Quotation: ${item.description} [B2B LINK Sourcing]`
      : `Wholesale Sourcing: ${item.description} [B2B LINK]`
  );

  const emailBody = encodeURIComponent(
    `Hello ${item.contactName},\n\nI am contacting you regarding your ${isBuy ? 'buyer request' : 'wholesale lot'} for "${item.description}" listed on the B2B LINK Live Trading Board.\n\n` +
      `Our Proposed Terms:\n` +
      `- Quantity: ${targetQuantity} units (Listed: ${item.qty} u)\n` +
      `- Unit Price: ${item.currency}${parsedPrice.toFixed(2)}\n` +
      `- Estimated Total: ${item.currency}${estimatedTotal}\n` +
      `- Lead Time: ${leadTimeDays} business days\n\n` +
      `${notes ? `Additional Notes / Delivery Terms:\n${notes}\n\n` : ''}` +
      `Best regards,\n${company?.contact_name || company?.name || 'Verified Trader'}\n` +
      `${company?.name || ''}\n${company?.email || ''}\n${company?.phone || ''}`
  );

  // Live Chat
  const handleDirectChat = () => {
    if (!isUnlocked) {
      handleUnlock();
      return;
    }

    if (isBuy) {
      const wtbMock: WtbRequest = {
        id: item.id,
        buyer_name: item.contactName,
        buyer_email: item.contactEmail,
        buyer_company: item.companyName,
        product_name: item.description,
        category_slug: item.category.toLowerCase().replace(/\s+/g, '-'),
        target_quantity: item.qty,
        target_price: item.price,
        barcode_or_sku: item.ean,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      if (company) {
        dispatchWtbLeadToBuyerDashboard({
          wtbRequest: wtbMock,
          sellerCompany: company,
          actionType: 'unlocked',
          quoteDetails: {
            unitPrice: parsedPrice,
            quantity: targetQuantity,
            totalPrice: Number(estimatedTotal),
            leadTimeDays,
            notes,
          },
        });
      }
      onClose();
      router.push('/dashboard/messages');
    } else {
      const prodMock: Product = {
        id: item.id,
        company_id: 'supplier-co',
        category_slug: item.category.toLowerCase().replace(/\s+/g, '-'),
        title: item.description,
        brand: item.brand,
        condition: item.condition,
        barcode_or_sku: item.ean,
        unit_price: item.price,
        quantity_available: item.qty,
        moq: item.moq,
        status: 'active',
        is_hot: true,
        created_at: new Date().toISOString(),
        company: {
          id: 'supplier-co',
          name: item.companyName,
          contact_name: item.contactName,
          email: item.contactEmail,
          role: 'seller',
          membership_tier: 'gold',
          approval_status: 'approved',
          categories: [item.category],
          created_at: new Date().toISOString(),
        },
      };
      const defaultMsg = `Hello, I would like to inquire about ordering ${targetQuantity} units of "${item.description}" at ${item.currency}${parsedPrice.toFixed(2)} / unit.`;
      const conv = startMarketplaceInquiry(
        prodMock,
        company,
        company?.contact_name || company?.name || 'Verified Trader',
        company?.email || '',
        company?.phone || '',
        defaultMsg
      );
      onClose();
      router.push(`/dashboard/inquiries?id=${conv.id}`);
    }
  };

  // Submit formal Inquiry or Quote
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isUnlocked) {
      setErrorMsg('You must unlock this contact first to send messages or inquiries.');
      handleUnlock();
      return;
    }

    if (parsedPrice <= 0) {
      setErrorMsg('Please enter a valid price.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isBuy) {
        // Submit Quote for WTB
        await submitQuotation({
          wtbRequestId: item.id,
          sellerCompanyId: company?.id || 'comp-local',
          sellerEmail: company?.email || 'trader@b2blink.eu',
          unitPrice: parsedPrice,
          quantityOffered: targetQuantity,
          leadTimeDays,
          notes: notes || `Direct quotation for ${targetQuantity} units at ${item.currency}${parsedPrice.toFixed(2)}.`,
        });
      } else {
        // Submit Product Inquiry
        await createProductInquiry({
          productId: item.id,
          buyerName: company?.contact_name || company?.name || 'Commercial Buyer',
          buyerEmail: company?.email || 'buyer@b2blink.eu',
          buyerCompanyId: company?.id,
          targetQuantity,
          offeredPrice: parsedPrice,
          message: notes || `Inquiry for ${targetQuantity} units at ${item.currency}${parsedPrice.toFixed(2)}.`,
        });
      }
      setIsSuccess(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error submitting request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1F3A]/50 backdrop-blur-xs animate-in fade-in duration-200 pointer-events-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-[0_20px_50px_rgba(11,31,58,0.18)] border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 border-b border-[#EEF2F6] flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${
                  isBuy
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : 'bg-[#E0F2FE] text-[#0284C7]'
                }`}
              >
                {isBuy ? 'Want To Buy Request' : 'Available Stock Listing'}
              </span>
              <span className="bg-[#EEF2F6] text-[#334155] text-[11px] font-bold px-2.5 py-1 rounded-full">
                {item.match} match
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Title & Key Highlights Bar */}
          <div className="bg-[#F8FAFC] border-b border-[#EEF2F6] px-6 sm:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-[18px] sm:text-[21px] font-black text-[#0B1F3A] leading-snug">
                  {item.description}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[12px] text-[#64748B] font-bold">
                  <span className="text-[#0B1F3A]">{item.brand}</span>
                  <span>&bull;</span>
                  <span>Model: {item.itemCode}</span>
                  <span>&bull;</span>
                  <span className="uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {item.condition}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </span>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  {isBuy ? 'Target Price' : 'Wholesale Price'}
                </div>
                <div className="text-[24px] font-black text-[#0B1F3A] leading-tight">
                  {item.currency}{item.price.toFixed(2)}
                  <span className="text-[13px] font-medium text-[#64748B]"> / unit</span>
                </div>
              </div>
            </div>

            {/* Quick Specs Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-[#EAEFF6] text-[12px]">
              <div>
                <span className="text-[#8A9BB0] block text-[11px]">EAN / GTIN</span>
                <span className="font-mono font-bold text-[#0B1F3A]">
                  {item.ean && item.ean !== '8806095087286' && item.ean !== '195949048735' && item.ean !== '—' ? item.ean : 'n/a'}
                </span>
              </div>
              <div>
                <span className="text-[#8A9BB0] block text-[11px]">Quantity {isBuy ? 'Wanted' : 'In Stock'}</span>
                <span className="font-bold text-[#0B1F3A]">{item.qty.toLocaleString()} units</span>
              </div>
              <div>
                <span className="text-[#8A9BB0] block text-[11px]">Minimum Order</span>
                <span className="font-bold text-[#0B1F3A]">{item.moq} units</span>
              </div>
              <div>
                <span className="text-[#8A9BB0] block text-[11px]">Category</span>
                <span className="font-bold text-[#0B1F3A]">{item.category}</span>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
            {/* COUNTERPARTY DETAILS (LOCKED VS UNLOCKED) */}
            <div className="rounded-2xl border overflow-hidden transition-all bg-[#F0F7FF] border-[#D0E2FF]">
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0A6CFF] block">
                      {isBuy ? 'Verified Buyer Procurement Contact' : 'Verified Supplier Commercial Contact'}
                    </span>

                    {isUnlocked ? (
                      <div className="mt-2 space-y-1">
                        <div className="font-black text-[#0B1F3A] text-[16px] flex items-center gap-2">
                          <span>{item.contactName}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Verified Member
                          </span>
                        </div>
                        <div className="text-[13px] text-[#475569] font-medium flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.companyName}</span>
                        </div>
                        <div className="text-[13px] text-[#475569] font-mono flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.contactEmail}</span>
                        </div>
                        {item.contactPhone && (
                          <div className="text-[13px] text-[#475569] flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-[#0B1F3A] font-extrabold text-[15px]">
                          <Lock className="w-4 h-4 text-amber-500" />
                          <span>Direct Contact Information Locked</span>
                        </div>
                        <p className="text-[12.5px] text-[#64748B] mt-1 max-w-md leading-relaxed">
                          Verified corporate entity in <strong className="text-[#0B1F3A]">{item.location}</strong>. Unlock to view corporate email, direct trade desk line, and send a quotation or inquiry.
                        </p>
                        <div className="mt-2 text-[12px] text-[#0A6CFF] font-bold">
                          {tier === 'gold' ? 'Unlimited Unlocks Available (Gold Membership)' : `${remainingUnlocks} unlock credits remaining`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions depending on unlock state */}
                  <div className="shrink-0 flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
                    {isUnlocked ? (
                      <>
                        <a
                          href={`mailto:${item.contactEmail}?subject=${emailSubject}&body=${emailBody}`}
                          className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-[#0A6CFF] border border-[#BFDBFE] font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs"
                          title="Open your email client to send an official direct email"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Email Directly</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleDirectChat}
                          className="px-4 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                          title="Start live negotiation chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Live Chat</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUnlock}
                        className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Unlock Contact (1 Credit)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FORM TO SUBMIT INQUIRY OR QUOTE */}
            {isSuccess ? (
              <div className="py-6 text-center space-y-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-6">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-[20px] font-extrabold text-[#0B1F3A]">
                  {isBuy ? 'Quotation Dispatched!' : 'Commercial Inquiry Dispatched!'}
                </h4>
                <p className="text-[13.5px] text-[#64748B] max-w-md mx-auto leading-relaxed">
                  Your offer was sent to <strong className="text-[#0B1F3A]">{item.contactName}</strong> at <strong className="text-[#0B1F3A]">{item.companyName}</strong>. You can continue negotiations in your Messages desk.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-7 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[13px] hover:bg-[#0857cf] transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : !isUnlocked ? (
              <div className="rounded-2xl bg-[#F8FAFD] border border-[#EAEFF6] p-6 sm:p-7 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="text-[17px] font-extrabold text-[#0B1F3A]">
                  {isBuy ? 'Unlock Lead to Submit Quotation' : 'Direct Messaging & Inquiry Locked'}
                </h4>
                <p className="text-[13px] text-[#5B6B82] max-w-md mx-auto leading-relaxed">
                  {isBuy
                    ? 'Verified buyer procurement details and quotation submissions require 1 unlock credit. Once unlocked, you can quote directly with 0% commission.'
                    : 'To message this seller, submit wholesale inquiries, and negotiate deal terms, you must unlock their commercial contact first (1 credit).'}
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleUnlock}
                    className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{isBuy ? 'Unlock Lead to Quote (1 Credit)' : 'Unlock Contact to Message (1 Credit)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 py-3 rounded-full text-[13px] font-bold text-[#64748B] hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="text-[14px] font-black text-[#0B1F3A] uppercase tracking-wider">
                  {isBuy ? 'Submit Quotation to Buyer' : 'Submit Wholesale Inquiry to Seller'}
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-[13px] text-red-700 font-medium">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Offered Unit Price ({item.currency}) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px]">
                        {item.currency}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder={String(item.price)}
                        className="w-full pl-8 pr-4 py-2.5 text-[13.5px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Quantity Required / Offered <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-4 py-2.5 text-[13.5px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                    Commercial Terms / Dispatch Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Specify target delivery location, payment escrow, VAT reverse-charge terms..."
                    className="w-full px-4 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
                  />
                </div>

                {/* Deal Total Preview */}
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-[13px]">
                  <span className="text-[#64748B] font-medium">Estimated Deal Volume:</span>
                  <span className="text-[16px] font-black text-[#0B1F3A]">
                    {item.currency}{Number(estimatedTotal).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-full text-[13px] font-bold text-[#64748B] hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] disabled:opacity-50 text-white text-[13px] font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Sending...' : isBuy ? 'Send Quotation' : 'Submit Inquiry'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {upgradeModalOpen && (
        <UpgradeMembershipModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
        />
      )}
    </>
  );
}
