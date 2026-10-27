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
            className="break-all text-[#c8ff3d] hover:underline"
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

function SafeLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  if (!isHttpsUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={className}>
      {children}
    </a>
  );
}

/**
 * One Discord-style embed card: colored left bar, author row, linked title,
 * description, field grid (inline fields up to 3 columns), big image,
 * thumbnail on the right, footer + timestamp. Plain text only — React escapes
 * everything, links are https-only, images lazy-load. Fits 380px.
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
  const color = embed.color ?? "#2a2a2e";
  const inlineFields = (embed.fields ?? []).filter((f) => f.inline);
  const blockFields = (embed.fields ?? []).filter((f) => !f.inline);
  const showThumb = !!embed.thumbnail?.url && isHttpsUrl(embed.thumbnail.url) && thumbOk;
  const showImage = !!embed.image?.url && isHttpsUrl(embed.image.url) && imageOk;

  return (
    // Bot cards are flat black rectangles, full width, squared corners: the
    // message text sits above them and the card reads as one solid panel
    // instead of a second bubble floating in the conversation.
    <article
      className="w-full overflow-hidden rounded-lg border border-white/[0.07] bg-[#0b0b0c]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex min-w-0 gap-3 p-3">
        <div className="min-w-0 flex-1">
          {embed.author && (embed.author.name || embed.author.icon_url) && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#f2efe6]">
              {embed.author.icon_url && isHttpsUrl(embed.author.icon_url) && (
                <img
                  src={embed.author.icon_url}
                  alt=""
                  loading="lazy"
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                  onError={() => setThumbOk(false)}
                />
              )}
              {embed.author.name && embed.author.url ? (
                <SafeLink href={embed.author.url} className="truncate hover:underline">
                  {embed.author.name}
                </SafeLink>
              ) : (
                <span className="truncate">{embed.author.name}</span>
              )}
            </p>
          )}
          {embed.title && (
            <p className="mt-1 text-sm font-bold leading-snug text-[#f2efe6]">
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
            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#f2efe6]/90">
              <LinkText text={embed.description} />
            </p>
          )}
          {blockFields.map((f, i) => (
            <div key={`b-${i}`} className="mt-2">
              <p className="text-xs font-bold text-[#f2efe6]">{f.name}</p>
              <p className="whitespace-pre-wrap break-words text-[13px] text-[#f2efe6]/85">
                <LinkText text={f.value} />
              </p>
            </div>
          ))}
          {inlineFields.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
              {inlineFields.map((f, i) => (
                <div key={`f-${i}`} className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#f2efe6]">{f.name}</p>
                  <p className="whitespace-pre-wrap break-words text-[13px] text-[#f2efe6]/85">
                    <LinkText text={f.value} />
                  </p>
                </div>
              ))}
            </div>
          )}
          {embed.button && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.(embed.button!);
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 px-3 text-[12.5px] font-semibold text-[#c8ff3d] transition-colors hover:bg-[#c8ff3d]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3d]"
              >
                {embed.button.label || "Say hi"}
              </button>
            </div>
          )}
          {(embed.footer?.text || embed.timestamp) && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {embed.footer?.icon_url && isHttpsUrl(embed.footer.icon_url) && (
                <img src={embed.footer.icon_url} alt="" loading="lazy" className="h-4 w-4 rounded-full object-cover" />
              )}
              {embed.footer?.text && <span className="truncate">{embed.footer.text}</span>}
              {embed.footer?.text && embed.timestamp && <span aria-hidden>·</span>}
              {embed.timestamp && (
                <time dateTime={embed.timestamp} title={new Date(embed.timestamp).toLocaleString()}>
                  {new Date(embed.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
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
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
            onError={() => setThumbOk(false)}
          />
        )}
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
        <Embed key={i} embed={embed} onAction={onAction ? (button) => onAction(button, embed) : undefined} />
      ))}
    </div>
  );
}
