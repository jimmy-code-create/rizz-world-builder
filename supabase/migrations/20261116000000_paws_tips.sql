-- Paws tips: one member hands another member Paws, in-app only.
--
-- The wallet is server-owned (see 20261027000000_paws_effects_shop.sql): a
-- browser can never write `paw_balance` directly, so a tip has to be one
-- SECURITY DEFINER function that debits and credits inside a single statement
-- pair. Both sides get a `paw_transactions` row, which is what makes the tip
-- visible in the ledger instead of appearing from nowhere.

CREATE OR REPLACE FUNCTION public.send_paws_tip(
  _to uuid,
  _amount integer,
  _note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from uuid := auth.uid();
  v_balance integer;
  v_note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Sign in to send Paws.';
  END IF;
  IF _to IS NULL THEN
    RAISE EXCEPTION 'Pick someone to tip.';
  END IF;
  IF _to = v_from THEN
    RAISE EXCEPTION 'You cannot tip yourself.';
  END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 100000 THEN
    RAISE EXCEPTION 'Tips must be between 1 and 100,000 Paws.';
  END IF;

  PERFORM set_config('rizz.paw_writer', 'on', true);

  -- One conditional debit: no read-then-write window for two tips to race.
  UPDATE public.profiles
  SET paw_balance = paw_balance - _amount,
      updated_at = now()
  WHERE id = v_from
    AND paw_balance >= _amount
  RETURNING paw_balance INTO v_balance;

  IF NOT FOUND THEN
    PERFORM set_config('rizz.paw_writer', 'off', true);
    RAISE EXCEPTION 'Not enough Paws for that tip.';
  END IF;

  UPDATE public.profiles
  SET paw_balance = paw_balance + _amount,
      updated_at = now()
  WHERE id = _to;

  IF NOT FOUND THEN
    PERFORM set_config('rizz.paw_writer', 'off', true);
    RAISE EXCEPTION 'That member no longer exists.';
  END IF;

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  VALUES (v_from, -_amount, 'tip_sent', _to::text, v_note);

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  VALUES (_to, _amount, 'tip_received', v_from::text, v_note);

  PERFORM set_config('rizz.paw_writer', 'off', true);
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.send_paws_tip(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_paws_tip(uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.send_paws_tip(uuid, integer, text) IS
  'Moves Paws between two members atomically and writes both ledger rows. In-app only; no cash value.';
