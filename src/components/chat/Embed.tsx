import { useState } from "react";
import { Check } from "lucide-react";
import { isHttpsUrl, type EmbedButton, type EmbedData } from "@/lib/embeds";
import { cn } from "@/lib/utils";

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
 * everything, links are https-only, images lazy-load.
 *
 * The card always fills the message column (never shrinks to its text), keeps
 * a flat 1px border and a 4px accent bar — no glow, so a stack of cards stays
 * quiet — and, for the bot greeting cards, shows the new member's round avatar
 * (or their initial) on the right.
 */
export function Embed({
  embed,
  onAction,
  actionDone = false,
}: {
  embed: EmbedData;
  /** Wired by chat rows; previews simply render the button inert. */
  onAction?: (button: EmbedButton) => void;
  /** The current member already waved at this card: keep the button disabled. */
  actionDone?: boolean;
}) {
  const [imageOk, setImageOk] = useState(true);
  const [thumbOk, setThumbOk] = useState(true);
  const [localDone, setLocalDone] = useState(false);
  const color = embed.color ?? "#2a2a2e";
  const welcomeCard = embed.button?.action === "wave";
  const inlineFields = (embed.fields ?? []).filter((f) => f.inline);
  const blockFields = (embed.fields ?? []).filter((f) => !f.inline);
  const thumbUrl = embed.thumbnail?.url;
  const showThumb = !!thumbUrl && isHttpsUrl(thumbUrl) && thumbOk;
  const showImage = !!embed.image?.url && isHttpsUrl(embed.image.url) && imageOk;
  // No profile photo (or the row was posted before the member uploaded one):
  // the greeting still gets a rounded tile with their initial, never a hole.
  const memberInitial = welcomeCard
    ? (embed.description ?? "").trim().split(/\s+/)[0]?.charAt(0).toUpperCase() ?? ""
    : "";
  const showFallbackThumb = welcomeCard && !showThumb && !!memberInitial;
  const done = actionDone || localDone;

  return (
    <article
      className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1d1e24]"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex min-w-0 items-start gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          {embed.author && (embed.author.name || embed.author.icon_url) && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#f2efe6]">
              {embed.author.icon_url && isHttpsUrl(embed.author.icon_url) && (
                <img
                  src={embed.author.icon_url}
                  alt=""
                  loading="lazy"
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
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
            <p className={cn("text-[17px] font-bold leading-snug text-[#f5f2e9]", embed.author ? "mt-1.5" : "")}>
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
            <button
              type="button"
              disabled={done}
              aria-pressed={done}
              onClick={(event) => {
                event.stopPropagation();
                setLocalDone(true);
                onAction?.(embed.button!);
              }}
              className={cn(
                "mt-3 inline-flex h-10 w-auto items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3d] disabled:cursor-default disabled:active:scale-100",
                done
                  ? "border border-[#c8ff3d]/25 bg-white/[0.06] text-[#c8ff3d]"
                  : "border border-transparent bg-[#c8ff3d] text-[#0a0a0b] hover:brightness-105 active:scale-[0.99] active:bg-[#b7ea2f]",
              )}
            >
              {done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
              {done ? (welcomeCard ? "Said hi" : embed.button.label || "Done") : embed.button.label || "Say hi"}
            </button>
          )}
          {(embed.footer?.text || embed.timestamp) && (
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#9a978f]">
              {embed.footer?.icon_url && isHttpsUrl(embed.footer.icon_url) && (
                <img src={embed.footer.icon_url} alt="" loading="lazy" className="h-3.5 w-3.5 rounded-full object-cover" />
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
        {(showThumb || showFallbackThumb) && (
          showThumb ? (
            <img
              src={thumbUrl!}
              alt=""
              loading="lazy"
              className={cn(
                "shrink-0 border border-white/10 object-cover",
                welcomeCard ? "h-14 w-14 rounded-full" : "h-[72px] w-[72px] rounded-xl",
              )}
              onError={() => setThumbOk(false)}
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#c8ff3d]/30 bg-[#c8ff3d]/10 text-lg font-bold text-[#c8ff3d]"
            >
              {memberInitial}
            </span>
          )
        )}
      </div>
      {showImage && (
        <img
          src={embed.image!.url}
          alt=""
          loading="lazy"
          className="max-h-72 w-full object-cover"
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
  actionDone,
}: {
  embeds: EmbedData[] | null | undefined;
  /** Called for card buttons — chat tails wire the wave + profile open. */
  onAction?: (button: EmbedButton, embed: EmbedData) => void;
  /** The viewer already pressed this card's action. */
  actionDone?: boolean;
}) {
  if (!embeds || embeds.length === 0) return null;
  return (
    <div className="mt-2 w-full space-y-2">
      {embeds.slice(0, 10).map((embed, i) => (
        <Embed
          key={i}
          embed={embed}
          actionDone={actionDone}
          onAction={onAction ? (button) => onAction(button, embed) : undefined}
        />
      ))}
    </div>
  );
}
