-- ============================================================
-- FIX: "infinite recursion detected in policy for relation 'realms'"
--
-- Cause: the realm_members read policy queries public.realms
-- (owner/is_public), while old channel-era policies on realms (kept
-- through the table rename) query realm_members. Postgres detects the
-- RLS policy cycle and raises 'infinite recursion'.
--
-- Fix: drop ALL policies on realms / realm_members / messages /
-- realm_rooms, then rebuild them on top of SECURITY DEFINER helpers.
-- The helpers bypass RLS, so no policy reads another RLS table directly.
-- Idempotent: safe to run any time.
-- ============================================================

-- ---------- 1. Policy teardown (dynamic: covers old + new names) ----------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('realms', 'realm_members', 'messages', 'realm_rooms',
                        'channels', 'channel_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

-- ---------- 2. SECURITY DEFINER helpers (no RLS inside) ----------
CREATE OR REPLACE FUNCTION public.is_realm_member(_realm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.realm_members
    WHERE realm_id = _realm_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.realms
    WHERE id = _realm_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_realm(_realm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.realms
    WHERE id = _realm_id
      AND (is_public = true OR public.is_realm_member(_realm_id))
  );
$$;

REVOKE ALL ON FUNCTION public.is_realm_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_realm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_realm_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_realm(uuid) TO authenticated;

-- ---------- 3. Rebuild policies through the helpers ----------
-- realms: readable when public or member; writable via SECURITY DEFINER
-- RPCs only, so no direct INSERT/UPDATE/DELETE policies (default deny).
DROP POLICY IF EXISTS "realms readable" ON public.realms;
CREATE POLICY "realms readable" ON public.realms
  FOR SELECT TO authenticated
  USING (public.can_read_realm(id));

DROP POLICY IF EXISTS "realm_members readable" ON public.realm_members;
CREATE POLICY "realm_members readable" ON public.realm_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_realm_member(realm_id)
  );

DROP POLICY IF EXISTS "messages readable" ON public.messages;
CREATE POLICY "messages readable" ON public.messages
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

-- Member can send their own messages; may also edit/delete their own.
DROP POLICY IF EXISTS "messages insert own" ON public.messages;
CREATE POLICY "messages insert own" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_realm_member(realm_id)
  );

DROP POLICY IF EXISTS "messages update own" ON public.messages;
CREATE POLICY "messages update own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages delete own or mods" ON public.messages;
CREATE POLICY "messages delete own or mods" ON public.messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.realm_members rm
      WHERE rm.realm_id = messages.realm_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('owner', 'mod')
    )
  );

DROP POLICY IF EXISTS "realm_rooms readable" ON public.realm_rooms;
CREATE POLICY "realm_rooms readable" ON public.realm_rooms
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

DROP POLICY IF EXISTS "realm_rooms writable by mods" ON public.realm_rooms;
CREATE POLICY "realm_rooms writable by mods" ON public.realm_rooms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.realm_members rm
      WHERE rm.realm_id = realm_rooms.realm_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('owner', 'mod')
    )
    OR EXISTS (
      SELECT 1 FROM public.realms r
      WHERE r.id = realm_rooms.realm_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.realm_members rm
      WHERE rm.realm_id = realm_rooms.realm_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('owner', 'mod')
    )
    OR EXISTS (
      SELECT 1 FROM public.realms r
      WHERE r.id = realm_rooms.realm_id AND r.owner_id = auth.uid()
    )
  );

-- ---------- 4. Verify ----------
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname='public' AND tablename LIKE 'realm%'
-- ORDER BY tablename, policyname;
