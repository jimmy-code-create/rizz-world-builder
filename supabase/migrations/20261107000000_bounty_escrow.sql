-- ============================================================================
-- Bounty escrow: post a task with a Paws prize, the Paws are held, whoever
-- finishes it gets paid on approval.
--
-- Before this migration a bounty was a giveaway: anybody could "claim" it and
-- 25 Paws appeared out of thin air, up to the claim limit. Now a member can put
-- real Paws behind a task. The prize leaves their wallet the moment the bounty
-- goes live (escrow), one person picks it up, they submit their work with
-- proof, and the Paws move to them when the poster approves:
--
--   open ──take──▶ taken ──submit──▶ submitted ──approve──▶ paid
--     ▲              │                   │
--     │              │ release           │ reject  (back to open, escrow stays)
--     └──────────────┘                   │
--   cancel (fee kept)                  cancel (bigger fee)
--
-- The poster can never pocket the prize and keep the work: a submission that is
-- not reviewed inside the review window pays out on its own. The poster can back
-- out, but cancelling costs a fee — twice as much once somebody is already on
-- it — and the fine is written to the Paws ledger like any other receipt.
--
-- Paws stay under the existing wallet rules: `protect_paw_balance()` still owns
-- every write, and only these SECURITY DEFINER functions turn `rizz.paw_writer`
-- on.
-- ============================================================================

-- Every notification this file writes uses a `bounty_*` type, one per event:
-- the inbox icon, the sentence it renders and the deep link to /drops are all
-- keyed off that type, so a generic 'bounty' would land as "reacted to your
-- post". `NOTIF_COPY` in src/routes/_app/notifications.tsx lists them; the
-- bounty test suite fails if the two ever drift apart.

-- ============ DROPS: THE BOUNTY CONTRACT ============
ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS prize_paws integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_note text,
  ADD COLUMN IF NOT EXISTS review_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS reject_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS released_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_prize_nonnegative;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_prize_nonnegative CHECK (prize_paws >= 0);

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_escrow_state_check;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_escrow_state_check
  CHECK (escrow_state IN ('none', 'held', 'paid', 'refunded'));

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_state_check;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_state_check
  CHECK (state IN ('open', 'taken', 'submitted', 'paid', 'cancelled', 'expired'));

ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_escrow_pairing;
ALTER TABLE public.drops
  ADD CONSTRAINT drops_escrow_pairing
  CHECK (
    (prize_paws = 0 AND escrow_state = 'none')
    OR (prize_paws > 0 AND escrow_state <> 'none')
  );

COMMENT ON COLUMN public.drops.prize_paws IS
  'Paws held in escrow for this bounty. 0 means a free open call, paid the legacy 25 Paws on claim.';
COMMENT ON COLUMN public.drops.state IS
  'open → taken → submitted → paid, or cancelled/expired. See the escrow RPCs.';
COMMENT ON COLUMN public.drops.assigned_to IS
  'The one member who picked this bounty up. Escrow bounties are exclusive.';
COMMENT ON COLUMN public.drops.review_deadline IS
  'When an unreviewed submission pays out by itself, so a poster cannot stall forever.';

CREATE INDEX IF NOT EXISTS idx_drops_open_bounties
  ON public.drops (state, expires_at DESC)
  WHERE prize_paws > 0;

CREATE INDEX IF NOT EXISTS idx_drops_assigned
  ON public.drops (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- ============ SUBMISSIONS: THE WORK AND ITS PROOF ============
CREATE TABLE IF NOT EXISTS public.bounty_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  links text[] NOT NULL DEFAULT '{}',
  media_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_submissions DROP CONSTRAINT IF EXISTS bounty_submissions_status_check;
ALTER TABLE public.bounty_submissions
  ADD CONSTRAINT bounty_submissions_status_check
  CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn'));

CREATE INDEX IF NOT EXISTS idx_bounty_submissions_drop
  ON public.bounty_submissions (drop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bounty_submissions_user
  ON public.bounty_submissions (user_id, created_at DESC);

ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY;

-- Proof is readable by the two people it concerns: whoever did the work and
-- whoever is paying for it. Nobody else can read somebody's submitted work.
DROP POLICY IF EXISTS "bounty submissions for the pair" ON public.bounty_submissions;
CREATE POLICY "bounty submissions for the pair"
  ON public.bounty_submissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT creator_id FROM public.drops WHERE id = drop_id)
  );

