import { Fragment, useState } from 'react';
import { renderGifSegments, parseMediaOnly } from '@/lib/gif-content';

function MediaWithFallback({
  src,
  kind,
}: {
  src: string;
  kind: 'gif' | 'sticker';
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <span className="my-1 flex max-w-[280px] items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
        Couldn&apos;t load {kind === 'gif' ? 'GIF' : 'sticker'}.
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setLoaded(false);
          }}
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </span>
    );
  }

  return (
    <span
      className={
        kind === 'sticker'
          ? 'relative my-1 inline-block max-w-[180px]'
          : 'relative my-1 block w-fit max-w-[min(72vw,280px)] overflow-hidden rounded-2xl border border-border bg-black/30'
      }
    >
      {!loaded && kind === 'gif' ? (
        <span aria-hidden="true" className="block h-40 w-56 max-w-full animate-pulse bg-secondary" />
      ) : null}
      <img
        src={src}
        alt={kind === 'gif' ? 'GIF' : 'Sticker'}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={
          kind === 'sticker'
            ? 'max-h-40 max-w-full object-contain align-middle'
            : `block max-h-72 w-auto max-w-full object-contain ${loaded ? '' : 'absolute inset-0 opacity-0'}`
        }
      />
      {kind === 'gif' ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">
          GIF
        </span>
      ) : null}
    </span>
  );
}

/**
 * GIF/sticker renderer shared by DMs, groups, realm chat and comments.
 *
 * A media-only message never gets a text bubble frame: the GIF is the message,
 * capped at min(72vw, 280px), with a 1px border, 16px radius and a small badge.
 * Inline GIFs inside a longer message keep flowing with the text.
 */
export function GifContent({ children, className }: { children: string; className?: string }) {
  const only = parseMediaOnly(children);
  if (only) {
    return (
      <span className={className}>
        <MediaWithFallback src={only.src} kind={only.kind} />
      </span>
    );
  }

  const parts = renderGifSegments(children);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.isSticker && part.value.endsWith('.webm')) {
          return (
            <video
              key={`sticker-${index}`}
              src={part.value}
              poster={part.value.replace(/\.webm$/i, '.png')}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Animated sticker"
              className="my-2 inline-block max-h-40 max-w-full rounded-xl object-contain align-middle"
            />
          );
        }
        if (part.isGif || part.isSticker) {
          return <MediaWithFallback key={`media-${index}`} src={part.value} kind={part.isSticker ? 'sticker' : 'gif'} />;
        }
        return part.value ? <Fragment key={`text-${index}`}>{part.value}</Fragment> : null;
      })}
    </span>
  );
}
