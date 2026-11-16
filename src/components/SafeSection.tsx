import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * One rail, one card, one composer — not the whole page.
 *
 * A throw anywhere inside the feed unmounts the entire route, so a single
 * undefined list on one rail replaced every post with "Couldn't load this
 * page". React has no built-in "skip this subtree" behaviour, so this holds the
 * failure at the section that caused it: the rest of the feed keeps working and
 * the broken section says what happened, in place, instead of taking the page
 * down with it.
 *
 * The message is shown rather than hidden on purpose: this is a build being
 * worked on, and a section that silently disappears is a bug nobody can find.
 */
export class SafeSection extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[section:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-left">
        <p className="text-[12px] font-semibold text-destructive">
          {this.props.name} couldn&apos;t load
        </p>
        <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground">
          {error.message}
        </p>
        <p className="mt-1 break-all text-[10px] leading-snug text-muted-foreground/60">
          {(error.stack ?? "").split("\n").slice(1, 3).join(" · ")}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-foreground"
        >
          Retry section
        </button>
      </div>
    );
  }
}