-- No INSERT/UPDATE/DELETE policies: submissions only move through the RPCs
-- below, which re-check who is allowed to do what.

-- ============ REPUTATION COUNTERS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounties_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounties_cancelled integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bounties_nonnegative;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bounties_nonnegative
  CHECK (bounties_completed >= 0 AND bounties_cancelled >= 0);

COMMENT ON COLUMN public.profiles.bounties_completed IS
  'Escrow bounties this member was paid for. Public, so posters can see track record.';
COMMENT ON COLUMN public.profiles.bounties_cancelled IS
  'Escrow bounties this member posted and then cancelled (fees paid are in the ledger).';

-- ============ RULES, IN ONE PLACE ============
-- The UI reads these numbers instead of hard-coding its own: the copy, the fee
-- shown in the cancel warning and the amount the database charges can never
-- drift apart.
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
    'max_media', 4
  )
$$;

GRANT EXECUTE ON FUNCTION public.bounty_escrow_config() TO anon, authenticated;

-- The fine for backing out. Doubled once somebody is already on the bounty:
-- cancelling a taken bounty wastes the worker's time, so it costs more.
CREATE OR REPLACE FUNCTION public.bounty_fee(_prize integer, _taken boolean DEFAULT false)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(
    _prize,
    GREATEST(
      (public.bounty_escrow_config() ->> 'fee_min')::integer,
      CEIL(_prize * (public.bounty_escrow_config() ->> 'fee_percent')::numeric / 100)::integer
    ) * (CASE WHEN _taken THEN (public.bounty_escrow_config() ->> 'taken_fee_multiplier')::integer ELSE 1 END)
  )
$$;

GRANT EXECUTE ON FUNCTION public.bounty_fee(integer, boolean) TO anon, authenticated;

