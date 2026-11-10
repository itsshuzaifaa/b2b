'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { RequestBulkCsvModal } from '@/components/modals/RequestBulkCsvModal';
import { CreateWtbModal } from '@/components/modals/CreateWtbModal';
import { ListingFormModal } from '@/components/modals/ListingFormModal';
import { isAccountDeleted } from '@/lib/admin/admin-store';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { WHOLESALE_CATEGORIES } from '@/lib/constants/wholesale-categories';
import { WHOLESALE_CONDITIONS, WholesaleCondition } from '@/lib/constants/conditions';
import { TRADING_HUB_LOCATIONS } from '@/lib/constants/locations';
import {
  PricingOptionSelector,
  PriceBadge,
  type PricingType,
} from '@/lib/utils/pricing';
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
  lotType?: 'WTS' | 'WTB';
  title: string;
  brand?: string;
  itemCode?: string;
  condition?: WholesaleCondition | string;
  description: string;
  ean: string;
  category: string;
  unitPrice: number;
  pricingType?: 'fixed' | 'neg' | 'poa';
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
  company_id?: string;
  companyId?: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
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
  const [activeTab, setActiveTab] = useState<'All' | 'Matched' | 'Active' | 'Hot' | 'Drafts' | 'Unpublished'>('All');
  const [lotTypeFilter, setLotTypeFilter] = useState<'ALL' | 'WTS' | 'WTB'>('ALL');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalMode, setTradeModalMode] = useState<'WTB' | 'WTS'>('WTB');
  const [selectedUnpublishedIds, setSelectedUnpublishedIds] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const currentTier = ((company?.tier || (company as any)?.membership_tier || 'bronze') as string).toLowerCase();
  const isGold = currentTier === 'gold';

  // Read URL query params on mount (e.g. ?tab=unpublished or ?tab=matched&product=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const tabParam = search.get('tab');
      const productParam = search.get('product');
      if (tabParam && tabParam.toLowerCase() === 'unpublished') {
        setActiveTab('Unpublished');
      } else if (tabParam && tabParam.toLowerCase() === 'matched') {
        setActiveTab('Matched');
      }
      if (productParam) {
        setSearchQuery(productParam);
      }
    }
  }, []);

  // Multi-step modal state (shared for Add and Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<ListingItem | null>(null);

  // Load listings from localStorage and run lifecycle checks
  useEffect(() => {
    let isCancelled = false;

    const reload = async () => {
      try {
        localStorage.removeItem('b2b_seller_listings_real_v2');
        localStorage.removeItem('b2b_seller_listings_v1');

        let currentWtsItems: ListingItem[] = [];
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
            currentWtsItems = updatedListings.map((l) => ({ ...l, lotType: 'WTS' as const }));
          }
        }

        // 1. Fetch Supabase products (WTS) in background and merge
        if (company?.id) {
          try {
            const res = await fetch(`/api/products?companyId=${encodeURIComponent(company.id)}`);
            if (res.ok && !isCancelled) {
              const data = await res.json();
              if (data.success && Array.isArray(data.products) && data.products.length > 0) {
                const dbMapped: ListingItem[] = data.products.map((p: any) => ({
                  id: p.id,
                  lotType: 'WTS' as const,
                  title: p.title,
                  brand: p.brand || p.title.split(' ')[0] || 'Wholesale',
                  itemCode: p.barcode_or_sku ? p.barcode_or_sku.slice(0, 8) : p.id.slice(0, 8),
                  condition: p.condition || 'New',
                  category: p.category_slug ? p.category_slug.replace(/-/g, ' ') : 'General',
                  ean: p.barcode_or_sku || 'n/a',
                  description: p.description || '',
                  unitPrice: Number(p.unit_price) || 0,
                  available: Number(p.quantity_available) || 50,
                  moq: Number(p.moq) || 1,
                  status: p.is_hot ? 'Hot' : 'Active',
                  createdAt: p.created_at || new Date().toISOString(),
                  company_id: company.id,
                  companyId: company.id,
                  companyName: company.name || company.company_name || 'Verified Supplier',
                  contactEmail: company.email || company.contact_email || '',
                  contactName: company.contact_name || 'Trade Desk',
                  contactPhone: company.phone || '',
                }));

                const mergedMap = new Map<string, ListingItem>();
                dbMapped.forEach((item) => mergedMap.set(item.id, item));
                currentWtsItems.forEach((item) => mergedMap.set(item.id, item));
                currentWtsItems = Array.from(mergedMap.values());
              }
            }
          } catch {}
        }

        // 2. Load WTB lots from localStorage
        const wtbLots: ListingItem[] = [];
        try {
          const rawUserWtbs = localStorage.getItem('b2b_user_wtb_requests_v2');
          if (rawUserWtbs) {
            const parsed = JSON.parse(rawUserWtbs);
            if (Array.isArray(parsed)) {
              parsed.forEach((w: any) => {
                wtbLots.push({
                  id: w.id,
                  lotType: 'WTB' as const,
                  title: w.description || w.title || 'Procurement Lot',
                  brand: w.brand || 'Procurement',
                  itemCode: w.itemCode || 'WTB-REQ',
                  condition: w.condition || 'New',
                  category: w.category || 'General',
                  ean: w.ean || 'n/a',
                  description: w.description || w.title || '',
                  unitPrice: Number(w.price) || 0,
                  pricingType: w.pricingType,
                  available: Number(w.qty) || 50,
                  moq: Number(w.moq) || 1,
                  location: w.location || 'EU',
                  status: 'Active',
                  createdAt: new Date().toISOString(),
                  company_id: w.companyId || w.company_id || company?.id,
                  companyId: w.companyId || w.company_id || company?.id,
                  companyName: w.companyName || company?.name || 'Verified Procurement Partner',
                  contactEmail: w.contactEmail || company?.email || '',
                });
              });
            }
          }
        } catch {}

        // 3. Load WTB lots from Supabase if buyer email is present
        if (company?.email) {
          try {
            const { getBuyerWtbRequests } = await import('@/lib/actions/wtb');
            const dbWtbs = await getBuyerWtbRequests(company.email);
            if (Array.isArray(dbWtbs) && dbWtbs.length > 0) {
              dbWtbs.forEach((w: any) => {
                if (!wtbLots.some((existing) => existing.id === w.id)) {
                  wtbLots.push({
                    id: w.id,
                    lotType: 'WTB' as const,
                    title: w.product_name,
                    brand: w.product_name.split(' ')[0] || 'Procurement',
                    itemCode: w.barcode_or_sku ? w.barcode_or_sku.slice(0, 8) : `REQ-${w.id.slice(0, 6).toUpperCase()}`,
                    condition: (w.notes?.match(/Condition:\s*([^.|]+)/i)?.[1]?.trim()) || 'New',
                    category: w.category_slug ? w.category_slug.replace(/-/g, ' ') : 'General',
                    ean: w.barcode_or_sku || 'n/a',
                    description: w.product_name + (w.notes ? ` — ${w.notes}` : ''),
                    unitPrice: Number(w.target_price) || 0,
                    pricingType: (w.notes?.includes('POA') ? 'poa' : w.notes?.includes('NEG') ? 'neg' : 'fixed'),
                    available: Number(w.target_quantity) || 50,
                    moq: 1,
                    location: 'EU',
                    status: 'Active',
                    createdAt: w.created_at || new Date().toISOString(),
                    company_id: w.buyer_user_id || company.id,
                    companyId: w.buyer_user_id || company.id,
                    companyName: w.buyer_company || company.name || 'Verified Procurement Partner',
                    contactEmail: w.buyer_email || company.email || '',
                  });
                }
              });
            }
          } catch {}
        }

        const combinedLots = [...currentWtsItems, ...wtbLots].filter(
          (l) => !isAccountDeleted(l.companyId || l.company_id, l.contactEmail)
        );
        if (!isCancelled) {
          setListings(combinedLots);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentWtsItems));
          } catch {}
        }
      } catch {
        if (!isCancelled) setListings([]);
      }
    };

    reload();

    window.addEventListener('b2b_wtb_created', reload);
    window.addEventListener('b2b_listings_updated', reload);
    window.addEventListener('b2b_listing_created', reload);
    window.addEventListener('b2b_admin_update', reload);
    window.addEventListener('storage', reload);

    return () => {
      isCancelled = true;
      window.removeEventListener('b2b_wtb_created', reload);
      window.removeEventListener('b2b_listings_updated', reload);
      window.removeEventListener('b2b_listing_created', reload);
      window.removeEventListener('b2b_admin_update', reload);
      window.removeEventListener('storage', reload);
    };
  }, [company?.id, company?.email]);

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

  function saveListings(items: ListingItem[]) {
    setListings(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }

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
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ListingItem) => {
    setModalMode('edit');
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteListing = (id: string) => {
    if (confirm('Are you sure you want to delete this listing from your catalog?')) {
      const updated = listings.filter((l) => l.id !== id);
      saveListings(updated);
    }
  };

  // Final Submit from standalone memoized ListingFormModal
  const handleSaveListing = (formData: any) => {
    const isSpecialPricing = formData.pricingType === 'neg' || formData.pricingType === 'poa';
    const effectivePrice = isSpecialPricing ? 0 : formData.unitPrice;
    const finalSku = formData.ean || 'n/a';
    const finalItemCode =
      formData.itemCode ||
      (finalSku !== 'n/a' ? finalSku.slice(0, 8) : `MDL-${Date.now().toString().slice(-5)}`);
    const pricingTag = isSpecialPricing ? ` | Pricing: ${formData.pricingType.toUpperCase()}` : '';
    const descWithPricing = formData.description || formData.title;
    const finalDescription =
      isSpecialPricing && !descWithPricing.includes(pricingTag)
        ? `${descWithPricing}${pricingTag}`
        : descWithPricing;

    const now = new Date();
    const expires = new Date(now.getTime() + LISTING_ACTIVE_DURATION_DAYS * 24 * 60 * 60 * 1000);

    if (modalMode === 'edit' && editingItem) {
      const updated = listings.map((l) => {
        if (l.id === editingItem.id) {
          return {
            ...l,
            title: formData.title,
            brand: formData.brand,
            itemCode: finalItemCode,
            condition: formData.condition,
            category: formData.category,
            ean: finalSku,
            description: finalDescription,
            unitPrice: effectivePrice,
            pricingType: formData.pricingType,
            available: formData.available,
            moq: formData.moq,
            location: (formData.location || 'DE').toUpperCase(),
            status:
              formData.status === 'Hot'
                ? ('Hot' as const)
                : l.status === 'Unpublished'
                ? ('Unpublished' as const)
                : ('Active' as const),
          };
        }
        return l;
      });
      saveListings(updated);
    } else {
      const newItem: ListingItem = {
        id: `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: formData.title,
        brand: formData.brand,
        itemCode: finalItemCode,
        condition: formData.condition,
        category: formData.category,
        ean: finalSku,
        description: finalDescription,
        unitPrice: effectivePrice,
        pricingType: formData.pricingType,
        available: formData.available,
        moq: formData.moq,
        location: (formData.location || 'DE').toUpperCase(),
        status: formData.status || 'Active',
        createdAt: now.toISOString(),
        activatedAt: now.toISOString(),
        publishedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        company_id: company?.id,
        companyId: company?.id,
        companyName: company?.name || (company as any)?.company_name || 'Verified Supplier',
        contactEmail: company?.email || (company as any)?.contact_email || 'supplier@b2blink.eu',
        contactName: company?.contact_name || 'Trade Desk',
        contactPhone: company?.phone || '',
      };
      const updatedListings = [newItem, ...listings];
      saveListings(updatedListings);

      // Dispatch event for instant update across tabs and trading board
      try {
        window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
        window.dispatchEvent(new CustomEvent('b2b_listing_created'));
      } catch {}

      if (company?.id) {
        void fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            title: formData.title,
            brand: formData.brand,
            condition: formData.condition,
            description: finalDescription,
            barcodeOrSku: finalSku !== 'n/a' ? finalSku : undefined,
            categorySlug: formData.category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'),
            unitPrice: effectivePrice,
            quantityAvailable: formData.available,
            moq: formData.moq,
            isHot: formData.status === 'Hot',
            status: 'active',
          }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (data.success && data.product) {
              const synced = updatedListings.map((item) =>
                item.id === newItem.id ? { ...item, id: data.product.id } : item
              );
              saveListings(synced);
              window.dispatchEvent(new CustomEvent('b2b_listings_updated'));
            }
          })
          .catch((err) => console.warn('[SYNC PRODUCT ERROR]', err));
      }
    }

    setIsModalOpen(false);
  };

  const hasItemMatch = (item: ListingItem) => {
    return matches.some(
      (m) =>
        m.wtsProductId === item.id ||
        (m.wtsBarcode && item.ean && m.wtsBarcode === item.ean && item.ean !== 'n/a') ||
        (m.wtsTitle && item.title && (
          m.wtsTitle.toLowerCase().includes(item.title.toLowerCase()) ||
          item.title.toLowerCase().includes(m.wtsTitle.toLowerCase())
        ))
    );
  };

  const activeCount = listings.filter(
    (l) => l.status === 'Active' || l.status === 'Hot'
  ).length;
  const unpublishedCount = listings.filter((l) => l.status === 'Unpublished').length;
  const matchedCount = listings.filter((l) => l.status !== 'Unpublished' && hasItemMatch(l)).length;

  const wtsCount = listings.filter((l) => (l.lotType || 'WTS') === 'WTS').length;
  const wtbCount = listings.filter((l) => l.lotType === 'WTB').length;

  const filteredListings = listings.filter((item) => {
    // 1. Lot Type Filter (WTS vs WTB)
    if (lotTypeFilter === 'WTS' && (item.lotType || 'WTS') !== 'WTS') return false;
    if (lotTypeFilter === 'WTB' && item.lotType !== 'WTB') return false;

    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ean.includes(searchQuery) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'Unpublished') return item.status === 'Unpublished';
    if (activeTab === 'Matched') return item.status !== 'Unpublished' && hasItemMatch(item);
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
            Catalog Lots &amp; Listings
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            <AnimatedNumber value={activeCount} /> active wholesale lot{activeCount === 1 ? '' : 's'} (<span className="text-[#0A6CFF] font-bold">{wtsCount} WTS</span> &bull; <span className="text-[#16A34A] font-bold">{wtbCount} WTB</span>) on your {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} plan.
            {unpublishedCount > 0 && (
              <span className="text-amber-700 font-semibold ml-1.5">
                (<AnimatedNumber value={unpublishedCount} /> unpublished in 30-day recovery window)
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
            onClick={() => {
              setTradeModalMode('WTB');
              setIsTradeModalOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-[#16A34A] hover:bg-emerald-700 text-white font-bold text-[13px] px-5 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs text-center"
          >
            <Plus className="w-4 h-4" />
            <span>+ Post WTB</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTradeModalMode('WTS');
              setIsTradeModalOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-6 py-2.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs text-center"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add WTS</span>
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
            href="/dashboard/matches"
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs cursor-pointer"
          >
            <span>Unlock &amp; Quote Matches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Matched Tab Callout Banner */}
      {activeTab === 'Matched' && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A6CFF] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-[#0B1F3A]">
                Matched Inventory with Active Purchase Orders
              </h4>
              <p className="text-[12px] text-[#5B6B82] mt-0.5">
                Qualified buyers have active purchase requests for these stocks. You can unlock their verified company and contact information to quote them directly.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/matches"
            className="bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-bold px-4 py-2 rounded-full transition flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs cursor-pointer"
          >
            <span>Open Matching Stock Page</span>
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

      {/* Lot Type Selector: All, WTS, WTB */}
      <div className="flex items-center gap-2 mt-6">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full border border-slate-200/60 shadow-2xs">
          <button
            type="button"
            onClick={() => setLotTypeFilter('ALL')}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-extrabold transition cursor-pointer ${
              lotTypeFilter === 'ALL'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'text-[#5B6B82] hover:text-[#0B1F3A]'
            }`}
          >
            All Lots ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setLotTypeFilter('WTS')}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              lotTypeFilter === 'WTS'
                ? 'bg-[#0A6CFF] text-white shadow-xs'
                : 'text-[#0A6CFF] hover:bg-white/70'
            }`}
          >
            <span>WTS Offers (Sell)</span>
            <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold ${
              lotTypeFilter === 'WTS' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0A6CFF]'
            }`}>
              {wtsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLotTypeFilter('WTB')}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              lotTypeFilter === 'WTB'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'text-[#16A34A] hover:bg-white/70'
            }`}
          >
            <span>WTB Demands (Buy)</span>
            <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold ${
              lotTypeFilter === 'WTB' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-[#16A34A]'
            }`}>
              {wtbCount}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-7 mb-6">
        {/* Tabs with Badge Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full [scrollbar-width:none]">
          {(['All', 'Matched', 'Active', 'Hot', 'Drafts', 'Unpublished'] as const).map((tab) => {
            const count =
              tab === 'All'
                ? listings.filter((l) => l.status !== 'Unpublished').length
                : tab === 'Matched'
                ? matchedCount
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
                      : tab === 'Matched'
                      ? 'bg-[#0A6CFF] text-white shadow-xs'
                      : 'bg-[#0B1F3A] text-white shadow-xs'
                    : tab === 'Unpublished' && count > 0
                    ? 'text-[#E11D48] hover:bg-rose-50 bg-rose-50/60'
                    : tab === 'Matched' && count > 0
                    ? 'text-[#0A6CFF] hover:bg-blue-50 bg-blue-50/70 border border-blue-200/60'
                    : 'text-[#5B6B82] hover:text-[#0B1F3A] bg-transparent'
                }`}
              >
                {tab === 'Matched' && <Zap className={`w-3.5 h-3.5 ${isSelected ? 'fill-white text-white' : 'fill-[#0A6CFF] text-[#0A6CFF]'}`} />}
                <span>{tab}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : tab === 'Unpublished' && count > 0
                      ? 'bg-rose-100 text-[#E11D48]'
                      : tab === 'Matched' && count > 0
                      ? 'bg-blue-100 text-[#0A6CFF]'
                      : 'bg-slate-100 text-[#5B6B82]'
                  }`}
                >
                  <AnimatedNumber value={count} />
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
                          <div className="font-bold text-[#0B1F3A]">
                            <PriceBadge price={item.unitPrice} pricingType={item.pricingType} />
                          </div>
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
                  <th className="py-4 px-5">Type</th>
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
                    <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                      No product listings found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredListings.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC]/80 transition group">
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-black border ${
                          item.lotType === 'WTB'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-[#0A6CFF] border-blue-200'
                        }`}>
                          {item.lotType === 'WTB' ? 'WTB (Buy)' : 'WTS (Sell)'}
                        </span>
                      </td>
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
                        <PriceBadge price={item.unitPrice} pricingType={item.pricingType} />
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

      {/* 2-STEP POPUP MODAL (OPTIMIZED STANDALONE COMPONENT FOR ULTRA-SMOOTH 60FPS TYPING) */}
      <ListingFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingItem}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveListing}
      />

      {/* REQUEST BULK CSV MODAL (GOLD EXCLUSIVE) */}
      <RequestBulkCsvModal
        isOpen={isRequestBulkCsvOpen}
        onClose={() => setIsRequestBulkCsvOpen(false)}
        company={company}
      />

      {/* UNIFIED TRADE MODAL (WTB / WTS) */}
      <CreateWtbModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        initialMode={tradeModalMode}
      />
    </>
  );
}
