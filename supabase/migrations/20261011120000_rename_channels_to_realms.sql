-- ============================================================
-- PHASE 1: Rename Channels -> Realms
-- Pure structural rename. No rows are inserted, updated, or deleted.
-- ============================================================

-- ---------- 1. Enums ----------
-- Postgres cannot rename a type used by columns directly, so we lean on the
-- fact that column types follow the type through ALTER TYPE ... RENAME.
ALTER TYPE public.channel_type RENAME TO realm_type;
ALTER TYPE public.channel_member_role RENAME TO realm_role;

-- ---------- 2. Tables + their columns ----------
ALTER TABLE public.channels RENAME TO realms;
ALTER TABLE public.channel_members RENAME TO realm_members;

ALTER TABLE public.realms RENAME COLUMN type TO kind; -- old "type" is generic; use kind
ALTER TABLE public.realm_members RENAME COLUMN channel_id TO realm_id;
ALTER TABLE public.messages RENAME COLUMN channel_id TO realm_id;
ALTER TABLE public.messages RENAME COLUMN author_id TO sender_id; -- alignment with dm naming

-- voice_rooms.channel_id -> realm_id (nullable, no FK kept before)
ALTER TABLE public.voice_rooms RENAME COLUMN channel_id TO realm_id;

-- ---------- 3. Indexes ----------
DROP INDEX IF EXISTS public.idx_messages_channel;
CREATE INDEX idx_messages_realm ON public.messages(realm_id, created_at DESC);

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Realm members primary-key/index is rebuilt cleanly after rename.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'realm_members_pkey'
  ) THEN NULL;-- fine; PK follows the table rename automatically
  END IF;
END;
$$;

-- ---------- 4. Functions ----------

-- The old bump/add-owner trigger bodies reference "channels"; recreate.
CREATE OR REPLACE FUNCTION public.bump_realm_members() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE public.realms SET member_count = member_count + 1 WHERE id = NEW.realm_id;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.realms SET member_count = GREATEST(member_count-1,0) WHERE id = OLD.realm_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_owner_as_member() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.realm_members (realm_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

-- ---------- 5. Triggers ----------
DROP TRIGGER IF EXISTS touch_channels ON public.realms;
CREATE TRIGGER touch_realms BEFORE UPDATE ON public.realms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS bump_channel_members_t ON public.realm_members;
CREATE TRIGGER bump_realm_members_t AFTER INSERT OR DELETE ON public.realm_members
  FOR EACH ROW EXECUTE FUNCTION public.bump_realm_members();

DROP TRIGGER IF EXISTS add_owner_t ON public.realms;
CREATE TRIGGER add_owner_t AFTER INSERT ON public.realms
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- ---------- 6. RLS policies ----------
ALTER TABLE public.realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ---------- 7. Realtime (re-add the renamed tables) ----------
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'realms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realms;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'realm_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_members;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$pub$;

-- ---------- 8. Old function/trigger names dropped ----------
DROP FUNCTION IF EXISTS public.bump_channel_members();
DROP TRIGGER IF EXISTS trg_channel_founder ON public.realms;
DROP FUNCTION IF EXISTS public.on_channel_created();
