-- ============================================================
-- Group-invite probe.
-- A valid group invite is sufficient authorization to join, invite
-- previews work without a session, and blocked connections stay refused.
-- ============================================================
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111','owner@invite.test','{"username":"invowner","display_name":"Owner"}'),
  ('22222222-2222-2222-2222-222222222222','invitee@invite.test','{"username":"invitee","display_name":"Invitee"}'),
  ('33333333-3333-3333-3333-333333333333','stranger@invite.test','{"username":"stranger","display_name":"Stranger"}'),
  ('44444444-4444-4444-4444-444444444444','blockedp@invite.test','{"username":"blockedp","display_name":"Blocked"}'),
  ('55555555-5555-5555-5555-555555555555','expiredp@invite.test','{"username":"expiredp","display_name":"Expired"}')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.expect(l text, ok boolean, d text DEFAULT '') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '% % %', CASE WHEN coalesce(ok, false) THEN 'PASS' ELSE 'FAIL' END, l, coalesce(d, '');
END $$;

DO $probe$
DECLARE
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '44444444-4444-4444-4444-444444444444';
  e uuid := '55555555-5555-5555-5555-555555555555';
  grp uuid;
  good_code text := 'probeinvite01';
  blocked_code text := 'probeinvite02';
  dead_code text := 'probeexpired1';
  v_uses integer;
  v_status text;
  gid uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  -- Re-running the probe starts from a clean slate.
  DELETE FROM public.blocks WHERE blocker_id = a AND blocked_id = d;
  DELETE FROM public.groups WHERE slug = 'probe-invite-group';
  INSERT INTO public.groups (owner_id, slug, name)
  VALUES (a, 'probe-invite-group', 'Probe Invite Group')
  RETURNING id INTO grp;
  INSERT INTO public.group_invites (group_id, code, created_by, expires_at)
  VALUES (grp, good_code, a, now() + interval '7 days'),
         (grp, blocked_code, a, now() + interval '7 days'),
         (grp, dead_code, a, now() - interval '1 day');

  -- Previews must work without a session (the signed-out invite page).
  PERFORM set_config('request.jwt.claim.sub', '', false);

  -- --------------------------------------- previews (signed-out visitor)
  IF to_regprocedure('public.get_group_invite_preview(text)') IS NULL THEN
    PERFORM pg_temp.expect('preview rpc exists for signed-out visitors', false, 'function missing');
  ELSE
    PERFORM pg_temp.expect('preview rpc exists for signed-out visitors',
      has_function_privilege('anon', 'public.get_group_invite_preview(text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.get_group_invite_preview(text)', 'EXECUTE'),
      'grants');
  END IF;

  BEGIN
    SELECT s.status, s.group_id INTO v_status, gid
    FROM public.get_group_invite_preview(good_code) AS s LIMIT 1;
    PERFORM pg_temp.expect('valid invite previews as valid', v_status = 'valid' AND gid = grp, coalesce(v_status, '<none>'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('valid invite previews as valid', false, SQLERRM);
  END;

  BEGIN
    SELECT s.status INTO v_status FROM public.get_group_invite_preview(dead_code) AS s LIMIT 1;
    PERFORM pg_temp.expect('expired invite previews as expired', v_status = 'expired', coalesce(v_status, '<none>'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('expired invite previews as expired', false, SQLERRM);
  END;

  BEGIN
    SELECT s.status INTO v_status FROM public.get_group_invite_preview('nosuchcode99') AS s LIMIT 1;
    PERFORM pg_temp.expect('unknown invite previews as revoked_or_invalid', v_status = 'revoked_or_invalid', coalesce(v_status, '<none>'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('unknown invite previews as revoked_or_invalid', false, SQLERRM);
  END;

  -- --------------------------------------- a valid invite is enough
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  BEGIN
    PERFORM public.accept_group_invite(good_code);
    PERFORM pg_temp.expect('valid invite lets a non-friend join',
      EXISTS (SELECT 1 FROM public.group_members WHERE group_id = grp AND user_id = b));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('valid invite lets a non-friend join', false, SQLERRM);
  END;

  SELECT i.uses INTO v_uses FROM public.group_invites AS i WHERE i.code = good_code;
  PERFORM pg_temp.expect('invite use is counted', v_uses = 1, coalesce(v_uses::text, '<none>'));

  BEGIN
    SELECT s.status INTO v_status FROM public.get_group_invite_preview(good_code) AS s LIMIT 1;
    PERFORM pg_temp.expect('joined member previews as already_member', v_status = 'already_member', coalesce(v_status, '<none>'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('joined member previews as already_member', false, SQLERRM);
  END;

  -- --------------------------------------- invite-free joins stay friends-only
  PERFORM set_config('request.jwt.claim.sub', c::text, false);
  BEGIN
    INSERT INTO public.group_members (group_id, user_id) VALUES (grp, c);
    PERFORM pg_temp.expect('direct join still needs a mutual follow', false, 'insert succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('direct join still needs a mutual follow', SQLERRM LIKE '%friends_only%', SQLERRM);
  END;

  -- --------------------------------------- blocked connections stay refused
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (a, d);

  PERFORM set_config('request.jwt.claim.sub', d::text, false);
  BEGIN
    PERFORM public.accept_group_invite(blocked_code);
    PERFORM pg_temp.expect('blocked user cannot join with an invite', false, 'join succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('blocked user cannot join with an invite', SQLERRM LIKE '%blocked%', SQLERRM);
  END;

  -- --------------------------------------- expiry is still enforced
  PERFORM set_config('request.jwt.claim.sub', e::text, false);
  BEGIN
    PERFORM public.accept_group_invite(dead_code);
    PERFORM pg_temp.expect('expired invite is refused', false, 'join succeeded');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.expect('expired invite is refused', SQLERRM ILIKE '%expired%', SQLERRM);
  END;
END;
$probe$;
