-- ============================================================================
-- PART 4: per-member, per-channel write permission.
--
--  * realm_channel_permissions stores one row per *denied* member and channel.
--    Allowed is the default, so allowing somebody deletes the row instead of
--    storing true — "no override" stays the normal state and the table stays
--    small.
--  * A channel means the room, or the realm's own channel when room_id is null,
--    matching how pins and messages are scoped.
--  * Reads go to realm members (moderators need the list); writes only through
--    set_channel_write_permission(), so the owner/moderator rule is enforced in
--    the database.
--  * channel_write_allowed() is the single source of truth for the rule and is
--    also used by a RESTRICTIVE insert policy on messages, so a blocked member
--    cannot write even by calling the API directly.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.realm_channel_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_write boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per member per channel. A unique *index* (not constraint) because the
-- channel key coalesces the null room with the realm id.
CREATE UNIQUE INDEX IF NOT EXISTS realm_channel_permissions_unique
  ON public.realm_channel_permissions (realm_id, coalesce(realm_room_id, realm_id), user_id);
CREATE INDEX IF NOT EXISTS idx_realm_channel_permissions_realm
  ON public.realm_channel_permissions (realm_id);

ALTER TABLE public.realm_channel_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_channel_permissions REPLICA IDENTITY FULL;
REVOKE ALL ON public.realm_channel_permissions FROM anon;
GRANT SELECT ON public.realm_channel_permissions TO authenticated;
GRANT ALL ON public.realm_channel_permissions TO service_role;

-- Members can see the overrides for their own realm, so the moderation screen
-- and the "you can't write here" banner can both read them.
DROP POLICY IF EXISTS realm_channel_permissions_read ON public.realm_channel_permissions;
CREATE POLICY realm_channel_permissions_read ON public.realm_channel_permissions
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

-- ------------------------------------------------------------------ the rule
/**
 * Can this user write in this channel?
 *
 * Owners and moderators can always write. Everyone else is allowed unless a
 * moderator explicitly denied them that channel.
 */
CREATE OR REPLACE FUNCTION public.channel_write_allowed(
  _realm_id uuid,
  _room_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.is_realm_moderator(_realm_id, _user_id)
    OR coalesce(
      (
        SELECT p.can_write
        FROM public.realm_channel_permissions AS p
        WHERE p.realm_id = _realm_id
          AND coalesce(p.realm_room_id, p.realm_id) = coalesce(_room_id, _realm_id)
          AND p.user_id = _user_id
      ),
      true
    );
$function$;

-- ------------------------------------------------------------ the moderation
/**
 * Turns one member's write access to one channel on or off. Owners and
 * moderators only, and only for people who are actually in the realm.
 */
CREATE OR REPLACE FUNCTION public.set_channel_write_permission(
  _realm_id uuid,
  _room_id uuid,
  _user_id uuid,
  _can_write boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_room_key uuid := coalesce(_room_id, _realm_id);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change channel permissions';
  END IF;

  IF NOT public.is_realm_moderator(_realm_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can change channel permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.realm_members AS rm
    WHERE rm.realm_id = _realm_id AND rm.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'That person is not in this realm';
  END IF;

  -- Moderators write everywhere by definition, so there is nothing to store.
  IF public.is_realm_moderator(_realm_id, _user_id) THEN
    RAISE EXCEPTION 'Owners and moderators always have full access to every channel';
  END IF;

  IF _room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_rooms AS r
    WHERE r.id = _room_id AND r.realm_id = _realm_id
  ) THEN
    RAISE EXCEPTION 'That channel is not part of this realm';
  END IF;

  IF coalesce(_can_write, false) THEN
    -- Allowed is the default: drop the deny instead of storing true.
    DELETE FROM public.realm_channel_permissions
    WHERE realm_id = _realm_id
      AND coalesce(realm_room_id, realm_id) = v_room_key
      AND user_id = _user_id;
    RETURN;
  END IF;

  UPDATE public.realm_channel_permissions
  SET can_write = false,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE realm_id = _realm_id
    AND coalesce(realm_room_id, realm_id) = v_room_key
    AND user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.realm_channel_permissions
      (realm_id, realm_room_id, user_id, can_write, updated_by)
    VALUES
      (_realm_id, _room_id, _user_id, false, auth.uid());
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.channel_write_allowed(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_channel_write_permission(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.channel_write_allowed(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_channel_write_permission(uuid, uuid, uuid, boolean) TO authenticated;

-- ------------------------------------------------------- enforce it on writes
-- RESTRICTIVE, so it ANDs with the existing insert policies: a blocked member
-- stays blocked even though the old policy would still allow the row.
DROP POLICY IF EXISTS messages_channel_write_guard ON public.messages;
CREATE POLICY messages_channel_write_guard ON public.messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.channel_write_allowed(realm_id, realm_room_id, auth.uid()));

-- Realtime so a permission change lands for everyone without a refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'realm_channel_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_channel_permissions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
