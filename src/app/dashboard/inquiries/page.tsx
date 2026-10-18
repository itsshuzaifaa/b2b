'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getConversationsForUser,
  sendInquiryMessage,
  markConversationAsRead,
  syncWithSupabase,
  isMessageSentByMe,
  type InquiryConversation,
} from '@/lib/messaging/messaging-store';
import { UpgradeMembershipModal } from '@/components/modals/UpgradeMembershipModal';
import { isLeadUnlocked, unlockLead, getRemainingUnlocks } from '@/lib/leads/unlock-store';
import type { MembershipTier } from '@/types/database';
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
  Lock,
  Unlock,
  Sparkles,
  Package,
  FileText,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  Check,
  ArrowRight,
  Eye,
  ChevronLeft,
} from 'lucide-react';

function InquiriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');
  const { company, role } = useAuth();
  const isBuyer = role === 'buyer';

  const [conversations, setConversations] = useState<InquiryConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(targetId || '');
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>(targetId ? 'chat' : 'list');
  const [filterTab, setFilterTab] = useState<'all' | 'buyers' | 'admin' | 'broadcast'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [replyText, setReplyText] = useState('');
  const [unlockTrigger, setUnlockTrigger] = useState(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{ title: string; subtitle: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  const companyId = company?.id;
  const companyEmail = company?.email;
  const currentTier = ((company?.tier || company?.membership_tier || 'bronze') as string).toLowerCase() as MembershipTier;
  const remainingUnlocks = company ? getRemainingUnlocks(company.id, currentTier) : 0;

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
          setMobileActiveView('chat');
        } else {
          setActiveConversationId(targetId);
          setMobileActiveView('chat');
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
    const handleUnlockEvent = () => setUnlockTrigger((prev) => prev + 1);
    window.addEventListener('b2b_inquiry_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('b2b_lead_unlock_update', handleUnlockEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('b2b_inquiry_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('b2b_lead_unlock_update', handleUnlockEvent);
    };
  }, [companyId, companyEmail, role, targetId, unlockTrigger]);

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
      if (newTab === 'buyers') return c.type === 'buyer_seller' && !c.broadcastKind;
      if (newTab === 'admin') return (c.type === 'seller_admin' || c.type === 'broadcast') && !c.broadcastKind;
      if (newTab === 'broadcast') return c.type === 'broadcast' || Boolean(c.broadcastKind);
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
    if (filterTab === 'buyers' && (c.type !== 'buyer_seller' || Boolean(c.broadcastKind))) return false;
    if (filterTab === 'admin' && ((c.type !== 'seller_admin' && c.type !== 'broadcast') || Boolean(c.broadcastKind))) return false;
    if (filterTab === 'broadcast' && c.type !== 'broadcast' && !c.broadcastKind) return false;

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

  // Broadcast & Privacy State for active conversation
  const isMemberBroadcast = Boolean(activeConv?.broadcastKind || (activeConv?.type === 'broadcast' && activeConv?.broadcastDetails));
  const broadcastKind = activeConv?.broadcastKind || activeConv?.broadcastDetails?.itemType || (activeConv?.status === 'broadcast_wtb' ? 'wtb' : activeConv?.status === 'broadcast_wts' ? 'wts' : null);

  const isBroadcastOwner = Boolean(
    company &&
    activeConv &&
    isMemberBroadcast &&
    (activeConv.broadcastDetails?.ownerCompanyId === company.id ||
      activeConv.sellerCompanyId === company.id ||
      (company.email &&
        (activeConv.buyerEmail?.toLowerCase() === company.email.toLowerCase() ||
         activeConv.broadcastDetails?.ownerEmail?.toLowerCase() === company.email.toLowerCase())))
  );

  const isContactUnlocked = Boolean(
    company &&
    activeConv &&
    (isBroadcastOwner ||
      isLeadUnlocked(company.id, activeConv.id) ||
      (activeConv.productId ? isLeadUnlocked(company.id, activeConv.productId) : false))
  );

  const handleUnlockBroadcastContact = () => {
    if (!company) {
      router.push(`/login?redirect=/dashboard/inquiries?id=${activeConv?.id || ''}`);
      return;
    }
    if (!activeConv) return;

    const res = unlockLead(company.id, activeConv.id, currentTier);
    if (!res.success) {
      setUpgradeModalConfig({
        title: 'Upgrade to Unlock Trader Contact',
        subtitle: res.error || 'You have reached your contact unlock limit on your current plan. Upgrade to immediately reveal verified counterparty emails, phone numbers, and company credentials.',
      });
      setUpgradeModalOpen(true);
    } else {
      if (activeConv.productId) {
        unlockLead(company.id, activeConv.productId, currentTier);
      }
      setUnlockTrigger((prev) => prev + 1);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv) return;

    if (isMemberBroadcast && !isBroadcastOwner && !isContactUnlocked) {
      handleUnlockBroadcastContact();
      return;
    }

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
    if (isMemberBroadcast && !isBroadcastOwner && !isContactUnlocked) {
      handleUnlockBroadcastContact();
      return;
    }
    if (presetType === 'quote') {
      const priceStr = activeConv.productPrice ? `€${activeConv.productPrice.toFixed(2)}` : 'our agreed trade price';
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
  const buyersCount = conversations.filter((c) => c.type === 'buyer_seller' && !c.broadcastKind).length;
  const broadcastCount = conversations.filter((c) => c.type === 'broadcast' || Boolean(c.broadcastKind)).length;
  const adminCount = conversations.filter((c) => (c.type === 'seller_admin' || c.type === 'broadcast') && !c.broadcastKind).length;

  const recipientName = activeConv
    ? isMemberBroadcast
      ? isBroadcastOwner
        ? 'Network Members'
        : isContactUnlocked
        ? activeConv.broadcastDetails?.ownerCompanyName || activeConv.sellerCompanyName || 'Trader'
        : broadcastKind === 'wtb'
        ? 'Verified Wholesale Buyer'
        : 'Verified Wholesale Supplier'
      : isBuyer
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
          { id: 'broadcast', label: 'Network Broadcasts', count: broadcastCount },
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
      <div className="bg-white border border-[#E2E8F0] rounded-[20px] sm:rounded-[24px] shadow-[0_2px_14px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col lg:grid lg:grid-cols-12 flex-1 min-h-[500px] lg:min-h-[580px] h-[calc(100dvh-13.5rem)] sm:h-[calc(100dvh-11rem)] max-h-[calc(100dvh-7.5rem)]">
        {/* LEFT COLUMN: Conversation Threads List (5 Cols) */}
        <div className={`lg:col-span-5 border-r border-[#E2E8F0] bg-white flex flex-col justify-between overflow-hidden h-full ${mobileActiveView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
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
                  When you contact a supplier about a wholesale stock lot on Marketplace, or when you broadcast a requirement, your direct threads appear right here.
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
                const isConvBroadcast = Boolean(conv.broadcastKind || (conv.type === 'broadcast' && conv.broadcastDetails));
                const convKind = conv.broadcastKind || conv.broadcastDetails?.itemType || (conv.status === 'broadcast_wtb' ? 'wtb' : conv.status === 'broadcast_wts' ? 'wts' : null);
                const isAdminDesk = (conv.type === 'seller_admin' || conv.type === 'broadcast') && !conv.broadcastKind && !conv.broadcastDetails;

                const isBroadcastOwnerInThread = Boolean(
                  company &&
                  isConvBroadcast &&
                  (conv.broadcastDetails?.ownerCompanyId === company.id ||
                    conv.sellerCompanyId === company.id ||
                    (company.email &&
                      (conv.buyerEmail?.toLowerCase() === company.email.toLowerCase() ||
                       conv.broadcastDetails?.ownerEmail?.toLowerCase() === company.email.toLowerCase())))
                );

                const isContactUnlockedInThread = Boolean(
                  company &&
                  (isBroadcastOwnerInThread ||
                    isLeadUnlocked(company.id, conv.id) ||
                    (conv.productId ? isLeadUnlocked(company.id, conv.productId) : false))
                );

                const isChatWithSupplier = Boolean(company && conv.sellerCompanyId !== company.id);

                let otherPartyName = '';
                if (isAdminDesk) {
                  otherPartyName = 'Jeff Vetting Director (B2B LINK Desk)';
                } else if (isConvBroadcast) {
                  if (isBroadcastOwnerInThread) {
                    otherPartyName = `You (${convKind === 'wtb' ? 'WTB Broadcast' : 'WTS Broadcast'})`;
                  } else if (isContactUnlockedInThread) {
                    otherPartyName = conv.broadcastDetails?.ownerCompanyName || conv.sellerCompanyName || 'Verified Partner';
                  } else {
                    otherPartyName = convKind === 'wtb' ? 'Verified Wholesale Buyer' : 'Verified Wholesale Supplier';
                  }
                } else if (isChatWithSupplier) {
                  otherPartyName = conv.sellerCompanyName;
                } else {
                  otherPartyName = conv.buyerContactName || conv.buyerCompanyName || 'Commercial Buyer';
                }

                const monogram = isAdminDesk
                  ? 'JF'
                  : isConvBroadcast
                  ? (convKind === 'wtb' ? 'WTB' : 'WTS')
                  : getMonogram(otherPartyName);

                const hasUnread = isBuyer ? conv.unreadByBuyer : conv.unreadBySeller;

                let shortTime = conv.lastMessageTime || 'Just now';
                if (shortTime.toLowerCase().includes('just now')) shortTime = 'Just now';
                else if (shortTime.includes('ago')) shortTime = shortTime.replace(' ago', '');

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setMobileActiveView('chat');
                    }}
                    className={`relative flex items-start gap-3 p-3.5 transition cursor-pointer select-none ${
                      isSelected
                        ? 'border-l-[3.5px] border-l-[#0A6CFF] bg-[#F8FAFC]/90'
                        : 'border-l-[3.5px] border-l-transparent hover:bg-[#F8FAFC]/50'
                    }`}
                  >
                    {/* Circle Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full font-bold text-[11px] flex items-center justify-center shrink-0 ${
                        isAdminDesk
                          ? 'bg-[#0B1528] text-[#00E5FF] ring-2 ring-slate-800'
                          : isConvBroadcast
                          ? convKind === 'wtb'
                            ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                            : 'bg-blue-100 text-[#0A6CFF] ring-1 ring-blue-300'
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

                      {/* Pill Badges */}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {isAdminDesk ? (
                          <span className="inline-block bg-[#0B1528] text-[#00E5FF] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Jeff &bull; Desk Support
                          </span>
                        ) : isConvBroadcast ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[210px] ${
                              convKind === 'wtb'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            <span>{convKind === 'wtb' ? 'WTB Broadcast' : 'WTS Broadcast'}</span>
                            {!isBroadcastOwnerInThread && (
                              <span className="text-[9px] font-semibold opacity-75">
                                {isContactUnlockedInThread ? '· Unlocked' : '· Locked'}
                              </span>
                            )}
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
        <div className={`lg:col-span-7 flex flex-col justify-between bg-white overflow-hidden h-full ${mobileActiveView === 'list' ? 'hidden lg:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Chat Header Bar */}
              {(() => {
                const activeIsChatWithSupplier = Boolean(company && activeConv.sellerCompanyId !== company.id);
                const isAdminDesk = (activeConv.type === 'seller_admin' || activeConv.type === 'broadcast') && !activeConv.broadcastKind && !activeConv.broadcastDetails;

                let activeHeaderName = '';
                if (isAdminDesk) {
                  activeHeaderName = 'Jeff Vetting Director (B2B LINK Desk)';
                } else if (isMemberBroadcast) {
                  if (isBroadcastOwner) {
                    activeHeaderName = `My ${broadcastKind === 'wtb' ? 'WTB Procurement' : 'WTS Stock'} Broadcast`;
                  } else if (isContactUnlocked) {
                    activeHeaderName = activeConv.broadcastDetails?.ownerCompanyName || activeConv.sellerCompanyName || 'Verified Partner';
                  } else {
                    activeHeaderName = broadcastKind === 'wtb' ? 'Verified Wholesale Buyer (Contact Protected)' : 'Verified Wholesale Supplier (Contact Protected)';
                  }
                } else if (activeIsChatWithSupplier) {
                  activeHeaderName = activeConv.sellerCompanyName;
                } else {
                  activeHeaderName = activeConv.buyerContactName || activeConv.buyerCompanyName || 'Commercial Buyer';
                }

                const activeMonogram = isAdminDesk
                  ? 'JF'
                  : isMemberBroadcast
                  ? (broadcastKind === 'wtb' ? 'WTB' : 'WTS')
                  : getMonogram(activeHeaderName);

                return (
                  <div className="p-3.5 sm:p-4 bg-white border-b border-[#E2E8F0] shrink-0 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {/* Mobile Back Button to Chat List */}
                      <button
                        type="button"
                        onClick={() => setMobileActiveView('list')}
                        className="lg:hidden p-1.5 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] transition flex items-center gap-0.5 text-[12px] font-bold shrink-0 cursor-pointer"
                        title="Back to conversations"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[11px] pr-0.5">Chats</span>
                      </button>

                      {/* Square rounded avatar */}
                      <div
                        className={`w-9 sm:w-10 h-9 sm:h-10 rounded-xl flex items-center justify-center font-bold text-[12px] sm:text-[13px] shrink-0 ${
                          isAdminDesk
                            ? 'bg-[#0B1528] text-[#00E5FF]'
                            : isMemberBroadcast
                            ? broadcastKind === 'wtb'
                              ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                              : 'bg-blue-100 text-[#0A6CFF] ring-1 ring-blue-300'
                            : 'bg-[#DDE7F5] text-[#334155]'
                        }`}
                      >
                        {activeMonogram}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-[14px] sm:text-[15px] text-[#0F172A] truncate">
                          {activeHeaderName}
                        </h3>
                        <p className="text-[11px] sm:text-[12px] text-[#64748B] truncate mt-0.5 font-normal">
                          {isAdminDesk
                            ? 'Official direct support & platform advisory channel'
                            : isMemberBroadcast
                            ? `${activeConv.broadcastDetails?.title || activeConv.productTitle} · ${activeConv.broadcastDetails?.quantity || activeConv.productMoq} units · €${(activeConv.broadcastDetails?.price || activeConv.productPrice || 0).toFixed(2)}`
                            : `${activeConv.productTitle}${activeConv.productPrice ? ` · €${activeConv.productPrice.toFixed(2)}` : ''}`}
                        </p>
                      </div>
                    </div>

                    {/* Right Badges & Action */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {isMemberBroadcast ? (
                        isBroadcastOwner ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>My Broadcast</span>
                          </span>
                        ) : isContactUnlocked ? (
                          <span className="inline-flex items-center gap-1 bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Contact Unlocked</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleUnlockBroadcastContact}
                            className="inline-flex items-center gap-1 bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs transition cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Unlock Contact</span>
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>In-app verified</span>
                        </span>
                      )}

                      <Link
                        href={
                          activeConv.productId && !activeConv.productId.startsWith('00000000') && !activeConv.productId.startsWith('broadcast-')
                            ? `/marketplace/${activeConv.productId}`
                            : '/marketplace'
                        }
                        className="bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] text-[12px] font-semibold px-3 py-1 rounded-full transition shadow-2xs inline-flex items-center gap-1"
                      >
                        <span>{isMemberBroadcast ? 'Marketplace' : 'View listing'}</span>
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Chat Messages Body */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white">
                {/* Broadcast Opportunity Summary Card */}
                {isMemberBroadcast && (
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs space-y-0 mb-4">
                    {/* Header */}
                    <div className={`p-4 ${broadcastKind === 'wtb' ? 'bg-emerald-50/70 border-b border-emerald-100' : 'bg-blue-50/70 border-b border-blue-100'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            broadcastKind === 'wtb' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {broadcastKind === 'wtb' ? 'WTB Procurement Broadcast' : 'WTS Wholesale Stock Broadcast'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {activeConv.broadcastDetails?.category || 'Wholesale Goods'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <Radio className="w-3 h-3 text-[#0A6CFF] animate-pulse" />
                          <span>Network Wide</span>
                        </span>
                      </div>
                      <h3 className="text-[16px] font-black text-[#0B1F3A] mt-2">
                        {activeConv.broadcastDetails?.title || activeConv.productTitle}
                      </h3>
                      {activeConv.broadcastDetails?.brand && (
                        <p className="text-[12px] text-slate-600 font-medium mt-0.5">
                          Brand: <strong>{activeConv.broadcastDetails.brand}</strong>
                        </p>
                      )}
                    </div>

                    {/* Specification Grid */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white text-[12px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-[#64748B] block font-medium">
                          {broadcastKind === 'wtb' ? 'Target Price' : 'Unit Price'}
                        </span>
                        <strong className="text-[14px] font-bold text-[#0B1F3A] mt-0.5 block">
                          €{(activeConv.broadcastDetails?.price || activeConv.productPrice || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-[#64748B] block font-medium">
                          {broadcastKind === 'wtb' ? 'Required Quantity' : 'Available Stock'}
                        </span>
                        <strong className="text-[14px] font-bold text-[#0B1F3A] mt-0.5 block">
                          {(activeConv.broadcastDetails?.quantity || activeConv.productMoq || 0).toLocaleString()} units
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-[#64748B] block font-medium">Total Lot Value</span>
                        <strong className="text-[14px] font-bold text-[#0A6CFF] mt-0.5 block">
                          €{(
                            (activeConv.broadcastDetails?.quantity || activeConv.productMoq || 0) *
                            (activeConv.broadcastDetails?.price || activeConv.productPrice || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-[#64748B] block font-medium">
                          {broadcastKind === 'wtb' ? 'Min Order (MOQ)' : 'Condition'}
                        </span>
                        <strong className="text-[14px] font-bold text-[#0B1F3A] mt-0.5 block truncate">
                          {broadcastKind === 'wtb'
                            ? `${activeConv.broadcastDetails?.moq || 1} units`
                            : activeConv.broadcastDetails?.condition || 'Brand New'}
                        </strong>
                      </div>
                    </div>

                    {/* Barcode & Notes */}
                    {(activeConv.broadcastDetails?.barcode || activeConv.broadcastDetails?.notes) && (
                      <div className="px-4 pb-3.5 pt-1 text-[12px] text-slate-600 space-y-1">
                        {activeConv.broadcastDetails?.barcode && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Barcode / EAN:</span>
                            <span className="font-mono font-bold text-slate-800">{activeConv.broadcastDetails.barcode}</span>
                          </div>
                        )}
                        {activeConv.broadcastDetails?.notes && (
                          <p className="text-[12px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 leading-relaxed italic">
                            &quot;{activeConv.broadcastDetails.notes}&quot;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Contact Privacy Section */}
                    <div className="p-4 border-t border-slate-100 bg-[#F8FAFC]">
                      {isBroadcastOwner ? (
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[12px]">
                          <Radio className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <span className="font-bold">Your opportunity is broadcasted to verified network members.</span>
                            <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                              Members can inspect all requirement specifications. Your personal contact details (email, phone, company name) are kept private until they use an unlock credit to connect directly.
                            </p>
                          </div>
                        </div>
                      ) : !isContactUnlocked ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-[13px] font-bold text-slate-900">Trader Contact Details Protected</h4>
                                <p className="text-[11px] text-slate-500">
                                  Specifications are visible. Unlock contact credentials to reveal company name, direct telephone, email, and quote.
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shrink-0">
                              {remainingUnlocks === Infinity ? 'Unlimited Unlocks' : `${remainingUnlocks} unlocks left`}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-slate-200 text-[12px]">
                            <div className="flex items-center gap-2 text-slate-500">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Company:</span>
                              <span className="font-semibold text-slate-800 tracking-wider">•••••••••••• Ltd</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>Representative:</span>
                              <span className="font-semibold text-slate-800 tracking-wider">•••••••• ••••••••</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>Direct Email:</span>
                              <span className="font-semibold text-slate-800 tracking-wider">••••••••@••••••••.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>Direct Phone:</span>
                              <span className="font-semibold text-slate-800 tracking-wider">+44 ••••• ••••••</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleUnlockBroadcastContact}
                            className="w-full py-2.5 rounded-xl bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[13px] font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <Unlock className="w-4 h-4" />
                            <span>Unlock Trader Contact Details Now</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px]">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-bold text-emerald-950">Verified Trader Contact Unlocked</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-white/90 border border-emerald-100">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Company:</span>
                              <strong className="text-slate-900 truncate">
                                {activeConv.broadcastDetails?.ownerCompanyName || activeConv.sellerCompanyName || activeConv.buyerCompanyName}
                              </strong>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Representative:</span>
                              <strong className="text-slate-900 truncate">
                                {activeConv.broadcastDetails?.ownerContactName || activeConv.sellerContactName || activeConv.buyerContactName || 'Trader'}
                              </strong>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Email:</span>
                              <a
                                href={`mailto:${activeConv.broadcastDetails?.ownerEmail || activeConv.buyerEmail}`}
                                className="font-bold text-[#0A6CFF] hover:underline truncate"
                              >
                                {activeConv.broadcastDetails?.ownerEmail || activeConv.buyerEmail || 'Available via chat'}
                              </a>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Phone:</span>
                              <span className="font-bold text-slate-900 truncate">
                                {activeConv.broadcastDetails?.ownerPhone || activeConv.buyerPhone || 'Available via chat'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                        className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed max-w-[78%] break-words whitespace-pre-line ${
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

              {/* Chat Input Section */}
              {isMemberBroadcast && !isBroadcastOwner && !isContactUnlocked ? (
                /* Gated locked bar */
                <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-700 text-[12px] font-medium">
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Trader contact is locked. Unlock counterparty to send direct quotes, negotiate, or trade.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlockBroadcastContact}
                    className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock Contact ({remainingUnlocks === Infinity ? 'Unlimited' : `${remainingUnlocks} left`})</span>
                  </button>
                </div>
              ) : (
                <>
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
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-[#64748B]">
              <div className="w-16 h-16 rounded-full bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-[17px] font-bold text-[#0F172A]">Your Wholesale Conversations</h3>
              <p className="text-[13px] text-[#5B6B82] max-w-md mt-1.5 leading-relaxed">
                When you initiate a direct product inquiry with a supplier on Marketplace, or when you receive a broadcast response, your real-time messages appear here.
              </p>
              <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => setMobileActiveView('list')}
                  className="lg:hidden px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] font-bold text-[13px] transition cursor-pointer"
                >
                  &larr; View All Conversations
                </button>
                <Link
                  href="/marketplace"
                  className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] transition shadow-xs inline-flex items-center gap-2"
                >
                  <span>Browse Marketplace Products</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UPGRADE MEMBERSHIP MODAL */}
      <UpgradeMembershipModal
        isOpen={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          setUpgradeModalConfig(null);
        }}
        title={upgradeModalConfig?.title}
        subtitle={upgradeModalConfig?.subtitle}
      />
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
