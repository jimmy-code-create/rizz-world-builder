-- ============ PURIFY ============
-- Purify is the $1/month tier. The entitlement is one timestamp on the profile:
-- a member is Pure while `purify_until` is in the future. Stripe owns the value;
-- the app only reads it.
--
-- Stripe bookkeeping columns stay on the row so a webhook can find the member
-- from a customer id even when the event does not carry our reference.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purify_until timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Members can update their own profile row, so without this trigger anyone
-- could grant themselves Purify from the client. Only the service role (the
-- Stripe webhook) may change the entitlement columns; every other writer keeps
-- whatever the row already had.
CREATE OR REPLACE FUNCTION public.protect_purify_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.purify_until := OLD.purify_until;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_purify ON public.profiles;
CREATE TRIGGER profiles_protect_purify
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_purify_entitlement();

NOTIFY pgrst, 'reload schema';
