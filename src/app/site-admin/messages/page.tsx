'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getStoredConversations,
  sendInquiryMessage,
  broadcastToTargetAudience,
  sendAdminDirectMessage,
  fetchAllSellersForAdmin,
  syncWithSupabase,
  markConversationAsRead,
  type InquiryConversation,
  type ChatMessage,
} from '@/lib/messaging/messaging-store';
import { isAccountDeleted, markAccountAsDeleted } from '@/lib/admin/admin-store';
import {
  MessageSquare,
  Radio,
  Search,
  Send,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Users,
  Building2,
  Clock,
  Filter,
  PlusCircle,
  Mail,
  UserCheck,
  Store,
  Layers,
  ChevronLeft,
} from 'lucide-react';

function SiteAdminMessagesContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('to');
  const { company } = useAuth();

  const [conversations, setConversations] = useState<InquiryConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(targetId || '');
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>(targetId ? 'chat' : 'list');
  // Requirement 05: Primary tab on top separating Admin Desk from Buyer & Seller trade chats
  const [mainTab, setMainTab] = useState<'admin_desk' | 'buyer_seller_chats'>('admin_desk');
  const [subFilter, setSubFilter] = useState<'all' | 'direct' | 'broadcast'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');

  // Broadcast modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'seller' | 'buyer'>('seller');
  const [broadcastTitle, setBroadcastTitle] = useState('New Platform Update for Sellers');
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);

  // Direct Message Seller modal state
  const [showDirectSellerModal, setShowDirectSellerModal] = useState(false);
  const [registeredSellers, setRegisteredSellers] = useState<any[]>([]);
  const [sellerSearch, setSellerSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [directMsgText, setDirectMsgText] = useState('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [directMsgError, setDirectMsgError] = useState<string | null>(null);
  const [directMsgSuccess, setDirectMsgSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  // Requirement 07: Hide automated onboarding welcome messages sent by Jeff to reduce clutter
  const isAutomatedWelcomeThread = (c: InquiryConversation) => {
    const isWelcomeTitleOrText =
      c.id.startsWith('welcome-') ||
      c.id.startsWith('inq-welcome-') ||
      c.productTitle?.toLowerCase().includes('welcome') ||
      c.lastMessageText?.includes('Welcome to B2B LINK') ||
      c.lastMessageText?.includes("I'm Jeff, Platform Director") ||
      c.messages?.some(
        (m) =>
          m.id.startsWith('welcome-') ||
          m.text?.includes("I'm Jeff, Platform Director") ||
          (m.senderName?.includes('Jeff') && m.text?.includes('Welcome to B2B LINK'))
      );

    // Only hide if the user hasn't sent a reply back (i.e., only automated admin welcome message)
    const hasUserReplied = c.messages?.some((m) => m.senderRole !== 'admin');
    return isWelcomeTitleOrText && !hasUserReplied;
  };

  const loadData = () => {
    const all = getStoredConversations();
    setConversations(all);
    const valid = all.filter((c) => !isAutomatedWelcomeThread(c));
    if (!hasInitializedRef.current && valid.length > 0) {
      hasInitializedRef.current = true;
      setActiveConversationId(targetId || valid[0].id);
    }
  };

  useEffect(() => {
    loadData();
    void syncWithSupabase('admin');

    const handleUpdate = () => loadData();
    window.addEventListener('b2b_inquiry_update', handleUpdate);
    return () => window.removeEventListener('b2b_inquiry_update', handleUpdate);
  }, [targetId]);

  useEffect(() => {
    if (targetId) {
      setActiveConversationId(targetId);
    }
  }, [targetId]);

  // Requirement 05: Separate Admin Support from Buyer-Seller trade chats
  const isTradeChat = (c: InquiryConversation) => {
    // If it is NOT seller_admin AND NOT broadcast, it is a buyer <-> seller trade inquiry!
    return c.type !== 'seller_admin' && c.type !== 'broadcast' && c.status !== 'broadcast_seller' && c.status !== 'broadcast_buyer';
  };

  const cleanConversations = useMemo(() => {
    return conversations.filter((c) => !isAutomatedWelcomeThread(c));
  }, [conversations]);

  const adminConversations = useMemo(() => {
    return cleanConversations.filter((c) => !isTradeChat(c));
  }, [cleanConversations]);

  const tradeConversations = useMemo(() => {
    return cleanConversations.filter((c) => isTradeChat(c));
  }, [cleanConversations]);

  const currentList = mainTab === 'admin_desk' ? adminConversations : tradeConversations;

  const filteredConversations = useMemo(() => {
    return currentList.filter((c: InquiryConversation) => {
      // Subfilter in admin desk
      if (mainTab === 'admin_desk') {
        if (subFilter === 'direct' && c.type !== 'seller_admin') return false;
        if (subFilter === 'broadcast' && c.type !== 'broadcast' && c.status !== 'broadcast_seller' && c.status !== 'broadcast_buyer') return false;
      }

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.productTitle.toLowerCase().includes(q) ||
        c.sellerCompanyName.toLowerCase().includes(q) ||
        c.buyerCompanyName.toLowerCase().includes(q) ||
        c.lastMessageText.toLowerCase().includes(q)
      );
    });
  }, [currentList, mainTab, subFilter, searchQuery]);

  const activeConv =
    filteredConversations.find((c: InquiryConversation) => c.id === activeConversationId) ||
    filteredConversations[0] ||
    null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (activeConv) {
      markConversationAsRead(activeConv.id, 'admin');
    }
  }, [activeConv]);

  const handleTabSwitch = (newTab: 'admin_desk' | 'buyer_seller_chats') => {
    setMainTab(newTab);
    const targetGroup = newTab === 'admin_desk' ? adminConversations : tradeConversations;
    if (targetGroup.length > 0) {
      setActiveConversationId(targetGroup[0].id);
    } else {
      setActiveConversationId('');
    }
  };

  const handleOpenDirectSellerModal = async () => {
    setShowDirectSellerModal(true);
    setLoadingSellers(true);
    setDirectMsgError(null);
    setDirectMsgSuccess(null);
    const sellers = await fetchAllSellersForAdmin();
    const cleanSellers = sellers.filter((s: any) => !isAccountDeleted(s.id, s.contact_email));
    setRegisteredSellers(cleanSellers);
    setLoadingSellers(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv) return;

    const senderRole = 'admin';
    const senderName = 'Platform Administrator (Executive Desk)';
    const senderId = 'facbb93f-080f-480f-b54b-8ef26664da86';

    sendInquiryMessage(activeConv.id, senderRole, senderName, senderId, replyText.trim());
    setReplyText('');
    loadData();
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setIsBroadcasting(true);
    const conv = await broadcastToTargetAudience(
      broadcastTitle.trim(),
      broadcastText.trim(),
      broadcastTarget,
      'Platform Administrator (Executive Desk)',
      'facbb93f-080f-480f-b54b-8ef26664da86'
    );

    setIsBroadcasting(false);
    if (conv) {
      setShowBroadcastModal(false);
      setBroadcastText('');
      setBroadcastNotice(
        broadcastTarget === 'seller'
          ? '📢 Broadcast successfully dispatched to all registered sellers!'
          : '📢 Broadcast successfully dispatched to all registered buyers!'
      );
      setTimeout(() => setBroadcastNotice(null), 5000);
      setMainTab('admin_desk');
      setActiveConversationId(conv.id);
      loadData();
    }
  };

  const handleSendDirectToSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller || !directMsgText.trim()) return;

    setIsSendingDirect(true);
    setDirectMsgError(null);
    setDirectMsgSuccess(null);

    const result = await sendAdminDirectMessage(
      selectedSeller.id,
      directMsgText.trim(),
      'Platform Administrator (Executive Desk)',
      'facbb93f-080f-480f-b54b-8ef26664da86',
      selectedSeller
    );

    setIsSendingDirect(false);

    if (result.success && result.conversation) {
      const conv = result.conversation;
      const targetSellerName = selectedSeller.company_name;
      setDirectMsgSuccess(`✓ Private direct message sent to ${targetSellerName}! Redirecting to chat...`);
      setBroadcastNotice(`🛡️ Private direct message sent to ${targetSellerName}!`);

      setTimeout(() => {
        setShowDirectSellerModal(false);
        setDirectMsgText('');
        setSelectedSeller(null);
        setDirectMsgSuccess(null);
        setMainTab('admin_desk');
        setActiveConversationId(conv.id);
        loadData();
      }, 700);
    } else {
      const err = result.error || 'Failed to send private message. Please check connection and try again.';
      setDirectMsgError(err);
      if (err.includes('deleted') || err.includes('no longer exists')) {
        markAccountAsDeleted(selectedSeller.id);
        if (selectedSeller.contact_email) markAccountAsDeleted(selectedSeller.contact_email);
        setRegisteredSellers((prev) => prev.filter((s) => s.id !== selectedSeller.id));
      }
    }
  };

  const filteredSellersInModal = registeredSellers.filter((s) => {
    if (isAccountDeleted(s.id, s.contact_email)) return false;
    const q = sellerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      s.company_name?.toLowerCase().includes(q) ||
      s.contact_name?.toLowerCase().includes(q) ||
      s.contact_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex flex-col font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Seller &amp; Buyer Messaging Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Segmented oversight for executive desk support, seller broadcasts, and marketplace buyer inquiries.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenDirectSellerModal}
            className="w-full sm:w-auto justify-center bg-[#0B1F3A] hover:bg-[#132A4C] text-white font-black text-xs px-4 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
          >
            <PlusCircle className="w-4 h-4 text-[#00E5FF]" />
            <span>+ Message Seller Privately</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="w-full sm:w-auto justify-center bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-black text-xs px-4 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
          >
            <Radio className="w-4 h-4" />
            <span>+ Platform Broadcast</span>
          </button>
        </div>
      </div>

      {/* Broadcast Notice Banner */}
      {broadcastNotice && (
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{broadcastNotice}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* REQUIREMENT 05: Primary Top Tabs (Main List vs Buyer-Seller) */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pb-2 border-b border-slate-200">
        {/* Main Tabs on Top */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => handleTabSwitch('admin_desk')}
            className={`flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap ${
              mainTab === 'admin_desk'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Admin Desk &amp; Announcements</span>
            <span className={`text-[11px] px-2 py-0.2 rounded-full ${mainTab === 'admin_desk' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {adminConversations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('buyer_seller_chats')}
            className={`flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap ${
              mainTab === 'buyer_seller_chats'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-[#0A6CFF]" />
            <span>Buyer &amp; Seller Trade Chats</span>
            <span className={`text-[11px] px-2 py-0.2 rounded-full ${mainTab === 'buyer_seller_chats' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {tradeConversations.length}
            </span>
          </button>
        </div>

        {/* Subfilter for Admin Desk */}
        {mainTab === 'admin_desk' && (
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 max-w-full [scrollbar-width:none]">
            {(['all', 'direct', 'broadcast'] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setSubFilter(filterKey)}
                className={`px-3 py-1.5 rounded-full font-bold transition cursor-pointer capitalize whitespace-nowrap ${
                  subFilter === filterKey
                    ? 'bg-blue-100 text-[#0A6CFF]'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {filterKey === 'all' ? 'All Desk' : filterKey === 'direct' ? 'Private Threads' : 'Broadcasts'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 rounded-2xl border border-slate-200 overflow-hidden flex-1 mt-4 shadow-sm bg-white min-h-[500px] lg:min-h-[560px] h-[calc(100dvh-15.5rem)] sm:h-[calc(100dvh-13rem)] max-h-[calc(100dvh-8rem)]">
        {/* Left Column: Conversation Threads (5 Cols) */}
        <div className={`lg:col-span-5 border-r border-slate-200 flex flex-col justify-between overflow-hidden bg-white h-full ${mobileActiveView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  mainTab === 'admin_desk'
                    ? 'Search admin desk threads...'
                    : 'Search buyer-seller trade inquiries...'
                }
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">
                  {mainTab === 'admin_desk' ? 'No admin desk messages' : 'No buyer-seller trade chats yet'}
                </p>
                <p className="mt-1">
                  {mainTab === 'admin_desk'
                    ? 'Use the button above to broadcast or message a seller.'
                    : 'Inquiries between buyers and sellers will display here.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv: InquiryConversation) => {
                const isSelected = conv.id === activeConv?.id;
                const isTrade = isTradeChat(conv);

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setMobileActiveView('chat');
                    }}
                    className={`p-3.5 cursor-pointer transition flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-[#0A6CFF]'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Badge Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                        isTrade
                          ? 'bg-purple-100 text-purple-800'
                          : conv.type === 'broadcast'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isTrade ? (
                        <Store className="w-4 h-4 text-purple-600" />
                      ) : conv.type === 'broadcast' ? (
                        <Radio className="w-4 h-4 text-amber-600" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-blue-600" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-black text-xs text-slate-900 truncate">
                          {isTrade ? conv.buyerCompanyName : conv.sellerCompanyName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {conv.lastMessageTime}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-slate-700 truncate">
                        {isTrade ? `Ref: ${conv.productTitle}` : conv.productTitle}
                      </div>

                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                        {conv.lastMessageText}
                      </div>

                      {/* Pill tags */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isTrade ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Trade Chat ({conv.buyerCompanyName} ↔ {conv.sellerCompanyName})
                          </span>
                        ) : conv.type === 'broadcast' ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Platform Broadcast
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Private Desk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat View (7 Cols) */}
        <div className={`lg:col-span-7 flex flex-col justify-between overflow-hidden bg-slate-50/50 h-full ${mobileActiveView === 'list' ? 'hidden lg:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileActiveView('list')}
                    className="lg:hidden p-1.5 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-0.5 text-[12px] font-bold shrink-0 cursor-pointer"
                    title="Back to conversation list"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-[11px] pr-0.5">Threads</span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 truncate">
                        {activeConv.productTitle}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                        {isTradeChat(activeConv) ? 'Marketplace' : 'Admin Desk'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 mt-1 truncate">
                      <span>
                        Seller: <strong className="text-slate-800">{activeConv.sellerCompanyName}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Buyer: <strong className="text-slate-800">{activeConv.buyerCompanyName}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {activeConv.messages.map((m: ChatMessage) => {
                  const isAdmin = m.senderRole === 'admin';
                  const isSeller = m.senderRole === 'seller';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-black text-slate-700">
                          {m.senderName}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            isAdmin
                              ? 'bg-blue-600 text-white'
                              : isSeller
                              ? 'bg-emerald-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          {m.senderRole}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed font-medium ${
                          isAdmin
                            ? 'bg-[#0A6CFF] text-white shadow-xs'
                            : isSeller
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                            : 'bg-white border border-slate-200 text-slate-900 shadow-2xs'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box (only active for Admin Desk threads) */}
              <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    isTradeChat(activeConv)
                      ? 'Type an administrative note / mediator guidance...'
                      : 'Type an official admin desk response...'
                  }
                  className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF] font-medium"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-xs px-5 py-2.5 rounded-full transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 my-auto flex flex-col items-center justify-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm">Select a Conversation</h3>
              <p className="text-xs mt-1">Select any conversation thread from the left to view details.</p>
              <button
                type="button"
                onClick={() => setMobileActiveView('list')}
                className="mt-4 lg:hidden px-4 py-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                &larr; Back to Threads List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Direct Seller Modal */}
      {showDirectSellerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#0B1F3A] flex items-center justify-center text-[#00E5FF]">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Message Seller Privately</h3>
                  <p className="text-xs text-slate-500">Open a dedicated admin support thread with a registered seller.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectSellerModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  placeholder="Search sellers by company name..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Seller List */}
            <div className="flex-1 overflow-y-auto mt-3 border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-48">
              {loadingSellers ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading registered sellers...</div>
              ) : filteredSellersInModal.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                  <Store className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="font-bold text-slate-700">No active sellers found</span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    {sellerSearch ? 'No sellers matching your search query.' : 'There are currently no active registered sellers on the platform.'}
                  </span>
                </div>
              ) : (
                filteredSellersInModal.map((seller) => {
                  const isChosen = selectedSeller?.id === seller.id;
                  return (
                    <div
                      key={seller.id}
                      onClick={() => {
                        setSelectedSeller(seller);
                        setDirectMsgError(null);
                        setDirectMsgSuccess(null);
                      }}
                      className={`p-3 cursor-pointer transition flex items-center justify-between ${
                        isChosen ? 'bg-blue-50 border-l-4 border-[#0A6CFF]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{seller.company_name}</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.2 rounded-full">
                            Verified Seller
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {seller.contact_name} • {seller.contact_email}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[#0A6CFF]">
                        {isChosen ? '✓ Selected' : 'Select'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message composer for chosen seller */}
            {selectedSeller && (
              <form onSubmit={handleSendDirectToSeller} className="mt-4 space-y-3 pt-3 border-t border-slate-100">
                {directMsgError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 font-bold">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{directMsgError}</span>
                  </div>
                )}

                {directMsgSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{directMsgSuccess}</span>
                  </div>
                )}

                <div className="text-xs font-bold text-slate-700">
                  Sending to: <span className="text-blue-600">{selectedSeller.company_name}</span> ({selectedSeller.contact_name})
                </div>
                <textarea
                  required
                  disabled={isSendingDirect || !!directMsgSuccess}
                  rows={3}
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  placeholder="Type your private message from the Admin Desk..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium disabled:opacity-60"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isSendingDirect || !!directMsgSuccess}
                    onClick={() => {
                      setSelectedSeller(null);
                      setDirectMsgError(null);
                    }}
                    className="w-1/2 py-2 rounded-full border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingDirect || !directMsgText.trim() || !!directMsgSuccess}
                    className="w-1/2 py-2 rounded-full bg-[#0B1F3A] hover:bg-[#132A4C] text-white font-black text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSendingDirect ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : directMsgSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Message Sent!</span>
                      </>
                    ) : (
                      'Send Private Message'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Platform Broadcast Composer</h3>
                  <p className="text-xs text-slate-500">Dispatch updates to all registered sellers or buyers.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-2">
                  Target Audience:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    onClick={() => {
                      setBroadcastTarget('seller');
                      setBroadcastTitle('Platform Update for Verified Sellers');
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col gap-1 ${
                      broadcastTarget === 'seller'
                        ? 'border-blue-500 bg-blue-50/60 text-blue-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">All Sellers</span>
                      <input
                        type="radio"
                        checked={broadcastTarget === 'seller'}
                        onChange={() => {}}
                        className="text-blue-600"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Delivered to all registered supplier accounts.
                    </span>
                  </label>

                  <label
                    onClick={() => {
                      setBroadcastTarget('buyer');
                      setBroadcastTitle('Global Wholesale Sourcing Update for Buyers');
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col gap-1 ${
                      broadcastTarget === 'buyer'
                        ? 'border-purple-500 bg-purple-50/60 text-purple-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">All Buyers</span>
                      <input
                        type="radio"
                        checked={broadcastTarget === 'buyer'}
                        onChange={() => {}}
                        className="text-purple-600"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Dispatched to all verified procurement accounts.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Broadcast Title</label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Enter broadcast announcement text..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting || !broadcastText.trim()}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isBroadcasting ? 'Broadcasting...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiteAdminMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 text-xs">
          Loading messaging center...
        </div>
      }
    >
      <SiteAdminMessagesContent />
    </Suspense>
  );
}
