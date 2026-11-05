'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminAccounts,
  saveAdminAccounts,
  suspendAccount,
  unsuspendAccount,
  deleteAccount,
  updateAccountTier,
  updateAccountApproval,
  updateAccountBasicInfo,
  getStatusOverrides,
  isAccountDeleted,
  type AdminClientAccount,
} from '@/lib/admin/admin-store';
import type { MembershipTier } from '@/types/database';
import {
  Search,
  Users,
  ShieldAlert,
  Trash2,
  Edit,
  Eye,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  X,
  Building2,
  Mail,
  Phone,
  FileText,
  ShieldCheck,
  Ban,
  Check,
  FileSpreadsheet,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  Clock,
  UserCog,
  MapPin,
  Globe,
} from 'lucide-react';
import { AdminBulkCsvModal } from '@/components/admin/AdminBulkCsvModal';

export default function AdminUsersPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminClientAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer' | 'suspended' | 'pending'>('all');

  // Modals
  const [selectedDossier, setSelectedDossier] = useState<AdminClientAccount | null>(null);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState<AdminClientAccount | null>(null);
  const [clearLotsConfirmAccount, setClearLotsConfirmAccount] = useState<AdminClientAccount | null>(null);
  const [editingTierAccount, setEditingTierAccount] = useState<AdminClientAccount | null>(null);
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('silver');
  const [editingInfoAccount, setEditingInfoAccount] = useState<AdminClientAccount | null>(null);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    email: '',
    company_name: '',
    contact_name: '',
    role: 'seller' as 'seller' | 'buyer',
    tier: 'bronze' as MembershipTier,
    approval_status: 'approved' as 'approved' | 'pending',
  });
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    contact_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    company_number: '',
    vat_number: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [bulkCsvAccount, setBulkCsvAccount] = useState<AdminClientAccount | null>(null);
  const [bulkCsvMode, setBulkCsvMode] = useState<'WTS' | 'WTB'>('WTS');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      let serverAccounts: AdminClientAccount[] = [];
      try {
        const res = await fetch('/api/admin/accounts', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.accounts)) {
            serverAccounts = data.accounts.filter(
              (a: AdminClientAccount) =>
                !isAccountDeleted(a.id, a.email) &&
                a.role !== 'admin' &&
                a.email?.toLowerCase() !== 'admin@b2blink.eu'
            );
          }
        }
      } catch (fetchErr) {
        console.warn('Accounts API fetch notice:', fetchErr);
      }

      const localAccounts = getAdminAccounts().filter(
        (a: AdminClientAccount) =>
          !isAccountDeleted(a.id, a.email) &&
          a.role !== 'admin' &&
          a.email?.toLowerCase() !== 'admin@b2blink.eu'
      );
      const overrides = getStatusOverrides();
      const localMap = new Map<string, AdminClientAccount>();
      for (const la of localAccounts) {
        if (la.id) localMap.set(la.id, la);
        if (la.email) localMap.set(la.email.toLowerCase().trim(), la);
      }

      const mergedAccounts: AdminClientAccount[] = [];
      for (const sa of serverAccounts) {
        const saEmail = (sa.email || '').toLowerCase().trim();
        const la = localMap.get(sa.id) || (saEmail ? localMap.get(saEmail) : undefined);
        const override = (sa.id && overrides[sa.id.toLowerCase().trim()]) || (saEmail && overrides[saEmail]);

        let effectiveApproval = sa.approval_status;
        let effectiveAccountStatus = sa.account_status;
        let effectiveVerifiedDocs = sa.verified_documents;

        if (override) {
          effectiveApproval = override.approval_status;
          effectiveAccountStatus = override.account_status;
          effectiveVerifiedDocs = override.verified_documents;
        } else if (la) {
          if (la.approval_status === 'approved' || sa.approval_status === 'approved') {
            effectiveApproval = 'approved';
            effectiveAccountStatus = la.account_status === 'suspended' ? 'suspended' : 'active';
            effectiveVerifiedDocs = true;
          } else if (la.account_status === 'suspended' || la.approval_status === 'rejected') {
            effectiveApproval = la.approval_status;
            effectiveAccountStatus = 'suspended';
          }
        }

        mergedAccounts.push({
          ...sa,
          ...(la ? { ...la } : {}),
          approval_status: effectiveApproval,
          account_status: effectiveAccountStatus,
          verified_documents: effectiveVerifiedDocs,
        });
      }

      const seen = new Set(mergedAccounts.map((a: any) => (a.email || '').toLowerCase().trim()));
      for (const la of localAccounts) {
        const lKey = (la.email || '').toLowerCase().trim();
        if (lKey && !seen.has(lKey)) {
          seen.add(lKey);
          mergedAccounts.push(la);
        }
      }

      // Check browser cached company to ensure no newly created account is missed
      if (typeof window !== 'undefined') {
        try {
          const cachedRaw = localStorage.getItem('b2b_cached_company');
          if (cachedRaw) {
            const c = JSON.parse(cachedRaw);
            const cEmail = (c.email || '').toLowerCase().trim();
            if (cEmail && cEmail !== 'admin@b2blink.eu' && c.role !== 'admin' && !seen.has(cEmail) && !isAccountDeleted(c.id, c.email)) {
              seen.add(cEmail);
              const override = overrides[cEmail] || (c.id && overrides[c.id]);
              mergedAccounts.unshift({
                id: c.id || `comp_${Date.now()}`,
                name: c.company_name || c.name || c.contact_name || 'Enterprise Account',
                contact_name: c.contact_name || 'Representative',
                email: c.email,
                phone: c.phone || null,
                address: c.address || null,
                website: c.website || null,
                role: (c.role || 'seller') as any,
                membership_tier: override?.tier || c.tier || c.membership_tier || 'bronze',
                approval_status: override?.approval_status || c.approval_status || 'pending',
                account_status: override?.account_status || (c.approval_status === 'approved' ? 'active' : 'pending'),
                company_number: c.company_number || null,
                vat_number: c.vat_number || null,
                country: 'Global',
                created_at: c.created_at || new Date().toISOString(),
                last_active: 'Just now',
                listings_count: 0,
                total_spend_or_sales: `€${(c.tier || c.membership_tier) === 'gold' ? '179' : (c.tier || c.membership_tier) === 'silver' ? '79' : '0'}/mo Membership`,
                verified_documents: override?.verified_documents || c.approval_status === 'approved',
              });
            }
          }
        } catch {}
      }

      setAccounts(mergedAccounts);
      if (mergedAccounts.length > 0) {
        saveAdminAccounts(mergedAccounts);
      }
      return;
    } catch {
      // fallback
    }
    const cleanLocal = getAdminAccounts().filter(
      (a) => a.role !== 'admin' && a.email?.toLowerCase() !== 'admin@b2blink.eu'
    );
    setAccounts(cleanLocal);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('b2b_admin_update', loadData);
    return () => window.removeEventListener('b2b_admin_update', loadData);
  }, []);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddOrVerifyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = addMemberForm.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAddMemberError('Please enter a valid member email address.');
      return;
    }

    setAddMemberLoading(true);
    setAddMemberError(null);

    const compName = addMemberForm.company_name.trim() || cleanEmail.split('@')[0];
    const contName = addMemberForm.contact_name.trim() || compName;
    const isApproved = addMemberForm.approval_status === 'approved';

    const newAcc: AdminClientAccount = {
      id: `comp_${Date.now()}`,
      name: compName,
      contact_name: contName,
      email: cleanEmail,
      phone: null,
      address: null,
      website: null,
      role: addMemberForm.role,
      membership_tier: addMemberForm.tier,
      approval_status: addMemberForm.approval_status,
      account_status: isApproved ? 'active' : 'pending',
      created_at: new Date().toISOString(),
      last_active: 'Just now',
      listings_count: 0,
      total_spend_or_sales: `€${addMemberForm.tier === 'gold' ? '179' : addMemberForm.tier === 'silver' ? '79' : '0'}/mo Membership`,
      verified_documents: isApproved,
    };

    try {
      // 1. Update local accounts
      const current = getAdminAccounts();
      const filtered = current.filter((a) => a.email?.toLowerCase().trim() !== cleanEmail);
      saveAdminAccounts([newAcc, ...filtered]);

      // 2. Set status override
      saveStatusOverride(newAcc.id, addMemberForm.approval_status, addMemberForm.tier);
      saveStatusOverride(cleanEmail, addMemberForm.approval_status, addMemberForm.tier);

      // 3. Sync to browser cached company if this email matches
      if (typeof window !== 'undefined') {
        const cachedRaw = localStorage.getItem('b2b_cached_company');
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached && (cached.email?.toLowerCase().trim() === cleanEmail || cached.id === newAcc.id)) {
              cached.approval_status = addMemberForm.approval_status;
              localStorage.setItem('b2b_cached_company', JSON.stringify(cached));
            }
          } catch {}
        }
      }

      // 4. Dispatch updates
      window.dispatchEvent(new CustomEvent('b2b_account_status_change', { detail: { companyId: newAcc.id, status: addMemberForm.approval_status } }));
      window.dispatchEvent(new CustomEvent('b2b_admin_update'));

      // 5. Backend sync
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isApproved ? 'approve' : 'register_sync',
          companyId: newAcc.id,
          email: cleanEmail,
          contactName: contName,
          companyName: compName,
          tier: addMemberForm.tier,
          role: addMemberForm.role,
          account: newAcc,
        }),
      }).catch(() => {});

      showNotice(`Account "${compName}" (${cleanEmail}) ${isApproved ? 'verified and approved' : 'added'} successfully.`);
      setAddMemberModalOpen(false);
      setAddMemberForm({
        email: '',
        company_name: '',
        contact_name: '',
        role: 'seller',
        tier: 'bronze',
        approval_status: 'approved',
      });
      await loadData();
    } catch (err: any) {
      setAddMemberError(err.message || 'Error adding member.');
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleBulkCsvSuccess = (count: number) => {
    showNotice(`Successfully uploaded and published ${count} listings for ${bulkCsvAccount?.name}`);
    loadData();
  };

  const handleSendInactivityReminder = async (acc: AdminClientAccount) => {
    showNotice(`Sending 30-day inactivity reminder to ${acc.email}...`);
    try {
      const res = await fetch('/api/cron/inactivity-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, force: true }),
      });
      const data = await res.json();
      if (data.success && data.emailsSent > 0) {
        showNotice(`Inactivity reminder successfully sent to ${acc.email}!`);
      } else {
        showNotice(`Reminder dispatched to ${acc.email}`);
      }
    } catch {
      showNotice(`Failed to send inactivity reminder to ${acc.email}`);
    }
  };

  const handleVerifyAccount = async (acc: AdminClientAccount) => {
    // 1. Optimistic AJAX state update
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, approval_status: 'approved', account_status: 'active', verified_documents: true } : a))
    );
    // 2. Persist to local store with status override
    updateAccountApproval(acc.id, 'approved');
    showNotice(`Account "${acc.name}" verified & activated! Approval email dispatched to ${acc.email}.`);

    // 3. Await backend persistence
    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          companyId: acc.id,
          email: acc.email,
          contactName: acc.contact_name,
          companyName: acc.name,
          tier: acc.membership_tier,
        }),
      });
    } catch (err) {
      console.warn('Backend approval sync notice:', err);
    }

    // 4. Reload data with guaranteed preserved approval
    await loadData();
  };

  const handleToggleSuspend = async (acc: AdminClientAccount) => {
    const isCurrentlySuspended = acc.account_status === 'suspended';
    const newStatus = isCurrentlySuspended ? 'active' : 'suspended';
    const newApproval = isCurrentlySuspended ? 'approved' : 'rejected';

    // Optimistic AJAX state update
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === acc.id
          ? { ...a, account_status: newStatus, approval_status: newApproval }
          : a
      )
    );

    if (isCurrentlySuspended) {
      unsuspendAccount(acc.id);
      showNotice(`Account "${acc.name}" reactivated. Welcome notice dispatched.`);
      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsuspend',
            companyId: acc.id,
            email: acc.email,
            contactName: acc.contact_name,
            companyName: acc.name,
          }),
        });
      } catch {}
    } else {
      suspendAccount(acc.id);
      showNotice(`Account "${acc.name}" suspended. Suspension notice dispatched to ${acc.email}.`);
      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'suspend',
            companyId: acc.id,
            email: acc.email,
            contactName: acc.contact_name,
            companyName: acc.name,
          }),
        });
      } catch {}
    }
    loadData();
  };

  const handleDelete = async (acc: AdminClientAccount) => {
    if (acc.role === 'admin' || acc.email?.toLowerCase() === 'admin@b2blink.eu') {
      showNotice('Admin accounts cannot be deleted or removed.');
      setDeleteConfirmAccount(null);
      return;
    }

    // 1. Optimistic AJAX UI update immediately - NO hard reload
    setAccounts((prev) => prev.filter((a) => a.id !== acc.id && a.email !== acc.email));
    setDeleteConfirmAccount(null);
    deleteAccount(acc.id, acc.email);
    showNotice(`Account "${acc.name}" permanently deleted.`);

    // 2. AJAX call to API to delete from database
    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          companyId: acc.id,
          email: acc.email,
        }),
      });
    } catch (err) {
      console.warn('AJAX delete error:', err);
    }

    // 3. Re-sync via AJAX in background
    loadData();
  };

  const handleClearCatalogLots = async (acc: AdminClientAccount) => {
    // Optimistic UI update
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, listings_count: 0 } : a))
    );
    setClearLotsConfirmAccount(null);
    showNotice(`Cleared all catalog lots for "${acc.name}".`);

    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_listings', companyId: acc.id }),
      });
      await fetch(`/api/products?companyId=${encodeURIComponent(acc.id)}`, {
        method: 'DELETE',
      });
      // Also update local storage if any
      const rawUser = localStorage.getItem('b2b_seller_listings_v3');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (Array.isArray(parsed)) {
            localStorage.setItem('b2b_seller_listings_v3', JSON.stringify(parsed.filter((p: any) => p.company_id !== acc.id)));
          }
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('b2b_admin_update'));
      }
    } catch {
      showNotice(`Failed to clear catalog lots for ${acc.name}.`);
    }
    loadData();
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTierAccount) return;
    const targetAccount = editingTierAccount;
    const newTier = selectedTier;
    setEditingTierAccount(null);

    // Optimistic AJAX update
    setAccounts((prev) =>
      prev.map((a) => (a.id === targetAccount.id ? { ...a, membership_tier: newTier } : a))
    );
    updateAccountTier(targetAccount.id, newTier, targetAccount.email);
    showNotice(`Membership tier updated to ${newTier.toUpperCase()} for ${targetAccount.name}`);

    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tier',
          companyId: targetAccount.id,
          email: targetAccount.email,
          tier: newTier,
        }),
      });
    } catch {}
    loadData();
  };

  const handleOpenEditInfo = (acc: AdminClientAccount) => {
    setOpenMenuId(null);
    setEditingInfoAccount(acc);
    setEditForm({
      contact_name: acc.contact_name || '',
      company_name: acc.name || '',
      email: acc.email || '',
      phone: acc.phone || '',
      address: acc.address || '',
      country: acc.country || '',
      company_number: acc.company_number || '',
      vat_number: acc.vat_number || '',
    });
    setEditError(null);
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInfoAccount) return;

    const trimmedContact = editForm.contact_name.trim();
    const trimmedCompany = editForm.company_name.trim();
    const trimmedEmail = editForm.email.trim().toLowerCase();

    if (!trimmedContact) {
      setEditError('Contact representative name is required.');
      return;
    }
    if (!trimmedCompany) {
      setEditError('Company name is required.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setEditError('A valid corporate email address is required.');
      return;
    }

    const currentEmail = (editingInfoAccount.email || '').trim().toLowerCase();
    const isEmailChanging = trimmedEmail !== currentEmail;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_info',
          companyId: editingInfoAccount.id,
          contactName: trimmedContact,
          companyName: trimmedCompany,
          email: trimmedEmail,
          currentEmail,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          country: editForm.country.trim() || null,
          companyNumber: editForm.company_number.trim() || null,
          vatNumber: editForm.vat_number.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setEditError(data.error || 'Failed to update member information.');
        setEditLoading(false);
        return;
      }

      // Optimistic state update in accounts list
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingInfoAccount.id
            ? {
                ...a,
                name: trimmedCompany,
                contact_name: trimmedContact,
                email: trimmedEmail,
                phone: editForm.phone.trim() || null,
                address: editForm.address.trim() || null,
                country: editForm.country.trim() || a.country,
                company_number: editForm.company_number.trim() || null,
                vat_number: editForm.vat_number.trim() || null,
              }
            : a
        )
      );

      // Also update local storage cache helper
      updateAccountBasicInfo(editingInfoAccount.id, {
        name: trimmedCompany,
        contact_name: trimmedContact,
        email: trimmedEmail,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        country: editForm.country.trim() || editingInfoAccount.country,
        company_number: editForm.company_number.trim() || null,
        vat_number: editForm.vat_number.trim() || null,
      });

      if (isEmailChanging) {
        showNotice(
          `Updated "${trimmedCompany}". Email change notices sent to ${currentEmail} and ${trimmedEmail}.`
        );
      } else {
        showNotice(`Member information for "${trimmedCompany}" successfully updated.`);
      }

      setEditingInfoAccount(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Network error updating member information.');
    } finally {
      setEditLoading(false);
    }
  };

  const [isPurging, setIsPurging] = useState(false);
  const handlePurgeTestData = async () => {
    if (!confirm('Are you sure you want to purge all test accounts and reset database tables? Only the platform admin (admin@b2blink.eu) will be preserved.')) {
      return;
    }
    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/purge-test-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotice('Successfully purged all test accounts and cleared tables.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_admin_accounts_v5');
          localStorage.removeItem('b2b_admin_accounts_v4');
          localStorage.removeItem('b2b_admin_status_overrides_v2');
          localStorage.removeItem('b2b_registered_users_v1');
        }
        await loadData();
      } else {
        showNotice('Purge notice: ' + (data.error || 'Check server connection'));
      }
    } catch {
      showNotice('Network error purging test data.');
    } finally {
      setIsPurging(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Admin accounts cannot be listed or shown in the client accounts directory
      if (acc.role === 'admin' || acc.email?.toLowerCase() === 'admin@b2blink.eu') {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.name.toLowerCase().includes(q) ||
        acc.contact_name.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.vat_number && acc.vat_number.toLowerCase().includes(q)) ||
        (acc.country && acc.country.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (roleFilter === 'seller') return acc.role === 'seller';
      if (roleFilter === 'buyer') return acc.role === 'buyer';
      if (roleFilter === 'suspended') return acc.account_status === 'suspended';
      if (roleFilter === 'pending') return acc.approval_status === 'pending' || acc.approval_status === 'pending_verification';

      return true;
    });
  }, [accounts, searchQuery, roleFilter]);

  const clientAccounts = accounts.filter(
    (a) => a.role !== 'admin' && a.email?.toLowerCase() !== 'admin@b2blink.eu'
  );
  const sellerCount = clientAccounts.filter((a) => a.role === 'seller').length;
  const buyerCount = clientAccounts.filter((a) => a.role === 'buyer').length;
  const suspendedCount = clientAccounts.filter((a) => a.account_status === 'suspended').length;
  const pendingCount = clientAccounts.filter((a) => a.approval_status === 'pending' || a.approval_status === 'pending_verification').length;

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Accounts Directory
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5B6B82] mt-1 font-normal">
            Real registered platform accounts. Audit client dossiers, verify wholesale documents, or manage access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#EBF3FF] text-[#0A6CFF] text-[12px] font-bold px-3.5 py-1.5 rounded-full">
            {clientAccounts.length} active clients
          </div>
          <button
            type="button"
            onClick={() => setAddMemberModalOpen(true)}
            className="bg-[#0A6CFF] hover:bg-[#0857CF] text-white text-[12px] font-bold px-4 py-1.5 rounded-full shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Verify / Add Account</span>
          </button>
          <button
            type="button"
            onClick={handlePurgeTestData}
            disabled={isPurging}
            className="bg-red-50 text-red-600 hover:bg-red-100 text-[12px] font-bold px-3.5 py-1.5 rounded-full border border-red-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Wipe all test accounts and clear Supabase tables, preserving admin"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPurging ? 'Purging...' : 'Reset & Purge Test Accounts'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="mt-6 space-y-4">
        {/* Pills: Keep only All, Pending, and Suspended with shortened names */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#0B1F3A] text-white shadow-xs'
                : 'bg-white text-[#41536D] border border-[#EAEFF6] hover:bg-[#F3F6FB]'
            }`}
          >
            All ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('pending')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              roleFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            <span>Pending ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('suspended')}
            className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              roleFilter === 'suspended'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Suspended ({suspendedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact person, or email..."
            className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#EAEFF6] rounded-full text-[#0B1F3A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A6CFF] transition font-medium"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Accounts Table Card */}
      <div className="mt-6 bg-white rounded-[24px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A9BB0]">
                <th className="py-4 px-6">COMPANY / JURISDICTION</th>
                <th className="py-4 px-6">ROLE &amp; TIER</th>
                <th className="py-4 px-6">PRIMARY CONTACT</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">CATALOG LOTS</th>
                <th className="py-4 px-6 text-right">ADMIN ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC] text-[14px]">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#5B6B82]">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-[15px] text-[#0B1F3A]">No client accounts found</p>
                    <p className="text-[12px] mt-1 text-[#8A9BB0]">Accounts registered in this browser or verified via admin will appear here.</p>
                    <button
                      type="button"
                      onClick={() => setAddMemberModalOpen(true)}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A6CFF] text-white text-[12px] font-bold hover:bg-[#0857CF] transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Verify / Add Account by Email</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSuspended = acc.account_status === 'suspended';

                  return (
                    <tr key={acc.id} className="hover:bg-[#F8FAFC]/70 transition group">
                      {/* Company & Country */}
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => setSelectedDossier(acc)}
                          className="font-bold text-[#0B1F3A] hover:text-[#0A6CFF] text-left transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{acc.name}</span>
                        </button>
                        <div className="text-[12px] text-[#8A9BB0] mt-0.5 flex items-center gap-1.5">
                          <span>{acc.country || 'Global'}</span>
                          {acc.vat_number && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[11px]">{acc.vat_number}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Role & Tier */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                              acc.role === 'seller'
                                ? 'bg-blue-50 text-[#0A6CFF]'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {acc.role}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTierAccount(acc);
                              setSelectedTier(acc.membership_tier);
                            }}
                            className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-[#41536D] hover:bg-[#EAEFF6] transition cursor-pointer"
                            title="Click to change membership tier"
                          >
                            {acc.membership_tier}
                          </button>
                        </div>
                        <div className="text-[11px] text-[#8A9BB0] mt-1 font-medium">
                          {acc.total_spend_or_sales}
                        </div>
                      </td>

                      {/* Contact - Requirement 02: Real name shown */}
                      <td className="py-4 px-6 text-[#5B6B82]">
                        <div className="font-bold text-[#0B1F3A] text-[13px]">{acc.contact_name}</div>
                        <div className="text-[12px] text-[#0A6CFF]">{acc.email}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span>Active: {acc.last_active || 'Recently'}</span>
                          {(acc.last_active?.includes('mo ago') || (acc.last_active_at && (Date.now() - new Date(acc.last_active_at).getTime()) >= 30 * 24 * 60 * 60 * 1000)) && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              30d+ Inactive
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-red-200">
                            <Ban className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : acc.approval_status === 'pending' || acc.approval_status === 'pending_verification' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending KYC</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active / Verified</span>
                          </span>
                        )}
                      </td>

                      {/* Listings Count */}
                      <td className="py-4 px-6 text-[#0B1F3A] font-bold">
                        {acc.listings_count > 0 ? (
                          <span>{acc.listings_count} lots</span>
                        ) : (
                          <span className="text-[#8A9BB0] font-normal">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Verify Button for Pending Accounts */}
                          {(acc.approval_status === 'pending' || acc.approval_status === 'pending_verification') && (
                            <button
                              type="button"
                              onClick={() => handleVerifyAccount(acc)}
                              title="Verify wholesale documents & activate account"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs cursor-pointer mr-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Upload Bulk CSV Quick Actions: WTS & WTB */}
                          <div className="flex items-center gap-0.5 bg-[#F1F5F9] p-0.5 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                setBulkCsvMode('WTS');
                                setBulkCsvAccount(acc);
                              }}
                              title="Upload WTS (Sell Offers) CSV"
                              className="px-2 py-1 rounded-lg text-[#0A6CFF] hover:bg-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>WTS</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBulkCsvMode('WTB');
                                setBulkCsvAccount(acc);
                              }}
                              title="Upload WTB (Buy Requirements) CSV"
                              className="px-2 py-1 rounded-lg text-[#16A34A] hover:bg-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>WTB</span>
                            </button>
                          </div>

                          {/* Message Button */}
                          <button
                            type="button"
                            onClick={() => router.push(`/site-admin/messages?to=${acc.id}`)}
                            title="Open direct message thread"
                            className="p-2 rounded-xl text-slate-400 hover:text-[#0A6CFF] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Dossier Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDossier(acc)}
                            title="View client dossier"
                            className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* More Options Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === acc.id ? null : acc.id)}
                              title="More options"
                              className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] hover:bg-slate-100 transition cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === acc.id && (
                              <div
                                className="absolute right-0 top-full mt-1 min-w-[280px] sm:min-w-[310px] w-auto bg-white rounded-2xl shadow-xl border border-[#EAEFF6] py-1.5 z-30 animate-in fade-in zoom-in-95 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setBulkCsvMode('WTS');
                                    setBulkCsvAccount(acc);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-[12px] font-bold text-[#0A6CFF] hover:bg-blue-50 flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap"
                                >
                                  <ArrowUpRight className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                                  <span>Upload WTS (Sell Offers) CSV</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setBulkCsvMode('WTB');
                                    setBulkCsvAccount(acc);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap"
                                >
                                  <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Upload WTB (Buy Requirements) CSV</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditInfo(acc)}
                                  className="w-full px-3.5 py-2.5 text-[12px] font-bold text-[#0B1F3A] hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap"
                                >
                                  <UserCog className="w-4 h-4 text-[#0A6CFF] shrink-0" />
                                  <span>Edit Member Information</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setSelectedDossier(acc);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-[12px] font-bold text-[#0B1F3A] hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap"
                                >
                                  <Eye className="w-4 h-4 text-[#5B6B82] shrink-0" />
                                  <span>View Dossier</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setEditingTierAccount(acc);
                                    setSelectedTier(acc.membership_tier);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-[12px] font-bold text-[#0B1F3A] hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap"
                                >
                                  <Edit className="w-4 h-4 text-[#5B6B82] shrink-0" />
                                  <span>Change Membership Tier</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditInfo(acc)}
                                  className="w-full px-3.5 py-2 text-[12px] font-bold text-[#0B1F3A] hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <UserCog className="w-4 h-4 text-[#0A6CFF]" />
                                  <span>Edit Member Information</span>
                                </button>

                                {acc.listings_count > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setClearLotsConfirmAccount(acc);
                                    }}
                                    className="w-full px-3.5 py-2 text-[12px] font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                                  >
                                    <Package className="w-4 h-4 text-amber-600" />
                                    <span>Clear All Lots ({acc.listings_count})</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleSendInactivityReminder(acc);
                                  }}
                                  className="w-full px-3.5 py-2 text-[12px] font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  <span>Send Inactivity Reminder</span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleToggleSuspend(acc);
                                  }}
                                  className={`w-full px-3.5 py-2 text-[12px] font-bold flex items-center gap-2 transition cursor-pointer ${
                                    isSuspended ? 'text-emerald-700 hover:bg-emerald-50' : 'text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  <Ban className="w-4 h-4" />
                                  <span>{isSuspended ? 'Reactivate Account' : 'Suspend Account'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteConfirmAccount(acc);
                                  }}
                                  className="w-full px-3.5 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Delete Account</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOSSIER MODAL */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] font-black text-[16px] flex items-center justify-center">
                  {selectedDossier.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[17px] font-extrabold text-[#0B1F3A]">
                    {selectedDossier.name}
                  </h3>
                  <p className="text-[12px] text-[#5B6B82]">
                    Role: <strong className="uppercase">{selectedDossier.role}</strong> · {selectedDossier.membership_tier.toUpperCase()} Tier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDossier(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8FAFC] border border-[#EAEFF6]">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Registration No</span>
                  <p className="font-mono font-bold text-[#0B1F3A] mt-0.5">
                    {selectedDossier.company_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">VAT / Tax ID</span>
                  <p className="font-mono font-bold text-[#0A6CFF] mt-0.5">
                    {selectedDossier.vat_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Jurisdiction</span>
                  <p className="font-bold text-[#0B1F3A] mt-0.5">{selectedDossier.country}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#8A9BB0]">Account Status</span>
                  <p className={`font-bold mt-0.5 ${selectedDossier.account_status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedDossier.account_status.toUpperCase()}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-[#8A9BB0] block mb-1">
                  Contact Information
                </span>
                <div className="p-3.5 rounded-xl border border-[#EAEFF6] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A9BB0]">Name:</span>
                    <strong className="text-[#0B1F3A]">{selectedDossier.contact_name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A9BB0]">Email:</span>
                    <span className="text-[#0A6CFF] font-semibold">{selectedDossier.email}</span>
                  </div>
                  {selectedDossier.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#8A9BB0]">Phone:</span>
                      <span className="text-[#0B1F3A] font-medium">{selectedDossier.phone}</span>
                    </div>
                  )}
                  {selectedDossier.address && (
                    <div className="flex items-start gap-2">
                      <span className="text-[#8A9BB0]">Address:</span>
                      <span className="text-[#0B1F3A] font-medium">{selectedDossier.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => {
                  const target = selectedDossier;
                  setSelectedDossier(null);
                  handleToggleSuspend(target);
                }}
                className={`text-[13px] font-bold transition ${
                  selectedDossier.account_status === 'suspended'
                    ? 'text-emerald-600 hover:underline'
                    : 'text-amber-600 hover:underline'
                }`}
              >
                {selectedDossier.account_status === 'suspended' ? 'Reactivate Client' : 'Suspend Access'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDossier;
                    setSelectedDossier(null);
                    handleOpenEditInfo(target);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-[#0B1F3A] text-[13px] font-bold px-3.5 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5"
                >
                  <UserCog className="w-3.5 h-3.5 text-[#0A6CFF]" />
                  <span>Edit Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDossier;
                    setSelectedDossier(null);
                    setBulkCsvMode('WTS');
                    setBulkCsvAccount(target);
                  }}
                  className="bg-blue-50 text-[#0A6CFF] hover:bg-blue-100 text-[13px] font-bold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Upload WTS (Sell)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDossier;
                    setSelectedDossier(null);
                    setBulkCsvMode('WTB');
                    setBulkCsvAccount(target);
                  }}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[13px] font-bold px-4 py-2.5 rounded-full transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload WTB (Buy)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDossier;
                    setSelectedDossier(null);
                    router.push(`/site-admin/messages?to=${target.id}`);
                  }}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message Client</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TIER MODAL */}
      {editingTierAccount && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <h3 className="text-[17px] font-bold text-[#0B1F3A]">
              Modify Membership Tier
            </h3>
            <p className="text-[12px] text-[#5B6B82] mt-0.5">
              Adjust quota permissions for <strong>{editingTierAccount.name}</strong>.
            </p>

            <form onSubmit={handleSaveTier} className="mt-5 space-y-4">
              <div className="space-y-2">
                {(['bronze', 'silver', 'gold'] as MembershipTier[]).map((tier) => (
                  <label
                    key={tier}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                      selectedTier === tier
                        ? 'border-[#0A6CFF] bg-[#EBF3FF]/40 text-[#0B1F3A]'
                        : 'border-[#EAEFF6] hover:bg-slate-50 text-[#5B6B82]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="tier"
                        value={tier}
                        checked={selectedTier === tier}
                        onChange={() => setSelectedTier(tier)}
                        className="text-[#0A6CFF] focus:ring-[#0A6CFF]"
                      />
                      <div>
                        <strong className="text-[14px] font-bold uppercase text-[#0B1F3A] block">
                          {tier} Tier
                        </strong>
                        <span className="text-[11px] text-[#8A9BB0]">
                          {tier === 'bronze' && '15 products quota, manual quoting'}
                          {tier === 'silver' && '50 products, CSV upload enabled'}
                          {tier === 'gold' && 'Unlimited listings, Hot Deals, priority ranking'}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTierAccount(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMBER INFORMATION MODAL */}
      {editingInfoAccount && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !editLoading && setEditingInfoAccount(null)}
        >
          <div
            className="bg-white rounded-[32px] p-6 sm:p-7 max-w-xl w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#EBF3FF] text-[#0A6CFF] flex items-center justify-center shrink-0">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[17px] font-extrabold text-[#0B1F3A]">
                    Edit Member Information
                  </h3>
                  <p className="text-[12px] text-[#5B6B82]">
                    Update contact details, company profile, and address for <strong>{editingInfoAccount.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={editLoading}
                onClick={() => setEditingInfoAccount(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {editError && (
              <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBasicInfo} className="mt-5 space-y-4">
              {/* Row 1: Contact Representative & Company Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Contact Representative *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.company_name}
                    onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                    placeholder="e.g. Nordic Electro Ltd"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>
              </div>

              {/* Row 2: Email Address & Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="e.g. contact@company.eu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="e.g. +372 555 1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>
              </div>

              {/* Email Change Dynamic Notice */}
              {editForm.email.trim().toLowerCase() !== (editingInfoAccount.email || '').trim().toLowerCase() && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-600 font-bold text-sm shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <strong className="font-bold text-[#0B1F3A]">Automatic Dual-Email Dispatch:</strong>
                      <p className="mt-0.5 text-[11.5px] text-amber-800">
                        Updating the email will automatically dispatch two transactional communications:
                      </p>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-amber-900 font-medium">
                        <li>
                          A security notice to the current email (<strong>{editingInfoAccount.email}</strong>) alerting them of the change.
                        </li>
                        <li>
                          An activation email to the new address (<strong>{editForm.email.trim().toLowerCase()}</strong>) prompting them to log in to activate access.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3: Registered Business / Trading Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Registered Business / Trading Address
                </label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="e.g. Narva mnt 5, 10117 Tallinn, Estonia"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                />
              </div>

              {/* Row 4: Country, Company Registration No & VAT Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Country / Market
                  </label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    placeholder="e.g. Estonia"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Company Reg No
                  </label>
                  <input
                    type="text"
                    value={editForm.company_number}
                    onChange={(e) => setEditForm({ ...editForm, company_number: e.target.value })}
                    placeholder="e.g. 14892341"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold font-mono focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    VAT / Tax ID
                  </label>
                  <input
                    type="text"
                    value={editForm.vat_number}
                    onChange={(e) => setEditForm({ ...editForm, vat_number: e.target.value })}
                    placeholder="e.g. EE102219482"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold font-mono focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  disabled={editLoading}
                  onClick={() => setEditingInfoAccount(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82] hover:text-[#0B1F3A] transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {editLoading ? 'Saving...' : 'Save Member Information'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmAccount && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6]">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-[#0B1F3A] text-center">
              Delete Client Account?
            </h3>
            <p className="text-[13px] text-[#5B6B82] text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteConfirmAccount.name}</strong>?
              This will remove all associated product listings and quotes.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmAccount(null)}
                className="px-5 py-2.5 rounded-full bg-slate-100 text-[#0B1F3A] font-semibold text-[13px] hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmAccount)}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] shadow-xs transition cursor-pointer"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL CATALOG LOTS CONFIRMATION MODAL */}
      {clearLotsConfirmAccount && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-[19px] font-black text-[#0B1F3A] text-center">
              Clear All Catalog Lots?
            </h3>
            <p className="text-[13px] text-[#5B6B82] text-center mt-1.5 leading-relaxed">
              Are you sure you want to delete all <strong>{clearLotsConfirmAccount.listings_count} catalog lots</strong> for <strong>{clearLotsConfirmAccount.name}</strong>? This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setClearLotsConfirmAccount(null)}
                className="px-5 py-2.5 rounded-full bg-slate-100 text-[#0B1F3A] font-semibold text-[13px] hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleClearCatalogLots(clearLotsConfirmAccount)}
                className="px-6 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[13px] shadow-xs transition cursor-pointer"
              >
                Yes, Clear All Lots
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / VERIFY MEMBER MODAL */}
      {addMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 max-w-lg w-full text-[#0B1F3A] shadow-2xl border border-[#EAEFF6] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-[18px] font-black text-[#0B1F3A]">Verify or Add Account</h3>
                <p className="text-[12px] text-[#5B6B82] mt-0.5">
                  Approve an existing pending account or register a new verified member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddMemberModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOrVerifyMember} className="mt-4 space-y-4">
              {addMemberError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{addMemberError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Member / Company Corporate Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={addMemberForm.email}
                  onChange={(e) => setAddMemberForm({ ...addMemberForm, email: e.target.value })}
                  placeholder="e.g. member@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={addMemberForm.company_name}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, company_name: e.target.value })}
                    placeholder="e.g. Nordic Trade OÜ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={addMemberForm.contact_name}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, contact_name: e.target.value })}
                    placeholder="e.g. Alexander Tamm"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0A6CFF] focus:ring-2 focus:ring-[#0A6CFF]/10 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Role
                  </label>
                  <select
                    value={addMemberForm.role}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="seller">Seller</option>
                    <option value="buyer">Buyer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Tier
                  </label>
                  <select
                    value={addMemberForm.tier}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, tier: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="bronze">Bronze (Free)</option>
                    <option value="silver">Silver (€79/mo)</option>
                    <option value="gold">Gold (€179/mo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Status
                  </label>
                  <select
                    value={addMemberForm.approval_status}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, approval_status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="approved">Approved &amp; Verified</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  disabled={addMemberLoading}
                  onClick={() => setAddMemberModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#5B6B82] hover:text-[#0B1F3A] transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberLoading}
                  className="bg-[#0A6CFF] hover:bg-[#0857cf] text-white text-[13px] font-bold px-5 py-2.5 rounded-full shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{addMemberLoading ? 'Saving...' : 'Save & Verify Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN BULK CSV MODAL */}
      <AdminBulkCsvModal
        isOpen={Boolean(bulkCsvAccount)}
        onClose={() => setBulkCsvAccount(null)}
        account={bulkCsvAccount}
        initialMode={bulkCsvMode}
        onSuccess={handleBulkCsvSuccess}
      />
    </>
  );
}
