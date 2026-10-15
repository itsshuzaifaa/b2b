'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleProductHot } from '@/lib/actions/admin';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import type { Product } from '@/types/database';
import { ArrowLeft, Flame, CheckCircle2 } from 'lucide-react';

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleToggleHot = async (productId: string, currentHot: boolean) => {
    try {
      const res = await toggleProductHot(productId, !currentHot);
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, is_hot: !currentHot } : p))
        );
        setFeedback(`Product ${!currentHot ? 'promoted to HOT ⚡ status' : 'removed from Hot spotlight'}`);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    } catch {
      setFeedback('Failed to update product status.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push('/admin')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0066FF] mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Control Center</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#0B132B] px-8 py-6 text-white border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
                Catalog Moderation
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1 text-white">Product & Hot Listing Placement</h1>
              <p className="text-xs text-slate-400 mt-1">
                Spotlight high-demand inventory with glowing badges and homepage marquee placement.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          {feedback && (
            <div className="p-4 bg-blue-50 border-b border-blue-200 text-xs font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0066FF]" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Product Listing & EAN</th>
                  <th className="px-4 py-4">Seller Company</th>
                  <th className="px-4 py-4">Wholesale Price</th>
                  <th className="px-4 py-4">Current Badge</th>
                  <th className="px-6 py-4 text-right">Hot Status Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.title}</div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                        EAN {p.barcode_or_sku}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {p.company?.name || 'Verified Wholesaler'}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#16a34a]">£{p.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      {p.is_hot ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00D2FF] bg-[#0B132B] px-2.5 py-0.5 rounded-full border border-[#00D2FF]">
                          <Flame className="w-3 h-3" />
                          <span>HOT ⚡</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Regular</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleHot(p.id, p.is_hot)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                          p.is_hot
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            : 'bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200'
                        }`}
                      >
                        {p.is_hot ? 'Remove Hot Badge' : '⚡ Make Hot Listing'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
