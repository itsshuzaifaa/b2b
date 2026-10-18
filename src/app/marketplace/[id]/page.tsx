'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { InquiryModal } from '@/components/modals/InquiryModal';
import { AuthGateModal } from '@/components/modals/AuthGateModal';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import {
  isLeadUnlocked,
  unlockLead,
  getRemainingUnlocks,
  getUnlockedLeadIds,
} from '@/lib/leads/unlock-store';
import type { Product, MembershipTier } from '@/types/database';
import {
  ArrowLeft,
  ShieldCheck,
  Package,
  Barcode,
  Truck,
  CheckCircle2,
  Building2,
  MessageSquare,
  AlertCircle,
  Lock,
  Sparkles,
} from 'lucide-react';

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, company } = useAuth();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null);

  const tier = (company?.membership_tier || company?.tier || 'bronze') as MembershipTier;
  const remainingUnlocks = company ? getRemainingUnlocks(company.id, tier) : 2;

  const refreshUnlocked = () => {
    if (company?.id) {
      setUnlockedIds(getUnlockedLeadIds(company.id));
    } else {
      setUnlockedIds([]);
    }
  };

  useEffect(() => {
    refreshUnlocked();
    window.addEventListener('b2b_lead_unlock_update', refreshUnlocked);
    return () => window.removeEventListener('b2b_lead_unlock_update', refreshUnlocked);
  }, [company]);

  useEffect(() => {
    let isMounted = true;
    if (!productId) return;

    fetch(`/api/products?id=${productId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && (data.product || (data.products && data.products.length > 0))) {
          const found = data.product || data.products.find((p: Product) => p.id === productId) || data.products[0];
          setProduct(found);
        } else {
          setError('Product listing not found or has been archived.');
        }
      })
      .catch((err) => {
        console.error('[PRODUCT LOAD ERROR]', err);
        if (isMounted) setError('Failed to load product details.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const isOwnProduct = Boolean(company?.id && product?.company_id === company.id);
  const isUnlocked = Boolean(
    isOwnProduct ||
      (product &&
        (unlockedIds.includes(product.id) ||
          (company?.id ? isLeadUnlocked(company.id, product.id) : false)))
  );

  const handleInquire = () => {
    if (!product) return;
    if (!isLoggedIn || !company) {
      router.push(`/register?redirect=/marketplace/${productId}`);
      return;
    }

    if (isUnlocked) {
      setInquiryOpen(true);
      return;
    }

    // Attempt to unlock lead
    if (remainingUnlocks > 0 || tier === 'gold') {
      const res = unlockLead(company.id, product.id, tier);
      if (res.success) {
        setUnlockFeedback(
          `Supplier contact unlocked! (${
            res.remaining === Infinity ? 'Unlimited' : `${res.remaining} remaining`
          })`
        );
        setTimeout(() => setUnlockFeedback(null), 3500);
        refreshUnlocked();
        setInquiryOpen(true);
      } else {
        setUpgradeModalOpen(true);
      }
    } else {
      setUpgradeModalOpen(true);
    }
  };

  const handleDirectChat = () => {
    // Open the same direct supplier desk popup as WTB quote unlock, with email directly & live chat options
    handleInquire();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] pt-24 sm:pt-28 pb-16 lg:pb-24">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-36 bg-slate-200 rounded-full mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-white rounded-[28px] h-[420px] p-6 border border-[#EAEFF6]" />
              <div className="lg:col-span-5 bg-white rounded-[28px] h-[420px] p-8 border border-[#EAEFF6]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] pt-24 sm:pt-28 pb-16 lg:pb-24 flex items-center justify-center">
        <div className="max-w-md w-full mx-5 bg-white rounded-[28px] border border-[#EAEFF6] p-8 text-center shadow-lg">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-[20px] font-bold text-[#0B1F3A] mb-2">Listing Not Available</h3>
          <p className="text-[14px] text-[#5B6B82] mb-6">
            {error || 'This wholesale lot could not be found or has already been fulfilled.'}
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] transition-colors"
          >
            Browse Live Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const sellerName = product.company?.name || 'Vetted Global Seller';
  const sellerInitials = sellerName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F3F6FB] pt-24 sm:pt-28 pb-16 lg:pb-24">
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
        {/* Back Link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-[14px] font-bold text-[#41536D] hover:text-[#0A6CFF] mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Marketplace</span>
        </Link>

        {/* 2-Column Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Image Card & Guarantees (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Main Product Showcase Card: 28px radius, white, soft shadow */}
            <div className="bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] overflow-hidden relative h-[360px] sm:h-[460px] p-6 flex items-center justify-center">
              <div className="relative w-full h-full">
                <Image
                  src={product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                  alt={product.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 650px"
                  className="object-contain"
                />
              </div>

              {/* Status Badge */}
              <div className="absolute top-5 left-5">
                {product.is_hot ? (
                  <span className="bg-[#0B1F3A] text-[#00C2FF] border border-[#00C2FF]/30 text-[12px] font-bold px-3 py-1 rounded-full shadow-xs">
                    Hot deal ⚡
                  </span>
                ) : (
                  <span className="bg-[#0A6CFF] text-white text-[12px] font-bold px-3 py-1 rounded-full shadow-xs">
                    Verified stock
                  </span>
                )}
              </div>
            </div>

            {/* 3 Trust Callout Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-[#EAEFF6] text-[13px] flex items-center gap-3 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-[#0A6CFF] shrink-0" />
                <span className="text-[#0B1F3A] font-semibold">100% Authentic EU Lots</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-[#EAEFF6] text-[13px] flex items-center gap-3 shadow-2xs">
                <Truck className="w-5 h-5 text-[#0A6CFF] shrink-0" />
                <span className="text-[#0B1F3A] font-semibold">Pallet Dispatch in 48h</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-[#EAEFF6] text-[13px] flex items-center gap-3 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-[#0A6CFF] shrink-0" />
                <span className="text-[#0B1F3A] font-semibold">0% Platform Trade Fee</span>
              </div>
            </div>
          </div>

          {/* Right Column: Commercial Specifications & Actions (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-7 sm:p-9 shadow-[0_10px_30px_rgba(11,31,58,0.06)] space-y-6">
              {/* Category Eyebrow & Title */}
              <div>
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2">
                  {product.category_slug.replace('-', ' ')}
                </span>
                <h1 className="text-[24px] sm:text-[28px] leading-[1.2] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
                  {product.title}
                </h1>

                {product.barcode_or_sku && (
                  <div className="flex items-center gap-2 text-[13px] text-[#5B6B82] font-mono mt-3 bg-[#F3F6FB] py-1 px-3 rounded-full inline-flex border border-[#E3E9F2]">
                    <Barcode className="w-4 h-4 text-[#0A6CFF]" />
                    <span>EAN/GTIN: {product.barcode_or_sku}</span>
                  </div>
                )}
              </div>

              {/* Price & MOQ Box */}
              <div className="bg-[#F3F6FB] border border-[#E3E9F2] rounded-2xl p-5 space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-semibold text-[#5B6B82]">Wholesale Unit Price:</span>
                  <div className="text-right">
                    <span className="text-[32px] font-extrabold text-[#0B1F3A] leading-none block">
                      €{product.unit_price.toFixed(2)}
                    </span>
                    <span className="text-[12px] text-[#5B6B82] mt-1 block">ex VAT / per piece</span>
                  </div>
                </div>

                <div className="border-t border-[#E3E9F2] pt-3 flex items-center justify-between text-[14px]">
                  <div className="flex items-center gap-2 text-[#41536D]">
                    <Package className="w-4 h-4 text-[#0A6CFF]" />
                    <span>Minimum Order Quantity:</span>
                  </div>
                  <strong className="text-[16px] font-extrabold text-[#0A6CFF]">{product.moq} pcs</strong>
                </div>

                <div className="border-t border-[#E3E9F2] pt-3 flex items-center justify-between text-[14px] text-[#41536D]">
                  <span>Available Stock Volume:</span>
                  <span className="font-bold text-[#0B1F3A]">{product.quantity_available.toLocaleString()} units</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleInquire}
                  className={`w-full min-h-[48px] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] ${
                    isUnlocked
                      ? 'bg-[#0A6CFF] hover:bg-[#0857cf] text-white shadow-[#0A6CFF]/20'
                      : remainingUnlocks > 0 || tier === 'gold'
                      ? 'bg-[#0A6CFF] hover:bg-[#0857cf] text-white shadow-[#0A6CFF]/25'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white shadow-amber-500/20'
                  }`}
                >
                  {isUnlocked ? (
                    <span>Send Direct Inquiry to Seller</span>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 text-white shrink-0" />
                      <span>Unlock Contact</span>
                      {(remainingUnlocks > 0 || tier === 'gold') && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white tracking-wide">
                          {remainingUnlocks === Infinity ? 'Unlimited' : `${remainingUnlocks} Left`}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDirectChat}
                  className="w-full min-h-[46px] rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0A6CFF] font-bold text-[14px] flex items-center justify-center gap-2 transition-colors border border-[#0A6CFF]/20"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isUnlocked ? 'Contact & Chat with Seller' : 'Unlock & Contact Seller'}</span>
                </button>
              </div>

              {/* Supplier Verification Card */}
              <div className="border-t border-[#EAEFF6] pt-6">
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#5B6B82] block mb-3">
                  VERIFIED SUPPLIER
                </span>
                <div className="flex items-center gap-3.5 p-4 bg-[#F3F6FB] rounded-2xl border border-[#E3E9F2]">
                  <div
                    className={`w-10 h-10 rounded-full text-white text-[12px] font-bold flex items-center justify-center shrink-0 ${
                      isUnlocked ? 'bg-[#0B1F3A]' : 'bg-slate-400'
                    }`}
                  >
                    {isUnlocked ? sellerInitials : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-[#0B1F3A] truncate flex items-center gap-1.5">
                      <span>{isUnlocked ? sellerName : 'Vetted Wholesaler (Locked)'}</span>
                      {isUnlocked && <ShieldCheck className="w-4 h-4 text-[#0A6CFF] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vetted &amp; Active
                      </span>
                      <span className="uppercase text-[#0B1F3A] font-bold bg-white px-2 py-0.5 rounded-full border border-[#E3E9F2]">
                        {product.company?.membership_tier || 'Gold'} Member
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="border-t border-[#EAEFF6] pt-6">
                  <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#5B6B82] block mb-2">
                    BATCH SPECIFICATIONS
                  </span>
                  <p className="text-[14px] text-[#41536D] leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry Modal */}
      {product && (
        <InquiryModal
          product={product}
          isOpen={inquiryOpen}
          onClose={() => setInquiryOpen(false)}
        />
      )}

      {/* Upgrade Membership Modal */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Upgrade to Unlock Supplier Contacts"
        subtitle="You have used all contact unlocks on your current plan. Upgrade to Silver (20 unlocks) or Gold (Unlimited) to link up with verified global wholesale distributors."
      />

      {/* Auth Gate Modal */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title="Sign In to Inquire on this Lot"
      />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center text-[14px] font-semibold text-[#5B6B82]">
          Loading product details...
        </div>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
