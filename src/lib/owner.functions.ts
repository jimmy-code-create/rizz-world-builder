import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function verifyPassword(input: string): boolean {
  const expected = process.env.OWNER_PANEL_PASSWORD;
  if (!expected || !input) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

function requirePass(password: string) {
  if (!verifyPassword(password)) {
    throw new Error("Wrong owner password");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const ownerVerify = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    return { ok: verifyPassword(data.password) };
  });

export const ownerSearchUsers = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; q: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const q = (data.q ?? "").trim();
    let query = db
      .from("profiles")
      .select("id, username, display_name, avatar_url, rizz_score")
      .order("rizz_score", { ascending: false })
      .limit(20);
    if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const ownerListCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const [badges, effects] = await Promise.all([
      db.from("badges").select("id, slug, name, description, icon, color, rarity").order("rarity"),
      db.from("profile_effects").select("id, slug, name, type, rarity, preview_color").order("type"),
    ]);
    if (badges.error) throw new Error(badges.error.message);
    if (effects.error) throw new Error(effects.error.message);
    return { badges: badges.data ?? [], effects: effects.data ?? [] };
  });

export const ownerUserInventory = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const [badges, effects] = await Promise.all([
      db.from("user_badges").select("badge_id, badges(slug, name, rarity)").eq("user_id", data.userId),
      db.from("user_profile_effects").select("effect_id, equipped, effect:profile_effects(slug, name, type)").eq("user_id", data.userId),
    ]);
    if (badges.error) throw new Error(badges.error.message);
    if (effects.error) throw new Error(effects.error.message);
    return { badges: badges.data ?? [], effects: effects.data ?? [] };
  });

export const ownerGrantBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; badgeSlug: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const { data: b, error: be } = await db.from("badges").select("id").eq("slug", data.badgeSlug).maybeSingle();
    if (be) throw new Error(be.message);
    if (!b) throw new Error("Badge not found");
    const { error } = await db.from("user_badges").insert({ user_id: data.userId, badge_id: b.id });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const ownerRevokeBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; badgeSlug: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const { data: b } = await db.from("badges").select("id").eq("slug", data.badgeSlug).maybeSingle();
    if (!b) throw new Error("Badge not found");
    const { error } = await db.from("user_badges").delete().eq("user_id", data.userId).eq("badge_id", b.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerGrantEffect = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; effectSlug: string; equip?: boolean }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const { data: e, error: ee } = await db.from("profile_effects").select("id, type").eq("slug", data.effectSlug).maybeSingle();
    if (ee) throw new Error(ee.message);
    if (!e) throw new Error("Effect not found");
    const { error } = await db.from("user_profile_effects").upsert(
      { user_id: data.userId, effect_id: e.id, equipped: !!data.equip },
      { onConflict: "user_id,effect_id" }
    );
    if (error) throw new Error(error.message);
    if (data.equip) {
      // unequip other effects of same type
      const { data: rows } = await db
        .from("user_profile_effects")
        .select("effect_id, effect:profile_effects(type)")
        .eq("user_id", data.userId)
        .eq("equipped", true);
      for (const r of rows ?? []) {
        const t = (r as any).effect?.type;
        if (t === e.type && (r as any).effect_id !== e.id) {
          await db.from("user_profile_effects").update({ equipped: false }).eq("user_id", data.userId).eq("effect_id", (r as any).effect_id);
        }
      }
    }
    return { ok: true };
  });

export const ownerRemoveEffect = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; effectSlug: string }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    const { data: e } = await db.from("profile_effects").select("id").eq("slug", data.effectSlug).maybeSingle();
    if (!e) throw new Error("Effect not found");
    const { error } = await db.from("user_profile_effects").delete().eq("user_id", data.userId).eq("effect_id", e.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerGiftRizz = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; delta: number }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    // Clamp delta to safe int32 range to avoid overflow crashes
    const delta = Math.max(-1_000_000, Math.min(1_000_000, Math.round(Number(data.delta) || 0)));
    const db = await admin();
    const { data: p, error: pe } = await db.from("profiles").select("rizz_score").eq("id", data.userId).maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!p) throw new Error("User not found");
    const next = Math.max(0, Math.min(2_000_000_000, (p.rizz_score ?? 0) + delta));
    const { error } = await db.from("profiles").update({ rizz_score: next }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, rizz_score: next };
  });

export const ownerGrantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; userId: string; grant: boolean }) => d)
  .handler(async ({ data }) => {
    requirePass(data.password);
    const db = await admin();
    if (data.grant) {
      const { error } = await db.from("user_roles").insert({ user_id: data.userId, role: "admin" as any });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin" as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
