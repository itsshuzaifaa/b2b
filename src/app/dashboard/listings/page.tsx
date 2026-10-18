'use client';

import React, { useState, useEffect } from 'react';
import { CsvImportModal } from '@/components/dashboard/CsvImportModal';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';

export interface ListingItem {
  id: string;
  title: string;
  brand?: string;
  itemCode?: string;
  condition?: 'new' | 'used' | 'refurbished' | 'worn_out';
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  available: number;
  moq: number;
  location?: string;
  status: 'Hot' | 'Active' | 'Draft';
  images?: string[];
}

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

const STORAGE_KEY = 'b2b_seller_listings_v3';

const INITIAL_LISTINGS: ListingItem[] = [];

import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardListingsPage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Hot' | 'Drafts'>('All');

  // Multi-step modal state (shared for Add and Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states (Clean, image-free wholesale trading specifications)
  const [formTitle, setFormTitle] = useState('');
  const [formBrand, setFormBrand] = useState('Apple');
  const [brandSearch, setBrandSearch] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [formItemCode, setFormItemCode] = useState('');
  const [formCondition, setFormCondition] = useState<'new' | 'used' | 'refurbished' | 'worn_out'>('new');
  const [formCategory, setFormCategory] = useState(WHOLESALE_CATEGORIES[0].name);
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formEan, setFormEan] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('DE');
  const [formPrice, setFormPrice] = useState('920.00');
  const [formAvailable, setFormAvailable] = useState('50');
  const [formMoq, setFormMoq] = useState('10');
  const [formIsHot, setFormIsHot] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Load listings from localStorage
  useEffect(() => {
    const reload = () => {
      try {
        localStorage.removeItem('b2b_seller_listings_real_v2');
        localStorage.removeItem('b2b_seller_listings_v1');

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setListings(parsed);
            return;
          }
        }
        setListings([]);
      } catch {
        setListings([]);
      }
    };

    reload();

    window.addEventListener('b2b_admin_update', reload);
    window.addEventListener('storage', reload);

    return () => {
      window.removeEventListener('b2b_admin_update', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const saveListings = (items: ListingItem[]) => {
    setListings(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setEditingId(null);
    setCurrentStep(1);
    setFormTitle('');
    setFormBrand('Apple');
    setBrandSearch('');
    setIsBrandDropdownOpen(false);
    setFormItemCode('');
    setFormCondition('new');
    setFormCategory(WHOLESALE_CATEGORIES[0].name);
    setFormCustomCategory('');
    setFormEan('');
    setFormDescription('');
    setFormLocation('DE');
    setFormPrice('920.00');
    setFormAvailable('50');
    setFormMoq('10');
    setFormIsHot(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ListingItem) => {
    setModalMode('edit');
    setEditingId(item.id);
    setCurrentStep(1);
    setFormTitle(item.title);
    setFormBrand(item.brand || 'Apple');
    setBrandSearch('');
    setIsBrandDropdownOpen(false);
    setFormItemCode(item.itemCode || '');
    setFormCondition(item.condition || 'new');
    const knownCategory = WHOLESALE_CATEGORIES.some((c) => c.name === item.category);
    if (knownCategory) {
      setFormCategory(item.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('Other');
      setFormCustomCategory(item.category || '');
    }
    setFormEan(item.ean);
    setFormDescription(item.description);
    setFormLocation(item.location || 'DE');
    setFormPrice(String(item.unitPrice));
    setFormAvailable(String(item.available));
    setFormMoq(String(item.moq));
    setFormIsHot(item.status === 'Hot');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteListing = (id: string) => {
    if (confirm('Are you sure you want to delete this listing from your catalog?')) {
      const updated = listings.filter((l) => l.id !== id);
      saveListings(updated);
    }
  };

  // Step 1 Validation
  const handleNextStep1 = () => {
    if (!formTitle.trim()) {
      setFormError('Please enter a product title / description.');
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  // Final Submit
  const handleSaveListing = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(formPrice);
    const availNum = parseInt(formAvailable, 10);
    const moqNum = parseInt(formMoq, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid unit price.');
      return;
    }
    if (isNaN(availNum) || availNum <= 0) {
      setFormError('Available quantity must be greater than 0.');
      return;
    }
    if (isNaN(moqNum) || moqNum <= 0) {
      setFormError('Minimum Order Quantity (MOQ) must be at least 1.');
      return;
    }

    const finalSku = formEan.trim() || `SKU-${Date.now().toString().slice(-8)}`;
    const finalItemCode = formItemCode.trim() || `MDL-${Date.now().toString().slice(-5)}`;
    const finalCategory = formCategory === 'Other' && formCustomCategory.trim() ? formCustomCategory.trim() : formCategory;

    if (modalMode === 'edit' && editingId) {
      const updated = listings.map((l) => {
        if (l.id === editingId) {
          return {
            ...l,
            title: formTitle.trim(),
            brand: formBrand,
            itemCode: finalItemCode,
            condition: formCondition,
            category: finalCategory,
            ean: finalSku,
            description: formDescription.trim() || formTitle.trim(),
            unitPrice: priceNum,
            available: availNum,
            moq: moqNum,
            location: formLocation.toUpperCase(),
            status: formIsHot ? ('Hot' as const) : ('Active' as const),
          };
        }
        return l;
      });
      saveListings(updated);
    } else {
      const newItem: ListingItem = {
        id: `lst-${Date.now()}`,
        title: formTitle.trim(),
        brand: formBrand,
        itemCode: finalItemCode,
        condition: formCondition,
        category: finalCategory,
        ean: finalSku,
        description: formDescription.trim() || formTitle.trim(),
        unitPrice: priceNum,
        available: availNum,
        moq: moqNum,
        location: formLocation.toUpperCase(),
        status: formIsHot ? 'Hot' : 'Active',
      };
      saveListings([newItem, ...listings]);

      // Dispatch event for instant update across tabs and trading board
      try {
        window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
      } catch {}

      if (company?.id) {
        void fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            title: formTitle.trim(),
            brand: formBrand,
            condition: formCondition,
            description: formDescription.trim() || formTitle.trim(),
            barcodeOrSku: finalSku,
            categorySlug: finalCategory.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'),
            unitPrice: priceNum,
            quantityAvailable: availNum,
            moq: moqNum,
            isHot: formIsHot,
            status: 'active',
          }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (data.success && data.product) {
              setListings((prev) =>
                prev.map((item) => (item.id === newItem.id ? { ...item, id: data.product.id } : item))
              );
            }
          })
          .catch((err) => console.warn('[SYNC PRODUCT ERROR]', err));
      }
    }

    setIsModalOpen(false);
  };

  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ean.includes(searchQuery) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'Hot') return item.status === 'Hot';
    if (activeTab === 'Active') return item.status === 'Active' || item.status === 'Hot';
    if (activeTab === 'Drafts') return item.status === 'Draft';
    return true;
  });

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Product listings
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            {listings.length} active wholesale listings on your Gold plan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="bg-white hover:bg-[#F8FAFC] text-[#0B1F3A] border border-[#EAEFF6] font-bold text-[13px] px-5 py-2.5 rounded-full transition cursor-pointer shadow-2xs"
          >
            Upload CSV
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-6 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add product</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-7 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(['All', 'Active', 'Hot', 'Drafts'] as const).map((tab) => {
            const count =
              tab === 'All'
                ? listings.length
                : tab === 'Active'
                ? listings.length
                : tab === 'Hot'
                ? listings.filter((l) => l.status === 'Hot').length
                : 0;
            const isSelected = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`text-[13px] font-bold px-4 py-1.5 rounded-full transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-[#5B6B82] hover:text-[#0B1F3A] bg-transparent'
                }`}
              >
                {tab} {count}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, EAN or desc"
            className="w-full pl-5 pr-10 py-2 text-[13px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Product Listings Table */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                <th className="py-4 px-5">Category</th>
                <th className="py-4 px-5">Brand</th>
                <th className="py-4 px-5">Item Code</th>
                <th className="py-4 px-5">Description</th>
                <th className="py-4 px-5">EAN / UPC</th>
                <th className="py-4 px-5">Condition</th>
                <th className="py-4 px-5">Price</th>
                <th className="py-4 px-5">Available</th>
                <th className="py-4 px-5">MOQ</th>
                <th className="py-4 px-5">Location</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[13px]">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                    No product listings found matching your search.
                  </td>
                </tr>
              ) : (
                filteredListings.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]/80 transition group">
                    <td className="py-3.5 px-5 font-semibold text-[#5B6B82] whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#0B1F3A] whitespace-nowrap">
                      {item.brand || '—'}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[12px] font-bold text-[#0A6CFF] whitespace-nowrap">
                      {item.itemCode || '—'}
                    </td>
                    <td className="py-3.5 px-5 max-w-xs">
                      <div className="font-bold text-[#0B1F3A] truncate" title={item.title}>
                        {item.title}
                      </div>
                      {item.description && item.description !== item.title && (
                        <div className="text-[11px] text-[#8A9BB0] truncate mt-0.5" title={item.description}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[12px] text-[#5B6B82] whitespace-nowrap">
                      {item.ean}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          item.condition === 'new' || !item.condition
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.condition === 'refurbished'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : item.condition === 'worn_out'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.condition === 'new' || !item.condition
                          ? 'New'
                          : item.condition === 'refurbished'
                          ? 'Refurbished'
                          : item.condition === 'worn_out'
                          ? 'Worn Out'
                          : 'Used'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#0B1F3A] whitespace-nowrap">
                      £{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#5B6B82] whitespace-nowrap">
                      {item.available.toLocaleString()} u
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#5B6B82] whitespace-nowrap">
                      {item.moq} u
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                        {item.location || 'DE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {item.status === 'Hot' ? (
                        <span className="bg-[#FFF7ED] text-[#EA580C] text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border border-orange-200">
                          <Flame className="w-3 h-3" />
                          <span>Hot</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-block">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit listing details"
                          className="text-[#0A6CFF] hover:bg-blue-50 p-1.5 rounded-lg font-bold text-[13px] transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(item.id)}
                          title="Delete listing"
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-STEP POPUP MODAL (CLEAN WHOLESALE SPECIFICATIONS, NO IMAGES) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header & Step Indicator */}
            <div className="pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF]">
                  STEP {currentStep} OF 2: {currentStep === 1 ? 'PRODUCT SPECIFICATIONS' : 'PRICING & COMMERCIAL TERMS'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-[20px] font-extrabold text-[#0B1F3A]">
                {modalMode === 'add' ? 'Add New Product Listing' : 'Edit Product Listing'}
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
                          {POPULAR_BRANDS.filter((b) =>
                            b.toLowerCase().includes(brandSearch.toLowerCase().trim())
                          ).map((brand) => (
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
                      onChange={(e) =>
                        setFormCondition(
                          e.target.value as 'new' | 'used' | 'refurbished' | 'worn_out'
                        )
                      }
                      className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-semibold bg-white text-[#0B1F3A]"
                    >
                      <option value="new">Brand New (Factory Sealed)</option>
                      <option value="refurbished">Refurbished (Grade A/B)</option>
                      <option value="used">Used (Functional)</option>
                      <option value="worn_out">Worn Out (For Parts)</option>
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
                      Barcode (EAN / UPC) *
                    </label>
                    <input
                      type="text"
                      value={formEan}
                      onChange={(e) => setFormEan(e.target.value)}
                      placeholder="e.g. 195949048735"
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
                    onClick={() => setIsModalOpen(false)}
                    className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PRICING & COMMERCIAL TERMS */}
            {currentStep === 2 && (
              <form onSubmit={handleSaveListing} className="py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Unit Price (£ / €) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-bold"
                    />
                  </div>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Warehouse Location (Country) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value.toUpperCase())}
                      placeholder="e.g. DE, NL, UK, PL"
                      className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Hot Lot Promotion Toggle */}
                <div className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-orange-500 shrink-0" />
                    <div>
                      <div className="text-[13px] font-bold text-[#0B1F3A]">Feature as Hot Lot</div>
                      <div className="text-[11px] text-[#5B6B82]">Highlight with hot badge across Live Trading Board</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsHot}
                    onChange={(e) => setFormIsHot(e.target.checked)}
                    className="w-5 h-5 accent-orange-500 cursor-pointer"
                  />
                </div>

                {/* Wholesale Lot Valuation summary */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6] flex items-center justify-between text-[13px]">
                  <span className="text-[#8A9BB0] font-semibold">Total Lot Wholesale Value:</span>
                  <span className="font-extrabold text-[#0B1F3A]">
                    £{((parseFloat(formPrice) || 0) * (parseInt(formAvailable, 10) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{modalMode === 'add' ? 'Publish Listing' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV MODAL */}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
      />
    </>
  );
}
