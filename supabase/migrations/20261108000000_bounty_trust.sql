-- ============ BOUNTY TRUST, WARNINGS, BLOCKS AND THE CANCEL FEE ============
-- Builds on 20261107000000_bounty_escrow.sql. Adds:
--   * premium-only taking (an active Purify entitlement), checked server-side
--   * a trust gate and creator-level blocks
--   * a 1000-Paws taker cancellation fee, charged on hand-back or a missed
--     deadline, with the recipient configurable (creator or platform)
--   * warnings, one appeal per warning, and an admin review queue
--   * the columns the richer "Post a bounty" form needs
--
-- The escrow invariants stay where they were: payout_bounty() is still the only
-- function that pays a worker, review_bounty_submission() and
-- release_overdue_bounty_payout() still delegate to it, and every wallet write
-- is bracketed with rizz.paw_writer so protect_paw_balance() stays happy.

-- ============ RULES, IN ONE PLACE ============
CREATE OR REPLACE FUNCTION public.bounty_escrow_config()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'min_prize', 25,
    'max_prize', 250000,
    'fee_percent', 10,
    'fee_min', 5,
    'taken_fee_multiplier', 2,
    'review_hours', 72,
    'min_hours', 1,
    'max_hours', 720,
    'max_rejections', 3,
    'max_links', 5,
    'max_media', 4,
    -- Taker cancellation fee. Mirrored by CANCEL_FEE / FEE_RECIPIENT in
    -- src/lib/bounty-trust.ts; the UI reads this copy so the number it warns
    -- about is the number that gets charged.
    'cancel_fee', 1000,
    'fee_recipient', 'creator',
    -- Trust ladder, mirrored by TRUST_THRESHOLDS.
    'auto_block_warnings', 3,
    'trusted_completed', 3,
    'trusted_max_warnings', 1,
    'top_completed', 10,
    'top_max_warnings', 0
  )
$$;

GRANT EXECUTE ON FUNCTION public.bounty_escrow_config() TO anon, authenticated;

-- ============ NEW COLUMNS ON THE BOUNTY ============
ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS premium_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proof_type text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS min_trust text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_proof_type_check;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_proof_type_check
  CHECK (proof_type IN ('any', 'link', 'image', 'video', 'text'));

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_min_trust_check;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_min_trust_check
  CHECK (min_trust IN ('any', 'trusted', 'top'));

COMMENT ON COLUMN public.drops.proof_type IS
  'What the poster will accept as proof: any, link, image, video or text.';
COMMENT ON COLUMN public.drops.min_trust IS
  'Lowest trust level allowed to take this bounty: any, trusted or top.';

-- ============ WARNINGS, BLOCKS, CANCELLATION LOG ============
CREATE TABLE IF NOT EXISTS public.bounty_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  taker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('no_work', 'fake_proof', 'scam', 'other')),
  note text CHECK (char_length(note) <= 500),
  -- status counts against the taker; "removed" is an upheld appeal.
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  -- none -> pending -> upheld (warning removed) | rejected (warning stays).
  appeal_status text NOT NULL DEFAULT 'none'
    CHECK (appeal_status IN ('none', 'pending', 'upheld', 'rejected')),
  appeal_message text CHECK (char_length(appeal_message) <= 500),
  appealed_at timestamptz,
  resolution_note text CHECK (char_length(resolution_note) <= 500),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One warning per bounty per creator: the row is the record of the dispute.
  UNIQUE (drop_id, creator_id)
);

CREATE INDEX IF NOT EXISTS bounty_warnings_taker_idx
  ON public.bounty_warnings (taker_id, status);
CREATE INDEX IF NOT EXISTS bounty_warnings_appeal_idx
  ON public.bounty_warnings (appeal_status, appealed_at);

