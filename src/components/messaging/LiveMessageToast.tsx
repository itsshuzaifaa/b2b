'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  onNewLiveMessage,
  sendInquiryMessage,
  syncWithSupabase,
  getStoredConversations,
  isMessageSentByMe,
  type ChatMessage,
  type InquiryConversation,
} from '@/lib/messaging/messaging-store';
import {
  MessageSquare,
  X,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Send,
  CheckCircle2,
  Radio,
  Sparkles,
} from 'lucide-react';

interface ActiveToast {
  id: string;
  message: ChatMessage;
  conversation: InquiryConversation;
  receivedAt: number;
}

export function LiveMessageToast() {
  const router = useRouter();
  const pathname = usePathname();
  const { company, role } = useAuth();
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [progress, setProgress] = useState(100);
  const isHoveredRef = useRef(false);

  // Play subtle web audio notification chime
  const playChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay blocked or unsupported
    }
  };

  // Toast notifications trigger ONLY when a new live message arrives while using the platform
  useEffect(() => {
    if (!company) return;

    // Background sync without intrusive initial popups on login
    void syncWithSupabase(role || undefined, company.id, company.email);
  }, [company, role]);

  useEffect(() => {
    const unsubscribe = onNewLiveMessage((data) => {
      const { message, conversation } = data;

      // 1. NEVER notify if message was sent by current user locally or by ID/email
      if (isMessageSentByMe(message.id)) return;
      if (company?.id && message.senderId === company.id) return;
      if (company?.email && (message.senderId === company.email || message.senderId === (company as any).contact_email)) return;
      if (company?.contact_name && message.senderName === company.contact_name) return;

      // 2. Strict recipient targeting:
      if (role === 'seller') {
        const isSellerBroadcast = conversation.targetAudience === 'seller' || conversation.status === 'broadcast_seller' || (conversation.type === 'broadcast' && !conversation.targetAudience);
        const isForMyCompany = conversation.sellerCompanyId === company?.id;
        if (!isSellerBroadcast && !isForMyCompany) return;
      } else if (role === 'buyer') {
        const isBuyerBroadcast = conversation.targetAudience === 'buyer' || conversation.status === 'broadcast_buyer';
        const isForMyCompany = conversation.buyerCompanyId === company?.id || (company?.email && conversation.buyerEmail?.toLowerCase() === company.email.toLowerCase());
        if (!isBuyerBroadcast && !isForMyCompany) return;
      }

      setActiveToast({
        id: message.id,
        message,
        conversation,
        receivedAt: Date.now(),
      });
      setReplySent(false);
      setQuickReplyText('');
      setIsReplying(false);
      setProgress(100);

      playChime();
    });

    // Also support manual test ping
    const handleTestPing = (e: Event) => {
      const customDetail = (e as CustomEvent).detail;
      const all = getStoredConversations();
      const target = customDetail || (all.length > 0 ? all[0] : null);
      if (target && target.messages?.length > 0) {
        const msg = target.messages[target.messages.length - 1];
        setActiveToast({
          id: `test-${Date.now()}`,
          message: msg,
          conversation: target,
          receivedAt: Date.now(),
        });
        setProgress(100);
        playChime();
      }
    };

    window.addEventListener('b2b_trigger_test_toast', handleTestPing);

    return () => {
      unsubscribe();
      window.removeEventListener('b2b_trigger_test_toast', handleTestPing);
    };
  }, [company, role, pathname]);

  // Auto-dismiss countdown timer (8 seconds)
  useEffect(() => {
    if (!activeToast || isReplying) return;

    const interval = setInterval(() => {
      if (isHoveredRef.current) return;

      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setActiveToast(null);
          return 0;
        }
        return Math.max(0, prev - 1.25);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeToast, isReplying]);

  if (!activeToast) return null;

  const { message, conversation } = activeToast;
  const isSellerBroadcast = conversation.targetAudience === 'seller' || conversation.status === 'broadcast_seller';
  const isBuyerBroadcast = conversation.targetAudience === 'buyer' || conversation.status === 'broadcast_buyer';
  const isBroadcast = Boolean(message.isBroadcast || conversation.type === 'broadcast' || isSellerBroadcast || isBuyerBroadcast);
  const isAdminDesk = conversation.type === 'seller_admin' || message.senderRole === 'admin';

  const handleOpenConversation = () => {
    setActiveToast(null);
    if (role === 'admin') {
      router.push(`/site-admin/messages?id=${conversation.id}`);
    } else {
      router.push(`/dashboard/inquiries?id=${conversation.id}`);
    }
  };

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim()) return;

    const senderRole = role === 'admin' ? 'admin' : role === 'buyer' ? 'buyer' : 'seller';
    const senderName =
      company?.contact_name ||
      (senderRole === 'admin' ? 'Jeff Vetting Director' : senderRole === 'buyer' ? 'Marcus Wright' : 'Lars Lindqvist');
    const senderId = company?.id || (senderRole === 'admin' ? 'admin-desk' : senderRole);

    sendInquiryMessage(conversation.id, senderRole, senderName, senderId, quickReplyText.trim());

    setReplySent(true);
    setQuickReplyText('');
    setTimeout(() => {
      setActiveToast(null);
    }, 2000);
  };

  return (
    <div
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
      className="fixed bottom-6 right-6 z-50 max-w-[390px] w-full animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto font-sans"
    >
      <div
        className={`rounded-[26px] p-5 shadow-[0_12px_44px_rgba(11,31,58,0.22)] border backdrop-blur-md transition-all relative overflow-hidden ${
          isSellerBroadcast
            ? 'bg-[#0B1F3A]/95 border-cyan-400/50 text-white'
            : isBuyerBroadcast
            ? 'bg-[#0B1F3A]/95 border-amber-400/50 text-white'
            : isAdminDesk
            ? 'bg-[#0B1F3A]/95 border-[#0A6CFF]/40 text-white'
            : 'bg-white/95 border-[#E2E8F0] text-[#0B1F3A]'
        }`}
      >
        {/* Top Progress Line */}
        {!isReplying && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-black/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                isSellerBroadcast ? 'bg-cyan-400' : isBuyerBroadcast ? 'bg-amber-400' : 'bg-[#0A6CFF]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            {isSellerBroadcast ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-200" />
                <span>Message from Jeff (Platform Desk)</span>
              </span>
            ) : isBuyerBroadcast ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>Buyers Broadcast</span>
              </span>
            ) : isAdminDesk ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-[#0A6CFF] text-white px-2.5 py-0.5 rounded-full">
                <ShieldAlert className="w-3 h-3" />
                <span>Admin Desk</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#0A6CFF] px-2.5 py-0.5 rounded-full">
                <MessageSquare className="w-3 h-3" />
                <span>Trade Message</span>
              </span>
            )}

            <span className={`text-[11px] font-medium ${isBroadcast || isAdminDesk ? 'text-slate-400' : 'text-[#8A9BB0]'}`}>
              Just now
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className={`p-1 rounded-lg transition cursor-pointer ${
              isBroadcast || isAdminDesk
                ? 'text-slate-400 hover:text-white hover:bg-white/10'
                : 'text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sender & Context */}
        <div className="mb-2">
          <h4 className="text-[14px] font-extrabold truncate">
            {isSellerBroadcast
              ? 'Jeff Vetting Director (B2B LINK Desk)'
              : message.senderName || 'Trade Representative'}
          </h4>
          {conversation.productTitle && !isBroadcast && (
            <p className={`text-[12px] truncate ${isBroadcast || isAdminDesk ? 'text-slate-300' : 'text-[#5B6B82]'}`}>
              Ref: {conversation.productTitle}
            </p>
          )}
          {isSellerBroadcast && (
            <p className="text-[12px] text-cyan-200 font-medium">Direct Platform Desk Notice</p>
          )}
        </div>

        {/* Message preview snippet */}
        <p
          className={`text-[13px] leading-snug line-clamp-2 mb-3.5 font-medium ${
            isBroadcast || isAdminDesk ? 'text-slate-200' : 'text-[#41536D]'
          }`}
        >
          &ldquo;{message.text}&rdquo;
        </p>

        {/* Reply Sent State */}
        {replySent ? (
          <div className="py-2 flex items-center justify-center gap-2 text-emerald-400 font-bold text-[13px] bg-emerald-950/40 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>Response sent instantly!</span>
          </div>
        ) : isReplying ? (
          /* Inline Quick Reply Form */
          <form onSubmit={handleQuickSend} className="space-y-2 mt-2">
            <input
              type="text"
              autoFocus
              value={quickReplyText}
              onChange={(e) => setQuickReplyText(e.target.value)}
              placeholder="Type your quick response..."
              className="w-full px-3.5 py-2 text-[13px] bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0A6CFF]"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="text-[12px] text-slate-400 hover:text-white cursor-pointer px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!quickReplyText.trim()}
                className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </div>
          </form>
        ) : (
          /* Standard Action Buttons */
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsReplying(true)}
              className={`text-[12px] font-bold hover:underline cursor-pointer ${
                isBroadcast || isAdminDesk ? 'text-cyan-300' : 'text-[#0A6CFF]'
              }`}
            >
              Quick Reply
            </button>

            <button
              type="button"
              onClick={handleOpenConversation}
              className={`text-[12px] font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-xs ml-auto ${
                isSellerBroadcast
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black'
                  : isBuyerBroadcast
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                  : 'bg-[#0A6CFF] hover:bg-[#0857cf] text-white'
              }`}
            >
              <span>Open Thread</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
