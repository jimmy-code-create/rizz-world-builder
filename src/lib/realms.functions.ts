import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REALM_NAME_MIN = 3;
export const REALM_NAME_MAX = 30;
export const REALM_DESCRIPTION_MAX = 300;

const updateRealmDetailsSchema = z.object({
  realmId: z.string().uuid(),
  name: z.string().trim().min(REALM_NAME_MIN).max(REALM_NAME_MAX),
  description: z.string().trim().max(REALM_DESCRIPTION_MAX).nullish(),
  iconUrl: z.string().trim().max(600).nullish(),
  removeIcon: z.boolean().optional(),
});

/** Strip control characters, collapse runs of whitespace and clamp to the limit. */
function sanitizeLine(raw: string, max: number) {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const updateRealmDetailsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    realmId: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    removeIcon?: boolean;
  }) => updateRealmDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const name = sanitizeLine(data.name, REALM_NAME_MAX);
    if (name.length < REALM_NAME_MIN) {
      throw new Error(`Realm names need at least ${REALM_NAME_MIN} characters.`);
    }
    const description = data.description ? sanitizeLine(data.description, REALM_DESCRIPTION_MAX) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Permissions are enforced here, not only in the UI: owner or mod only.
    const { data: realmRow, error: realmError } = await supabaseAdmin
      .from("realms")
      .select("id, owner_id")
      .eq("id", data.realmId)
      .maybeSingle();
    if (realmError) throw realmError;
    if (!realmRow) throw new Error("That realm no longer exists.");

    let allowed = realmRow.owner_id === context.userId;
    if (!allowed) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("realm_members")
        .select("role")
        .eq("realm_id", data.realmId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      allowed = membership?.role === "mod" || membership?.role === "owner";
    }
    if (!allowed) throw new Error("Only the realm owner and admins can edit this realm.");

    const patch: { name: string; topic: string | null; icon_url?: string | null } = { name, topic: description };
    if (data.removeIcon) patch.icon_url = null;
    else if (data.iconUrl) patch.icon_url = data.iconUrl;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("realms")
      .update(patch)
      .eq("id", data.realmId)
      .select("id, slug, name, topic, icon_url")
      .single();
    if (updateError) throw updateError;
    return updated;
  });

export function updateRealmDetails(input: {
  realmId: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  removeIcon?: boolean;
}) {
  return updateRealmDetailsServer({ data: input });
}
