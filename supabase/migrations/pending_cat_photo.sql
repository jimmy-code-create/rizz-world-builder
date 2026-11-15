-- Cat Studio must never own the profile picture.
--
-- The poster PNG used to be written into profiles.avatar_url, which replaced the
-- photo a person had uploaded. This adds a dedicated column for the Flex poster
-- and puts any already-displaced cat PNG back where it belongs, without deleting
-- anything: the URL is copied first, then removed from the photo column so the
-- honest "no photo" state returns (the file stays in the avatars bucket).

alter table public.profiles
  add column if not exists cat_poster_url text;

-- Move any cat poster that was written into the photo column. The pattern is the
-- one Cat Studio uploads: <user-id>/cat-<timestamp>.png
update public.profiles
set cat_poster_url = coalesce(cat_poster_url, avatar_url),
    avatar_url = null
where avatar_url ~ '/cat-[0-9]{10,}\.png$';

-- Who lost a photo: the cat poster is now here instead of the photo column.
-- Run this to see the affected accounts (they get the letter avatar until they
-- upload a new photo; nothing was deleted from storage).
--   select id, username, cat_poster_url, updated_at
--   from public.profiles
--   where cat_poster_url is not null;

comment on column public.profiles.cat_poster_url is
  'Cat Studio poster PNG, used for Flexes share and as the 3D fallback. Never the profile photo.';
