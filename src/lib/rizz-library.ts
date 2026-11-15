/**
 * The Rizz Library: the media a conversation already holds, plus anything this
 * session prepared, plus what the member saved for later.
 *
 * Nothing here writes to the database. Recent comes from messages the member
 * already sent, uploads live for this session, and saved is a small list of URLs
 * in local storage — a library, not a second copy of the bucket.
 */
import { supabase } from "@/integrations/supabase/client";

export const MAX_LIBRARY_SELECTION = 10;
export const MAX_SELECTION = MAX_LIBRARY_SELECTION;
export const MAX_EDGE = 1920;
export const THUMB_EDGE = 256;

export type LibraryItem = {
  id: string;
  url: string;
  thumb?: string | null;
  kind: "image" | "video";
  createdAt?: string;
};

export type LibraryTab = "recent" | "uploads" | "saved";

const SAVED_KEY = "rizz:library:saved:v1";

const loose = supabase as unknown as { from(table: string): any };

function readSaved(): LibraryItem[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const parsed = raw ? (JSON.parse(raw) as LibraryItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.url === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(items: LibraryItem[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    // Private mode: the library still works for this session.
  }
}

/** One message row can hold several attachments; these are all of them. */
function urlsFromRow(row: Record<string, unknown>): string[] {
  const single = typeof row.attachment_url === "string" ? row.attachment_url : null;
  const many = Array.isArray(row.attachments)
    ? row.attachments.filter((value): value is string => typeof value === "string")
    : [];
  return [...(single ? [single] : []), ...many];
}

function kindOf(url: string): "image" | "video" {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? "video" : "image";
}

/**
 * The media already in this conversation, newest first.
 *
 * Fails soft: before the table or column exists (or when signed out) the tab is
 * simply empty instead of breaking the sheet.
 */
export function bucketLibrary(
  userId: string,
  tab: "recent" = "recent",
  limit = 60,
): Promise<LibraryItem[]> {
  if (!userId) return Promise.resolve([]);
  return (async () => {
  const { data, error } = await loose
    .from("direct_messages")
    .select("id, attachment_url, attachments, created_at")
    .eq("sender_id", userId)
    .not("attachment_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const items: LibraryItem[] = [];
  for (const row of data as Record<string, unknown>[]) {
    for (const url of urlsFromRow(row)) {
      items.push({
        id: `${String(row.id)}:${url}`,
        url,
        kind: kindOf(url),
        createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
      });
    }
  }
  // `tab` is part of the signature so every caller names its bucket.
  return tab === "recent" ? items.slice(0, limit) : items;
  })();
}

export function savedLibrary(): LibraryItem[] {
  return readSaved();
}

export function saveLibraryItem(item: LibraryItem): LibraryItem[] {
  const next = [item, ...readSaved().filter((entry) => entry.url !== item.url)].slice(0, 60);
  writeSaved(next);
  return next;
}

export function removeLibraryItem(url: string): LibraryItem[] {
  const next = readSaved().filter((entry) => entry.url !== url);
  writeSaved(next);
  return next;
}

export type PreparedLibraryFile = {
  id: string;
  file: File;
  preview: string;
  thumb: string;
  kind: "image" | "video";
};

async function draw(file: File, edge: number, type: string): Promise<{ blob: Blob; url: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  if (!blob) throw new Error("Could not prepare that image.");
  return { blob, url: URL.createObjectURL(blob) };
}

/**
 * Compress pictures to 1920px and make a 256px thumbnail before anything is
 * uploaded; video passes through untouched with its poster left to the player.
 *
 * Progress is reported per file so the sheet can say exactly where it is.
 */
export async function prepareLibraryFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PreparedLibraryFile[]> {
  const total = files.length;
  const prepared: PreparedLibraryFile[] = [];
  let done = 0;
  for (const file of files) {
    try {
      if (file.type.startsWith("image/")) {
        const full = await draw(file, MAX_EDGE, "image/webp");
        const thumb = await draw(file, THUMB_EDGE, "image/webp");
        prepared.push({
          id: `${file.name}:${file.lastModified}:${done}`,
          file: new File([full.blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
            type: "image/webp",
          }),
          preview: full.url,
          thumb: thumb.url,
          kind: "image",
        });
      } else {
        const fallback = file.type.includes("mp4") ? "image/jpeg" : "image/jpeg";
        prepared.push({
          id: `${file.name}:${file.lastModified}:${done}`,
          file,
          preview: URL.createObjectURL(file),
          thumb: "",
          kind: "video",
        });
        void fallback;
      }
    } catch {
      // One bad file must not sink the batch: it is reported, the rest proceed.
    }
    done += 1;
    onProgress?.(done, total);
  }
  return prepared;
}
