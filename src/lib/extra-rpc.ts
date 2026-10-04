import { supabase } from "@/integrations/supabase/client";
import type { ExtraRpcMap } from "@/types/db-extra";

type ExtraRpcClient = {
  rpc<Name extends keyof ExtraRpcMap>(
    name: Name,
    args: ExtraRpcMap[Name]["Args"],
  ): PromiseLike<{
    data: ExtraRpcMap[Name]["Returns"] | null;
    error: { code?: string; message: string } | null;
  }>;
};

export async function callExtraRpc<Name extends keyof ExtraRpcMap>(
  name: Name,
  args: ExtraRpcMap[Name]["Args"],
): Promise<ExtraRpcMap[Name]["Returns"]> {
  const client = supabase as unknown as ExtraRpcClient;
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (data === null) throw new Error("The server returned no result.");
  return data as ExtraRpcMap[Name]["Returns"];
}

export function reactionErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message).toLowerCase()
      : "";

  if (
    ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code) ||
    message.includes("schema cache") ||
    message.includes("could not find the function") ||
    message.includes("does not exist")
  ) {
    return "Reactions need setup. Ask the owner to run backend-sql/11_reactions_likes.sql in Lovable Cloud.";
  }
  return "Couldn't update this reaction. Please try again.";
}