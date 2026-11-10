'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { createWtbRequest } from '@/lib/actions/wtb';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Send,
  ShoppingCart,
  HelpCircle,
  Zap,
  Bell,
  Loader2,
  ArrowRight,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { ALL_TRADING_BOARD_ITEMS } from '@/lib/trading-board-data';
import { POPULAR_BRANDS } from '@/lib/constants/brands';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { WHOLESALE_CONDITIONS } from '@/lib/constants/conditions';
import { TRADING_HUB_LOCATIONS } from '@/lib/constants/locations';
import {
  PricingOptionSelector,
  PriceBadge,
  type PricingType,
} from '@/lib/utils/pricing';

interface CreateWtbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'WTB' | 'WTS';
}

interface FoundCounterpartyMatch {
  id: string;
  type: 'BUY' | 'SELL';
  companyName: string;
  productTitle: string;
  price: number;
  quantity: number;
  location: string;
  condition?: string;
  confidence: number;
  pricingType?: 'fixed' | 'neg' | 'poa';
}

export function CreateWtbModal({ isOpen, onClose, onSuccess, initialMode = 'WTB' }: CreateWtbModalProps) {
  const router = useRouter();
  const { company, isLoggedIn } = useAuth();

  const [tradeMode, setTradeMode] = useState<'WTB' | 'WTS'>(initialMode);
  const [showLocationHelp, setShowLocationHelp] = useState(false);

  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('Apple');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState(WHOLESALE_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState('');
  const [ean, setEan] = useState('');
  const [condition, setCondition] = useState('New');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('fixed');
  const [targetPrice, setTargetPrice] = useState('');
  const [location, setLocation] = useState('DE');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isScanningMatches, setIsScanningMatches] = useState(false);
  const [foundMatches, setFoundMatches] = useState<FoundCounterpartyMatch[]>([]);

  useEffect(() => {
    if (initialMode) {
      setTradeMode(initialMode);
    }
    setIsSuccess(false);
    setIsScanningMatches(false);
    setFoundMatches([]);
    setPricingType('fixed');
    setTargetPrice('');
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!productName.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    const qtyNum = parseInt(targetQuantity, 10);
    const priceNum = parseFloat(targetPrice);
    const isSpecialPricing = pricingType === 'neg' || pricingType === 'poa';

    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg('Target quantity must be greater than 0.');
      return;
    }
    if (!isSpecialPricing && (!priceNum || priceNum <= 0)) {
      setErrorMsg(tradeMode === 'WTB' ? 'Target unit price must be greater than 0.' : 'Unit price must be greater than 0.');
      return;
    }

    const effectivePrice = isSpecialPricing ? 0 : priceNum;

    setIsSubmitting(true);
    try {
      const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;

      if (tradeMode === 'WTS') {
        // Save to seller listings store (WTS)
        try {
          const localKey = 'b2b_seller_listings_v3';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const pricingTag = isSpecialPricing ? ` | Pricing: ${pricingType.toUpperCase()}` : '';
          const newListingItem = {
            id: `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
            brand,
            itemCode: itemCode || 'WTS-LOT',
            category: finalCategory,
            ean: ean.trim() || 'n/a',
            condition,
            description: notes ? `${notes} | Stock Location: ${location}${pricingTag}` : `Verified wholesale stock: ${brand} ${productName.trim()}. Condition: ${condition}.${pricingTag}`,
            unitPrice: effectivePrice,
            pricingType,
            available: qtyNum,
            moq: Math.min(10, qtyNum),
            location,
            status: 'Active' as const,
            createdAt: new Date().toISOString(),
            activatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          };
          localStorage.setItem(localKey, JSON.stringify([newListingItem, ...existing]));
          window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
          window.dispatchEvent(new CustomEvent('b2b_admin_update'));
        } catch {}

        // Persist to Supabase & trigger automatic matching with open WTB requests (non-blocking for fast UI)
        if (company?.id) {
          const pricingTag = isSpecialPricing ? ` | Pricing: ${pricingType.toUpperCase()}` : '';
          void fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
              brand,
              condition,
              description: notes ? `${notes} | Stock Location: ${location}${pricingTag}` : `Verified wholesale stock: ${brand} ${productName.trim()}. Condition: ${condition}.${pricingTag}`,
              barcodeOrSku: ean.trim() && ean.trim() !== 'n/a' ? ean.trim() : undefined,
              categorySlug: finalCategory.toLowerCase().replace(/\s+/g, '-'),
              unitPrice: effectivePrice,
              quantityAvailable: qtyNum,
              moq: Math.min(10, qtyNum),
              isHot: true,
              status: 'active',
            }),
          }).catch((postErr) => {
            console.warn('[POST PRODUCT ERROR]', postErr);
          });
        }
      } else {
        // Submit WTB request
        const buyerName = company?.contact_name || company?.name || 'Verified Buyer';
        const buyerEmail = company?.email || 'buyer@b2blink.eu';
        const pricingTag = isSpecialPricing ? ` | Pricing: ${pricingType.toUpperCase()}` : '';

        const wtbRes = await createWtbRequest({
          buyerName,
          buyerEmail,
          buyerPhone: company?.phone || undefined,
          buyerCompany: company?.name || 'Verified Procurement Partner',
          buyerCompanyId: company?.id,
          productName: `${brand ? `${brand} ` : ''}${productName.trim()}`,
          categorySlug: finalCategory.toLowerCase().replace(/\s+/g, '-'),
          targetQuantity: qtyNum,
          targetPrice: effectivePrice,
          pricingType,
          barcodeOrSku: ean.trim() || undefined,
          notes: `${notes ? `${notes} | ` : ''}Condition: ${condition} | Delivery: ${location} | Model: ${itemCode || 'Standard'}${pricingTag}`,
        });

        const effectiveWtbId = wtbRes.wtbRequestId || `wtb-usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Also save to local storage for immediate visibility in Trading Board & Listings
        try {
          localStorage.removeItem('b2b_user_wtb_requests_v1');
          const localKey = 'b2b_user_wtb_requests_v2';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const newWtbItem = {
            id: effectiveWtbId,
            type: 'BUY',
            lotType: 'WTB',
            category: finalCategory,
            brand,
            itemCode: itemCode || 'WTB-REQ',
            description: productName.trim(),
            title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
            ean: ean.trim() || 'n/a',
            qty: qtyNum,
            available: qtyNum,
            condition,
            price: effectivePrice,
            unitPrice: effectivePrice,
            pricingType,
            currency: '€',
            location,
            match: '96%',
            companyId: company?.id,
            company_id: company?.id,
            companyName: company?.name || 'Verified Procurement Partner',
            contactEmail: buyerEmail,
            contactName: buyerName,
            contactPhone: company?.phone || '',
            moq: 1,
            status: 'Active',
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem(localKey, JSON.stringify([newWtbItem, ...existing.filter((item: any) => item.id !== effectiveWtbId)]));

          // Also save to seller listings store with lotType: 'WTB' so it appears on the seller's listings page
          const sellerListingsKey = 'b2b_seller_listings_v3';
          const existingSellerListings = JSON.parse(localStorage.getItem(sellerListingsKey) || '[]');
          const sellerWtbListing = {
            id: effectiveWtbId,
            lotType: 'WTB',
            title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
            brand: brand || 'Procurement',
            itemCode: itemCode || 'WTB-REQ',
            category: finalCategory,
            ean: ean.trim() || 'n/a',
            condition,
            description: notes ? `${notes} | Location: ${location}${pricingTag}` : `Wanted: ${brand ? `${brand} ` : ''}${productName.trim()}.${pricingTag}`,
            unitPrice: effectivePrice,
            pricingType,
            available: qtyNum,
            moq: 1,
            location,
            status: 'Active' as const,
            createdAt: new Date().toISOString(),
            activatedAt: new Date().toISOString(),
            companyId: company?.id,
            company_id: company?.id,
            companyName: company?.name || 'Verified Procurement Partner',
            contactEmail: buyerEmail,
            contactName: buyerName,
            contactPhone: company?.phone || '',
          };
          localStorage.setItem(
            sellerListingsKey,
            JSON.stringify([sellerWtbListing, ...existingSellerListings.filter((item: any) => item.id !== effectiveWtbId)])
          );

          // Save to admin moderated listings store
          const adminKey = 'b2b_admin_listings_v5';
          const existingAdminListings = JSON.parse(localStorage.getItem(adminKey) || '[]');
          const adminWtbListing = {
            id: effectiveWtbId,
            type: 'BUY',
            company_id: company?.id || 'buyer',
            company_name: company?.name || 'Verified Procurement Partner',
            seller_email: buyerEmail,
            contact_name: buyerName,
            contact_phone: company?.phone || '',
            title: `${brand ? `${brand} ` : ''}${productName.trim()}`,
            brand: brand || 'Procurement',
            item_code: itemCode || 'WTB-REQ',
            category_slug: finalCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category_name: finalCategory,
            ean: ean.trim() || 'n/a',
            condition,
            unit_price: effectivePrice,
            currency: '€',
            location,
            quantity_available: qtyNum,
            moq: 1,
            barcode_or_sku: ean.trim() || itemCode,
            is_hot: false,
            moderation_status: 'active',
            images: [],
            created_at: new Date().toISOString(),
          };
          localStorage.setItem(
            adminKey,
            JSON.stringify([adminWtbListing, ...existingAdminListings.filter((item: any) => item.id !== effectiveWtbId)])
          );

          window.dispatchEvent(new CustomEvent('b2b_wtb_created'));
        } catch {}
      }

      // Instantly dispatch updates across all tabs and components
      try {
        window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
        window.dispatchEvent(new CustomEvent('b2b_admin_update'));
        window.dispatchEvent(new CustomEvent('b2b_trade_matches_updated'));
      } catch {}

      if (onSuccess) onSuccess();

      // Launch instant counterparty scanning animation
      setIsSuccess(true);
      setIsScanningMatches(true);

      const queryClean = productName.trim().toLowerCase();
      const brandClean = brand.toLowerCase();
      const eanClean = ean.trim();

      // Scan local and remote trading items with 1.3s visual scanning feedback
      setTimeout(async () => {
        const matchesList: FoundCounterpartyMatch[] = [];

        try {
          if (tradeMode === 'WTS') {
            // Find buyers who posted WTB for this product
            const rawWtb = localStorage.getItem('b2b_user_wtb_requests_v2');
            const userWtbs = rawWtb ? JSON.parse(rawWtb) : [];
            const allItems = [...ALL_TRADING_BOARD_ITEMS, ...userWtbs];

            for (const item of allItems) {
              if (item.type !== 'BUY') continue;
              const titleMatch = item.description?.toLowerCase().includes(queryClean) || queryClean.includes(item.description?.toLowerCase() || '');
              const brandMatch = item.brand?.toLowerCase() === brandClean;
              const eanMatch = eanClean && eanClean !== 'n/a' && item.ean === eanClean;

              if (eanMatch || (titleMatch && brandMatch) || titleMatch) {
                matchesList.push({
                  id: item.id,
                  type: 'BUY',
                  companyName: item.companyName || 'Verified Procurement Partner',
                  productTitle: item.description,
                  price: item.price,
                  quantity: item.qty,
                  location: item.location || 'DE',
                  condition: item.condition,
                  confidence: eanMatch ? 100 : 92,
                });
              }
              if (matchesList.length >= 3) break;
            }
          } else {
            // Find sellers who posted WTS stock for this product
            const rawWts = localStorage.getItem('b2b_seller_listings_v3');
            const sellerListings = rawWts ? JSON.parse(rawWts) : [];
            const allItems = [...ALL_TRADING_BOARD_ITEMS, ...sellerListings];

            for (const item of allItems) {
              const isSell = item.type === 'SELL' || (item.status && item.status !== 'Draft');
              if (!isSell) continue;
              const itemTitle = (item.title || item.description || '').toLowerCase();
              const titleMatch = itemTitle.includes(queryClean) || queryClean.includes(itemTitle);
              const brandMatch = (item.brand || '').toLowerCase() === brandClean;
              const eanMatch = eanClean && eanClean !== 'n/a' && item.ean === eanClean;

              if (eanMatch || (titleMatch && brandMatch) || titleMatch) {
                matchesList.push({
                  id: item.id,
                  type: 'SELL',
                  companyName: item.companyName || 'Verified Global Stockholder',
                  productTitle: item.title || item.description,
                  price: item.unitPrice || item.price,
                  quantity: item.available || item.qty,
                  location: item.location || 'DE',
                  condition: item.condition,
                  confidence: eanMatch ? 100 : 95,
                });
              }
              if (matchesList.length >= 3) break;
            }
          }
        } catch (scanErr) {
          console.warn('[SCAN MATCHES NOTICE]', scanErr);
        }

        setFoundMatches(matchesList);
        setIsScanningMatches(false);

        try {
          window.dispatchEvent(new CustomEvent('b2b_trade_matches_updated'));
          window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
        } catch {}
      }, 1300);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : `Failed to post ${tradeMode} request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1F3A]/70 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-[#EAEFF6] overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-black block mb-1">
              {tradeMode === 'WTB' ? 'Want To Buy (WTB) Desk' : 'Want To Sell (WTS) Desk'}
            </span>
            <h3 className={`text-[24px] sm:text-[26px] font-extrabold leading-tight ${tradeMode === 'WTB' ? 'text-[#16A34A]' : 'text-[#0A6CFF]'}`}>
              {tradeMode === 'WTB' ? 'Post a Sourcing Request' : 'Post a Sell Listing'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0] flex items-center justify-center transition-colors duration-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WTB / WTS Mode Switcher Tabs */}
        <div className="px-6 sm:px-8 pt-4 pb-1 shrink-0">
          <div className="flex bg-[#F1F5F9] p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setTradeMode('WTB')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition-colors duration-100 flex items-center justify-center gap-2 cursor-pointer ${
                tradeMode === 'WTB'
                  ? 'bg-white text-[#16A34A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tradeMode === 'WTB' ? 'bg-[#16A34A]' : 'bg-slate-300'}`} />
              <span>Buy (WTB) Request</span>
            </button>
            <button
              type="button"
              onClick={() => setTradeMode('WTS')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition-colors duration-100 flex items-center justify-center gap-2 cursor-pointer ${
                tradeMode === 'WTS'
                  ? 'bg-white text-[#0A6CFF] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tradeMode === 'WTS' ? 'bg-[#0A6CFF]' : 'bg-slate-300'}`} />
              <span>Sell (WTS) Listing</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="py-4 text-center space-y-4">
              {isScanningMatches ? (
                /* ANIMATED SONAR SCANNING STATE */
                <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-35" />
                    <div className="absolute -inset-3 rounded-full border-2 border-indigo-400 animate-pulse opacity-25" />
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0A6CFF] to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <Zap className="w-8 h-8 fill-white animate-bounce" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[19px] font-extrabold text-[#0B1F3A]">
                      Scanning European Trading Board...
                    </h4>
                    <p className="text-[13px] text-[#5B6B82] max-w-sm mx-auto mt-1 leading-relaxed">
                      Scanning live counterparties for matching {tradeMode === 'WTS' ? 'WTB procurement requests' : 'WTS stock lots'}...
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#0A6CFF] bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/60 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Comparing EAN barcode, model spec &amp; pricing</span>
                  </div>
                </div>
              ) : foundMatches.length > 0 ? (
                /* INSTANT MATCHES FOUND STATE */
                <div className="space-y-4 text-left animate-in fade-in duration-300">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
                      <Zap className="w-7 h-7 fill-white" />
                    </div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                      INSTANT COUNTERPARTY MATCH FOUND
                    </span>
                    <h4 className="text-[20px] font-extrabold text-[#0B1F3A] mt-2">
                      {foundMatches.length} Matching Counterpart{foundMatches.length === 1 ? 'y' : 'ies'} Ready to Trade!
                    </h4>
                    <p className="text-[13px] text-[#5B6B82] mt-1">
                      Immediate counterparty requests match your {tradeMode === 'WTS' ? 'wholesale stock lot' : 'procurement order'}.
                    </p>
                  </div>

                  {/* Counterparty match preview cards */}
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {foundMatches.map((match) => (
                      <div
                        key={match.id}
                        className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] hover:border-blue-300 transition flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-[#0A6CFF]">
                              {match.type === 'BUY' ? 'Buyer Looking to Buy' : 'Seller Has In Stock'}
                            </span>
                            <span className="text-[10.5px] font-bold text-emerald-600">
                              {match.confidence}% Match
                            </span>
                          </div>
                          <div className="text-[13.5px] font-bold text-[#0B1F3A] truncate">
                            {match.productTitle}
                          </div>
                          <div className="text-[11.5px] text-[#5B6B82] mt-0.5">
                            {match.companyName} &bull; <span className="font-semibold text-[#0B1F3A]">€{match.price.toFixed(2)}</span> &bull; {match.quantity} units &bull; {match.location}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            router.push(`/dashboard/matches?product=${encodeURIComponent(productName.trim())}`);
                          }}
                          className="shrink-0 bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <span>Unlock &amp; Quote</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/dashboard/matches?product=${encodeURIComponent(productName.trim())}`);
                      }}
                      className="w-full sm:flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <span>Review Matches in Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* NO MATCHES YET STATE (EXACTLY AS USER SPECIFIED) */
                <div className="py-4 text-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 text-[#0A6CFF] flex items-center justify-center shadow-xs">
                    <Bell className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0A6CFF] bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
                      {tradeMode === 'WTB' ? 'WTB Sourcing Request Live' : 'WTS Listing Published Live'}
                    </span>
                    <h4 className="text-[20px] font-extrabold text-[#0B1F3A] mt-2.5">
                      Post Successfully Live on the Board
                    </h4>
                    <p className="text-[13.5px] text-[#5B6B82] max-w-md mx-auto mt-2 leading-relaxed">
                      No matching {tradeMode === 'WTS' ? 'WTB buyer requests' : 'WTS seller listings'} yet. Your request is now active on the Trading Board, and you will be immediately notified via email and in-app message as soon as a counterparty submits a matching request.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push('/dashboard/marketplace');
                      }}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition shadow-xs cursor-pointer"
                    >
                      Explore Trading Board
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Product Title */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Product / Title Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Galaxy Tab S9 128GB Wi-Fi Graphite"
                  className={`w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                    tradeMode === 'WTB'
                      ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                      : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                  }`}
                />
              </div>

              {/* Brand and Item Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Brand
                  </label>
                  <div className="relative">
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className={`w-full appearance-none bg-white px-3.5 py-2.5 pr-9 text-[14px] border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-bold cursor-pointer ${
                        tradeMode === 'WTB'
                          ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                          : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                      }`}
                    >
                      {POPULAR_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Model / Item Code
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. SM-X810"
                    className={`w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                      tradeMode === 'WTB'
                        ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                        : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                    }`}
                  />
                </div>
              </div>

              {/* Category & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`w-full appearance-none bg-white px-3.5 py-2.5 pr-9 text-[14px] border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium cursor-pointer ${
                        tradeMode === 'WTB'
                          ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                          : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                      }`}
                    >
                      {WHOLESALE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    Condition
                  </label>
                  <div className="relative">
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className={`w-full appearance-none bg-white px-3.5 py-2.5 pr-9 text-[14px] border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium cursor-pointer ${
                        tradeMode === 'WTB'
                          ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                          : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                      }`}
                    >
                      {WHOLESALE_CONDITIONS.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {category === 'Other' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[12.5px] font-bold text-[#0B1F3A] mb-1">
                      Specify Category <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Type your category (e.g. Vintage Watches, Medical Supplies, Industrial Machinery...)"
                      className={`w-full px-3.5 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                        tradeMode === 'WTB'
                          ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                          : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* EAN/UPC Code */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  EAN / UPC / Barcode <span className="text-[#8A9BB0] font-normal text-[12px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="Optional (e.g. 8806095087286)"
                  className={`w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-mono focus:outline-none transition-colors duration-100 ease-out ${
                    tradeMode === 'WTB'
                      ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20'
                      : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                  }`}
                />
              </div>

              {/* Target Quantity & Pricing Options */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                    {tradeMode === 'WTB' ? 'Target Quantity' : 'Available Quantity'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className={`w-full px-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                      tradeMode === 'WTB' ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20' : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                    }`}
                  />
                </div>

                {/* 3 Pricing Options: Fixed Price, NEG, POA */}
                <div>
                  <PricingOptionSelector
                    value={pricingType}
                    onChange={setPricingType}
                    tradeMode={tradeMode}
                  />

                  {pricingType === 'fixed' && (
                    <div className="relative mt-2">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">
                        €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required={pricingType === 'fixed'}
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder={tradeMode === 'WTB' ? 'Target price e.g. 420.00' : 'Unit price e.g. 450.00'}
                        className={`w-full pl-8 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                          tradeMode === 'WTB' ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20' : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Destination / Stock Location with Question Mark Tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[13px] font-bold text-[#0B1F3A]">
                    Destination Country / Hub Location
                  </label>
                  
                  {/* Interactive Question Mark Icon & Guidance Popover */}
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowLocationHelp((prev) => !prev)}
                      onMouseEnter={() => setShowLocationHelp(true)}
                      onMouseLeave={() => setShowLocationHelp(false)}
                      className="p-0.5 text-slate-400 hover:text-[#0A6CFF] rounded-full focus:outline-none transition-colors duration-100 ease-out cursor-pointer"
                      aria-label="Location guidance help"
                      title="Hub Location Guidance: In WTB this is where items are delivered; in WTS this is where items are situated."
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>

                    {showLocationHelp && (
                      <div
                        role="tooltip"
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3.5 bg-[#0B1F3A] text-white text-[12px] rounded-2xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700"
                      >
                        <div className="font-bold text-[12.5px] text-[#38BDF8] flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-700/60">
                          <HelpCircle className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Hub Location Guide</span>
                        </div>
                        <div className="space-y-2 leading-relaxed text-slate-200">
                          <p>
                            <span className="inline-block px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-bold mr-1">WTB</span>
                            <strong>In WTB:</strong> This is where you want these items delivered.
                          </p>
                          <p>
                            <span className="inline-block px-1.5 py-0.2 bg-sky-500/20 text-sky-400 rounded font-bold mr-1">WTS</span>
                            <strong>In WTS:</strong> This is where the items currently are situated.
                          </p>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0B1F3A]" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={`w-full appearance-none bg-white px-3.5 py-2.5 pr-9 text-[14px] border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium cursor-pointer ${
                      tradeMode === 'WTB' ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20' : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                    }`}
                  >
                    {TRADING_HUB_LOCATIONS.map((loc) => (
                      <option key={loc.code} value={loc.code}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Delivery / Sourcing Notes */}
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  {tradeMode === 'WTB' ? 'Procurement Notes' : 'Stock & Logistics Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    tradeMode === 'WTB'
                      ? 'e.g. Ready for prompt payment. Pallet delivery requested to central Rotterdam hub.'
                      : 'e.g. Factory sealed master cartons. Immediate dispatch available from Hamburg warehouse.'
                  }
                  className={`w-full px-4 py-2 text-[13px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] focus:outline-none transition-colors duration-100 ease-out font-medium ${
                    tradeMode === 'WTB' ? 'focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20' : 'focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/20'
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full text-[13px] font-bold text-[#64748B] hover:bg-slate-100 transition-colors duration-100 ease-out cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-7 py-2.5 rounded-full disabled:opacity-50 text-white text-[13.5px] font-bold flex items-center gap-2 transition-colors duration-100 ease-out shadow-xs cursor-pointer ${
                    tradeMode === 'WTB'
                      ? 'bg-[#16A34A] hover:bg-emerald-700'
                      : 'bg-[#0A6CFF] hover:bg-blue-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Posting...'
                      : tradeMode === 'WTB'
                      ? 'Post Sourcing Request'
                      : 'Post Sell Request'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
