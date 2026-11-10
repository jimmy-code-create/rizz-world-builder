/** One-line label for a quoted message: its text, or what kind of media it is. */
export function replyPreviewText(input: {
  body?: string | null;
  attachmentUrl?: string | null;
  audioUrl?: string | null;
}): string {
  let body = (input.body ?? "").replace(/^↪[^\n]*\n/, "").trim();
  if (/^(?:📷|📸|🖼) image$/i.test(body)) body = "";
  if (body) return body;
  if (input.audioUrl) return "Voice message";
  if (input.attachmentUrl) {
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(input.attachmentUrl) ? "Video" : "Photo";
  }
  return "Message";
}
