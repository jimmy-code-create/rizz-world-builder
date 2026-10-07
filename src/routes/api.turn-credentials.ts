import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

async function createTurnPassword(username: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(username)));
  let binary = "";
  signature.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export const Route = createFileRoute("/api/turn-credentials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;

        const turnUrls = (process.env.TURN_SERVER_URLS ?? "")
          .split(",")
          .map((url) => url.trim())
          .filter((url) => /^turns?:/i.test(url));
        const sharedSecret = process.env.TURN_SHARED_SECRET;
        if (turnUrls.length === 0 || !sharedSecret) {
          return Response.json(
            { iceServers: STUN_SERVERS, turnConfigured: false },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
        const username = `${expiresAt}:${auth.userId}`;
        const credential = await createTurnPassword(username, sharedSecret);
        const iceServers: RTCIceServer[] = [
          ...STUN_SERVERS,
          { urls: turnUrls, username, credential },
        ];

        return Response.json(
          { iceServers, turnConfigured: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
