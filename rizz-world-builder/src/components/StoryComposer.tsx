import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Type, Smile, Image as ImageIcon, Palette, Trash2, Loader2, Send, Wand2, Undo2, Copy, Sparkles, Layers, AlignCenter, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { FullScreenLayer } from "@/components/FullScreenLayer";

type Overlay = {
  id: string;
  kind: "text" | "sticker";
  value: string;
  x: number; // 0..1 of canvas width
  y: number; // 0..1 of canvas height
  scale: number;
  rotate: number;
  color?: string;
  font?: string;
  animation?: "none" | "pulse" | "bounce" | "spin" | "fade" | "slideIn";
  opacity?: number;
  zIndex?: number;
};

// Sticker categories
const STICKER_CATEGORIES = {
  "Popular": ["🔥","💖","✨","💀","👑","😎","🥹","🫶","🎉","💯","👀","🌈","⚡️","🍕","🌙","☀️","🦋","🐉","🍀","🪩"],
  "Emotions": ["😂","😍","🥰","😘","😭","😱","😡","🤔","😴","🤩","😇","🤯","😈","🥳","🤗","😏","🙄","😬","🤐","😶"],
  "Nature": ["🌸","🌺","🌻","🌷","🌹","🌴","🌵","🍁","🌾","🌿","☘️","🍀","🌈","⭐","✨","💫","☀️","🌙","⚡️","💧"],
  "Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🦄","🐉","🦋","🐝","🐠"],
  "Food": ["🍕","🍔","🌭","🍟","🍿","🎂","🍰","🧁","🍩","🍪","🍫","🍬","🍭","🍦","🍧","🍨","🥤","🍹","☕","🍺"],
  "Objects": ["💎","👑","🎁","🎈","🎊","🎉","🎀","🔮","💝","💌","📸","🎵","🎸","🎮","🏀","⚽","🎯","🎲","🎨","✏️"],
};

const FILTERS: { name: string; css: string }[] = [
  { name: "None",       css: "none" },
  { name: "Bloom",      css: "saturate(1.3) contrast(1.05) brightness(1.05)" },
  { name: "Noir",       css: "grayscale(1) contrast(1.15)" },
  { name: "Sepia",      css: "sepia(0.7) saturate(1.2)" },
  { name: "Cool",       css: "hue-rotate(200deg) saturate(1.1)" },
  { name: "Vivid",      css: "saturate(1.6) contrast(1.1)" },
  { name: "Fade",       css: "contrast(0.9) brightness(1.1) saturate(0.85)" },
  { name: "Warm",       css: "sepia(0.3) saturate(1.2) brightness(1.05)" },
  { name: "Arctic",     css: "hue-rotate(180deg) saturate(1.3) brightness(1.1)" },
  { name: "Sunset",     css: "sepia(0.4) hue-rotate(-20deg) saturate(1.4)" },
  { name: "Vintage",    css: "sepia(0.5) contrast(0.9) brightness(1.05)" },
  { name: "Drama",      css: "contrast(1.3) saturate(1.2) brightness(0.9)" },
  { name: "Dreamy",     css: "blur(0.5px) brightness(1.1) saturate(0.9)" },
  { name: "Neon",       css: "saturate(2) contrast(1.2) brightness(1.15)" },
];