CREATE TABLE IF NOT EXISTS public.bounty_blocks (
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, blocked_id),
  CHECK (creator_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.bounty_cancel_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  taker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee integer NOT NULL CHECK (fee >= 0),
  recipient text NOT NULL CHECK (recipient IN ('creator', 'platform')),
  reason text NOT NULL CHECK (reason IN ('handback', 'deadline')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bounty_cancel_log_drop_idx
  ON public.bounty_cancel_log (drop_id, created_at DESC);

ALTER TABLE public.bounty_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_cancel_log ENABLE ROW LEVEL SECURITY;

-- Both sides of a warning can read it, and admins can read every row so the
-- appeal queue works. Writes go through the RPCs below only: there are no
-- INSERT/UPDATE/DELETE policies on purpose.
DROP POLICY IF EXISTS "bounty warnings for the pair or an admin" ON public.bounty_warnings;
CREATE POLICY "bounty warnings for the pair or an admin"
  ON public.bounty_warnings
  FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR taker_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "creators manage their own bounty blocks" ON public.bounty_blocks;
CREATE POLICY "creators manage their own bounty blocks"
  ON public.bounty_blocks
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "bounty cancellations for the pair or an admin" ON public.bounty_cancel_log;
CREATE POLICY "bounty cancellations for the pair or an admin"
  ON public.bounty_cancel_log
  FOR SELECT
  TO authenticated
  USING (
    taker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.drops d
      WHERE d.id = bounty_cancel_log.drop_id AND d.creator_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ TRUST SCORE ============
-- Approved bounty payouts against active warnings. Pending appeals stay
-- "active" on purpose: a block only lifts when an admin decides.
CREATE OR REPLACE FUNCTION public.bounty_trust_stats(_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_cfg jsonb := public.bounty_escrow_config();
  v_completed integer := 0;
  v_warnings integer := 0;
  v_level text := 'new';
BEGIN
  v_user := coalesce(_user, auth.uid());
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('completed', 0, 'warnings', 0, 'level', 'new');
  END IF;

  SELECT count(*)::integer INTO v_completed
  FROM public.drops
  WHERE assigned_to = v_user AND state = 'paid';

  SELECT count(*)::integer INTO v_warnings
  FROM public.bounty_warnings
  WHERE taker_id = v_user AND status = 'active';

  IF v_completed >= (v_cfg ->> 'top_completed')::integer
     AND v_warnings <= (v_cfg ->> 'top_max_warnings')::integer THEN
    v_level := 'top';
  ELSIF v_completed >= (v_cfg ->> 'trusted_completed')::integer
     AND v_warnings <= (v_cfg ->> 'trusted_max_warnings')::integer THEN
    v_level := 'trusted';
  END IF;

  RETURN jsonb_build_object(
    'completed', v_completed,
    'warnings', v_warnings,
    'level', v_level,
    'auto_blocked', v_warnings >= (v_cfg ->> 'auto_block_warnings')::integer
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bounty_trust_stats(uuid) TO anon, authenticated;

-- One call for a whole board: the card only needs the taker's line.
CREATE OR REPLACE FUNCTION public.bounty_trust_stats_many(_users uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_object_agg(u::text, public.bounty_trust_stats(u)),
    '{}'::jsonb
  )
  FROM (SELECT DISTINCT unnest(coalesce(_users, '{}'::uuid[])) AS u) ids
$$;

GRANT EXECUTE ON FUNCTION public.bounty_trust_stats_many(uuid[]) TO anon, authenticated;

-- ============ THE TAKER CANCELLATION FEE ============
-- Internal helper. Charges what the wallet can cover (never below zero), pays
-- the configured recipient, and writes both sides of the ledger plus the log.
CREATE OR REPLACE FUNCTION public.charge_bounty_cancel_fee(
  _drop_id uuid,
  _taker uuid,
  _reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg jsonb := public.bounty_escrow_config();
  v_fee integer := (v_cfg ->> 'cancel_fee')::integer;
  v_recipient text := v_cfg ->> 'fee_recipient';
  v_creator uuid;
  v_balance integer;
  v_charged integer;
BEGIN
  IF _reason NOT IN ('handback', 'deadline') THEN
    RAISE EXCEPTION 'Unknown cancellation reason: %', _reason;
  END IF;

  SELECT creator_id INTO v_creator FROM public.drops WHERE id = _drop_id;
  SELECT paw_balance INTO v_balance FROM public.profiles WHERE id = _taker FOR UPDATE;
  v_charged := LEAST(v_fee, GREATEST(coalesce(v_balance, 0), 0));

  IF v_charged > 0 THEN
    PERFORM set_config('rizz.paw_writer', 'on', true);

    UPDATE public.profiles
    SET paw_balance = paw_balance - v_charged
    WHERE id = _taker;

    INSERT INTO public.paw_transactions (user_id, amount, kind, description, reference_id)
    VALUES (
      _taker, -v_charged, 'bounty_cancel_fee',
      CASE WHEN _reason = 'deadline'
        THEN 'Missed a bounty deadline'
        ELSE 'Handed a bounty back' END,
      _drop_id::text
    );

    IF v_recipient = 'creator' AND v_creator IS NOT NULL THEN
      UPDATE public.profiles
      SET paw_balance = paw_balance + v_charged
      WHERE id = v_creator;

      INSERT INTO public.paw_transactions (user_id, amount, kind, description, reference_id)
      VALUES (
        v_creator, v_charged, 'bounty_cancel_comp',
        'Cancellation fee from a taker', _drop_id::text
      );
    END IF;

    PERFORM set_config('rizz.paw_writer', 'off', true);

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      _taker, v_creator, 'bounty_fee_charged',
      'Cancellation fee charged',
      v_charged || ' Paws were taken for cancelling "' ||
        coalesce((SELECT title FROM public.drops WHERE id = _drop_id), 'a bounty') || '".',
      jsonb_build_object('bounty', _drop_id, 'fee', v_charged, 'recipient', v_recipient)
    );
  END IF;

  INSERT INTO public.bounty_cancel_log (drop_id, taker_id, fee, recipient, reason)
  VALUES (_drop_id, _taker, v_charged, v_recipient, _reason);

  RETURN v_charged;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_bounty_cancel_fee(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

-- ============ POSTING, WITH THE NEW FORM FIELDS ============
-- The old six-argument signature is dropped first: with defaults on the new
-- arguments the two would be an ambiguous overload for a six-argument call.
DROP FUNCTION IF EXISTS public.post_paws_bounty(text, text, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.post_paws_bounty(
  _title text,
  _description text,
  _requirements text,
  _prize integer,
  _hours integer,
  _media_url text DEFAULT NULL,
  _premium_only boolean DEFAULT false,
  _proof_type text DEFAULT 'any',
  _min_trust text DEFAULT 'any',
  _tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cfg jsonb := public.bounty_escrow_config();
  v_title text := btrim(coalesce(_title, ''));
  v_balance integer;
  v_id uuid;
  v_tags text[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to post a bounty.';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Give the bounty a title.';
  END IF;
  IF char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Keep the title under 80 characters.';
  END IF;
  IF coalesce(_prize, 0) < (v_cfg ->> 'min_prize')::integer THEN
    RAISE EXCEPTION 'The smallest prize is % Paws.', v_cfg ->> 'min_prize';
  END IF;
  IF _prize > (v_cfg ->> 'max_prize')::integer THEN
    RAISE EXCEPTION 'That prize is above the % Paws cap.', v_cfg ->> 'max_prize';
  END IF;
  IF coalesce(_hours, 0) < (v_cfg ->> 'min_hours')::integer
     OR _hours > (v_cfg ->> 'max_hours')::integer THEN
    RAISE EXCEPTION 'Pick a deadline between % and % hours.',
      v_cfg ->> 'min_hours', v_cfg ->> 'max_hours';
  END IF;
  IF coalesce(_proof_type, 'any') NOT IN ('any', 'link', 'image', 'video', 'text') THEN
    RAISE EXCEPTION 'Pick a proof type the form offers.';
  END IF;
  IF coalesce(_min_trust, 'any') NOT IN ('any', 'trusted', 'top') THEN
    RAISE EXCEPTION 'Pick a minimum trust level the form offers.';
  END IF;
  IF coalesce(array_length(_tags, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Keep it to five tags.';
  END IF;

  v_tags := coalesce(
    (
      SELECT array_agg(left(btrim(tag), 24))
      FROM unnest(coalesce(_tags, '{}')) AS tag
      WHERE btrim(tag) <> ''
    ),
    '{}'
  );

  -- Lock the wallet row first: two taps on "post" cannot spend the same Paws
  -- twice, and the balance can never go negative (the constraint would fire).
  SELECT paw_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF coalesce(v_balance, 0) < _prize THEN
    RAISE EXCEPTION 'You need % Paws in escrow and you have %.', _prize, coalesce(v_balance, 0);
  END IF;

  INSERT INTO public.drops (
    creator_id, title, description, requirements, media_url,
    claim_limit, expires_at, prize_paws, escrow_state, state,
    premium_only, proof_type, min_trust, tags
  )
  VALUES (
    v_user,
    v_title,
    nullif(btrim(coalesce(_description, '')), ''),
    nullif(btrim(coalesce(_requirements, '')), ''),
    _media_url,
    1,
    now() + make_interval(hours => _hours),
    _prize, 'held', 'open',
    coalesce(_premium_only, false),
    coalesce(_proof_type, 'any'),
    coalesce(_min_trust, 'any'),
    v_tags
  )
  RETURNING id INTO v_id;

  PERFORM set_config('rizz.paw_writer', 'on', true);

  UPDATE public.profiles
  SET paw_balance = paw_balance - _prize
  WHERE id = v_user;

  PERFORM set_config('rizz.paw_writer', 'off', true);

  INSERT INTO public.paw_transactions (user_id, amount, kind, description, reference_id)
  VALUES (v_user, -_prize, 'bounty_escrow', 'Bounty prize held in escrow', v_id::text);

  RETURN jsonb_build_object(
    'status', 'posted',
    'id', v_id,
    'prize', _prize,
    'balance', v_balance - _prize
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_paws_bounty(text, text, text, integer, integer, text, boolean, text, text, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_paws_bounty(text, text, text, integer, integer, text, boolean, text, text, text[])
  TO authenticated;

-- ============ TAKING IT, PREMIUM-ONLY ============
CREATE OR REPLACE FUNCTION public.take_bounty(_drop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_drop public.drops%ROWTYPE;
  v_taker text;
  v_cfg jsonb := public.bounty_escrow_config();
  v_purify timestamptz;
  v_balance integer;
  v_trust jsonb;
  v_level text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a bounty.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.prize_paws <= 0 THEN
    RAISE EXCEPTION 'That bounty carries no Paws prize — just claim it.';
  END IF;
  IF v_drop.creator_id = v_user THEN
    RAISE EXCEPTION 'You cannot take your own bounty.';
  END IF;
  IF v_drop.escrow_state <> 'held' OR v_drop.state IN ('paid', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'This bounty is already settled.';
  END IF;
  IF v_drop.expires_at <= now() THEN
    RAISE EXCEPTION 'This bounty has ended.';
  END IF;
  IF v_drop.assigned_to = v_user THEN
    RETURN jsonb_build_object('status', 'already_taken', 'prize', v_drop.prize_paws);
  END IF;
  IF v_drop.assigned_to IS NOT NULL THEN
    SELECT username INTO v_taker FROM public.profiles WHERE id = v_drop.assigned_to;
    RAISE EXCEPTION '@% is already on this bounty.', coalesce(v_taker, 'someone');
  END IF;

  -- Premium gate. Purify is the app's entitlement, granted only by the Stripe
  -- webhook, so this cannot be self-served from the client.
  SELECT purify_until INTO v_purify FROM public.profiles WHERE id = v_user;
  IF v_purify IS NULL OR v_purify <= now() THEN
    RAISE EXCEPTION 'Taking bounties is a Purify perk. Upgrade to take this one.';
  END IF;

  -- Creator-level block.
  IF EXISTS (
    SELECT 1 FROM public.bounty_blocks
    WHERE creator_id = v_drop.creator_id AND blocked_id = v_user
  ) THEN
    RAISE EXCEPTION 'This poster has blocked you from their bounties.';
  END IF;

  -- Warning block, including warnings with a pending appeal.
  v_trust := public.bounty_trust_stats(v_user);
  IF (v_trust ->> 'warnings')::integer >= (v_cfg ->> 'auto_block_warnings')::integer THEN
    RAISE EXCEPTION 'Your account is blocked from taking bounties after % warnings.',
      v_cfg ->> 'auto_block_warnings';
  END IF;

  -- Minimum trust level set by the poster.
  v_level := v_trust ->> 'level';
  IF v_drop.min_trust = 'trusted' AND v_level = 'new' THEN
    RAISE EXCEPTION 'This bounty is for Trusted takers and above.';
  END IF;
  IF v_drop.min_trust = 'top' AND v_level <> 'top' THEN
    RAISE EXCEPTION 'This bounty is for Top takers only.';
  END IF;

  -- The fee has to be coverable before the work starts, or a hand-back would
  -- be uncollectable.
  SELECT paw_balance INTO v_balance FROM public.profiles WHERE id = v_user;
  IF coalesce(v_balance, 0) < (v_cfg ->> 'cancel_fee')::integer THEN
    RAISE EXCEPTION 'Keep at least % Paws in your wallet to cover the cancellation fee.',
      v_cfg ->> 'cancel_fee';
  END IF;

  UPDATE public.drops
  SET assigned_to = v_user,
      assigned_at = now(),
      state = 'taken',
      claim_count = claim_count + 1
  WHERE id = _drop_id;

  -- Keeps the claim history (and the "claim your first bounty" quest) intact.
  INSERT INTO public.drop_claims (drop_id, user_id)
  VALUES (_drop_id, v_user)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_drop.creator_id, v_user, 'bounty_taken',
    'Your bounty was taken',
    'Someone picked up "' || v_drop.title || '".',
    jsonb_build_object('bounty', _drop_id)
  );

  RETURN jsonb_build_object(
    'status', 'taken',
    'prize', v_drop.prize_paws,
    'review_hours', (v_cfg ->> 'review_hours')::integer,
    'cancel_fee', (v_cfg ->> 'cancel_fee')::integer,
    'fee_recipient', v_cfg ->> 'fee_recipient'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.take_bounty(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_bounty(uuid) TO authenticated;

-- ============ HANDING IT BACK, WITH THE FEE ============
CREATE OR REPLACE FUNCTION public.release_bounty(_drop_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_drop public.drops%ROWTYPE;
  v_cfg jsonb := public.bounty_escrow_config();
  v_fee integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.assigned_to <> v_user THEN
    RAISE EXCEPTION 'Only the member on this bounty can release it.';
  END IF;
  IF v_drop.escrow_state <> 'held' THEN
    RAISE EXCEPTION 'This bounty is already settled.';
  END IF;

  -- The fee is charged before the row is reopened, so a failed charge cannot
  -- leave the bounty free for someone else.
  v_fee := public.charge_bounty_cancel_fee(_drop_id, v_user, 'handback');

  INSERT INTO public.bounty_submissions (drop_id, user_id, note, status)
  VALUES (_drop_id, v_user, nullif(btrim(coalesce(_reason, '')), ''), 'withdrawn');

  UPDATE public.drops
  SET assigned_to = NULL,
      assigned_at = NULL,
      state = 'open',
      review_deadline = NULL,
      released_count = released_count + 1
  WHERE id = _drop_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_drop.creator_id, v_user, 'bounty_released',
    'Your bounty is open again',
    '"' || v_drop.title || '" was released and is back in the pool. ' ||
      v_fee || ' Paws of the cancellation fee went to ' ||
      CASE WHEN (v_cfg ->> 'fee_recipient') = 'platform' THEN 'RIZZ.' ELSE 'you.' END,
    jsonb_build_object('bounty', _drop_id, 'fee', v_fee)
  );

  RETURN jsonb_build_object(
    'status', 'released',
    'fee', v_fee,
    'fee_recipient', v_cfg ->> 'fee_recipient'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_bounty(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_bounty(uuid, text) TO authenticated;

-- ============ MISSED DEADLINES ============
-- Housekeeping, run when the board opens next to settle_expired_bounties().
-- A taker who blows the deadline pays the same fee as one who hands it back,
-- and the bounty returns to Open for somebody else.
CREATE OR REPLACE FUNCTION public.expire_taken_bounties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.drops%ROWTYPE;
  v_count integer := 0;
  v_fee integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.drops
    WHERE prize_paws > 0
      AND escrow_state = 'held'
      AND state = 'taken'
      AND assigned_to IS NOT NULL
      AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    v_fee := public.charge_bounty_cancel_fee(v_row.id, v_row.assigned_to, 'deadline');

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_row.assigned_to, v_row.creator_id, 'bounty_deadline_missed',
      'You missed a bounty deadline',
      'The deadline on "' || v_row.title || '" passed. ' || v_fee ||
        ' Paws were taken as the cancellation fee, and the bounty is open again.',
      jsonb_build_object('bounty', v_row.id, 'fee', v_fee)
    );

    UPDATE public.drops
    SET assigned_to = NULL,
        assigned_at = NULL,
        state = 'open',
        review_deadline = NULL,
        released_count = released_count + 1
    WHERE id = v_row.id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_row.creator_id, v_row.assigned_to, 'bounty_released',
      'Your bounty is open again',
      '"' || v_row.title || '" missed its deadline and is back in the pool.',
      jsonb_build_object('bounty', v_row.id)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_taken_bounties() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_taken_bounties() TO authenticated;

-- ============ WARNINGS ============
CREATE OR REPLACE FUNCTION public.warn_bounty_taker(
  _drop_id uuid,
  _reason text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cfg jsonb := public.bounty_escrow_config();
  v_drop public.drops%ROWTYPE;
  v_warning_id uuid;
  v_active integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  IF coalesce(_reason, '') NOT IN ('no_work', 'fake_proof', 'scam', 'other') THEN
    RAISE EXCEPTION 'Pick a reason for the warning.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.creator_id <> v_user THEN
    RAISE EXCEPTION 'Only the poster can warn the taker.';
  END IF;
  IF v_drop.assigned_to IS NULL THEN
    RAISE EXCEPTION 'Nobody is on this bounty yet.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bounty_warnings
    WHERE drop_id = _drop_id AND creator_id = v_user
  ) THEN
    RAISE EXCEPTION 'You already warned this taker on this bounty.';
  END IF;

  INSERT INTO public.bounty_warnings (drop_id, creator_id, taker_id, reason, note)
  VALUES (
    _drop_id, v_user, v_drop.assigned_to, _reason,
    nullif(btrim(coalesce(_note, '')), '')
  )
  RETURNING id INTO v_warning_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_drop.assigned_to, v_user, 'bounty_warned',
    'You were warned on a bounty',
    'The poster flagged your work on "' || v_drop.title ||
      '". You can appeal this once from your Bounties page.',
    jsonb_build_object('bounty', _drop_id, 'warning', v_warning_id)
  );

  SELECT count(*)::integer INTO v_active
  FROM public.bounty_warnings
  WHERE taker_id = v_drop.assigned_to AND status = 'active';

  -- Announce the block once, on the warning that trips it.
  IF v_active = (v_cfg ->> 'auto_block_warnings')::integer THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_drop.assigned_to, v_user, 'bounty_auto_blocked',
      'Taking bounties is blocked',
      'You now have ' || v_active ||
        ' active warnings, so you cannot take bounties until an appeal succeeds.',
      jsonb_build_object('warnings', v_active)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'warned',
    'warning_id', v_warning_id,
    'warnings', v_active,
    'auto_blocked', v_active >= (v_cfg ->> 'auto_block_warnings')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.warn_bounty_taker(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.warn_bounty_taker(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.appeal_bounty_warning(
  _warning_id uuid,
  _message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_warning public.bounty_warnings%ROWTYPE;
  v_message text := btrim(coalesce(_message, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_warning FROM public.bounty_warnings WHERE id = _warning_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That warning no longer exists.';
  END IF;
  IF v_warning.taker_id <> v_user THEN
    RAISE EXCEPTION 'You can only appeal a warning against you.';
  END IF;
  IF v_warning.status <> 'active' THEN
    RAISE EXCEPTION 'That warning has already been removed.';
  END IF;
  IF v_warning.appeal_status <> 'none' THEN
    RAISE EXCEPTION 'You have already appealed this warning.';
  END IF;
  IF char_length(v_message) < 10 THEN
    RAISE EXCEPTION 'Say a little more about why the warning is wrong.';
  END IF;
  IF char_length(v_message) > 500 THEN
    RAISE EXCEPTION 'Keep the appeal under 500 characters.';
  END IF;

  UPDATE public.bounty_warnings
  SET appeal_status = 'pending',
      appeal_message = v_message,
      appealed_at = now()
  WHERE id = _warning_id;

  -- Every admin gets a row in the review queue.
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  SELECT
    ur.user_id, v_user, 'bounty_appeal_filed',
    'A bounty warning was appealed',
    'A taker disputed a warning. It is waiting in the appeals queue.',
    jsonb_build_object('warning', _warning_id, 'bounty', v_warning.drop_id)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN jsonb_build_object('status', 'pending', 'warning_id', _warning_id);
END;
$$;

REVOKE ALL ON FUNCTION public.appeal_bounty_warning(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appeal_bounty_warning(uuid, text) TO authenticated;

-- Admin decision. `_remove` true upholds the appeal and drops the warning;
-- false rejects it and the warning stays, final.
CREATE OR REPLACE FUNCTION public.resolve_bounty_warning(
  _warning_id uuid,
  _remove boolean,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cfg jsonb := public.bounty_escrow_config();
  v_warning public.bounty_warnings%ROWTYPE;
  v_active integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Only an admin can decide an appeal.';
  END IF;

  SELECT * INTO v_warning FROM public.bounty_warnings WHERE id = _warning_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That warning no longer exists.';
  END IF;
  IF v_warning.appeal_status <> 'pending' THEN
    RAISE EXCEPTION 'That appeal is not waiting for a decision.';
  END IF;

  UPDATE public.bounty_warnings
  SET status = CASE WHEN _remove THEN 'removed' ELSE 'active' END,
      appeal_status = CASE WHEN _remove THEN 'upheld' ELSE 'rejected' END,
      resolution_note = nullif(btrim(coalesce(_note, '')), ''),
      resolved_at = now(),
      resolved_by = v_user
  WHERE id = _warning_id;

  SELECT count(*)::integer INTO v_active
  FROM public.bounty_warnings
  WHERE taker_id = v_warning.taker_id AND status = 'active';

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_warning.taker_id,
    v_user,
    CASE WHEN _remove THEN 'bounty_warning_upheld' ELSE 'bounty_warning_rejected' END,
    CASE WHEN _remove THEN 'Your appeal was upheld' ELSE 'Your appeal was rejected' END,
    CASE
      WHEN _remove THEN
        'The warning was removed. You now have ' || v_active || ' active warning' ||
        CASE WHEN v_active = 1 THEN '' ELSE 's' END ||
        CASE WHEN v_active < (v_cfg ->> 'auto_block_warnings')::integer
          THEN ', so taking bounties is open again.' ELSE '.' END
      ELSE
        'The warning stays on your account. This appeal cannot be sent again.'
    END,
    jsonb_build_object('warning', _warning_id, 'warnings', v_active)
  );

  RETURN jsonb_build_object(
    'status', CASE WHEN _remove THEN 'upheld' ELSE 'rejected' END,
    'warnings', v_active,
    'blocked', v_active >= (v_cfg ->> 'auto_block_warnings')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_bounty_warning(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_bounty_warning(uuid, boolean, text)
  TO authenticated;

-- ============ BLOCKING A CREATOR'S BOUNTIES ============
CREATE OR REPLACE FUNCTION public.block_bounty_user(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  IF _user = v_user THEN
    RAISE EXCEPTION 'You cannot block yourself.';
  END IF;

  INSERT INTO public.bounty_blocks (creator_id, blocked_id)
  VALUES (v_user, _user)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('status', 'blocked', 'user', _user);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_bounty_user(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  DELETE FROM public.bounty_blocks
  WHERE creator_id = v_user AND blocked_id = _user;

  RETURN jsonb_build_object('status', 'unblocked', 'user', _user);
END;
$$;

REVOKE ALL ON FUNCTION public.block_bounty_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_bounty_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.unblock_bounty_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_bounty_user(uuid) TO authenticated;

-- ============ APPEAL QUEUE, FOR THE ADMIN SCREEN ============
CREATE OR REPLACE FUNCTION public.bounty_appeal_queue(_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Only an admin can read the appeal queue.';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(row_to_json(q)::jsonb ORDER BY q.appealed_at)
      FROM (
        SELECT
          w.id,
          w.drop_id,
          w.reason,
          w.note,
          w.appeal_message,
          w.appealed_at,
          w.created_at,
          d.title AS bounty_title,
          d.prize_paws,
          taker.username AS taker_username,
          taker.display_name AS taker_display_name,
          taker.avatar_url AS taker_avatar_url,
          creator.username AS creator_username,
          public.bounty_trust_stats(w.taker_id) AS trust
        FROM public.bounty_warnings w
        JOIN public.drops d ON d.id = w.drop_id
        JOIN public.profiles taker ON taker.id = w.taker_id
        JOIN public.profiles creator ON creator.id = w.creator_id
        WHERE w.appeal_status = 'pending'
        ORDER BY w.appealed_at
        LIMIT greatest(1, least(coalesce(_limit, 50), 200))
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bounty_appeal_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bounty_appeal_queue(integer) TO authenticated;

-- ============ NOTIFY THE BACKEND OF THE NEW SHAPE ============
COMMENT ON TABLE public.bounty_warnings IS
  'Poster warnings against a taker. One per bounty per creator, appealable once.';
COMMENT ON TABLE public.bounty_blocks IS
  'Creator-level blocks: a blocked member cannot take that creator''s bounties.';
COMMENT ON TABLE public.bounty_cancel_log IS
  'Every taker cancellation and missed deadline, with the fee and recipient.';
