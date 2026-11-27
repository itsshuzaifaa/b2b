-- Migration: Add staff roles, granular permissions, profile fields, and invite tokens to public.admins
-- Run this statement in Supabase SQL Editor:

alter table public.admins add column if not exists role text not null default 'staff';
alter table public.admins add column if not exists full_name text;
alter table public.admins add column if not exists phone text;
alter table public.admins add column if not exists avatar_url text;
alter table public.admins add column if not exists job_title text;
alter table public.admins add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table public.admins add column if not exists status text not null default 'active';
alter table public.admins add column if not exists invite_token_hash text;
alter table public.admins add column if not exists invite_expires_at timestamptz;
alter table public.admins add column if not exists invited_by uuid;
alter table public.admins add column if not exists invited_at timestamptz;
alter table public.admins add column if not exists onboarded_at timestamptz;

-- Ensure primary platform administrator is marked as super_admin with active status
update public.admins
set role = 'super_admin',
    status = 'active'
where lower(email) = 'admin@b2blink.eu'
   or notes = 'Primary Platform Administrator';

create index if not exists idx_admins_user_id on public.admins(user_id);
create index if not exists idx_admins_email on public.admins(email);
create index if not exists idx_admins_invite_token_hash on public.admins(invite_token_hash);
