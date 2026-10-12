-- ============================================================================
-- PART 3: pinned messages in realm channels.
--
--  * pinned_messages stores one row per pin. Authenticated users may only read
--    pins for realms they belong to, and may only write through the RPCs, so the
--    owner/moderator rule and the 50-pin limit are enforced by the database.
--  * message_id references public.messages ON DELETE CASCADE, so deleting the
--    original message removes it from the pins automatically.
--  * messages.system marks the "@user pinned a message" line so the chat can
--    render it as a system line instead of a bubble.
--
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- An earlier group-scoped pins feature already owns this table name
-- (20260810023549), shaped as group_id / message_id -> group_messages. Left
-- alone, the CREATE TABLE IF NOT EXISTS below would silently keep that group
-- shape, every following statement would fail on the missing realm_id, and the
-- old pins_insert_members / pins_delete_members policies plus the
-- GRANT ... INSERT, DELETE TO authenticated would still let any member write
-- pins directly, bypassing the owner/mod rule and the 50-pin limit.
--
-- So move that table aside rather than dropping it: its rows are preserved, and
-- nothing in the app reads it. Its constraint-owned indexes keep the old table's
-- name, and index names are schema-wide, so they are renamed too — otherwise the
-- new primary key could not be created.
-- ----------------------------------------------------------------------------
DO $legacy_group_pins$
DECLARE
  v_constraint record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pinned_messages'
      AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.pinned_messages RENAME TO group_pinned_messages;

    FOR v_constraint IN
      SELECT con.conname
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
        AND rel.relname = 'group_pinned_messages'
        AND con.conname LIKE 'pinned\_messages%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.group_pinned_messages RENAME CONSTRAINT %I TO %I',
        v_constraint.conname,
        'group_' || v_constraint.conname
      );
    END LOOP;
  END IF;
END
$legacy_group_pins$;

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pinned_messages_one_per_message UNIQUE (message_id)
);

-- "Channel" means the room, or the realm's own channel when the message has no
-- room, which is why the fallback expression is indexed too.
CREATE INDEX IF NOT EXISTS idx_pinned_messages_channel
  ON public.pinned_messages (realm_id, coalesce(realm_room_id, realm_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_realm ON public.pinned_messages (realm_id, created_at DESC);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages REPLICA IDENTITY FULL;
REVOKE ALL ON public.pinned_messages FROM anon;
GRANT SELECT ON public.pinned_messages TO authenticated;

-- Everyone who can read the realm sees its pins — including locked channels.
DROP POLICY IF EXISTS pinned_messages_read ON public.pinned_messages;
CREATE POLICY pinned_messages_read ON public.pinned_messages
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

-- ------------------------------------------------------- system line support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS system boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------------- pinning
CREATE OR REPLACE FUNCTION public.pin_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_realm uuid;
  v_room uuid;
  v_room_key uuid;
  v_count integer;
  v_author text;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to pin a message';
  END IF;

  SELECT m.realm_id, m.realm_room_id INTO v_realm, v_room
  FROM public.messages AS m
  WHERE m.id = _message_id;

  IF v_realm IS NULL THEN
    RAISE EXCEPTION 'That message is no longer available';
  END IF;

  -- Owners and moderators only, and only inside their own realm.
  IF NOT public.is_realm_moderator(v_realm, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can pin messages';
  END IF;

  v_room_key := coalesce(v_room, v_realm);

  SELECT EXISTS (SELECT 1 FROM public.pinned_messages p WHERE p.message_id = _message_id)
  INTO v_already;
  IF v_already THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pinned_messages AS p
  WHERE p.realm_id = v_realm
    AND coalesce(p.realm_room_id, p.realm_id) = v_room_key;

  IF v_count >= 50 THEN
    RAISE EXCEPTION 'This channel already has 50 pinned messages. Unpin one first.';
  END IF;

  INSERT INTO public.pinned_messages (realm_id, realm_room_id, message_id, pinned_by)
  VALUES (v_realm, v_room, _message_id, auth.uid());

  -- System line: "@user pinned a message".
  SELECT coalesce(nullif(pr.display_name, ''), pr.username, 'A moderator') INTO v_author
  FROM public.profiles AS pr
  WHERE pr.id = auth.uid();

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body, system)
  VALUES (
    v_realm,
    v_room,
    auth.uid(),
    '@' || coalesce(v_author, 'A moderator') || ' pinned a message',
    true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpin_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_realm uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to unpin a message';
  END IF;

  SELECT p.realm_id INTO v_realm
  FROM public.pinned_messages AS p
  WHERE p.message_id = _message_id;

  IF v_realm IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_realm_moderator(v_realm, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can unpin messages';
  END IF;

  DELETE FROM public.pinned_messages WHERE message_id = _message_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.pin_message(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpin_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pin_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpin_message(uuid) TO authenticated;

-- Realtime so pins and unpins land for everyone without a refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pinned_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
