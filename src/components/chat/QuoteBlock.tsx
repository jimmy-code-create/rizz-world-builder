import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * ONE quoted block, reused by chat replies, story replies and forwards.
 *
 * The anatomy is fixed: a 3px lime rail, a 14% lime tint, a muted label, then a
 * single-line snippet and an optional thumbnail. It is deliberately quiet — no
 * border box, no shadow — so it reads as a quotation of another surface.
 */
export function QuoteBlock({
  label,
  snippet,
  thumbnailUrl,
  onClick,
  className,
  children,
}: {
  label: string;
  snippet?: string | null;
  thumbnailUrl?: string | null;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-r-lg bg-primary/[0.14] py-1 pl-2 pr-2 text-left border-l-[3px] border-primary',
        onClick && 'transition-colors hover:bg-primary/20',
        className,
      )}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-16 w-10 shrink-0 rounded-md border border-border object-cover"
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {snippet ? (
          <span className="block truncate text-[12px] leading-snug text-foreground/90">{snippet}</span>
        ) : null}
        {children}
      </span>
    </Wrapper>
  );
}
