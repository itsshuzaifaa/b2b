'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does seller vetting and account activation work?',
      a: 'To safeguard our network from brokers and counterfeit lots, all sellers undergo manual compliance review by Jeff, our Vetting Director. We cross-reference your European VAT registration, Companies House / Commercial Registry records, and warehouse capability. Once you complete your initial Wise membership payment, your account is activated within 24 hours.',
    },
    {
      q: 'Do you take any transaction fees or commissions on wholesale trades?',
      a: 'Zero percent (0%). B2B LINK OÜ operates strictly as an information exchange board. Buyers and sellers transact directly via proforma invoice, escrow, or standard trade credit without any intermediary transaction cuts or escrow deductions from our platform.',
    },
    {
      q: 'How does Wise payment settlement work for seller subscriptions?',
      a: 'Upon registering as a Silver or Gold seller, your dashboard provides our verified Estonian entity Wise Business IBAN and reference code. You can transfer funds directly in GBP, EUR, or USD with near-instant clearing. Once Jeff marks your payment as received, your publishing and CSV tools unlock automatically.',
    },
    {
      q: 'Why are there monthly quotation quotas on WTB requests?',
      a: 'Quotas (10 for Bronze, 25 for Silver, 50 for Gold) ensure buyers receive high-quality, genuine commercial offers rather than automated spam from unverified drop-shippers. This maintains high buyer engagement and higher deal conversion rates across the board.',
    },
    {
      q: 'Can buyers use the platform for free?',
      a: 'Yes! Commercial retail buyers, procurement managers, and e-commerce sellers can create a free account, browse verified wholesale inventory, send unlimited product inquiries, and post Want-To-Buy requests at zero cost.',
    },
    {
      q: 'How does EAN and barcode automated matching work?',
      a: 'When a buyer submits a WTB request specifying a GTIN/EAN barcode or SKU, our database automatically queries all active seller inventory. Sellers holding that exact barcode receive an instant High-Priority notification email, giving them first-mover advantage to quote the order.',
    },
  ];

  return (
    <section id="faqs" className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0066FF] text-xs font-bold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5 text-[#00D2FF]" />
            <span>Platform Answers</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#0B132B] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Everything you need to know about trading on Europe&apos;s verified wholesale network.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#0B132B] hover:text-[#0066FF] transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#0066FF]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
