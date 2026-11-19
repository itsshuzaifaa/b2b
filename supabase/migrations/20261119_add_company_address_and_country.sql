-- Migration: Add address and country to companies table for comprehensive member profiles
-- Run this statement in Supabase SQL Editor:

alter table companies add column if not exists address text;
alter table companies add column if not exists country text;

-- Backfill existing address and country from auth.users user_metadata
update public.companies c
set 
  address = coalesce(c.address, u.raw_user_meta_data->>'address'),
  country = coalesce(c.country, u.raw_user_meta_data->>'country')
from auth.users u
where c.user_id = u.id;
