'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Plus,
} from 'lucide-react';
import {
  PricingOptionSelector,
  type PricingType,
} from '@/lib/utils/pricing';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { WHOLESALE_CONDITIONS, type WholesaleCondition } from '@/lib/constants/conditions';
import { TRADING_HUB_LOCATIONS } from '@/lib/constants/locations';

export const POPULAR_BRANDS = [
  'Apple',
  'Samsung',
  'Sony',
  'Dell',
  'HP',
  'Lenovo',
  'LG',
  'Microsoft',
  'Xiaomi',
  'Asus',
  'Acer',
  'Google',
  'Huawei',
  'Bose',
  'JBL',
  'Canon',
  'Nikon',
  'Philips',
  'Braun',
  'Logitech',
  'Dyson',
  'Nintendo',
  'PlayStation',
  'Anker',
  'SanDisk',
  'Bosch',
  'DeWalt',
  'Chanel',
  'Dior',
  'Other / Generic',
];

export interface ListingFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  initialData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function ListingFormModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSave,
}: ListingFormModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form states - completely isolated to this modal for lightning-fast 60fps typing
  const [formTitle, setFormTitle] = useState('');
  const [formBrand, setFormBrand] = useState('Apple');
  const [brandSearch, setBrandSearch] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [formItemCode, setFormItemCode] = useState('');
  const [formCondition, setFormCondition] = useState<WholesaleCondition | string>('New');
  const [formCategory, setFormCategory] = useState(WHOLESALE_CATEGORIES[0].name);
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formEan, setFormEan] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('DE');
  const [formPricingType, setFormPricingType] = useState<PricingType>('fixed');
  const [formPrice, setFormPrice] = useState('920.00');
  const [formAvailable, setFormAvailable] = useState('50');
  const [formMoq, setFormMoq] = useState('10');
  const [formIsHot, setFormIsHot] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [showLocationHelp, setShowLocationHelp] = useState(false);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setCurrentStep(1);
    setFormError(null);
    setBrandSearch('');
    setIsBrandDropdownOpen(false);
    setShowLocationHelp(false);

    if (mode === 'edit' && initialData) {
      setFormTitle(initialData.title || '');
      setFormBrand(initialData.brand || 'Apple');
      setFormItemCode(initialData.itemCode || '');
      setFormCondition(initialData.condition || 'New');
      const knownCategory = WHOLESALE_CATEGORIES.some((c) => c.name === initialData.category);
      if (knownCategory) {
        setFormCategory(initialData.category);
        setFormCustomCategory('');
      } else {
        setFormCategory('Other');
        setFormCustomCategory(initialData.category || '');
      }
      setFormEan(initialData.ean || '');
      setFormDescription(initialData.description || '');
      setFormLocation(initialData.location || 'DE');
      const initialPricingType: PricingType =
        initialData.pricingType ||
        (initialData.unitPrice > 0
          ? 'fixed'
          : initialData.description?.includes('POA')
          ? 'poa'
          : initialData.description?.includes('NEG')
          ? 'neg'
          : 'fixed');
      setFormPricingType(initialPricingType);
      setFormPrice(initialData.unitPrice ? String(initialData.unitPrice) : '0');
      setFormAvailable(String(initialData.available || '50'));
      setFormMoq(String(initialData.moq || '10'));
      setFormIsHot(initialData.status === 'Hot');
    } else {
      setFormTitle('');
      setFormBrand('Apple');
      setFormItemCode('');
      setFormCondition('New');
      setFormCategory(WHOLESALE_CATEGORIES[0].name);
      setFormCustomCategory('');
      setFormEan('');
      setFormDescription('');
      setFormLocation('DE');
      setFormPricingType('fixed');
      setFormPrice('920.00');
      setFormAvailable('50');
      setFormMoq('10');
      setFormIsHot(true);
    }
  }, [isOpen, mode, initialData]);

  // Memoized brand search
  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return POPULAR_BRANDS;
    return POPULAR_BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [brandSearch]);

  if (!isOpen) return null;

  const handleNextStep1 = () => {
    if (!formTitle.trim()) {
      setFormError('Please enter a product title / description.');
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(formPrice);
    const availNum = parseInt(formAvailable, 10);
    const moqNum = parseInt(formMoq, 10);

    if (formPricingType === 'fixed' && (isNaN(priceNum) || priceNum <= 0)) {
      setFormError('Please enter a valid unit price greater than 0.');
      return;
    }
    if (isNaN(availNum) || availNum <= 0) {
      setFormError('Please enter valid available units.');
      return;
    }
    if (isNaN(moqNum) || moqNum <= 0) {
      setFormError('Please enter a valid minimum order quantity (MOQ).');
      return;
    }
    if (moqNum > availNum) {
      setFormError('MOQ cannot be greater than the available units.');
      return;
    }

    const resolvedCategory =
      formCategory === 'Other' && formCustomCategory.trim()
        ? formCustomCategory.trim()
        : formCategory;

    onSave({
      id: initialData?.id,
      title: formTitle.trim(),
      brand: formBrand,
      itemCode: formItemCode.trim() || undefined,
      condition: formCondition,
      category: resolvedCategory,
      ean: formEan.trim() || 'n/a',
      description: formDescription.trim(),
      location: formLocation,
      pricingType: formPricingType,
      unitPrice: formPricingType === 'fixed' ? priceNum : 0,
      available: availNum,
      moq: moqNum,
      status: formIsHot ? 'Hot' : 'Active',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1F3A]/70 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto">
        {/* Modal Header & Step Indicator */}
        <div className="pb-4 border-b border-[#F1F5F9]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF]">
              STEP {currentStep} OF 2: {currentStep === 1 ? 'PRODUCT SPECIFICATIONS' : 'PRICING & COMMERCIAL TERMS'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-[20px] font-extrabold text-[#0B1F3A]">
            {mode === 'add' ? 'Add New Product Listing' : 'Edit Product Listing'}
          </h3>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-[#EAEFF6] rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-[#0A6CFF] transition-all duration-300"
              style={{ width: currentStep === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium">
            {formError}
          </div>
        )}

        {/* STEP 1: PRODUCT SPECIFICATIONS */}
        {currentStep === 1 && (
          <div className="py-5 space-y-4">
            <div>
              <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                Product Title / Description *
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. iPhone 15 Pro Max 256GB Natural Titanium"
                className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium"
              />
            </div>

            {/* Company / Brand with Searchable Dropdown */}
            <div className="relative">
              <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                Brand / Manufacturer *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                  className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl text-left bg-white font-semibold text-[#0B1F3A] flex items-center justify-between focus:outline-none focus:border-[#0A6CFF]"
                >
                  <span>{formBrand || 'Select a Brand'}</span>
                  <Search className="w-4 h-4 text-slate-400" />
                </button>

                {isBrandDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#EAEFF6] rounded-2xl shadow-xl p-2.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    {/* Live Search inside dropdown */}
                    <div className="relative mb-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Filter brands (Apple, Samsung, Sony...)"
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <div className="space-y-1">
                      {filteredBrands.map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => {
                            setFormBrand(brand);
                            setIsBrandDropdownOpen(false);
                            setBrandSearch('');
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between ${
                            formBrand === brand
                              ? 'bg-[#0A6CFF] text-white'
                              : 'text-[#0B1F3A] hover:bg-slate-100'
                          }`}
                        >
                          <span>{brand}</span>
                          {formBrand === brand && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}

                      {brandSearch.trim() &&
                        !POPULAR_BRANDS.some(
                          (b) => b.toLowerCase() === brandSearch.toLowerCase().trim()
                        ) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormBrand(brandSearch.trim());
                              setIsBrandDropdownOpen(false);
                              setBrandSearch('');
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-[#0A6CFF] bg-blue-50 hover:bg-blue-100 transition"
                          >
                            + Use custom brand &quot;{brandSearch.trim()}&quot;
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Item Code & Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Item / Model Code
                </label>
                <input
                  type="text"
                  value={formItemCode}
                  onChange={(e) => setFormItemCode(e.target.value)}
                  placeholder="e.g. A3106, SM-X810"
                  className="w-full px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Condition *
                </label>
                <select
                  value={formCondition}
                  onChange={(e) => setFormCondition(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-semibold bg-white text-[#0B1F3A]"
                >
                  {WHOLESALE_CONDITIONS.map((cond: string) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category & EAN/UPC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-semibold bg-white"
                >
                  {WHOLESALE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Barcode (EAN / UPC) <span className="font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formEan}
                  onChange={(e) => setFormEan(e.target.value)}
                  placeholder="Optional (e.g. 195949048735)"
                  className="w-full px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-mono"
                />
              </div>

              {formCategory === 'Other' && (
                <div className="col-span-2">
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Specify Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomCategory}
                    onChange={(e) => setFormCustomCategory(e.target.value)}
                    placeholder="Type custom category name (e.g. Solar Equipment, Vintage Watches...)"
                    className="w-full px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                Lot Description &amp; Packaging Notes
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Master carton packing, batch codes, EU/UK specs, warranty details..."
                className="w-full px-4 py-2 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium resize-none leading-relaxed"
              />
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={handleNextStep1}
                className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>Continue to Pricing &amp; Terms</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PRICING & COMMERCIAL TERMS */}
        {currentStep === 2 && (
          <form onSubmit={handleSave} className="py-5 space-y-4">
            {/* 3 OPTIONS FOR PRICING: Fixed Price, NEG, POA */}
            <div className="space-y-2 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <PricingOptionSelector
                value={formPricingType}
                onChange={setFormPricingType}
                tradeMode="WTS"
              />

              {formPricingType === 'fixed' && (
                <div className="pt-1">
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Fixed Unit Price (€) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">
                      €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required={formPricingType === 'fixed'}
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="e.g. 450.00"
                      className="w-full pl-8 pr-4 py-2.5 text-[14px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-bold bg-white text-[#0B1F3A]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Available Stock (Units) *
                </label>
                <input
                  type="number"
                  required
                  value={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.value)}
                  className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-bold"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                  Minimum Order (MOQ) *
                </label>
                <input
                  type="number"
                  required
                  value={formMoq}
                  onChange={(e) => setFormMoq(e.target.value)}
                  className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-bold"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label className="text-[12px] font-bold uppercase text-[#8A9BB0]">
                  Warehouse Location (Country) *
                </label>
                <div className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowLocationHelp((prev) => !prev)}
                    onMouseEnter={() => setShowLocationHelp(true)}
                    onMouseLeave={() => setShowLocationHelp(false)}
                    className="p-0.5 text-slate-400 hover:text-[#0A6CFF] rounded-full focus:outline-none transition cursor-pointer"
                    aria-label="Location guidance help"
                    title="Hub Location Guidance: In WTS this is where items are situated; in WTB this is where items are delivered."
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                  {showLocationHelp && (
                    <div
                      role="tooltip"
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3.5 bg-[#0B1F3A] text-white text-[12px] rounded-2xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700 normal-case"
                    >
                      <div className="font-bold text-[12.5px] text-[#38BDF8] flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-700/60">
                        <HelpCircle className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Hub Location Guide</span>
                      </div>
                      <div className="space-y-2 leading-relaxed text-slate-200">
                        <p>
                          <span className="inline-block px-1.5 py-0.2 bg-sky-500/20 text-sky-400 rounded font-bold mr-1">WTS</span>
                          <strong>In WTS:</strong> This is where the items currently are situated.
                        </p>
                        <p>
                          <span className="inline-block px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-bold mr-1">WTB</span>
                          <strong>In WTB:</strong> This is where you want these items delivered.
                        </p>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0B1F3A]" />
                    </div>
                  )}
                </div>
              </div>
              <select
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium bg-white text-[#0B1F3A]"
              >
                {TRADING_HUB_LOCATIONS.map((loc: { code: string; name: string }) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Hot Deal Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70">
              <div>
                <div className="text-[13px] font-bold text-[#0B1F3A]">Feature as Hot Deal</div>
                <div className="text-[11px] text-[#5B6B82]">
                  Highlights your listing with a flame badge across the Live Trading Board
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsHot}
                  onChange={(e) => setFormIsHot(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6CFF]"></div>
              </label>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="py-3 px-4 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>{mode === 'add' ? 'Publish Listing' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
