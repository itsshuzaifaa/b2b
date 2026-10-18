'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getConversationsForUser,
  sendInquiryMessage,
  markConversationAsRead,
  syncWithSupabase,
  isMessageSentByMe,
  type InquiryConversation,
} from '@/lib/messaging/messaging-store';
import {
  Search,
  Send,
  Paperclip,
  ShieldCheck,
  MessageSquare,
  ExternalLink,
  Radio,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

function InquiriesContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');
  const { company, role } = useAuth();
  const isBuyer = role === 'buyer';

  const [conversations, setConversations] = useState<InquiryConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(targetId || '');
  const [filterTab, setFilterTab] = useState<'all' | 'buyers' | 'admin' | 'broadcast'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  const companyId = company?.id;
  const companyEmail = company?.email;

  // Load conversations and subscribe to live storage updates
  useEffect(() => {
    let isMounted = true;
    const refresh = () => {
      if (!isMounted) return;
      const convs = getConversationsForUser(company);
      setConversations(convs);
      if (targetId) {
        const found = convs.find(
          (c) =>
            c.id === targetId ||
            (targetId.startsWith('conv-') && c.productId === targetId.split('-')[1]) ||
            c.productId === targetId
        );
        if (found) {
          setActiveConversationId(found.id);
        } else {
          setActiveConversationId(targetId);
        }
      } else if (!hasInitializedRef.current && convs.length > 0) {
        hasInitializedRef.current = true;
        setActiveConversationId(convs[0].id);
      }
    };

    refresh();
    void syncWithSupabase(role || undefined, companyId, companyEmail).then(() => {
      if (isMounted) refresh();
    });

    const handleUpdate = () => refresh();
    window.addEventListener('b2b_inquiry_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('b2b_inquiry_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [companyId, companyEmail, role, targetId]);

  useEffect(() => {
    if (targetId) {
      setActiveConversationId(targetId);
      setFilterTab('all');
    }
  }, [targetId]);

  // Tab change handler that immediately tabs out to the chosen channel
  const handleTabChange = (newTab: typeof filterTab) => {
    setFilterTab(newTab);
    const inTab = conversations.filter((c) => {
      if (newTab === 'buyers') return c.type === 'buyer_seller';
      if (newTab === 'admin') return c.type === 'seller_admin';
      if (newTab === 'broadcast') return c.type === 'broadcast';
      return true;
    });

    if (inTab.length > 0) {
      const alreadyInTab = inTab.some((c) => c.id === activeConversationId);
      if (!alreadyInTab) {
        setActiveConversationId(inTab[0].id);
      }
    } else {
      setActiveConversationId('');
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConversationId]);

  const filteredConversations = conversations.filter((c) => {
    // Tab filter
    if (filterTab === 'buyers' && c.type !== 'buyer_seller') return false;
    if (filterTab === 'admin' && c.type !== 'seller_admin') return false;
    if (filterTab === 'broadcast' && c.type !== 'broadcast') return false;

    // Search filter
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      c.buyerCompanyName.toLowerCase().includes(q) ||
      c.productTitle.toLowerCase().includes(q) ||
      c.sellerCompanyName.toLowerCase().includes(q) ||
      c.lastMessageText.toLowerCase().includes(q)
    );
  });

  const activeConv =
    conversations.find((c) => c.id === activeConversationId) ||
    conversations.find(
      (c) =>
        Boolean(targetId) &&
        (c.id === targetId ||
          (targetId!.startsWith('conv-') && c.productId === targetId!.split('-')[1]) ||
          c.productId === targetId)
    ) ||
    filteredConversations.find((c) => c.id === activeConversationId) ||
    filteredConversations[0] ||
    conversations[0] ||
    null;

  const activeId = activeConv?.id;
  const isUnread = isBuyer ? activeConv?.unreadByBuyer : activeConv?.unreadBySeller;

  // Mark as read when opening ONLY if unread
  useEffect(() => {
    if (activeId && isUnread) {
      markConversationAsRead(activeId, isBuyer ? 'buyer' : 'seller');
    }
  }, [activeId, isUnread, isBuyer]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv) return;

    const isChatWithSupplier = Boolean(company && activeConv.sellerCompanyId !== company.id);
    const senderRole = isChatWithSupplier ? 'buyer' : role === 'buyer' ? 'buyer' : 'seller';
    const senderName =
      company?.contact_name ||
      company?.company_name ||
      company?.name ||
      (senderRole === 'buyer' ? 'Buyer Representative' : 'Seller Representative');
    const senderId = company?.id || company?.email || 'user';

    const updated = sendInquiryMessage(
      activeConv.id,
      senderRole,
      senderName,
      senderId,
      replyText.trim()
    );

    if (updated) {
      setConversations(getConversationsForUser(company));
      setReplyText('');
    }
  };

  const handleQuickPreset = (presetType: 'quote' | 'stock' | 'delivery') => {
    if (!activeConv) return;
    if (presetType === 'quote') {
      const priceStr = activeConv.productPrice ? `£${activeConv.productPrice.toFixed(2)}` : 'our agreed trade price';
      setReplyText(`We can fulfill this trade order at ${priceStr} per unit. Proforma invoice can be issued immediately.`);
    } else if (presetType === 'stock') {
      setReplyText('Yes, full quantity is in stock and ready for immediate global pallet collection / dispatch.');
    } else if (presetType === 'delivery') {
      setReplyText('Standard transit time is 2-4 business days across international logistics terminals with full tracking.');
    }
  };

  const getMonogram = (name: string) => {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || 'GL'
    );
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return 'Just now';
    }
  };

  // Channel counts for tabs
  const allCount = conversations.length;
  const buyersCount = conversations.filter((c) => c.type === 'buyer_seller').length;
  const adminCount = conversations.filter((c) => c.type === 'seller_admin' || c.type === 'broadcast').length;

  const recipientName = activeConv
    ? isBuyer
      ? (activeConv.type === 'broadcast' || activeConv.type === 'seller_admin' ? 'Jeff (B2B LINK Desk)' : activeConv.sellerCompanyName)
      : (activeConv.type === 'broadcast' || activeConv.type === 'seller_admin' ? 'Jeff (B2B LINK Desk)' : activeConv.buyerContactName || activeConv.buyerCompanyName)
    : 'Recipient';

  return (
    <div className="flex flex-col h-full font-sans">
      {/* Top Header & Fast Exit Navigation (fixes unable to tab out) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAEFF6] mb-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[#5B6B82] mb-0.5">
            <Link href="/dashboard" className="hover:text-[#0A6CFF] transition font-medium">Dashboard</Link>
            <span>/</span>
            <span className="text-[#0B1F3A] font-bold">{isBuyer ? 'My Inquiries & Chats' : 'Inquiries & Messages'}</span>
          </div>
          <h1 className="text-[22px] sm:text-[24px] font-black text-[#0B1F3A] tracking-tight">
            {isBuyer ? 'Inquiries & Supplier Chats' : 'Trade Inquiries & Support'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#F3F6FB] hover:bg-[#EAEFF6] text-[#0B1F3A] border border-[#E3E9F2] transition flex items-center gap-1.5"
          >
            <span>&larr; Back to Dashboard</span>
          </Link>
          <Link
            href="/marketplace"
            className="px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#0A6CFF] hover:bg-[#0857cf] text-white transition flex items-center gap-1.5 shadow-xs"
          >
            <span>Browse Marketplace</span>
          </Link>
        </div>
      </div>

      {/* Top Filter Tabs */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 mb-4 select-none">
        {[
          { id: 'all', label: 'All conversations', count: allCount },
          { id: 'buyers', label: isBuyer ? 'Supplier chats' : 'Buyer inquiries', count: buyersCount },
          { id: 'admin', label: 'Jeff & Support desk', count: adminCount },
        ].map((tab) => {
          const isActive = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id as typeof filterTab)}
              className={`flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-full transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0B1528] text-white shadow-xs'
                  : 'bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[12px] ${isActive ? 'text-white/80' : 'text-[#94A3B8]'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Split Layout Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-[24px] shadow-[0_2px_14px_rgba(0,0,0,0.03)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[580px] max-h-[calc(100vh-140px)]">
        {/* LEFT COLUMN: Conversation Threads List (5 Cols) */}
        <div className="lg:col-span-5 border-r border-[#E2E8F0] bg-white flex flex-col justify-between overflow-hidden">
          {/* Search Bar Header */}
          <div className="p-3.5 border-b border-[#F1F5F9] shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search conversations"
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
              />
            </div>
          </div>

          {/* List of Conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F8FAFC]">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-[#64748B]">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A6CFF] flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <h4 className="text-[14px] font-bold text-[#0F172A]">Your first inquiry shows here!</h4>
                <p className="text-[12px] text-[#5B6B82] mt-1 leading-relaxed">
                  When you contact a supplier about a wholesale stock lot on Marketplace, your direct chat will appear right here.
                </p>

                {/* Preview Mockup Card */}
                <div className="mt-4 p-3 rounded-xl border border-dashed border-[#CFD9E8] bg-[#F9FBFE] text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0A6CFF]" />
                    <span className="text-[11px] font-bold text-[#0B1F3A]">Example Inquiry Preview</span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    &quot;Hi, I have a question regarding this wholesale lot...&quot;
                  </p>
                  <span className="inline-block mt-2 bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Direct Trade Channel · 0% commission
                  </span>
                </div>

                <Link
                  href="/marketplace"
                  className="mt-4 inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold transition shadow-xs"
                >
                  <span>Explore Marketplace</span>
                </Link>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConv?.id;
                const isBroadcast = conv.type === 'broadcast';
                const isAdminDesk = conv.type === 'seller_admin';

                const isChatWithSupplier = Boolean(company && conv.sellerCompanyId !== company.id);
                const otherPartyName = isBroadcast || isAdminDesk
                  ? 'Jeff Vetting Director (B2B LINK Desk)'
                  : isChatWithSupplier
                  ? conv.sellerCompanyName
                  : conv.buyerContactName || conv.buyerCompanyName || 'Commercial Buyer';

                const monogram = isBroadcast || isAdminDesk ? 'JF' : getMonogram(otherPartyName);
                const hasUnread = isBuyer ? conv.unreadByBuyer : conv.unreadBySeller;

                // Format short relative time like in screenshot: "Just now", "2h", "5h", "32m", "1d"
                let shortTime = conv.lastMessageTime || 'Just now';
                if (shortTime.toLowerCase().includes('just now')) shortTime = 'Just now';
                else if (shortTime.includes('ago')) shortTime = shortTime.replace(' ago', '');

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`relative flex items-start gap-3 p-3.5 transition cursor-pointer select-none ${
                      isSelected
                        ? 'border-l-[3.5px] border-l-[#0A6CFF] bg-[#F8FAFC]/90'
                        : 'border-l-[3.5px] border-l-transparent hover:bg-[#F8FAFC]/50'
                    }`}
                  >
                    {/* Circle Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full font-bold text-[12px] flex items-center justify-center shrink-0 ${
                        isBroadcast || isAdminDesk
                          ? 'bg-[#0B1528] text-[#00E5FF] ring-2 ring-slate-800'
                          : 'bg-[#EBF3FF] text-[#0A6CFF]'
                      }`}
                    >
                      {monogram}
                    </div>

                    {/* Thread Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-[13px] font-bold text-[#0F172A] truncate leading-tight">
                          {otherPartyName}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[11px] font-medium text-[#94A3B8]">
                            {shortTime}
                          </span>
                          {hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-[#0A6CFF] shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Pill Badge matching design */}
                      <div className="mt-1">
                        {isBroadcast || isAdminDesk ? (
                          <span className="inline-block bg-[#0B1528] text-[#00E5FF] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Jeff &bull; Desk Support
                          </span>
                        ) : (
                          <span className="inline-block bg-[#EBF3FF] text-[#0A6CFF] text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[210px]">
                            {isChatWithSupplier ? 'Supplier' : 'Buyer'} &bull; {conv.productTitle}
                          </span>
                        )}
                      </div>

                      {/* Snippet message */}
                      <p className="text-[12px] text-[#64748B] truncate mt-1 leading-normal font-normal">
                        {conv.lastMessageText}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Window (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-white overflow-hidden">
          {activeConv ? (
            <>
              {/* Chat Header Bar */}
              {(() => {
                const activeIsChatWithSupplier = Boolean(company && activeConv.sellerCompanyId !== company.id);
                const activeHeaderName =
                  activeConv.type === 'broadcast' || activeConv.type === 'seller_admin'
                    ? 'Jeff Vetting Director (B2B LINK Desk)'
                    : activeIsChatWithSupplier
                    ? activeConv.sellerCompanyName
                    : activeConv.buyerContactName || activeConv.buyerCompanyName || 'Commercial Buyer';

                return (
                  <div className="p-4 bg-white border-b border-[#E2E8F0] shrink-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Square rounded avatar */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0 ${
                          activeConv.type === 'broadcast' || activeConv.type === 'seller_admin'
                            ? 'bg-[#0B1528] text-[#00E5FF]'
                            : 'bg-[#DDE7F5] text-[#334155]'
                        }`}
                      >
                        {activeConv.type === 'broadcast' || activeConv.type === 'seller_admin'
                          ? 'JF'
                          : getMonogram(activeHeaderName)}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-[14px] sm:text-[15px] text-[#0F172A] truncate">
                          {activeHeaderName}
                        </h3>
                        <p className="text-[11px] sm:text-[12px] text-[#64748B] truncate mt-0.5 font-normal">
                          {activeConv.type === 'broadcast' || activeConv.type === 'seller_admin'
                            ? 'Official direct support & platform advisory channel'
                            : `${activeConv.productTitle}${activeConv.productPrice ? ` · £${activeConv.productPrice.toFixed(2)}` : ''}`}
                        </p>
                      </div>
                    </div>

                    {/* Right Badges & Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>In-app verified</span>
                      </span>

                      <Link
                        href={
                          activeConv.productId && !activeConv.productId.startsWith('00000000')
                            ? `/marketplace/${activeConv.productId}`
                            : '/marketplace'
                        }
                        className="bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] text-[12px] font-semibold px-3 py-1 rounded-full transition shadow-2xs inline-flex items-center gap-1"
                      >
                        <span>View listing</span>
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Chat Messages Body */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white">
                {/* Centered Date Badge */}
                <div className="flex justify-center my-2">
                  <span className="bg-[#F1F5F9] text-[#64748B] text-[11px] font-medium px-3.5 py-1 rounded-full">
                    Today
                  </span>
                </div>

                {(activeConv.messages || []).map((m) => {
                  const activeIsChatWithSupplier = Boolean(company && activeConv.sellerCompanyId !== company.id);
                  const isCurrentSender =
                    (m.senderId && (m.senderId === company?.id || (company?.email && m.senderId === company.email))) ||
                    (company?.contact_name && m.senderName === company.contact_name) ||
                    (company?.company_name && m.senderName === company.company_name) ||
                    (company?.name && m.senderName === company.name) ||
                    isMessageSentByMe(m.id) ||
                    (!activeIsChatWithSupplier ? m.senderRole === 'seller' : m.senderRole === 'buyer');

                  const timeString = formatMessageTime(m.timestamp);

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isCurrentSender ? 'items-end' : 'items-start'}`}
                    >
                      {/* Name and time above bubble */}
                      <div className="text-[11px] text-[#94A3B8] font-medium mb-1 px-1">
                        {m.senderName} · {timeString}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed max-w-[78%] break-words ${
                          isCurrentSender
                            ? 'bg-[#0A6CFF] text-white rounded-tr-xs font-medium shadow-2xs'
                            : 'bg-[#F0F4FA] text-[#0F172A] rounded-tl-xs'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Presets */}
              <div className="px-4 py-2 bg-white flex items-center gap-2 overflow-x-auto border-t border-[#F8FAFC]">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('quote')}
                  className="bg-[#F4F8FF] border border-[#D5E5FF] hover:bg-blue-50 text-[#0A6CFF] text-[11px] font-semibold px-3 py-1 rounded-full transition cursor-pointer whitespace-nowrap"
                >
                  Send quote
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('stock')}
                  className="bg-[#F4F8FF] border border-[#D5E5FF] hover:bg-blue-50 text-[#0A6CFF] text-[11px] font-semibold px-3 py-1 rounded-full transition cursor-pointer whitespace-nowrap"
                >
                  Confirm stock
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('delivery')}
                  className="bg-[#F4F8FF] border border-[#D5E5FF] hover:bg-blue-50 text-[#0A6CFF] text-[11px] font-semibold px-3 py-1 rounded-full transition cursor-pointer whitespace-nowrap"
                >
                  Share delivery date
                </button>
              </div>

              {/* Bottom Input Bar */}
              <div className="p-3.5 bg-white border-t border-[#F1F5F9]">
                <form onSubmit={handleSend} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    title="Attach document or specification"
                    className="w-9 h-9 rounded-full border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-4 h-4 text-[#94A3B8]" />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Write a reply to ${recipientName}`}
                      className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="bg-[#0A6CFF] hover:bg-[#0857CF] disabled:opacity-50 text-white font-semibold text-[12px] px-5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-[#64748B]">
              <div className="w-16 h-16 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-[17px] font-bold text-[#0F172A]">Your Wholesale Conversations</h3>
              <p className="text-[13px] text-[#5B6B82] max-w-md mt-1.5 leading-relaxed">
                When you initiate a direct product inquiry with a supplier on Marketplace, or when Jeff reaches out with trade updates, your real-time messages appear here.
              </p>
              <Link
                href="/marketplace"
                className="mt-6 px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition shadow-xs inline-flex items-center gap-2"
              >
                <span>Browse Marketplace Products</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardInquiriesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
          Loading messages...
        </div>
      }
    >
      <InquiriesContent />
    </Suspense>
  );
}
