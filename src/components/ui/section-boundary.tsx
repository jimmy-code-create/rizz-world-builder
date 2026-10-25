import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { label: string; children: ReactNode };
type State = { error: Error | null; componentStack: string };

/**
 * Keeps one broken subtree from blanking a whole route. The route-level
 * boundary in `_app` replaces the entire page (nav, composer, everything), so a
 * single bad post or story row used to make /feed unloadable. Wrapping each
 * section means the rest of the page keeps working.
 *
 * The caught error is written to `localStorage["rizz:last-error"]` (label,
 * message and stack) because production users can't open a console for us; the
 * inline card also exposes the stack under "Details".
 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? "" });
    const payload = {
      label: this.props.label,
      message: error.message,
      stack: error.stack ?? "",
      componentStack: info.componentStack ?? "",
      url: typeof window === "undefined" ? "" : window.location.href,
      at: new Date().toISOString(),
    };
    console.error(`[section:${this.props.label}]`, error);
    try {
      localStorage.setItem("rizz:last-error", JSON.stringify(payload));
    } catch {
      // Private mode or a full quota: the console log above is enough.
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-3 text-left">
        <p className="text-xs font-semibold text-foreground">This part couldn’t load</p>
        <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground">
          {error.message || "Something unexpected happened."}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
            Details
          </summary>
          {this.state.componentStack && (
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-2 text-[10px] leading-snug text-muted-foreground">
              {this.state.componentStack.trim()}
            </pre>
          )}
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-2 text-[10px] leading-snug text-muted-foreground">
            {error.stack || error.message}
          </pre>
        </details>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-2 min-h-[44px] text-[11px] font-semibold text-primary"
        >
          Try again
        </button>
      </div>
    );
  }
}
