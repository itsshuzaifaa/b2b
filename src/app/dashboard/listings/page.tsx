'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { RequestBulkCsvModal } from '@/components/modals/RequestBulkCsvModal';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { WHOLESALE_CONDITIONS, WholesaleCondition } from '@/lib/constants/conditions';
import { TRADING_HUB_LOCATIONS } from '@/lib/constants/locations';
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
  HelpCircle,
  Zap,
  ArrowRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  Calendar,
  Check,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import type { TradeMatch } from '@/lib/matching/match-types';
import { getUserMatches } from '@/lib/matching/match-types';
import {
  processListingsLifecycle,
  republishListingItems,
  permanentlyDeleteListingItems,
  getListingActiveExpiry,
  getListingRecoveryExpiry,
  LISTING_ACTIVE_DURATION_DAYS,
  LISTING_RECOVERY_WINDOW_DAYS,
} from '@/lib/listings/lifecycle';

export interface ListingItem {
  id: string;
  title: string;
  brand?: string;
  itemCode?: string;
  condition?: WholesaleCondition | string;
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  available: number;
  moq: number;
  location?: string;
  status: 'Hot' | 'Active' | 'Draft' | 'Unpublished';
  images?: string[];
  createdAt?: string;
  activatedAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  unpublishedAt?: string;
  unpublishNotificationSent?: boolean;
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

export default function ListingsPage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [isRequestBulkCsvOpen, setIsRequestBulkCsvOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Hot' | 'Drafts' | 'Unpublished'>('All');
  const [selectedUnpublishedIds, setSelectedUnpublishedIds] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const currentTier = ((company?.tier || (company as any)?.membership_tier || 'bronze') as string).toLowerCase();
  const isGold = currentTier === 'gold';

  // Read URL query params on mount (e.g. ?tab=unpublished from notification emails)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const tabParam = search.get('tab');
      if (tabParam && tabParam.toLowerCase() === 'unpublished') {
        setActiveTab('Unpublished');
      }
    }
  }, []);

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
  const [formCondition, setFormCondition] = useState<WholesaleCondition | string>('New');
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
  const [showLocationHelp, setShowLocationHelp] = useState(false);

  // Load listings from localStorage and run lifecycle checks
  useEffect(() => {
    const reload = () => {
      try {
        localStorage.removeItem('b2b_seller_listings_real_v2');
        localStorage.removeItem('b2b_seller_listings_v1');

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const { updatedListings, hasChanges } = processListingsLifecycle(parsed);
            if (hasChanges) {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedListings));
              } catch {}
            }
            setListings(updatedListings);
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

  // Load smart trading matches
  useEffect(() => {
    const loadMatches = () => {
      const companyId = company?.id;
      const email = company?.email;
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (email) params.set('email', email);

      fetch(`/api/matches?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.matches)) {
            setMatches(data.matches);
          }
        })
        .catch(() => {
          setMatches(getUserMatches(companyId, email));
        });
    };

    loadMatches();
    window.addEventListener('b2b_trade_matches_updated', loadMatches);
    return () => window.removeEventListener('b2b_trade_matches_updated', loadMatches);
  }, [company?.id, company?.email]);

  // Automatic Lifecycle Processor: checks timers, unpublishes after 14 days, sends email, purges after 30 days
  useEffect(() => {
    const checkAndProcessLifecycle = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const currentListings: ListingItem[] = JSON.parse(raw);
        if (!Array.isArray(currentListings) || currentListings.length === 0) return;

        const { updatedListings, newlyUnpublished, permanentlyDeletedCount, hasChanges } =
          processListingsLifecycle(currentListings);

        if (hasChanges) {
          saveListings(updatedListings);
          window.dispatchEvent(new CustomEvent('b2b_listings_updated'));

          if (permanentlyDeletedCount > 0) {
            setFeedbackMessage(
              `${permanentlyDeletedCount} listing${permanentlyDeletedCount > 1 ? 's have' : ' has'} been permanently deleted after 30 days in unpublished status.`
            );
          }

          // Send notification email to the seller for newly inactivated listings
          const unnotified = newlyUnpublished.filter((l) => !l.unpublishNotificationSent);
          const recipientEmail = company?.contact_email || company?.email;
          if (recipientEmail && unnotified.length > 0) {
            try {
              await fetch('/api/listings/notify-inactivated', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: unnotified.map((l) => ({
                    email: recipientEmail,
                    recipientName: company?.contact_name || company?.name || 'Wholesale Partner',
                    companyName: company?.name,
                    listingTitle: l.title,
                    itemCode: l.itemCode,
                    category: l.category,
                    unitPrice: l.unitPrice,
                  })),
                }),
              });

              // Mark unpublishNotificationSent: true
              const marked = updatedListings.map((l) => {
                if (unnotified.some((u) => u.id === l.id)) {
                  return { ...l, unpublishNotificationSent: true };
                }
                return l;
              });
              saveListings(marked);
            } catch (err) {
              console.warn('[INACTIVATION EMAIL ERROR]', err);
            }
          }
        }
      } catch (err) {
        console.warn('[LIFECYCLE RUNNER ERROR]', err);
      }
    };

    checkAndProcessLifecycle();
    const interval = setInterval(checkAndProcessLifecycle, 45000); // Re-check every 45 seconds
    return () => clearInterval(interval);
  }, [company?.email, company?.contact_email, company?.contact_name, company?.name]);

  const saveListings = (items: ListingItem[]) => {
    setListings(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  // Bulk / Single Republish handler (resets 14-day timer)
  const handleRepublish = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    const { updatedListings, republishedCount } = republishListingItems(listings, ids);
    saveListings(updatedListings);
    setSelectedUnpublishedIds((prev) => prev.filter((id) => !ids.includes(id)));

    setFeedbackMessage(
      `Successfully republished ${republishedCount} listing${republishedCount > 1 ? 's' : ''}! The 14-day active period has restarted.`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);

    try {
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
    } catch {}

    // Synchronize to Supabase if available
    try {
      await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: 'active' }),
      });
    } catch (err) {
      console.warn('[REPUBLISH API SYNC NOTICE]', err);
    }
  };

  // Bulk / Single Permanent Deletion handler
  const handlePermanentDelete = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const count = ids.length;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${count} listing${count > 1 ? 's' : ''}? This action cannot be undone and will remove them completely.`
      )
    ) {
      return;
    }

    const { updatedListings, deletedCount } = permanentlyDeleteListingItems(listings, ids);
    saveListings(updatedListings);
    setSelectedUnpublishedIds((prev) => prev.filter((id) => !ids.includes(id)));

    setFeedbackMessage(`Permanently deleted ${deletedCount} listing${deletedCount > 1 ? 's' : ''}.`);
    setTimeout(() => setFeedbackMessage(null), 4000);

    try {
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
    } catch {}

    // Synchronize delete to Supabase if available
    try {
      await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      console.warn('[DELETE API SYNC NOTICE]', err);
    }
  };

  // Helper to simulate 14-day expiration (for instant live testing/demo)
  const handleSimulateInactivation = async (id: string) => {
    const updated = listings.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'Unpublished' as const,
          unpublishedAt: new Date().toISOString(),
          unpublishNotificationSent: false,
        };
      }
      return l;
    });
    saveListings(updated);
    try {
      window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
    } catch {}

    const targetItem = listings.find((l) => l.id === id);
    const recipientEmail = company?.contact_email || company?.email;
    if (recipientEmail && targetItem) {
      try {
        await fetch('/api/listings/notify-inactivated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: recipientEmail,
            recipientName: company?.contact_name || company?.name || 'Wholesale Partner',
            companyName: company?.name,
            listingTitle: targetItem.title,
            itemCode: targetItem.itemCode,
            category: targetItem.category,
            unitPrice: targetItem.unitPrice,
          }),
        });
      } catch {}
    }

    setFeedbackMessage(
      `Listing "${targetItem?.title || id}" was unpublished (14-day limit reached) and notification email dispatched. Check the Unpublished tab!`
    );
    setTimeout(() => setFeedbackMessage(null), 6000);
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
    setFormCondition('New');
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
    setFormCondition(item.condition || 'New');
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

    const finalSku = formEan.trim() || 'n/a';
    const finalItemCode = formItemCode.trim() || (finalSku !== 'n/a' ? finalSku.slice(0, 8) : `MDL-${Date.now().toString().slice(-5)}`);
    const finalCategory = formCategory === 'Other' && formCustomCategory.trim() ? formCustomCategory.trim() : formCategory;
    const now = new Date();
    const expires = new Date(now.getTime() + LISTING_ACTIVE_DURATION_DAYS * 24 * 60 * 60 * 1000);

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
            status: formIsHot ? ('Hot' as const) : l.status === 'Unpublished' ? ('Unpublished' as const) : ('Active' as const),
          };
        }
        return l;
      });
      saveListings(updated);
    } else {
      const newItem: ListingItem = {
        id: `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
        createdAt: now.toISOString(),
        activatedAt: now.toISOString(),
        publishedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
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
            barcodeOrSku: finalSku !== 'n/a' ? finalSku : undefined,
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

  const activeCount = listings.filter(
    (l) => l.status === 'Active' || l.status === 'Hot'
  ).length;
  const unpublishedCount = listings.filter((l) => l.status === 'Unpublished').length;

  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ean.includes(searchQuery) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'Unpublished') return item.status === 'Unpublished';
    if (activeTab === 'Hot') return item.status === 'Hot';
    if (activeTab === 'Active') return item.status === 'Active' || item.status === 'Hot';
    if (activeTab === 'Drafts') return item.status === 'Draft';
    // 'All' shows all non-unpublished listings
    return item.status !== 'Unpublished';
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
            {activeCount} active wholesale listing{activeCount === 1 ? '' : 's'} on your {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} plan.
            {unpublishedCount > 0 && (
              <span className="text-amber-700 font-semibold ml-1.5">
                ({unpublishedCount} unpublished in 30-day recovery window)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          {isGold && (
            <button
              type="button"
              onClick={() => setIsRequestBulkCsvOpen(true)}
              className="w-full sm:w-auto justify-center bg-white hover:bg-[#F8FAFC] text-[#0B1F3A] border border-[#EAEFF6] font-bold text-[13px] px-5 py-2.5 rounded-full transition cursor-pointer shadow-2xs text-center"
            >
              Request to upload Bulk CSV
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full sm:w-auto justify-center bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-6 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs text-center"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add product</span>
          </button>
        </div>
      </div>

      {/* Real-time Feedback Banner */}
      {feedbackMessage && (
        <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Smart Trading Matches Alert Banner */}
      {matches.length > 0 && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A6CFF] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-[#0B1F3A]">
                {matches.length} Waiting {matches.length === 1 ? 'Buyer' : 'Buyers'} Found for Your Inventory
              </h4>
              <p className="text-[12px] text-[#5B6B82] mt-0.5">
                Qualified buyers have active Want-To-Buy requests matching your stock lots. Immediate emails have been dispatched.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
          >
            <span>Review Matches in Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Unpublished Recovery Notice Banner */}
      {activeTab === 'Unpublished' && (
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-[#0B1F3A]">
                Unpublished Listings &bull; 30-Day Recovery Window
              </h4>
              <p className="text-[12px] text-[#5B6B82] mt-0.5">
                Listings automatically move here after their 14-day active period. You have <strong>30 days</strong> to recover them before they are permanently deleted.
              </p>
            </div>
          </div>
          {filteredListings.length > 0 && selectedUnpublishedIds.length === 0 && (
            <button
              type="button"
              onClick={() => setSelectedUnpublishedIds(filteredListings.map((l) => l.id))}
              className="bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select All for Republish</span>
            </button>
          )}
        </div>
      )}

      {/* Tabs & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-7 mb-6">
        {/* Tabs with Badge Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full [scrollbar-width:none]">
          {(['All', 'Active', 'Hot', 'Drafts', 'Unpublished'] as const).map((tab) => {
            const count =
              tab === 'All'
                ? listings.filter((l) => l.status !== 'Unpublished').length
                : tab === 'Active'
                ? listings.filter((l) => l.status === 'Active' || l.status === 'Hot').length
                : tab === 'Hot'
                ? listings.filter((l) => l.status === 'Hot').length
                : tab === 'Drafts'
                ? listings.filter((l) => l.status === 'Draft').length
                : listings.filter((l) => l.status === 'Unpublished').length;

            const isSelected = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedUnpublishedIds([]);
                }}
                className={`text-[13px] font-bold px-4 py-1.5 rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? tab === 'Unpublished'
                      ? 'bg-[#E11D48] text-white shadow-xs'
                      : 'bg-[#0B1F3A] text-white shadow-xs'
                    : tab === 'Unpublished' && count > 0
                    ? 'text-[#E11D48] hover:bg-rose-50 bg-rose-50/60'
                    : 'text-[#5B6B82] hover:text-[#0B1F3A] bg-transparent'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : tab === 'Unpublished' && count > 0
                      ? 'bg-rose-100 text-[#E11D48]'
                      : 'bg-slate-100 text-[#5B6B82]'
                  }`}
                >
                  {count}
                </span>
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
            placeholder="Search by title, EAN or code"
            className="w-full pl-5 pr-10 py-2 text-[13px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar for Unpublished Tab */}
      {activeTab === 'Unpublished' && selectedUnpublishedIds.length > 0 && (
        <div className="mb-4 p-3.5 sm:p-4 bg-[#0B1F3A] text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#38BDF8] flex items-center justify-center font-bold text-sm">
              {selectedUnpublishedIds.length}
            </div>
            <div>
              <div className="text-[13px] font-bold">
                {selectedUnpublishedIds.length} listing{selectedUnpublishedIds.length > 1 ? 's' : ''} selected for republishing
              </div>
              <div className="text-[11px] text-slate-300">
                Republishing resets the active lifespan back to 14 days and makes them live to buyers immediately.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedUnpublishedIds([])}
              className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-full font-semibold transition cursor-pointer"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => handlePermanentDelete(selectedUnpublishedIds)}
              className="px-3.5 py-1.5 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 rounded-full font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>
            <button
              type="button"
              onClick={() => handleRepublish(selectedUnpublishedIds)}
              className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Republish Selected ({selectedUnpublishedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Listings Table */}
      <div className="bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'Unpublished' ? (
            /* Dedicated Table for Unpublished Listings with Multi-Select and 30-Day Recovery Countdown */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0] bg-slate-50/50">
                  <th className="py-4 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredListings.length > 0 &&
                        filteredListings.every((l) => selectedUnpublishedIds.includes(l.id))
                      }
                      onChange={() => {
                        const visibleIds = filteredListings.map((l) => l.id);
                        const allSelected =
                          visibleIds.length > 0 &&
                          visibleIds.every((id) => selectedUnpublishedIds.includes(id));
                        if (allSelected) {
                          setSelectedUnpublishedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                        } else {
                          setSelectedUnpublishedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                        }
                      }}
                      className="w-4 h-4 rounded text-[#0A6CFF] accent-[#0A6CFF] cursor-pointer"
                      title="Select all unpublished listings"
                    />
                  </th>
                  <th className="py-4 px-5">Category &amp; Brand</th>
                  <th className="py-4 px-5">Item Code</th>
                  <th className="py-4 px-5">Listing Title</th>
                  <th className="py-4 px-5">Price &amp; Stock</th>
                  <th className="py-4 px-5">Unpublished On</th>
                  <th className="py-4 px-5">30-Day Recovery Timer</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC] text-[13px]">
                {filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                      <h4 className="text-[15px] font-bold text-[#0B1F3A] mb-1">No unpublished listings</h4>
                      <p className="text-[13px] text-[#5B6B82] max-w-md mx-auto">
                        Listings stay active for 14 days before auto-unpublishing. Expired listings will appear here with a 30-day recovery window.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredListings.map((item) => {
                    const recovery = getListingRecoveryExpiry(item);
                    const isSelected = selectedUnpublishedIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`transition group ${
                          isSelected ? 'bg-blue-50/50' : 'hover:bg-[#F8FAFC]/80'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedUnpublishedIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((id) => id !== item.id)
                                  : [...prev, item.id]
                              );
                            }}
                            className="w-4 h-4 rounded text-[#0A6CFF] accent-[#0A6CFF] cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-[#5B6B82] whitespace-nowrap">
                          <div>{item.category}</div>
                          <div className="text-[11px] font-bold text-[#0B1F3A]">{item.brand || '—'}</div>
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
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="font-bold text-[#0B1F3A]">€{item.unitPrice.toFixed(2)}</div>
                          <div className="text-[11px] text-[#8A9BB0]">
                            {item.available.toLocaleString()} u &bull; {item.moq} MOQ
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="text-[12px] font-medium text-[#5B6B82]">
                            {item.unpublishedAt
                              ? new Date(item.unpublishedAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Recently'}
                          </div>
                          <div className="text-[10px] text-slate-400">14-day timer expired</div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                recovery.remainingDays <= 3
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                  : recovery.remainingDays <= 7
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {recovery.remainingDays > 0
                                  ? `${recovery.remainingDays} day${recovery.remainingDays === 1 ? '' : 's'} left`
                                  : `${recovery.remainingHours}h left`}
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Deletes permanently on {recovery.permanentDeleteAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleRepublish([item.id])}
                              className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[12px] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                              title="Republish listing for another 14 days"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Republish</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDelete([item.id])}
                              title="Delete permanently from database"
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* Standard Table for Active / Hot / Drafts / All Listings with 14-Day Active Timer */
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
                  <th className="py-4 px-5">Active Timer</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC] text-[13px]">
                {filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
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
                        {(() => {
                          const itemMatches = matches.filter(
                            (m) =>
                              m.wtsProductId === item.id ||
                              (m.wtsTitle && m.wtsTitle.toLowerCase().includes(item.title.toLowerCase())) ||
                              (m.wtsBarcode && item.ean && m.wtsBarcode === item.ean && item.ean !== 'n/a')
                          );
                          if (itemMatches.length === 0) return null;
                          return (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0A6CFF] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-200">
                                <Zap className="w-2.5 h-2.5 fill-[#0A6CFF]" />
                                <span>{itemMatches.length} Waiting {itemMatches.length === 1 ? 'Buyer' : 'Buyers'}</span>
                              </span>
                              <span className="text-[10.5px] text-[#059669] font-bold">
                                Target: €{itemMatches[0].wtbTargetPrice.toFixed(2)}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[12px] text-[#5B6B82] whitespace-nowrap">
                        {item.ean && item.ean !== '195949048735' && item.ean !== '8806095087286' ? item.ean : 'n/a'}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            item.condition === 'New' || item.condition === 'new' || !item.condition
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.condition === 'CPO' || item.condition === '14 Day'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : item.condition === 'A Grade' || item.condition === 'refurbished'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : item.condition === 'B Grade'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : item.condition === 'C Grade'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.condition === 'Untested'
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : item.condition === 'Ber' || item.condition === 'worn_out'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.condition === 'new' || !item.condition
                            ? 'New'
                            : item.condition === 'refurbished'
                            ? 'Refurbished'
                            : item.condition === 'worn_out'
                            ? 'Ber'
                            : item.condition}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-[#0B1F3A] whitespace-nowrap">
                        €{item.unitPrice.toFixed(2)}
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
                      {/* Active 14-day Timer Column */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {item.status === 'Draft' ? (
                          <span className="text-slate-400 text-xs italic">Draft</span>
                        ) : (() => {
                          const activeInfo = getListingActiveExpiry(item);
                          return (
                            <div
                              className="flex flex-col gap-0.5"
                              title={`Expires on ${activeInfo.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  activeInfo.remainingDays >= 7
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : activeInfo.remainingDays >= 3
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>
                                  {activeInfo.remainingDays > 0
                                    ? `${activeInfo.remainingDays}d left`
                                    : `${activeInfo.remainingHours}h left`}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400">14-day active timer</span>
                            </div>
                          );
                        })()}
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
                            onClick={() => handleSimulateInactivation(item.id)}
                            title="Simulate 14-day expiration (inactivate listing and send email)"
                            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
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
          )}
        </div>
      </div>

      {/* 2-STEP POPUP MODAL (CLEAN WHOLESALE SPECIFICATIONS, NO IMAGES) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto">
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
                      onChange={(e) => setFormCondition(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-[13px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-semibold bg-white text-[#0B1F3A]"
                    >
                      {WHOLESALE_CONDITIONS.map((cond) => (
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
                      Unit Price (€) *
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
                      {TRADING_HUB_LOCATIONS.map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
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
                    €{((parseFloat(formPrice) || 0) * (parseInt(formAvailable, 10) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* REQUEST BULK CSV MODAL (GOLD EXCLUSIVE) */}
      <RequestBulkCsvModal
        isOpen={isRequestBulkCsvOpen}
        onClose={() => setIsRequestBulkCsvOpen(false)}
        company={company}
      />
    </>
  );
}
