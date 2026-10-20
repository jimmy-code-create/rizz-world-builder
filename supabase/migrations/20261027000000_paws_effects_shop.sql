-- Paws wallet, bounty rewards, and the cinematic effect shop.
--
-- Paws are the RIZZ currency. They are earned only through activity the server
-- can verify (today: claiming a bounty) and spent only through the shop RPCs
-- below. Balances and owned effects must never be writable straight from the
-- browser, so the client keeps its update policies for ordinary profile fields
-- but loses direct INSERT/UPDATE access to user_profile_effects.
--
-- The Web Slinger clip is supplied third-party footage. Its `rights_review`
-- flag stays true until the operator clears the rights in the database; the
-- purchase RPC refuses to sell an effect in review. The other three clips are
-- unlocked normally.

-- ============ PAWS WALLET ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paw_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paw_earned integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_paw_balance_nonnegative CHECK (paw_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_paw_earned_nonnegative CHECK (paw_earned >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.paw_balance IS
  'Spendable Paws. Changes only through award_paws() and purchase_profile_effect().';
COMMENT ON COLUMN public.profiles.paw_earned IS
  'Lifetime Paws earned. Never decreases when Paws are spent.';

-- A normal profile update must not be able to mint or drain Paws. RPCs set the
-- transaction-local `rizz.paw_writer` flag before touching the wallet.
CREATE OR REPLACE FUNCTION public.protect_paw_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.paw_balance IS DISTINCT FROM 0
        OR NEW.paw_earned IS DISTINCT FROM 0)
       AND coalesce(current_setting('rizz.paw_writer', true), '') <> 'on'
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Paw balance can only start at zero.';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.paw_balance IS DISTINCT FROM OLD.paw_balance
      OR NEW.paw_earned IS DISTINCT FROM OLD.paw_earned)
     AND coalesce(current_setting('rizz.paw_writer', true), '') <> 'on'
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Paw balance can only change through RIZZ rewards or purchases.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_paw_balance_t ON public.profiles;
CREATE TRIGGER protect_paw_balance_t
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_paw_balance();

CREATE TABLE IF NOT EXISTS public.paw_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  kind text NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paw_transactions_user_time
  ON public.paw_transactions (user_id, created_at DESC);

ALTER TABLE public.paw_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paw ledger owner read" ON public.paw_transactions;
CREATE POLICY "paw ledger owner read"
  ON public.paw_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Internal wallet mutation. The browser must not call this directly; reward
