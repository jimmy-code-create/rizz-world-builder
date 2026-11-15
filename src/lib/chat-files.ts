import { supabase } from "@/integrations/supabase/client";
import { compressChatImage } from "@/lib/chat-media";

/**
 * Shared attachment plumbing for DMs, groups and realm chat.
 *
 * A picked file is uploaded as soon as it is chosen, so the composer's chip can
 * show real progress and Send never waits on a large upload. Photos and videos
 * stay media; everything else becomes a file card stored in the message's
 * `card` column.
 */
export type ChatFileKind = "image" | "video" | "file";

export type ChatFileCard = {
  type: "file";
  name: string;
  size: number;
  mime: string;
  url: string;
};

export type ChatFileDraft = {
  id: string;
  file: File;
  name: string;
  size: number;
  mime: string;
  kind: ChatFileKind;
  /** Object URL for image/video previews; null for documents. */
  preview: string | null;
  progress: number;
  status: "uploading" | "ready" | "error";
  url?: string;
  path?: string;
  card?: ChatFileCard | null;
  error?: string;
};

export const MAX_CHAT_ATTACHMENTS = 10;

export function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function chatFileKind(file: File): ChatFileKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function makeChatFileDraft(file: File): ChatFileDraft {
  const kind = chatFileKind(file);
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name || (kind === "image" ? "Photo" : kind === "video" ? "Video" : "File"),
    size: file.size,
    mime: file.type || "application/octet-stream",
    kind,
    preview: kind === "image" ? URL.createObjectURL(file) : null,
    progress: 0,
    status: "uploading",
  };
}

export function releaseChatFileDraft(draft: ChatFileDraft) {
  if (draft.preview) URL.revokeObjectURL(draft.preview);
}

function safeExtension(name: string, mime: string) {
  const fromName =
    name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? "";
  if (fromName && fromName.length <= 5) return fromName;
  const fromMime =
    mime
      .split("/")[1]
      ?.split("+")[0]
      ?.replace(/[^a-z0-9]/g, "") ?? "";
  return fromMime || "bin";
}

function publicUrl(path: string) {
  return supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads the draft's bytes. Progress is real where XHR is available (browsers),
 * and coarse (0 → 100) in any environment without it.
 */
export async function uploadChatFileDraft(
  draft: ChatFileDraft,
  userId: string,
  onProgress?: (progress: number) => void,
): Promise<{ url: string; path: string; card: ChatFileCard | null }> {
  let body: Blob = draft.file;
  let ext = safeExtension(draft.name, draft.mime);
  let contentType = draft.mime;

  if (draft.kind === "image") {
    body = await compressChatImage(draft.file);
    ext = "jpg";
    contentType = "image/jpeg";
  }

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  onProgress?.(2);

  const canUseXhr = typeof XMLHttpRequest !== "undefined";
  if (canUseXhr) {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (baseUrl && key && token) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${baseUrl}/storage/v1/object/chat-media/${path}`);
        xhr.setRequestHeader("authorization", `Bearer ${token}`);
        xhr.setRequestHeader("apikey", key);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("content-type", contentType || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          onProgress?.(Math.max(2, Math.round((event.loaded / event.total) * 96)));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(storageError(xhr.responseText, xhr.status)));
        };
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(body);
      });
      onProgress?.(100);
      const url = publicUrl(path);
      return {
        url,
        path,
        card:
          draft.kind === "file"
            ? { type: "file", name: draft.name, size: draft.size, mime: draft.mime, url }
            : null,
      };
    }
  }

  const { error } = await supabase.storage
    .from("chat-media")
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(storageError(error.message, 0));
  onProgress?.(100);
  const url = publicUrl(path);
  return {
    url,
    path,
    card:
      draft.kind === "file"
        ? { type: "file", name: draft.name, size: draft.size, mime: draft.mime, url }
        : null,
  };
}

function storageError(message: string, status: number) {
  if (/bucket|not found|does not exist|schema cache/i.test(message) || status === 404) {
    return "File sending needs the chat-media storage setup in BACKEND_REQUIREMENTS.md.";
  }
  if (status === 413 || /too large|payload/i.test(message)) {
    return "That file is too large to upload.";
  }
  return message || `Upload failed${status ? ` (${status})` : ""}.`;
}

export function asChatFileCard(value: unknown): ChatFileCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Partial<ChatFileCard>;
  if (card.type !== "file" || typeof card.name !== "string" || typeof card.url !== "string") {
    return null;
  }
  return {
    type: "file",
    name: card.name,
    size: typeof card.size === "number" ? card.size : 0,
    mime: typeof card.mime === "string" ? card.mime : "",
    url: card.url,
  };
}
