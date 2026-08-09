/**
 * In-memory upload trace store. Records every step of a post/reel/story
 * upload so the owner can see exactly which step failed and what the
 * backend actually said. Never persisted, never sent anywhere.
 */
export type TraceStep = {
  step: string;
  at: number;
  ok: boolean;
  detail?: string;
};

export type UploadTrace = {
  id: string;
  kind: "post" | "reel" | "story";
  startedAt: number;
  finishedAt?: number;
  ok?: boolean;
  failedStep?: string;
  error?: string;
  steps: TraceStep[];
};

const MAX_TRACES = 25;
let traces: UploadTrace[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeTraces(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTraces(): UploadTrace[] {
  return traces;
}

export function clearTraces() {
  traces = [];
  emit();
}

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function startTrace(kind: UploadTrace["kind"]) {
  const trace: UploadTrace = { id: shortId(), kind, startedAt: Date.now(), steps: [] };
  traces = [trace, ...traces].slice(0, MAX_TRACES);
  emit();

  return {
    id: trace.id,
    step(step: string, detail?: string) {
      trace.steps.push({ step, at: Date.now(), ok: true, detail });
      emit();
    },
    fail(step: string, error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
      trace.steps.push({ step, at: Date.now(), ok: false, detail: message });
      trace.failedStep = step;
      trace.error = message;
      trace.ok = false;
      trace.finishedAt = Date.now();
      emit();
      return message;
    },
    done() {
      trace.ok = true;
      trace.finishedAt = Date.now();
      emit();
    },
  };
}

export function formatTrace(t: UploadTrace) {
  const lines = [
    `request ${t.id} · ${t.kind} · ${new Date(t.startedAt).toISOString()}`,
    `result: ${t.ok === true ? "success" : t.ok === false ? `FAILED at "${t.failedStep}"` : "in progress"}`,
  ];
  for (const s of t.steps) {
    const ms = s.at - t.startedAt;
    lines.push(`  ${s.ok ? "ok  " : "FAIL"} +${ms}ms  ${s.step}${s.detail ? ` — ${s.detail}` : ""}`);
  }
  return lines.join("\n");
}