-- ============================================================================
-- Mods-only channel locks for realm channels (text, announcement and voice).
--
-- Enforcement lives in the database, not the UI:
--   * realm_rooms.mods_only holds the switch.
--   * messages and voice_participants get RESTRICTIVE insert policies, so the
--     realtime socket (which is the same authenticated insert) is covered by the
--     same rule as any other write.
--   * set_realm_room_lock() checks the caller's role and empties a locked voice
--     channel of everyone who is not a moderator.
--   * /api/turn-credentials also refuses to hand out TURN credentials for a
--     locked channel to non-mods (see src/routes/api.turn-credentials.ts).
--
-- "Mods" means the realm owner, admins (role 'mod') and the owner_id on the
-- realm row, using the roles the app already has.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE public.realm_rooms
  ADD COLUMN IF NOT EXISTS mods_only boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.is_realm_moderator(_realm uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.realm_members rm
    WHERE rm.realm_id = _realm
      AND rm.user_id = _user
      AND rm.role IN ('owner', 'mod')
  )
  OR EXISTS (
    SELECT 1 FROM public.realms r
    WHERE r.id = _realm AND r.owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_realm_room_locked(_room uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT rr.mods_only FROM public.realm_rooms rr WHERE rr.id = _room), false);
$$;

REVOKE ALL ON FUNCTION public.is_realm_moderator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_realm_room_locked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_realm_moderator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_realm_room_locked(uuid) TO authenticated;

-- ------------------------------------------------------------ the switch
CREATE OR REPLACE FUNCTION public.set_realm_room_lock(_room_id uuid, _locked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_realm uuid;
  v_kind text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change channel settings';
  END IF;

  SELECT rr.realm_id, rr.kind INTO v_realm, v_kind
  FROM public.realm_rooms rr WHERE rr.id = _room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.is_realm_moderator(v_realm, auth.uid()) THEN
    RAISE EXCEPTION 'Only the realm owner and admins can lock channels';
  END IF;

  UPDATE public.realm_rooms
  SET mods_only = coalesce(_locked, false)
  WHERE id = _room_id;

  -- Locking a voice channel removes everyone who is not a moderator.
  IF coalesce(_locked, false) AND v_kind = 'voice' THEN
    DELETE FROM public.voice_participants vp
    USING public.voice_rooms vr
    WHERE vp.room_id = vr.id
      AND vr.realm_room_id = _room_id
      AND NOT public.is_realm_moderator(v_realm, vp.user_id);
  END IF;

  RETURN coalesce(_locked, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_realm_room_lock(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_realm_room_lock(uuid, boolean) TO authenticated;

-- Used by /api/turn-credentials (the voice token endpoint): given a
-- voice_rooms.id, is this call for a locked realm channel the caller may not
-- join? Returns false for every normal, unlocked call.
CREATE OR REPLACE FUNCTION public.is_locked_voice_room_for(_room uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.voice_rooms vr
    JOIN public.realm_rooms rr ON rr.id = vr.realm_room_id
    WHERE vr.id = _room
      AND rr.mods_only
      AND NOT public.is_realm_moderator(rr.realm_id, _user)
  );
$$;

REVOKE ALL ON FUNCTION public.is_locked_voice_room_for(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_locked_voice_room_for(uuid, uuid) TO authenticated;

-- ------------------------------------------------------- server enforcement
-- Restrictive policies AND with the existing permissive ones (the permissive
-- policies still decide *who* may write; these decide whether the channel is
-- open to them at all).
DROP POLICY IF EXISTS messages_insert_mods_only ON public.messages;
CREATE POLICY messages_insert_mods_only ON public.messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    realm_room_id IS NULL
    OR NOT public.is_realm_room_locked(realm_room_id)
    OR public.is_realm_moderator(realm_id, auth.uid())
  );

DROP POLICY IF EXISTS voice_participants_insert_mods_only ON public.voice_participants;
CREATE POLICY voice_participants_insert_mods_only ON public.voice_participants
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.voice_rooms vr
      WHERE vr.id = room_id AND vr.realm_room_id IS NOT NULL
        AND public.is_realm_room_locked(vr.realm_room_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.voice_rooms vr
      WHERE vr.id = room_id
        AND vr.realm_id IS NOT NULL
        AND public.is_realm_moderator(vr.realm_id, auth.uid())
    )
  );

-- Creating the voice_rooms row for a locked channel is also mods-only.
DROP POLICY IF EXISTS voice_rooms_insert_mods_only ON public.voice_rooms;
CREATE POLICY voice_rooms_insert_mods_only ON public.voice_rooms
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    realm_room_id IS NULL
    OR NOT public.is_realm_room_locked(realm_room_id)
    OR (realm_id IS NOT NULL AND public.is_realm_moderator(realm_id, auth.uid()))
  );

-- Realtime so the lock reaches everyone without a refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'realm_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_rooms;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
