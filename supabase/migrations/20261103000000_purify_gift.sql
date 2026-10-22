-- ============ PURIFY: GIFT + A SAFER GUARD ============
-- 1. The guard from 20261102000000 blocked every non-service-role writer,
--    including migrations (auth.role() is NULL there). It should only stop
--    signed-in members and anonymous clients from granting themselves Purify.
-- 2. Gift Purify to the demo account, so the subscriber badge, particles and
--    every unlocked surface are visible without a Stripe key.

CREATE OR REPLACE FUNCTION public.protect_purify_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IN ('authenticated', 'anon') THEN
    NEW.purify_until := OLD.purify_until;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = 'jimmy') THEN
    UPDATE public.profiles
    SET purify_until = GREATEST(COALESCE(purify_until, now()), now()) + interval '365 days'
    WHERE username = 'jimmy';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
