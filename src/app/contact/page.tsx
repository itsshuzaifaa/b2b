'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { addCustomerQuery } from '@/lib/admin/admin-store';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    topic: 'verification',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: formData.name.trim(),
      company: formData.company.trim(),
      email: formData.email.trim(),
      topic: formData.topic,
      message: formData.message.trim(),
    };

    try {
      // 1. Send to server API endpoint for cross-session/database persistence & email alerts
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn('Server contact API returned non-200, falling back to local store');
      }
    } catch (err) {
      console.warn('Network error posting to /api/contact, using local store', err);
    }

    // 2. Also register in local admin store for instant client reflection
    try {
      addCustomerQuery(payload);
    } catch (storeErr) {
      console.warn('Error saving to local admin store', storeErr);
    }

    setIsSubmitting(false);
    setSubmitted(true);
  };

  const faqs = [
    {
      q: 'How quickly does the compliance desk review new seller accounts?',
      a: 'All seller accounts undergo manual verification by Jeff, our Vetting Director. We check your European VAT registration, Commercial Registry records, and warehouse capability within 24 hours of submission.',
    },
    {
      q: 'Can I pay membership fees via direct bank transfer or Wise?',
      a: 'Yes. We provide official Estonian Wise Business proforma invoices with dedicated IBANs in GBP, EUR, and USD for instant clearing and corporate accounting records.',
    },
    {
      q: 'Do you charge any commission on transactions initiated through the desk?',
      a: 'Zero percent (0%). B2B LINK OÜ operates purely as an information and vetting network. Counterparties transact directly without intermediary escrow markups.',
    },
    {
      q: 'How do I submit bulk CSV manifests for catalogue listing?',
      a: 'Active Silver and Gold members can upload bulk CSV catalogs straight from the seller dashboard, or email manifests directly to jeff@b2blink.com for automated ingestion.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex flex-col">
      {/* 1. Header Hero Banner */}
      <section className="relative text-white pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-20 overflow-hidden rounded-b-[32px] lg:rounded-b-[48px] bg-[#0B1F3A] shadow-xl">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-warehouse.jpg"
            alt="European Logistics Support"
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
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#00C2FF] mb-3">
              DIRECT TRADER SUPPORT
            </div>
            <h1 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold tracking-[-0.025em] text-white">
              Speak with Our European Wholesale Desk
            </h1>
            <p className="mt-3 text-[15px] sm:text-[16px] text-[#D3DEEE] leading-relaxed max-w-2xl font-normal">
              Direct compliance review, seller vetting inquiries, and proforma settlement assistance for European commercial counterparties.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Main Contact Grid (Two Columns) */}
      <section className="py-[72px] lg:py-[104px]">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Entity Credentials & Desk Details (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Primary Compliance Desk Card */}
              <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-7 sm:p-8 shadow-[0_10px_30px_rgba(11,31,58,0.06)] space-y-6">
                <div>
                  <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2">
                    DIRECT CONTACT
                  </span>
                  <h3 className="text-[20px] font-bold text-[#0B1F3A]">
                    European Verification Desk
                  </h3>
                  <p className="text-[14px] text-[#5B6B82] mt-1.5 leading-relaxed">
                    Have inquiries regarding seller verification, bulk pallet clearance, or Wise subscription settlement? Reach our compliance officers directly.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Email */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center text-[#0A6CFF] shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#5B6B82]">Compliance & Vetting</div>
                      <a
                        href="mailto:jeff@b2blink.com"
                        className="text-[15px] font-bold text-[#0B1F3A] hover:text-[#0A6CFF] transition-colors"
                      >
                        jeff@b2blink.com
                      </a>
                    </div>
                  </div>

                  {/* Registered Entity */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center text-[#0A6CFF] shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#5B6B82]">Registered Entity</div>
                      <div className="text-[15px] font-bold text-[#0B1F3A]">
                        B2B LINK OÜ
                      </div>
                      <div className="text-[13px] text-[#5B6B82] mt-0.5">
                        Registry Code: EE-10293845
                      </div>
                    </div>
                  </div>

                  {/* Physical Address */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center text-[#0A6CFF] shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#5B6B82]">Corporate Headquarters</div>
                      <div className="text-[14px] text-[#41536D] leading-relaxed">
                        Sepapaja 6, Tallinn 15551, Harjumaa, Estonia
                      </div>
                    </div>
                  </div>

                  {/* Office Hours */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center text-[#0A6CFF] shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#5B6B82]">Operating Desk Hours</div>
                      <div className="text-[14px] text-[#41536D]">
                        Mon – Fri, 08:00 – 18:00 EET (Tallinn)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Callout Banner */}
              <div className="bg-[#0B1F3A] text-white rounded-[28px] p-7 shadow-lg space-y-4">
                <div className="flex items-center gap-2 text-[#00C2FF] text-[13px] font-bold uppercase tracking-[0.12em]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified EU Standards</span>
                </div>
                <h4 className="text-[18px] font-bold text-white">
                  Direct Trade Safeguards
                </h4>
                <ul className="space-y-2.5 text-[14px] text-[#D3DEEE]">
                  <li className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]" />
                    <span>Every seller reviewed manually within 24 hours</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]" />
                    <span>0% transaction fees on all concluded deals</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]" />
                    <span>Full VAT & company registration verification</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Desk Inquiry Form (7 cols) */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-[28px] border border-[#EAEFF6] p-7 sm:p-10 shadow-[0_10px_30px_rgba(11,31,58,0.06)]">
                {submitted ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-[22px] font-bold text-[#0B1F3A]">
                      Inquiry Received by Jeff
                    </h3>
                    <p className="text-[15px] text-[#5B6B82] max-w-md mx-auto leading-relaxed">
                      Thank you for contacting the compliance desk. A trade verification officer will review your message and reply to <strong className="text-[#0B1F3A]">{formData.email}</strong> within 1 business day.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({ name: '', company: '', email: '', topic: 'verification', message: '' });
                      }}
                      className="mt-4 inline-flex items-center justify-center min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] transition-colors shadow-xs"
                    >
                      Send Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-1">
                        DESK TRANSMISSION
                      </span>
                      <h3 className="text-[22px] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
                        Send a Desk Inquiry
                      </h3>
                      <p className="text-[14px] text-[#5B6B82] mt-1">
                        Transmit your questions directly to our Tallinn compliance officers.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                          Your Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-3 text-[14px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-[#F3F6FB] text-[#0B1F3A] transition"
                          placeholder="Jeff Miller"
                        />
                      </div>

                      {/* Company Name */}
                      <div>
                        <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                          Company Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full px-4 py-3 text-[14px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-[#F3F6FB] text-[#0B1F3A] transition"
                          placeholder="European Wholesale Ltd"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Corporate Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 text-[14px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-[#F3F6FB] text-[#0B1F3A] transition"
                        placeholder="trader@company.eu"
                      />
                    </div>

                    {/* Topic */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Inquiry Topic
                      </label>
                      <select
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        className="w-full px-4 py-3 text-[14px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-[#F3F6FB] text-[#0B1F3A] transition font-medium"
                      >
                        <option value="verification">Seller Verification & Vetting</option>
                        <option value="membership">Membership Subscription & Wise Settlement</option>
                        <option value="sourcing">Want-To-Buy Sourcing Assistance</option>
                        <option value="listing">Bulk Stock Manifest Ingestion</option>
                        <option value="other">General Network Inquiry</option>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                        Message Details
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-4 py-3 text-[14px] border border-[#E3E9F2] rounded-xl focus:outline-none focus:border-[#0A6CFF] bg-[#F3F6FB] text-[#0B1F3A] transition"
                        placeholder="Please include details about your product lots, required documentation, or subscription inquiries..."
                      />
                    </div>

                    {/* Submit Pill Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] disabled:opacity-60 text-white font-bold text-[15px] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Transmitting to Desk...</span>
                        </div>
                      ) : (
                        <span>Transmit to Compliance Desk</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Common Trade Support Questions (White Background) */}
      <section className="bg-white py-[72px] lg:py-[104px]">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#0A6CFF] block mb-2.5">
              FREQUENTLY ASKED
            </span>
            <h2 className="text-[32px] lg:text-[42px] leading-[1.1] font-extrabold text-[#0B1F3A] tracking-[-0.025em]">
              Support & Network Answers
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-3.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-[#EAEFF6] shadow-2xs overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-bold text-[16px] text-[#0B1F3A] hover:text-[#0A6CFF] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-[#5B6B82] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#0A6CFF]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-[14px] text-[#41536D] leading-relaxed border-t border-[#EAEFF6]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Closing CTA Banner (80% Navy Banner) */}
      <section className="bg-[#F3F6FB] py-[72px] lg:py-[104px]">
        <div className="w-[92%] sm:w-[85%] lg:w-[80%] max-w-[1160px] mx-auto p-9 sm:p-14 lg:p-16 rounded-[40px] bg-[#0B1F3A] text-white text-center shadow-2xl relative overflow-hidden">
          <h2 className="text-[32px] lg:text-[46px] leading-[1.1] font-extrabold text-white tracking-[-0.025em] mb-4">
            Ready to trade directly?
          </h2>
          <p className="text-[15px] sm:text-[16px] text-[#D3DEEE] max-w-xl mx-auto mb-9 leading-relaxed">
            Join the network in minutes. Our desk reviews every seller within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register?role=seller"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors shadow-xs"
            >
              Register as a seller
            </Link>
            <Link
              href="/marketplace"
              className="w-full sm:w-auto min-h-[48px] px-8 rounded-full border-2 border-white/80 hover:bg-white/10 text-white font-bold text-[15px] inline-flex items-center justify-center transition-colors"
            >
              Browse listings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
