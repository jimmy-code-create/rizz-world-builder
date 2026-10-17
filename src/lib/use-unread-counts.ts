import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Unread counts shared by the app shell (badges, notification ping) and the
 * What's-happening page. Identical React Query keys keep the shell's realtime
 * invalidation working for both subscribers.
 */
export function useUnreadCounts() {
  const { user } = useAuth();

  const notifications = useQuery({
    queryKey: ["unread-notifs", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  const messages = useQuery({
    queryKey: ["unread-dms", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("direct_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  return {
    notifications: notifications.data ?? 0,
    messages: messages.data ?? 0,
    loaded: notifications.isSuccess && messages.isSuccess,
  };
}
