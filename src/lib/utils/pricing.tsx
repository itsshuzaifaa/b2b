import React from 'react';

export type PricingType = 'fixed' | 'neg' | 'poa';

/**
 * Returns a human-friendly string for listing/request price.
 * - 'fixed' -> '€450.00'
 * - 'neg' -> 'NEG'
 * - 'poa' -> 'POA'
 */
export function formatListingPrice(
  price: number | undefined | null,
  pricingType?: PricingType | string | null,
  currency: string = '€'
): string {
  if (pricingType === 'neg') return 'NEG';
  if (pricingType === 'poa') return 'POA';
  const num = typeof price === 'number' ? price : parseFloat(String(price || 0));
  if (isNaN(num) || num <= 0) {
    if (pricingType === 'neg') return 'NEG';
    if (pricingType === 'poa') return 'POA';
    return `${currency}0.00`;
  }
  return `${currency}${num.toFixed(2)}`;
}

/**
 * Renders a stylized badge or price text:
 * - If NEG: amber pill badge
 * - If POA: purple pill badge
 * - If fixed/numeric: clean bold price
 */
export function PriceBadge({
  price,
  pricingType,
  currency = '€',
  className = '',
  textSize = 'text-[14px]',
}: {
  price?: number | null;
  pricingType?: PricingType | string | null;
  currency?: string;
  className?: string;
  textSize?: string;
}) {
  if (pricingType === 'neg') {
    return (
      <span
        title="Price is negotiable"
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 border border-amber-500/30 font-mono ${className}`}
      >
        NEG
      </span>
    );
  }

  if (pricingType === 'poa') {
    return (
      <span
        title="Price on Application (Quoted upon inquiry)"
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 border border-purple-500/30 font-mono ${className}`}
      >
        POA
      </span>
    );
  }

  const num = typeof price === 'number' ? price : parseFloat(String(price || 0));
  return (
    <span className={`font-bold text-[#0B1F3A] ${textSize} ${className}`}>
      {currency}{isNaN(num) ? '0.00' : num.toFixed(2)}
    </span>
  );
}

/**
 * Interactive 3-way pricing option selector:
 * 1. Fixed Price (Add Price)
 * 2. NEG (Negotiable)
 * 3. POA (Price on Application)
 */
export function PricingOptionSelector({
  value,
  onChange,
  tradeMode = 'WTS',
}: {
  value: PricingType;
  onChange: (val: PricingType) => void;
  tradeMode?: 'WTB' | 'WTS';
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[12px] sm:text-[13px] font-bold text-[#0B1F3A]">
        {tradeMode === 'WTB' ? 'Target Pricing Option' : 'Pricing Option'}{' '}
        <span className="text-red-500">*</span>
      </label>

      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        {/* Option 1: Fixed Price */}
        <button
          type="button"
          onClick={() => onChange('fixed')}
          className={`py-2 px-2.5 rounded-xl text-[12.5px] font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            value === 'fixed'
              ? 'bg-white text-[#0B1F3A] shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Fixed Price</span>
        </button>

        {/* Option 2: NEG */}
        <button
          type="button"
          onClick={() => onChange('neg')}
          className={`py-2 px-2.5 rounded-xl text-[12.5px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer ${
            value === 'neg'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>NEG</span>
          <span className="hidden sm:inline text-[11px] font-normal opacity-90">(Negotiable)</span>
        </button>

        {/* Option 3: POA */}
        <button
          type="button"
          onClick={() => onChange('poa')}
          className={`py-2 px-2.5 rounded-xl text-[12.5px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer ${
            value === 'poa'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>POA</span>
          <span className="hidden sm:inline text-[11px] font-normal opacity-90">(On App.)</span>
        </button>
      </div>

      {/* Contextual guidance banner for selected option */}
      {value === 'neg' ? (
        <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 text-[12.5px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded tracking-wider">
              NEG
            </span>
            <span className="font-bold">Price Open to Negotiation</span>
          </div>
          <span className="text-[11.5px] text-amber-700 hidden sm:inline">
            Counterparties can submit price bids or proposals
          </span>
        </div>
      ) : value === 'poa' ? (
        <div className="p-3 bg-purple-50/90 border border-purple-200/90 rounded-xl text-purple-900 text-[12.5px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-purple-600 text-white font-black text-[10px] rounded tracking-wider">
              POA
            </span>
            <span className="font-bold">Price on Application</span>
          </div>
          <span className="text-[11.5px] text-purple-700 hidden sm:inline">
            Exact pricing will be quoted upon direct verified inquiry
          </span>
        </div>
      ) : null}
    </div>
  );
}
