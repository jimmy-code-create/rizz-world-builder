declare module "@block65/webcrypto-web-push" {
  export interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  }

  export interface VapidKeys {
    subject: string;
    publicKey: string;
    privateKey: string;
  }

  export interface PushMessage {
    data: string;
    options?: {
      ttl?: number;
      urgency?: "very-low" | "low" | "normal" | "high";
      topic?: string;
    };
  }

  export function buildPushPayload(
    message: PushMessage,
    subscription: PushSubscription,
    vapid: VapidKeys,
  ): Promise<RequestInit>;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PUSH_SHARED_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  GEMINI_API_KEY: string;
  GEMINI_TTS_MODEL?: string;
  ALLOWED_ORIGIN: string;
}