'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  Clock,
  Building2,
  Mail,
  Scale,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
} from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <span className="text-[#0B1F3A] font-semibold">Privacy Policy</span>
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
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0A6CFF]">
                  B2B LINK OÜ &bull; Data Protection Specification
                </span>
                <h1 className="text-[28px] sm:text-[36px] font-black text-[#0B1F3A] tracking-tight leading-tight">
                  B2B LINK Privacy Policy
                </h1>
              </div>
            </div>

            <p className="text-[15px] sm:text-[16px] text-[#475569] leading-relaxed pt-2">
              This Privacy Policy explains how <strong>B2B LINK OÜ</strong> (&ldquo;B2B LINK&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) collects, uses, stores, shares and protects personal data when you visit or use the B2B LINK website, platform and related services.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed">
              B2B LINK is a business-to-business platform. Where B2B LINK determines the purposes and means of processing personal data, B2B LINK acts as the data controller.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                1
              </span>
              <span>Who This Policy Applies To</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              This Privacy Policy applies to visitors to the B2B LINK website, applicants for membership, registered members, employees or representatives of member businesses, and individuals who contact B2B LINK.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                2
              </span>
              <span>Personal Data We May Collect</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Depending on how you use B2B LINK, we may collect and process the following categories of information:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-2 text-[14px] text-[#475569]">
              <li><strong>Account and contact information:</strong> name, job title, company name, business email address, telephone number, country, website and login details.</li>
              <li><strong>Company and verification information:</strong> company registration number, VAT number where applicable, registered address, company status, domain details and verification information.</li>
              <li><strong>Bank account verification information:</strong> where required for member verification.</li>
              <li><strong>Membership and billing information:</strong> membership level, billing details, VAT information, payment status, transaction references and renewal information.</li>
              <li><strong>Platform activity:</strong> BUY and SELL listings, saved searches, Buyer-Seller Matches, messages, offers, enquiries, feedback, reports, account settings and notification preferences.</li>
              <li><strong>Technical information:</strong> IP address, browser type, device information, operating system, login activity, security logs and cookie-related information.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                3
              </span>
              <span>How We Collect Personal Data</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              We may collect personal data directly from you, automatically through your use of the platform, or from appropriate third-party and public sources:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1.5 text-[14px] text-[#475569]">
              <li>When you register or update your account</li>
              <li>When you use the Trading Board or other platform features</li>
              <li>When you contact B2B LINK</li>
              <li>When you purchase or manage a membership</li>
              <li>From official company registers and VAT verification services</li>
              <li>From public business information and verification providers</li>
              <li>From another authorised representative of your company</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                4
              </span>
              <span>How We Use Personal Data</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              We may use personal data where reasonably necessary to operate and protect the B2B LINK platform and provide our services:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1.5 text-[14px] text-[#475569]">
              <li>Create, administer and secure member accounts</li>
              <li>Verify member businesses</li>
              <li>Provide membership services and features</li>
              <li>Operate the Trading Board and Buyer-Seller Match</li>
              <li>Enable business communications between members</li>
              <li>Display relevant business contact information to authorised members</li>
              <li>Process membership payments</li>
              <li>Provide customer support</li>
              <li>Manage reports, complaints and platform misuse</li>
              <li>Detect suspicious or fraudulent activity</li>
              <li>Improve platform performance, search and matching</li>
              <li>Send important account, verification, listing and service notifications</li>
              <li>Comply with legal, tax, accounting and regulatory obligations</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                5
              </span>
              <span>Legal Bases for Processing</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Depending on the activity, B2B LINK may rely on one or more lawful bases for processing personal data:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-2 text-[14px] text-[#475569]">
              <li><strong>Contract:</strong> where processing is necessary to create or administer an account or provide membership services.</li>
              <li><strong>Legal obligation:</strong> where processing is required to comply with applicable law.</li>
              <li><strong>Legitimate interests:</strong> for purposes such as platform security, fraud prevention, business verification, service improvement and protection of the network, where those interests are not overridden by individual rights.</li>
              <li><strong>Consent:</strong> where consent is required, including for certain optional cookies or marketing communications.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                6
              </span>
              <span>Member Profiles and Business Contact Information</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK is a professional B2B network. Depending on membership level and platform permissions, certain business information may be visible to other members:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1.5 text-[14px] text-[#475569]">
              <li>Company name and country</li>
              <li>Verified Member status</li>
              <li>Contact name</li>
              <li>Business email address</li>
              <li>Telephone or WhatsApp details</li>
              <li>Website</li>
              <li>Main categories traded</li>
              <li>BUY and SELL listings</li>
              <li>Feedback or rating information where available</li>
            </ul>
            <div className="ml-9 p-4 rounded-xl bg-[#F0F7FF] border border-[#BFDBFE] text-[13.5px] font-bold text-[#0B1F3A]">
              Members must use contact information obtained through B2B LINK only for legitimate business purposes.
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                7
              </span>
              <span>Business Verification</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may use official or reliable sources to help verify member businesses. Verification may include company registration checks, VAT checks where applicable, business address and domain checks, contact verification and bank account verification.
            </p>
            <p className="text-[14px] font-medium text-[#0B1F3A] pl-9">
              Private verification information and bank account details are not displayed to other members.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                8
              </span>
              <span>Membership Payments</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where a member purchases a paid membership, B2B LINK may process billing information, membership status, payment references and renewal information. Full payment-card details may be processed directly by an external payment provider rather than stored by B2B LINK.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                9
              </span>
              <span>Sharing Personal Data</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK does not sell personal data. We may share personal data where reasonably necessary with appropriate recipients, subject to applicable safeguards:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>Other members, where business contact information is intended to be visible through the platform</li>
              <li>Hosting and infrastructure providers</li>
              <li>Authentication providers</li>
              <li>Payment processors</li>
              <li>Email and communications providers</li>
              <li>Security and fraud-prevention providers</li>
              <li>Business verification providers</li>
              <li>Analytics providers where permitted</li>
              <li>Professional advisers</li>
              <li>Authorities where disclosure is legally required</li>
              <li>Service providers acting on B2B LINK&apos;s instructions</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                10
              </span>
              <span>International Data Transfers</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Some service providers may process personal data outside Estonia or the European Economic Area. Where personal data is transferred internationally, B2B LINK will use appropriate safeguards required by applicable data protection law, which may include adequacy decisions, Standard Contractual Clauses or another lawful transfer mechanism.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                11
              </span>
              <span>Artificial Intelligence and Automated Systems</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may use artificial intelligence and automated tools to support product identification, EAN/UPC auto-fill, Buyer-Seller Match, search, translation, summaries, anomaly detection, marketplace analysis and member support.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Private company information, messages, pricing information, negotiations, contacts and other non-public data will only be processed for authorised B2B LINK purposes and subject to appropriate access controls. Where automated processing produces legal or similarly significant effects on an individual, B2B LINK will respect applicable rights relating to automated decision-making.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                12
              </span>
              <span>Data Security</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK takes reasonable technical and organisational measures to protect personal data against unauthorised access, misuse, alteration, loss, disclosure or destruction. Measures may include authentication, access controls, logging, monitoring, encryption where appropriate and platform backups. No online service can guarantee absolute security, but B2B LINK will take reasonable steps to maintain appropriate safeguards.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                13
              </span>
              <span>Data Retention</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK retains personal data only for as long as reasonably necessary for the purposes for which it was collected, including legal, accounting, security, fraud-prevention and dispute-resolution requirements. Retention periods may depend on whether an account remains active, the category of data, applicable legal requirements, outstanding disputes or security concerns. When information is no longer required, it may be deleted, anonymised or securely archived where appropriate.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                14
              </span>
              <span>Closed, Suspended or Terminated Accounts</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If an account is closed, suspended or terminated, B2B LINK may retain certain information where reasonably necessary for legal compliance, accounting, fraud prevention, platform security, dispute handling, enforcement of platform rules or the establishment, exercise or defence of legal claims.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                15
              </span>
              <span>Data Protection Rights</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Depending on the circumstances and applicable law, individuals may have rights including:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1.5 text-[14px] text-[#475569]">
              <li>The right to be informed</li>
              <li>The right of access</li>
              <li>The right to rectification</li>
              <li>The right to erasure</li>
              <li>The right to restriction of processing</li>
              <li>The right to data portability</li>
              <li>The right to object to certain processing</li>
              <li>Rights relating to certain automated decision-making</li>
              <li>The right to withdraw consent where processing is based on consent</li>
            </ul>
          </section>

          {/* Section 16 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                16
              </span>
              <span>Exercising Your Rights</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              To exercise a data-protection right, contact B2B LINK using the details at the end of this policy. B2B LINK may need to verify your identity before responding. Requests will be handled in accordance with applicable data protection law and within the required time limits.
            </p>
          </section>

          {/* Section 17 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                17
              </span>
              <span>Marketing and Service Communications</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may send service-related communications necessary to operate your account. These may include verification messages, security notifications, membership and payment notices, listing expiry reminders, Buyer-Seller Match alerts selected by the member and important platform updates.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where separate consent is required for optional marketing communications, B2B LINK will obtain that consent. Users may opt out of optional marketing communications at any time.
            </p>
          </section>

          {/* Section 18 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                18
              </span>
              <span>Cookies and Similar Technologies</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK uses cookies and similar technologies for purposes including security, authentication, preferences, analytics and website functionality. Further information is available in the{' '}
              <Link href="/cookies" className="text-[#0A6CFF] font-bold hover:underline">
                B2B LINK Cookie Policy
              </Link>.
            </p>
          </section>

          {/* Section 19 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                19
              </span>
              <span>Data Breaches</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If a personal-data breach occurs, B2B LINK will assess the incident and take appropriate steps in accordance with applicable data protection law. Where legally required, B2B LINK will notify the relevant supervisory authority and affected individuals.
            </p>
          </section>

          {/* Section 20 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                20
              </span>
              <span>Children&apos;s Data</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK is a business-to-business platform and is not intended for children. Membership accounts are intended only for individuals authorised to represent a business.
            </p>
          </section>

          {/* Section 21 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                21
              </span>
              <span>Complaints</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If you have concerns about how B2B LINK processes your personal data, please contact us first so that we can review the matter. You may also have the right to lodge a complaint with the relevant data-protection supervisory authority. As B2B LINK OÜ is established in Estonia, the Estonian supervisory authority (Andmekaitse Inspektsioon) may be relevant depending on the circumstances.
            </p>
          </section>

          {/* Section 22 */}
          <section className="space-y-3">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                22
              </span>
              <span>Changes to This Privacy Policy</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may update this Privacy Policy from time to time to reflect platform developments, changes to services or providers, changes in processing activities, or legal and regulatory developments. The latest version will be published on the B2B LINK website together with the date of the most recent revision.
            </p>
          </section>

          {/* Section 23 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-[19px] sm:text-[21px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                23
              </span>
              <span>Contact</span>
            </h2>
            <div className="ml-9 p-5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2 text-[14px]">
              <p className="font-extrabold text-[#0B1F3A] text-[15px]">B2B LINK OÜ</p>
              <p className="text-[#64748B]">Sepapaja 6, Tallinn 15551, Harjumaa, Estonia</p>
              <p className="text-[#475569] pt-1">
                <strong>Privacy / Data Protection Contact:</strong>{' '}
                <a href="mailto:privacy@b2blink.eu" className="text-[#0A6CFF] font-bold hover:underline">
                  privacy@b2blink.eu
                </a>
              </p>
              <p className="text-[#475569]">
                <strong>General Support:</strong>{' '}
                <a href="mailto:support@b2blink.eu" className="text-[#0A6CFF] font-bold hover:underline">
                  support@b2blink.eu
                </a>
              </p>
            </div>
          </section>

          {/* Registration Notice Box */}
          <div className="p-5 rounded-2xl bg-[#F0F7FF] border border-[#BFDBFE] text-[13.5px] text-[#0B1F3A] leading-relaxed space-y-2">
            <div className="font-bold flex items-center gap-2 text-[#0A6CFF]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Registration Notice</span>
            </div>
            <p>
              By creating an account, you acknowledge the B2B LINK Privacy Policy and understand that personal data will be processed for account administration, verification and provision of the platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
