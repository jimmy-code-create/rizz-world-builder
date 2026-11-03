import { supabase } from "@/integrations/supabase/client";

/**
 * Realm covers, in one place.
 *
 * A cover is the wide strip above a realm in discovery. GIF and WebP animate by
 * themselves in an `<img>`, so there is no player, no poster and no second
 * format to keep in sync — the uploaded file is the cover.
 */
export const REALM_COVER_ACCEPT = "image/gif,image/webp,image/png,image/jpeg";
export const REALM_COVER_MAX_BYTES = 8 * 1024 * 1024;
export const REALM_COVER_MAX_LABEL = "8 MB";

const EXTENSIONS = {
  "image/gif": "gif",
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

export function realmCoverProblem(file: File | null): string | null {
  if (!file) return null;
  if (!(file.type in EXTENSIONS)) return "Use a GIF, WebP, PNG or JPG cover.";
  if (file.size > REALM_COVER_MAX_BYTES) {
    return `That cover is too large. Keep it under ${REALM_COVER_MAX_LABEL}.`;
  }
  return null;
}

/** Uploads into the public avatars bucket, under the owner's folder. */
export async function uploadRealmCover(file: File, userId: string, realmId: string) {
  const problem = realmCoverProblem(file);
  if (problem) throw new Error(problem);
  const extension = EXTENSIONS[file.type as keyof typeof EXTENSIONS];
  const path = `${userId}/realm-covers/${realmId}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** "Animated" is a property of the file, not a setting. */
export function realmCoverIsAnimated(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".gif") || clean.endsWith(".webp");
}
