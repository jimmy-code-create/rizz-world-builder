-- Invitees are not group members yet, so the member-only SELECT policy on
-- group_invites prevents the client from looking up a valid invite. Keep invite
-- rows private and perform validation/joining through this narrowly scoped RPC.
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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to join this group';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.group_invites
  WHERE code = lower(btrim(_code))
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
    SELECT 1
    FROM public.group_members
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

  -- The existing friends-only trigger remains in force for new members.
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_invite.group_id, v_actor)
  ON CONFLICT (group_id, user_id) DO NOTHING
  RETURNING user_id INTO v_joined_user;

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