'use client';

import type { Product, Company, WtbRequest } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { isAccountDeleted } from '@/lib/admin/admin-store';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  text: string;
  timestamp: string;
  isRead?: boolean;
  isBroadcast?: boolean;
  targetAudience?: 'seller' | 'buyer' | 'all';
  broadcastKind?: 'wtb' | 'wts' | 'admin';
  broadcastDetails?: BroadcastDetails;
}

export interface BroadcastDetails {
  itemType: 'wtb' | 'wts';
  itemId?: string;
  title: string;
  brand?: string;
  category?: string;
  condition?: string;
  quantity: number;
  price: number;
  moq?: number;
  barcode?: string;
  notes?: string;
  ownerCompanyId: string;
  ownerCompanyName: string;
  ownerContactName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
}

export type InquiryMessage = ChatMessage;

export interface InquiryConversation {
  id: string;
  type?: 'buyer_seller' | 'seller_admin' | 'broadcast';
  targetAudience?: 'seller' | 'buyer' | 'all';
  status?: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  productPrice: number;
  productMoq: number;
  productCategory?: string;
  sellerCompanyId: string;
  sellerCompanyName: string;
  sellerContactName?: string;
  buyerCompanyId?: string;
  buyerCompanyName: string;
  buyerContactName?: string;
  buyerEmail?: string;
  buyerContactEmail?: string;
  buyerPhone?: string;
  buyerContactPhone?: string;
  lastMessageText: string;
  lastMessageTime: string;
  unreadBySeller: boolean;
  unreadByBuyer: boolean;
  unreadByAdmin?: boolean;
  messages: ChatMessage[];
  broadcastKind?: 'wtb' | 'wts' | 'admin';
  broadcastDetails?: BroadcastDetails;
}

const STORAGE_KEY = 'b2b_live_inquiries_real_v3';
const EVENT_KEY = 'b2b_inquiry_update';
const NEW_MESSAGE_EVENT = 'b2b_inquiry_new_message';

// Purge legacy contaminated cache from previous test accounts
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('b2b_live_inquiries_real_v2');
    localStorage.removeItem('b2b_live_inquiries_real_v1');
    localStorage.removeItem('b2b_live_inquiries_v1');
    localStorage.removeItem('b2b_inquiries');
    localStorage.removeItem('b2b_mock_inquiries');
  } catch {
    // ignore
  }
}

export function clearUserMessagingCache() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('b2b_live_inquiries_real_v2');
      window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: [] }));
    } catch {
      // ignore
    }
  }
}

export const mySentMessageIds = new Set<string>();

export function markMessageAsSentByMe(id: string) {
  mySentMessageIds.add(id);
}

export function isMessageSentByMe(id: string): boolean {
  return mySentMessageIds.has(id);
}

let liveBroadcastChannel: BroadcastChannel | null = null;
let realtimeInitialized = false;

// Initialize cross-tab BroadcastChannel
if (typeof window !== 'undefined') {
  try {
    liveBroadcastChannel = new BroadcastChannel('b2b_live_chat_channel');
    liveBroadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'INQUIRY_UPDATE' && Array.isArray(data.conversations)) {
        try {
          const rawPrev = localStorage.getItem(STORAGE_KEY);
          const newJson = JSON.stringify(data.conversations);
          if (rawPrev === newJson && !data.newMessage) {
            return; // Conversations are identical, ignore redundant broadcast
          }
          localStorage.setItem(STORAGE_KEY, newJson);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: data.conversations }));
        if (data.newMessage && data.conversation) {
          window.dispatchEvent(
            new CustomEvent(NEW_MESSAGE_EVENT, {
              detail: {
                message: data.newMessage,
                conversation: data.conversation,
                fromOtherTab: true,
              },
            })
          );
        }
      }
    };
  } catch {
    // BroadcastChannel unsupported or blocked
  }

  // Setup Supabase Realtime Channel
  if (!realtimeInitialized) {
    try {
      realtimeInitialized = true;
      const supabase = createClient();
      supabase
        .channel('b2b-live-messaging-hub')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'product_inquiries' },
          () => {
            void syncWithSupabase();
          }
        )
        .subscribe();
    } catch {
      // offline or silent
    }
  }
}

// Helper to get conversations from localStorage
export function getStoredConversations(): InquiryConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

