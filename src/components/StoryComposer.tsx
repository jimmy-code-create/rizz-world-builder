import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  ScanFace,
  Type,
  Smile,
  Image as ImageIcon,
  Palette,
  Trash2,
  Loader2,
  Send,
  Wand2,
  Undo2,
  Copy,
  Lock,
  AtSign,
  Globe,
  UserCheck,
  Users,
  Braces,
  LayoutGrid,
  Layers,
  Brush,
  Eraser,
  Pipette,
  Redo2,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { FaceEffectsStudio } from "@/components/story/FaceEffectsStudio";
import {
  BRUSHES,
  EMOJI_PACK,
  FONTS,
  ICONS,
  PHRASE_PACK,
  TEMPLATES,
  TEXT_STYLES,
  fontStack,
  type BrushId,
  type FontId,
  type StickerTab,
  type TextStyleId,
} from "@/lib/story-creator/content";
import {
  BAKE_FILTERS,
  MOTIONS,
  NEUTRAL_ADJUST,
  applyAdjustments,
  bakeFilter,
  createParticles,
  smoothStroke,
  stepParticles,
  type AdjustOpts,
  type BakeFilterId,
  type Particle,
  type ParticleKind,
  type StrokePoint,
} from "@/lib/story-creator/fx";

/**
 * Who a story is for. Stored as `stories.visibility` (public / followers /
 * close_friends) so Postgres enforces it — a private story must not be readable
 * by a direct API call, only hidden in the UI.
 */
type StoryAudience = "everyone" | "followers" | "following" | "close_friends";

const AUDIENCE_OPTIONS: {
  id: StoryAudience;
  label: string;
  hint: string;
  visibility: "public" | "followers" | "following" | "close_friends";
  icon: typeof Globe;
}[] = [
  { id: "everyone", label: "Everyone", hint: "Anyone on RIZZ can see it.", visibility: "public", icon: Globe },
  { id: "followers", label: "Followers only", hint: "Only people who follow you.", visibility: "followers", icon: Users },
  { id: "following", label: "People you follow", hint: "Only accounts you are following can see it.", visibility: "following", icon: UserCheck },
  { id: "close_friends", label: "Close friends", hint: "Only the people on your close friends list.", visibility: "close_friends", icon: Lock },
];

type Person = { id: string; username: string; display_name: string | null; avatar_url: string | null };

type Overlay = {
  id: string;
  kind: "text" | "sticker" | "image" | "drawing";
  value: string;
  x: number; // 0..1 of canvas width
  y: number; // 0..1 of canvas height
  scale: number;
  rotate: number;
  color?: string;
  font?: string;
  /** Text style id from the creator content pack (classic default). */
  style?: TextStyleId;
  locked?: boolean;
  /** Image overlays (template slots, uploaded stickers): object URL + box. */
  src?: string;
  w?: number; // 0..1 of canvas width
  h?: number; // 0..1 of canvas height
  /** Code-drawn icon sticker. */
  icon?: string;
  iconColor?: string;
  /** Brush stroke (normalized 0..1 points, smoothed on export). */
  brush?: BrushId;
  brushColor?: string;
  brushSize?: number;
  points?: StrokePoint[];
};

const STICKER_TABS: StickerTab[] = ["Emoji", "Icons", "Mood", "Gen Z", "Hinglish", "Desi pop"];
const TEXT_COLORS = ["#ffffff","#000000","#c8ff3d","#8a8a92","#22d3ee","#fde047","#f97316","#10b981"];
/** Canvas + editor font stacks, matched to RIZZ (Bricolage display). */
const fontFor = (k?: string) => {
  if (k === "serif-quote") return fontStack("serif-quote");
  if (k === "mono" || k === "rizz-mono") return fontStack("rizz-mono");
  if (k === "display" || k === "rizz-display") return fontStack("rizz-display");
  if (k === "sans" || k === "rizz-sans") return fontStack("rizz-sans");
  const known = (FONTS as Array<{ id: string }>).some((f) => f.id === k);
  if (known) return fontStack(k as FontId);
  return fontStack("rizz-sans");
};

const CANVAS_W = 1080;
const CANVAS_H = 1920;

