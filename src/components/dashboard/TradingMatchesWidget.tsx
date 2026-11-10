'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import type { TradeMatch } from '@/lib/matching/match-types';
import { getStoredMatches, getUserMatches, dismissMatch } from '@/lib/matching/match-types';
import { Skeleton } from '@/components/skeletons/Skeleton';
import {
  Sparkles,
  ArrowRight,
  Package,
  FileText,
  Building2,
  CheckCircle2,
  Tag,
  Barcode,
  ExternalLink,
  MessageSquare,
  X,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface TradingMatchesWidgetProps {
  onOpenQuoteModal?: (wtbId: string, wtbTitle: string, targetPrice: number, targetQty: number) => void;
  onOpenContactModal?: (counterpartyName: string, itemTitle: string, isBuyer: boolean) => void;
  onOpenCreateWtb?: () => void;
  onOpenCreateWts?: () => void;
}

export function TradingMatchesWidget({
  onOpenQuoteModal,
  onOpenContactModal,
  onOpenCreateWtb,
  onOpenCreateWts,
}: TradingMatchesWidgetProps) {
  const { company, role } = useAuth();
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [filter, setFilter] = useState<'all' | 'wtb' | 'wts'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadMatches = async () => {
    setIsLoading(true);
    try {
      const companyId = company?.id;
      const email = company?.email;

      // 1. Fetch from server API
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (email) params.set('email', email);

      const res = await fetch(`/api/matches?${params.toString()}`);
      const data = await res.json();

      let serverMatches: TradeMatch[] = [];
      if (data.success && Array.isArray(data.matches)) {
        serverMatches = data.matches;
      }

      // 2. Fetch from client store & merge
      const localMatches = getUserMatches(companyId, email);
      const map = new Map<string, TradeMatch>();

      serverMatches.forEach((m) => map.set(m.id, m));
      localMatches.forEach((m) => map.set(m.id, m));

      setMatches(Array.from(map.values()));
    } catch (err) {
      console.warn('[LOAD MATCHES ERROR]', err);
      // Fallback to local store
      setMatches(getUserMatches(company?.id, company?.email));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();

    const handleUpdate = () => loadMatches();
    window.addEventListener('b2b_trade_matches_updated', handleUpdate);
    window.addEventListener('b2b_listings_updated', handleUpdate);

    return () => {
      window.removeEventListener('b2b_trade_matches_updated', handleUpdate);
      window.removeEventListener('b2b_listings_updated', handleUpdate);
    };
  }, [company?.id, company?.email]);

  const handleDismiss = (matchId: string, isBuyer: boolean) => {
    dismissMatch(matchId, isBuyer);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const userEmail = company?.email?.toLowerCase() || '';
  const userCompanyId = company?.id || '';

  const filteredMatches = matches.filter((m) => {
    const isUserBuyer =
      (userCompanyId && m.buyerCompanyId === userCompanyId) ||
      (userEmail && m.buyerEmail?.toLowerCase() === userEmail);

    const isUserSeller =
      (userCompanyId && m.sellerCompanyId === userCompanyId) ||
      (userEmail && m.sellerEmail?.toLowerCase() === userEmail);

    if (filter === 'wtb') return isUserBuyer;
    if (filter === 'wts') return isUserSeller;
    return true;
  });

  // Bundle matches by product so a single product with multiple matches doesn't overwhelm the dashboard
  interface ProductMatchBundle {
    key: string;
    productId: string;
    productTitle: string;
    barcode?: string;
    isUserBuyer: boolean;
    listPrice: number;
    availableStock: number;
    matches: TradeMatch[];
    highestTargetPrice: number;
    lowestTargetPrice: number;
    totalTargetQuantity: number;
    counterpartyNames: string[];
    hasBarcodeMatch: boolean;
    topConfidence: number;
  }

  const bundledMatches = React.useMemo(() => {
    const map = new Map<string, ProductMatchBundle>();

    for (const match of filteredMatches) {
      const isUserBuyer = Boolean(
        (userCompanyId && match.buyerCompanyId === userCompanyId) ||
        (userEmail && match.buyerEmail?.toLowerCase() === userEmail)
      );

      const title = isUserBuyer ? (match.wtbProductName || 'Procurement Request') : (match.wtsTitle || 'Stock Lot');
      const key = isUserBuyer
        ? `wtb-${match.wtbId || match.wtbProductName?.toLowerCase().trim()}`
        : `wts-${match.wtsProductId || match.wtsTitle?.toLowerCase().trim()}`;

      const barcode = (isUserBuyer ? match.wtbBarcode : match.wtsBarcode) || undefined;
      const counterparty = isUserBuyer ? match.sellerCompanyName : match.buyerCompanyName;
      const isBarcode = match.matchType === 'exact_barcode';

      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: isUserBuyer ? match.wtbId : match.wtsProductId,
          productTitle: title,
          barcode,
          isUserBuyer,
          listPrice: match.wtsUnitPrice || 0,
          availableStock: match.wtsQuantityAvailable || 0,
          matches: [match],
          highestTargetPrice: match.wtbTargetPrice || 0,
          lowestTargetPrice: match.wtbTargetPrice || 0,
          totalTargetQuantity: match.wtbTargetQuantity || 0,
          counterpartyNames: counterparty ? [counterparty] : [],
          hasBarcodeMatch: isBarcode,
          topConfidence: match.confidence || 95,
        });
      } else {
        const bundle = map.get(key)!;
        bundle.matches.push(match);
        bundle.highestTargetPrice = Math.max(bundle.highestTargetPrice, match.wtbTargetPrice || 0);
        bundle.lowestTargetPrice = Math.min(bundle.lowestTargetPrice, match.wtbTargetPrice || 0);
        bundle.totalTargetQuantity += (match.wtbTargetQuantity || 0);
        bundle.topConfidence = Math.max(bundle.topConfidence, match.confidence || 0);
        if (isBarcode) bundle.hasBarcodeMatch = true;
        if (counterparty && !bundle.counterpartyNames.includes(counterparty)) {
          bundle.counterpartyNames.push(counterparty);
        }
      }
    }

    return Array.from(map.values());
  }, [filteredMatches, userCompanyId, userEmail]);

  return (
    <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.03)] mt-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <h3 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight">
              Buyer-Seller Smart Matches
            </h3>
            {matches.length > 0 && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{matches.length} {matches.length === 1 ? 'Match' : 'Matches'} Found</span>
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#5B6B82] mt-1 font-normal">
            Automated notifications dispatch immediately via email when counterparty stock or demand matches your posts.
          </p>
        </div>

          {/* Filter Pills and Matching Stock Link */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <Link
              href="/dashboard/matches"
              className="px-4 py-1.5 bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[12px] rounded-full flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Matching Stock Page</span>
              <ArrowRight className="w-3 h-3" />
            </Link>

            <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#EAEFF6]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white text-[#0B1F3A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                All ({matches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('wtb')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                  filter === 'wtb'
                    ? 'bg-white text-[#059669] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                Stock for My WTB
              </button>
              <button
                type="button"
                onClick={() => setFilter('wts')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
                  filter === 'wts'
                    ? 'bg-white text-[#0A6CFF] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                Buyers for My Stock
              </button>
            </div>
          </div>
      </div>

      {/* Content Area */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-[#EAEFF6] bg-[#F8FAFC] flex flex-col justify-between min-h-[190px] space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-48 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <div className="pt-3 border-t border-[#EAEFF6] flex items-center justify-between">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="p-8 text-center text-[#5B6B82] bg-slate-50/60 rounded-2xl border border-dashed border-[#CFD9E8]">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-[#0A6CFF]" />
            </div>
            <h4 className="text-[14px] font-bold text-[#0B1F3A]">No current matches in this filter</h4>
            <p className="text-[12.5px] text-[#5B6B82] max-w-md mx-auto mt-1 leading-relaxed">
              When you post a Want-To-Buy (WTB) or Want-To-Sell (WTS) that is not currently available, that&apos;s normal. Whenever another member lists matching stock or requests your inventory in the future, you will immediately receive an email and matches will reflect right here.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {onOpenCreateWtb && (
                <button
                  type="button"
                  onClick={onOpenCreateWtb}
                  className="bg-[#10B981] hover:bg-[#059669] text-white font-bold text-[12px] px-4 py-2 rounded-full transition shadow-xs cursor-pointer"
                >
                  + Post Buy (WTB) Request
                </button>
              )}
              {onOpenCreateWts && (
                <button
                  type="button"
                  onClick={onOpenCreateWts}
                  className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[12px] px-4 py-2 rounded-full transition shadow-xs cursor-pointer"
                >
                  + Post Sell (WTS) Listing
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            {bundledMatches.map((bundle) => {
              const topMatch = bundle.matches[0];

              return (
                <div
                  key={bundle.key}
                  className="relative p-5 rounded-2xl border border-[#EAEFF6] bg-[#FFFFFF] hover:border-[#0A6CFF]/40 hover:shadow-[0_8px_28px_rgba(11,31,58,0.07)] transition flex flex-col justify-between group"
                >
                  {/* Top Bar: Match Direction & Confidence */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {bundle.isUserBuyer ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Package className="w-3 h-3 text-emerald-600" />
                            <span>Stock Found for your WTB ({bundle.matches.length})</span>
                          </span>
                        ) : bundle.matches.length > 1 ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{bundle.matches.length} Waiting Buyers Found</span>
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-[#0A6CFF] border border-blue-200 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <FileText className="w-3 h-3 text-[#0A6CFF]" />
                            <span>1 Buyer Match Found</span>
                          </span>
                        )}

                        {bundle.hasBarcodeMatch ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-amber-600" />
                            <span>100% Barcode Match</span>
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {bundle.topConfidence}% Model Match
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          bundle.matches.forEach((m) => handleDismiss(m.id, Boolean(bundle.isUserBuyer)));
                        }}
                        title="Dismiss bundle"
                        className="text-[#94A3B8] hover:text-[#0B1F3A] p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Product Title */}
                    <h4 className="text-[15px] font-bold text-[#0B1F3A] leading-snug line-clamp-2">
                      {bundle.productTitle}
                    </h4>

                    {bundle.barcode && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <span className="font-semibold">EAN/SKU:</span>
                        <code className="bg-slate-100 text-[#0B1F3A] px-1.5 py-0.5 rounded text-[10.5px] font-mono">
                          {bundle.barcode}
                        </code>
                      </div>
                    )}

                    {/* Price & Quantity Summary Grid */}
                    <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
                      <div>
                        <div className="text-[11px] font-medium text-[#64748B]">
                          {bundle.isUserBuyer ? 'Your WTB Target' : 'Buyer Target Price'}
                        </div>
                        <div className="text-[14px] font-extrabold text-[#0B1F3A] mt-0.5">
                          {bundle.highestTargetPrice <= 0 ? (
                            <span className="text-amber-700 text-[13px]">Open to Offers (NEG)</span>
                          ) : bundle.lowestTargetPrice === bundle.highestTargetPrice ? (
                            `€${bundle.highestTargetPrice.toFixed(2)}`
                          ) : (
                            `€${bundle.lowestTargetPrice.toFixed(2)} - €${bundle.highestTargetPrice.toFixed(2)}`
                          )}
                          {bundle.highestTargetPrice > 0 && (
                            <span className="text-[11px] font-normal text-[#8A9BB0]"> /unit</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          Demand: <strong className="text-[#0B1F3A]">{bundle.totalTargetQuantity.toLocaleString()}</strong> pcs ({bundle.matches.length} {bundle.matches.length === 1 ? 'buyer' : 'buyers'})
                        </div>
                      </div>

                      <div className="border-l border-[#E2E8F0] pl-3">
                        <div className="text-[11px] font-medium text-[#64748B]">
                          {bundle.isUserBuyer ? 'Supplier List Price' : 'Your List Price'}
                        </div>
                        <div className="text-[14px] font-extrabold text-[#059669] mt-0.5">
                          {bundle.listPrice > 0 ? (
                            <>
                              €{bundle.listPrice.toFixed(2)}
                              <span className="text-[11px] font-normal text-[#8A9BB0]"> /unit</span>
                            </>
                          ) : (
                            <span className="text-purple-700 text-[13px]">NEG / POA</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          Available: <strong className="text-[#0B1F3A]">{bundle.availableStock.toLocaleString()}</strong> pcs
                        </div>
                      </div>
                    </div>

                    {/* Counterparties Preview */}
                    <div className="flex items-center justify-between text-[11px] text-[#5B6B82] mb-3">
                      <div className="flex items-center gap-1 truncate max-w-[70%]">
                        <Building2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <span className="truncate">
                          {bundle.counterpartyNames.length > 0 ? (
                            bundle.counterpartyNames.slice(0, 2).join(', ') +
                            (bundle.counterpartyNames.length > 2 ? ` +${bundle.counterpartyNames.length - 2} more` : '')
                          ) : (
                            'Verified Counterparties'
                          )}
                        </span>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                        Verified Matches
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/matches?product=${encodeURIComponent(bundle.productTitle)}`}
                      className="text-[12px] font-bold text-[#0A6CFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Unlock &amp; Quote ({bundle.matches.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link
                      href={`/dashboard/matches?product=${encodeURIComponent(bundle.productTitle)}`}
                      className="bg-[#10B981] hover:bg-[#059669] text-white text-[12px] font-bold px-4 py-1.5 rounded-full transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Quote Counterparty</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
