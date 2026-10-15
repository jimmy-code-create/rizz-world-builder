import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Code2, Copy, ImageOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { ExternalVideoEmbed } from "@/components/ExternalVideoEmbed";
import { MarkdownText } from "@/components/MarkdownText";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { parseForumBody, type ForumBlock } from "@/lib/forum-content";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { providerFor } from "@/lib/music-sources";
import { cn } from "@/lib/utils";

/**
 * A post's or a reply's body, rendered.
 *
 * Fenced code becomes a real code block with a copy button, a standalone link
 * becomes the thing it is — a picture opens in the app's viewer, a YouTube link
 * uses the feed's embed (the same official iframe the reels use), and a music
 * link gets the shared player so Apple previews and audio files play inline.
 * Text is linkified with the caption renderer the feed uses, so #tags and
 * @mentions behave identically in a post and on the feed.
 */

function CodeBlock({ language, code }: { language: string | null; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2">
      <div className="flex items-center justify-between gap-2 rounded-t-[var(--forum-radius-sm)] border border-b-0 border-[var(--forum-border)] bg-[var(--forum-surface-raised)] px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" aria-hidden />
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(
              () => {
                setCopied(true);
                toast.success("Code copied");
                window.setTimeout(() => setCopied(false), 1600);
              },
              () => toast.error("Couldn't copy that"),
            );
          }}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--forum-border)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="forum-code rounded-t-none border-t-0 p-3">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Text with the feed's tag/mention/url behaviour, never inserting whitespace. */
function RichText({ text }: { text: string }) {
  return (
    <MarkdownText
      text={text}
      className="forum-prose break-words"
      renderPlainText={(plain) =>
        renderCaptionWithTags(plain).map((part, index) => {
          if (part.tag) {
            return (
              <Link
                key={index}
                to="/tag/$tag"
                params={{ tag: part.tag }}
                className="font-medium text-primary hover:underline"
              >
                {part.text}
              </Link>
            );
          }
          if (part.mention) {
            return (
              <Link
                key={index}
                to="/u/$username"
                params={{ username: part.mention }}
                className="mention-highlight font-medium hover:underline"
              >
                {part.text}
              </Link>
            );
          }
          if (part.url) {
            return (
              <a
                key={index}
                href={part.url}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-[var(--forum-accent)] hover:underline"
              >
                {part.text}
              </a>
            );
          }
          return <span key={index}>{part.text}</span>;
        })
      }
    />
  );
}

function ImageBlock({
  url,
  alt,
  onOpenImage,
  className,
}: {
  url: string;
  alt: string | null;
  onOpenImage?: (url: string) => void;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] px-3 py-2 text-[12px] text-muted-foreground">
        <ImageOff className="h-4 w-4" aria-hidden />
        Image unavailable
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenImage?.(url)}
      className={cn(
        "block w-full overflow-hidden rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
        onOpenImage ? "cursor-zoom-in" : "cursor-default",
        className,
      )}
    >
      <img
        src={url}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-[26rem] w-full object-cover"
      />
    </button>
  );
}

function blockKey(block: ForumBlock, index: number) {
  if (block.kind === "text") return `text-${index}-${block.text.slice(0, 12)}`;
  if (block.kind === "code") return `code-${index}-${block.code.slice(0, 12)}`;
  return `${block.kind}-${index}-${block.url}`;
}

export function ForumRichBody({
  body,
  attachments = [],
  onOpenImage,
  className,
}: {
  body: string | null | undefined;
  attachments?: string[];
  onOpenImage?: (url: string) => void;
  className?: string;
}) {
  const blocks = parseForumBody(body);
  const images = blocks.filter((block) => block.kind === "image").length;
  const attachedImages = attachments.filter((attachment) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(attachment));
  const otherAttachments = attachments.filter((attachment) => !attachedImages.includes(attachment));

  return (
    <div className={cn("text-[0.94em]", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "code") {
          return <CodeBlock key={blockKey(block, index)} language={block.language} code={block.code} />;
        }
        if (block.kind === "image") {
          return (
            <ImageBlock
              key={blockKey(block, index)}
              url={block.url}
              alt={block.alt}
              onOpenImage={onOpenImage}
              className="my-2"
            />
          );
        }
        if (block.kind === "video") {
          return (
            <div
              key={blockKey(block, index)}
              className="my-2 overflow-hidden rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)]"
            >
              <ExternalVideoEmbed sourceUrl={block.url} />
            </div>
          );
        }
        if (block.kind === "music") {
          const provider = providerFor(block.url);
          return (
            <div key={blockKey(block, index)} className="my-2 max-w-lg">
              <MusicPlayer track={{ title: provider.label, url: block.url }} />
            </div>
          );
        }
        if (block.kind === "link") {
          return (
            <a
              key={blockKey(block, index)}
              href={block.url}
              target="_blank"
              rel="noreferrer noopener"
              className="my-2 flex items-center gap-2 overflow-hidden rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] px-3 py-2 text-[12px] text-[var(--forum-accent)] hover:underline"
            >
              <span className="truncate">{block.url.replace(/^https?:\/\//, "")}</span>
            </a>
          );
        }
        return (
          <div key={blockKey(block, index)} className="mb-2 last:mb-0">
            <RichText text={block.text} />
          </div>
        );
      })}

      {/* A gallery: every picture the post carries, side by side. */}
      {attachedImages.length > 0 && (
        <div
          className={cn(
            "mt-2 grid gap-2",
            attachedImages.length === 1 ? "grid-cols-1" : attachedImages.length === 2 ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {attachedImages.map((url) => (
            <ImageBlock
              key={url}
              url={url}
              alt={null}
              onOpenImage={onOpenImage}
              className={images === 0 && attachedImages.length === 1 ? "aspect-video" : "aspect-square"}
            />
          ))}
        </div>
      )}

      {otherAttachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {otherAttachments.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="forum-chip text-[11px] text-muted-foreground hover:text-foreground"
              >
                {url.split("/").pop()?.slice(0, 32) || "Attachment"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Just the media, for a gallery card: the first picture, big. */
export function ForumThumb({
  url,
  alt,
  onOpenImage,
  className,
  children,
}: {
  url: string;
  alt: string;
  onOpenImage?: (url: string) => void;
  className?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpenImage?.(url)}
      className={cn(
        "relative block w-full overflow-hidden rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
        className,
      )}
    >
      {failed ? (
        <span className="grid h-full w-full place-items-center text-muted-foreground">
          <ImageOff className="h-5 w-5" aria-hidden />
        </span>
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
      {children}
    </button>
  );
}
