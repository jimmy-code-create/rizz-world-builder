/**
 * Cat Studio data.
 *
 * The catalog is code (see catalog.ts); ownership, purchases and the saved
 * config are database. Until the pending migration is applied, every call here
 * reports `available: false` and the route hides itself instead of crashing.
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canUsePurify } from "@/lib/purify";
import { toast } from "@/lib/toast";
import { getCatItem, isCatItemId } from "./catalog";
import { sanitizeCatConfig, serializeCatConfig, type CatConfig } from "./config";
import { catPngBlob } from "./renderPng";

/**
 * The pending migration adds tables the generated client types do not know yet.
 * This shim keeps `cat_items` / `cat_inventory` / the two RPCs typed as unknown
 * rows instead of fighting the generated schema.
 */
type LooseClient = {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
  storage: typeof supabase.storage;
};
const db = supabase as unknown as LooseClient;

export type CatProfileFields = {
  avatar_type?: string | null;
  avatar_config?: unknown;
};

/** `cat_items` exists only after pending_catstudio.sql runs. */
export function useCatAvailability() {
  const query = useQuery({
    queryKey: ["cat-studio", "availability"],
    queryFn: async () => {
      const { error } = await db.from("cat_items").select("id").limit(1);
      return !error;
    },
    staleTime: Infinity,
    retry: false,
  });
  return { ...query, available: query.data === true };
}

export function useCatStudio() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const availability = useCatAvailability();

  const inventory = useQuery({
    queryKey: ["cat-studio", "inventory", user?.id],
    enabled: !!user && availability.available,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("cat_inventory")
        .select("item_id, acquired_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set(((data ?? []) as { item_id: string }[]).map((row) => row.item_id));
    },
  });

  const owned = useCallback((id: string) => inventory.data?.has(id) ?? false, [inventory.data]);

  const buy = useMutation({
    mutationFn: async (itemId: string) => {
      const item = getCatItem(itemId);
      if (!item) throw new Error("That item does not exist.");
      // One RPC: it locks the wallet, so a double tap cannot charge twice.
      const { data, error } = await db.rpc("buy_cat_item", { _item: itemId });
      if (error) throw error;
      return data as { status?: string; balance?: number } | null;
    },
    onSuccess: async (data, itemId) => {
      const item = getCatItem(itemId);
      toast.success(`${item?.name ?? "Item"} unlocked ✨`);
      await qc.invalidateQueries({ queryKey: ["cat-studio", "inventory"] });
      await refreshProfile();
      return data;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async (input: CatConfig) => {
      if (!user) throw new Error("Sign in to save your cat.");
      const config = sanitizeCatConfig(input);
      const body = serializeCatConfig(config);

      // 1. Server validates ownership + clamps the sliders and stores the config.
      const { data, error } = await db.rpc("save_cat_avatar", { _config: body });
      if (error) throw error;

      // 2. The PNG goes through the existing avatar bucket path, so every screen
      //    that reads avatar_url keeps working untouched.
      const blob = await catPngBlob(config, 512);
      const path = `${user.id}/cat-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profileError } = await db
        .from("profiles")
        .update({ avatar_url: publicUrl.publicUrl, avatar_type: "cat" })
        .eq("id", user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      return data;
    },
    onSuccess: () => toast.success("Cat saved ✨"),
    onError: (error: Error) => toast.error(error.message),
  });

  const purify = canUsePurify(profile);

  return {
    available: availability.available,
    loading: availability.isLoading || (inventory.isLoading && availability.available),
    profile,
    user,
    owned,
    inventory: inventory.data ?? new Set<string>(),
    buy,
    save,
    purify,
    balance: profile?.paw_balance ?? 0,
    refresh: () => qc.invalidateQueries({ queryKey: ["cat-studio"] }),
  };
}

/** A profile's saved cat, if it has one. */
export function catFromProfile(profile: Record<string, unknown> | null | undefined): CatConfig | null {
  if (!profile || profile.avatar_type !== "cat") return null;
  const raw = profile.avatar_config;
  const config = sanitizeCatConfig(typeof raw === "string" ? safeParse(raw) : raw);
  return config;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Which of the catalog ids a saved config is wearing (used by tests + UI). */
export function equippedIds(config: CatConfig): string[] {
  return Object.values(config.slots).filter((id): id is string => isCatItemId(id));
}

export function useOwnedIds() {
  const studio = useCatStudio();
  return useMemo(() => studio.inventory, [studio.inventory]);
}
