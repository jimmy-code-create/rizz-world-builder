-- ============================================================
-- Phase 4 + Phase 5 probe: threads, polls, scheduling, custom
-- emoji, reaction roles, XP, message search, bot ratings, the
-- welcome bot, the music bot and the screen-share flag.
--
-- Every check drives the same functions the app calls. Run it
-- against a scratch database that already has the migrations:
--   node /tmp/pgtry/harness.mjs reset migrate sql4
-- ============================================================
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111','alpha@probe.test','{"username":"alpha","display_name":"Alpha"}'),
  ('22222222-2222-2222-2222-222222222222','bravo@probe.test','{"username":"bravo","display_name":"Bravo"}'),
  ('33333333-3333-3333-3333-333333333333','charlie@probe.test','{"username":"charlie","display_name":"Charlie"}'),
  ('44444444-4444-4444-4444-444444444444','delta@probe.test','{"username":"delta","display_name":"Delta"}'),
  ('55555555-5555-5555-5555-555555555555','echo@probe.test','{"username":"echo","display_name":"Echo"}'),
  ('66666666-6666-6666-6666-666666666666','foxtrot@probe.test','{"username":"foxtrot","display_name":"Foxtrot"}')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.expect(l text, ok boolean, d text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '% % % %', CASE WHEN coalesce(ok,false) THEN 'PASS' ELSE 'FAIL' END,
    l, CASE WHEN coalesce(ok,false) THEN '' ELSE '<<<' END, coalesce(left(d,200),'');
END $$;

DO $probe$
DECLARE
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '44444444-4444-4444-4444-444444444444';
  e uuid := '55555555-5555-5555-5555-555555555555';
  f uuid := '66666666-6666-6666-6666-666666666666';
  realm uuid;
  room uuid;
  private_room uuid;
  root uuid;
  reply uuid;
  res jsonb;
  v_poll uuid;
  multi_id uuid;
  msg_id uuid;
  sched_id uuid;
  emoji_id uuid;
  rizz_bot uuid;
  music_bot uuid;
  voice_room uuid;
  own_bot uuid;
  n integer;
  v_xp integer;
  denied boolean := false;
BEGIN
  -- ------------------------------------------------------- setup
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  INSERT INTO public.realms (owner_id, slug, name, is_public)
  VALUES (a, 'phase-five', 'Phase Five', true) RETURNING id INTO realm;
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, a, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, b, 'member') ON CONFLICT DO NOTHING;
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, c, 'member') ON CONFLICT DO NOTHING;
  SELECT id INTO room FROM public.realm_rooms WHERE realm_id = realm ORDER BY is_default DESC, position LIMIT 1;

  PERFORM pg_temp.expect('setup: default room exists', room IS NOT NULL);
  PERFORM pg_temp.expect('setup: profiles were created with the users',
    (SELECT count(*) FROM public.profiles WHERE id IN (a,b,c,d,e,f)) = 6);

  -- the welcome bot greeted the two members (the founder is skipped)
  PERFORM pg_temp.expect('welcome: non-owner joins got greeted',
    (SELECT count(*) FROM public.messages m JOIN public.bots bo ON bo.id = m.bot_id
      WHERE m.realm_id = realm AND bo.name = 'WELCOME') = 2,
    (SELECT string_agg(left(body,70), ' | ') FROM public.messages WHERE realm_id = realm));
  PERFORM pg_temp.expect('welcome: the founder was not greeted at creation',
    NOT EXISTS (SELECT 1 FROM public.messages m JOIN public.bots bo ON bo.id = m.bot_id
      WHERE m.realm_id = realm AND bo.name = 'WELCOME' AND body LIKE '%Alpha%'));

  -- ------------------------------------------------------ threads
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
  VALUES (realm, room, a, 'root of the thread') RETURNING id INTO root;
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body, thread_root, parent_id)
  VALUES (realm, room, b, 'first reply', root, root) RETURNING id INTO reply;
  PERFORM pg_temp.expect('threads: reply counted on the root',
    (SELECT reply_count FROM public.messages WHERE id = root) = 1);

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body, thread_root, parent_id)
  VALUES (realm, room, c, 'second reply', root, root);
  PERFORM pg_temp.expect('threads: counter climbs',
    (SELECT reply_count FROM public.messages WHERE id = root) = 2);

  DELETE FROM public.messages WHERE id = reply;
  PERFORM pg_temp.expect('threads: deleting a reply lowers the counter',
    (SELECT reply_count FROM public.messages WHERE id = root) = 1);

  -- -------------------------------------------------------- polls
  res := public.create_realm_poll(realm, room, 'Best night for the meetup?',
    '["Friday","Saturday","Sunday"]'::jsonb, false, 0);
  PERFORM pg_temp.expect('poll: created', coalesce(res->>'ok','') = 'true', res::text);
  v_poll := (res->>'poll_id')::uuid;
  msg_id := (res->>'message_id')::uuid;
  PERFORM pg_temp.expect('poll: the message carries the card',
    (SELECT card->>'type' FROM public.messages WHERE id = msg_id) = 'poll');
  PERFORM pg_temp.expect('poll: the question is on the card',
    (SELECT card->>'question' FROM public.messages WHERE id = msg_id) = 'Best night for the meetup?');

  res := public.create_realm_poll(realm, room, 'One option?', '["Only one"]'::jsonb, false, 0);
  PERFORM pg_temp.expect('poll: one option is refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.create_realm_poll(realm, room, 'Blank?', '["Yes","   "]'::jsonb, false, 0);
  PERFORM pg_temp.expect('poll: a blank option is refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.create_realm_poll(realm, room, 'Seven?', '["1","2","3","4","5","6","7"]'::jsonb, false, 0);
  PERFORM pg_temp.expect('poll: seven options are refused', coalesce(res->>'ok','') = 'false', res::text);

  -- Bravo votes
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.vote_realm_poll(v_poll, 0);
  PERFORM pg_temp.expect('poll: a member can vote', coalesce(res->>'ok','') = 'true', res::text);
  PERFORM pg_temp.expect('poll: the vote is stored',
    (SELECT count(*) FROM public.realm_poll_votes v WHERE v.poll_id = v_poll AND v.user_id = b) = 1);

  res := public.vote_realm_poll(v_poll, 2);
  PERFORM pg_temp.expect('poll: a single-choice vote switches',
    (SELECT option_index FROM public.realm_poll_votes v WHERE v.poll_id = v_poll AND v.user_id = b) = 2,
    res::text);

  PERFORM set_config('request.jwt.claim.sub', c::text, false);
  res := public.vote_realm_poll(v_poll, 1);
  PERFORM pg_temp.expect('poll: a second voter is counted',
    (SELECT count(*) FROM public.realm_poll_votes v WHERE v.poll_id = v_poll) = 2);

  -- Delta is not in the realm
  PERFORM set_config('request.jwt.claim.sub', d::text, false);
  res := public.vote_realm_poll(v_poll, 0);
  PERFORM pg_temp.expect('poll: a stranger cannot vote', coalesce(res->>'ok','') = 'false', res::text);

  -- closed poll
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.create_realm_poll(realm, room, 'Multi?', '["A","B","C"]'::jsonb, true, 0);
  multi_id := (res->>'poll_id')::uuid;
  UPDATE public.realm_polls SET closes_at = now() - interval '1 minute' WHERE id = v_poll;
  res := public.vote_realm_poll(v_poll, 0);
  PERFORM pg_temp.expect('poll: a closed poll refuses votes', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.vote_realm_poll(multi_id, 0);
  PERFORM public.vote_realm_poll(multi_id, 1);
  PERFORM pg_temp.expect('poll: a multi poll keeps both votes',
    (SELECT count(*) FROM public.realm_poll_votes v WHERE v.poll_id = multi_id AND v.user_id = b) = 2, res::text);
  res := public.vote_realm_poll(multi_id, 1);
  PERFORM pg_temp.expect('poll: a multi poll toggles a vote off',
    (SELECT count(*) FROM public.realm_poll_votes v WHERE v.poll_id = multi_id AND v.user_id = b) = 1, res::text);

  -- ------------------------------------------------- scheduled messages
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.schedule_realm_message(realm, room, 'too soon', now() + interval '10 seconds');
  PERFORM pg_temp.expect('scheduled: a message one minute out is refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.schedule_realm_message(realm, room, 'see you then', now() + interval '5 minutes');
  PERFORM pg_temp.expect('scheduled: a message can be booked', coalesce(res->>'ok','') = 'true', res::text);
  sched_id := (res->>'id')::uuid;

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.cancel_realm_message(sched_id);
  PERFORM pg_temp.expect('scheduled: another member cannot cancel it', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.cancel_realm_message(sched_id);
  PERFORM pg_temp.expect('scheduled: the author can cancel it', coalesce(res->>'ok','') = 'true', res::text);

  -- one that is already due, plus one whose author never joined
  INSERT INTO public.realm_scheduled_messages (realm_id, realm_room_id, created_by, body, scheduled_for)
  VALUES (realm, room, a, 'this one is due', now() - interval '1 minute');
  INSERT INTO public.realm_scheduled_messages (realm_id, realm_room_id, created_by, body, scheduled_for)
  VALUES (realm, room, d, 'this author is gone', now() - interval '1 minute');

  n := public.send_due_scheduled_messages();
  PERFORM pg_temp.expect('scheduled: due messages were sent', n >= 1, n::text);
  PERFORM pg_temp.expect('scheduled: the body landed in chat',
    EXISTS (SELECT 1 FROM public.messages WHERE realm_id = realm AND body = 'this one is due'));
  PERFORM pg_temp.expect('scheduled: a departed author is cancelled, not sent',
    (SELECT status FROM public.realm_scheduled_messages WHERE created_by = d) = 'cancelled');
  PERFORM pg_temp.expect('scheduled: the sent row is marked',
    EXISTS (SELECT 1 FROM public.realm_scheduled_messages
            WHERE body = 'this one is due' AND status = 'sent' AND sent_message_id IS NOT NULL));

  -- ------------------------------------------------------ custom emoji
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.save_realm_emoji(realm, 'party', 'https://cdn.example/party.png', 'emoji');
  PERFORM pg_temp.expect('emoji: a plain member cannot upload', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.save_realm_emoji(realm, 'party', 'https://cdn.example/party.png', 'emoji');
  PERFORM pg_temp.expect('emoji: a moderator can upload', coalesce(res->>'ok','') = 'true', res::text);
  emoji_id := (res->>'id')::uuid;

  res := public.save_realm_emoji(realm, 'party', 'https://cdn.example/party2.png', 'emoji');
  PERFORM pg_temp.expect('emoji: duplicates are refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.save_realm_emoji(realm, 'PARTY', 'https://cdn.example/x.png', 'emoji');
  PERFORM pg_temp.expect('emoji: uppercase names are refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.save_realm_emoji(realm, 'hmm', 'http://insecure.example/x.png', 'emoji');
  PERFORM pg_temp.expect('emoji: insecure links are refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.save_realm_emoji(realm, 'hype', 'https://cdn.example/hype.png', 'sticker');
  PERFORM pg_temp.expect('emoji: stickers are allowed', coalesce(res->>'ok','') = 'true', res::text);

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.delete_realm_emoji(emoji_id);
  PERFORM pg_temp.expect('emoji: a plain member cannot delete', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.delete_realm_emoji(emoji_id);
  PERFORM pg_temp.expect('emoji: a moderator can delete', coalesce(res->>'ok','') = 'true', res::text);

  -- -------------------------------------------------- reaction roles
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.set_realm_reaction_role(root, '⭐', 'mod');
  PERFORM pg_temp.expect('reaction roles: a plain member cannot configure them',
    coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.set_realm_reaction_role(root, '⭐', 'mod');
  PERFORM pg_temp.expect('reaction roles: a moderator can configure them',
    coalesce(res->>'ok','') = 'true', res::text);

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  INSERT INTO public.message_reactions (message_type, message_id, user_id, emoji)
  VALUES ('realm', root, b, '⭐');
  PERFORM pg_temp.expect('reaction roles: reacting grants the role',
    (SELECT role FROM public.realm_members WHERE realm_id = realm AND user_id = b) = 'mod');

  DELETE FROM public.message_reactions
  WHERE message_type = 'realm' AND message_id = root AND user_id = b AND emoji = '⭐';
  PERFORM pg_temp.expect('reaction roles: un-reacting takes the role back',
    (SELECT role FROM public.realm_members WHERE realm_id = realm AND user_id = b) = 'member');

  -- a member-role rule must never demote an existing mod
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  PERFORM public.set_realm_reaction_role(root, '👋', 'member');
  UPDATE public.realm_members SET role = 'mod' WHERE realm_id = realm AND user_id = c;
  PERFORM set_config('request.jwt.claim.sub', c::text, false);
  INSERT INTO public.message_reactions (message_type, message_id, user_id, emoji)
  VALUES ('realm', root, c, '👋');
  PERFORM pg_temp.expect('reaction roles: a member rule never demotes a mod',
    (SELECT role FROM public.realm_members WHERE realm_id = realm AND user_id = c) = 'mod');
  DELETE FROM public.message_reactions
  WHERE message_type = 'realm' AND message_id = root AND user_id = c AND emoji = '👋';
  PERFORM pg_temp.expect('reaction roles: un-reacting leaves the mod alone',
    (SELECT role FROM public.realm_members WHERE realm_id = realm AND user_id = c) = 'mod');
  UPDATE public.realm_members SET role = 'member' WHERE realm_id = realm AND user_id = c;

  -- the owner is never moved by a reaction
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  INSERT INTO public.message_reactions (message_type, message_id, user_id, emoji)
  VALUES ('realm', root, a, '⭐');
  PERFORM pg_temp.expect('reaction roles: the owner keeps the owner role',
    (SELECT role FROM public.realm_members WHERE realm_id = realm AND user_id = a) = 'owner');
  DELETE FROM public.message_reactions
  WHERE message_type = 'realm' AND message_id = root AND user_id = a AND emoji = '⭐';

  -- ------------------------------------------------------ XP & levels
  PERFORM set_config('request.jwt.claim.sub', e::text, false);
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, e, 'member') ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
  VALUES (realm, room, e, 'first message for xp');
  v_xp := (SELECT xp FROM public.realm_xp WHERE realm_id = realm AND user_id = e);
  PERFORM pg_temp.expect('xp: a message earns 20 xp', v_xp = 20, v_xp::text);

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
  VALUES (realm, room, e, 'second message straight after');
  v_xp := (SELECT xp FROM public.realm_xp WHERE realm_id = realm AND user_id = e);
  PERFORM pg_temp.expect('xp: spam inside the cooldown earns nothing',
    v_xp = 20 AND (SELECT messages FROM public.realm_xp WHERE realm_id = realm AND user_id = e) = 2, v_xp::text);

  PERFORM pg_temp.expect('xp: levels follow the curve',
    public.realm_level_for(0) = 1 AND public.realm_level_for(50) = 2
    AND public.realm_level_for(200) = 3 AND public.realm_level_for(1000000) > 10);

  PERFORM pg_temp.expect('xp: the leaderboard carries the member with a rank',
    (SELECT count(*) FROM public.realm_leaderboard(realm, 10) WHERE user_id = e) = 1
    AND (SELECT rank FROM public.realm_leaderboard(realm, 10) WHERE user_id = e) BETWEEN 1 AND 10);

  res := public.my_realm_xp(realm);
  PERFORM pg_temp.expect('xp: my own row reports a level',
    coalesce(res->>'ok','') = 'true' AND (res->>'level')::int >= 1 AND (res->>'rank')::int >= 1, res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.set_realm_xp_enabled(realm, false);
  PERFORM pg_temp.expect('xp: a moderator can switch xp off', coalesce(res->>'ok','') = 'true', res::text);
  PERFORM set_config('request.jwt.claim.sub', e::text, false);
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
  VALUES (realm, room, e, 'xp should be off now');
  PERFORM set_config('request.jwt.claim.sub', e::text, false);
  PERFORM pg_temp.expect('xp: switched off, nothing is awarded',
    (SELECT xp FROM public.realm_xp WHERE realm_id = realm AND user_id = e) = 20);
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  PERFORM public.set_realm_xp_enabled(realm, true);

  -- ----------------------------------------------------- message search
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  INSERT INTO public.realm_rooms (realm_id, name, kind, position, is_private)
  VALUES (realm, 'secret', 'text', 99, true) RETURNING id INTO private_room;
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
  VALUES (realm, private_room, a, 'the zamboni lives here');

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  PERFORM pg_temp.expect('search: a member finds public messages',
    (SELECT count(*) FROM public.search_realm_messages(realm, 'meetup')) > 0);
  PERFORM pg_temp.expect('search: a private channel stays hidden',
    (SELECT count(*) FROM public.search_realm_messages(realm, 'zamboni')) = 0);
  PERFORM pg_temp.expect('search: too short a query returns nothing',
    (SELECT count(*) FROM public.search_realm_messages(realm, 'z')) = 0);
  PERFORM pg_temp.expect('search: a thread reply is returned with its root',
    (SELECT thread_root FROM public.search_realm_messages(realm, 'second reply') LIMIT 1) = root,
    coalesce((SELECT string_agg(id::text || ' root=' || coalesce(thread_root::text, 'null'), ', ')
              FROM public.search_realm_messages(realm, 'second reply')), 'no rows'));

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  PERFORM pg_temp.expect('search: the owner may read the private channel',
    (SELECT count(*) FROM public.search_realm_messages(realm, 'zamboni')) = 1);

  -- ------------------------------------------------------- bot ratings
  SELECT id INTO rizz_bot FROM public.bots WHERE is_builtin AND name = 'RIZZ BOT';
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.rate_bot(rizz_bot, 5, 'solid house bot');
  PERFORM pg_temp.expect('ratings: a member can rate a built-in bot', coalesce(res->>'ok','') = 'true', res::text);
  res := public.rate_bot(rizz_bot, 3, 'actually, a three');
  PERFORM pg_temp.expect('ratings: rating again updates the same row',
    coalesce(res->>'ok','') = 'true'
    AND (SELECT count(*) FROM public.bot_ratings WHERE bot_id = rizz_bot AND user_id = b) = 1, res::text);

  res := public.rate_bot(rizz_bot, 9, NULL);
  PERFORM pg_temp.expect('ratings: out-of-range stars are refused', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.create_bot('Alpha Bot', 'mine', NULL, 'webhook',
    'https://example.com/hook', ARRAY['messages.write'], repeat('b',64), 'rbot_alpha');
  own_bot := (res->>'bot_id')::uuid;
  res := public.rate_bot(own_bot, 5, 'me');
  PERFORM pg_temp.expect('ratings: you cannot rate your own bot', coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  PERFORM pg_temp.expect('ratings: the directory carries the score',
    (SELECT (dir->>'rating_count')::int FROM jsonb_array_elements(public.bot_directory(NULL)) AS dir
      WHERE dir->>'bot_id' = rizz_bot::text) = 1
    AND (SELECT (dir->>'my_rating')::int FROM jsonb_array_elements(public.bot_directory(NULL)) AS dir
      WHERE dir->>'bot_id' = rizz_bot::text) = 3);
  RAISE NOTICE 'MARKER: past the directory check';

  -- ----------------------------------------------------- the music bot
  SELECT id INTO music_bot FROM public.bots WHERE is_builtin AND name = 'MUSIC BOT';
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.install_realm_bot(realm, music_bot);
  PERFORM pg_temp.expect('music: the bot can be installed', coalesce(res->>'ok','') = 'true', res::text);

  -- The music bot belongs to voice channels (20261016000000). The house bot is
  -- installed too, so "which commands does this channel offer" is a real
  -- question instead of an empty list.
  INSERT INTO public.realm_rooms (realm_id, name, kind, position)
  VALUES (realm, 'Probe voice', 'voice', 99) RETURNING id INTO voice_room;
  PERFORM pg_temp.expect('music: a voice channel exists to queue into', voice_room IS NOT NULL);
  res := public.install_realm_bot(realm, rizz_bot);
  PERFORM pg_temp.expect('commands: the house bot can be installed too', coalesce(res->>'ok','') = 'true', res::text);

  res := public.music_add(realm, voice_room,
    '{"title":"Night Drive","artist":"The Probes","url":"https://example.com/t/1","artwork":"https://example.com/a.jpg","preview":"https://example.com/p.m4a","duration":180000}'::jsonb);
  PERFORM pg_temp.expect('music: a track is queued', coalesce(res->>'ok','') = 'true', res::text);
  PERFORM pg_temp.expect('music: the queued track posted a card',
    (SELECT card->>'type' FROM public.messages WHERE id = (res->>'message_id')::uuid) = 'track'
    AND (SELECT card->>'title' FROM public.messages WHERE id = (res->>'message_id')::uuid) = 'Night Drive');

  res := public.music_add(realm, voice_room, '{"title":"Second Song","artist":"The Probes"}'::jsonb);
  PERFORM pg_temp.expect('music: the queue position climbs', (res->>'position')::int = 2, res::text);

  res := public.music_add(realm, voice_room, '{}'::jsonb);
  PERFORM pg_temp.expect('music: a track without a title is refused', coalesce(res->>'ok','') = 'false', res::text);

  res := public.run_music_bot_command('queue', '', realm, voice_room);
  PERFORM pg_temp.expect('music: /queue lists the songs',
    coalesce(res->>'ok','') = 'true' AND res->>'body' LIKE '%Night Drive%Second Song%', res::text);

  res := public.run_music_bot_command('np', '', realm, voice_room);
  PERFORM pg_temp.expect('music: /np answers', coalesce(res->>'ok','') = 'true' AND res->>'body' LIKE '%Now playing%', res::text);

  res := public.run_music_bot_command('skip', '', realm, voice_room);
  PERFORM pg_temp.expect('music: /skip clears the head',
    coalesce(res->>'ok','') = 'true'
    AND (SELECT status FROM public.music_queue WHERE title = 'Night Drive') = 'skipped');

  res := public.run_music_bot_command('stop', '', realm, voice_room);
  PERFORM pg_temp.expect('music: /stop empties the queue',
    coalesce(res->>'ok','') = 'true'
    AND (SELECT count(*) FROM public.music_queue WHERE realm_id = realm AND status = 'queued') = 0);

  PERFORM set_config('request.jwt.claim.sub', d::text, false);
  res := public.music_add(realm, voice_room, '{"title":"Nope"}'::jsonb);
  PERFORM pg_temp.expect('music: a stranger cannot queue a song', coalesce(res->>'ok','') = 'false', res::text);

  -- Voice channels only: the same calls are refused in a text channel and in the
  -- realm's own channel, so a /play entry can no longer appear where it fails.
  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.music_add(realm, room, '{"title":"Wrong place"}'::jsonb);
  PERFORM pg_temp.expect('music: a text channel is refused',
    coalesce(res->>'ok','') = 'false' AND coalesce(res->>'error','') LIKE '%voice channel%', res::text);
  res := public.music_add(realm, NULL, '{"title":"Nowhere"}'::jsonb);
  PERFORM pg_temp.expect('music: the realm channel is refused',
    coalesce(res->>'ok','') = 'false' AND coalesce(res->>'error','') LIKE '%voice channel%', res::text);
  res := public.run_music_bot_command('queue', '', realm, room);
  PERFORM pg_temp.expect('music: /queue is refused outside a voice channel',
    coalesce(res->>'ok','') = 'false' AND coalesce(res->>'error','') LIKE '%voice channel%', res::text);
  res := public.run_music_bot_command('skip', '', realm, NULL);
  PERFORM pg_temp.expect('music: /skip is refused outside a voice channel', coalesce(res->>'ok','') = 'false', res::text);

  res := public.realm_slash_commands(realm, voice_room);
  PERFORM pg_temp.expect('commands: a voice channel offers MUSIC BOT',
    jsonb_array_length(res) > 0
    AND (SELECT bool_and(entry->>'bot_name' = 'MUSIC BOT') FROM jsonb_array_elements(res) AS entry)
    AND res::text LIKE '%"play"%', left(res::text, 300));
  res := public.realm_slash_commands(realm, room);
  PERFORM pg_temp.expect('commands: a text channel hides the music bot and keeps the house bot',
    jsonb_array_length(res) > 0
    AND (SELECT bool_and(entry->>'bot_name' <> 'MUSIC BOT') FROM jsonb_array_elements(res) AS entry)
    AND res::text LIKE '%"rizz"%', left(res::text, 300));
  res := public.realm_slash_commands(realm, NULL);
  PERFORM pg_temp.expect('commands: the realm channel hides the music bot',
    res::text NOT LIKE '%MUSIC BOT%' AND res::text LIKE '%"rizz"%', left(res::text, 300));

  -- ------------------------------------------------- welcome bot switch
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  res := public.set_realm_welcome(realm, false, NULL);
  PERFORM pg_temp.expect('welcome: only moderators can change the switch',
    coalesce(res->>'ok','') = 'false', res::text);

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  res := public.set_realm_welcome(realm, true, 'Grab a role and say hi!');
  PERFORM pg_temp.expect('welcome: the greeting line is saved', coalesce(res->>'ok','') = 'true', res::text);

  PERFORM set_config('request.jwt.claim.sub', d::text, false);
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, d, 'member');
  PERFORM pg_temp.expect('welcome: the custom line is posted',
    EXISTS (SELECT 1 FROM public.messages m JOIN public.bots bo ON bo.id = m.bot_id
            WHERE m.realm_id = realm AND bo.name = 'WELCOME' AND m.body LIKE '%Grab a role%'));

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  PERFORM public.set_realm_welcome(realm, false, NULL);
  PERFORM set_config('request.jwt.claim.sub', f::text, false);
  INSERT INTO public.realm_members (realm_id, user_id, role) VALUES (realm, f, 'member');
  PERFORM pg_temp.expect('welcome: switched off, nobody is greeted',
    NOT EXISTS (SELECT 1 FROM public.messages m JOIN public.bots bo ON bo.id = m.bot_id
                WHERE m.realm_id = realm AND bo.name = 'WELCOME' AND m.body LIKE '%Foxtrot%'));

  -- ------------------------------------------- screen share + read rules
  PERFORM pg_temp.expect('screen share: the roster flag exists',
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'voice_participants' AND column_name = 'sharing_screen') = 1);

  -- RLS: read as a real member, not as the table owner
  EXECUTE 'SET ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', b::text, false);
  PERFORM pg_temp.expect('rls: a member reads the polls',
    (SELECT count(*) FROM public.realm_polls WHERE realm_id = realm) > 0);
  PERFORM pg_temp.expect('rls: another member sees no one else''s scheduled rows',
    (SELECT count(*) FROM public.realm_scheduled_messages WHERE realm_id = realm) = 0);
  PERFORM pg_temp.expect('rls: the search runs as the caller',
    (SELECT count(*) FROM public.search_realm_messages(realm, 'meetup')) > 0);

  BEGIN
    INSERT INTO public.bot_ratings (bot_id, user_id, rating) VALUES (rizz_bot, c, 5);
    denied := false;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  PERFORM pg_temp.expect('rls: a raw rating insert is refused', denied);

  BEGIN
    INSERT INTO public.realm_poll_votes (poll_id, user_id, option_index) VALUES (multi_id, c, 0);
    denied := false;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  PERFORM pg_temp.expect('rls: a raw vote insert is refused', denied);

  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', a::text, false);
  PERFORM pg_temp.expect('rls: the author sees their own scheduled rows',
    (SELECT count(*) FROM public.realm_scheduled_messages WHERE realm_id = realm) > 0);
END;
$probe$;
