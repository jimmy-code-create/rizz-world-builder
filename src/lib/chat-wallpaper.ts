import { supabase } from "@/integrations/supabase/client";
import { compressChatImage } from "@/lib/chat-media";

/**
 * Per-chat wallpapers.
 *
 * A wallpaper is either one of the shared presets or a background the user
 * uploaded. It is stored per chat (a DM peer or a group id), so opening a
 * different conversation never inherits the last one's background, and an
 * uploaded image survives closing the app because the stored value is the
 * uploaded image's URL, not the local file — which would be gone after a
 * reload. Old builds stored just a preset index; that form still loads.
 */

export type ChatWallpaper = { preset: number } | { url: string } | null;

/** Presets are gradients, so a wallpaper never needs a network request. */
export const WALLPAPER_PRESETS = [
  "radial-gradient(ellipse at top right, rgba(255,62,165,.14), transparent 55%)",
  "radial-gradient(ellipse at bottom left, rgba(124,58,237,.18), transparent 60%)",
  "linear-gradient(160deg, rgba(255,46,147,.12), rgba(11,7,20,0) 45%), radial-gradient(circle at 80% 10%, rgba(123,47,247,.18), transparent 55%)",
  "radial-gradient(circle at 20% 80%, rgba(61,220,151,.10), transparent 50%)",
  "none",
] as const;

export type WallpaperChatKind = "dm" | "group";

export function wallpaperStorageKey(kind: WallpaperChatKind, id: string): string {
  return `rizz:${kind}-wallpaper:${id}`;
}

/** The saved wallpaper for one chat, or null when the user never chose one. */
export function loadWallpaper(kind: WallpaperChatKind, id: string): ChatWallpaper {
  if (!id) return null;
  try {
    const raw = window.localStorage.getItem(wallpaperStorageKey(kind, id));
    if (!raw) return null;
    // Older builds wrote a bare preset index ("1").
    if (/^\d+$/.test(raw)) {
      const preset = Number(raw);
      return preset >= 0 && preset < WALLPAPER_PRESETS.length ? { preset } : null;
    }
    const parsed = JSON.parse(raw) as { preset?: unknown; url?: unknown };
    if (typeof parsed.url === "string" && parsed.url) return { url: parsed.url };
    if (typeof parsed.preset === "number" && parsed.preset >= 0 && parsed.preset < WALLPAPER_PRESETS.length) {
      return { preset: parsed.preset };
    }
    return null;
  } catch {
    // Private mode or blocked storage: the chat simply keeps the default look.
    return null;
  }
}

export function saveWallpaper(kind: WallpaperChatKind, id: string, value: ChatWallpaper): void {
  if (!id) return;
  try {
    const key = wallpaperStorageKey(kind, id);
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort: the wallpaper still applies for this session.
  }
}

/** The CSS the chat surface uses for this wallpaper. */
export function wallpaperStyle(value: ChatWallpaper): {
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
} {
  if (!value) return {};
  if ("url" in value) {
    return {
      backgroundImage: `url(${value.url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { backgroundImage: WALLPAPER_PRESETS[value.preset], backgroundRepeat: "no-repeat" };
}

function friendlyUploadError(message: string): string {
  if (/bucket|not found|does not exist|schema cache/i.test(message)) {
    return "Custom wallpapers need the chat-media storage setup in BACKEND_REQUIREMENTS.md.";
  }
  if (/row-level|policy|permission|unauthorized|jwt/i.test(message)) {
    return "You don't have permission to upload there.";
  }
  if (/network|fetch|failed to fetch/i.test(message)) {
    return "Couldn't upload that image — check your connection.";
  }
  return "Couldn't upload that wallpaper. Try another image.";
}

/** Compresses a picked image and stores it in chat-media, returning its URL. */
export async function uploadWallpaper(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Pick an image under 15 MB.");

  let blob: Blob;
  try {
    blob = await compressChatImage(file);
  } catch {
    throw new Error("That image couldn't be prepared in this browser. Try a JPG or PNG.");
  }

  const path = `${userId}/wallpapers/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("chat-media")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(friendlyUploadError(error.message));

  return supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}