// Helper to save conversations locally and broadcast
export function saveStoredConversations(
  convs: InquiryConversation[],
  newMessage?: ChatMessage,
  targetConversation?: InquiryConversation,
  isSentByLocalUser: boolean = false
) {
  if (typeof window === 'undefined') return;
  try {
    const rawPrev = localStorage.getItem(STORAGE_KEY);
    const newJson = JSON.stringify(convs);
    if (rawPrev === newJson && !newMessage) {
      return; // No mutations occurred, prevent event ping-pong
    }
    localStorage.setItem(STORAGE_KEY, newJson);
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: convs }));

    if (liveBroadcastChannel) {
      liveBroadcastChannel.postMessage({
        type: 'INQUIRY_UPDATE',
        conversations: convs,
        newMessage,
        conversation: targetConversation,
      });
    }

    if (newMessage && targetConversation && !isSentByLocalUser) {
      window.dispatchEvent(
        new CustomEvent(NEW_MESSAGE_EVENT, {
          detail: {
            message: newMessage,
            conversation: targetConversation,
          },
        })
      );
    }
  } catch {
    // Ignore
  }
}

export const saveConversations = saveStoredConversations;

// Sync conversations with Supabase backend
export async function syncWithSupabase(role?: string, companyId?: string, email?: string): Promise<InquiryConversation[]> {
  if (typeof window === 'undefined') return [];
  try {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (companyId) params.set('companyId', companyId);
    if (email) params.set('email', email);

    const url = `/api/inquiries${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        // The server is authoritative for confirmed conversations.
        // We only retain in-flight local conversations created in the last 60 seconds
        const local = getStoredConversations();
        const serverIds = new Set(data.conversations.map((c: InquiryConversation) => c.id));
        const now = Date.now();
        const inFlight = local.filter((c) => {
          if (serverIds.has(c.id)) return false;
          const lastMsg = c.messages?.[c.messages.length - 1];
          if (!lastMsg?.timestamp) return false;
          const ageMs = now - new Date(lastMsg.timestamp).getTime();
          return ageMs < 60000;
        });

        const merged = [...data.conversations, ...inFlight];
        saveStoredConversations(merged);
        return merged;
      }
    }
  } catch {
    // Network or offline fallback
  }
  return getStoredConversations();
}

// Filter conversations strictly for active company/role
export function getConversationsForUser(company: Company | null): InquiryConversation[] {
  const all = getStoredConversations();
  if (!company || !company.id) return [];

  // Admin Jeff only sees messages sent to or from admin, plus broadcasts:
  // Trade inquiries between buyers and sellers are strictly private and confidential
  if (company.role === 'admin') {
    return all.filter(
      (c) => c.type === 'seller_admin' || c.type === 'broadcast'
    );
  }

  const userEmail = company.email?.toLowerCase().trim();
  const contactEmail = company.contact_email?.toLowerCase().trim();

  return all.filter((c) => {
    // 1. Broadcasts
    if (c.type === 'broadcast') {
      return c.targetAudience === 'all' || !c.targetAudience || (company.role ? c.targetAudience === company.role : true);
    }

    // 2. Direct Admin Desk support thread or personal welcome message from Jeff
    // Strictly scoped to this user's email or company ID only (never leaks other users like Bostan!)
    if (c.type === 'seller_admin' || c.status === 'admin_desk') {
      const isMyDeskThread = Boolean(
        (userEmail && (c.buyerEmail?.toLowerCase().trim() === userEmail || c.buyerContactEmail?.toLowerCase().trim() === userEmail)) ||
        (contactEmail && (c.buyerEmail?.toLowerCase().trim() === contactEmail || c.buyerContactEmail?.toLowerCase().trim() === contactEmail)) ||
        (company.id && c.buyerCompanyId === company.id)
      );
      return isMyDeskThread;
    }

    // 3. Trade Inquiries (buyer_seller)
    // Strictly requires company to be either the verified seller or the verified buyer
    const isSeller = Boolean(company.id && c.sellerCompanyId === company.id);
    const isBuyer = Boolean(
      (company.id && c.buyerCompanyId === company.id) ||
      (userEmail && (c.buyerEmail?.toLowerCase().trim() === userEmail || c.buyerContactEmail?.toLowerCase().trim() === userEmail)) ||
      (contactEmail && (c.buyerEmail?.toLowerCase().trim() === contactEmail || c.buyerContactEmail?.toLowerCase().trim() === contactEmail))
    );

    return isSeller || isBuyer;
  });
}

// Send a new message inside a conversation (optimistic + instant broadcast + Supabase persist)
export function sendInquiryMessage(
  conversationId: string,
  senderRole: 'buyer' | 'seller' | 'admin',
  senderName: string,
  senderId: string,
  text: string
): InquiryConversation | null {
  const all = getStoredConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv || !text.trim()) return null;

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderId,
    senderName,
    senderRole,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    isBroadcast: conv.type === 'broadcast',
  };

  markMessageAsSentByMe(newMsg.id);

  conv.messages.push(newMsg);
  conv.lastMessageText = text.trim();
  conv.lastMessageTime = 'Just now';

  if (senderRole === 'buyer') {
    conv.unreadBySeller = true;
    conv.unreadByBuyer = false;
  } else if (senderRole === 'seller') {
    conv.unreadByBuyer = true;
    conv.unreadBySeller = false;
    conv.unreadByAdmin = true;
  } else if (senderRole === 'admin') {
    conv.unreadBySeller = true;
    conv.unreadByBuyer = true;
    conv.unreadByAdmin = false;
  }

  // Save with isSentByLocalUser = true so sender's own window won't pop up toast
  saveStoredConversations(all, newMsg, conv, true);

  // Background persist to Supabase
  void (async () => {
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          conversationId,
          message: newMsg,
        }),
      });
    } catch {
      // offline/silent fallback
    }
  })();

  return conv;
}

// Broadcast an official message to Sellers or Buyers from Admin (Jeff)
export async function broadcastToTargetAudience(
  title: string,
  text: string,
  targetAudience: 'seller' | 'buyer' = 'seller',
  adminName: string = 'Jeff Vetting Director (B2B LINK Desk)',
  adminId: string = 'admin-desk'
): Promise<InquiryConversation | null> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_broadcast',
        title: title.trim(),
        text: text.trim(),
        targetAudience,
        adminName,
        adminId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const all = getStoredConversations();
        const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
        if (existingIdx >= 0) {
          all[existingIdx] = data.conversation;
        } else {
          all.unshift(data.conversation);
        }
        if (data.broadcast?.id) markMessageAsSentByMe(data.broadcast.id);
        saveStoredConversations(all, data.broadcast, data.conversation, true);
        return data.conversation;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export const broadcastToAllSellers = (title: string, text: string) =>
  broadcastToTargetAudience(title, text, 'seller');

export interface MemberBroadcastInput {
  broadcastKind: 'wtb' | 'wts';
  itemId?: string;
  title: string;
  category?: string;
  brand?: string;
  condition?: string;
  quantity: number;
  price: number;
  moq?: number;
  barcode?: string;
  notes?: string;
  senderCompany: Company;
  targetAudience?: 'all' | 'seller' | 'buyer';
}

/**
 * Gold Member Network Broadcast:
 * Dispatches an internal WTB or WTS broadcast to all verified members.
 * Details are fully shared but contact credentials remain locked until counterparty unlocks.
 */
export async function broadcastMemberOpportunity(
  input: MemberBroadcastInput
): Promise<InquiryConversation | null> {
  const broadcastId = `broadcast-${input.broadcastKind}-${Date.now()}`;
  const initialMsgText = input.broadcastKind === 'wtb'
    ? `📢 INTERNAL WTB BROADCAST\nProduct: ${input.title}\nTarget Quantity: ${input.quantity} units\nTarget Price: £${input.price.toFixed(2)}/unit\nTotal Estimated Value: £${(input.quantity * input.price).toLocaleString()}\nCategory: ${input.category || 'General'}\nBarcode/SKU: ${input.barcode || 'N/A'}\nNotes: ${input.notes || 'None provided'}\n\n🔒 Trader details locked. Counterparty must unlock contact details to connect.`
    : `📢 INTERNAL WTS BROADCAST\nProduct: ${input.title}\nBrand: ${input.brand || 'Generic'}\nCondition: ${input.condition || 'New'}\nAvailable Quantity: ${input.quantity} pcs\nUnit Price: £${input.price.toFixed(2)}/pc\nMinimum Order (MOQ): ${input.moq || 1} pcs\nTotal Lot Value: £${(input.quantity * input.price).toLocaleString()}\nCategory: ${input.category || 'General'}\nBarcode/EAN: ${input.barcode || 'N/A'}\nDescription: ${input.notes || 'Ready for immediate dispatch'}\n\n🔒 Trader details locked. Counterparty must unlock contact details to connect.`;

  const details: BroadcastDetails = {
    itemType: input.broadcastKind,
    itemId: input.itemId || broadcastId,
    title: input.title,
    brand: input.brand,
    category: input.category,
    condition: input.condition,
    quantity: input.quantity,
    price: input.price,
    moq: input.moq || 1,
    barcode: input.barcode,
    notes: input.notes,
    ownerCompanyId: input.senderCompany.id,
    ownerCompanyName: input.senderCompany.name || 'Commercial Member',
    ownerContactName: input.senderCompany.contact_name || 'Trading Representative',
    ownerEmail: input.senderCompany.email,
    ownerPhone: input.senderCompany.phone || undefined,
  };

  const initialMsg: ChatMessage = {
    id: `msg-${broadcastId}`,
    senderId: input.senderCompany.id,
    senderName: `${input.broadcastKind.toUpperCase()} Broadcast Desk`,
    senderRole: input.broadcastKind === 'wtb' ? 'buyer' : 'seller',
    text: initialMsgText,
    timestamp: new Date().toISOString(),
    isBroadcast: true,
    targetAudience: input.targetAudience || 'all',
    broadcastKind: input.broadcastKind,
    broadcastDetails: details,
  };

  const newConv: InquiryConversation = {
    id: broadcastId,
    type: 'broadcast',
    targetAudience: input.targetAudience || 'all',
    status: input.broadcastKind === 'wtb' ? 'broadcast_wtb' : 'broadcast_wts',
    productId: input.itemId || broadcastId,
    productTitle: `[${input.broadcastKind.toUpperCase()} BROADCAST] ${input.title}`,
    productPrice: input.price,
    productMoq: input.moq || 1,
    productCategory: input.category,
    sellerCompanyId: input.senderCompany.id,
    sellerCompanyName: input.senderCompany.name || 'Commercial Member',
    sellerContactName: input.senderCompany.contact_name,
    buyerCompanyId: input.senderCompany.id,
    buyerCompanyName: input.senderCompany.name || 'Commercial Member',
    buyerContactName: input.senderCompany.contact_name,
    buyerEmail: input.senderCompany.email,
    buyerPhone: input.senderCompany.phone || undefined,
    lastMessageText: initialMsgText,
    lastMessageTime: 'Just now',
    unreadBySeller: true,
    unreadByBuyer: true,
    messages: [initialMsg],
    broadcastKind: input.broadcastKind,
    broadcastDetails: details,
  };

  // 1. Optimistic Local Save
  markMessageAsSentByMe(initialMsg.id);
  const all = getStoredConversations();
  all.unshift(newConv);
  saveStoredConversations(all, initialMsg, newConv, true);

  // 2. Persist to API / Supabase
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_member_broadcast',
        broadcastKind: input.broadcastKind,
        itemId: input.itemId,
        title: input.title,
        category: input.category,
        brand: input.brand,
        condition: input.condition,
        quantity: input.quantity,
        price: input.price,
        moq: input.moq,
        barcode: input.barcode,
        notes: input.notes,
        senderCompanyId: input.senderCompany.id,
        senderCompanyName: input.senderCompany.name,
        senderContactName: input.senderCompany.contact_name,
        senderEmail: input.senderCompany.email,
        senderPhone: input.senderCompany.phone,
        targetAudience: input.targetAudience || 'all',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const freshAll = getStoredConversations();
        const idx = freshAll.findIndex((c) => c.id === broadcastId || c.id === data.conversation.id);
        if (idx >= 0) {
          freshAll[idx] = { ...data.conversation, broadcastKind: input.broadcastKind, broadcastDetails: details };
        } else {
          freshAll.unshift({ ...data.conversation, broadcastKind: input.broadcastKind, broadcastDetails: details });
        }
        saveStoredConversations(freshAll, data.broadcast || initialMsg, freshAll[0], true);
        return freshAll[0];
      }
    }
  } catch (err) {
    console.warn('[MEMBER BROADCAST SYNC NOTICE]', err);
  }

  return newConv;
}

export type SendAdminDirectResult = {
  success: boolean;
  conversation: InquiryConversation | null;
  error?: string;
};

// Admin sends a private direct message to a specific seller
export async function sendAdminDirectMessage(
  sellerCompanyId: string,
  text: string,
  adminName: string = 'Platform Administrator (Executive Desk)',
  adminId: string = 'facbb93f-080f-480f-b54b-8ef26664da86',
  sellerInfo?: { company_name?: string; contact_name?: string; contact_email?: string }
): Promise<SendAdminDirectResult> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_direct_message',
        sellerCompanyId,
        text: text.trim(),
        adminName,
        adminId,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success && data?.conversation) {
      const all = getStoredConversations();
      const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
      if (existingIdx >= 0) {
        all[existingIdx] = data.conversation;
      } else {
        all.unshift(data.conversation);
      }
      if (data.message?.id) markMessageAsSentByMe(data.message.id);
      saveStoredConversations(all, data.message, data.conversation, true);
      return { success: true, conversation: data.conversation };
    }

    if (data?.error) {
      return { success: false, conversation: null, error: data.error };
    }
  } catch (err: any) {
    // If network error but seller info is provided, provide optimistic fallback
    if (sellerInfo) {
      const convId = `admin-desk-${sellerCompanyId}`;
      const newMsg: ChatMessage = {
        id: `msg-admin-${Date.now()}`,
        senderId: adminId,
        senderName: adminName,
        senderRole: 'admin',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
      };
      markMessageAsSentByMe(newMsg.id);

      const all = getStoredConversations();
      let conv = all.find((c) => c.id === convId || (c.sellerCompanyId === sellerCompanyId && c.type === 'seller_admin'));
      if (conv) {
        conv.messages.push(newMsg);
        conv.lastMessageText = text.trim();
        conv.lastMessageTime = 'Just now';
        conv.unreadBySeller = true;
      } else {
        conv = {
          id: convId,
          type: 'seller_admin',
          targetAudience: 'seller',
          status: 'admin_desk',
          productId: '00000000-0000-0000-0000-000000000001',
          productTitle: 'Platform Administrator (Executive Desk)',
          productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
          productPrice: 0,
          productMoq: 1,
          productCategory: 'Compliance Desk',
          sellerCompanyId,
          sellerCompanyName: sellerInfo.company_name || 'Registered Seller',
          sellerContactName: sellerInfo.contact_name || 'Trade Desk',
          buyerCompanyName: 'B2B LINK OÜ (Admin Desk)',
          buyerContactName: adminName,
          buyerEmail: 'admin@b2blink.eu',
          buyerContactEmail: 'admin@b2blink.eu',
          lastMessageText: text.trim(),
          lastMessageTime: 'Just now',
          unreadBySeller: true,
          unreadByBuyer: false,
          unreadByAdmin: false,
          messages: [newMsg],
        };
        all.unshift(conv);
      }
      saveStoredConversations(all, newMsg, conv, true);
      return { success: true, conversation: conv };
    }
    return { success: false, conversation: null, error: err?.message || 'Network error sending message' };
  }
  return { success: false, conversation: null, error: 'Failed to send direct message to seller.' };
}

// Fetch list of registered sellers for Admin Direct Messaging
export async function fetchAllSellersForAdmin(): Promise<any[]> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_sellers' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sellers)) {
        return data.sellers.filter((s: any) => !isAccountDeleted(s.id, s.contact_email));
      }
    }
  } catch {
    // fallback
  }
  return [];
}

// Open or start a direct contact thread with Admin Desk from Seller
export async function contactAdminDesk(
  sellerCompanyId: string,
  contactName: string,
  contactEmail: string,
  initialMessage: string
): Promise<InquiryConversation | null> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'contact_admin',
        sellerCompanyId,
        contactName,
        contactEmail,
        initialMessage,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const all = getStoredConversations();
        const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
        if (existingIdx >= 0) {
          all[existingIdx] = data.conversation;
        } else {
          all.unshift(data.conversation);
        }
        if (data.conversation.messages?.[0]?.id) {
          markMessageAsSentByMe(data.conversation.messages[0].id);
        }
        saveStoredConversations(all, data.conversation.messages[0], data.conversation, true);
        return data.conversation;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

// Create or get an inquiry conversation when buyer messages seller from Marketplace
export function startMarketplaceInquiry(
  product: Product,
  buyerCompany: Company | null,
  buyerName: string,
  buyerEmail: string,
  buyerPhone: string,
  initialMessage: string
): InquiryConversation {
  const all = getStoredConversations();
  const cleanEmail = (buyerEmail || buyerCompany?.email || '').toLowerCase().trim();
  const convId = `conv-${product.id}-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Determine the REAL seller of the product
  const resolvedSellerId =
    product.company_id ||
    product.company?.id ||
    'bc031215-8e34-4709-a97f-0df9cca07e63';

  const resolvedSellerName =
    product.company?.name ||
    (product.company as any)?.company_name ||
    'Verified Supplier';

  const resolvedSellerContact =
    product.company?.contact_name || 'Trade Desk';

  const resolvedBuyerCompanyId =
    buyerCompany?.id || `buyer-guest-${Date.now()}`;

  const resolvedBuyerCompanyName =
    buyerCompany?.company_name || buyerCompany?.name || `${buyerName} Commercial`;

  // Look for existing conversation specifically for this buyer & product
  let existing = all.find(
    (c) =>
      c.id === convId ||
      (c.productId === product.id &&
        (c.buyerCompanyId === resolvedBuyerCompanyId ||
          (cleanEmail && c.buyerEmail?.toLowerCase().trim() === cleanEmail)))
  );

  const initialMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    senderId: buyerCompany?.id || cleanEmail,
    senderName: buyerName || buyerCompany?.contact_name || 'Buyer Representative',
    senderRole: 'buyer',
    text: initialMessage.trim(),
    timestamp: new Date().toISOString(),
  };

  markMessageAsSentByMe(initialMsg.id);

  if (existing) {
    existing.messages.push(initialMsg);
    existing.lastMessageText = initialMessage.trim();
    existing.lastMessageTime = 'Just now';
    existing.unreadBySeller = true;
    existing.unreadByBuyer = false;
  } else {
    existing = {
      id: convId,
      type: 'buyer_seller',
      productId: product.id,
      productTitle: product.title,
      productImage:
        product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      productPrice: product.unit_price,
      productMoq: product.moq,
      productCategory: product.category_slug || 'Consumer Electronics',
      sellerCompanyId: resolvedSellerId,
      sellerCompanyName: resolvedSellerName,
      sellerContactName: resolvedSellerContact,
      buyerCompanyId: resolvedBuyerCompanyId,
      buyerCompanyName: resolvedBuyerCompanyName,
      buyerContactName: buyerName || buyerCompany?.contact_name || 'Buyer',
      buyerEmail: cleanEmail,
      buyerContactEmail: cleanEmail,
      buyerPhone,
      buyerContactPhone: buyerPhone,
      lastMessageText: initialMessage.trim(),
      lastMessageTime: 'Just now',
      unreadBySeller: true,
      unreadByBuyer: false,
      messages: [initialMsg],
    };
    all.unshift(existing);
  }

  // Save with isSentByLocalUser = true so sender will not receive their own inquiry popup
  saveStoredConversations(all, initialMsg, existing, true);

  // Background persist to Supabase
  void (async () => {
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_inquiry',
          productId: product.id,
          sellerCompanyId: resolvedSellerId,
          buyerCompanyId: resolvedBuyerCompanyId,
          buyerName: buyerName || buyerCompany?.contact_name || 'Buyer',
          buyerEmail: cleanEmail,
          buyerPhone,
          buyerCompany: resolvedBuyerCompanyName,
          requestedQuantity: product.moq || 1,
          targetPrice: product.unit_price || 1,
          initialMessage: initialMessage.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.conversation) {
          const currentAll = getStoredConversations();
          const targetIndex = currentAll.findIndex(
            (c) => c.id === convId || (existing && c.id === existing.id)
          );
          if (targetIndex >= 0) {
            currentAll[targetIndex] = {
              ...currentAll[targetIndex],
              ...data.conversation,
              id: data.conversation.id,
            };
            saveStoredConversations(currentAll);
          }
        }
      }
    } catch {
      // offline/silent fallback
    }
  })();

  return existing;
}

