-- pending_push.sql — Web Push storage (matches backend-sql/10_push.sql).
--
-- These tables already exist in the live database (they are in
-- src/integrations/supabase/types.ts), but they were only ever shipped through
-- backend-sql/, so a fresh environment would miss them. This file is the
-- migration-safe, idempotent copy; it never deletes a row and never rewrites
-- an existing subscription.
--
-- Apply AFTER the existing migrations. The delivery function/trigger half lives
-- in backend-sql/10_push.sql and needs `pg_net` plus a populated
-- private.push_config (worker_url + shared_secret) before anything is sent.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dms boolean not null default true,
  calls boolean not null default true,
  group_mentions boolean not null default true,
  quiet_start time,
  quiet_end time,
  muted_conversations uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists notification_prefs_select_own on public.notification_prefs;
create policy notification_prefs_select_own on public.notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists notification_prefs_insert_own on public.notification_prefs;
create policy notification_prefs_insert_own on public.notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists notification_prefs_update_own on public.notification_prefs;
create policy notification_prefs_update_own on public.notification_prefs
  for update using (auth.uid() = user_id);

grant select, insert, update on public.notification_prefs to authenticated;
