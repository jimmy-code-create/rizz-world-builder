-- ============ BOUNTY SECURITY HARDENING ============
-- Closes the two gaps found in the feature security review:
--
--   1. `drops` accepted any row from the browser as long as `creator_id` was
--      the caller. A client could insert `prize_paws > 0, escrow_state = 'held'`
--      without paying, then let the normal payout path mint Paws. Only the
--      `post_paws_bounty()` RPC may create an escrowed bounty now; the browser
--      may still create a free open call directly.
--   2. Proof links were stored as sent. A `javascript:` URL would run in the
--      poster's session when clicked from the review card. Links and media must
--      be ordinary http(s) URLs with sane lengths.
--
-- The escrow ledger guard below is defense in depth: even if a funded-looking
-- row exists from an older client, paying or refunding it requires the matching
-- `bounty_escrow` ledger entry written by `post_paws_bounty()`.

-- ============ FREE OPEN CALLS ONLY FROM THE BROWSER ============
DROP POLICY IF EXISTS "users create drops" ON public.drops;
DROP POLICY IF EXISTS "users create free open drops" ON public.drops;
CREATE POLICY "users create free open drops"
  ON public.drops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creator_id
    AND prize_paws = 0
    AND escrow_state = 'none'
    AND state = 'open'
    AND assigned_to IS NULL
    AND review_deadline IS NULL
  );

-- ============ ESCROW MUST HAVE BEEN FUNDED ============
CREATE OR REPLACE FUNCTION public.require_funded_bounty_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only the two settled states can move money out of a bounty. The escrow
  -- ledger row is written by post_paws_bounty() with the exact negative prize.
  IF NEW.prize_paws > 0
     AND OLD.escrow_state = 'held'
     AND NEW.escrow_state IN ('paid', 'refunded')
     AND NOT EXISTS (
       SELECT 1
       FROM public.paw_transactions t
       WHERE t.reference_id = NEW.id::text
         AND t.user_id = NEW.creator_id
         AND t.kind = 'bounty_escrow'
         AND t.amount = -NEW.prize_paws
     )
  THEN
    RAISE EXCEPTION 'This bounty has no funded escrow.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_funded_bounty_escrow_t ON public.drops;
CREATE TRIGGER require_funded_bounty_escrow_t
  AFTER UPDATE OF escrow_state ON public.drops
  FOR EACH ROW
  WHEN (OLD.escrow_state = 'held' AND NEW.escrow_state IN ('paid', 'refunded'))
  EXECUTE FUNCTION public.require_funded_bounty_escrow();

REVOKE ALL ON FUNCTION public.require_funded_bounty_escrow()
  FROM PUBLIC, anon, authenticated;

-- ============ PROOF URLS ============
CREATE OR REPLACE FUNCTION public.validate_bounty_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF char_length(coalesce(NEW.note, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the submission note under 2000 characters.';
  END IF;
  IF coalesce(array_length(NEW.links, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Up to five links per submission.';
  END IF;
  IF coalesce(array_length(NEW.media_urls, 1), 0) > 4 THEN
    RAISE EXCEPTION 'Up to four files per submission.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(NEW.links, '{}'::text[])) AS t(link)
    WHERE char_length(link) > 2048
       OR link !~* '^https?://'
  ) THEN
    RAISE EXCEPTION 'Proof links must be http(s) URLs.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(NEW.media_urls, '{}'::text[])) AS t(media)
    WHERE char_length(media) > 2048
       OR media !~* '^https?://'
  ) THEN
    RAISE EXCEPTION 'Proof files must be http(s) URLs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_bounty_submission_t ON public.bounty_submissions;
CREATE TRIGGER validate_bounty_submission_t
  BEFORE INSERT ON public.bounty_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bounty_submission();

-- A warning note is shown in the taker's notifications and the admin queue;
-- cap it and the admin's resolution note so neither can be used as a text sink.
CREATE OR REPLACE FUNCTION public.validate_bounty_warning_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND char_length(coalesce(NEW.note, '')) > 1000 THEN
    RAISE EXCEPTION 'Keep the warning note under 1000 characters.';
  END IF;
  IF char_length(coalesce(NEW.resolution_note, '')) > 1000 THEN
    RAISE EXCEPTION 'Keep the resolution note under 1000 characters.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_bounty_warning_text_t ON public.bounty_warnings;
CREATE TRIGGER validate_bounty_warning_text_t
  BEFORE INSERT OR UPDATE ON public.bounty_warnings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bounty_warning_text();

-- ============ POST COPY BOUNDS ============
-- The form already caps these; the RPC is the trust boundary, so cap it there
-- too. This only applies to new escrow bounties and leaves legacy open calls
-- untouched.
CREATE OR REPLACE FUNCTION public.validate_bounty_copy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.prize_paws > 0 THEN
    IF char_length(coalesce(NEW.description, '')) > 4000 THEN
      RAISE EXCEPTION 'Keep the description under 4000 characters.';
    END IF;
    IF char_length(coalesce(NEW.requirements, '')) > 4000 THEN
      RAISE EXCEPTION 'Keep the requirements under 4000 characters.';
    END IF;
    IF NEW.media_url IS NOT NULL
       AND (char_length(NEW.media_url) > 2048 OR NEW.media_url !~* '^https?://') THEN
      RAISE EXCEPTION 'Bounty media must be an http(s) URL.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_bounty_copy_t ON public.drops;
CREATE TRIGGER validate_bounty_copy_t
  BEFORE INSERT ON public.drops
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bounty_copy();

-- Keep the API cache in step with the replaced functions.
NOTIFY pgrst, 'reload schema';
