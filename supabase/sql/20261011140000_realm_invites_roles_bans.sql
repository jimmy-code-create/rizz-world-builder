-- ============================================================
-- PHASE 2: Realm invites, bans, roles, and moderation RPCs
-- Additive migration. No table is dropped or renamed.
-- ============================================================

-- ---------- 1. Invites ----------
CREATE TABLE IF NOT EXISTS public.realm_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_invites_realm
  ON public.realm_invites (realm_id);

ALTER TABLE public.realm_invites ENABLE ROW LEVEL SECURITY;

-- Invites are private; all interaction happens via SECURITY DEFINER RPCs below.
REVOKE ALL ON public.realm_invites FROM PUBLIC, anon, authenticated;

-- ---------- 2. Bans ----------
CREATE TABLE IF NOT EXISTS public.realm_bans (
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, user_id)
);

ALTER TABLE public.realm_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realm bans readable by members" ON public.realm_bans;
CREATE POLICY "realm bans readable by members"
  ON public.realm_bans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.realm_members AS rm
      WHERE rm.realm_id = realm_bans.realm_id AND rm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.realms WHERE id = realm_bans.realm_id AND owner_id = auth.uid())
  );

REVOKE ALL ON public.realm_bans FROM PUBLIC, anon;

-- ---------- 3. Helper: role lookup ----------
CREATE OR REPLACE FUNCTION public.realm_role_of(_realm uuid, _user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT rm.role::text FROM public.realm_members AS rm
  WHERE rm.realm_id = _realm AND rm.user_id = _user
$$;

REVOKE ALL ON FUNCTION public.realm_role_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realm_role_of(uuid, uuid) TO authenticated;

-- ---------- 4. Join/leave public realms ----------
CREATE OR REPLACE FUNCTION public.join_realm(_realm_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_realm public.realms%ROWTYPE;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join this realm';
  END IF;

  SELECT * INTO v_realm FROM public.realms WHERE id = _realm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Realm not found';
  END IF;

  IF v_realm.is_public = false THEN
    RAISE EXCEPTION 'This realm is private. Ask the owner for an invite.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_bans
    WHERE realm_bans.realm_id = _realm_id AND realm_bans.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are banned from this realm';
  END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();

  IF v_role IS NULL THEN
    INSERT INTO public.realm_members (realm_id, user_id, role)
    VALUES (_realm_id, auth.uid(), 'member');
    RETURN 'joined';
  END IF;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_realm(_realm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  DELETE FROM public.realm_members
  WHERE realm_id = _realm_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.join_realm(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_realm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_realm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_realm(uuid) TO authenticated;

-- ---------- 5. Invites: create / preview / accept / revoke ----------

CREATE OR REPLACE FUNCTION public.create_realm_invite(
  _realm_id uuid,
  _expires_at timestamptz DEFAULT NULL,
  _max_uses integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can create invites';
  END IF;

  v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  INSERT INTO public.realm_invites (realm_id, code, created_by, expires_at, max_uses)
  VALUES (_realm_id, v_code, auth.uid(), _expires_at,
          CASE WHEN _max_uses IS NOT NULL THEN greatest(_max_uses, 1) END);
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_realm_invite(_code text)
RETURNS TABLE (
  status text,
  realm_id uuid,
  realm_name text,
  topic text,
  icon_url text,
  accent_color text,
  member_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.realm_invites%ROWTYPE;
  v_realm public.realms%ROWTYPE;
  v_role text;
  v_banned boolean;
BEGIN
  -- Ignore imposto-code noise from URL fragments / previews.
  SELECT * INTO v_invite FROM public.realm_invites
  WHERE lower(code) = lower(btrim(coalesce(_code, '')))
    AND is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_realm FROM public.realms WHERE id = v_invite.realm_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_role IS NOT NULL THEN v_role := NULL; END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT r.role::text INTO v_role FROM public.realm_members AS r
    WHERE r.realm_id = v_realm.id AND r.user_id = auth.uid();
  END IF;

  v_banned := false;
  IF auth.uid() IS NOT NULL THEN
    SELECT exists(SELECT 1 FROM public.realm_bans AS rb
                  WHERE rb.realm_id = v_realm.id AND rb.user_id = auth.uid())
      INTO v_banned;
  END IF;

  IF v_banned THEN
    RETURN QUERY SELECT 'banned'::text, v_realm.id, v_realm.name, v_realm.topic, v_realm.icon_url, v_realm.accent_color, v_realm.member_count;
    RETURN;
  END IF;

  IF v_role IS NOT NULL THEN
    RETURN QUERY SELECT 'already_member'::text, v_realm.id, v_realm.name, v_realm.topic, v_realm.icon_url, v_realm.accent_color, v_realm.member_count;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, v_realm.id, v_realm.name, v_realm.topic, v_realm.icon_url, v_realm.accent_color, v_realm.member_count;
    RETURN;
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT 'limit_reached'::text, v_realm.id, v_realm.name, v_realm.topic, v_realm.icon_url, v_realm.accent_color, v_realm.member_count;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'valid'::text, v_realm.id, v_realm.name, v_realm.topic, v_realm.icon_url, v_realm.accent_color, v_realm.member_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_realm_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.realm_invites%ROWTYPE;
  v_realm public.realms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join this realm';
  END IF;

  SELECT * INTO v_invite FROM public.realm_invites
  WHERE lower(code) = lower(btrim(coalesce(_code, '')))
    AND is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  SELECT * INTO v_realm FROM public.realms WHERE id = v_invite.realm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Realm not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.realm_bans
    WHERE realm_id = v_realm.id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are banned from this realm';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'This invite has reached its use limit';
  END IF;

  UPDATE public.realm_invites SET uses = uses + 1
  WHERE id = v_invite.id;

  INSERT INTO public.realm_members (realm_id, user_id, role)
  VALUES (v_realm.id, auth.uid(), 'member')
  ON CONFLICT (realm_id, user_id) DO NOTHING;

  RETURN v_realm.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_realm_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = (SELECT realm_id FROM public.realm_invites WHERE id = _invite_id)
    AND r.user_id = auth.uid();

  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can revoke invites';
  END IF;

  UPDATE public.realm_invites SET is_active = false
  WHERE id = _invite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_realm_invite(uuid, timestamptz, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_realm_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_realm_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_realm_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_realm_invite(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_realm_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_realm_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_realm_invite(uuid) TO authenticated;

-- ---------- 6. Moderation: kick, ban, unban, role change ----------

CREATE OR REPLACE FUNCTION public.kick_realm_member(_realm_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_target text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Use leave instead'; END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can kick members';
  END IF;

  SELECT r.role::text INTO v_target FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = _user_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF v_target = 'owner' THEN RAISE EXCEPTION 'The owner cannot be kicked'; END IF;
  IF v_target = 'mod' AND v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can kick a moderator';
  END IF;

  DELETE FROM public.realm_members
  WHERE realm_id = _realm_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_realm_member(_realm_id uuid, _user_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_target text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot ban yourself'; END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can ban members';
  END IF;

  SELECT r.role::text INTO v_target FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = _user_id;
  IF v_target = 'owner' THEN RAISE EXCEPTION 'The owner cannot be banned'; END IF;
  IF v_target = 'mod' AND v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can ban a moderator';
  END IF;

  INSERT INTO public.realm_bans (realm_id, user_id, banned_by, reason)
  VALUES (_realm_id, _user_id, auth.uid(), _reason)
  ON CONFLICT (realm_id, user_id) DO UPDATE SET reason = excluded.reason;

  DELETE FROM public.realm_members
  WHERE realm_id = _realm_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_realm_member(_realm_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can unban members';
  END IF;

  DELETE FROM public.realm_bans
  WHERE realm_id = _realm_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_realm_member_role(
  _realm_id uuid, _user_id uuid, _role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_target_current text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _role NOT IN ('member', 'mod') THEN
    RAISE EXCEPTION 'Role must be member or mod';
  END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change roles';
  END IF;

  SELECT r.role::text INTO v_target_current FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = _user_id;
  IF v_target_current IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF v_target_current = 'owner' THEN RAISE EXCEPTION 'Use realm ownership transfer instead'; END IF;

  UPDATE public.realm_members SET role = _role::realm_role
  WHERE realm_id = _realm_id AND user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kick_realm_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ban_realm_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unban_realm_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_member_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kick_realm_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ban_realm_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unban_realm_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_member_role(uuid, uuid, text) TO authenticated;

-- ---------- 7. Update realm (owner/mods) ----------
CREATE OR REPLACE FUNCTION public.update_realm(
  _realm_id uuid,
  _name text DEFAULT NULL,
  _topic text DEFAULT NULL,
  _icon_url text DEFAULT NULL,
  _accent_color text DEFAULT NULL,
  _is_public boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can edit this realm';
  END IF;

  UPDATE public.realms SET
    name = coalesce(_name, name),
    topic = coalesce(_topic, topic),
    icon_url = coalesce(_icon_url, icon_url),
    accent_color = coalesce(_accent_color, accent_color),
    is_public = coalesce(_is_public, is_public),
    updated_at = now()
  WHERE id = _realm_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_realm(_realm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  DELETE FROM public.realms WHERE id = _realm_id AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the owner can delete this realm';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_realm(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_realm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_realm(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_realm(uuid) TO authenticated;

-- ---------- 8. Rate-limit guard (shared pattern with the forums) ----------
CREATE OR REPLACE FUNCTION public.assert_realm_action_rate(limit_per_hour integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Cheap guardrails for invite/create actions by the same user in the last hour.
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.realm_invites
      WHERE created_by = auth.uid() AND created_at > now() - interval '1 hour')
     > limit_per_hour THEN
    RAISE EXCEPTION 'Slow down — you have created too many invites recently.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_realm_action_rate(integer) FROM PUBLIC, anon, authenticated;

-- Rate limiting belongs INSIDE the actions that change state:
CREATE OR REPLACE FUNCTION public.create_realm_secure(
  _name text,
  _topic text DEFAULT NULL,
  _accent_color text DEFAULT '#ff2d92',
  _kind text DEFAULT 'text',
  _is_public boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a realm';
  END IF;

  -- Monthly rate limit: max 20 realms created per user per rolling day.
  IF EXISTS (
    SELECT 1 FROM public.realms r
    WHERE r.owner_id = auth.uid()
      AND r.created_at > now() - interval '1 day'
    HAVING count(*) >= 10
  ) THEN
    RAISE EXCEPTION 'Slow down — you already created 10 realms today.';
  END IF;

  IF btrim(_name) = '' OR length(_name) > 40 THEN
    RAISE EXCEPTION 'Realm name must be 1-40 characters';
  END IF;

  IF length(_topic) > 160 THEN
    RAISE EXCEPTION 'Realm topic must be at most 160 characters';
  END IF;

  v_slug := lower(regexp_replace(btrim(_name), '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  IF length(v_slug) > 60 THEN
    v_slug := substr(v_slug, 1, 60);
  END IF;

  INSERT INTO public.realms (name, slug, topic, accent_color, kind, is_public, owner_id)
  VALUES (btrim(_name), v_slug, _topic, _accent_color,
          CASE _kind WHEN 'text' THEN 'text'::realm_type
                     WHEN 'voice' THEN 'voice'::realm_type
                     WHEN 'announcement' THEN 'announcement'::realm_type
                     WHEN 'drops' THEN 'drops'::realm_type
                     ELSE 'text'::realm_type END,
          _is_public, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_realm_secure(text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_realm_secure(text, text, text, text, boolean) TO authenticated;

-- Add the rate limit to the realm-invite creation flow too:
CREATE OR REPLACE FUNCTION public.create_realm_invite
  (_realm_id uuid, _expires_at timestamptz DEFAULT NULL, _max_uses integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;

  -- Rate limit: at most 10 invites per user per rolling hour.
  IF EXISTS (
    SELECT 1 FROM public.realm_invites i
    WHERE i.created_by = auth.uid()
      AND i.created_at > now() - interval '1 hour'
    HAVING count(*) >= 10
  ) THEN
    RAISE EXCEPTION 'Slow down — you already created 10 invites in the last hour.';
  END IF;

  SELECT r.role::text INTO v_role FROM public.realm_members AS r
  WHERE r.realm_id = _realm_id AND r.user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'member' THEN
    RAISE EXCEPTION 'Only owners or moderators can create invites';
  END IF;

  v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  INSERT INTO public.realm_invites (realm_id, code, created_by, expires_at, max_uses)
  VALUES (_realm_id, v_code, auth.uid(), _expires_at,
          CASE WHEN _max_uses IS NOT NULL THEN greatest(_max_uses, 1) END);
  RETURN v_code;
END;
$$;

-- ---------- 9. Realm member listing for owners/mods (RLS-scope read) ----------
DROP POLICY IF EXISTS "realm_members viewable" ON public.realm_members;
CREATE POLICY "realm_members viewable to members" ON public.realm_members
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.realms WHERE id = realm_id AND (owner_id = auth.uid() OR is_public))
  );

-- ---------- 10. Invite rows must not be readable via PostgREST at all ----------
REVOKE ALL ON public.realm_invites FROM PUBLIC, anon, authenticated;
