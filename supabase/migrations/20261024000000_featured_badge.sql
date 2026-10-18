-- "Featured badge": the one emblem a member wears beside their name across the
-- app. Nullable on purpose — no featured badge is the default. The value is a
-- badges.slug, and the UI only ever renders a slug the member actually earned,
-- so a stale value can never show an unearned badge.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS featured_badge text;

-- Only members with the badge can feature it; enforced here so the profile
-- header can never be decorated with something that was never awarded.
CREATE OR REPLACE FUNCTION public.profiles_featured_badge_must_be_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.featured_badge IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_badges AS ub
    JOIN public.badges AS b ON b.id = ub.badge_id
    WHERE ub.user_id = NEW.id AND b.slug = NEW.featured_badge
  ) THEN
    RAISE EXCEPTION 'you can only feature a badge you earned';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_featured_badge_earned ON public.profiles;
CREATE TRIGGER profiles_featured_badge_earned
  BEFORE INSERT OR UPDATE OF featured_badge ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_featured_badge_must_be_earned();

-- Awarding a badge does not change featured_badge, so the trigger above never
-- blocks it. Revoking a badge that is currently featured clears the feature.
CREATE OR REPLACE FUNCTION public.clear_featured_badge_on_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.profiles AS p
  SET featured_badge = NULL
  FROM public.badges AS b
  WHERE b.id = OLD.badge_id
    AND p.id = OLD.user_id
    AND p.featured_badge = b.slug;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS user_badges_clear_featured ON public.user_badges;
CREATE TRIGGER user_badges_clear_featured
  AFTER DELETE ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_featured_badge_on_revoke();
