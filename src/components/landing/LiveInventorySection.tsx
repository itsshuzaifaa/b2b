'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MessageSquare, ArrowRight, Package } from 'lucide-react';
import { InquiryModal } from '@/components/modals/InquiryModal';
import { AuthGateModal } from '@/components/modals/AuthGateModal';
import { useAuth } from '@/lib/auth/auth-context';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import type { Product } from '@/types/database';

export function LiveInventorySection() {
  const router = useRouter();
  const { isLoggedIn, company } = useAuth();
  const sliderRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Fetch live products from /api/products (falling back to initial mock dataset if network is down)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        } else {
          setProducts(MOCK_PRODUCTS);
        }
      })
      .catch((err) => {
        console.warn('[LIVE INVENTORY LOAD ERROR]', err);
        if (isMounted) setProducts(MOCK_PRODUCTS);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter & prioritize the best 6-8 listings from live inventory
  const featuredListings = useMemo(() => {
    const list = products.length > 0 ? [...products] : [...MOCK_PRODUCTS];
    return list
      .sort((a, b) => {
        if (a.is_hot && !b.is_hot) return -1;
        if (!a.is_hot && b.is_hot) return 1;
        return 0;
      })
      .slice(0, 8);
  }, [products]);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const handleInquiryClick = (product: Product) => {
    if (!isLoggedIn) {
      router.push(`/register?redirect=/marketplace/${product.id}&role=buyer`);
      return;
    }
    setSelectedProduct(product);
  };

  const handleChatClick = (product: Product) => {
    if (!isLoggedIn) {
      router.push(`/register?redirect=/marketplace/${product.id}&role=buyer`);
      return;
    }

    const defaultMsg = `Hi, I have a question regarding wholesale lot: ${product.title}.`;
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
    if (!name) return 'GL';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <section className="bg-[#F3F6FB] py-[72px] lg:py-[104px]">
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2.5">
              LIVE INVENTORY
            </span>
            <h2 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
              Fresh from verified sellers
            </h2>
          </div>

          {/* Slider Controls beside View all listings */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn || !company) {
                  setAuthGateOpen(true);
                } else {
                  router.push('/marketplace');
                }
              }}
              className="text-[15px] font-bold text-[#0B1F3A] hover:text-[#0A6CFF] border border-[#E3E9F2] bg-white px-5 py-2.5 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>View all listings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={scrollLeft}
                aria-label="Previous listing"
                className="w-10 h-10 rounded-full border border-[#E3E9F2] bg-white flex items-center justify-center text-[#0B1F3A] hover:bg-[#F3F6FB] hover:border-[#0A6CFF] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={scrollRight}
                aria-label="Next listing"
                className="w-10 h-10 rounded-full border border-[#E3E9F2] bg-white flex items-center justify-center text-[#0B1F3A] hover:bg-[#F3F6FB] hover:border-[#0A6CFF] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && featuredListings.length === 0 ? (
          <div className="flex gap-[24px] overflow-hidden pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[280px] sm:w-[300px] lg:w-[calc(25%-18px)] shrink-0 animate-pulse flex flex-col gap-3"
              >
                <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-[10px] h-[400px]">
                  <div className="h-[200px] w-full rounded-[20px] bg-slate-200 mb-4" />
                  <div className="h-5 bg-slate-200 rounded-md w-3/4 mb-2 mx-2" />
                  <div className="h-4 bg-slate-200 rounded-md w-full mx-2" />
                </div>
                <div className="bg-white rounded-full border border-[#EAEFF6] h-[44px]" />
              </div>
            ))}
          </div>
        ) : featuredListings.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-10 text-center shadow-xs">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0A6CFF] flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-[18px] font-extrabold text-[#0B1F3A] mb-2">
              No live inventory lots posted yet
            </h3>
            <p className="text-[14px] text-[#5B6B82] max-w-md mx-auto mb-6">
              New wholesale inventory from verified global suppliers is added continuously. Post what you need or submit a sell listing.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/requests"
                className="px-6 py-2.5 rounded-full bg-[#0A6CFF] text-white font-bold text-[14px] hover:bg-[#0857cf] transition shadow-xs"
              >
                Post Want to Buy Request
              </Link>
              <Link
                href="/marketplace"
                className="px-6 py-2.5 rounded-full bg-white border border-[#E3E9F2] text-[#0B1F3A] font-bold text-[14px] hover:bg-[#F3F6FB] transition"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        ) : (
          /* Horizontal Scroll-Snap Slider (4 cards visible on desktop, 24px gap) */
          <div
            ref={sliderRef}
            className="flex gap-[24px] overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none pb-4 -mx-1 px-1"
          >
            {featuredListings.map((item, index) => {
              const sellerName = item.company?.name || 'Vetted Global Seller';
              const sellerInitials = getSellerInitials(sellerName);
              const productImage = item.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

              // Visual badges matching the verified design
              const badge =
                index === 0
                  ? 'Verified stock'
                  : index === 1
                  ? 'New stock'
                  : index === 2
                  ? 'Verified stock'
                  : index === 3
                  ? 'Spotlight'
                  : item.is_hot
                  ? 'Hot deal ⚡'
                  : 'Verified stock';

              return (
                <div
                  key={item.id}
                  className="w-[280px] sm:w-[300px] lg:w-[calc(25%-18px)] shrink-0 snap-start flex flex-col gap-3"
                >
                  {/* Part 1: White product card (radius 28px, soft shadow) */}
                  <div className="bg-white rounded-[28px] border border-[#EAEFF6] shadow-[0_10px_30px_rgba(11,31,58,0.06)] p-[10px] flex flex-col justify-between flex-1">
                    <div>
                      {/* Photo with 20px radius inset 10px & blue badge */}
                      <Link
                        href={`/marketplace/${item.id}`}
                        className="relative h-[200px] w-full rounded-[20px] overflow-hidden bg-[#F3F6FB] mb-4 block group"
                      >
                        <Image
                          src={productImage}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 280px, 260px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="bg-[#0A6CFF] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                            {badge}
                          </span>
                        </div>
                      </Link>

                      {/* Title & Description */}
                      <div className="px-2">
                        <Link href={`/marketplace/${item.id}`} className="block group">
                          <h3 className="text-[18px] font-bold text-[#0B1F3A] leading-snug line-clamp-1 group-hover:text-[#0A6CFF] transition-colors">
                            {item.title}
                          </h3>
                        </Link>
                        <p className="text-[14px] text-[#5B6B82] mt-1.5 line-clamp-2 leading-relaxed min-h-[42px]">
                          {item.description}
                        </p>
                      </div>

                      {/* Light Divider */}
                      <div className="border-t border-[#EAEFF6] my-4 mx-2" />

                      {/* Price Row: Price (22px bold) + per piece on left, MOQ (17px bold blue) + MOQ on right */}
                      <div className="flex items-end justify-between px-2 mb-4">
                        <div>
                          <span className="text-[22px] font-extrabold text-[#0B1F3A] leading-none block">
                            €{item.unit_price.toFixed(2)}
                          </span>
                          <span className="text-[13px] text-[#5B6B82] mt-1 block">
                            per piece
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[17px] font-extrabold text-[#0A6CFF] leading-none block">
                            {item.moq} pcs
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
                      onClick={() => handleInquiryClick(item)}
                      className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                    >
                      Send inquiry
                    </button>
                  </div>

                  {/* Part 2: Slim white seller pill below the card */}
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
                      onClick={() => handleChatClick(item)}
                      aria-label={`Chat with ${sellerName}`}
                      className="w-8 h-8 rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0A6CFF] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inquiry Modal */}
      {selectedProduct && (
        <InquiryModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Auth Gate Modal when visitor is not logged in */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title="Verified Wholesale Access Required"
        subtitle="Sign in or create a free commercial account to view full lot specifications, unlock direct contact details, and send quotations or inquiries."
        redirectUrl="/marketplace"
      />
    </section>
  );
}
