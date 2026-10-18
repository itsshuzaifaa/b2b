'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
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
} from 'lucide-react';

function AdminMessagesContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');
  const { company } = useAuth();

  const [conversations, setConversations] = useState<InquiryConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(targetId || '');
  const [filterType, setFilterType] = useState<'all' | 'admin_desk' | 'broadcast_seller' | 'broadcast_buyer'>('all');
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  const loadData = () => {
    const all = getStoredConversations();
    setConversations(all);
    if (!hasInitializedRef.current && all.length > 0) {
      hasInitializedRef.current = true;
      setActiveConversationId(targetId || all[0].id);
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

  // Tab change handler that immediately tabs out to the selected channel
  const handleTabChange = (newType: typeof filterType) => {
    setFilterType(newType);
    const inTab = conversations.filter((c) => {
      if (newType === 'admin_desk') return c.type === 'seller_admin';
      if (newType === 'broadcast_seller') {
        return c.type === 'broadcast' && (c.targetAudience === 'seller' || c.status === 'broadcast_seller');
      }
      if (newType === 'broadcast_buyer') {
        return c.type === 'broadcast' && (c.targetAudience === 'buyer' || c.status === 'broadcast_buyer');
      }
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

  const filteredConversations = conversations.filter((c) => {
    // Type filter
    if (filterType === 'admin_desk' && c.type !== 'seller_admin') return false;
    if (filterType === 'broadcast_seller') {
      return c.type === 'broadcast' && (c.targetAudience === 'seller' || c.status === 'broadcast_seller');
    }
    if (filterType === 'broadcast_buyer') {
      return c.type === 'broadcast' && (c.targetAudience === 'buyer' || c.status === 'broadcast_buyer');
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

  const activeConv =
    filteredConversations.find((c) => c.id === activeConversationId) ||
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

  // Load registered sellers when Direct Seller modal opens
  const handleOpenDirectSellerModal = async () => {
    setShowDirectSellerModal(true);
    setLoadingSellers(true);
    const sellers = await fetchAllSellersForAdmin();
    setRegisteredSellers(sellers);
    setLoadingSellers(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv) return;

    const senderRole = 'admin';
    const senderName = 'Jeff Vetting Director (B2B LINK Desk)';
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
      'Jeff Vetting Director (B2B LINK Desk)',
      'facbb93f-080f-480f-b54b-8ef26664da86'
    );

    setIsBroadcasting(false);
    if (conv) {
      setShowBroadcastModal(false);
      setBroadcastText('');
      setBroadcastNotice(
        broadcastTarget === 'seller'
          ? '📢 Broadcast successfully dispatched to all sellers! (Delivered as a personal direct message from Jeff)'
          : '📢 Broadcast successfully dispatched to all buyers!'
      );
      setTimeout(() => setBroadcastNotice(null), 5000);
      setActiveConversationId(conv.id);
      loadData();
    }
  };

  const handleSendDirectToSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller || !directMsgText.trim()) return;

    setIsSendingDirect(true);
    const conv = await sendAdminDirectMessage(
      selectedSeller.id,
      directMsgText.trim(),
      'Jeff Vetting Director (B2B LINK Desk)',
      'facbb93f-080f-480f-b54b-8ef26664da86'
    );

    setIsSendingDirect(false);
    if (conv) {
      setShowDirectSellerModal(false);
      setDirectMsgText('');
      setSelectedSeller(null);
      setBroadcastNotice(`🛡️ Private direct message sent to ${selectedSeller.company_name}!`);
      setTimeout(() => setBroadcastNotice(null), 5000);
      setActiveConversationId(conv.id);
      loadData();
    }
  };

  const handleInsertQuickPreset = (text: string) => {
    setReplyText(text);
  };

  // Filter registered sellers in modal
  const filteredSellersInModal = registeredSellers.filter((s) => {
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
            Real-time compliance monitoring, private direct desk support with sellers, and segmented broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('b2b_trigger_test_toast'));
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-full shadow-2xs flex items-center gap-1.5 cursor-pointer transition"
            title="Trigger instant bottom-right popup notification to test"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Test Popup</span>
          </button>

          {/* Issue 03: Message Seller Privately */}
          <button
            type="button"
            onClick={handleOpenDirectSellerModal}
            className="bg-[#0B1F3A] hover:bg-[#132A4C] text-white font-black text-xs px-4 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
          >
            <PlusCircle className="w-4 h-4 text-[#00E5FF]" />
            <span>+ Message Seller Privately</span>
          </button>

          {/* Issue 01: Broadcast Modal */}
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
          >
            <Radio className="w-4 h-4 animate-pulse" />
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

      {/* Filter Tabs with Dynamic Counts */}
      <div className="flex items-center gap-2.5 mt-4 overflow-x-auto pb-1 select-none">
        {[
          { id: 'all', label: 'All Admin Channels', count: conversations.length },
          { id: 'admin_desk', label: '🛡️ Seller <-> Admin Desk', count: conversations.filter((c) => c.type === 'seller_admin').length },
          { id: 'broadcast_seller', label: '📢 Sellers Broadcast', count: conversations.filter((c) => c.type === 'broadcast' && (c.targetAudience === 'seller' || c.status === 'broadcast_seller')).length },
          { id: 'broadcast_buyer', label: '📢 Buyers Broadcast', count: conversations.filter((c) => c.type === 'broadcast' && (c.targetAudience === 'buyer' || c.status === 'broadcast_buyer')).length },
        ].map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id as typeof filterType)}
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

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200 overflow-hidden flex-1 mt-4 shadow-sm bg-white min-h-[560px]">
        {/* Left Column: Conversation Threads (5 Cols) */}
        <div className="lg:col-span-5 border-r border-slate-200 flex flex-col justify-between overflow-hidden bg-white">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company, product, or keywords..."
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
                <p className="font-bold text-slate-700">No conversations in this filter</p>
                <p className="mt-1">Inquiries and seller chats will populate here live.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConv?.id;
                const isSellerBroadcast = conv.targetAudience === 'seller' || conv.status === 'broadcast_seller';
                const isBuyerBroadcast = conv.targetAudience === 'buyer' || conv.status === 'broadcast_buyer';
                const isBroadcast = conv.type === 'broadcast' || isSellerBroadcast || isBuyerBroadcast;
                const isAdminDesk = conv.type === 'seller_admin';

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`p-3.5 cursor-pointer transition flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-[#0A6CFF]'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Badge Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                        isSellerBroadcast
                          ? 'bg-cyan-100 text-cyan-800'
                          : isBuyerBroadcast
                          ? 'bg-amber-100 text-amber-800'
                          : isAdminDesk
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSellerBroadcast ? (
                        <ShieldCheck className="w-4 h-4 text-cyan-600" />
                      ) : isBuyerBroadcast ? (
                        <Radio className="w-4 h-4 text-amber-600" />
                      ) : isAdminDesk ? (
                        <ShieldAlert className="w-4 h-4 text-blue-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-black text-xs text-slate-900 truncate">
                          {isSellerBroadcast
                            ? '📢 Sellers Broadcast'
                            : isBuyerBroadcast
                            ? '📢 Buyers Broadcast'
                            : isAdminDesk
                            ? conv.sellerCompanyName
                            : conv.buyerCompanyName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {conv.lastMessageTime}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-slate-700 truncate">
                        {isBroadcast
                          ? conv.productTitle
                          : isAdminDesk
                          ? `Desk: ${conv.sellerContactName || 'Seller Rep'}`
                          : `Ref: ${conv.productTitle}`}
                      </div>

                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                        {conv.lastMessageText}
                      </div>

                      {/* Pill tags */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isSellerBroadcast && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                            Delivered to all sellers as Jeff
                          </span>
                        )}
                        {isBuyerBroadcast && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Buyers Broadcast Only
                          </span>
                        )}
                        {isAdminDesk && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Seller Direct Desk
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

        {/* Right Column: Chat View & Inspector (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between overflow-hidden bg-slate-50/50">
          {activeConv ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-4 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 truncate">
                      {activeConv.productTitle}
                    </h3>
                    {activeConv.targetAudience === 'seller' || activeConv.status === 'broadcast_seller' ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 shrink-0">
                        Sellers Broadcast
                      </span>
                    ) : activeConv.targetAudience === 'buyer' || activeConv.status === 'broadcast_buyer' ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        Buyers Broadcast
                      </span>
                    ) : activeConv.type === 'seller_admin' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                        Seller Direct
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                        Wholesale Trade
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>
                      Seller:{' '}
                      <strong className="text-slate-800">{activeConv.sellerCompanyName}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Counterparty:{' '}
                      <strong className="text-slate-800">{activeConv.buyerCompanyName}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {activeConv.messages.map((m) => {
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
                              : 'bg-slate-600 text-white'
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

              {/* Quick Reply Presets */}
              <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold text-slate-400 shrink-0">Admin Presets:</span>
                {[
                  'Your seller verification has been validated. You are cleared for wholesale orders.',
                  'Please provide intra-community VAT documentation for reverse charge compliance.',
                  'Pallet escrow settlement released. Carrier collection is confirmed.',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertQuickPreset(preset)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-medium transition cursor-pointer shrink-0 truncate max-w-[220px]"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type an official admin desk response..."
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
            <div className="p-12 text-center text-slate-400 my-auto">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm">Select a Conversation</h3>
              <p className="text-xs mt-1">Select any seller or buyer conversation from the left to inspect and message.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ISSUE 03 MODAL: Direct Message Any Seller Privately        */}
      {/* ========================================================= */}
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
                  <p className="text-xs text-slate-500">Search registered global sellers to start or open a private support thread.</p>
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
                  placeholder="Search sellers by company name or contact..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Seller List */}
            <div className="flex-1 overflow-y-auto mt-3 border border-slate-100 rounded-2xl divide-y divide-slate-100 max-h-48">
              {loadingSellers ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading sellers...</div>
              ) : filteredSellersInModal.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No sellers matching your search.</div>
              ) : (
                filteredSellersInModal.map((seller) => {
                  const isChosen = selectedSeller?.id === seller.id;
                  return (
                    <div
                      key={seller.id}
                      onClick={() => setSelectedSeller(seller)}
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
                <div className="text-xs font-bold text-slate-700">
                  Sending to: <span className="text-blue-600">{selectedSeller.company_name}</span> ({selectedSeller.contact_name})
                </div>
                <textarea
                  required
                  rows={3}
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  placeholder="Type your private message from the Admin Desk..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSeller(null)}
                    className="w-1/2 py-2 rounded-full border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingDirect || !directMsgText.trim()}
                    className="w-1/2 py-2 rounded-full bg-[#0B1F3A] hover:bg-[#132A4C] text-white font-black text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSendingDirect ? 'Sending...' : 'Send Private Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ISSUE 01 MODAL: Segmented Platform Broadcast Composer     */}
      {/* ========================================================= */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Platform Broadcast Composer</h3>
                  <p className="text-xs text-slate-500">Dispatch updates to sellers or buyers.</p>
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
              {/* Target Audience Segment Selector */}
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
                        ? 'border-cyan-500 bg-cyan-50/60 text-cyan-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">All Sellers</span>
                      <input
                        type="radio"
                        checked={broadcastTarget === 'seller'}
                        onChange={() => {}}
                        className="text-cyan-600"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Looks like a personal direct message from Jeff to each seller.
                    </span>
                  </label>

                  <label
                    onClick={() => {
                      setBroadcastTarget('buyer');
                      setBroadcastTitle('Global Wholesale Sourcing Update for Buyers');
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col gap-1 ${
                      broadcastTarget === 'buyer'
                        ? 'border-amber-500 bg-amber-50/60 text-amber-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">All Buyers</span>
                      <input
                        type="radio"
                        checked={broadcastTarget === 'buyer'}
                        onChange={() => {}}
                        className="text-amber-600"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Dispatched strictly to retail buyers and procurement leads.
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
                  placeholder={
                    broadcastTarget === 'seller'
                      ? 'Hi there, welcome to the platform. 0% transaction commissions are active...'
                      : 'Hello, new verified consumer electronics stock lots are available for direct order...'
                  }
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="w-1/2 py-2 rounded-full border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting || !broadcastText.trim()}
                  className="w-1/2 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isBroadcasting ? 'Dispatching...' : '📢 Dispatch Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading Admin Messaging Desk...</div>}>
      <AdminMessagesContent />
    </Suspense>
  );
}
