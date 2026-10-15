'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth/auth-context';
import { InquiryModal } from '@/components/modals/InquiryModal';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import type { Product } from '@/types/database';
import {
  Search,
  Flame,
  Package,
  Lock,
  MessageSquare,
} from 'lucide-react';

export default function MarketplacePage() {
  const router = useRouter();
  const { isLoggedIn, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHotOnly, setShowHotOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_low' | 'price_high' | 'moq_low'>('featured');

  // Modal states
  const [activeInquiryProduct, setActiveInquiryProduct] = useState<Product | null>(null);

  // Load real products from API / Supabase
  useEffect(() => {
    let isMounted = true;
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        let baseProducts: Product[] = [];
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
          baseProducts = data.products;
        } else {
          baseProducts = [...MOCK_PRODUCTS];
        }

        // Merge any locally added seller products so newly created listings appear immediately
        try {
          const raw = localStorage.getItem('b2b_seller_listings_real_v2');
          if (raw) {
            const localListings = JSON.parse(raw);
            if (Array.isArray(localListings)) {
              localListings.forEach((localItem: any) => {
                if (!baseProducts.some((p) => p.id === localItem.id || p.title === localItem.title)) {
                  baseProducts.unshift({
                    id: localItem.id,
                    company_id: company?.id || 'comp-local',
                    title: localItem.title,
                    description: localItem.description,
                    barcode_or_sku: localItem.ean,
                    category_slug: localItem.category ? localItem.category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') : 'electronics',
                    unit_price: localItem.unitPrice,
                    quantity_available: localItem.available,
                    moq: localItem.moq,
                    is_hot: localItem.status === 'Hot',
                    status: 'active',
                    images: localItem.images && localItem.images.length > 0 ? localItem.images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
                    created_at: new Date().toISOString(),
                    company: company ? {
                      id: company.id,
                      name: company.company_name || company.name || 'Verified Supplier',
                      contact_name: company.contact_name || 'Trade Representative',
                      email: company.contact_email || company.email || '',
                      role: 'seller',
                      membership_tier: company.tier || 'silver',
                      approval_status: 'approved',
                      categories: company.niches || [],
                      created_at: new Date().toISOString(),
                    } : undefined,
                  });
                }
              });
            }
          }
        } catch {
          // ignore
        }

        setProducts(baseProducts);
      })
      .catch((err) => {
        console.warn('[MARKETPLACE LOAD ERROR]', err);
        if (isMounted) setProducts(MOCK_PRODUCTS);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [company]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        prod.title.toLowerCase().includes(query) ||
        prod.category_slug.toLowerCase().includes(query) ||
        (prod.barcode_or_sku && prod.barcode_or_sku.toLowerCase().includes(query));

      const matchesCategory =
        selectedCategory === 'all' || prod.category_slug === selectedCategory;

      const matchesHot = !showHotOnly || prod.is_hot;

      return matchesSearch && matchesCategory && matchesHot;
    }).sort((a, b) => {
      if (sortBy === 'price_low') return a.unit_price - b.unit_price;
      if (sortBy === 'price_high') return b.unit_price - a.unit_price;
      if (sortBy === 'moq_low') return a.moq - b.moq;
      if (a.is_hot && !b.is_hot) return -1;
      if (!a.is_hot && b.is_hot) return 1;
      return 0;
    });
  }, [products, searchQuery, selectedCategory, showHotOnly, sortBy]);

  // Requirement 01: Guest user clicking "Send inquiry" goes straight to account creation
  const handleInquiryClick = (product: Product) => {
    if (!isLoggedIn) {
      router.push(`/register?redirect=/marketplace&role=buyer`);
      return;
    }
    setActiveInquiryProduct(product);
  };

  // Requirement 02: Guest goes to register; Logged in user sends simple question without filling fields
  const handleChatClick = (product: Product) => {
    if (!isLoggedIn) {
      router.push(`/register?redirect=/marketplace&role=buyer`);
      return;
    }

    const defaultMsg = `Hi, I have a question regarding this product: ${product.title}.`;
    const conv = startMarketplaceInquiry(
      product,
      company,
      company?.contact_name || company?.name || 'Buyer',
      company?.email || '',
      company?.phone || '',
      defaultMsg
    );
    router.push(`/dashboard/inquiries?id=${conv.id}`);
  };

  const getSellerInitials = (name?: string) => {
    if (!name) return 'EU';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col">
      {/* 1. Header Banner with Rounded Bottom Edge */}
      <section className="relative text-white pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-20 overflow-hidden rounded-b-[32px] lg:rounded-b-[48px] bg-[#0B1F3A] shadow-xl">
        {/* Subtle Warehouse Backdrop Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-warehouse.jpg"
            alt="European Wholesale Logistics"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-20 filter brightness-75"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(115deg, rgba(7,22,44,.96) 0%, rgba(11,31,58,.88) 50%, rgba(10,108,255,.45) 100%)',
            }}
          />
        </div>

        <div className="max-w-[1160px] mx-auto px-5 sm:px-8 relative z-10">
          <div className="max-w-3xl">
            {/* Eyebrow Label */}
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#00C2FF] mb-3">
              VERIFIED EUROPEAN WHOLESALE INVENTORY
            </div>

            {/* H1 Title: 42px / 1.1 (32px on phones), weight 800 */}
            <h1 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold tracking-[-0.025em] text-white">
              Wholesale Marketplace
            </h1>

            {/* Description: 15-16px, text on dark */}
            <p className="mt-3 text-[15px] sm:text-[16px] text-[#D3DEEE] leading-relaxed max-w-2xl font-normal">
              Pallet and master-carton lots from certified European distributors. Search by title, GTIN/EAN barcode, or filter by category niche with 0% platform fee.
            </p>
          </div>

          {/* Search & Sort Bar */}
          <div className="mt-8 bg-white p-2.5 rounded-2xl shadow-[0_10px_30px_rgba(11,31,58,0.12)] flex flex-col md:flex-row gap-2 border border-[#EAEFF6]">
            {/* Search Input */}
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-[#5B6B82] absolute left-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, barcode (EAN / UPC), or keyword..."
                className="w-full pl-12 pr-4 py-3 text-[15px] text-[#0B1F3A] rounded-xl focus:outline-none placeholder:text-[#5B6B82] font-medium"
              />
            </div>

            {/* Sort & Hot Toggle Controls */}
            <div className="flex items-center gap-2 px-2 border-t md:border-t-0 md:border-l border-[#EAEFF6] pt-2 md:pt-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'featured' | 'price_low' | 'price_high' | 'moq_low')}
                className="text-[14px] font-semibold text-[#0B1F3A] bg-[#F3F6FB] hover:bg-[#EAEFF6] py-2.5 px-4 rounded-full border border-[#E3E9F2] focus:outline-none transition-colors"
              >
                <option value="featured">Featured / Hot First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="moq_low">Lowest MOQ First</option>
              </select>

              <button
                type="button"
                onClick={() => setShowHotOnly(!showHotOnly)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-bold transition-colors ${
                  showHotOnly
                    ? 'bg-[#0B1F3A] text-[#00C2FF] border border-[#00C2FF]'
                    : 'bg-[#F3F6FB] text-[#41536D] hover:bg-[#EAEFF6] border border-[#E3E9F2]'
                }`}
              >
                <Flame className={`w-4 h-4 ${showHotOnly ? 'text-[#00C2FF]' : 'text-[#0A6CFF]'}`} />
                <span>HOT DEALS</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Catalog Body */}
      <main className="max-w-[1160px] mx-auto px-5 sm:px-8 py-10 lg:py-14 w-full flex-1">
        {/* Guest Teaser Banner if not logged in */}
        {!isLoggedIn && (
          <div className="mb-10 p-6 rounded-[24px] bg-[#0B1F3A] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#0A6CFF]/20 text-[#00C2FF] flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[16px] font-bold text-white">Wholesale Guest Mode Active</h4>
                <p className="text-[14px] text-[#D3DEEE] mt-0.5">
                  Create a free account to unlock direct proforma orders, instant supplier messaging, and full warehouse lot manifests.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="shrink-0 min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
            >
              Register Free Member Account
            </Link>
          </div>
        )}

        {/* Niche Category Filter Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-4 scrollbar-none mb-10 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-5 py-2.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#0A6CFF] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#E3E9F2] hover:bg-white hover:text-[#0B1F3A]'
            }`}
          >
            All Niches ({products.length})
          </button>
          {MOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-5 py-2.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat.slug
                  ? 'bg-[#0A6CFF] text-white shadow-xs'
                  : 'bg-white text-[#41536D] border border-[#E3E9F2] hover:bg-white hover:text-[#0B1F3A]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Catalog Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-1">
              CURRENT STOCK
            </span>
            <h2 className="text-[24px] lg:text-[28px] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
              Active Wholesale Lots ({filteredProducts.length})
            </h2>
          </div>

          <Link
            href="/requests/new"
            className="text-[14px] font-bold text-[#0B1F3A] hover:text-[#0A6CFF] border border-[#E3E9F2] bg-white px-5 py-2 rounded-full transition-colors hidden sm:inline-flex"
          >
            + Post a Want-To-Buy Request
          </Link>
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-12 text-center max-w-xl mx-auto my-12">
            <div className="w-16 h-16 rounded-full bg-[#F3F6FB] flex items-center justify-center mx-auto mb-4 text-[#5B6B82]">
              <Package className="w-8 h-8" />
            </div>
            <h4 className="text-[20px] font-bold text-[#0B1F3A]">No matching wholesale stock found</h4>
            <p className="text-[14px] text-[#5B6B82] mt-2 leading-relaxed">
              Try searching a different keyword or barcode, or post a Want-To-Buy request to receive direct quotes from vetted European distributors holding that stock.
            </p>
            <Link
              href="/requests/new"
              className="mt-6 inline-flex items-center justify-center min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] transition-colors shadow-xs"
            >
              Post a Want-To-Buy Request
            </Link>
          </div>
        ) : (
          /* 4-Column Responsive Grid matching Homepage Two-Part Architecture */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {filteredProducts.map((product, index) => {
              const sellerName = product.company?.name || 'Vetted European Seller';
              const sellerInitials = getSellerInitials(sellerName);
              const productImage = product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

              // Clean badges exactly matching Image 2
              const badge =
                index === 0
                  ? 'Verified stock'
                  : index === 1
                  ? 'New stock'
                  : index === 2
                  ? 'Verified stock'
                  : index === 3
                  ? 'Spotlight'
                  : index % 3 === 0
                  ? 'Verified stock'
                  : index % 3 === 1
                  ? 'New stock'
                  : 'Spotlight';

              return (
                <div key={product.id} className="flex flex-col gap-3">
                  {/* Part 1: White Product Card (28px radius, soft shadow, photo with 20px radius inset 10px) */}
                  <div className="bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-[10px] flex flex-col justify-between flex-1">
                    <div>
                      {/* Photo Container with 20px radius inset 10px & blue badge */}
                      <Link
                        href={`/marketplace/${product.id}`}
                        className="relative h-[200px] w-full rounded-[20px] overflow-hidden bg-[#F3F6FB] mb-4 block group"
                      >
                        <Image
                          src={productImage}
                          alt={product.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="bg-[#0A6CFF] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                            {badge}
                          </span>
                        </div>
                      </Link>

                      {/* Card Content: Title (18px bold) & Description (14px grey) */}
                      <div className="px-2">
                        <Link href={`/marketplace/${product.id}`} className="block group">
                          <h3 className="text-[18px] font-bold text-[#0B1F3A] leading-snug line-clamp-1 group-hover:text-[#0A6CFF] transition-colors">
                            {product.title}
                          </h3>
                        </Link>
                        <p className="text-[14px] text-[#5B6B82] mt-1.5 line-clamp-2 leading-relaxed min-h-[42px]">
                          {product.description}
                        </p>
                      </div>

                      {/* Light Divider */}
                      <div className="border-t border-[#EAEFF6] my-4 mx-2" />

                      {/* Price Row: Price (22px bold) + per piece on left, MOQ (17px bold blue) + MOQ on right */}
                      <div className="flex items-end justify-between px-2 mb-4">
                        <div>
                          <span className="text-[22px] font-extrabold text-[#0B1F3A] leading-none block">
                            £{product.unit_price.toFixed(2)}
                          </span>
                          <span className="text-[13px] text-[#5B6B82] mt-1 block">
                            per piece
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[17px] font-extrabold text-[#0A6CFF] leading-none block">
                            {product.moq} pcs
                          </span>
                          <span className="text-[13px] text-[#5B6B82] mt-1 block">
                            MOQ
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Full-width blue "Send inquiry" pill */}
                    <button
                      type="button"
                      onClick={() => handleInquiryClick(product)}
                      className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs"
                    >
                      Send inquiry
                    </button>
                  </div>

                  {/* Part 2: Slim White Seller Pill below the card */}
                  <div className="bg-white rounded-full border border-[#EAEFF6] px-3.5 py-2 flex items-center justify-between shadow-[0_4px_16px_rgba(11,31,58,0.04)]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-[28px] h-[28px] rounded-full bg-[#0B1F3A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {sellerInitials}
                      </div>
                      <span className="text-[14px] font-semibold text-[#0B1F3A] truncate">
                        {sellerName}
                      </span>
                    </div>

                    {/* Round light-blue chat icon button */}
                    <button
                      type="button"
                      onClick={() => handleChatClick(product)}
                      aria-label={`Chat with ${sellerName}`}
                      className="w-8 h-8 rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0A6CFF] flex items-center justify-center transition-colors shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Inquiry Modal */}
      <InquiryModal
        product={activeInquiryProduct}
        isOpen={!!activeInquiryProduct}
        onClose={() => setActiveInquiryProduct(null)}
      />
    </div>
  );
}
