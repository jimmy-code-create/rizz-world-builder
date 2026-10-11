-- ============================================================
-- PHASE 1b: Rename legacy FK constraints after channels -> realms
-- Renaming a table does NOT rename its FK constraints. PostgREST
-- resolves embedded selects by constraint name, so the client's
-- `realms!realm_members_realm_id_fkey` / `profiles!realms_owner_id_fkey`
-- hints fail until the old channel_* constraint names are updated.
-- Idempotent: each rename runs only if the legacy name still exists.
-- ============================================================

DO $$
BEGIN
  -- realms: owner -> profiles
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'realms' AND c.conname = 'channels_owner_id_fkey'
  ) THEN
    ALTER TABLE public.realms
      RENAME CONSTRAINT channels_owner_id_fkey TO realms_owner_id_fkey;
  END IF;

  -- realm_members: realm -> realms
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'realm_members' AND c.conname = 'channel_members_channel_id_fkey'
  ) THEN
    ALTER TABLE public.realm_members
      RENAME CONSTRAINT channel_members_channel_id_fkey TO realm_members_realm_id_fkey;
  END IF;

  -- realm_members: user -> profiles
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'realm_members' AND c.conname = 'channel_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.realm_members
      RENAME CONSTRAINT channel_members_user_id_fkey TO realm_members_user_id_fkey;
  END IF;

  -- messages: realm -> realms (column already renamed to realm_id)
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'messages' AND c.conname = 'messages_channel_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      RENAME CONSTRAINT messages_channel_id_fkey TO messages_realm_id_fkey;
  END IF;
END;
$$;
