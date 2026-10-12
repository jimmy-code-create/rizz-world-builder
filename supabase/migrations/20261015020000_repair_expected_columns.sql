-- ============================================================================
-- Repair: columns/tables the running app uses but the committed migration
-- history never created.
--
-- These exist in the live project (they were applied through the Supabase
-- dashboard while BACKEND_REQUIREMENTS.md was being worked through), which is
-- why the app works and a from-scratch replay did not. Adding them here makes
-- the history match production and lets a fresh project replay end to end.
--
-- Safe to re-run: every statement is conditional.
-- ============================================================================

-- Unsending a DM or a group message writes these, and the chat hides a row (or
-- shows the "unsent" placeholder) based on them.
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_deleted
  ON public.direct_messages (sender_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_group_messages_deleted
  ON public.group_messages (group_id, deleted_at);

-- The notifications screen renders these; notify_mentions() already writes them.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