-- ============ POSTING ============
CREATE OR REPLACE FUNCTION public.post_paws_bounty(
  _title text,
  _description text,
  _requirements text,
  _prize integer,
  _hours integer,
  _media_url text DEFAULT NULL
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
    claim_limit, expires_at, prize_paws, escrow_state, state
  )
  VALUES (
    v_user, v_title,
    nullif(btrim(coalesce(_description, '')), ''),
    nullif(btrim(coalesce(_requirements, '')), ''),
    _media_url,
    1,
    now() + make_interval(hours => _hours),
    _prize, 'held', 'open'
  )
  RETURNING id INTO v_id;

  PERFORM set_config('rizz.paw_writer', 'on', true);
  UPDATE public.profiles
  SET paw_balance = paw_balance - _prize
  WHERE id = v_user
  RETURNING paw_balance INTO v_balance;
  PERFORM set_config('rizz.paw_writer', 'off', true);

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  VALUES (v_user, -_prize, 'bounty_escrow', v_id::text, v_title);

  RETURN jsonb_build_object(
    'status', 'posted',
    'id', v_id,
    'prize', _prize,
    'balance', coalesce(v_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_paws_bounty(text, text, text, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_paws_bounty(text, text, text, integer, integer, text)
  TO authenticated;

-- ============ TAKING IT ============
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
    'review_hours', (public.bounty_escrow_config() ->> 'review_hours')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.take_bounty(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_bounty(uuid) TO authenticated;

-- Hand it back without finishing: the bounty returns to the pool for someone
-- else. Free, but counted, so a repeated grab-and-drop is visible.
CREATE OR REPLACE FUNCTION public.release_bounty(_drop_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_drop public.drops%ROWTYPE;
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
    '"' || v_drop.title || '" was released and is back in the pool.',
    jsonb_build_object('bounty', _drop_id)
  );

  RETURN jsonb_build_object('status', 'released');
END;
$$;

REVOKE ALL ON FUNCTION public.release_bounty(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_bounty(uuid, text) TO authenticated;

-- ============ SUBMITTING THE WORK ============
CREATE OR REPLACE FUNCTION public.submit_bounty_proof(
  _drop_id uuid,
  _note text,
  _links text[] DEFAULT '{}',
  _media text[] DEFAULT '{}'
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
  v_deadline timestamptz;
  v_links text[] := coalesce(_links, '{}');
  v_media text[] := coalesce(_media, '{}');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.escrow_state <> 'held' THEN
    RAISE EXCEPTION 'This bounty is already settled.';
  END IF;
  IF v_drop.assigned_to <> v_user THEN
    RAISE EXCEPTION 'Only the member on this bounty can submit it.';
  END IF;
  IF v_drop.state = 'submitted' THEN
    RAISE EXCEPTION 'That submission is already waiting for review.';
  END IF;
  -- Escrow bounties are exclusive and, unlike open calls, keep their deadline
  -- strict: taking one past `expires_at` is impossible, so this check only
  -- fires when a release/expiry raced the submit.
  IF v_drop.expires_at <= now() THEN
    RAISE EXCEPTION 'The deadline for this bounty has passed.';
  END IF;
  IF coalesce(btrim(_note), '') = '' AND array_length(v_links, 1) IS NULL AND array_length(v_media, 1) IS NULL THEN
    RAISE EXCEPTION 'Add a note, a link or a file so the poster can review it.';
  END IF;
  IF char_length(coalesce(_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the submission note under 2000 characters.';
  END IF;
  IF coalesce(array_length(v_links, 1), 0) > (v_cfg ->> 'max_links')::integer THEN
    RAISE EXCEPTION 'Up to % links per submission.', v_cfg ->> 'max_links';
  END IF;
  IF coalesce(array_length(v_media, 1), 0) > (v_cfg ->> 'max_media')::integer THEN
    RAISE EXCEPTION 'Up to % files per submission.', v_cfg ->> 'max_media';
  END IF;

  v_deadline := now() + make_interval(hours => (v_cfg ->> 'review_hours')::integer);

  INSERT INTO public.bounty_submissions (drop_id, user_id, note, links, media_urls, status)
  VALUES (
    _drop_id, v_user,
    nullif(btrim(coalesce(_note, '')), ''),
    v_links, v_media, 'submitted'
  );

  UPDATE public.drops
  SET state = 'submitted',
      submission_note = nullif(btrim(coalesce(_note, '')), ''),
      review_deadline = v_deadline
  WHERE id = _drop_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_drop.creator_id, v_user, 'bounty_submitted',
    'Work submitted for review',
    '"' || v_drop.title || '" is waiting for your yes or no.',
    jsonb_build_object('bounty', _drop_id)
  );

  RETURN jsonb_build_object(
    'status', 'submitted',
    'review_deadline', v_deadline,
    'review_hours', (v_cfg ->> 'review_hours')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_bounty_proof(uuid, text, text[], text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_bounty_proof(uuid, text, text[], text[])
  TO authenticated;

-- ============ REVIEWING IT ============
-- The one money path that is not the poster's decision: pays the worker once
-- the review window has elapsed, so nobody can sit on a finished bounty.
CREATE OR REPLACE FUNCTION public.payout_bounty(_drop_id uuid, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drop public.drops%ROWTYPE;
  v_sub public.bounty_submissions%ROWTYPE;
  v_worker uuid;
  v_balance integer;
BEGIN
  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.escrow_state <> 'held' THEN
    RAISE EXCEPTION 'This bounty is already settled.';
  END IF;

  SELECT * INTO v_sub
  FROM public.bounty_submissions
  WHERE drop_id = _drop_id AND status = 'submitted'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no submission waiting on this bounty.';
  END IF;

  v_worker := v_sub.user_id;

  PERFORM set_config('rizz.paw_writer', 'on', true);
  UPDATE public.profiles
  SET paw_balance = paw_balance + v_drop.prize_paws,
      paw_earned = paw_earned + v_drop.prize_paws,
      bounties_completed = bounties_completed + 1
  WHERE id = v_worker
  RETURNING paw_balance INTO v_balance;
  PERFORM set_config('rizz.paw_writer', 'off', true);

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  VALUES (v_worker, v_drop.prize_paws, 'bounty_payout', _drop_id::text, v_drop.title);

  UPDATE public.bounty_submissions
  SET status = 'approved',
      review_note = _note,
      reviewed_at = now(),
      reviewed_by = v_drop.creator_id
  WHERE id = v_sub.id;

  UPDATE public.drops
  SET state = 'paid',
      escrow_state = 'paid',
      review_deadline = NULL
  WHERE id = _drop_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_worker, v_drop.creator_id, 'bounty_paid',
    'Bounty paid',
    'You earned ' || v_drop.prize_paws || ' Paws for "' || v_drop.title || '".',
    jsonb_build_object('bounty', _drop_id)
  );

  RETURN jsonb_build_object(
    'status', 'paid',
    'payout', v_drop.prize_paws,
    'worker_balance', coalesce(v_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payout_bounty(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.review_bounty_submission(
  _drop_id uuid,
  _approve boolean,
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
  v_sub public.bounty_submissions%ROWTYPE;
  v_note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.creator_id <> v_user THEN
    RAISE EXCEPTION 'Only the member who posted this bounty can review it.';
  END IF;
  IF v_drop.escrow_state <> 'held' OR v_drop.state <> 'submitted' THEN
    RAISE EXCEPTION 'There is nothing to review on this bounty.';
  END IF;

  SELECT * INTO v_sub
  FROM public.bounty_submissions
  WHERE drop_id = _drop_id AND status = 'submitted'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no submission waiting on this bounty.';
  END IF;

  IF _approve THEN
    -- The wallet work lives in payout_bounty so approval and the automatic
    -- release after the review window pay out through the exact same path.
    RETURN public.payout_bounty(_drop_id, v_note);
  END IF;

  IF v_drop.reject_count >= (v_cfg ->> 'max_rejections')::integer THEN
    RAISE EXCEPTION
      'This bounty has used its % reviews — approve it or cancel it.', v_cfg ->> 'max_rejections';
  END IF;

  UPDATE public.bounty_submissions
  SET status = 'rejected',
      review_note = v_note,
      reviewed_at = now(),
      reviewed_by = v_user
  WHERE id = v_sub.id;

  -- A rejection does not end the bounty: the Paws stay in escrow and it goes
  -- back in the pool so somebody else (or the same member, better prepared)
  -- can take it.
  UPDATE public.drops
  SET state = 'open',
      assigned_to = NULL,
      assigned_at = NULL,
      review_deadline = NULL,
      reject_count = reject_count + 1
  WHERE id = _drop_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_sub.user_id, v_user, 'bounty_rejected',
    'Submission not accepted',
    coalesce(v_note, 'The poster asked for more on "' || v_drop.title || '". It is open again.'),
    jsonb_build_object('bounty', _drop_id)
  );

  RETURN jsonb_build_object(
    'status', 'rejected',
    'reject_count', v_drop.reject_count + 1,
    'max_rejections', (v_cfg ->> 'max_rejections')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_bounty_submission(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_bounty_submission(uuid, boolean, text)
  TO authenticated;

-- Called by the worker once the review window has passed, and by the page load
-- sweep for every bounty in the same state. Anyone signed in may trigger it:
-- the payout is not a favour the poster gets to withhold.
CREATE OR REPLACE FUNCTION public.release_overdue_bounty_payout(_drop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drop public.drops%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.state <> 'submitted' OR v_drop.review_deadline IS NULL THEN
    RAISE EXCEPTION 'This bounty is not waiting on a review.';
  END IF;
  IF v_drop.review_deadline > now() THEN
    RAISE EXCEPTION 'The poster still has time to review this.';
  END IF;

  RETURN public.payout_bounty(_drop_id, 'Auto-paid: the review window passed without a decision.');
END;
$$;

REVOKE ALL ON FUNCTION public.release_overdue_bounty_payout(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_overdue_bounty_payout(uuid) TO authenticated;

-- ============ CALLING IT OFF ============
CREATE OR REPLACE FUNCTION public.cancel_bounty(_drop_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_drop public.drops%ROWTYPE;
  v_taken boolean;
  v_fee integer;
  v_refund integer;
  v_balance integer;
  v_reason text := nullif(btrim(coalesce(_reason, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT * INTO v_drop FROM public.drops WHERE id = _drop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.creator_id <> v_user THEN
    RAISE EXCEPTION 'Only the member who posted this bounty can cancel it.';
  END IF;
  IF v_drop.escrow_state <> 'held' THEN
    RAISE EXCEPTION 'This bounty is already settled.';
  END IF;

  v_taken := v_drop.state IN ('taken', 'submitted');
  v_fee := public.bounty_fee(v_drop.prize_paws, v_taken);
  v_refund := greatest(v_drop.prize_paws - v_fee, 0);

  PERFORM set_config('rizz.paw_writer', 'on', true);
  UPDATE public.profiles
  SET paw_balance = paw_balance + v_refund,
      bounties_cancelled = bounties_cancelled + 1
  WHERE id = v_user
  RETURNING paw_balance INTO v_balance;
  PERFORM set_config('rizz.paw_writer', 'off', true);

  IF v_refund > 0 THEN
    INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
    VALUES (v_user, v_refund, 'bounty_refund', _drop_id::text,
      'Cancelled: ' || v_drop.title);
  END IF;
  IF v_fee > 0 THEN
    INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
    VALUES (v_user, -v_fee, 'bounty_fine', _drop_id::text,
      CASE WHEN v_taken THEN 'Cancellation fee (bounty was taken)' ELSE 'Cancellation fee' END);
  END IF;

  UPDATE public.drops
  SET state = 'cancelled',
      escrow_state = 'refunded',
      cancelled_at = now(),
      cancel_reason = v_reason,
      review_deadline = NULL,
      assigned_to = NULL,
      assigned_at = NULL
  WHERE id = _drop_id;

  IF v_drop.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_drop.assigned_to, v_user, 'bounty_cancelled',
      'Bounty cancelled',
      coalesce(v_reason, '"' || v_drop.title || '" was cancelled.'),
      jsonb_build_object('bounty', _drop_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'cancelled',
    'fee', v_fee,
    'refund', v_refund,
    'balance', coalesce(v_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_bounty(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bounty(uuid, text) TO authenticated;

-- ============ HOUSEKEEPING ============
-- An open bounty that ran out of time returns the Paws to the poster, with no
-- fine: nobody was blocked and nothing was cancelled. Safe to call on every
-- page load — it only touches bounties that are past their deadline.
CREATE OR REPLACE FUNCTION public.settle_expired_bounties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drop public.drops%ROWTYPE;
  v_settled integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_drop IN
    SELECT * FROM public.drops
    WHERE prize_paws > 0
      AND escrow_state = 'held'
      AND state = 'open'
      AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 50
    FOR UPDATE
  LOOP
    PERFORM set_config('rizz.paw_writer', 'on', true);
    UPDATE public.profiles
    SET paw_balance = paw_balance + v_drop.prize_paws
    WHERE id = v_drop.creator_id;
    PERFORM set_config('rizz.paw_writer', 'off', true);

    INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
    VALUES (v_drop.creator_id, v_drop.prize_paws, 'bounty_refund', v_drop.id::text,
      'Expired: ' || v_drop.title);

    UPDATE public.drops
    SET state = 'expired',
        escrow_state = 'refunded'
    WHERE id = v_drop.id;

    v_settled := v_settled + 1;
  END LOOP;

  RETURN v_settled;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_expired_bounties() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_expired_bounties() TO authenticated;

-- ============ LEGACY BOUNTIES KEEP WORKING ============
-- A bounty with no prize is still an open call: claim it, get the flat reward.
-- A prize bounty pays on approval only, so the claim trigger must not pay it.
CREATE OR REPLACE FUNCTION public.reward_bounty_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.drops
    WHERE id = NEW.drop_id AND prize_paws > 0
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.award_paws(
    NEW.user_id,
    public.bounty_paw_reward(),
    'bounty_claim',
    NEW.drop_id::text,
    'Bounty claim'
  );
  RETURN NEW;
END;
$$;

-- ...and the claim RPC must not be a back door into a prize bounty either.
CREATE OR REPLACE FUNCTION public.validate_bounty_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drop public.drops%ROWTYPE;
BEGIN
  SELECT * INTO v_drop
  FROM public.drops
  WHERE id = NEW.drop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bounty no longer exists.';
  END IF;
  IF v_drop.prize_paws > 0 THEN
    RAISE EXCEPTION 'Take that bounty from the bounty page — the Paws are held in escrow.';
  END IF;
  IF v_drop.creator_id = NEW.user_id THEN
    RAISE EXCEPTION 'You cannot claim your own bounty.';
  END IF;
  IF v_drop.expires_at <= now() THEN
    RAISE EXCEPTION 'This bounty has ended.';
  END IF;
  IF v_drop.claim_count >= v_drop.claim_limit THEN
    RAISE EXCEPTION 'This bounty is sold out.';
  END IF;

  RETURN NEW;
END;
$$;
