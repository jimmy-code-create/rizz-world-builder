DROP TRIGGER IF EXISTS trg_enforce_group_friends ON public.group_members;

CREATE OR REPLACE FUNCTION public.accept_group_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text := lower(btrim(_code));
  v_invite public.group_invites%ROWTYPE;
  v_group_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'invalid: sign in to join this group';
  END IF;

  v_code := regexp_replace(v_code, '^.*\/join\/', '');
  v_code := split_part(split_part(v_code, '?', 1), '#', 1);

  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE lower(code) = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid: invite not found';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoked: invite revoked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_invite.group_id
      AND gm.user_id = v_actor
  ) THEN
    RETURN v_invite.group_id;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'expired: invite expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'expired: invite has reached its use limit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_invite.group_id
      AND public.is_blocked_pair(v_actor, gm.user_id)
  ) THEN
    RAISE EXCEPTION 'blocked: you cannot join this group';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_invite.group_id, v_actor, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING
  RETURNING group_id INTO v_group_id;

  IF v_group_id IS NULL THEN
    RETURN v_invite.group_id;
  END IF;

  UPDATE public.group_invites
  SET uses = uses + 1
  WHERE id = v_invite.id;

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;
COMMENT ON FUNCTION public.enforce_group_friends() IS 'DEPRECATED: group invite joins no longer require mutual follows; trg_enforce_group_friends was removed in migration allow_group_invite_join_without_mutual_follow.';