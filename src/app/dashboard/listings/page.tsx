'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CsvImportModal } from '@/components/dashboard/CsvImportModal';
import {
  Search,
  Plus,
  UploadCloud,
  Upload,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Package,
  Layers,
  Image as ImageIcon,
  DollarSign,
} from 'lucide-react';

export interface ListingItem {
  id: string;
  title: string;
  brand?: string;
  condition?: 'new' | 'used' | 'refurbished' | 'worn_out';
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  available: number;
  moq: number;
  status: 'Hot' | 'Active' | 'Draft';
  images: string[];
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

const STORAGE_KEY = 'b2b_seller_listings_real_v2';

const INITIAL_LISTINGS: ListingItem[] = [];

import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardListingsPage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<ListingItem[]>(INITIAL_LISTINGS);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Hot' | 'Drafts'>('All');

  // Multi-step modal state (shared for Add and Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formBrand, setFormBrand] = useState('Apple');
  const [brandSearch, setBrandSearch] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [formCondition, setFormCondition] = useState<'new' | 'used' | 'refurbished' | 'worn_out'>('new');
  const [formCategory, setFormCategory] = useState('Consumer Electronics');
  const [formEan, setFormEan] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState('149.00');
  const [formAvailable, setFormAvailable] = useState('100');
  const [formMoq, setFormMoq] = useState('10');
  const [formIsHot, setFormIsHot] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setFormImages((prev) => [...prev, e.target!.result as string].slice(0, 5));
          setFormError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Load listings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setListings(parsed);
          return;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LISTINGS));
    } catch {
      // ignore
    }
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
    setFormCondition('new');
    setFormCategory('Consumer Electronics');
    setFormEan('');
    setFormDescription('');
    setFormImageUrl('');
    setFormImages([]);
    setFormPrice('99.00');
    setFormAvailable('200');
    setFormMoq('15');
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
    setFormCondition(item.condition || 'new');
    setFormCategory(item.category);
    setFormEan(item.ean);
    setFormDescription(item.description);
    setFormImages(item.images || []);
    setFormImageUrl(item.images?.[0] || '');
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
      setFormError('Please enter a product title.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Please provide a short description.');
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  // Step 2 Validation
  const handleNextStep2 = () => {
    const combined = [...formImages];
    if (formImageUrl.trim() && !combined.includes(formImageUrl.trim())) {
      combined.unshift(formImageUrl.trim());
      setFormImages(combined);
    }
    if (combined.length === 0) {
      setFormError('Please upload at least one product photo or enter an image URL.');
      return;
    }
    setFormError(null);
    setCurrentStep(3);
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

    const finalImages = formImages.length > 0 ? formImages : (formImageUrl.trim() ? [formImageUrl.trim()] : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800']);
    const finalSku = formEan.trim() || `SKU-${Date.now().toString().slice(-8)}`;

    if (modalMode === 'edit' && editingId) {
      const updated = listings.map((l) => {
        if (l.id === editingId) {
          return {
            ...l,
            title: formTitle.trim(),
            brand: formBrand,
            condition: formCondition,
            category: formCategory,
            ean: finalSku,
            description: formDescription.trim(),
            images: finalImages,
            unitPrice: priceNum,
            available: availNum,
            moq: moqNum,
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
        condition: formCondition,
        category: formCategory,
        ean: finalSku,
        description: formDescription.trim(),
        images: finalImages,
        unitPrice: priceNum,
        available: availNum,
        moq: moqNum,
        status: formIsHot ? 'Hot' : 'Active',
      };
      saveListings([newItem, ...listings]);

      if (company?.id) {
        void fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            title: formTitle.trim(),
            brand: formBrand,
            condition: formCondition,
            description: formDescription.trim(),
            barcodeOrSku: finalSku,
            categorySlug: formCategory.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'),
            unitPrice: priceNum,
            quantityAvailable: availNum,
            moq: moqNum,
            isHot: formIsHot,
            images: finalImages,
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
                <th className="py-4 px-6">PRODUCT, BARCODE &amp; DETAILS</th>
                <th className="py-4 px-6">CATEGORY</th>
                <th className="py-4 px-6">UNIT PRICE</th>
                <th className="py-4 px-6">AVAILABLE</th>
                <th className="py-4 px-6">MOQ</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
              {filteredListings.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC]/70 transition group">
                  {/* Product & Barcode & Description */}
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3.5 max-w-sm">
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-[#EAEFF6]">
                        <Image
                          src={item.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#0B1F3A] leading-snug truncate">
                          {item.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.brand && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-[#0A6CFF] border border-blue-100">
                              {item.brand}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              item.condition === 'new'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.condition === 'refurbished'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : item.condition === 'worn_out'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.condition === 'new'
                              ? 'Brand New'
                              : item.condition === 'refurbished'
                              ? 'Refurbished'
                              : item.condition === 'worn_out'
                              ? 'Worn Out'
                              : 'Used'}
                          </span>
                          <span className="text-[11px] text-[#8A9BB0] font-mono">
                            EAN/UPC: {item.ean}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#5B6B82] line-clamp-1 mt-1">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-4 px-6 text-[#5B6B82] font-medium whitespace-nowrap">
                    {item.category}
                  </td>

                  {/* Unit Price */}
                  <td className="py-4 px-6 font-bold text-[#0B1F3A] whitespace-nowrap">
                    £{item.unitPrice.toFixed(2)}
                  </td>

                  {/* Available */}
                  <td className="py-4 px-6 text-[#5B6B82] font-medium whitespace-nowrap">
                    {item.available.toLocaleString()} u
                  </td>

                  {/* MOQ */}
                  <td className="py-4 px-6 text-[#5B6B82] font-medium whitespace-nowrap">
                    {item.moq} u
                  </td>

                  {/* Status */}
                  <td className="py-4 px-6 whitespace-nowrap">
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

                  {/* Actions (Edit and Delete) */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MULTI-STEP POPUP MODAL (SHARED FOR BOTH ADD AND EDIT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header & Step Indicator */}
            <div className="pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF]">
                  STEP {currentStep} OF 3: {currentStep === 1 ? 'BASIC DETAILS' : currentStep === 2 ? 'IMAGES & MEDIA' : 'PRICING & INVENTORY'}
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
                  style={{ width: currentStep === 1 ? '33.3%' : currentStep === 2 ? '66.6%' : '100%' }}
                />
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium">
                {formError}
              </div>
            )}

            {/* STEP 1: BASIC DETAILS */}
            {currentStep === 1 && (
              <div className="py-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                    className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                  />
                </div>

                {/* Company / Brand with Searchable Dropdown */}
                <div className="relative">
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Brand / Manufacturer Name *
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                      className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl text-left bg-white font-semibold text-[#0B1F3A] flex items-center justify-between focus:outline-none focus:border-[#0A6CFF]"
                    >
                      <span>{formBrand || 'Select a Brand / Company'}</span>
                      <Search className="w-4 h-4 text-slate-400" />
                    </button>

                    {isBrandDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#EAEFF6] rounded-2xl shadow-xl p-2.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        {/* Live Search inside dropdown */}
                        <div className="relative mb-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type to filter brands (Apple, Samsung, Sony...)"
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

                          {/* Custom brand entry option */}
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

                {/* Condition & Product Code (EAN/UPC) */}
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Product Code (EAN / UPC) *
                    </label>
                    <input
                      type="text"
                      value={formEan}
                      onChange={(e) => setFormEan(e.target.value)}
                      placeholder="e.g. 5013493405928"
                      className="w-full px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-mono"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-semibold bg-white"
                  >
                    <option value="Consumer Electronics">Consumer Electronics</option>
                    <option value="Beauty & Cosmetics">Beauty & Cosmetics</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Health & FMCG">Health & FMCG</option>
                    <option value="Tools & Hardware">Tools & Hardware</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Lot Description &amp; Specifications *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe packaging condition, batch codes, warranty, master carton counts, delivery lead time..."
                    className="w-full px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={handleNextStep1}
                    className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>Continue to Images</span>
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

            {/* STEP 2: IMAGES & MEDIA */}
            {currentStep === 2 && (
              <div className="py-5 space-y-4">
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
                  className="border-2 border-dashed border-[#CBD5E1] rounded-[22px] p-6 sm:p-7 text-center bg-transparent hover:bg-[#F8FAFF] transition cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="text-[14px] font-bold text-[#0B1F3A]">
                    Drag images here or <span className="text-[#0A6CFF] hover:underline">browse</span>
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-1 font-normal">
                    PNG, JPG or WEBP, up to 5 images, 10 MB each
                  </div>
                </div>

                {/* Uploaded Thumbnails list with black circular × remove badge */}
                {formImages.length > 0 && (
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-2">
                      Attached Product Images ({formImages.length}/5)
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {formImages.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="relative w-16 h-16 rounded-[16px] bg-[#DDE5F2] border border-[#CBD5E1] flex items-center justify-center shadow-2xs overflow-hidden"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={`Product photo ${idx + 1}`}
                            className="w-full h-full object-cover rounded-[15px]"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhoto(idx);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center shadow-xs hover:bg-red-600 transition cursor-pointer z-10"
                          >
                            <X className="w-3 h-3 stroke-[3]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Or paste direct Image URL */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Or paste direct Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 px-4 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                    {formImageUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          if (formImageUrl.trim() && !formImages.includes(formImageUrl.trim())) {
                            setFormImages((prev) => [...prev, formImageUrl.trim()].slice(0, 5));
                            setFormImageUrl('');
                          }
                        }}
                        className="px-4 py-2 bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] rounded-2xl text-[12px] font-bold transition cursor-pointer"
                      >
                        Add
                      </button>
                    )}
                  </div>
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
                    type="button"
                    onClick={handleNextStep2}
                    className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>Continue to Pricing</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PRICING & INVENTORY */}
            {currentStep === 3 && (
              <form onSubmit={handleSaveListing} className="py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Unit Price (£) *
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

                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1">
                    Minimum Order Quantity (MOQ) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formMoq}
                    onChange={(e) => setFormMoq(e.target.value)}
                    className="w-full px-4 py-2.5 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-bold"
                  />
                </div>

                {/* Hot Lot Promotion Toggle */}
                <div className="p-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-orange-500 shrink-0" />
                    <div>
                      <div className="text-[13px] font-bold text-[#0B1F3A]">Feature as Hot Lot</div>
                      <div className="text-[11px] text-[#5B6B82]">Highlight in top marketplace spotlight banner</div>
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
                    onClick={() => setCurrentStep(2)}
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
