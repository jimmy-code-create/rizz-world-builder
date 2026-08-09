import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bug, Copy, Trash2 } from "lucide-react";
import { clearTraces, formatTrace, getTraces, subscribeTraces } from "@/lib/upload-trace";

/** Owner-only view of the last upload attempts and exactly where they broke. */
export function UploadDebugPanel() {
  const traces = useSyncExternalStore(
    (cb) => subscribeTraces(cb),
    () => getTraces(),
    () => [],
  );

  const copyAll = () => {
    navigator.clipboard.writeText(traces.map(formatTrace).join("\n\n"));
    toast.success("Debug trace copied");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-[var(--rizz-pink)]" />
        <p className="text-sm font-bold flex-1">Upload debug ({traces.length})</p>
        <Button size="sm" variant="outline" onClick={copyAll} disabled={traces.length === 0}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={clearTraces} disabled={traces.length === 0}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {traces.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No uploads this session. Try posting a reel — every step is recorded here with a request ID.
        </p>
      ) : (
        <div className="space-y-2 max-h-[40dvh] overflow-y-auto">
          {traces.map((t) => (
            <div key={t.id + t.startedAt} className="rounded-xl glass border border-white/10 p-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold">{t.id}</span>
                <span className="uppercase text-[10px] tracking-wider text-muted-foreground">{t.kind}</span>
                <span
                  className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    t.ok === true
                      ? "bg-emerald-500/20 text-emerald-300"
                      : t.ok === false
                        ? "bg-destructive/20 text-destructive"
                        : "bg-white/10 text-muted-foreground"
                  }`}
                >
                  {t.ok === true ? "success" : t.ok === false ? `failed · ${t.failedStep}` : "running"}
                </span>
              </div>
              <pre className="mt-1.5 text-[10px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground font-mono">
                {formatTrace(t)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}