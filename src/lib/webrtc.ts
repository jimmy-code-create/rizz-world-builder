export type IceConfiguration = {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
};

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function getRoomIceConfiguration(accessToken: string): Promise<IceConfiguration> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch("/api/turn-credentials", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if ([502, 503, 504].includes(response.status) && attempt < 3) {
        await wait(400 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error("Couldn't prepare the voice connection.");
      const result = (await response.json()) as Partial<IceConfiguration>;
      return {
        iceServers: result.iceServers?.length ? result.iceServers : STUN_SERVERS,
        turnConfigured: result.turnConfigured === true,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(400 * 2 ** attempt);
    }
  }

  console.warn("TURN credential request failed; using STUN only.", lastError);
  return { iceServers: STUN_SERVERS, turnConfigured: false };
}
