'use client';

import React, { useState } from 'react';
import { Mail, MapPin, CheckCircle2, Send, Building2 } from 'lucide-react';

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Info */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0066FF] text-xs font-bold uppercase tracking-wider mb-4">
              <Mail className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Direct Trader Support</span>
            </div>
            <h2 className="text-3xl font-extrabold text-[#0B132B] tracking-tight">
              Speak with Our Global Wholesale Desk
            </h2>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-lg">
              Have specific inquiry about bulk pallet clearance, international compliance documentation, or seller verification status? Contact Jeff and our compliance team directly.
            </p>

            <div className="mt-8 space-y-4 text-xs text-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#0066FF]">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Direct Compliance Desk</div>
                  <a href="mailto:jeff@b2blink.com" className="text-slate-500 hover:text-[#0066FF]">
                    jeff@b2blink.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#0066FF]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Registered Entity</div>
                  <div className="text-slate-500">B2B LINK OÜ &bull; Reg. EE-10293849</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#0066FF]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Headquarters</div>
                  <div className="text-slate-500">Sepapaja 6, Tallinn 15551, Harjumaa, Estonia</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Message Received by Jeff</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you for reaching out. A trade officer will review your message and reply within 1 business day.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-3 text-xs font-semibold text-[#0066FF] hover:underline"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Send a Desk Inquiry</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] bg-white"
                    placeholder="Global Goods Trading Ltd"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] bg-white"
                    placeholder="trader@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry / Topic</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] bg-white"
                    placeholder="Questions regarding Gold membership, bulk pallet lists, or tax clearance..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#0066FF] hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmit to Verification Desk</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
