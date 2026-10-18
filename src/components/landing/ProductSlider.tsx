'use client';

import React from 'react';
import Link from 'next/link';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { Package, Flame, ArrowRight } from 'lucide-react';

export function ProductSlider() {
  const [products, setProducts] = React.useState<any[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (isMounted && d.success && Array.isArray(d.products)) {
          setProducts(d.products);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (products.length === 0) return null;

  // Duplicate array to achieve seamless infinite marquee loop
  const displayProducts = [...products, ...products];

  return (
    <section className="py-12 bg-slate-900 border-y border-slate-800 overflow-hidden relative">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[#00D2FF] animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Live Verified Wholesale Exchange Inventory
          </h3>
        </div>
        <Link
          href="/marketplace"
          className="text-xs font-semibold text-[#00D2FF] hover:text-white flex items-center gap-1 transition"
        >
          <span>View All 1,000+ Listings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Marquee Track */}
      <div className="flex w-full overflow-hidden mask-fade">
        <div className="animate-marquee flex gap-4 pl-4">
          {displayProducts.map((product, idx) => (
            <Link
              key={`${product.id}-${idx}`}
              href={`/marketplace/${product.id}`}
              className="w-72 shrink-0 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00D2FF]/50 rounded-xl overflow-hidden shadow-lg transition-all transform hover:-translate-y-1 group flex flex-col"
            >
              {/* Image & Badges */}
              <div className="relative h-40 bg-slate-950 overflow-hidden">
                <img
                  src={product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
                {product.is_hot && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-[#0B132B]/90 border border-[#00D2FF] text-[#00D2FF] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full glow-cyan">
                    <Flame className="w-3 h-3 text-[#00D2FF]" />
                    <span>HOT ⚡</span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 font-mono text-[10px] bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  EAN {product.barcode_or_sku}
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
                    {product.category_slug.replace('-', ' ')}
                  </span>
                  <h4 className="text-xs font-semibold text-white line-clamp-2 mt-1 leading-snug">
                    {product.title}
                  </h4>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Package className="w-3 h-3 text-slate-500" />
                    <span>MOQ {product.moq}u</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block -mb-0.5">Wholesale</span>
                    <span className="text-sm font-extrabold text-[#00D2FF]">
                      €{product.unit_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
