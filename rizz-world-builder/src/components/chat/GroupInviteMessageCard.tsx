import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { previewGroupInvite } from "@/lib/groups";

type Props = {
  code: string;
  message?: string;
};

const statusText: Record<string, string> = {
  valid: "Private group invite",
  already_member: "You’re already a member",
  expired: "This invite has expired",
  limit_reached: "This invite has reached its use limit",
  revoked_or_invalid: "This invite is unavailable",
};

export function GroupInviteMessageCard({ code, message }: Props) {
  const preview = useQuery({
    queryKey: ["group-invite-preview", code],
    queryFn: () => previewGroupInvite(code),
    enabled: Boolean(code),
    retry: false,
    staleTime: 60_000,
  });
  const group = preview.data;
  const accent = group?.accent_color || "#ff2d92";

  return (
    <div className="w-full min-w-0 max-w-[78vw]">
      {message && (
        <p className="mb-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message}
        </p>
      )}
      <Link
        to="/join/$code"
        params={{ code }}
        className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[var(--surface-bubble)] p-3 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
      >
        <span
          className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, #6d28d9)` }}
        >
          {group?.icon_url ? (
            <img src={group.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Users aria-hidden="true" className="h-5 w-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Group invitation
          </span>
          <span className="block truncate text-sm font-semibold">
            {group?.group_name || (preview.isLoading ? "Loading group…" : "Private RIZZ group")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {group?.member_count != null
              ? `${group.member_count} member${group.member_count === 1 ? "" : "s"} · ${statusText[group.status] ?? "Private group"}`
              : preview.isError
                ? "Preview unavailable"
                : group?.topic || statusText[group?.status ?? "valid"]}
          </span>
        </span>
        <span className="grid min-h-10 min-w-14 shrink-0 place-items-center rounded-xl bg-gradient-primary px-3 text-sm font-semibold text-white shadow-sm">
          Join
        </span>
      </Link>
    </div>
  );
}