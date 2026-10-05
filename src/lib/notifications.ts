import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type InAppNotificationType = "dm" | "call_invite" | "story_reply" | "reaction";

type InAppNotificationInput = {
  recipientId: string;
  actorId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  data?: Json;
  postId?: string | null;
};

/**
 * Notifications are secondary to the action that caused them: a notification
 * failure must not undo a message, call invite, or reaction.
 */
export function notifyInApp(input: InAppNotificationInput) {
  if (!input.recipientId || input.recipientId === input.actorId) return;

  void (async () => {
    const { error } = await supabase.from("notifications").insert({
      user_id: input.recipientId,
      actor_id: input.actorId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      post_id: input.postId ?? null,
    });

    if (error) console.warn("In-app notification insert failed:", error.message);
  })().catch((error) => {
    console.warn("In-app notification insert failed:", error);
  });
}