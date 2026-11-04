import { MessageSquare, Sparkles } from "lucide-react";
import { CloseButton } from "@/components/ui/close-button";
import { InteractiveAvatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n";
import type { FeedPost } from "@/lib/posts";
import { FollowSuggestions } from "@/components/FollowSuggestions";
import { CommentSection } from "@/components/comments/CommentSection";

/**
 * The desktop discussion pane: the feed keeps its place on the left, the
 * conversation lives on the right.
 *
 * The thread is `CommentSection` — the same nested, votable, reactable,
 * deletable thread as the full-screen page and reel comments — so opening a
 * post here is not a lesser version of opening it on a phone.
 */
export function FeedSideDiscussion({
  activePost,
  onClose,
}: {
  activePost: FeedPost | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  if (!activePost) {
    return (
      <div className="space-y-4">
        {/* Desktop Discussion Helper Card */}
        <div className="glass rounded-3xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <MessageSquare className="h-4 w-4" />
            <h3 className="text-sm font-display font-bold text-foreground">
              {t("side_discussions")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            On wide screens, tap the comment icon on any post to read and reply here side-by-side
            without losing your place in the feed.
          </p>
        </div>

        <FollowSuggestions />

        {/* Gen Z Creator Tip */}
        <div className="glass rounded-3xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
              {t("vibe_check")}
            </h4>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Drop polls and GIFs to spark more reactions. Active contributors earn exclusive profile
            badges and drops.
          </p>
        </div>
      </div>
    );
  }

  const postAuthor = activePost.author?.display_name || activePost.author?.username || "creator";

  return (
    <div className="glass-strong rounded-3xl border border-border overflow-hidden flex flex-col h-[calc(100dvh-6rem)] sticky top-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <InteractiveAvatar
            src={activePost.author?.avatar_url}
            fallback={postAuthor.charAt(0).toUpperCase()}
            size={24}
            userId={activePost.author_id}
            username={activePost.author?.username}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{t("discussion")}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              @{activePost.author?.username}
            </p>
          </div>
        </div>
        <CloseButton onClick={onClose} aria-label="Close discussion pane" />
      </div>

      {/* Post Caption Preview */}
      {activePost.caption && (
        <div className="px-4 py-2.5 bg-surface-2 border-b border-border text-xs text-muted-foreground line-clamp-3">
          &ldquo;{activePost.caption}&rdquo;
        </div>
      )}

      <CommentSection postId={activePost.id} className="min-h-0 flex-1" />
    </div>
  );
}
