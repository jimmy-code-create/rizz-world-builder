ALTER TABLE public.profiles
  ALTER COLUMN username DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tutorial_seen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := NULLIF(
    lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_]', '', 'g')),
    ''
  );
  IF base_username IS NOT NULL AND length(base_username) < 3 THEN
    base_username := NULL;
  END IF;

  final_username := base_username;
  IF final_username IS NOT NULL THEN
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      final_username,
      'New member'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