export function StoryComposer({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted?: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  // Set when the file picker was opened from the sticker tab: the upload
  // becomes a free-floating sticker instead of the backdrop.
  const stickerUploadArmed = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("none");
  const [bg, setBg] = useState<string>("#131315");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"text" | "sticker" | "filter" | "bg" | "caption" | "privacy" | "templates" | "layers" | "brush" | "tune" | "motion" | null>(null);
  const [history, setHistory] = useState<Overlay[][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [audience, setAudience] = useState<StoryAudience>("everyone");
  const [hiddenFrom, setHiddenFrom] = useState<Person[]>([]);
  const [caption, setCaption] = useState("");
  const [captionCaret, setCaptionCaret] = useState(0);
  // Live text + caret of the overlay currently being edited, so `@` mentions can
  // autocomplete inside story text as well as in the caption.
  const [editorText, setEditorText] = useState("");
  const [editorCaret, setEditorCaret] = useState(0);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleHits, setPeopleHits] = useState<Person[]>([]);
  const [lensOpen, setLensOpen] = useState(false);
  const [templateId, setTemplateId] = useState("blank");
  const [frame, setFrame] = useState<"none" | "polaroid" | "film" | "neon">("none");
  const [stickerTab, setStickerTab] = useState<(typeof STICKER_TABS)[number]>("Emoji");
  const [bakeId, setBakeId] = useState<BakeFilterId>("none");
  const [adjust, setAdjust] = useState<AdjustOpts>(NEUTRAL_ADJUST);
  const [motionKind, setMotionKind] = useState<ParticleKind | "none">("none");
  const [brush, setBrush] = useState<BrushId>("pen");
  const [brushColor, setBrushColor] = useState("#c8ff3d");
  const [brushSize, setBrushSize] = useState(10);
  const [redoStack, setRedoStack] = useState<Overlay[][]>([]);
  const drawingRef = useRef<{ id: string; points: StrokePoint[] } | null>(null);
  
  const pushHistory = (prev: Overlay[]) => {
    setRedoStack([]);
    setHistory((h) => [...h.slice(-19), prev]);
  };
  const undo = () => {
    if (history.length === 0) return;
    setRedoStack((r) => [...r.slice(-19), overlays]);
    setOverlays(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    setHistory((h) => [...h.slice(-19), overlays]);
    setOverlays(redoStack[redoStack.length - 1]);
    setRedoStack(redoStack.slice(0, -1));
  };

  useEffect(() => {
    if (!open) {
      setFile(null); setMediaUrl(null); setIsVideo(false);
      setOverlays([]); setSelected(null); setFilter("none");
      setBg("#131315"); setPanel(null);
      setHistory([]); setEditingId(null);
      setAudience("everyone"); setHiddenFrom([]); setCaption("");
      setEditorText(""); setPeopleQuery(""); setPeopleHits([]);
      setTemplateId("blank"); setFrame("none"); setStickerTab("Emoji");
      setBakeId("none"); setAdjust(NEUTRAL_ADJUST); setMotionKind("none");
      setBrush("pen"); setBrushColor("#c8ff3d"); setBrushSize(10);
      setRedoStack([]); drawingRef.current = null;
    }
  }, [open]);

  // Type-ahead for the hide-from list. Names, avatars and handles come from the
  // same profiles table the mention picker uses.
  useEffect(() => {
    if (panel !== "privacy") return;
    const query = peopleQuery.trim();
    const timer = window.setTimeout(async () => {
      let request = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .order("rizz_score", { ascending: false })
        .limit(6);
      if (query) request = request.ilike("username", `${query}%`);
      const { data } = await request;
      setPeopleHits((data as Person[]) ?? []);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [panel, peopleQuery]);

  const applyTemplate = (templateId: string) => {
    const def = TEMPLATES.find((t) => t.id === templateId);
    if (!def) return;
    pushHistory(overlays);
    setTemplateId(templateId);
    setFrame(def.frame);
    if (!def.bg.startsWith("#131315")) setBg(def.bg);
    setOverlays((o) => {
      const kept = o.filter((it) => it.kind === "image" && it.src);
      const fresh: Overlay[] = [];
      for (const slot of def.slots) {
        fresh.push({
          id: crypto.randomUUID(), kind: "image", value: "",
          x: slot.x + slot.w / 2, y: slot.y + slot.h / 2,
          scale: 1, rotate: 0, w: slot.w, h: slot.h,
        });
      }
      for (const preset of def.texts) {
        fresh.push({
          id: crypto.randomUUID(), kind: "text", value: preset.text,
          x: preset.x, y: preset.y, scale: 1, rotate: 0,
          color: preset.color, font: preset.font, style: preset.style,
        });
      }
      return [...kept, ...fresh];
    });
    setSelected(null);
    setPanel(null);
    toast.success(`Template: ${def.label}`);
  };

  const pickFile = (f: File | null, asSticker = false) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    const url = URL.createObjectURL(f);
    if (asSticker || stickerUploadArmed.current) {
      stickerUploadArmed.current = false;
      addImageOverlay(url);
      return;
    }
    // A selected empty photo slot eats the upload; otherwise it becomes the backdrop.
    const slot = selected ? overlays.find((o) => o.id === selected) : undefined;
    if (slot?.kind === "image" && !slot.src) {
      setOverlays((o) => o.map((it) => it.id === slot.id ? { ...it, src: url } : it));
      return;
    }
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setMediaUrl(url);
  };

  const addText = () => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    setOverlays((o) => [...o, { id, kind:"text", value:"Tap to edit", x:0.5, y:0.5, scale:1, rotate:0, color:"#ffffff", font:"rizz-display", style:"classic" }]);
    setSelected(id); setPanel(null); setEditingId(id);
  };
  const addSticker = (s: string) => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    setOverlays((o) => [...o, { id, kind:"sticker", value:s, x:0.5, y:0.5, scale:1.5, rotate:0 }]);
    setSelected(id);
  };
  const addIconSticker = (name: string) => {
    if (!ICONS[name]) return;
    const id = crypto.randomUUID();
    pushHistory(overlays);
    setOverlays((o) => [...o, { id, kind:"sticker", value:"", x:0.5, y:0.5, scale:1.5, rotate:0, icon:name, iconColor:"#c8ff3d" }]);
    setSelected(id);
  };
  const addPhraseSticker = (text: string) => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    setOverlays((o) => [...o, { id, kind:"text", value:text, x:0.5, y:0.62, scale:1.1, rotate:-4, color:"#c8ff3d", font:"rizz-display", style:"poster" }]);
    setSelected(id);
  };
  const addImageOverlay = (src: string, box?: { x: number; y: number; w: number; h: number }) => {
    const id = crypto.randomUUID();
    pushHistory(overlays);
    setOverlays((o) => [...o, {
      id, kind:"image", value:"", src,
      x: box ? box.x + box.w / 2 : 0.5,
      y: box ? box.y + box.h / 2 : 0.5,
      scale:1, rotate:0, w: box?.w ?? 0.5, h: box?.h ?? 0.3,
    }]);
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
  const toggleLockSelected = () => {
    if (!selected) return;
    pushHistory(overlays);
    setOverlays((o) => o.map((it) => it.id === selected ? { ...it, locked: !it.locked } : it));
  };
  const reorderSelected = (dir: 1 | -1) => {
    if (!selected) return;
    pushHistory(overlays);
    setOverlays((o) => {
      const i = o.findIndex((it) => it.id === selected);
      const j = Math.min(o.length - 1, Math.max(0, i + dir));
      if (i < 0 || i === j) return o;
      const next = [...o];
      const [layer] = next.splice(i, 1);
      next.splice(j, 0, layer);
      return next;
    });
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const it = overlays.find((o) => o.id === selected); if (!it) return;
    pushHistory(overlays);
    const id = crypto.randomUUID();
    setOverlays((o) => [...o, { ...it, id, x: Math.min(0.9, it.x + 0.05), y: Math.min(0.9, it.y + 0.05) }]);
    setSelected(id);
  };

  // Multi-touch drag / pinch / rotate
  const onDragOverlay = (id: string) => (e: React.PointerEvent) => {
    // Brush mode owns all stage touches so strokes paint over overlays.
    if (panel === "brush") return;
    if (editingId === id) return;
    const stage = stageRef.current; if (!stage) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    const rect = stage.getBoundingClientRect();
    const start = overlays.find((o) => o.id === id);
    // Locked layers stay put (toggle in the Layers panel).
    if (!start || start.locked) return;
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

  /** Live preview filter = tune sliders layered over the baked-filter CSS. */
  const previewFilter =
    `${filter} brightness(${adjust.brightness}) contrast(${adjust.contrast}) saturate(${adjust.saturation})` +
    (adjust.warmth >= 0 ? ` sepia(${(adjust.warmth * 0.5).toFixed(2)})` : ` hue-rotate(${(adjust.warmth * 20).toFixed(0)}deg)`);
  const [liveStroke, setLiveStroke] = useState<StrokePoint[] | null>(null);

  /** Brush drawing: while the Brush panel is open, stage touches paint. */
  const stagePoint = (clientX: number, clientY: number): StrokePoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (panel === "brush") {
      if (e.target !== stageRef.current && (e.target as HTMLElement).closest("[data-stroke-ui]")) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const p = stagePoint(e.clientX, e.clientY);
      if (!p) return;
      pushHistory(overlays);
      const id = crypto.randomUUID();
      drawingRef.current = { id, points: [{ ...p, p: (e as React.PointerEvent & { pressure?: number }).pressure || 0.7 }] };
      setLiveStroke(drawingRef.current.points);
      return;
    }
    if (e.target === stageRef.current) setSelected(null);
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const active = drawingRef.current;
    if (!active) return;
    const p = stagePoint(e.clientX, e.clientY);
    if (!p) return;
    active.points.push({ ...p, p: (e as React.PointerEvent & { pressure?: number }).pressure || 0.7 });
    setLiveStroke([...active.points]);
  };

  const onStagePointerUp = () => {
    const active = drawingRef.current;
    drawingRef.current = null;
    setLiveStroke(null);
    if (!active || active.points.length === 0) return;
    setOverlays((o) => [
      ...o,
      {
        id: active.id, kind: "drawing", value: "",
        x: 0.5, y: 0.5, scale: 1, rotate: 0,
        brush, brushColor, brushSize, points: active.points,
      },
    ]);
    setSelected(active.id);
  };

  /** Clean JSON of the story for backend storage / re-render. Image `src`
      object URLs are session-local — re-attach uploads when re-rendering. */
  const storyJson = () => ({
    version: 1,
    app: "rizz-story-composer",
    templateId,
    frame,
    bg,
    filter,
    overlays: overlays.map((ov) => ({ ...ov })),
  });

  // Render the export base into any 2d context (image export, video frames).
  async function renderExportBase(c: CanvasRenderingContext2D, W: number, H: number) {
    // background
    if (mediaUrl) {
      const img = await loadImage(mediaUrl);
      drawCover(c, img, W, H);
    } else {
      // gradient bg
      paintCssBg(c, bg, W, H);
    }
    // overlays
    for (const ov of overlays) {
      c.save();
      c.translate(ov.x * W, ov.y * H);
      c.rotate((ov.rotate * Math.PI) / 180);
      if (ov.kind === "image" && ov.src && ov.w && ov.h) {
        const w = ov.w * W * ov.scale;
        const h = ov.h * H * ov.scale;
        try {
          const img = await loadImage(ov.src);
          const ir = img.width / img.height;
          const cr = w / h;
          let dw = w, dh = h;
          if (ir > cr) { dw = h * ir; } else { dh = w / ir; }
          c.beginPath();
          c.rect(-w / 2, -h / 2, w, h);
          c.clip();
          c.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        } catch {
          c.fillStyle = "rgba(255,255,255,0.07)";
          c.fillRect(-w / 2, -h / 2, w, h);
        }
        c.restore();
        continue;
      }
      if (ov.kind === "drawing") {
        // Drawings composite on their own layer so the eraser only ever
        // removes paint — identical to the editor's SVG mask.
        continue;
      }
      const baseSize = ov.kind === "text" ? 72 : 140;
      const size = (baseSize * ov.scale * W) / CANVAS_W;
      c.textAlign = "center"; c.textBaseline = "middle";
      if (ov.kind === "text") {
        paintStyledText(c, ov.value, 0, 0, size, ov);
      } else if (ov.icon && ICONS[ov.icon]) {
        c.save();
        c.scale(size / 100, size / 100);
        ICONS[ov.icon].draw(c, ov.iconColor || "#c8ff3d");
        c.restore();
      } else {
        c.font = `${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji"`;
        c.fillText(ov.value, 0, 0);
      }
      c.restore();
    }
    // Whole-frame bake (matches the live CSS preview), then frame chrome.
    paintDrawingsLayer(c, overlays, W);
    const pixels = c.getImageData(0, 0, W, H);
    applyAdjustments(pixels.data, W, H, adjust);
    bakeFilter(pixels.data, W, H, bakeId);
    c.putImageData(pixels, 0, 0);
    paintFrame(c, frame, W, H);
  }

  // Render final image (image bg only). For video, upload raw video + caption from first text overlay.
  async function compose(): Promise<{ blob: Blob; type: "image"|"video" }> {
    if (isVideo && file) return { blob: file, type: "video" };
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;
    await renderExportBase(ctx, CANVAS_W, CANVAS_H);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    return { blob, type: "image" };
  }

  const [recording, setRecording] = useState(false);

  /** Records a 3 s motion story (animated overlay baked per frame) via MediaRecorder. */
  async function exportMotionVideo(): Promise<Blob> {
    if (motionKind === "none") throw new Error("Pick a motion overlay first.");
    if (typeof MediaRecorder === "undefined") throw new Error("Video export isn't supported in this browser.");
    const W = 540;
    const H = 960;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Export canvas unavailable.");
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    // Base is rendered once; particles animate per frame on top.
    await renderExportBase(ctx, W, H);
    const base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    base.getContext("2d")?.drawImage(canvas, 0, 0);
    const ps = createParticles(motionKind, (Date.now() % 100000) + 3);
    rec.start();
    const frames = 90;
    for (let i = 0; i < frames; i += 1) {
      ctx.drawImage(base, 0, 0);
      drawParticles(ctx, ps, motionKind, W, H);
      stepParticles(ps, motionKind, 1 / 30);
      await new Promise((r) => requestAnimationFrame(r));
    }
    rec.stop();
    await stopped;
    if (chunks.length === 0) throw new Error("Recording produced no data.");
    return new Blob(chunks, { type: "video/webm" });
  }

  async function post(recorded?: Blob) {
    if (!user) { toast.error("Sign in first"); return; }
    if (!mediaUrl && overlays.length === 0) { toast.error("Add media or a sticker/text"); return; }
    setBusy(true);
    try {
      const { blob, type } = recorded ? { blob: recorded, type: "video" as const } : await compose();
      const ext = type === "video" ? (recorded ? "webm" : (file?.name.split(".").pop() ?? "mp4")) : "jpg";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, blob, { contentType: blob.type || (type==="video"?"video/mp4":"image/jpeg") });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
      // A written caption wins; otherwise the first text overlay becomes one, so
      // stories created before the caption field still read the same.
      const captionText = caption.trim() || overlays.find((o) => o.kind === "text")?.value?.trim() || null;
      const visibility = AUDIENCE_OPTIONS.find((option) => option.id === audience)!.visibility;
      const base = {
        author_id: user.id,
        media_url: pub.publicUrl,
        media_type: type,
        caption: captionText,
      };
      let { error: insErr } = await supabase.from("stories").insert({
        ...base,
        visibility: visibility as any,
        hidden_from: hiddenFrom.map((person) => person.id),
      });
      // `hidden_from` and the audience value arrive with the story-likes
      // migration. If it has not been applied yet, posting must still work
      // rather than failing on a column the deployment doesn't have.
      const missingColumn =
        insErr &&
        (insErr.code === "42703" ||
          insErr.code === "PGRST204" ||
          /hidden_from|visibility/i.test(insErr.message ?? ""));
      if (missingColumn) {
        console.warn("[story-composer] audience columns are missing; posting without them");
        ({ error: insErr } = await supabase.from("stories").insert(base));
      }
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
        <CloseButton onClick={onClose} aria-label="Close" className="glass-strong" />
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={history.length === 0} className="h-9 w-9 rounded-full glass-strong grid place-items-center disabled:opacity-40" aria-label="Undo">
            <Undo2 className="h-5 w-5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="h-9 w-9 rounded-full glass-strong grid place-items-center disabled:opacity-40" aria-label="Redo">
            <Redo2 className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold hidden xs:block sm:block">New story</div>
        </div>
        <Button onClick={() => void post()} disabled={busy} size="sm" className="bg-primary text-primary-foreground shadow-md rounded-full px-4 h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Share</>}
        </Button>
      </div>

      {/* Canvas stage — 9:16 */}
      <div className="flex-1 flex items-center justify-center px-2 pb-1 min-h-0 w-full">
        <div
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
          className="relative rounded-2xl overflow-hidden shadow-md border border-white/10 select-none touch-none"
          style={{
            aspectRatio: "9 / 16",
            background: mediaUrl ? "#000" : bg,
            maxWidth: "min(calc(100vw - 1rem), 640px)",
            maxHeight: "calc(100dvh - 8rem)",
            width: "100%",
            height: "auto",
          }}
        >
          {mediaUrl && (
            isVideo ? (
              <video src={mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={{ filter: previewFilter }} />
            ) : (
              <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: previewFilter }} />
            )
          )}

          {overlays.map((ov) =>
            ov.kind === "drawing" ? null : (
            <div
              key={ov.id}
              onPointerDown={onDragOverlay(ov.id)}
              onDoubleClick={() => { if (ov.kind === "text") { setSelected(ov.id); setEditingId(ov.id); } }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none ${editingId===ov.id ? "cursor-text" : "cursor-grab active:cursor-grabbing"} ${selected===ov.id ? "outline outline-2 outline-white/70 rounded-md" : ""}`}
              style={{
                left: `${ov.x * 100}%`, top: `${ov.y * 100}%`,
                transform: `translate(-50%,-50%) rotate(${ov.rotate}deg) scale(${ov.scale})`,
                fontSize: ov.kind === "text" ? 28 : 56,
                color: ov.color, fontFamily: fontFor(ov.font), fontWeight: 700,
                textShadow: ov.kind === "text" ? "0 2px 8px rgba(0,0,0,.5)" : undefined,
                whiteSpace: "nowrap",
                width: ov.kind === "image" && ov.w ? `${ov.w * 100}%` : undefined,
                aspectRatio: ov.kind === "image" && ov.w && ov.h ? `${ov.w} / ${ov.h}` : undefined,
              }}
            >
              {ov.kind === "image" ? (
                ov.src ? (
                  <img src={ov.src} alt="" className="h-full w-full rounded-lg object-cover" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                ) : (
                  <button
                    type="button"
                    aria-label="Fill photo slot"
                    onClick={(e) => { e.stopPropagation(); setSelected(ov.id); fileRef.current?.click(); }}
                    className="grid h-full w-full place-items-center rounded-lg border-2 border-dashed border-primary/60 bg-white/5 text-xs font-bold text-primary"
                    style={{ maxWidth: "100%", maxHeight: "100%" }}
                  >
                    + photo
                  </button>
                )
              ) : ov.kind === "sticker" && ov.icon ? (
                <IconThumb name={ov.icon} color={ov.iconColor || "#c8ff3d"} size={56} />
              ) : ov.kind === "text" && editingId === ov.id ? (
                <span
                  ref={(el) => { if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } }}
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(e) => e.stopPropagation()}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    setEditorText(el.textContent ?? "");
                    const selection = window.getSelection();
                    setEditorCaret(selection?.anchorOffset ?? (el.textContent ?? "").length);
                  }}
                  onKeyUp={(e) => {
                    const el = e.currentTarget;
                    const selection = window.getSelection();
                    setEditorCaret(selection?.anchorOffset ?? (el.textContent ?? "").length);
                  }}
                  onBlur={(e) => { updateSelected({ value: e.currentTarget.textContent || " " }); setEditingId(null); setEditorText(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                  className="outline-none"
                >{ov.value}</span>
              ) : ov.value}
            </div>
              )
          )}
          {/* All drawing strokes share one SVG so the eraser mask cuts every
              stroke underneath — exactly what the export does on canvas. */}
          <DrawingsSvg
            overlays={overlays}
            liveStroke={liveStroke}
            liveBrush={brush}
            liveColor={brushColor}
            liveSize={brushSize}
            selectedId={selected}
            onSelect={(id) => {
              const ov = overlays.find((o) => o.id === id);
              if (ov && !ov.locked) setSelected(id);
            }}
          />

          {/* Tune preview: vignette + grain sit over the media, under UI. */}
          {adjust.vignette > 0.01 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${(adjust.vignette * 0.85).toFixed(2)}) 100%)` }}
            />
          )}
          {adjust.grain > 0.01 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                opacity: (adjust.grain * 0.5).toFixed(2),
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
              }}
            />
          )}
          {motionKind !== "none" && <MotionPreview kind={motionKind} />}

          {/* Template frame preview (export paints the matching chrome) */}
          {frame === "neon" && (
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: "inset 0 0 0 4px #c8ff3d, 0 0 28px rgba(200,255,61,.45)" }} />
          )}
          {frame === "polaroid" && (
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: "inset 0 0 0 18px #f5f1e6, inset 0 -72px 0 18px #f5f1e6" }} />
          )}
          {frame === "film" && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[5%] bg-black" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[5%] bg-black" />
            </>
          )}

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
            <span className="text-xs px-2 text-muted-foreground shrink-0">{sel.kind === "text" ? "Text" : sel.kind === "image" ? "Photo" : "Sticker"}{sel.locked ? " 🔒" : ""}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">size</span>
              <Slider value={[sel.scale * 50]} min={20} max={200} step={1} onValueChange={([v]) => updateSelected({ scale: v/50 })} className="w-24" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">rotate</span>
              <Slider value={[sel.rotate + 180]} min={0} max={360} step={1} onValueChange={([v]) => updateSelected({ rotate: v - 180 })} className="w-24" />
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
              <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Text style">
                {TEXT_STYLES.map((s) => (
                  <button key={s.id} onClick={() => updateSelected({ style: s.id })}
                    aria-pressed={sel.style === s.id || (!sel.style && s.id === "classic")}
                    className={`text-[10px] px-2 py-1 rounded-md border ${sel.style===s.id || (!sel.style && s.id==="classic") ? "bg-white/15 border-white/30" : "border-white/10"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {sel.kind === "text" && (
              <div className="flex items-center gap-1 shrink-0">
                {FONTS.map((f) => (
                  <button key={f.id} onClick={() => updateSelected({ font: f.id })}
                    style={{ fontFamily: f.stack }}
                    className={`text-[10px] px-2 py-1 rounded-md border ${sel.font===f.id ? "bg-white/15 border-white/30" : "border-white/10"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button onClick={() => reorderSelected(1)} className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10 text-xs font-bold" aria-label="Bring forward">
                ▲
              </button>
              <button onClick={() => reorderSelected(-1)} className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10 text-xs font-bold" aria-label="Send back">
                ▼
              </button>
              <button onClick={toggleLockSelected} className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10" aria-label={sel.locked ? "Unlock layer" : "Lock layer"} aria-pressed={!!sel.locked}>
                <Lock className="h-4 w-4" />
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

      {/* Mentions inside story text: the same picker the chat composer uses,
          filtered as you type and picked by tap or Enter. */}
      {editingId && editorText.includes("@") && (
        <div className="relative shrink-0 px-2 pb-1">
          <MentionAutocomplete
            value={editorText}
            caret={editorCaret}
            onPick={(username) => {
              const next = replaceMention(editorText, editorCaret, username);
              updateSelected({ value: next.value });
              setEditorText(next.value);
              // Committing closes the inline editor so the mention renders from
              // state instead of from the contentEditable DOM.
              setEditingId(null);
            }}
          />
        </div>
      )}

      {/* Panels */}
      {panel === "caption" && (
        <div className="shrink-0 px-2 pb-1">
          <div className="glass-strong relative rounded-2xl p-2">
            <Input
              value={caption}
              onChange={(event) => {
                setCaption(event.target.value.slice(0, 300));
                setCaptionCaret(event.target.selectionStart ?? event.target.value.length);
              }}
              onKeyUp={(event) => setCaptionCaret(event.currentTarget.selectionStart ?? caption.length)}
              onClick={(event) => setCaptionCaret(event.currentTarget.selectionStart ?? caption.length)}
              placeholder="Add a caption — @ to mention someone"
              aria-label="Story caption"
              maxLength={300}
              className="h-11 border-white/10 bg-black/20"
            />
            <MentionAutocomplete value={caption} caret={captionCaret} onPick={(username) => {
              const next = replaceMention(caption, captionCaret, username);
              setCaption(next.value);
              setCaptionCaret(next.caret);
            }} />
            <p className="mt-1 px-1 text-[10px] text-muted-foreground">{caption.length}/300 · mentions notify the person</p>
          </div>
        </div>
      )}
      {panel === "privacy" && (
        <div className="shrink-0 px-2 pb-1">
          <div className="glass-strong max-h-[42vh] space-y-3 overflow-y-auto rounded-2xl p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5 text-primary" /> Who can see this story
            </p>
            <div className="space-y-1.5">
              {AUDIENCE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={audience === option.id}
                  onClick={() => setAudience(option.id)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 text-left transition ${
                    audience === option.id
                      ? "border-primary/50 bg-primary/12"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <option.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{option.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t border-white/5 pt-3">
              <p className="text-xs font-bold">Hide from</p>
              {hiddenFrom.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {hiddenFrom.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setHiddenFrom((list) => list.filter((entry) => entry.id !== person.id))}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 text-[11px] font-semibold"
                    >
                      @{person.username}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <Input
                value={peopleQuery}
                onChange={(event) => setPeopleQuery(event.target.value)}
                placeholder="Search a username to hide this story from"
                aria-label="Search people to hide this story from"
                className="h-10 border-white/10 bg-black/20"
              />
              {peopleHits.filter((hit) => !hiddenFrom.some((person) => person.id === hit.id)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {peopleHits
                    .filter((hit) => !hiddenFrom.some((person) => person.id === hit.id))
                    .slice(0, 6)
                    .map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => {
                          setHiddenFrom((list) => [...list, hit]);
                          setPeopleQuery("");
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 text-[11px]"
                      >
                        @{hit.username}
                      </button>
                    ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                They won't see this story even if the audience above includes them.
              </p>
            </div>
          </div>
        </div>
      )}
      {panel === "sticker" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Sticker packs">
              {STICKER_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={stickerTab === tab}
                  onClick={() => setStickerTab(tab)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${stickerTab === tab ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {stickerTab === "Icons" ? (
              <div className="grid max-h-[24vh] grid-cols-6 gap-1.5 overflow-y-auto">
                {Object.keys(ICONS).map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Icon ${ICONS[name]?.label ?? name}`}
                    onClick={() => { addIconSticker(name); setPanel(null); }}
                    className="grid h-11 place-items-center rounded-xl bg-white/5 hover:bg-white/10"
                  >
                    <IconThumb name={name} color="#c8ff3d" size={30} />
                  </button>
                ))}
              </div>
            ) : stickerTab === "Gen Z" || stickerTab === "Hinglish" ? (
              <div className="flex max-h-[24vh] flex-wrap gap-1.5 overflow-y-auto">
                {(PHRASE_PACK[stickerTab] ?? []).map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => { addPhraseSticker(phrase); setPanel(null); }}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-2 font-display text-sm font-bold text-primary"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid max-h-[24vh] grid-cols-7 gap-1.5 overflow-y-auto sm:grid-cols-10">
                {(EMOJI_PACK[stickerTab] ?? []).map((s) => (
                  <button key={s} aria-label={`Sticker ${s}`} onClick={() => { addSticker(s); setPanel(null); }} className="text-2xl h-10 grid place-items-center hover:scale-110 transition">{s}</button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPanel(null);
                stickerUploadArmed.current = true;
                fileRef.current?.click();
              }}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 text-xs font-bold"
            >
              Upload your own sticker
            </button>
          </div>
        </div>
      )}
      {panel === "templates" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2">
            <p className="mb-2 px-1 text-xs font-semibold">Template sets — tap to apply, tap a dashed slot to fill it</p>
            <div className="grid max-h-[26vh] grid-cols-3 gap-1.5 overflow-y-auto">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={templateId === t.id}
                  onClick={() => applyTemplate(t.id)}
                  className={`rounded-xl border px-2 py-3 text-xs font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${templateId === t.id ? "border-primary/60 bg-primary/15" : "border-white/10 bg-white/5"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {panel === "layers" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2">
            <p className="mb-2 px-1 text-xs font-semibold">Layers (top first)</p>
            <div className="max-h-[26vh] space-y-1.5 overflow-y-auto">
              {overlays.length === 0 && <p className="px-1 text-xs text-muted-foreground">No layers yet.</p>}
              {[...overlays].reverse().map((ov) => (
                <div
                  key={ov.id}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${selected === ov.id ? "bg-primary/15" : "bg-white/5"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(ov.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
                  >
                    {ov.kind === "text" ? `Text: ${String(ov.value).slice(0, 24)}` : ov.kind === "image" ? `Photo${ov.src ? "" : " (empty slot)"}` : `Sticker${ov.icon ? ` (${ov.icon})` : ""}`}{ov.locked ? " 🔒" : ""}
                  </button>
                  <button type="button" aria-label="Bring forward" onClick={() => { setSelected(ov.id); reorderSelected(1); }} className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold hover:bg-white/10">▲</button>
                  <button type="button" aria-label="Send back" onClick={() => { setSelected(ov.id); reorderSelected(-1); }} className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold hover:bg-white/10">▼</button>
                  <button type="button" aria-label={ov.locked ? "Unlock" : "Lock"} aria-pressed={!!ov.locked} onClick={() => { setSelected(ov.id); toggleLockSelected(); }} className="grid h-8 w-8 place-items-center rounded-lg text-xs hover:bg-white/10">{ov.locked ? "🔒" : "🔓"}</button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(JSON.stringify(storyJson(), null, 2));
                  toast.success("Story JSON copied for your backend.");
                } catch {
                  toast.error("Copy failed.");
                }
              }}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold"
            >
              <Braces className="h-4 w-4" /> Copy story JSON
            </button>
          </div>
        </div>
      )}
      {panel === "brush" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-3 space-y-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Brush type">
              {BRUSHES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={brush === b.id}
                  onClick={() => setBrush(b.id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${brush === b.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">Color</span>
              {["#c8ff3d", "#ffffff", "#141416", "#ff2e88", "#22d3ee", "#fde047"].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Brush ${c}`}
                  onClick={() => setBrushColor(c)}
                  className={`h-8 w-8 rounded-full border ${brushColor === c ? "border-white" : "border-white/20"}`}
                  style={{ background: c }}
                />
              ))}
              <Input
                type="color"
                aria-label="Custom brush color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="h-8 w-10 cursor-pointer bg-transparent"
              />
              <button
                type="button"
                aria-label="Pick color from story"
                title="Eyedropper"
                onClick={async () => {
                  try {
                    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                    if (!ED) {
                      toast.info("Eyedropper isn't supported here — use the palette.");
                      return;
                    }
                    const { sRGBHex } = await new ED().open();
                    setBrushColor(sRGBHex);
                  } catch {
                    // Dismissed; keep the current color.
                  }
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10"
              >
                <Pipette className="h-4 w-4" />
              </button>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">Size</p>
              <Slider aria-label="Brush size" min={2} max={48} step={1} value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} />
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  pushHistory(overlays);
                  setOverlays((o) => o.filter((it) => it.kind !== "drawing"));
                  setSelected(null);
                }}
              >
                Clear drawings
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setBrush("eraser")}>
                <Eraser className="mr-1 h-4 w-4" /> Eraser
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Drag on the canvas to paint. Strokes smooth automatically; undo keeps 20 steps.</p>
          </div>
        </div>
      )}
      {panel === "tune" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-3 space-y-2.5">
            {(
              [
                ["brightness", "Brightness", 0.5, 1.5, 0.05],
                ["contrast", "Contrast", 0.5, 1.5, 0.05],
                ["saturation", "Saturation", 0, 2, 0.05],
                ["warmth", "Warmth", -1, 1, 0.05],
                ["vignette", "Vignette", 0, 1, 0.05],
                ["grain", "Grain", 0, 1, 0.05],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <div key={key}>
                <div className="mb-0.5 flex items-center justify-between">
                  <p className="text-xs font-semibold">{label}</p>
                  <span className="text-[11px tabular-nums] text-muted-foreground">{adjust[key].toFixed(2)}</span>
                </div>
                <Slider
                  aria-label={label}
                  min={min}
                  max={max}
                  step={step}
                  value={[adjust[key]]}
                  onValueChange={([v]) => setAdjust((a) => ({ ...a, [key]: v }))}
                />
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setAdjust(NEUTRAL_ADJUST)}>
              Reset adjustments
            </Button>
          </div>
        </div>
      )}
      {panel === "motion" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Animated overlay">
              {MOTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={motionKind === m.id}
                  onClick={() => setMotionKind(m.id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${motionKind === m.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Animated overlays play on the canvas and bake into a 3&nbsp;s looping clip on export.
            </p>
            <Button
              className="w-full bg-primary text-primary-foreground font-bold"
              disabled={busy || recording || motionKind === "none"}
              onClick={async () => {
                if (!user) {
                  toast.error("Sign in first");
                  return;
                }
                setRecording(true);
                try {
                  const blob = await exportMotionVideo();
                  await post(blob);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Video export failed.");
                } finally {
                  setRecording(false);
                }
              }}
            >
              {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post motion story (3s)"}
            </Button>
          </div>
        </div>
      )}
      {panel === "filter" && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            {BAKE_FILTERS.map((f) => (
              <button key={f.id} onClick={() => { setFilter(f.css); setBakeId(f.id); }} className={`shrink-0 text-xs px-3 py-2 rounded-xl border ${bakeId===f.id ? "bg-white/15 border-white/30" : "border-white/10"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1 px-1 text-[10px] text-muted-foreground">Preview is live; the export bakes the same look.</p>
        </div>
      )}
      {panel === "bg" && !mediaUrl && (
        <div className="px-2 pb-1 shrink-0">
          <div className="glass-strong rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              "#131315",
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

      {/* Bottom action bar */}
      <div className="px-2 pt-1 shrink-0" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {/* Horizontally scrollable so every tool keeps a 44px target at 375px. */}
        <div className="glass-strong flex items-center gap-1 overflow-x-auto rounded-2xl p-2 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
          <ToolBtn icon={<ImageIcon className="h-4 w-4" />} label="Media" onClick={() => fileRef.current?.click()} />
          <ToolBtn icon={<ScanFace className="h-4 w-4" />} label="Lens" onClick={() => setLensOpen(true)} />
          <ToolBtn icon={<LayoutGrid className="h-4 w-4" />} label="Sets" onClick={() => setPanel(panel === "templates" ? null : "templates")} />
          <ToolBtn icon={<Type className="h-4 w-4" />} label="Text" onClick={addText} />
          <ToolBtn icon={<AtSign className="h-4 w-4" />} label="Mention" onClick={() => setPanel(panel === "caption" ? null : "caption")} />
          <ToolBtn icon={<Smile className="h-4 w-4" />} label="Sticker" onClick={() => setPanel(panel === "sticker" ? null : "sticker")} />
          <ToolBtn icon={<Brush className="h-4 w-4" />} label="Brush" onClick={() => setPanel(panel === "brush" ? null : "brush")} />
          <ToolBtn icon={<Sparkle className="h-4 w-4" />} label="Motion" onClick={() => setPanel(panel === "motion" ? null : "motion")} />
          <ToolBtn icon={<Layers className="h-4 w-4" />} label="Layers" onClick={() => setPanel(panel === "layers" ? null : "layers")} />
          <ToolBtn icon={<Wand2 className="h-4 w-4" />} label="Filter" onClick={() => setPanel(panel === "filter" ? null : "filter")} />
          <ToolBtn icon={<Palette className="h-4 w-4" />} label="Tune" onClick={() => setPanel(panel === "tune" ? null : "tune")} />
          <ToolBtn icon={<Palette className="h-4 w-4" />} label="BG" onClick={() => setPanel(panel === "bg" ? null : "bg")} disabled={!!mediaUrl} />
          <ToolBtn
            icon={<Lock className="h-4 w-4" />}
            label={AUDIENCE_OPTIONS.find((option) => option.id === audience)!.label.split(" ")[0]}
            onClick={() => setPanel(panel === "privacy" ? null : "privacy")}
          />
        </div>
      </div>
      {/* The lens studio returns the composed frame, which becomes the story's
          media — text, stickers and filters then layer on top of it. */}
      <FaceEffectsStudio
        open={lensOpen}
        onClose={() => setLensOpen(false)}
        onCapture={(lensed) => {
          setFile(lensed);
          setIsVideo(false);
          setMediaUrl(URL.createObjectURL(lensed));
          setLensOpen(false);
        }}
      />

      <input ref={fileRef} hidden type="file" accept="image/*,video/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
    </motion.div>
    </FullScreenLayer>
  );
}

function DrawingsSvg({
  overlays,
  liveStroke,
  liveBrush,
  liveColor,
  liveSize,
  selectedId,
  onSelect,
}: {
  overlays: Overlay[];
  liveStroke: StrokePoint[] | null;
  liveBrush: BrushId;
  liveColor: string;
  liveSize: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const strokes = overlays.filter((o) => o.kind === "drawing");
  const erasers = strokes.filter((o) => o.brush === "eraser");
  const paint = strokes.filter((o) => o.brush !== "eraser");
  const strokeWidth = (size: number) => ((size ?? 10) / 1080) * 100;
  const render = (o: Overlay, extraProps: Record<string, unknown> = {}) => (
    <polyline
      key={o.id}
      points={(o.points ?? []).map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
      fill="none"
      stroke={
        o.brush === "rainbow"
          ? "url(#drawings-rainbow)"
          : o.brush === "highlighter"
            ? (o.brushColor ?? "#c8ff3d")
            : (o.brushColor ?? "#c8ff3d")
      }
      strokeWidth={strokeWidth(o.brushSize ?? 10) * (o.brush === "highlighter" ? 2.2 : 1)}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={o.brush === "highlighter" ? 0.45 : 1}
      {...extraProps}
    />
  );
  return (
    <svg
      aria-hidden={!strokes.some((o) => o.id === selectedId)}
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <mask id="drawings-erase-mask">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {erasers.map((o) => (
            <polyline
              key={o.id}
              points={(o.points ?? []).map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
              fill="none"
              stroke="black"
              strokeWidth={strokeWidth(o.brushSize ?? 10) * 1.6 + 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </mask>
        <linearGradient id="drawings-rainbow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f00" />
          <stop offset="0.2" stopColor="#ff0" />
          <stop offset="0.4" stopColor="#0f0" />
          <stop offset="0.6" stopColor="#0ff" />
          <stop offset="0.8" stopColor="#00f" />
          <stop offset="1" stopColor="#f0f" />
        </linearGradient>
      </defs>
      <g mask="url(#drawings-erase-mask)">
        {paint.map((o) => render(o))}
      </g>
      {/* Fat invisible hit strokes so committed drawings stay selectable. */}
      {strokes.map((o) => (
        <polyline
          key={`hit-${o.id}`}
          points={(o.points ?? []).map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth(o.brushSize ?? 10) + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "stroke", cursor: "grab" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(o.id);
          }}
        />
      ))}
      {liveStroke && liveStroke.length > 0 && (
        <polyline
          points={liveStroke.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
          fill="none"
          stroke={liveBrush === "rainbow" ? "url(#drawings-rainbow)" : liveColor}
          strokeWidth={strokeWidth(liveSize) * (liveBrush === "highlighter" ? 2.2 : 1)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={liveBrush === "highlighter" ? 0.45 : 0.9}
          strokeDasharray={liveBrush === "eraser" ? "3 2" : undefined}
        />
      )}
    </svg>
  );
}

function drawParticles(
  c: CanvasRenderingContext2D,
  ps: Particle[],
  kind: ParticleKind,
  W: number,
  H: number,
) {
  c.save();
  for (const p of ps) {
    const x = p.x * W;
    const y = p.y * H;
    if (kind === "hearts") {
      const s = p.size * (W / 720);
      c.save();
      c.translate(x, y);
      c.rotate(Math.sin(p.wobble) * 0.3);
      c.scale(s / 50, s / 50);
      c.globalAlpha = p.alpha;
      c.fillStyle = "#ff5c8a";
      c.beginPath();
      c.moveTo(0, 32);
      c.bezierCurveTo(-42, 5, -38, -30, -18, -30);
      c.bezierCurveTo(-7, -30, -2, -20, 0, -14);
      c.bezierCurveTo(2, -20, 7, -30, 18, -30);
      c.bezierCurveTo(38, -30, 42, 5, 0, 32);
      c.fill();
      c.restore();
    } else if (kind === "confetti") {
      c.save();
      c.translate(x, y);
      c.rotate(p.rot);
      c.globalAlpha = p.alpha;
      c.fillStyle = `hsl(${Math.round(p.hue)}, 95%, 60%)`;
      const s = p.size * (W / 720);
      c.fillRect(-s / 2, -s / 4, s, s / 2);
      c.restore();
    } else if (kind === "snow") {
      c.globalAlpha = p.alpha * 0.9;
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(x, y, p.size * (W / 720) * 0.5, 0, Math.PI * 2);
      c.fill();
    } else if (kind === "fireflies") {
      const flicker = 0.45 + 0.55 * Math.abs(Math.sin(p.wobble * 1.7));
      c.globalAlpha = p.alpha * flicker;
      c.shadowColor = "#d8ff6a";
      c.shadowBlur = 18;
      c.fillStyle = "#eaff9a";
      c.beginPath();
      c.arc(x, y, p.size * (W / 720) * 0.35, 0, Math.PI * 2);
      c.fill();
    } else if (kind === "rain") {
      c.globalAlpha = p.alpha * 0.7;
      c.strokeStyle = "#9adcff";
      c.lineWidth = Math.max(1.5, p.size * 0.12);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - p.size * 0.5, y + p.size * 1.6);
      c.stroke();
    } else {
      c.globalAlpha = 0.16;
      const s = p.size * (W / 720);
      const g = c.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, `hsla(${Math.round(p.hue)}, 100%, 65%, 0.8)`);
      g.addColorStop(1, "hsla(300, 100%, 60%, 0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, s, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function MotionPreview({ kind }: { kind: ParticleKind }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const W = 360;
    const H = 640;
    canvas.width = W;
    canvas.height = H;
    const ps = createParticles(kind, 11);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      stepParticles(ps, kind, Math.min(0.05, (now - last) / 1000));
      last = now;
      c.clearRect(0, 0, W, H);
      drawParticles(c, ps, kind, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

function IconThumb({ name, color, size }: { name: string; color: string; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const entry = ICONS[name];
    if (!canvas || !entry) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 96, 96);
    c.save();
    c.scale(0.96, 0.96);
    entry.draw(c, color);
    c.restore();
  }, [name, color]);
  return <canvas ref={ref} width={96} height={96} style={{ width: size, height: size }} aria-hidden />;
}

function ToolBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      // min-w keeps the 44px touch target the brief asks for on a 375px screen.
      className="flex min-w-[52px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
    >
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

/** Export painter for brush strokes (points are 0..1 fractions of W). */
function paintStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  brush: BrushId,
  color: string,
  size: number,
) {
  if (points.length === 0) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const px = smoothStroke(
    points.map((p) => ({ x: p.x * W, y: p.y * H, p: p.p ?? 0.7 })),
    5,
  );
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pressure = (i: number) => px[Math.min(px.length - 1, Math.max(0, i))].p ?? 0.7;
  if (brush === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = size * 1.6;
    strokePath(ctx, px);
  } else if (brush === "spray") {
    ctx.fillStyle = color;
    for (let i = 0; i < px.length; i += 1) {
      const spread = size * 1.4;
      for (let k = 0; k < 5; k += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(px[i].x + Math.cos(a) * r, px[i].y + Math.sin(a) * r, Math.max(1, size * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else if (brush === "rainbow") {
    for (let i = 1; i < px.length; i += 1) {
      ctx.strokeStyle = `hsl(${(i / px.length) * 360}, 95%, 60%)`;
      ctx.lineWidth = size * (0.5 + pressure(i) * 0.7);
      ctx.beginPath();
      ctx.moveTo(px[i - 1].x, px[i - 1].y);
      ctx.lineTo(px[i].x, px[i].y);
      ctx.stroke();
    }
  } else {
    if (brush === "highlighter") {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = size * 2.2;
    } else if (brush === "marker") {
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = size * 1.3;
    } else {
      ctx.lineWidth = size * (brush === "pen" ? 0.8 : 1);
    }
    ctx.strokeStyle = color;
    if (brush === "neon") {
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 1.6;
    }
    strokePath(ctx, px);
    if (brush === "neon") {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.5, size * 0.3);
      strokePath(ctx, px);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, px: Array<{ x: number; y: number }>) {
  ctx.beginPath();
  px.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (px.length === 1) ctx.lineTo(px[0].x + 0.5, px[0].y + 0.5);
  ctx.stroke();
}

/**
 * Composites every drawing stroke onto its own layer first, so the eraser
 * only ever removes paint — never the photo or text beneath. Mirrors the
 * editor's SVG mask exactly.
 */
function paintDrawingsLayer(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  W: number,
) {
  const drawings = overlays.filter((o) => o.kind === "drawing" && (o.points ?? []).length > 0);
  if (drawings.length === 0) return;
  const H = ctx.canvas.height;
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const c = layer.getContext("2d");
  if (!c) return;
  for (const o of drawings) {
    if (o.brush === "eraser") continue;
    paintStroke(c, o.points ?? [], o.brush ?? "pen", o.brushColor ?? "#c8ff3d", (o.brushSize ?? 10) * (W / CANVAS_W));
  }
  for (const o of drawings) {
    if (o.brush !== "eraser") continue;
    paintStroke(c, o.points ?? [], "eraser", "#000", (o.brushSize ?? 10) * (W / CANVAS_W));
  }
  ctx.drawImage(layer, 0, 0);
}

/** Export painter for the 7 text styles (mirrors the editor toolbar). */
function paintStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  ov: { color?: string; font?: string; style?: string },
) {
  const color = ov.color || "#fff";
  const weight = ov.style === "poster" ? "900 " : "700 ";
  ctx.font = `${weight}${size}px ${fontFor(ov.font)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (ov.style) {
    case "neon":
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.55;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x, y);
      break;
    case "outline":
      ctx.lineWidth = Math.max(2, size / 14);
      ctx.strokeStyle = color;
      ctx.strokeText(text, x, y);
      break;
    case "highlight": {
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "#c8ff3d";
      ctx.fillRect(x - w / 2 - 12, y - size * 0.62, w + 24, size * 1.24);
      ctx.fillStyle = "#141416";
      ctx.fillText(text, x, y);
      break;
    }
    case "poster":
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(text, x + 4, y + 5);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      break;
    default:
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillText(text, x, y);
      break;
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Template frame chrome, painted over the finished export. */
function paintFrame(
  ctx: CanvasRenderingContext2D,
  frame: "none" | "polaroid" | "film" | "neon",
  w: number,
  h: number,
) {
  if (frame === "none") return;
  if (frame === "neon") {
    ctx.save();
    ctx.strokeStyle = "#c8ff3d";
    ctx.lineWidth = 10;
    ctx.shadowColor = "#c8ff3d";
    ctx.shadowBlur = 45;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.restore();
    return;
  }
  if (frame === "polaroid") {
    ctx.save();
    ctx.fillStyle = "#f5f1e6";
    ctx.fillRect(0, 0, w, h * 0.035);
    ctx.fillRect(0, 0, w * 0.045, h);
    ctx.fillRect(w * 0.955, 0, w * 0.045, h);
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
    ctx.restore();
    return;
  }
  // film: sprocket bars top + bottom.
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h * 0.05);
  ctx.fillRect(0, h * 0.95, w, h * 0.05);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const holes = 12;
  for (let i = 0; i < holes; i += 1) {
    const x = (w / holes) * i + w / holes / 2;
    ctx.fillRect(x - 9, h * 0.015, 18, h * 0.02);
    ctx.fillRect(x - 9, h * 0.965, 18, h * 0.02);
  }
  ctx.restore();
}