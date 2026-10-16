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
  EMOJI_PACK,
  FONTS,
  ICONS,
  PHRASE_PACK,
  TEMPLATES,
  TEXT_STYLES,
  fontStack,
  type FontId,
  type StickerTab,
  type TextStyleId,
} from "@/lib/story-creator/content";

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
  kind: "text" | "sticker" | "image";
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
};

const STICKER_TABS: StickerTab[] = ["Emoji", "Icons", "Mood", "Gen Z", "Hinglish", "Desi pop"];
const FILTERS: { name: string; css: string }[] = [
  { name: "None",       css: "none" },
  { name: "Bloom",      css: "saturate(1.3) contrast(1.05) brightness(1.05)" },
  { name: "Noir",       css: "grayscale(1) contrast(1.15)" },
  { name: "Sepia",      css: "sepia(0.7) saturate(1.2)" },
  { name: "Cool",       css: "hue-rotate(200deg) saturate(1.1)" },
  { name: "Vivid",      css: "saturate(1.6) contrast(1.1)" },
  { name: "Fade",       css: "contrast(0.9) brightness(1.1) saturate(0.85)" },
];
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
  const [panel, setPanel] = useState<"text" | "sticker" | "filter" | "bg" | "caption" | "privacy" | "templates" | "layers" | null>(null);
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

  const pushHistory = (prev: Overlay[]) => setHistory((h) => [...h.slice(-19), prev]);
  const undo = () => setHistory((h) => {
    if (h.length === 0) return h;
    const last = h[h.length - 1];
    setOverlays(last);
    return h.slice(0, -1);
  });

  useEffect(() => {
    if (!open) {
      setFile(null); setMediaUrl(null); setIsVideo(false);
      setOverlays([]); setSelected(null); setFilter("none");
      setBg("#131315"); setPanel(null);
      setHistory([]); setEditingId(null);
      setAudience("everyone"); setHiddenFrom([]); setCaption("");
      setEditorText(""); setPeopleQuery(""); setPeopleHits([]);
      setTemplateId("blank"); setFrame("none"); setStickerTab("Emoji");
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
    // overlays
    for (const ov of overlays) {
      ctx.save();
      ctx.translate(ov.x * CANVAS_W, ov.y * CANVAS_H);
      ctx.rotate((ov.rotate * Math.PI) / 180);
      if (ov.kind === "image" && ov.src && ov.w && ov.h) {
        const w = ov.w * CANVAS_W * ov.scale;
        const h = ov.h * CANVAS_H * ov.scale;
        try {
          const img = await loadImage(ov.src);
          const ir = img.width / img.height;
          const cr = w / h;
          let dw = w, dh = h;
          if (ir > cr) { dw = h * ir; } else { dh = w / ir; }
          ctx.beginPath();
          ctx.rect(-w / 2, -h / 2, w, h);
          ctx.clip();
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        } catch {
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
        continue;
      }
      const baseSize = ov.kind === "text" ? 72 : 140;
      const size = baseSize * ov.scale;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (ov.kind === "text") {
        paintStyledText(ctx, ov.value, 0, 0, size, ov);
      } else if (ov.icon && ICONS[ov.icon]) {
        ctx.save();
        ctx.scale(size / 100, size / 100);
        ICONS[ov.icon].draw(ctx, ov.iconColor || "#c8ff3d");
        ctx.restore();
      } else {
        ctx.font = `${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji"`;
        ctx.fillText(ov.value, 0, 0);
      }
      ctx.restore();
    }
    paintFrame(ctx, frame, CANVAS_W, CANVAS_H);
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
          <div className="text-sm font-semibold hidden xs:block sm:block">New story</div>
        </div>
        <Button onClick={post} disabled={busy} size="sm" className="bg-primary text-primary-foreground shadow-md rounded-full px-4 h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Share</>}
        </Button>
      </div>

      {/* Canvas stage — 9:16 */}
      <div className="flex-1 flex items-center justify-center px-2 pb-1 min-h-0">
        <div
          ref={stageRef}
          onPointerDown={(e) => { if (e.target === stageRef.current) setSelected(null); }}
          className="relative rounded-2xl overflow-hidden shadow-md border border-white/10 select-none touch-none h-full w-auto max-h-full max-w-full"
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

          {overlays.map((ov) => (
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
                  <img src={ov.src} alt="" className="h-full w-full rounded-lg object-cover" draggable={false} />
                ) : (
                  <button
                    type="button"
                    aria-label="Fill photo slot"
                    onClick={(e) => { e.stopPropagation(); setSelected(ov.id); fileRef.current?.click(); }}
                    className="grid h-full w-full place-items-center rounded-lg border-2 border-dashed border-primary/60 bg-white/5 text-xs font-bold text-primary"
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
          ))}

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
        <div className="glass-strong flex items-center gap-1 overflow-x-auto rounded-2xl p-2 scrollbar-hide">
          <ToolBtn icon={<ImageIcon className="h-4 w-4" />} label="Media" onClick={() => fileRef.current?.click()} />
          <ToolBtn icon={<ScanFace className="h-4 w-4" />} label="Lens" onClick={() => setLensOpen(true)} />
          <ToolBtn icon={<LayoutGrid className="h-4 w-4" />} label="Sets" onClick={() => setPanel(panel === "templates" ? null : "templates")} />
          <ToolBtn icon={<Type className="h-4 w-4" />} label="Text" onClick={addText} />
          <ToolBtn icon={<AtSign className="h-4 w-4" />} label="Mention" onClick={() => setPanel(panel === "caption" ? null : "caption")} />
          <ToolBtn icon={<Smile className="h-4 w-4" />} label="Sticker" onClick={() => setPanel(panel === "sticker" ? null : "sticker")} />
          <ToolBtn icon={<Layers className="h-4 w-4" />} label="Layers" onClick={() => setPanel(panel === "layers" ? null : "layers")} />
          <ToolBtn icon={<Wand2 className="h-4 w-4" />} label="Filter" onClick={() => setPanel(panel === "filter" ? null : "filter")} disabled={!mediaUrl} />
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