// Mark conversation as read
export function markConversationAsRead(conversationId: string, role: 'buyer' | 'seller' | 'admin') {
  if (typeof window === 'undefined') return;
  const all = getStoredConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv) return;

  let changed = false;
  if (role === 'seller' && conv.unreadBySeller) {
    conv.unreadBySeller = false;
    changed = true;
  } else if (role === 'buyer' && conv.unreadByBuyer) {
    conv.unreadByBuyer = false;
    changed = true;
  } else if (role === 'admin' && conv.unreadByAdmin) {
    conv.unreadByAdmin = false;
    changed = true;
  }

  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  }
}

// Subscribe to conversation updates
export function onInquiriesUpdate(callback: (conversations: InquiryConversation[]) => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<InquiryConversation[]>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(EVENT_KEY, handler);
  return () => {
    window.removeEventListener(EVENT_KEY, handler);
  };
}

// Subscribe to new incoming live messages
export function onNewLiveMessage(
  callback: (data: { message: ChatMessage; conversation: InquiryConversation; fromOtherTab?: boolean }) => void
) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{
      message: ChatMessage;
      conversation: InquiryConversation;
      fromOtherTab?: boolean;
    }>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(NEW_MESSAGE_EVENT, handler);
  return () => {
    window.removeEventListener(NEW_MESSAGE_EVENT, handler);
  };
}