const TEXT_COLORS = ["#ffffff","#000000","#ff3ea5","#7c3aed","#22d3ee","#fde047","#f97316","#10b981","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

const FONTS = ["display","sans","serif","mono","script","bold"];
const fontFor = (k?: string) => {
  if (k === "serif") return "Georgia, serif";
  if (k === "mono") return "ui-monospace, monospace";
  if (k === "display") return "var(--font-display, 'Space Grotesk'), system-ui";
  if (k === "script") return "cursive";
  if (k === "bold") return "system-ui, sans-serif";
  return "system-ui, sans-serif";
};

const ANIMATIONS = [
  { name: "None", value: "none" },
  { name: "Pulse", value: "pulse" },
  { name: "Bounce", value: "bounce" },
  { name: "Spin", value: "spin" },
  { name: "Fade", value: "fade" },
  { name: "Slide", value: "slideIn" },
];

const CANVAS_W = 1080;
const CANVAS_H = 1920;

export function StoryComposer({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted?: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("none");
  const [bg, setBg] = useState<string>("linear-gradient(135deg,#ff3ea5,#7c3aed)");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"text"|"sticker"|"filter"|"bg"|"animation"|null>(null);
  const [stickerCategory, setStickerCategory] = useState<keyof typeof STICKER_CATEGORIES>("Popular");
  const [history, setHistory] = useState<Overlay[][]>([]);
  const [redoStack, setRedoStack] = useState<Overlay[][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const pushHistory = (prev: Overlay[]) => {
    setHistory((h) => [...h.slice(-19), prev]);
    setRedoStack([]); // Clear redo stack on new action
  };
  
  const undo = () => {
    if (history.length === 0) return;
    setRedoStack((r) => [overlays, ...r.slice(0, 19)]);
    const last = history[history.length - 1];
    setOverlays(last);
    setHistory((h) => h.slice(0, -1));
  };
  
  const redo = () => {
    if (redoStack.length === 0) return;
    setHistory((h) => [...h, overlays]);
    const next = redoStack[0];
    setOverlays(next);
    setRedoStack((r) => r.slice(1));
  };

  useEffect(() => {
    if (!open) {
      setFile(null); setMediaUrl(null); setIsVideo(false);
      setOverlays([]); setSelected(null); setFilter("none");
      setBg("linear-gradient(135deg,#ff3ea5,#7c3aed)"); setPanel(null);
      setHistory([]); setRedoStack([]); setEditingId(null);
      setShowLayerPanel(false); setStickerCategory("Popular");
    }
  }, [open]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setMediaUrl(URL.createObjectURL(f));
  };

  const addText = () => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    const zIndex = Math.max(0, ...overlays.map(o => o.zIndex ?? 0)) + 1;
    setOverlays((o) => [...o, { id, kind:"text", value:"Tap to edit", x:0.5, y:0.5, scale:1, rotate:0, color:"#ffffff", font:"display", animation:"none", opacity:1, zIndex }]);
    setSelected(id); setPanel(null); setEditingId(id);
  };
  const addSticker = (s: string) => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    const zIndex = Math.max(0, ...overlays.map(o => o.zIndex ?? 0)) + 1;
    setOverlays((o) => [...o, { id, kind:"sticker", value:s, x:0.5, y:0.5, scale:1.5, rotate:0, animation:"none", opacity:1, zIndex }]);
    setSelected(id);
  };
  const updateSelected = (patch: Partial<Overlay>) => {
    if (!selected) return;
    setOverlays((o) => o.map((it) => it.id === selected ? { ...it, ...patch } : it));
  };
  const removeSelected = () => {
    if (!selected) return;
    pushHistory(overlays);
    setOverlays((o) => o.filter((it) => it.id !== selected));
    setSelected(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const it = overlays.find((o) => o.id === selected); if (!it) return;
    pushHistory(overlays);
    const id = crypto.randomUUID();
    const zIndex = Math.max(0, ...overlays.map(o => o.zIndex ?? 0)) + 1;
    setOverlays((o) => [...o, { ...it, id, x: Math.min(0.9, it.x + 0.05), y: Math.min(0.9, it.y + 0.05), zIndex }]);
    setSelected(id);
  };
  
  const moveLayer = (id: string, direction: "up" | "down") => {
    pushHistory(overlays);
    setOverlays((curr) => {
      const idx = curr.findIndex((o) => o.id === id);
      if (idx === -1) return curr;
      const sorted = [...curr].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      const sortedIdx = sorted.findIndex((o) => o.id === id);
      if (direction === "up" && sortedIdx < sorted.length - 1) {
        const above = sorted[sortedIdx + 1];
        return curr.map((o) => 
          o.id === id ? { ...o, zIndex: above.zIndex } :
          o.id === above.id ? { ...o, zIndex: sorted[sortedIdx].zIndex } : o
        );
      } else if (direction === "down" && sortedIdx > 0) {
        const below = sorted[sortedIdx - 1];
        return curr.map((o) => 
          o.id === id ? { ...o, zIndex: below.zIndex } :
          o.id === below.id ? { ...o, zIndex: sorted[sortedIdx].zIndex } : o
        );
      }
      return curr;
    });
  };
  
  const centerSelected = () => {
    if (!selected) return;
    pushHistory(overlays);
    updateSelected({ x: 0.5, y: 0.5 });
  };

  // Multi-touch drag / pinch / rotate
  const onDragOverlay = (id: string) => (e: React.PointerEvent) => {
    if (editingId === id) return;
    const stage = stageRef.current; if (!stage) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    const rect = stage.getBoundingClientRect();
    const start = overlays.find((o) => o.id === id);
    if (!start) return;
    pushHistory(overlays);

    const pts = new Map<number, { x: number; y: number }>();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    let baseScale = start.scale, baseRotate = start.rotate;
    let initDist = 0, initAngle = 0;

    const trashHit = (cx: number, cy: number) => {
      const t = document.getElementById("story-trash");
      if (!t) return false;
      const r = t.getBoundingClientRect();
      return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    };

    const move = (ev: PointerEvent) => {
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const arr = Array.from(pts.values());
      if (arr.length >= 2) {
        const [a, b] = arr;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (initDist === 0) { initDist = dist; initAngle = angle; return; }
        const scale = Math.max(0.3, Math.min(6, baseScale * (dist / initDist)));
        const rotate = baseRotate + (angle - initAngle);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
        setOverlays((cur) => cur.map((it) => it.id === id ? { ...it, x, y, scale, rotate } : it));
      } else if (arr.length === 1) {
        const p = arr[0];
        const x = Math.max(0, Math.min(1, (p.x - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (p.y - rect.top) / rect.height));
        setDragOverTrash(trashHit(p.x, p.y));
        setOverlays((cur) => cur.map((it) => it.id === id ? { ...it, x, y } : it));
      }
    };
    const up = (ev: PointerEvent) => {
      pts.delete(ev.pointerId);
      if (pts.size === 0) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        // Trash drop
        if (dragOverTrash) {
          setOverlays((cur) => cur.filter((it) => it.id !== id));
          setSelected(null);
        }
        setDragOverTrash(false);
      } else {
        initDist = 0; // reset pinch base
      }
    };
    const extra = (ev: PointerEvent) => {
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      initDist = 0;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("pointerdown", extra);
    // cleanup extra listener on end
    const stopExtra = () => window.removeEventListener("pointerdown", extra);
    window.addEventListener("pointerup", stopExtra, { once: true });
  };

  const sel = overlays.find((o) => o.id === selected) || null;

  // Render final image (image bg only). For video, upload raw video + caption from first text overlay.
  async function compose(): Promise<{ blob: Blob; type: "image"|"video" }> {
    if (isVideo && file) return { blob: file, type: "video" };
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;
    // background
    if (mediaUrl) {
      const img = await loadImage(mediaUrl);
      ctx.filter = filter;
      drawCover(ctx, img, CANVAS_W, CANVAS_H);
      ctx.filter = "none";
    } else {
      // gradient bg
      paintCssBg(ctx, bg, CANVAS_W, CANVAS_H);
    }
    // overlays - sort by zIndex
    const sorted = [...overlays].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    for (const ov of sorted) {
      ctx.save();
      ctx.globalAlpha = ov.opacity ?? 1;
      ctx.translate(ov.x * CANVAS_W, ov.y * CANVAS_H);
      ctx.rotate((ov.rotate * Math.PI) / 180);
      const baseSize = ov.kind === "text" ? 72 : 140;
      const size = baseSize * ov.scale;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (ov.kind === "text") {
        const fontWeight = ov.font === "bold" ? "900" : "700";
        ctx.font = `${fontWeight} ${size}px ${fontFor(ov.font)}`;
        ctx.fillStyle = ov.color || "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
        ctx.fillText(ov.value, 0, 0);
      } else {
        ctx.font = `${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji"`;
        ctx.fillText(ov.value, 0, 0);
      }
      ctx.restore();
    }
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    return { blob, type: "image" };
  }

  async function post() {
    if (!user) { toast.error("Sign in first"); return; }
    if (!mediaUrl && overlays.length === 0) { toast.error("Add media or a sticker/text"); return; }
    setBusy(true);
    try {
      const { blob, type } = await compose();
      const ext = type === "video" ? (file?.name.split(".").pop() ?? "mp4") : "jpg";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, blob, { contentType: blob.type || (type==="video"?"video/mp4":"image/jpeg") });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
      const caption = overlays.find((o) => o.kind === "text")?.value ?? null;
      const { error: insErr } = await supabase.from("stories").insert({ author_id: user.id, media_url: pub.publicUrl, media_type: type, caption });
      if (insErr) throw insErr;
      toast.success("Story posted ✨");
      onPosted?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't post story");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <FullScreenLayer open={open}>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col overscroll-none"
      style={{ height: "100dvh" }}
    >
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="h-9 w-9 rounded-full glass-strong grid place-items-center">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={history.length === 0} className="h-9 w-9 rounded-full glass-strong grid place-items-center disabled:opacity-40" aria-label="Undo">
            <Undo2 className="h-5 w-5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="h-9 w-9 rounded-full glass-strong grid place-items-center disabled:opacity-40" aria-label="Redo">
            <Redo2 className="h-5 w-5" />
          </button>
          <button onClick={() => setShowLayerPanel(!showLayerPanel)} className="h-9 w-9 rounded-full glass-strong grid place-items-center" aria-label="Layers">
            <Layers className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold hidden xs:block sm:block">New story</div>
        </div>
        <Button onClick={post} disabled={busy} size="sm" className="bg-gradient-primary shadow-glow rounded-full px-4 h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Share</>}
        </Button>
      </div>

      {/* Canvas stage — 9:16 */}
      <div className="flex-1 flex items-center justify-center px-2 pb-1 min-h-0">
        <div
          ref={stageRef}
          onPointerDown={(e) => { if (e.target === stageRef.current) setSelected(null); }}
          className="relative rounded-2xl overflow-hidden shadow-glow border border-white/10 select-none touch-none h-full w-auto max-h-full max-w-full"
          style={{
            aspectRatio: "9 / 16",
            background: mediaUrl ? "#000" : bg,
          }}
        >
          {mediaUrl && (
            isVideo ? (
              <video src={mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={{ filter }} />
            ) : (
              <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter }} />
            )
          )}

          {[...overlays].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((ov) => {
            const getAnimation = () => {
              if (!ov.animation || ov.animation === "none") return {};
              const baseAnim = {
                pulse: { scale: [1, 1.1, 1], transition: { duration: 1, repeat: Infinity } },
                bounce: { y: [0, -10, 0], transition: { duration: 0.6, repeat: Infinity } },
                spin: { rotate: 360, transition: { duration: 2, repeat: Infinity, ease: "linear" } },
                fade: { opacity: [0.5, 1, 0.5], transition: { duration: 2, repeat: Infinity } },
                slideIn: { x: [-100, 0], opacity: [0, 1], transition: { duration: 0.5 } },
              };
              return baseAnim[ov.animation as keyof typeof baseAnim] || {};
            };
            
            return (
              <motion.div
                key={ov.id}
                animate={getAnimation()}
                onPointerDown={onDragOverlay(ov.id)}
                onDoubleClick={() => { if (ov.kind === "text") { setSelected(ov.id); setEditingId(ov.id); } }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none ${editingId===ov.id ? "cursor-text" : "cursor-grab active:cursor-grabbing"} ${selected===ov.id ? "outline outline-2 outline-white/70 rounded-md" : ""}`}
                style={{
                  left: `${ov.x * 100}%`, top: `${ov.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${ov.rotate}deg) scale(${ov.scale})`,
                  fontSize: ov.kind === "text" ? 28 : 56,
                  color: ov.color, fontFamily: fontFor(ov.font), 
                  fontWeight: ov.font === "bold" ? 900 : 700,
                  textShadow: ov.kind === "text" ? "0 2px 8px rgba(0,0,0,.5)" : undefined,
                  whiteSpace: "nowrap",
                  opacity: ov.opacity ?? 1,
                  zIndex: ov.zIndex ?? 0,
                }}
              >
                {ov.kind === "text" && editingId === ov.id ? (
                  <span
                    ref={(el) => { if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } }}
                    contentEditable
                    suppressContentEditableWarning
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => { updateSelected({ value: e.currentTarget.textContent || " " }); setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                    className="outline-none"
                  >{ov.value}</span>
                ) : ov.value}
              </motion.div>
            );
          })}

          {/* Trash drop zone (visible while dragging) */}
          <div id="story-trash" className={`absolute left-1/2 bottom-4 -translate-x-1/2 h-14 w-14 rounded-full grid place-items-center transition-all ${selected ? "opacity-100" : "opacity-0 pointer-events-none"} ${dragOverTrash ? "bg-destructive scale-125" : "bg-black/50 border border-white/20"}`}>
            <Trash2 className="h-5 w-5" />
          </div>

          {!mediaUrl && (
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 grid place-items-center text-white/90"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-14 w-14 rounded-full glass-strong grid place-items-center"><ImageIcon className="h-6 w-6" /></div>
                <span className="text-sm font-medium">Tap to add media</span>
                <span className="text-xs text-white/70">or just decorate the gradient</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Selected overlay toolbar */}
      {sel && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs px-2 text-muted-foreground shrink-0">{sel.kind === "text" ? "Text" : "Sticker"}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">size</span>
              <Slider value={[sel.scale * 50]} min={20} max={200} step={1} onValueChange={([v]) => updateSelected({ scale: v/50 })} className="w-24" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">rotate</span>
              <Slider value={[sel.rotate + 180]} min={0} max={360} step={1} onValueChange={([v]) => updateSelected({ rotate: v - 180 })} className="w-24" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">opacity</span>
              <Slider value={[(sel.opacity ?? 1) * 100]} min={10} max={100} step={1} onValueChange={([v]) => updateSelected({ opacity: v/100 })} className="w-24" />
            </div>
            {sel.kind === "text" && (
              <div className="flex items-center gap-1 shrink-0">
                {TEXT_COLORS.map((c) => (
                  <button key={c} onClick={() => updateSelected({ color: c })}
                    className={`h-6 w-6 rounded-full border ${sel.color===c ? "border-white" : "border-white/20"}`}
                    style={{ background: c }} aria-label={c} />
                ))}
              </div>
            )}
            {sel.kind === "text" && (
              <div className="flex items-center gap-1 shrink-0">
                {FONTS.map((f) => (
                  <button key={f} onClick={() => updateSelected({ font: f })}
                    className={`text-[10px] px-2 py-1 rounded-md border ${sel.font===f ? "bg-white/15 border-white/30" : "border-white/10"}`}>
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button onClick={centerSelected} className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10" aria-label="Center">
                <AlignCenter className="h-4 w-4" />
              </button>
              <button onClick={duplicateSelected} className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10" aria-label="Duplicate">
                <Copy className="h-4 w-4" />
              </button>
              <button onClick={removeSelected} className="h-8 w-8 rounded-full grid place-items-center hover:bg-destructive/20 text-destructive" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panels */}
      {panel === "sticker" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2">
            <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar pb-1">
              {(Object.keys(STICKER_CATEGORIES) as Array<keyof typeof STICKER_CATEGORIES>).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setStickerCategory(cat)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg shrink-0 border ${stickerCategory===cat ? "bg-white/15 border-white/30" : "border-white/10"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5 max-h-[22vh] overflow-y-auto">
              {STICKER_CATEGORIES[stickerCategory].map((s) => (
                <button key={s} onClick={() => { addSticker(s); setPanel(null); }} className="text-2xl h-10 grid place-items-center hover:scale-110 transition">{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {panel === "filter" && mediaUrl && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button key={f.name} onClick={() => setFilter(f.css)} className={`shrink-0 text-xs px-3 py-2 rounded-xl border ${filter===f.css ? "bg-white/15 border-white/30" : "border-white/10"}`}>
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {panel === "bg" && !mediaUrl && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              "linear-gradient(135deg,#ff3ea5,#7c3aed)",
              "linear-gradient(135deg,#0ea5e9,#22d3ee)",
              "linear-gradient(135deg,#f97316,#ef4444)",
              "linear-gradient(135deg,#10b981,#22d3ee)",
              "linear-gradient(135deg,#111,#333)",
              "linear-gradient(135deg,#fde047,#f97316)",
            ].map((g) => (
              <button key={g} onClick={() => setBg(g)} className={`h-12 w-20 rounded-xl border ${bg===g ? "border-white" : "border-white/10"}`} style={{ background: g }} />
            ))}
          </div>
        </div>
      )}
      {panel === "animation" && sel && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            {ANIMATIONS.map((a) => (
              <button 
                key={a.value} 
                onClick={() => updateSelected({ animation: a.value as any })} 
                className={`shrink-0 text-xs px-3 py-2 rounded-xl border ${(sel.animation || "none")===a.value ? "bg-white/15 border-white/30" : "border-white/10"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layer Panel */}
      <AnimatePresence>
        {showLayerPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-2 pb-1 shrink-0"
          >
            <div className="glass-strong rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Layers ({overlays.length})</span>
                <button onClick={() => setShowLayerPanel(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Close
                </button>
              </div>
              <div className="space-y-1 max-h-[20vh] overflow-y-auto">
                {[...overlays].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)).map((ov) => (
                  <div
                    key={ov.id}
                    onClick={() => setSelected(ov.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${selected===ov.id ? "bg-white/15 border border-white/30" : "bg-white/5 hover:bg-white/10"}`}
                  >
                    <div className="flex-1 truncate">
                      <div className="text-xs font-medium truncate">{ov.kind === "text" ? ov.value : ov.value}</div>
                      <div className="text-[10px] text-muted-foreground">{ov.kind}</div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveLayer(ov.id, "up"); }}
                        className="h-6 w-6 rounded grid place-items-center hover:bg-white/10 text-xs"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveLayer(ov.id, "down"); }}
                        className="h-6 w-6 rounded grid place-items-center hover:bg-white/10 text-xs"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
                {overlays.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-4">
                    No layers yet. Add text or stickers to get started.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom action bar */}
      <div className="px-2 pt-1 shrink-0" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="glass-strong rounded-2xl p-2 flex items-center justify-around">
          <ToolBtn icon={<ImageIcon className="h-4 w-4" />} label="Media" onClick={() => fileRef.current?.click()} />
          <ToolBtn icon={<Type className="h-4 w-4" />} label="Text" onClick={addText} />
          <ToolBtn icon={<Smile className="h-4 w-4" />} label="Sticker" onClick={() => setPanel(panel==="sticker"?null:"sticker")} />
          <ToolBtn icon={<Wand2 className="h-4 w-4" />} label="Filter" onClick={() => setPanel(panel==="filter"?null:"filter")} disabled={!mediaUrl} />
          <ToolBtn icon={<Palette className="h-4 w-4" />} label="BG" onClick={() => setPanel(panel==="bg"?null:"bg")} disabled={!!mediaUrl} />
          <ToolBtn icon={<Sparkles className="h-4 w-4" />} label="Animate" onClick={() => setPanel(panel==="animation"?null:"animation")} disabled={!selected} />
        </div>
      </div>
      <input ref={fileRef} hidden type="file" accept="image/*,video/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
    </motion.div>
    </FullScreenLayer>
  );
}

function ToolBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent">
      <span className="h-7 w-7 rounded-lg bg-white/5 grid place-items-center">{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height; const cr = w / h;
  let dw = w, dh = h, dx = 0, dy = 0;
  if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; }
  else { dw = w; dh = w / ir; dy = (h - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function paintCssBg(ctx: CanvasRenderingContext2D, css: string, w: number, h: number) {
  // Parse a 2-stop linear-gradient(...) fallback; otherwise solid color.
  const m = css.match(/linear-gradient\([^,]+,\s*([^,]+),\s*([^)]+)\)/);
  if (m) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, m[1].trim()); g.addColorStop(1, m[2].trim());
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = css;
  }
  ctx.fillRect(0, 0, w, h);
}