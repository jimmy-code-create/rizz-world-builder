-- A valid group invite is sufficient authorization to join: the invitee does
-- not need a mutual follow with an existing member. Block checks stay in force
-- so a blocked connection can never come in through an invite, and invite
-- previews become readable without a session so the join page and the chat
-- invite card can render for a signed-out visitor.

-- 1. Preview RPC for the join page and the DM invite card.
CREATE OR REPLACE FUNCTION public.get_group_invite_preview(_code text)
RETURNS TABLE (
  status text,
  group_id uuid,
  group_name text,
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
  v_code text;
  v_invite public.group_invites%ROWTYPE;
  v_group public.groups%ROWTYPE;
BEGIN
  -- Callers may pass a bare code or a pasted link; normalize both.
  v_code := lower(btrim(coalesce(_code, '')));
  IF position('/' in v_code) > 0 THEN
    v_code := regexp_replace(v_code, '^.*/', '');
  END IF;
  v_code := regexp_replace(v_code, '[^a-z0-9]', '', 'g');

  SELECT * INTO v_invite FROM public.group_invites WHERE code = v_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'revoked_or_invalid'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_invite.group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'revoked_or_invalid'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, v_group.id, v_group.name, v_group.topic, v_group.icon_url, v_group.accent_color, v_group.member_count;
  ELSIF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT 'limit_reached'::text, v_group.id, v_group.name, v_group.topic, v_group.icon_url, v_group.accent_color, v_group.member_count;
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members AS gm
    WHERE gm.group_id = v_group.id AND gm.user_id = auth.uid()
  ) THEN
    RETURN QUERY SELECT 'already_member'::text, v_group.id, v_group.name, v_group.topic, v_group.icon_url, v_group.accent_color, v_group.member_count;
  ELSE
    RETURN QUERY SELECT 'valid'::text, v_group.id, v_group.name, v_group.topic, v_group.icon_url, v_group.accent_color, v_group.member_count;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_invite_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_invite_preview(text) TO anon, authenticated;

-- Documented alias from BACKEND_REQUIREMENTS.md; same contract, same row.
CREATE OR REPLACE FUNCTION public.preview_group_invite(_code text)
RETURNS TABLE (
  status text,
  group_id uuid,
  group_name text,
  topic text,
  icon_url text,
  accent_color text,
  member_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.get_group_invite_preview(_code);
$$;

REVOKE ALL ON FUNCTION public.preview_group_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_group_invite(text) TO anon, authenticated;

-- 2. Friends-only stays for people who join without an invite; a valid invite
--    carries its own authorization, flagged by a transaction-local setting so
--    the trigger can tell the two apart.
CREATE OR REPLACE FUNCTION public.enforce_group_friends() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_owner uuid;
  v_has_mutual boolean;
BEGIN
  SELECT owner_id INTO v_owner FROM public.groups WHERE id = NEW.group_id;

  -- Block checks are retained on every join path, invite or not: a blocked
  -- connection can never become a group member in either direction.
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id AND public.is_blocked_pair(v_owner, NEW.user_id) THEN
    RAISE EXCEPTION 'blocked: you cannot join this group';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.group_members AS gm
    WHERE gm.group_id = NEW.group_id AND public.is_blocked_pair(gm.user_id, NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'blocked: you cannot join this group';
  END IF;

  IF v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF current_setting('rizz.internal.group_invite_join', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.follows f1 ON f1.follower_id = NEW.user_id AND f1.following_id = gm.user_id
    JOIN public.follows f2 ON f2.follower_id = gm.user_id AND f2.following_id = NEW.user_id
    WHERE gm.group_id = NEW.group_id
  ) INTO v_has_mutual;

  IF NOT v_has_mutual THEN
    RAISE EXCEPTION 'friends_only: you must mutually follow at least one member to join';
  END IF;
  RETURN NEW;
END $$;

-- 3. Accepting an invite marks the membership insert so the trigger above
--    skips only the mutual-follow requirement; expiry, use limits, duplicates
--    and blocks all still apply.
CREATE OR REPLACE FUNCTION public.accept_group_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_invite public.group_invites%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_joined_user uuid;
  v_code text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to join this group';
  END IF;

  -- Same normalization as the preview so a pasted link always resolves.
  v_code := lower(btrim(coalesce(_code, '')));
  IF position('/' in v_code) > 0 THEN
    v_code := regexp_replace(v_code, '^.*/', '');
  END IF;
  v_code := regexp_replace(v_code, '[^a-z0-9]', '', 'g');

  SELECT *
  INTO v_invite
  FROM public.group_invites
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  SELECT *
  INTO v_group
  FROM public.groups
  WHERE id = v_invite.group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This group no longer exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = v_invite.group_id AND user_id = v_actor
  ) THEN
    RETURN to_jsonb(v_group);
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Invite has reached its limit';
  END IF;

  -- Transaction-local: the flag disappears with the transaction, and the
  -- block checks inside the trigger still run for this insert.
  PERFORM set_config('rizz.internal.group_invite_join', 'on', true);
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_invite.group_id, v_actor)
  ON CONFLICT (group_id, user_id) DO NOTHING
  RETURNING user_id INTO v_joined_user;
  PERFORM set_config('rizz.internal.group_invite_join', 'off', true);

  IF v_joined_user IS NOT NULL THEN
    UPDATE public.group_invites
    SET uses = uses + 1
    WHERE id = v_invite.id;
  END IF;

  RETURN to_jsonb(v_group);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;
