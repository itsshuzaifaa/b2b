'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getUnreadInquiriesCountForUser,
  getUnreadInquiriesCountForAdmin,
  syncWithSupabase,
  onNewLiveMessage,
  isMessageSentByMe,
  type ChatMessage,
  type InquiryConversation,
} from '@/lib/messaging/messaging-store';

// Play gentle web audio chime
function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
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
}

export function LiveMessageNotifier() {
  const router = useRouter();
  const { company, role } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const originalTitleRef = useRef<string>('');
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTabHiddenRef = useRef<boolean>(false);

  // Store original document title
  useEffect(() => {
    if (typeof document !== 'undefined') {
      originalTitleRef.current = document.title;
    }
  }, []);

  // Request browser notification permission politely
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const handleFirstInteraction = () => {
          Notification.requestPermission().catch(() => {});
          window.removeEventListener('click', handleFirstInteraction);
        };
        window.addEventListener('click', handleFirstInteraction, { once: true });
      }
    }
  }, []);

  // Compute unread count and manage document title
  const updateUnreadStatus = () => {
    let count = 0;
    if (role === 'admin') {
      count = getUnreadInquiriesCountForAdmin();
    } else if (company) {
      count = getUnreadInquiriesCountForUser(company);
    }
    setUnreadCount(count);

    // If tab is hidden and there are unread messages, flash title
    if (isTabHiddenRef.current && count > 0) {
      startTitleFlash(count);
    } else if (!isTabHiddenRef.current) {
      stopTitleFlash();
    }
  };

  const startTitleFlash = (count: number) => {
    if (titleIntervalRef.current) return;
    let toggle = false;
    titleIntervalRef.current = setInterval(() => {
      if (typeof document === 'undefined') return;
      if (!isTabHiddenRef.current) {
        stopTitleFlash();
        return;
      }
      toggle = !toggle;
      document.title = toggle
        ? `🔴 (${count}) New Message | B2B LINK`
        : `💬 New Message Received | B2B LINK`;
    }, 1200);
  };

  const stopTitleFlash = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (typeof document !== 'undefined' && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  };

  // Visibility change listener
  useEffect(() => {
    const handleVisibility = () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      isTabHiddenRef.current = isHidden;

      if (!isHidden) {
        stopTitleFlash();
        updateUnreadStatus();
        // Immediately trigger background sync when user returns to tab
        if (company) {
          void syncWithSupabase(
            role || undefined,
            company.id,
            company.email,
            company.membership_tier || company.tier || 'bronze',
            company.created_at
          );
        } else if (role === 'admin') {
          void syncWithSupabase('admin');
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    window.addEventListener('focus', handleVisibility);

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      window.removeEventListener('focus', handleVisibility);
      stopTitleFlash();
    };
  }, [company, role]);

  // Listen to new live messages
  useEffect(() => {
    const unsubscribe = onNewLiveMessage(({ message, conversation }) => {
      // 1. Guard against own messages
      if (isMessageSentByMe(message.id)) return;
      if (company?.id && message.senderId === company.id) return;
      if (company?.email && (message.senderId === company.email || (message as any).senderEmail === company.email)) return;
      if (company?.contact_name && message.senderName === company.contact_name) return;

      // 2. Play audible messenger chime
      playNotificationChime();

      // 3. Update count and start title flash if hidden
      updateUnreadStatus();

      // 4. Dispath desktop Web Notification if tab is hidden
      if (isTabHiddenRef.current && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            const notifTitle = `💬 ${message.senderName || 'B2B LINK Desk'}`;
            const notif = new Notification(notifTitle, {
              body: message.text || 'You have received a new wholesale trade message.',
              icon: '/b2b-link-logo-tight.png',
              tag: `b2b-msg-${conversation.id}`,
            });
            notif.onclick = () => {
              window.focus();
              if (role === 'admin') {
                router.push(`/site-admin/messages?id=${conversation.id}`);
              } else {
                router.push(`/dashboard/inquiries?id=${conversation.id}`);
              }
              notif.close();
            };
          } catch {
            // Notification dispatch error or blocked
          }
        }
      }
    });

    // Listen to store updates
    const handleInquiryUpdate = () => updateUnreadStatus();
    window.addEventListener('b2b_inquiry_update', handleInquiryUpdate);
    window.addEventListener('storage', handleInquiryUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('b2b_inquiry_update', handleInquiryUpdate);
      window.removeEventListener('storage', handleInquiryUpdate);
    };
  }, [company, role]);

  // Periodic background sync (every 6 seconds) to guarantee real-time updates across browsers/tabs
  useEffect(() => {
    const runSync = () => {
      if (company) {
        void syncWithSupabase(
          role || undefined,
          company.id,
          company.email,
          company.membership_tier || company.tier || 'bronze',
          company.created_at
        ).then(() => {
          updateUnreadStatus();
        });
      } else if (role === 'admin') {
        void syncWithSupabase('admin').then(() => {
          updateUnreadStatus();
        });
      }
    };

    runSync();
    const interval = setInterval(runSync, 6000);
    return () => clearInterval(interval);
  }, [company?.id, company?.email, role]);

  return null;
}
