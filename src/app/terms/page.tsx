'use client';

import React from 'react';
import Link from 'next/link';
import {
  Scale,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Clock,
  Building2,
  Mail,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function TermsAndConditionsPage() {
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
            <span className="text-[#0B1F3A] font-semibold">Terms &amp; Conditions</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3FF] border border-[#BFDBFE] text-[#0A6CFF] text-[12px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated: October 2026</span>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="bg-white rounded-[32px] border border-[#EAEFF6] shadow-[0_12px_40px_rgba(11,31,58,0.06)] p-6 sm:p-10 md:p-14 space-y-9 text-[#334155] leading-relaxed">
          {/* Header Title */}
          <div className="border-b border-slate-100 pb-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A6CFF]/10 text-[#0A6CFF] flex items-center justify-center font-bold">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0A6CFF]">
                  B2B LINK OÜ &bull; Commercial Terms of Service
                </span>
                <h1 className="text-[28px] sm:text-[36px] font-black text-[#0B1F3A] tracking-tight leading-tight">
                  B2B LINK Terms &amp; Conditions
                </h1>
              </div>
            </div>

            <p className="text-[15px] sm:text-[16px] text-[#475569] leading-relaxed pt-2">
              These Terms &amp; Conditions govern access to and use of the B2B LINK website, platform, membership services and related features operated by <strong>B2B LINK OÜ</strong>, Estonia (&ldquo;B2B LINK&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;).
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed">
              By registering for an account, purchasing a membership or using B2B LINK, you agree to these Terms. If you act on behalf of a company or other organisation, you confirm that you have authority to accept these Terms on its behalf.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                1
              </span>
              <span>About B2B LINK</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK is a business-to-business membership network and wholesale trading platform designed to help professional buyers and sellers identify and connect with potential trading partners.
            </p>
            <p className="text-[14.5px] font-bold text-[#0B1F3A] pl-9">
              B2B LINK provides the platform, marketplace information, communication tools and introductions. B2B LINK is not the buyer or seller of goods listed by members and is not a party to transactions between members.
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>Post and search BUY and SELL listings</li>
              <li>Receive Buyer-Seller Matches</li>
              <li>View relevant business and contact information</li>
              <li>Contact other members directly</li>
              <li>Use other services available under the applicable membership level</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                2
              </span>
              <span>Business Users Only</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK is intended for legitimate business and professional wholesale use. It is not intended for personal retail purchasing.
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>You are acting for legitimate business purposes</li>
              <li>The information you provide is accurate and current</li>
              <li>You are authorised to act for the registered business</li>
              <li>You will use the platform only for lawful business activities</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                3
              </span>
              <span>Account Registration and Security</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members may be required to provide company and contact information including company name, country, company registration number, VAT number where applicable, contact details and other information reasonably required for account administration or verification.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              You are responsible for keeping your login credentials secure and for activity carried out through your account, except where the activity results from a security failure attributable to B2B LINK:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>Do not share account credentials with unauthorised users</li>
              <li>Do not allow another business to use your account</li>
              <li>Notify B2B LINK promptly if you believe your account has been compromised</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                4
              </span>
              <span>Business Verification and Verified Member Status</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may carry out business verification checks before or after granting Verified Member status. These checks may include company registration information, VAT information where applicable, business contact details, company email or domain information, bank account verification and other information reasonably required to verify the business.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              A Verified Member badge means only that B2B LINK has completed the applicable membership checks. It is not a guarantee, warranty, endorsement or certification of the member, its financial standing, its stock, its conduct, or any transaction.
            </p>
            <div className="ml-9 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[13.5px] font-bold text-[#92400E]">
              Members must always carry out their own due diligence before trading or releasing funds or goods.
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                5
              </span>
              <span>Membership</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may offer different membership levels, including Free, Professional, Business and Maximum. Each membership level may provide different features, usage limits, services and levels of access.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Paid memberships will be charged according to the price and billing period displayed at the time of purchase. Membership fees are payable in advance unless otherwise stated. Where recurring billing applies, the membership will renew in accordance with the billing arrangement selected by the member unless cancelled before the next renewal date.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If a paid membership expires, is cancelled or is not renewed, the account may automatically revert to Free Membership, with paid features and limits no longer available. B2B LINK may update membership features, limits or pricing from time to time. Material changes affecting an existing paid membership will be communicated where appropriate.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                6
              </span>
              <span>Non-Transferable Membership</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK memberships and member accounts are non-transferable and are issued only to the registered business. A membership may not be sold, assigned, transferred, shared or otherwise made available to another company, business or third party.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If ownership or control of the registered business changes, B2B LINK may require updated company information and may carry out further verification before continued access is permitted. B2B LINK may transfer or assign its own rights and obligations as part of a merger, acquisition, corporate restructuring, sale of business or transfer to a successor company.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                7
              </span>
              <span>Membership Payments, Renewals and Taxes</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Membership fees are separate from any transaction between members. B2B LINK does not charge commission on member-to-member trades unless expressly stated otherwise.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If a membership payment cannot be collected, B2B LINK may retry the payment or notify the member that payment is outstanding. If payment remains outstanding, paid features may be withdrawn and the account may revert to Free Membership.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Membership prices may be shown inclusive or exclusive of VAT depending on the member&apos;s location and applicable tax rules. Members are responsible for providing accurate billing and VAT information. Membership payments may be processed by third-party payment providers. B2B LINK does not normally store full payment-card details.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                8
              </span>
              <span>Refunds</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Membership fees are generally non-refundable once the relevant membership period has started, except where required by applicable law, where B2B LINK agrees otherwise, where there has been a billing error, or where a paid service has not been provided due to a material failure by B2B LINK.
            </p>
            <p className="text-[14.5px] font-semibold text-[#0B1F3A] pl-9">
              Because B2B LINK is a business-to-business service, members should not assume that consumer cancellation rights apply.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                9
              </span>
              <span>Accurate Listing Information</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members are responsible for ensuring that all BUY and SELL listings they publish are accurate, current and not misleading. Members must not knowingly publish false, incomplete or misleading information.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              For SELL listings, members should only advertise stock they genuinely have available, control, or are properly authorised to offer. BUY listings should represent genuine purchasing requirements. If information changes after publication, the member should update or remove the listing as soon as reasonably possible:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>BUY or SELL status</li>
              <li>Category and brand</li>
              <li>Item code and product description</li>
              <li>EAN/UPC and model information</li>
              <li>Quantity and availability</li>
              <li>Condition</li>
              <li>Price and negotiability</li>
              <li>Stock location</li>
              <li>Market or regional specification</li>
              <li>Packaging and warranty status where relevant</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                10
              </span>
              <span>Product Condition, Authenticity and Stock</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where a member states that goods are New, Open Box, Refurbished, Used or Parts, the selected condition must accurately reflect the goods being offered.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members must not list counterfeit, imitation, stolen, unlawfully obtained or deliberately misrepresented goods. Sellers are responsible for ensuring that they have the legal right to offer the goods.
            </p>
            <p className="text-[14.5px] font-semibold text-[#0B1F3A] pl-9">
              B2B LINK does not inspect, own, store, authenticate, test or take possession of goods listed by members and does not guarantee that goods are new, genuine, available, complete, defect-free or as described.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                11
              </span>
              <span>EAN/UPC, Item Codes and Automated Product Information</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members should take reasonable care to ensure that EAN/UPC numbers, item codes, model numbers and descriptions are correct.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may use product catalogues, databases, automation or artificial intelligence to assist with product identification, auto-fill and listing normalisation. The member remains responsible for checking the information before publication. Automated information is provided as an assistance tool and should not be treated as a guarantee of product identity, specification or legal status.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                12
              </span>
              <span>Quantity, Availability and Pricing</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members must make reasonable efforts to keep quantities and availability current. SELL listings should be updated, marked as sold or removed when stock is no longer available. BUY listings should be marked as fulfilled or removed when the requirement has been satisfied.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Prices must be entered accurately by the member. Members are responsible for clarifying whether a price includes or excludes VAT, shipping, insurance, duties or other transaction costs. B2B LINK may automatically expire older listings to help maintain a current Trading Board.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                13
              </span>
              <span>Buyer-Seller Match and Marketplace Information</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may identify potential matches between BUY and SELL listings using information such as product, EAN/UPC, item code, condition, quantity, price, location and other marketplace data.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Match results, rankings, market information and search results are provided to assist members only. Members should not rely solely on information displayed on B2B LINK when deciding whether to trade and must independently verify any information material to a transaction.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                14
              </span>
              <span>B2B LINK&apos;s Role - Introduction Only</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK helps businesses identify and connect with potential trading partners. Any purchase, sale or other transaction following an introduction through B2B LINK is agreed and carried out directly between the buyer and seller.
            </p>
            <div className="ml-9 p-4 rounded-xl bg-[#F0F7FF] border border-[#BFDBFE] text-[13.5px] text-[#0B1F3A] font-bold leading-relaxed">
              B2B LINK&apos;s role is limited to facilitating introductions and providing access to marketplace information and communication tools.
            </div>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK does not act as buyer, seller, broker, agent or representative of either party, does not negotiate commercial terms on behalf of members, does not receive or hold transaction funds, and does not manage shipping, delivery, insurance, customs, warranties, returns or trade documentation.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                15
              </span>
              <span>Member Due Diligence</span>
            </h2>
            <div className="ml-9 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[14px] font-bold text-[#92400E]">
              Members must carry out their own due diligence before entering into any transaction or releasing funds, goods or other value.
            </div>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members should make all checks they consider appropriate to the proposed transaction:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1.5 text-[14px] text-[#475569]">
              <li>Identity and legitimacy of the counterparty</li>
              <li>Company registration and financial standing</li>
              <li>Bank account and payment details</li>
              <li>Trade references where appropriate</li>
              <li>Ownership and availability of stock</li>
              <li>Product authenticity and condition</li>
              <li>Quantity, specification, serial numbers and EAN/UPC information</li>
              <li>Warranty status, packaging and accessories</li>
              <li>Country or market specification</li>
              <li>Delivery, payment and insurance arrangements</li>
            </ul>
          </section>

          {/* Section 16 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                16
              </span>
              <span>Transactions Between Members</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              All negotiations and transactions take place directly between members. The buyer and seller are solely responsible for agreeing product, condition, quantity, price, currency, payment terms, credit terms, delivery, shipping, insurance, Incoterms, taxes, duties, inspection arrangements, warranties, returns, documentation and all other commercial terms.
            </p>
            <p className="text-[14.5px] font-semibold text-[#0B1F3A] pl-9">
              B2B LINK does not supervise, approve or guarantee those arrangements.
            </p>
          </section>

          {/* Section 17 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                17
              </span>
              <span>No Responsibility for Transaction Outcomes</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              To the fullest extent permitted by applicable law, B2B LINK is not responsible or liable for losses, damage, costs, claims or disputes arising from or connected with a transaction or attempted transaction between members.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              This includes issues relating to non-payment, non-delivery, late delivery, incorrect or missing goods, damaged or defective goods, goods not being new when described as new, counterfeit or non-genuine goods, incorrect quantities, incorrect product descriptions, invalid or unavailable warranties, fraudulent or incorrect bank details, insolvency, fraud, misrepresentation, or a party failing to honour agreed terms.
            </p>
            <p className="text-[14.5px] font-bold text-[#0B1F3A] pl-9">
              Members trade at their own commercial risk and are responsible for satisfying themselves about the trader, stock and transaction before releasing funds or goods.
            </p>
          </section>

          {/* Section 18 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                18
              </span>
              <span>Disputes Between Members</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Any dispute arising from a transaction is between the buyer and seller.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may review reports and may restrict, suspend or terminate a member&apos;s platform access where appropriate, but B2B LINK is not responsible for recovering money or goods, enforcing contracts, resolving commercial claims or compensating either party.
            </p>
          </section>

          {/* Section 19 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                19
              </span>
              <span>Offers, Messages and Contact Information</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may provide messaging or offer tools to assist members in making initial contact. Members may also continue discussions directly by telephone, email, WhatsApp or other communication methods.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Business contact information obtained through B2B LINK must be used only for legitimate B2B trading and networking purposes:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>Do not harvest, scrape or build databases of member contact details without permission</li>
              <li>Do not sell or redistribute member contact information</li>
              <li>Do not send unlawful, excessive or unrelated unsolicited communications</li>
            </ul>
          </section>

          {/* Section 20 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                20
              </span>
              <span>Prohibited Listings and Conduct</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members must not use B2B LINK to advertise, buy, sell or promote counterfeit, stolen, fraudulent, illegal or misrepresented goods, or goods that infringe intellectual property rights or applicable law:
            </p>
            <ul className="list-disc list-outside pl-14 space-y-1 text-[14px] text-[#475569]">
              <li>Impersonating another business or individual</li>
              <li>Publishing false or misleading information</li>
              <li>Fraud or attempted fraud</li>
              <li>Spam, harassment or abusive communications</li>
              <li>Malware, harmful code or attempts to interfere with platform security</li>
              <li>Unauthorised scraping or systematic extraction of platform data</li>
              <li>Unauthorised access, reverse engineering or misuse of B2B LINK systems</li>
            </ul>
          </section>

          {/* Section 21 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                21
              </span>
              <span>Reports, Complaints and Feedback</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members may report suspicious listings, concerns about another member, non-payment, non-delivery, counterfeit concerns, abusive behaviour or other serious issues.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Reports are reviewed by B2B LINK and do not automatically establish wrongdoing. B2B LINK may request further information and may warn, restrict, place under review, suspend or terminate accounts where appropriate. Feedback and reviews must be genuine, fair and based on actual experience. B2B LINK may remove content that is false, misleading, abusive, defamatory or manipulated.
            </p>
          </section>

          {/* Section 22 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                22
              </span>
              <span>Artificial Intelligence and Automated Features</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may use artificial intelligence and automated systems to support product identification, search, Buyer-Seller Match, listing normalisation, translation, summaries, market information, anomaly detection and member support.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Automated outputs are intended to assist users and should not be treated as professional, legal, financial or commercial advice. Members remain responsible for their own decisions and for checking information before relying on it.
            </p>
          </section>

          {/* Section 23 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                23
              </span>
              <span>Privacy, Confidentiality and Data Use</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Personal data is processed in accordance with the{' '}
              <Link href="/privacy" className="text-[#0A6CFF] font-bold hover:underline">
                B2B LINK Privacy Policy
              </Link>, and cookies and similar technologies are described in the{' '}
              <Link href="/cookies" className="text-[#0A6CFF] font-bold hover:underline">
                B2B LINK Cookie Policy
              </Link>.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members must not misuse confidential or commercially sensitive information received from another member or use personal data obtained through B2B LINK in breach of applicable data protection law.
            </p>
          </section>

          {/* Section 24 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                24
              </span>
              <span>Intellectual Property</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              The B2B LINK website, platform, software, branding, database structure, design and original content are owned by or licensed to B2B LINK. Members may not copy, reproduce, reverse engineer, distribute or commercially exploit B2B LINK intellectual property without permission.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members retain responsibility for information they submit and grant B2B LINK permission to store, process and display that information as reasonably required to operate the service.
            </p>
          </section>

          {/* Section 25 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                25
              </span>
              <span>Platform Availability and Service Interruptions</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK aims to provide a reliable and secure service but cannot guarantee uninterrupted or error-free availability. The platform may occasionally be unavailable or affected by maintenance, updates, security work, hosting or infrastructure failures, internet or telecommunications outages, third-party service failures, cyber incidents, technical faults or events outside B2B LINK&apos;s reasonable control.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where reasonably possible, B2B LINK will aim to minimise disruption and restore service as soon as practical. Temporary interruption or unavailability does not automatically entitle a member to a refund or membership extension. Where there is a prolonged interruption caused directly by B2B LINK, B2B LINK may, at its discretion, provide an appropriate credit, extension or other remedy.
            </p>
          </section>

          {/* Section 26 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                26
              </span>
              <span>Backups and Data Restoration</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK takes reasonable steps to maintain platform backups and continuity procedures. In the event of a technical issue or service interruption, B2B LINK may restore the platform using the most recent available backup. If this is necessary, some very recent activity completed after the latest successful backup may need to be re-entered by the relevant member.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9 font-medium text-[#0B1F3A]">
              B2B LINK will make reasonable efforts to restore the service and available data as quickly and accurately as practical. Members should retain their own records of important transactions, communications and stock information.
            </p>
          </section>

          {/* Section 27 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                27
              </span>
              <span>Force Majeure</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK will not be responsible for delay or failure to perform obligations where this results from circumstances outside its reasonable control, including major communications failures, power outages, cyber incidents, natural disasters, government action, war, civil disturbance, labour disruption or failure of essential third-party infrastructure.
            </p>
          </section>

          {/* Section 28 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                28
              </span>
              <span>Sanctions, Export Controls, Taxes and Trade Compliance</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members are responsible for ensuring that their own activities comply with applicable sanctions, export controls, customs rules, trade restrictions, tax requirements and other laws relevant to their transactions.
            </p>
            <p className="text-[14.5px] font-semibold text-[#0B1F3A] pl-9">
              Buyers and sellers are responsible for VAT, duties, import/export charges and other taxes arising from their own trades.
            </p>
          </section>

          {/* Section 29 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                29
              </span>
              <span>Anti-Fraud and Anti-Bribery</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members must not use B2B LINK in connection with fraud, bribery, corruption, money laundering or other unlawful activity. B2B LINK may restrict or suspend access where suspicious activity is identified and may make disclosures where required by law.
            </p>
          </section>

          {/* Section 30 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                30
              </span>
              <span>Account Restriction, Suspension and Termination</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may restrict, review, suspend or terminate an account where reasonably necessary, including where verification cannot be completed, information appears false or misleading, these Terms are breached, fraud or suspicious activity is suspected, a serious complaint has been raised, the account presents a security risk, or required membership payments remain unpaid.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where appropriate, B2B LINK may give the member an opportunity to provide additional information before a final decision is made.
            </p>
          </section>

          {/* Section 31 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                31
              </span>
              <span>Changes to the Platform and These Terms</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              B2B LINK may update platform features, services or these Terms from time to time. Where changes are material, B2B LINK may notify members through the website, platform or registered email address. The latest version will be published on the B2B LINK website with the date of the most recent revision.
            </p>
          </section>

          {/* Section 32 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                32
              </span>
              <span>Electronic Notices</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Members agree that B2B LINK may provide account, membership, verification, billing, legal and service notices electronically, including by email or through the platform, where permitted by law.
            </p>
          </section>

          {/* Section 33 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                33
              </span>
              <span>No Agency, Partnership or Joint Venture</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Nothing in these Terms creates any partnership, joint venture, agency, fiduciary, employment or representative relationship between B2B LINK and any member. B2B LINK does not act for either party to a member transaction and has no authority or responsibility for negotiating, concluding, performing or enforcing a trade between members.
            </p>
          </section>

          {/* Section 34 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                34
              </span>
              <span>Limitation of Liability</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              To the fullest extent permitted by applicable law, B2B LINK is not responsible for the commercial outcome of any transaction between members or for losses arising solely from the acts or omissions of another member.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Where liability cannot lawfully be excluded, B2B LINK&apos;s liability will be limited to the extent permitted by applicable law and subject to any applicable contractual liability cap stated or agreed in connection with the service. Nothing in these Terms excludes or limits liability where it cannot legally be excluded or limited.
            </p>
          </section>

          {/* Section 35 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                35
              </span>
              <span>Severability and Waiver</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              If any provision of these Terms is found to be invalid, unlawful or unenforceable, the remaining provisions will continue in full force to the extent permitted by law. A failure or delay by B2B LINK to enforce a right under these Terms does not waive that right.
            </p>
          </section>

          {/* Section 36 */}
          <section className="space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                36
              </span>
              <span>Governing Law and Jurisdiction</span>
            </h2>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              These Terms and any dispute or claim arising out of or in connection with the use of B2B LINK shall be governed by the laws of Estonia, unless otherwise required by applicable law.
            </p>
            <p className="text-[14.5px] text-[#475569] leading-relaxed pl-9">
              Any dispute or claim may, at B2B LINK&apos;s discretion, be brought before the competent courts of Estonia or the competent courts of the country or jurisdiction in which the relevant member has its registered office, principal place of business, or is otherwise legally established. Nothing in this clause prevents B2B LINK from seeking urgent, protective or interim relief in any jurisdiction where such action may be necessary to protect its rights, systems, data, intellectual property or members.
            </p>
          </section>

          {/* Section 37 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#0A6CFF] text-[13px] flex items-center justify-center font-black">
                37
              </span>
              <span>Contact</span>
            </h2>
            <div className="ml-9 p-5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2 text-[14px]">
              <p className="font-extrabold text-[#0B1F3A] text-[15px]">B2B LINK OÜ</p>
              <p className="text-[#64748B]">Sepapaja 6, Tallinn 15551, Harjumaa, Estonia</p>
              <p className="text-[#475569] pt-1">
                <strong>Legal / Support Email:</strong>{' '}
                <a href="mailto:support@b2blink.eu" className="text-[#0A6CFF] font-bold hover:underline">
                  support@b2blink.eu
                </a>
              </p>
            </div>
          </section>

          {/* Important Platform Notice Box */}
          <div className="p-5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[13.5px] text-[#92400E] leading-relaxed space-y-1.5">
            <div className="font-bold flex items-center gap-2 text-[#B45309]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Important Platform Notice</span>
            </div>
            <p className="font-medium">
              B2B LINK introduces buyers and sellers only. Members trade directly and are responsible for carrying out their own due diligence before releasing funds or goods.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