export interface ReceivedWtbQuote {
  id: string;
  wtbRequestId: string;
  productName: string;
  categorySlug?: string;
  sellerCompanyId: string;
  sellerCompanyName: string;
  sellerContactName: string;
  sellerEmail: string;
  sellerPhone?: string;
  sellerTier: string;
  offeredPrice: number;
  offeredQuantity: number;
  totalPrice: number;
  leadTimeDays: number;
  notes?: string;
  status: 'Lead Unlocked' | 'Quote Sent' | 'Email Sent';
  actionType: 'unlocked' | 'quote_submitted' | 'email_sent';
  conversationId: string;
  createdAt: string;
}

export interface WtbLeadDispatchParams {
  wtbRequest: WtbRequest;
  sellerCompany: Company;
  actionType: 'unlocked' | 'quote_submitted' | 'email_sent';
  quoteDetails?: {
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    leadTimeDays: number;
    notes?: string;
  };
}

/**
 * Dispatches an official lead/quote notification from a Seller to a Buyer's dashboard.
 * 1. Creates/updates an active private chat thread between the Seller and Buyer in Live Inquiries.
 * 2. Persists the received quote to the buyer's received quotes table.
 * 3. Broadcasts real-time events across browser tabs.
 */
export function dispatchWtbLeadToBuyerDashboard({
  wtbRequest,
  sellerCompany,
  actionType,
  quoteDetails,
}: WtbLeadDispatchParams): InquiryConversation {
  const all = getStoredConversations();
  const cleanBuyerEmail = (wtbRequest.buyer_email || '').toLowerCase().trim();
  const convId = `conv-wtb-${wtbRequest.id}-${sellerCompany.id}`;

  const resolvedPrice = quoteDetails?.unitPrice ?? wtbRequest.target_price;
  const resolvedQty = quoteDetails?.quantity ?? wtbRequest.target_quantity;
  const resolvedTotal = quoteDetails?.totalPrice ?? Number((resolvedPrice * resolvedQty).toFixed(2));
  const resolvedLeadTime = quoteDetails?.leadTimeDays ?? 3;

  let messageText = '';
  if (actionType === 'quote_submitted') {
    messageText = `💼 Official Wholesale Quotation Received from ${sellerCompany.name}\n\n` +
      `Regarding your WTB Request: "${wtbRequest.product_name}"\n\n` +
      `Commercial Offer Details:\n` +
      `• Offered Unit Price: £${resolvedPrice.toFixed(2)} / unit\n` +
      `• Offered Quantity: ${resolvedQty.toLocaleString()} units\n` +
      `• Total Deal Value: £${resolvedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `• Estimated Dispatch Lead Time: ${resolvedLeadTime} business days\n` +
      (quoteDetails?.notes ? `• Commercial Notes: "${quoteDetails.notes}"\n\n` : '\n') +
      `Supplier Information:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Contact Person: ${sellerCompany.contact_name || 'Trade Desk'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Membership Tier: ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Verified Supplier\n\n` +
      `The supplier has dispatched this formal quotation. Reply here in live chat to begin negotiations or arrange wholesale settlement.`;
  } else if (actionType === 'email_sent') {
    messageText = `📧 Direct Email Quotation Sent by ${sellerCompany.name}\n\n` +
      `Hello ${wtbRequest.buyer_name},\n\n` +
      `Verified supplier ${sellerCompany.name} (${sellerCompany.contact_name || 'Sales Representative'}) has dispatched an official wholesale quotation directly to your procurement email: ${wtbRequest.buyer_email}.\n\n` +
      `Supplier Details:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Contact: ${sellerCompany.contact_name || 'Commercial Team'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Verification: ✅ ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Supplier\n\n` +
      `Please check your inbox or reply directly in this chat thread to coordinate.`;
  } else {
    // actionType === 'unlocked'
    messageText = `🏢 Supplier Lead Connected: ${sellerCompany.name}\n\n` +
      `Hello ${wtbRequest.buyer_name},\n\n` +
      `Verified supplier ${sellerCompany.name} has reviewed your WTB request for "${wtbRequest.product_name}" (${wtbRequest.target_quantity.toLocaleString()} units at target £${wtbRequest.target_price.toFixed(2)}), unlocked your buyer details, and initiated communication.\n\n` +
      `Supplier Profile:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Representative: ${sellerCompany.contact_name || 'Sales Desk'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Status: ✅ ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Verified Supplier\n\n` +
      `The supplier has sent you this message. Reply here to begin discussion or request product lots!`;
  }

  const msgId = `msg-wtb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const initialMsg: ChatMessage = {
    id: msgId,
    senderId: sellerCompany.id,
    senderName: `${sellerCompany.name} (${sellerCompany.contact_name || 'Sales'})`,
    senderRole: 'seller',
    text: messageText,
    timestamp: new Date().toISOString(),
  };

  markMessageAsSentByMe(msgId);

  let existing = all.find(
    (c) => c.id === convId || (c.productId === `wtb-${wtbRequest.id}` && c.sellerCompanyId === sellerCompany.id)
  );

  if (existing) {
    existing.messages.push(initialMsg);
    existing.lastMessageText = messageText;
    existing.lastMessageTime = 'Just now';
    existing.unreadByBuyer = true;
    existing.unreadBySeller = false;
  } else {
    existing = {
      id: convId,
      type: 'buyer_seller',
      status: 'wtb_quotation',
      productId: `wtb-${wtbRequest.id}`,
      productTitle: `[WTB Quote] ${wtbRequest.product_name}`,
      productImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      productPrice: resolvedPrice,
      productMoq: resolvedQty,
      productCategory: wtbRequest.category_slug || 'Wholesale Demand',
      sellerCompanyId: sellerCompany.id,
      sellerCompanyName: sellerCompany.name,
      sellerContactName: sellerCompany.contact_name || 'Sales Desk',
      buyerCompanyId: wtbRequest.buyer_company_id || undefined,
      buyerCompanyName: (wtbRequest as any).buyer_company || wtbRequest.buyer_name,
      buyerContactName: wtbRequest.buyer_name,
      buyerEmail: cleanBuyerEmail,
      buyerContactEmail: cleanBuyerEmail,
      buyerPhone: wtbRequest.buyer_phone || undefined,
      buyerContactPhone: wtbRequest.buyer_phone || undefined,
      lastMessageText: messageText,
      lastMessageTime: 'Just now',
      unreadByBuyer: true,
      unreadBySeller: false,
      messages: [initialMsg],
    };
    all.unshift(existing);
  }

  saveStoredConversations(all, initialMsg, existing, true);

  // Also persist to buyer's received quotes store in localStorage
  if (typeof window !== 'undefined' && cleanBuyerEmail) {
    try {
      const buyerQuotesKey = `b2b_received_quotes_${cleanBuyerEmail}`;
      const rawQuotes = localStorage.getItem(buyerQuotesKey);
      const existingQuotes: ReceivedWtbQuote[] = rawQuotes ? JSON.parse(rawQuotes) : [];

      const newQuoteRecord: ReceivedWtbQuote = {
        id: `rq-${wtbRequest.id}-${sellerCompany.id}`,
        wtbRequestId: wtbRequest.id,
        productName: wtbRequest.product_name,
        categorySlug: wtbRequest.category_slug,
        sellerCompanyId: sellerCompany.id,
        sellerCompanyName: sellerCompany.name,
        sellerContactName: sellerCompany.contact_name || 'Representative',
        sellerEmail: sellerCompany.email || sellerCompany.contact_email || '',
        sellerPhone: sellerCompany.phone || undefined,
        sellerTier: sellerCompany.membership_tier || 'silver',
        offeredPrice: resolvedPrice,
        offeredQuantity: resolvedQty,
        totalPrice: resolvedTotal,
        leadTimeDays: resolvedLeadTime,
        notes: quoteDetails?.notes || (actionType === 'email_sent' ? 'Official quotation sent via direct email.' : 'Supplier unlocked buyer lead and initiated contact.'),
        status: actionType === 'quote_submitted' ? 'Quote Sent' : actionType === 'email_sent' ? 'Email Sent' : 'Lead Unlocked',
        actionType,
        conversationId: convId,
        createdAt: new Date().toISOString(),
      };

      const quoteIdx = existingQuotes.findIndex(
        (q) => q.wtbRequestId === wtbRequest.id && q.sellerCompanyId === sellerCompany.id
      );
      if (quoteIdx >= 0) {
        existingQuotes[quoteIdx] = newQuoteRecord;
      } else {
        existingQuotes.unshift(newQuoteRecord);
      }
      localStorage.setItem(buyerQuotesKey, JSON.stringify(existingQuotes));

      // Trigger event so buyer dashboard reacts immediately
      window.dispatchEvent(new CustomEvent('b2b_received_quotes_update', { detail: existingQuotes }));
    } catch {
      // ignore
    }
  }

  // Background persist to Supabase via /api/inquiries
  void (async () => {
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_inquiry',
          productId: `wtb-${wtbRequest.id}`,
          sellerCompanyId: sellerCompany.id,
          buyerCompanyId: wtbRequest.buyer_company_id || undefined,
          buyerName: wtbRequest.buyer_name,
          buyerEmail: cleanBuyerEmail,
          buyerPhone: wtbRequest.buyer_phone,
          buyerCompany: (wtbRequest as any).buyer_company || wtbRequest.buyer_name,
          requestedQuantity: resolvedQty,
          targetPrice: resolvedPrice,
          initialMessage: messageText,
        }),
      });
    } catch {
      // offline/silent
    }
  })();

  return existing;
}

export function getBuyerReceivedQuotes(buyerEmail: string): ReceivedWtbQuote[] {
  if (typeof window === 'undefined' || !buyerEmail) return [];
  try {
    const buyerQuotesKey = `b2b_received_quotes_${buyerEmail.toLowerCase().trim()}`;
    const raw = localStorage.getItem(buyerQuotesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

