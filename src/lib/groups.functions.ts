import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Selecting five other people is the cap; the creator is not counted. */
export const MAX_GROUP_PICKS = 5;

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  iconUrl: z.string().trim().max(600).nullish(),
  memberIds: z.array(z.string().uuid()).min(1).max(MAX_GROUP_PICKS),
});

/** Collapse whitespace and drop control characters before anything is stored. */
function sanitizeGroupName(raw: string) {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "group"}-${suffix}`;
}

const createGroupChatServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; iconUrl?: string | null; memberIds: string[] }) =>
    createGroupSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const name = sanitizeGroupName(data.name);
    if (name.length < 2) throw new Error("Give the group a name with at least 2 characters.");

    const memberIds = [...new Set(data.memberIds)].filter((id) => id !== userId).slice(0, MAX_GROUP_PICKS);
    if (!memberIds.length) throw new Error("Pick at least one person for this group.");

    // Only people the creator already has a DM thread with may be pulled in.
    const { data: dmRows, error: dmError } = await supabase
      .from("direct_messages")
      .select("sender_id, recipient_id")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .limit(1000);
    if (dmError) throw dmError;
    const dmPartners = new Set<string>();
    for (const row of dmRows ?? []) {
      dmPartners.add(row.sender_id === userId ? row.recipient_id : row.sender_id);
    }
    if (memberIds.some((id) => !dmPartners.has(id))) {
      throw new Error("You can only add people you already have DMs with.");
    }

    // Block checks stay in place in either direction, so a blocked connection
    // can't be smuggled into a new group.
    const { data: blockRows, error: blockError } = await supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    if (blockError) throw blockError;
    const blocked = new Set((blockRows ?? []).map((row) => (row.blocker_id === userId ? row.blocked_id : row.blocker_id)));
    if (memberIds.some((id) => blocked.has(id))) {
      throw new Error("You can't add someone who is blocked.");
    }

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({
        owner_id: userId,
        slug: slugify(name),
        name,
        icon_url: data.iconUrl ?? null,
        accent_color: "#ff2d92",
      })
      .select("id, name, icon_url, member_count")
      .single();
    if (groupError) throw groupError;

    // Members can't insert each other under RLS, so the membership rows go in
    // with the service role; the group_members trigger lifts groups.member_count.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: memberError } = await supabaseAdmin.from("group_members").insert(
      memberIds.map((id) => ({ group_id: group.id, user_id: id, role: "member" as const })),
    );
    if (memberError) throw memberError;

    return {
      id: group.id,
      name: group.name,
      iconUrl: group.icon_url,
      memberCount: (group.member_count ?? 1) + memberIds.length,
      added: memberIds.length,
    };
  });

export function createGroupChat(input: { name: string; iconUrl?: string | null; memberIds: string[] }) {
  return createGroupChatServer({ data: input });
}
