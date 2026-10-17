'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_CATEGORIES } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth/auth-context';
import { startMarketplaceInquiry } from '@/lib/messaging/messaging-store';
import type { Product } from '@/types/database';
import {
  Search,
  Flame,
  Package,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  X,
  Send,
  ArrowRight,
  Lock,
} from 'lucide-react';

export default function DashboardMarketplacePage() {
  const router = useRouter();
  const { company, isLoggedIn } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHotOnly, setShowHotOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_low' | 'price_high' | 'moq_low'>('featured');

  // Direct Message Modal state (Facebook Marketplace style)
  const [activeMessageProduct, setActiveMessageProduct] = useState<Product | null>(null);
  const [buyerName, setBuyerName] = useState(company?.contact_name || '');
  const [buyerEmail, setBuyerEmail] = useState(company?.email || '');
  const [buyerPhone, setBuyerPhone] = useState(company?.phone || '');
  const [messageText, setMessageText] = useState('Hi, is this wholesale lot still available? Can you confirm lead times?');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messageSentSuccess, setMessageSentSuccess] = useState(false);
  const [sentConversationId, setSentConversationId] = useState<string | null>(null);

  // Sync auth details when company changes
  useEffect(() => {
    if (company) {
      if (company.contact_name) setBuyerName(company.contact_name);
      if (company.email) setBuyerEmail(company.email);
      if (company.phone) setBuyerPhone(company.phone);
    }
  }, [company]);

  // Load real products
  useEffect(() => {
    let isMounted = true;
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        let baseProducts: Product[] = [];
        if (data.success && Array.isArray(data.products)) {
          baseProducts = data.products;
        }
        // Merge any locally added seller products if not yet returned from API
        try {
          localStorage.removeItem('b2b_seller_listings_real_v2');
          const raw = localStorage.getItem('b2b_seller_listings_v3');
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
                    } : undefined,
                  } as Product);
                }
              });
            }
          }
        } catch {}
        setProducts(baseProducts);
      })
      .catch((err) => console.warn('[DASHBOARD MARKETPLACE LOAD ERROR]', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [company]);

  // Filtered products list matching website marketplace
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        prod.title.toLowerCase().includes(query) ||
        prod.category_slug.toLowerCase().includes(query) ||
        (prod.barcode_or_sku && prod.barcode_or_sku.toLowerCase().includes(query)) ||
        (prod.description && prod.description.toLowerCase().includes(query)) ||
        (prod.company?.name && prod.company.name.toLowerCase().includes(query));

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

  // Requirement 02: One-click chat without filling any fields
  const handleQuickChat = (product: Product) => {
    const defaultMsg = `Hi, I have a question regarding this product: ${product.title}.`;
    const conv = startMarketplaceInquiry(
      product,
      company,
      buyerName || company?.contact_name || 'Buyer',
      buyerEmail || company?.email || '',
      buyerPhone || company?.phone || '',
      defaultMsg
    );
    router.push(`/dashboard/inquiries?id=${conv.id}`);
  };

  const handleOpenMessage = (product: Product) => {
    setActiveMessageProduct(product);
    setMessageSentSuccess(false);
    setMessageText('Hi, is this wholesale lot still available? Can you confirm delivery to our warehouse?');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMessageProduct) return;
    if (!messageText.trim()) return;

    setSendingMsg(true);

    try {
      const conv = startMarketplaceInquiry(
        activeMessageProduct,
        company,
        buyerName || company?.contact_name || 'Verified Buyer',
        buyerEmail || company?.email || '',
        buyerPhone || company?.phone || '',
        messageText
      );

      setSentConversationId(conv.id);
      setMessageSentSuccess(true);
      setTimeout(() => {
        setSendingMsg(false);
      }, 500);
    } catch {
      setSendingMsg(false);
    }
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
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Marketplace
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Browse verified wholesale inventory lots across Europe. Connect & inquire directly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHotOnly(!showHotOnly)}
            className={`text-[13px] font-bold px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
              showHotOnly
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Hot Lots Only</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="mt-6 mb-7 space-y-4">
        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All Categories ({products.length})
          </button>
          {MOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, EAN barcodes, or suppliers..."
              className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
            />
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#8A9BB0]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-[13px] font-semibold bg-white border border-[#EAEFF6] rounded-xl text-[#0B1F3A] focus:outline-none focus:border-[#0A6CFF]"
            >
              <option value="featured">Featured / Hot</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="moq_low">Lowest MOQ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-12 text-center my-8">
          <div className="w-16 h-16 rounded-full bg-[#F3F6FB] flex items-center justify-center mx-auto mb-4 text-[#5B6B82]">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-[18px] font-bold text-[#0B1F3A]">No matching wholesale lots found</h3>
          <p className="text-[14px] text-[#5B6B82] mt-1">
            Try adjusting your search terms or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const sellerName = product.company?.name || 'Verified European Seller';
            const sellerInitials = getSellerInitials(sellerName);
            const productImage = product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

            return (
              <div
                key={product.id}
                className="bg-white rounded-[24px] border border-[#EAEFF6] p-4 shadow-[0_4px_20px_rgba(11,31,58,0.03)] hover:shadow-[0_12px_32px_rgba(11,31,58,0.08)] hover:border-[#D0E2FF] transition flex flex-col justify-between group"
              >
                <div>
                  {/* Image Container with Badges */}
                  <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#F3F6FB] mb-3.5">
                    <Image
                      src={productImage}
                      alt={product.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      {product.is_hot && (
                        <span className="bg-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <Flame className="w-3 h-3" />
                          <span>HOT</span>
                        </span>
                      )}
                      <span className="bg-[#0A6CFF] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                        Verified Lot
                      </span>
                    </div>
                  </div>

                  {/* Title & EAN */}
                  <h3 className="text-[16px] font-bold text-[#0B1F3A] leading-snug line-clamp-1 group-hover:text-[#0A6CFF] transition">
                    {product.title}
                  </h3>
                  {product.barcode_or_sku && (
                    <p className="text-[11px] text-[#8A9BB0] font-mono mt-0.5">
                      EAN {product.barcode_or_sku}
                    </p>
                  )}

                  <p className="text-[13px] text-[#5B6B82] mt-1.5 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Bottom Card Footer */}
                <div className="mt-4 pt-3.5 border-t border-[#F8FAFC]">
                  {/* Seller Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {sellerInitials}
                      </div>
                      <span className="text-[12px] font-semibold text-[#0B1F3A] truncate">
                        {sellerName}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Vetted</span>
                    </span>
                  </div>

                  {/* Price, MOQ, and Action Row */}
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[20px] font-extrabold text-[#0B1F3A] leading-none">
                        £{product.unit_price.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-[#8A9BB0] mt-1">
                        MOQ: <strong className="text-[#0A6CFF] font-bold">{product.moq} pcs</strong> ·{' '}
                        <span>{product.quantity_available.toLocaleString()} avail</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickChat(product)}
                        title="Quick direct question (no forms)"
                        className="w-9 h-9 rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0A6CFF] flex items-center justify-center transition cursor-pointer shrink-0"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenMessage(product)}
                        className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[13px] px-4 py-2 rounded-full flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                      >
                        <span>Inquire</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIRECT IN-APP MESSAGING MODAL (FACEBOOK MARKETPLACE STYLE) */}
      {activeMessageProduct && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <Image
                    src={activeMessageProduct.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                    alt={activeMessageProduct.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#0B1F3A] line-clamp-1">
                    {activeMessageProduct.title}
                  </h3>
                  <p className="text-[12px] text-[#5B6B82]">
                    Seller: <strong className="text-[#0B1F3A]">{activeMessageProduct.company?.name || 'Nordic Electro Wholesale Ltd'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveMessageProduct(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {messageSentSuccess ? (
              <div className="py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3.5">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-[18px] font-bold text-[#0B1F3A]">Message Sent!</h4>
                <p className="text-[13px] text-[#5B6B82] mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Your inquiry has been placed into the seller’s live inbox. You can continue chatting directly inside <strong>Buyer Inquiries</strong>.
                </p>
                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cid = sentConversationId;
                      setActiveMessageProduct(null);
                      router.push(cid ? `/dashboard/inquiries?id=${cid}` : '/dashboard/inquiries');
                    }}
                    className="w-full py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span>Open In-App Chat Inbox</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMessageProduct(null)}
                    className="w-full py-2.5 text-[#5B6B82] hover:text-[#0B1F3A] font-semibold text-[13px] cursor-pointer"
                  >
                    Continue Browsing
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="py-5 space-y-4">
                {/* Price and MOQ reminder */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Unit Price</span>
                    <p className="text-[17px] font-extrabold text-[#0B1F3A]">
                      £{activeMessageProduct.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Min Order</span>
                    <p className="text-[14px] font-bold text-[#0A6CFF]">
                      {activeMessageProduct.moq} pcs MOQ
                    </p>
                  </div>
                </div>

                {/* Quick Prompts (Facebook Marketplace Style) */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0] block mb-2">
                    Quick Messages
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Hi, is this still available?',
                      'What is the lead time to our warehouse?',
                      'Can you do a bulk discount for full pallet?',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setMessageText(prompt)}
                        className="text-[12px] font-semibold bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#41536D] px-3 py-1.5 rounded-full transition cursor-pointer text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#8A9BB0] mb-1.5">
                    Your Message to Seller
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] border border-[#EAEFF6] rounded-2xl focus:outline-none focus:border-[#0A6CFF] font-medium resize-none leading-relaxed"
                  />
                </div>

                {/* Sender Contact Details */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="e.g. Marcus Wright"
                      className="w-full px-3.5 py-2 text-[13px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#8A9BB0] mb-1">
                      Corporate Email
                    </label>
                    <input
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="buyer@company.eu"
                      className="w-full px-3.5 py-2 text-[13px] border border-[#EAEFF6] rounded-xl focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-3 flex gap-3">
                  <button
                    type="submit"
                    disabled={sendingMsg}
                    className="flex-1 py-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sendingMsg ? 'Sending...' : 'Send Message to Seller'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMessageProduct(null)}
                    className="py-3 px-5 rounded-full bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] font-bold text-[14px] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
