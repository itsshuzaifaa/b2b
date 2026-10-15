'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  onNewLiveMessage,
  sendInquiryMessage,
  type ChatMessage,
  type InquiryConversation,
} from '@/lib/messaging/messaging-store';
import {
  MessageSquare,
  X,
  ArrowRight,
  Send,
  CheckCircle2,
  Package,
  ShieldCheck,
  Building2,
  Sparkles,
} from 'lucide-react';

// Gentle web audio synthesized notification chime
function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export function LiveMessagePopup() {
  const router = useRouter();
  const { company, role } = useAuth();
  const [activeNotification, setActiveNotification] = useState<{
    message: ChatMessage;
    conversation: InquiryConversation;
  } | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [progress, setProgress] = useState(100);
  const isHoveredRef = useRef(false);

  // Subscribe to live broadcast messages
  useEffect(() => {
    const unsubscribe = onNewLiveMessage(({ message, conversation }) => {
      // Don't show toast for messages sent by the active user themselves
      const isSelfSender =
        (company?.id && message.senderId === company.id) ||
        (role && message.senderRole === role);

      if (isSelfSender) return;

      // Play soft chime
      playNotificationChime();

      setActiveNotification({ message, conversation });
      setReplySent(false);
      setQuickReplyText('');
      setProgress(100);
    });

    return () => {
      unsubscribe();
    };
  }, [company, role]);

  // Auto-dismiss countdown timer (8 seconds)
  useEffect(() => {
    if (!activeNotification || isReplying) return;

    const interval = setInterval(() => {
      if (isHoveredRef.current) return;

      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setActiveNotification(null);
          return 0;
        }
        return prev - 2; // ~50 ticks of 160ms = 8s
      });
    }, 160);

    return () => clearInterval(interval);
  }, [activeNotification, isReplying]);

  if (!activeNotification) return null;

  const { message, conversation } = activeNotification;

  const handleOpenConversation = () => {
    setActiveNotification(null);
    if (role === 'admin') {
      router.push(`/site-admin/messages?id=${conversation.id}`);
    } else {
      router.push(`/dashboard/inquiries?id=${conversation.id}`);
    }
  };

  const handleSendQuickReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim()) return;

    const myRole = (role as 'buyer' | 'seller' | 'admin') || 'buyer';
    const senderName = company?.contact_name || (myRole === 'admin' ? 'Jeff Vetting' : 'Marcus Wright');
    const senderId = company?.id || (myRole === 'admin' ? 'facbb93f-080f-480f-b54b-8ef26664da86' : 'b7d02afe-f080-4ac5-94d6-9f058f2d2b4b');

    sendInquiryMessage(conversation.id, myRole, senderName, senderId, quickReplyText.trim());

    setReplySent(true);
    setQuickReplyText('');
    setTimeout(() => {
      setActiveNotification(null);
      setReplySent(false);
      setIsReplying(false);
    }, 1800);
  };

  const getRoleBadge = (msgRole: string) => {
    switch (msgRole) {
      case 'seller':
        return { label: 'Verified Seller', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'admin':
        return { label: 'Jeff Admin Desk', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'buyer':
      default:
        return { label: 'Verified Buyer', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
  };

  const badge = getRoleBadge(message.senderRole);

  return (
    <aside
      aria-label="Live Incoming Message Notification"
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
      className="fixed bottom-20 right-5 z-[9999] w-[92vw] sm:w-[410px] bg-[#071326] text-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] border border-[#1E2D4A] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans"
    >
      {/* Top Accent Progress Bar */}
      <div className="h-1 w-full bg-[#13233F]">
        <div
          className="h-full bg-gradient-to-r from-[#00D2FF] to-[#0A6CFF] transition-all duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header Bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#14233D] bg-[#0A1A33]/50">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00E5FF]" />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00E5FF]">
            Live Incoming Message
          </span>
        </div>

        <button
          onClick={() => setActiveNotification(null)}
          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          aria-label="Dismiss message notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notification Body */}
      <div className="p-5 space-y-3">
        {/* Sender Info & Role */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0A6CFF] to-[#00D2FF] text-[#071326] font-extrabold text-[13px] flex items-center justify-center shrink-0 shadow-md">
              {message.senderName
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('') || 'EU'}
            </div>
            <div className="min-w-0">
              <h4 className="text-[14px] font-bold text-white truncate leading-tight">
                {message.senderName}
              </h4>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {conversation.productTitle}
              </p>
            </div>
          </div>

          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${badge.bg}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Message Balloon */}
        <div className="bg-[#0D1D38] border border-[#1B2F54] rounded-2xl p-3.5 text-[13px] text-slate-200 leading-relaxed shadow-inner">
          <p className="line-clamp-3 italic">&ldquo;{message.text}&rdquo;</p>
        </div>

        {/* Quick Reply or Actions */}
        {replySent ? (
          <div className="py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Reply Dispatched Instantly via Supabase!</span>
          </div>
        ) : isReplying ? (
          <form onSubmit={handleSendQuickReply} className="space-y-2 pt-1 animate-in fade-in">
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={quickReplyText}
                onChange={(e) => setQuickReplyText(e.target.value)}
                placeholder={`Reply to ${message.senderName.split(' ')[0]}...`}
                className="w-full bg-[#0D1D38] border border-[#00D2FF]/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00D2FF]"
              />
              <button
                type="submit"
                disabled={!quickReplyText.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#00D2FF] hover:bg-[#00B8E6] text-[#071326] p-1.5 rounded-lg disabled:opacity-40 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenConversation}
                className="text-[#00D2FF] hover:underline"
              >
                Open full conversation &rarr;
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setIsReplying(true)}
              className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs py-2 px-3 rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Quick Reply</span>
            </button>
            <button
              onClick={handleOpenConversation}
              className="flex-1 bg-gradient-to-r from-[#00D2FF] to-[#0A6CFF] hover:opacity-95 text-[#050E1D] font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>View Chat</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
