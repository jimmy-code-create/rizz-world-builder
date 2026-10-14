import { useEffect, useState } from "react";
import { ExternalLink, Globe, Play, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MediaViewer } from "@/components/media/MediaViewer";
import {
  ackDomain,
  hasAckedDomain,
  hideLinkPreview,
  isSuspiciousDomain,
  type LinkPreview,
  type PreviewScope,
  useLinkPreviewsEnabled,
  useMessageLinkPreviews,
} from "@/lib/link-preview";

/**
 * Link preview cards under a chat message.
 *
 * Everything is server-fetched and proxied (see /api/link-preview), so the
 * browser never calls the linked site. Tapping a card opens the leaving-RIZZ
 * confirmation once per domain; the message's own link text stays tappable.
 */
export function MessageLinkPreviews({
  text,
  messageId,
  scope,
  canHide,
  removed,
}: {
  text: string | null | undefined;
  messageId: string;
  scope: PreviewScope;
  /** The sender (always) or a realm moderator may remove the preview. */
  canHide: boolean;
  /** Set when the preview was already removed and we know it before rendering. */
  removed?: boolean;
}) {
  const enabled = useLinkPreviewsEnabled();
  const active = enabled && !removed;
  const { previews } = useMessageLinkPreviews(text ?? "", active);

  const [localRemoved, setLocalRemoved] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<LinkPreview | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  if (!active || localRemoved || !previews.length) return null;

  const remove = async () => {
    setLocalRemoved(true);
    try {
      await hideLinkPreview(messageId, scope);
      toast.success("Preview removed");
    } catch (error) {
      // Roll the card back and say so, instead of leaving a preview that lies.
      setLocalRemoved(false);
      toast.error(error instanceof Error ? error.message : "Couldn't remove that preview");
    }
  };

  const open = (preview: LinkPreview) => {
    const domain = preview.domain || "this link";
    if (isSuspiciousDomain(preview.domain) || !hasAckedDomain(preview.domain)) {
      setDontAsk(false);
      setConfirming(preview);
      return;
    }
    window.open(preview.url, "_blank", "noopener,noreferrer");
  };

  const confirmOpen = () => {
    if (!confirming) return;
    ackDomain(confirming.domain, dontAsk);
    window.open(confirming.url, "_blank", "noopener,noreferrer");
    setConfirming(null);
  };

  return (
    <div className="mt-1 flex w-full max-w-[20rem] flex-col gap-1.5">
      {previews.map((preview) =>
        "loading" in preview ? (
          <div key={preview.url} className="h-[4.5rem] w-full rounded-2xl border border-white/5 glass skeleton-shimmer" />
        ) : preview.ok ? (
          <PreviewCard
            key={preview.url}
            preview={preview}
            canHide={canHide}
            onOpen={() => open(preview)}
            onViewImage={() => setViewer(preview.imageUrl ?? preview.url)}
            onHide={() => void remove()}
          />
        ) : null,
      )}

      <MediaViewer open={!!viewer} src={viewer ?? ""} alt="" onClose={() => setViewer(null)} />

      <Sheet open={!!confirming} onOpenChange={(next) => { if (!next) setConfirming(null); }}>
        <SheetContent side="bottom" className="glass-strong rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
          <SheetTitle className="font-display text-lg">Leaving RIZZ</SheetTitle>
          <SheetDescription className="sr-only">Confirm before opening an external link</SheetDescription>
          <div className="mt-3 space-y-4">
            <div className="min-w-0 rounded-2xl border border-white/5 glass p-3">
              <p className="truncate text-sm font-semibold">{confirming?.title || confirming?.domain}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{confirming?.domain}</span>
              </p>
              {confirming && isSuspiciousDomain(confirming.domain) && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-300">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This domain has a pattern often used to imitate other sites. Check the spelling before you continue.
                </p>
              )}
            </div>
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-white/5 px-3">
              <Checkbox checked={dontAsk} onCheckedChange={(value) => setDontAsk(value === true)} aria-label="Don't ask again" />
              <span className="text-sm">Don't ask again</span>
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-12 flex-1 glass border-white/10" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button className="h-12 flex-1 gap-2 bg-primary text-primary-foreground" onClick={confirmOpen}>
                Open link <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * App-wide guard for plain external links (the tappable link text inside a
 * message, bios, posts). The first time you open a link on a domain the same
 * "Leaving RIZZ" sheet appears; after that the tap just opens the tab.
 */
export function ExternalLinkGuard() {
  const [pending, setPending] = useState<string | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!/^https?:\/\//i.test(href)) return;
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin) return;
        const domain = url.hostname.replace(/^www\./, "");
        if (!isSuspiciousDomain(domain) && hasAckedDomain(domain)) return;
        event.preventDefault();
        setDontAsk(false);
        setPending(url.toString());
      } catch {
        // A malformed href is left to the browser.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const domain = pending ? safeHost(pending) : "";
  const risky = pending ? isSuspiciousDomain(domain) : false;

  return (
    <Sheet open={!!pending} onOpenChange={(next) => { if (!next) setPending(null); }}>
      <SheetContent side="bottom" className="glass-strong rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
        <SheetTitle className="font-display text-lg">Leaving RIZZ</SheetTitle>
        <SheetDescription className="sr-only">Confirm before opening an external link</SheetDescription>
        <div className="mt-3 space-y-4">
          <div className="min-w-0 rounded-2xl border border-white/5 glass p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{domain}</span>
            </p>
            {risky && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This domain has a pattern often used to imitate other sites. Check the spelling before you continue.
              </p>
            )}
          </div>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-white/5 px-3">
            <Checkbox checked={dontAsk} onCheckedChange={(value) => setDontAsk(value === true)} aria-label="Don't ask again" />
            <span className="text-sm">Don't ask again</span>
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" className="h-12 flex-1 glass border-white/10" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              className="h-12 flex-1 gap-2 bg-primary text-primary-foreground"
              onClick={() => {
                if (!pending) return;
                ackDomain(domain, dontAsk);
                window.open(pending, "_blank", "noopener,noreferrer");
                setPending(null);
              }}
            >
              Open link <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PreviewCard({
  preview,
  canHide,
  onOpen,
  onViewImage,
  onHide,
}: {
  preview: LinkPreview;
  canHide: boolean;
  onOpen: () => void;
  onViewImage: () => void;
  onHide: () => void;
}) {
  const isImage = preview.kind === "image";
  const isVideo = preview.kind === "video";
  const risky = isSuspiciousDomain(preview.domain);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 glass">
      <button
        type="button"
        onClick={isImage ? onViewImage : onOpen}
        className="block w-full min-h-[48px] text-left transition-colors hover:bg-white/5 active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label={isImage ? `View image from ${preview.domain}` : `Open ${preview.title || preview.domain}`}
      >
        {preview.imageUrl && (
          <span className="relative block w-full bg-black/30">
            <img
              src={preview.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              data-no-viewer="true"
              className={isImage ? "max-h-72 w-full object-cover" : "h-36 w-full object-cover"}
            />
            {isVideo && (
              <span className="absolute inset-0 grid place-items-center bg-black/25">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 ring-1 ring-white/20">
                  <Play className="h-5 w-5 translate-x-[1px] fill-current" />
                </span>
              </span>
            )}
          </span>
        )}

        {!isImage && (
          <span className="block p-3">
            <span className="line-clamp-2 block text-[13px] font-semibold leading-snug">
              {preview.title || preview.domain}
            </span>
            {preview.description && (
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{preview.description}</span>
            )}
          </span>
        )}
      </button>

      <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1.5 text-[11px] text-muted-foreground">
        <Globe className="h-3 w-3 shrink-0" />
        {/* The real domain, always shown, so lookalike links are easier to spot. */}
        <span className="truncate">{preview.domain}</span>
        {risky && (
          <span className="ml-0.5 flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-300">
            <ShieldAlert className="h-3 w-3" /> Unusual link
          </span>
        )}
      </div>

      {canHide && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onHide();
          }}
          aria-label="Remove link preview"
          className="absolute right-1 top-1 grid h-12 w-12 place-items-center rounded-full text-white/90 transition-colors hover:bg-black/45 active:bg-black/60"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/55 ring-1 ring-white/15 backdrop-blur-sm">
            <X className="h-4 w-4" />
          </span>
        </button>
      )}
    </div>
  );
}
