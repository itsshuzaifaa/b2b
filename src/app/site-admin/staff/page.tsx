'use client';

import React, { useState, useEffect } from 'react';
import {
  ADMIN_PERMISSION_GROUPS,
  ALL_ADMIN_PERMISSIONS,
  type AdminPermission,
  type AdminRole,
  type AdminStatus,
} from '@/lib/admin/permissions';
import {
  UserPlus,
  Shield,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Edit3,
  Trash2,
  Ban,
  Check,
  Copy,
  Users,
} from 'lucide-react';

interface StaffMember {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  permissions: AdminPermission[];
  invited_at?: string | null;
  onboarded_at?: string | null;
}

export default function SiteAdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<AdminPermission[]>(['overview.view']);
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  // Edit Permissions Modal
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<AdminPermission[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.staff)) {
        setStaff(data.staff);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to load staff directory.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error while loading staff.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const togglePermissionInList = (
    list: AdminPermission[],
    setter: React.Dispatch<React.SetStateAction<AdminPermission[]>>,
    perm: AdminPermission
  ) => {
    setter(list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
  };

  const toggleGroupInList = (
    list: AdminPermission[],
    setter: React.Dispatch<React.SetStateAction<AdminPermission[]>>,
    groupPerms: AdminPermission[]
  ) => {
    const allSelected = groupPerms.every((p) => list.includes(p));
    if (allSelected) {
      setter(list.filter((p) => !groupPerms.includes(p)));
    } else {
      setter(Array.from(new Set([...list, ...groupPerms])));
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLastInviteUrl(null);
    setInviting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          permissions: invitePermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to send invitation.' });
      } else {
        setFeedback({ type: 'success', message: data.message });
        if (data.setupUrl) setLastInviteUrl(data.setupUrl);
        setShowInviteModal(false);
        setInviteEmail('');
        setInvitePermissions(['overview.view']);
        loadStaff();
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to invite staff member.' });
    } finally {
      setInviting(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    setSavingEdit(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingMember.user_id,
          permissions: editPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to update permissions.' });
      } else {
        setFeedback({ type: 'success', message: data.message });
        setEditingMember(null);
        loadStaff();
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error while updating permissions.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusToggle = async (member: StaffMember) => {
    const nextStatus: AdminStatus = member.status === 'suspended' ? 'active' : 'suspended';
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to update status.' });
      } else {
        setFeedback({ type: 'success', message: data.message });
        loadStaff();
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating status.' });
    }
  };

  const handleResendInvite = async (member: StaffMember) => {
    setFeedback(null);
    setLastInviteUrl(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, action: 'resend_invite' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to resend invite.' });
      } else {
        setFeedback({ type: 'success', message: data.message });
        if (data.setupUrl) setLastInviteUrl(data.setupUrl);
        loadStaff();
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error resending invite.' });
    }
  };

  const handleRemoveStaff = async (member: StaffMember) => {
    if (!confirm(`Remove admin staff access for ${member.email}?`)) return;
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/staff?userId=${encodeURIComponent(member.user_id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to remove staff.' });
      } else {
        setFeedback({ type: 'success', message: data.message });
        loadStaff();
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error removing staff.' });
    }
  };

  const renderPermissionChecklist = (
    selected: AdminPermission[],
    setter: React.Dispatch<React.SetStateAction<AdminPermission[]>>
  ) => {
    const mid = Math.ceil(ADMIN_PERMISSION_GROUPS.length / 2);
    const leftGroups = ADMIN_PERMISSION_GROUPS.slice(0, mid);
    const rightGroups = ADMIN_PERMISSION_GROUPS.slice(mid);

    const renderGroupCard = (group: (typeof ADMIN_PERMISSION_GROUPS)[number]) => {
      const groupKeys = group.permissions.map((p) => p.key);
      const allInGroup = groupKeys.every((k) => selected.includes(k));
      return (
        <div key={group.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div>
              <div className="text-[13.5px] font-extrabold text-[#0B1F3A]">{group.pageLabel}</div>
              <div className="text-[11px] text-[#64748B]">{group.href}</div>
            </div>
            <button
              type="button"
              onClick={() => toggleGroupInList(selected, setter, groupKeys)}
              className={`text-[11px] font-bold px-3 py-1 rounded-full cursor-pointer ${
                allInGroup
                  ? 'bg-[#0A6CFF] text-white'
                  : 'bg-white border border-slate-200 text-[#0B1F3A] hover:bg-slate-100'
              }`}
            >
              {allInGroup ? 'All On' : 'Enable All'}
            </button>
          </div>

          <div className="space-y-1.5">
            {group.permissions.map((perm) => {
              const checked = selected.includes(perm.key);
              return (
                <label
                  key={perm.key}
                  className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermissionInList(selected, setter, perm.key)}
                    className="mt-0.5 w-4 h-4 rounded accent-[#0A6CFF] cursor-pointer shrink-0"
                  />
                  <div>
                    <div className="text-[12.5px] font-bold text-[#0B1F3A] leading-tight">{perm.label}</div>
                    <div className="text-[11px] text-[#64748B] leading-snug">{perm.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-[#5B6B82]">
            {selected.length} of {ALL_ADMIN_PERMISSIONS.length} permissions selected
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setter([...ALL_ADMIN_PERMISSIONS])}
              className="text-[12px] font-bold text-[#0A6CFF] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setter([])}
              className="text-[12px] font-bold text-slate-500 hover:underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-3">{leftGroups.map(renderGroupCard)}</div>
          <div className="space-y-3">{rightGroups.map(renderGroupCard)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3FF] text-[#0A6CFF] text-[11px] font-bold uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Team Access Control</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0B1F3A] tracking-[-0.025em] leading-tight">
            Admin Staff &amp; Permissions
          </h1>
          <p className="text-[14px] text-[#5B6B82] mt-1">
            Invite staff members by email and control exactly which admin pages and features each person can access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadStaff}
            className="px-4 py-2.5 rounded-full bg-white border border-[#EAEFF6] hover:bg-slate-50 text-[#0B1F3A] font-bold text-[13px] flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-[13px] font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Copyable Invite Link Box (helpful when testing locally or in mock email mode) */}
      {lastInviteUrl && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[12.5px] text-[#0B1F3A] break-all">
            <span className="font-extrabold text-[#0A6CFF] uppercase text-[11px] block mb-0.5">
              Generated Onboarding Link
            </span>
            <code className="font-mono text-[12px]">{lastInviteUrl}</code>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(lastInviteUrl);
            }}
            className="px-3.5 py-2 rounded-xl bg-white border border-blue-200 text-[#0A6CFF] font-bold text-[12px] flex items-center gap-1.5 shrink-0 cursor-pointer hover:bg-blue-100/50"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Link</span>
          </button>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-[26px] border border-[#EAEFF6] shadow-[0_4px_20px_rgba(11,31,58,0.02)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0A6CFF]" />
            <h2 className="text-[16px] font-extrabold text-[#0B1F3A]">
              Admin &amp; Staff Directory ({staff.length})
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#5B6B82] text-[14px]">Loading staff members...</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-[#5B6B82] text-[14px]">No staff members found.</div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {staff.map((member) => {
              const isSuper = member.role === 'super_admin';
              return (
                <div
                  key={member.user_id}
                  className="p-5 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-[#0B1F3A] text-white font-bold text-sm flex items-center justify-center overflow-hidden shrink-0">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.full_name || member.email} className="w-full h-full object-cover" />
                      ) : (
                        (member.full_name || member.email).slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-extrabold text-[#0B1F3A]">
                          {member.full_name || member.email.split('@')[0]}
                        </span>
                        {isSuper ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            Super Admin
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Staff
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            member.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : member.status === 'invited'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      <div className="text-[12.5px] text-[#5B6B82] flex items-center gap-2 flex-wrap mt-0.5">
                        <span>{member.email}</span>
                        {member.job_title && (
                          <>
                            <span>&bull;</span>
                            <span>{member.job_title}</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span className="font-semibold text-[#0B1F3A]">
                          {isSuper ? 'Full Platform Access' : `${member.permissions.length} permissions`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isSuper && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(member);
                          setEditPermissions([...member.permissions]);
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0B1F3A] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#0A6CFF]" />
                        <span>Permissions</span>
                      </button>

                      {member.status === 'invited' && (
                        <button
                          type="button"
                          onClick={() => handleResendInvite(member)}
                          className="px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[12px] font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Resend Invite</span>
                        </button>
                      )}

                      {member.status !== 'invited' && (
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(member)}
                          className={`px-3.5 py-1.5 rounded-xl border text-[12px] font-bold flex items-center gap-1.5 cursor-pointer ${
                            member.status === 'suspended'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {member.status === 'suspended' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Reactivate</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(member)}
                        className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                        title="Remove staff access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Staff Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55">
          <div className="w-full max-w-6xl bg-white rounded-[28px] border border-[#EAEFF6] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF]">
                  Invite Internal Staff
                </span>
                <h3 className="text-[20px] font-black">Add Staff Member &amp; Set Permissions</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-1.5">
                  Staff Email Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@b2blink.eu"
                    className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-white border border-[#CBD5E1] rounded-xl text-[#0B1F3A] font-medium focus:outline-none focus:border-[#0A6CFF]"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11.5px] text-[#64748B] mt-1">
                  They will receive an email link to set up their name, profile picture, and password.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0B1F3A] mb-2">
                  Allowed Admin Pages &amp; Features *
                </label>
                {renderPermissionChecklist(invitePermissions, setInvitePermissions)}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-5 py-2.5 rounded-full text-[13px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{inviting ? 'Sending Invitation...' : 'Send Staff Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55">
          <div className="w-full max-w-6xl bg-white rounded-[28px] border border-[#EAEFF6] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5FF]">
                  Update Permissions
                </span>
                <h3 className="text-[20px] font-black">{editingMember.full_name || editingMember.email}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {renderPermissionChecklist(editPermissions, setEditPermissions)}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-5 py-2.5 rounded-full text-[13px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSavePermissions}
                  className="px-6 py-2.5 rounded-full bg-[#0A6CFF] hover:bg-[#0857CF] text-white font-bold text-[13px] cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
