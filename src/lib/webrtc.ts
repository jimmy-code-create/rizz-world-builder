export type IceConfiguration = {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
};

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Permanent refusal from the endpoint — never retried, never silently downgraded. */
export const MODS_ONLY_VOICE_MESSAGE = "This voice channel is mods only.";

export async function getRoomIceConfiguration(
  accessToken: string,
  /** voice_rooms.id — lets the endpoint refuse locked "mods only" channels. */
  roomId?: string,
): Promise<IceConfiguration> {
  let lastError: unknown;
  const endpoint = roomId
    ? `/api/turn-credentials?roomId=${encodeURIComponent(roomId)}`
    : "/api/turn-credentials";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if ([502, 503, 504].includes(response.status) && attempt < 3) {
        await wait(400 * 2 ** attempt);
        continue;
      }
      if (response.status === 403) throw new Error(MODS_ONLY_VOICE_MESSAGE);
      if (!response.ok) throw new Error("Couldn't prepare the voice connection.");
      const result = (await response.json()) as Partial<IceConfiguration>;
      return {
        iceServers: result.iceServers?.length ? result.iceServers : STUN_SERVERS,
        turnConfigured: result.turnConfigured === true,
      };
    } catch (error) {
      // A locked channel is a decision, not a hiccup: don't retry and don't fall
      // back to STUN, so a non-mod can never sneak into a locked channel.
      if (error instanceof Error && error.message === MODS_ONLY_VOICE_MESSAGE) throw error;
      lastError = error;
      if (attempt < 3) await wait(400 * 2 ** attempt);
    }
  }

  console.warn("TURN credential request failed; using STUN only.", lastError);
  return { iceServers: STUN_SERVERS, turnConfigured: false };
}