-- triggers and the purchase RPC call it inside a SECURITY DEFINER context.
CREATE OR REPLACE FUNCTION public.award_paws(
  _user uuid,
  _amount integer,
  _kind text,
  _reference text DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'A member is required to award Paws.';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Paw awards must be positive.';
  END IF;

  PERFORM set_config('rizz.paw_writer', 'on', true);

  UPDATE public.profiles
  SET paw_balance = paw_balance + _amount,
      paw_earned = paw_earned + _amount,
      updated_at = now()
  WHERE id = _user
  RETURNING paw_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
  VALUES (_user, _amount, _kind, _reference, _description);

  PERFORM set_config('rizz.paw_writer', 'off', true);
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.award_paws(uuid, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_paws(uuid, integer, text, text, text)
  TO service_role;

-- ============ EFFECT CATALOGUE PRICING ============
ALTER TABLE public.profile_effects
  ADD COLUMN IF NOT EXISTS paw_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rights_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

DO $$
BEGIN
  ALTER TABLE public.profile_effects
    ADD CONSTRAINT profile_effects_paw_price_nonnegative CHECK (paw_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.profile_effects
    ADD CONSTRAINT profile_effects_price_cents_nonnegative CHECK (price_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing rows already carried a Rizz price. Treat that number as the Paws
-- price so no catalogue item silently becomes free.
UPDATE public.profile_effects
SET paw_price = unlock_rizz
WHERE paw_price = 0
  AND unlock_rizz > 0;

COMMENT ON COLUMN public.profile_effects.paw_price IS
  'One-time Paws price. Checked by purchase_profile_effect(), never trusted from the client.';
COMMENT ON COLUMN public.profile_effects.price_cents IS
  'Optional card price in cents. Card fulfilment still needs an operator webhook.';
COMMENT ON COLUMN public.profile_effects.rights_review IS
  'When true, purchase_profile_effect() refuses to sell the effect.';

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, paw_price, price_cents, rights_review, sort_order, preview_color)
VALUES
  ('fx-web-slinger', 'Web Slinger',
   'A masked web slinger drops in, lands on a glowing portal, and holds the frame in red-and-blue light.',
   'profile_effect', 'mythic', 1800, 1800, 499, true, 10, '#e8253f'),
  ('fx-sakura-bloom', 'Sakura Bloom',
   'A slow drift of cherry blossoms around a delicate rose trail.',
   'avatar_decoration', 'legendary', 1200, 1200, 299, false, 20, '#fb7185'),
  ('fx-arcane-nexus', 'Arcane Nexus',
   'Counter-rotating glyph rings, arcane sigils and drifting starlight.',
   'avatar_decoration', 'mythic', 1500, 1500, 399, false, 30, '#a855f7'),
  ('fx-sakura-storm', 'Sakura Storm',
   'A denser cherry-blossom storm around a brighter rose trail.',
   'avatar_decoration', 'epic', 900, 900, 349, false, 40, '#f472b6')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  rarity = EXCLUDED.rarity,
  unlock_rizz = EXCLUDED.unlock_rizz,
  paw_price = EXCLUDED.paw_price,
  price_cents = EXCLUDED.price_cents,
  rights_review = EXCLUDED.rights_review,
  sort_order = EXCLUDED.sort_order,
  preview_color = EXCLUDED.preview_color;

-- Direct writes made the old cosmetic system free for anyone who could call
-- PostgREST. Keep reads, and route every acquisition/equip through the RPCs.
DROP POLICY IF EXISTS "users acquire own effects" ON public.user_profile_effects;
DROP POLICY IF EXISTS "users equip own effects" ON public.user_profile_effects;
DROP POLICY IF EXISTS "users drop own effects" ON public.user_profile_effects;

CREATE OR REPLACE FUNCTION public.purchase_profile_effect(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_effect public.profile_effects%ROWTYPE;
  v_balance integer;
  v_owned boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to unlock effects.';
  END IF;

  SELECT * INTO v_effect
  FROM public.profile_effects
  WHERE slug = _slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That effect does not exist.';
  END IF;

  -- Lock the wallet before checking ownership. Two quick taps on the same
  -- effect then serialise: the second call sees the first purchase instead of
  -- charging twice and failing on the ownership primary key.
  SELECT paw_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profile_effects
    WHERE user_id = v_user AND effect_id = v_effect.id
  ) INTO v_owned;

  IF v_owned THEN
    RETURN jsonb_build_object(
      'status', 'owned',
      'balance', coalesce(v_balance, 0),
      'effect_id', v_effect.id
    );
  END IF;

  IF v_effect.rights_review THEN
    RAISE EXCEPTION 'This effect is still in rights review and cannot be sold.';
  END IF;

  IF coalesce(v_balance, 0) < v_effect.paw_price THEN
    RAISE EXCEPTION 'Not enough Paws. You need % more.',
      v_effect.paw_price - coalesce(v_balance, 0);
  END IF;

  PERFORM set_config('rizz.paw_writer', 'on', true);

  UPDATE public.profiles
  SET paw_balance = paw_balance - v_effect.paw_price,
      updated_at = now()
  WHERE id = v_user
  RETURNING paw_balance INTO v_balance;

  IF v_effect.paw_price > 0 THEN
    INSERT INTO public.paw_transactions (user_id, amount, kind, reference_id, description)
    VALUES (v_user, -v_effect.paw_price, 'effect_purchase', v_effect.slug, v_effect.name);
  END IF;

  -- Buying applies the look immediately. Only one effect of each type can be
  -- worn at a time, so clear the previous one first.
  UPDATE public.user_profile_effects AS upe
  SET equipped = false
  FROM public.profile_effects AS pe
  WHERE upe.effect_id = pe.id
    AND upe.user_id = v_user
    AND pe.type = v_effect.type;

  INSERT INTO public.user_profile_effects (user_id, effect_id, equipped)
  VALUES (v_user, v_effect.id, true)
  ON CONFLICT (user_id, effect_id) DO UPDATE SET equipped = true;

  PERFORM set_config('rizz.paw_writer', 'off', true);

  RETURN jsonb_build_object(
    'status', 'purchased',
    'balance', v_balance,
    'effect_id', v_effect.id,
    'equipped', true
  );
END;
$$;

-- Called only by a verified card-fulfilment webhook using the service role.
-- It grants ownership without spending Paws; the Paws shop never calls it.
CREATE OR REPLACE FUNCTION public.grant_profile_effect(_user uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.profile_effects%ROWTYPE;
  v_owned boolean;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'A member is required to grant an effect.';
  END IF;

  SELECT * INTO v_effect
  FROM public.profile_effects
  WHERE slug = _slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That effect does not exist.';
  END IF;

  IF v_effect.rights_review THEN
    RAISE EXCEPTION 'This effect is still in rights review and cannot be sold.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user) THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profile_effects
    WHERE user_id = _user AND effect_id = v_effect.id
  ) INTO v_owned;

  IF v_owned THEN
    RETURN jsonb_build_object('status', 'owned', 'effect_id', v_effect.id);
  END IF;

  UPDATE public.user_profile_effects AS upe
  SET equipped = false
  FROM public.profile_effects AS pe
  WHERE upe.effect_id = pe.id
    AND upe.user_id = _user
    AND pe.type = v_effect.type;

  INSERT INTO public.user_profile_effects (user_id, effect_id, equipped)
  VALUES (_user, v_effect.id, true)
  ON CONFLICT (user_id, effect_id) DO UPDATE SET equipped = true;

  RETURN jsonb_build_object(
    'status', 'granted',
    'effect_id', v_effect.id,
    'equipped', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_profile_effect(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_effect public.profile_effects%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply effects.';
  END IF;

  SELECT * INTO v_effect
  FROM public.profile_effects
  WHERE slug = _slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That effect does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profile_effects
    WHERE user_id = v_user AND effect_id = v_effect.id
  ) THEN
    RAISE EXCEPTION 'Unlock this effect before applying it.';
  END IF;

  UPDATE public.user_profile_effects AS upe
  SET equipped = false
  FROM public.profile_effects AS pe
  WHERE upe.effect_id = pe.id
    AND upe.user_id = v_user
    AND pe.type = v_effect.type;

  UPDATE public.user_profile_effects
  SET equipped = true
  WHERE user_id = v_user AND effect_id = v_effect.id;

  RETURN jsonb_build_object('status', 'equipped', 'type', v_effect.type, 'slug', v_effect.slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_profile_effect(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_effect_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to change effects.';
  END IF;

  SELECT id INTO v_effect_id
  FROM public.profile_effects
  WHERE slug = _slug;

  IF v_effect_id IS NULL THEN
    RAISE EXCEPTION 'That effect does not exist.';
  END IF;

  UPDATE public.user_profile_effects
  SET equipped = false
  WHERE user_id = v_user AND effect_id = v_effect_id;

  RETURN jsonb_build_object('status', 'unequipped', 'slug', _slug);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_profile_effect(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_profile_effect(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_profile_effect(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unequip_profile_effect(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_profile_effect(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_profile_effect(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.equip_profile_effect(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unequip_profile_effect(text) TO authenticated;

-- ============ BOUNTY REWARDS ============
-- One constant, so the UI copy and the ledger cannot drift apart. 25 Paws per
-- successful bounty claim, never paid for a self-claim.
CREATE OR REPLACE FUNCTION public.bounty_paw_reward()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 25::integer $$;

GRANT EXECUTE ON FUNCTION public.bounty_paw_reward() TO anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.reward_bounty_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS validate_bounty_claim_t ON public.drop_claims;
CREATE TRIGGER validate_bounty_claim_t
  BEFORE INSERT ON public.drop_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_bounty_claim();

DROP TRIGGER IF EXISTS reward_bounty_claim_t ON public.drop_claims;
CREATE TRIGGER reward_bounty_claim_t
  AFTER INSERT ON public.drop_claims
  FOR EACH ROW EXECUTE FUNCTION public.reward_bounty_claim();

CREATE OR REPLACE FUNCTION public.claim_bounty(_drop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim a bounty.';
  END IF;

  INSERT INTO public.drop_claims (drop_id, user_id)
  VALUES (_drop_id, v_user);

  SELECT paw_balance INTO v_balance FROM public.profiles WHERE id = v_user;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'reward', public.bounty_paw_reward(),
    'balance', coalesce(v_balance, 0)
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT paw_balance INTO v_balance FROM public.profiles WHERE id = v_user;
    RETURN jsonb_build_object(
      'status', 'already_claimed',
      'reward', 0,
      'balance', coalesce(v_balance, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bounty(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bounty(uuid) TO authenticated;

COMMENT ON FUNCTION public.bounty_paw_reward() IS
  'Paws paid for each successful bounty claim. Mirrored by the Bounties page copy.';
