import { useState } from "react";
import { isHttpsUrl, type EmbedButton, type EmbedData } from "@/lib/embeds";

function LinkText({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/[^\s]+)/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        /^https:\/\/[^\s]+$/.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function SafeLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!isHttpsUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {children}
    </a>
  );
}

const ACCENT_FALLBACK = "#c9ff3d";

/**
 * A bot card, drawn in this app's language rather than Discord's.
 *
 * The old card was the Discord embed translated into classes: a 3px colour bar
 * down the left edge, an author line above a bold title, a field grid and a
 * footer — the exact silhouette everyone recognises. This one keeps the data
 * (author, title, body, fields, image, button, footer) but rebuilds the shape:
 *
 *  - the bot's colour becomes a soft wash behind the header instead of a stripe,
 *  - the heading speaks in the display face the rest of the app uses,
 *  - inline fields are tiles on a hairline grid, not three squeezed columns,
 *  - the action is a pill in the signal colour, like every other button here.
 *
 * Nothing about the contract moved: https-only links, plain text, lazy images,
 * one optional action, and the caller still decides what that action does.
 */
export function Embed({
  embed,
  onAction,
}: {
  embed: EmbedData;
  /** Wired by chat rows; previews simply render the button inert. */
  onAction?: (button: EmbedButton) => void;
}) {
  const [imageOk, setImageOk] = useState(true);
  const [thumbOk, setThumbOk] = useState(true);
  // The colour arrives from a bot payload, so it is checked again here: a bad
  // string in a style attribute is a small hole, not a cosmetic issue.
  const accent = /^#[0-9a-f]{6}$/i.test(embed.color ?? "") ? embed.color! : ACCENT_FALLBACK;
  const inlineFields = (embed.fields ?? []).filter((f) => f.inline);
  const blockFields = (embed.fields ?? []).filter((f) => !f.inline);
  const showThumb = !!embed.thumbnail?.url && isHttpsUrl(embed.thumbnail.url) && thumbOk;
  const showImage = !!embed.image?.url && isHttpsUrl(embed.image.url) && imageOk;
  const showAuthor = !!(embed.author?.name || embed.author?.icon_url);

  return (
    <article
      className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-card"
      style={{ boxShadow: `inset 0 1px 0 0 ${accent}33` }}
    >
      <div className="relative">
        {/* The bot's colour, as light rather than as a bar. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={{ background: `linear-gradient(180deg, ${accent}1f 0%, transparent 100%)` }}
        />
        <div className="relative flex min-w-0 gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            {showAuthor && (
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                {embed.author?.icon_url && isHttpsUrl(embed.author.icon_url) && (
                  <img
                    src={embed.author.icon_url}
                    alt=""
                    loading="lazy"
                    className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                    onError={() => setThumbOk(false)}
                  />
                )}
                {embed.author?.name && embed.author.url ? (
                  <SafeLink href={embed.author.url} className="truncate hover:text-foreground">
                    {embed.author.name}
                  </SafeLink>
                ) : (
                  <span className="truncate">{embed.author?.name}</span>
                )}
              </p>
            )}
            {embed.title && (
              <p
                className={`font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground ${showAuthor ? "mt-1" : ""}`}
              >
                {embed.url ? (
                  <SafeLink href={embed.url} className="hover:underline">
                    {embed.title}
                  </SafeLink>
                ) : (
                  embed.title
                )}
              </p>
            )}
            {embed.description && (
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/85">
                <LinkText text={embed.description} />
              </p>
            )}

            {blockFields.map((f, i) => (
              <div key={`b-${i}`} className="mt-2.5">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {f.name}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/85">
                  <LinkText text={f.value} />
                </p>
              </div>
            ))}

            {inlineFields.length > 0 && (
              // Tiles on one hairline grid: the same three facts as Discord's
              // inline fields, but they read as a stat strip instead of columns.
              <div className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.07] min-[360px]:grid-cols-3">
                {inlineFields.map((f, i) => (
                  <div key={`f-${i}`} className="min-w-0 bg-card px-2.5 py-2">
                    <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {f.name}
                    </p>
                    <p className="mt-0.5 break-words text-[13px] font-semibold leading-tight text-foreground tabular-nums">
                      <LinkText text={f.value} />
                    </p>
                  </div>
                ))}
              </div>
            )}

            {embed.button && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction?.(embed.button!);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[12px] font-bold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {embed.button.label || "Say hi"}
                </button>
              </div>
            )}

            {(embed.footer?.text || embed.timestamp) && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                {embed.footer?.icon_url && isHttpsUrl(embed.footer.icon_url) && (
                  <img
                    src={embed.footer.icon_url}
                    alt=""
                    loading="lazy"
                    className="h-3.5 w-3.5 rounded-full object-cover"
                  />
                )}
                {embed.footer?.text && <span className="truncate">{embed.footer.text}</span>}
                {embed.footer?.text && embed.timestamp && <span aria-hidden>·</span>}
                {embed.timestamp && (
                  <time
                    dateTime={embed.timestamp}
                    title={new Date(embed.timestamp).toLocaleString()}
                  >
                    {new Date(embed.timestamp).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                )}
              </p>
            )}
          </div>
          {showThumb && (
            <img
              src={embed.thumbnail!.url}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
              onError={() => setThumbOk(false)}
            />
          )}
        </div>
      </div>
      {showImage && (
        <img
          src={embed.image!.url}
          alt=""
          loading="lazy"
          className="max-h-80 w-full bg-black object-cover"
          onError={() => setImageOk(false)}
        />
      )}
    </article>
  );
}

/** The embed cards under a bot message's text (max 10, enforced server-side). */
export function EmbedList({
  embeds,
  onAction,
}: {
  embeds: EmbedData[] | null | undefined;
  /** Called for card buttons — chat tails wire the wave + profile open. */
  onAction?: (button: EmbedButton, embed: EmbedData) => void;
}) {
  if (!embeds || embeds.length === 0) return null;
  // Stacked, full width, one gap: the cards line up with the message column.
  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      {embeds.slice(0, 10).map((embed, i) => (
        <Embed
          key={i}
          embed={embed}
          onAction={onAction ? (button) => onAction(button, embed) : undefined}
        />
      ))}
    </div>
  );
}
