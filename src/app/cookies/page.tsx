'use client';

import React from 'react';
import Link from 'next/link';
import {
  Cookie,
  ShieldCheck,
  Lock,
  Sliders,
  CheckCircle2,
  Mail,
  Building2,
  Globe2,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { openCookiePreferences } from '@/lib/cookies/consent';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] pt-28 sm:pt-32 lg:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb / Top Meta */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[13px] text-[#5B6B82]">
            <Link href="/" className="hover:text-[#0A6CFF] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#0B1F3A] font-semibold">Cookie Policy</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3FF] border border-[#BFDBFE] text-[#0A6CFF] text-[12px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated: October 2026</span>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_12px_40px_rgba(11,31,58,0.06)] p-6 sm:p-10 md:p-14 space-y-10 text-[#334155] leading-relaxed">
          {/* Header Title */}
          <div className="border-b border-slate-100 pb-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A6CFF]/10 text-[#0A6CFF] flex items-center justify-center font-bold">
                <Cookie className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0A6CFF]">
                  B2B LINK OÜ &bull; Legal Specification
                </span>
                <h1 className="text-[28px] sm:text-[36px] font-black text-[#0B1F3A] tracking-tight leading-tight">
                  Cookie Policy
                </h1>
              </div>
            </div>

            <p className="text-[15px] sm:text-[16px] text-[#475569] leading-relaxed pt-2">
              This Cookie Policy explains how <strong>B2B LINK OÜ</strong> (&ldquo;B2B LINK&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) uses cookies and similar technologies when you visit or use the B2B LINK website and platform. This policy should be read together with our Privacy Policy.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                1
              </span>
              <span>What Are Cookies?</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Cookies are small text files stored on your computer, mobile device or other device when you visit a website. They help websites function correctly, remember preferences, maintain secure sessions and understand how visitors use a website. Similar technologies, such as local storage or device identifiers, may also be used for similar purposes.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                2
              </span>
              <span>How B2B LINK Uses Cookies</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may use cookies and similar technologies to keep the website and platform secure, allow members to log in and remain signed in, remember user preferences, maintain account and session functionality, improve website performance, understand how users interact with the platform, identify technical problems, measure website usage and performance, and support optional analytics or third-party services where enabled.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9 font-medium text-[#0B1F3A]">
              We aim to use only the cookies necessary to operate and improve the B2B LINK platform.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                3
              </span>
              <span>Types of Cookies We May Use</span>
            </h2>

            <div className="pl-9 space-y-4">
              {/* Strictly Necessary */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold text-[#0B1F3A]">Strictly Necessary Cookies</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
                    Always Active
                  </span>
                </div>
                <p className="text-[13.5px] text-[#475569]">
                  These cookies are required for the website and platform to function properly. They may be used for user authentication, account login, security, session management, fraud prevention, saving cookie preferences and maintaining essential platform functions. These cookies cannot normally be disabled through our cookie preference tool because the website may not function correctly without them.
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2">
                <h3 className="text-[15px] font-bold text-[#0B1F3A]">Functional Cookies</h3>
                <p className="text-[13.5px] text-[#475569]">
                  Functional cookies help remember choices you make when using B2B LINK, such as language, display settings, account preferences and previously selected options. Where required by applicable law, these cookies will only be used with your consent.
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2">
                <h3 className="text-[15px] font-bold text-[#0B1F3A]">Analytics Cookies</h3>
                <p className="text-[13.5px] text-[#475569]">
                  Analytics cookies help us understand how visitors use the B2B LINK website and platform, including which pages are visited most often, how users navigate the website, how long visitors spend on certain pages, whether users experience technical errors and which features are being used. Analytics cookies that are not strictly necessary will only be activated where the required consent has been provided.
                </p>
              </div>

              {/* Marketing Cookies */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2">
                <h3 className="text-[15px] font-bold text-[#0B1F3A]">Marketing Cookies</h3>
                <p className="text-[13.5px] text-[#475569]">
                  If B2B LINK uses advertising or marketing technologies in the future, these cookies may help measure campaigns or display more relevant advertising. B2B LINK will not activate non-essential marketing cookies without the appropriate consent where consent is required.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                4
              </span>
              <span>First-Party and Third-Party Cookies</span>
            </h2>
            <div className="text-[14.5px] text-[#475569] leading-relaxed pl-9 space-y-2">
              <p>
                Some cookies may be placed directly by B2B LINK. These are known as <strong>first-party cookies</strong>. Other cookies may be placed by third-party services that B2B LINK uses, for example website analytics providers, authentication providers, hosting and infrastructure providers, security services or customer support tools. These are known as <strong>third-party cookies</strong>.
              </p>
              <p>
                Where third-party services use cookies or similar technologies, their own privacy and cookie policies may also apply.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                5
              </span>
              <span>Cookie Consent</span>
            </h2>
            <div className="text-[14.5px] text-[#475569] leading-relaxed pl-9 space-y-3">
              <p>
                When required by applicable law, B2B LINK will ask for your consent before placing non-essential cookies or similar technologies on your device.
              </p>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold text-[#0B1F3A]">Consent choices provided:</span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[12px] font-semibold text-[#0B1F3A]">Accept All</span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[12px] font-semibold text-[#0B1F3A]">Reject Non-Essential</span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[12px] font-semibold text-[#0B1F3A]">Manage Preferences</span>
              </div>
              <p className="text-[13.5px] text-[#64748B]">
                Strictly necessary cookies may be used without consent where they are required to provide the website or service requested by the user. Continuing to browse should not be treated as consent to non-essential cookies.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                6
              </span>
              <span>Changing Your Cookie Preferences</span>
            </h2>
            <div className="text-[14.5px] text-[#475569] leading-relaxed pl-9 space-y-4">
              <p>
                You can change your cookie preferences at any time using the <strong>Cookie Settings</strong> option on the B2B LINK website.
              </p>

              {/* Direct interactive action button */}
              <div>
                <button
                  type="button"
                  onClick={openCookiePreferences}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition shadow-xs cursor-pointer"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Open Cookie Settings Panel</span>
                </button>
              </div>

              <p className="text-[13.5px] text-[#64748B]">
                You may also control or delete cookies through your browser settings. Most browsers allow you to delete existing cookies, block cookies, allow cookies, block third-party cookies, or clear cookies when the browser closes.
              </p>
              <p className="text-[13px] text-[#64748B] italic">
                Please note that disabling certain cookies may affect the operation of the website or prevent some features from working correctly.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                7
              </span>
              <span>How Long Cookies Are Stored</span>
            </h2>
            <div className="text-[14.5px] text-[#475569] leading-relaxed pl-9 space-y-2">
              <p>
                Some cookies are temporary and are deleted when you close your browser. These are known as <strong>session cookies</strong>. Other cookies remain on your device for a defined period or until you delete them. These are known as <strong>persistent cookies</strong>.
              </p>
              <p>
                The storage period depends on the purpose of the cookie. B2B LINK will aim to retain cookies only for as long as reasonably necessary for their intended purpose.
              </p>
            </div>
          </section>

          {/* Section 8: Cookie List Table */}
          <section className="space-y-4">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                8
              </span>
              <span>Cookie List</span>
            </h2>
            <div className="pl-9 space-y-3">
              <p className="text-[14.5px] text-[#475569]">
                B2B LINK maintains a current list of cookies and storage identifiers used across our wholesale trading network:
              </p>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-[#0B1F3A] text-white">
                      <th className="py-3 px-4 font-bold">Cookie Name</th>
                      <th className="py-3 px-4 font-bold">Provider</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Duration</th>
                      <th className="py-3 px-4 font-bold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[#334155]">
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0A6CFF]">sb-*-auth-token</td>
                      <td className="py-3 px-4">B2B LINK (Supabase)</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">Strictly Necessary</span></td>
                      <td className="py-3 px-4">1 year / Session</td>
                      <td className="py-3 px-4">Maintains authenticated user session and account security.</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0A6CFF]">b2b_cookie_consent</td>
                      <td className="py-3 px-4">B2B LINK</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">Strictly Necessary</span></td>
                      <td className="py-3 px-4">1 year</td>
                      <td className="py-3 px-4">Remembers user cookie consent and privacy choices.</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0A6CFF]">b2b_live_inquiries_*</td>
                      <td className="py-3 px-4">B2B LINK (Local)</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">Functional</span></td>
                      <td className="py-3 px-4">Persistent</td>
                      <td className="py-3 px-4">Local browser storage for instant trade message loading without lag.</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0A6CFF]">_ga, _ga_*</td>
                      <td className="py-3 px-4">Google Analytics</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">Analytics</span></td>
                      <td className="py-3 px-4">2 years</td>
                      <td className="py-3 px-4">Measures site performance and usage (only active with consent).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                9
              </span>
              <span>Personal Data and Cookies</span>
            </h2>
            <div className="text-[14.5px] text-[#475569] leading-relaxed pl-9 space-y-2">
              <p>
                Some cookies or similar technologies may involve the processing of personal data. Where this occurs, B2B LINK will process personal data in accordance with our Privacy Policy and applicable data protection law.
              </p>
              <p>
                Information collected through cookies will not be used for purposes that are incompatible with those described when the information was collected.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                10
              </span>
              <span>Changes to This Cookie Policy</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              We may update this Cookie Policy from time to time to reflect changes to the B2B LINK platform, the cookies or technologies we use, third-party services, or applicable legal and regulatory requirements. The latest version will always be published on the B2B LINK website. The <strong>Last updated</strong> date at the top of this policy will show when it was most recently revised.
            </p>
          </section>

          {/* Section 11: Contact Us */}
          <section className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                11
              </span>
              <span>Contact Us</span>
            </h2>
            <div className="pl-9 space-y-3">
              <p className="text-[14.5px] text-[#475569]">
                If you have any questions about this Cookie Policy or how B2B LINK uses cookies, please contact:
              </p>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-2.5 text-[14px]">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span><strong>Company:</strong> B2B LINK OÜ</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe2 className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span><strong>Country:</strong> Estonia</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                  <span>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:support@b2blink.eu" className="text-[#0A6CFF] hover:underline font-semibold">
                      support@b2blink.eu
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
