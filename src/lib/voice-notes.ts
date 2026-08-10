import { supabase } from "@/integrations/supabase/client";

const BUCKET = "voice-notes";

export type Recording = { blob: Blob; durationMs: number };

/** Thin MediaRecorder wrapper: start() returns a stop function resolving the clip. */
export async function startRecording(): Promise<() => Promise<Recording>> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  const started = Date.now();
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.start();
  return () =>
    new Promise<Recording>((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve({ blob: new Blob(chunks, { type: rec.mimeType || "audio/webm" }), durationMs: Date.now() - started });
      };
      rec.stop();
    });
}

/** Uploads a clip into the caller's folder and returns the storage path. */
export async function uploadVoiceNote(userId: string, rec: Recording) {
  const ext = rec.blob.type.includes("mp4") ? "m4a" : "webm";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, rec.blob, { contentType: rec.blob.type, upsert: false });
  if (error) throw new Error(`Voice note upload failed: ${error.message}`);
  return path;
}

const urlCache = new Map<string, { url: string; expires: number }>();

/** Signed playback URL (bucket is private), cached until shortly before expiry. */
export async function voiceNoteUrl(path: string) {
  const hit = urlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? "Could not load voice note");
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60_000 });
  return data.signedUrl;
}

export function formatDuration(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Deterministic pseudo-waveform so each clip looks distinct without decoding. */
export function waveformBars(seed: string, count = 28) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.25 + ((h >>> (i % 8)) % 100) / 133;
  });
}