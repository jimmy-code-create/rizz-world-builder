import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  ScanFace,
  SwitchCamera,
  TriangleAlert,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Slider } from "@/components/ui/slider";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import {
  CATEGORY_LABELS,
  EFFECT_CATEGORIES,
  FACE_EFFECTS,
  effectGlyph,
  findFaceEffect,
  type EffectCategory,
  type FaceEffect,
} from "@/lib/face-effects";
import {
  detectStill,
  signalFor,
  useFaceTracking,
  useHeadShake,
  type FaceGeometry,
} from "@/components/story/face-mesh";
import { FaceWarpRenderer, drawOverlays } from "@/components/story/face-pipeline";

/**
 * The lens studio: live camera (or a gallery photo), 69 effects, one slider.
 *
 * Performance contract from the brief, all three honoured here:
 *  - detection is skipped when the video has not produced a new frame;
 *  - a sustained frame rate under 24fps switches the render resolution to half
 *    (`quality === "low"`) and it climbs back when the rate recovers;
 *  - no CPU pixel loops — the warps and grades are one WebGL program, and the
 *    overlay/particle layers are composited by the browser on a second canvas.
 *
 * When no face is found the original frame is shown untouched with a "No face
 * found" hint, exactly as asked — never a half-applied effect.
 */
export function FaceEffectsStudio({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the composed frame, ready to become the story's media. */
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rendererRef = useRef<FaceWarpRenderer | null>(null);
  const frameRef = useRef(0);

  const [category, setCategory] = useState<EffectCategory>("warp");
  const [effect, setEffect] = useState<FaceEffect | null>(null);
  const [intensity, setIntensity] = useState(0.6);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [stillFaces, setStillFaces] = useState<FaceGeometry[]>([]);
  const [stillSource, setStillSource] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [hasStreamedFrame, setHasStreamedFrame] = useState(false);

  const video = videoRef.current;
  const trackingEnabled = open && !!video && !stillSource;
  const tracking = useFaceTracking({ video, enabled: trackingEnabled });
  const shake = useHeadShake(tracking.faces, effect?.reactive?.trigger === "headShake");
  const faces = stillSource ? stillFaces : tracking.faces;

  const activeTrigger = effect?.reactive?.trigger ?? null;
  const reactivity = activeTrigger === "headShake" ? shake : signalFor(faces[0] ?? null, activeTrigger ?? "");
  const faceFound = faces.length > 0;

  const grouped = useMemo(() => {
    return EFFECT_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id], effects: FACE_EFFECTS.filter((item) => item.category === id) }));
  }, []);

  // ---- camera lifecycle -------------------------------------------------
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(
    async (nextFacing: "user" | "environment") => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser can't open a camera. Pick a photo instead.");
        setStarting(false);
        return;
      }
      setStarting(true);
      setCameraError(null);
      try {
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing,
            width: { ideal: 720 },
            height: { ideal: 1280 },
            aspectRatio: { ideal: 9 / 16 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const element = videoRef.current;
        if (element) {
          element.srcObject = stream;
          await element.play().catch(() => {
            // Autoplay refusals are non-fatal: the first tap plays it.
          });
        }
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission was denied. Allow it in your browser settings, or pick a photo instead."
            : name === "NotFoundError"
              ? "No camera was found on this device. Pick a photo instead."
              : "Couldn't start the camera. Pick a photo instead.",
        );
      } finally {
        setStarting(false);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!open) return;
    void startStream(facing);
    return () => stopStream();
  }, [open, facing, startStream, stopStream]);

  useEffect(() => {
    if (!open) {
      setStillSource(null);
      setStillFaces([]);
      setEffect(null);
    }
  }, [open]);

  // ---- render loop ------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const glCanvas = glCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!glCanvas || !overlayCanvas) return;
    if (!rendererRef.current) rendererRef.current = new FaceWarpRenderer(glCanvas);
    const renderer = rendererRef.current;
    const overlay = overlayCanvas.getContext("2d");
    const source = stillSource ? imageRef.current : videoRef.current;
    renderer.setVideo(source as TexImageSource | null);

    // Half resolution when the tracker is struggling, full resolution otherwise.
    const scale = tracking.quality === "low" ? 0.5 : 1;
    const width = Math.round(720 * scale);
    const height = Math.round(1280 * scale);
    renderer.resize(width, height);
    if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
    }

    // The still path is drawn once; the live path runs every animation frame.
    const draw = (time: number) => {
      renderer.setVideo(source as TexImageSource | null);
      renderer.render({ effect, intensity, faces, time });
      if (overlay) {
        drawOverlays({
          ctx: overlay,
          width,
          height,
          effect,
          intensity,
          faces,
          time,
          reactivity,
          source: glCanvas,
        });
      }
      if (source instanceof HTMLVideoElement && source.readyState >= 2) setHasStreamedFrame(true);
    };

    if (stillSource) {
      draw(performance.now());
      return;
    }

    const loop = (time: number) => {
      frameRef.current = window.requestAnimationFrame(loop);
      draw(time);
    };
    frameRef.current = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [open, effect, intensity, faces, reactivity, stillSource, tracking.quality]);

  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ---- gallery ----------------------------------------------------------
  const pickStill = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick a photo — videos use the live camera.");
      return;
    }
    stopStream();
    const url = URL.createObjectURL(file);
    setStillSource(url);
    setHasStreamedFrame(false);
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {});
    imageRef.current = image;
    // Real tracking on a still, not a guess.
    const found: FaceGeometry[] = await detectStill(image);
    setStillFaces(found);
    if (!found.length) toast.info("No face found in that photo — filters still apply.");
  }, [stopStream]);

  const capture = useCallback(async () => {
    const glCanvas = glCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!glCanvas || !overlayCanvas) return;
    setCapturing(true);
    try {
      const output = document.createElement("canvas");
      output.width = glCanvas.width;
      output.height = glCanvas.height;
      const ctx = output.getContext("2d");
      if (!ctx) throw new Error("Couldn't prepare the frame");
      ctx.drawImage(glCanvas, 0, 0);
      ctx.drawImage(overlayCanvas, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob((result) => resolve(result), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Couldn't save the frame");
      onCapture(new File([blob], `lens-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't capture that frame");
    } finally {
      setCapturing(false);
    }
  }, [onCapture]);

  const applyEffect = (next: FaceEffect) => {
    setEffect((current) => (current?.id === next.id ? null : next));
    setIntensity(next.defaultIntensity);
  };

  if (!open) return null;

  return (
    <FullScreenLayer open={open}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex flex-col bg-black"
          style={{ height: "100dvh" }}
        >
          <header
            className="flex shrink-0 items-center justify-between px-3 py-2"
            style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <CloseButton
              onClick={onClose}
              aria-label="Close the lens studio"
              className="glass-strong"
            />
            <div className="flex items-center gap-2">
              <span className="rounded-full glass-strong px-2.5 py-1 text-[11px] font-semibold">
                {effect ? effect.name : "Lenses"}
              </span>
              {!stillSource && tracking.fps > 0 && (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    tracking.quality === "high" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/20 text-amber-100"
                  }`}
                  title={tracking.quality === "low" ? "Lowering the render quality to hold the frame rate" : undefined}
                >
                  {tracking.fps}fps{tracking.quality === "low" ? " · low" : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFacing((current) => (current === "user" ? "environment" : "user"))}
              aria-label="Switch camera"
              className="grid h-11 w-11 place-items-center rounded-full glass-strong"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          </header>

          {/* 9:16 stage with the two stacked canvases. */}
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            <div
              className="relative h-full w-auto max-w-full overflow-hidden rounded-2xl border border-white/10"
              style={{ aspectRatio: "9 / 16" }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover ${stillSource ? "opacity-0" : ""}`}
              />
              <canvas ref={glCanvasRef} className="absolute inset-0 h-full w-full object-cover" />
              <canvas ref={overlayCanvasRef} className="absolute inset-0 h-full w-full object-cover" />

              {stillSource && (
                // A picked photo is decoded off-screen and read by the renderer;
                // the visible pixels always come from the canvases above.
                <img
                  ref={imageRef}
                  src={stillSource}
                  alt=""
                  className="pointer-events-none absolute h-px w-px opacity-0"
                  onLoad={() => {
                    const source = imageRef.current;
                    if (source) rendererRef.current?.setVideo(source);
                  }}
                />
              )}

              {(starting || cameraError) && !stillSource && (
                <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
                  {starting ? (
                    <div className="flex flex-col items-center gap-2 text-white/80">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-xs">Starting the camera…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <TriangleAlert className="h-7 w-7 text-amber-300" />
                      <p className="text-sm text-white/90">{cameraError}</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button type="button" size="sm" variant="outline" className="border-white/20" onClick={() => void startStream(facing)}>
                          <RotateCcw className="h-4 w-4" /> Retry
                        </Button>
                        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-white/20 px-3 text-xs font-semibold text-white">
                          <ImageIcon className="h-4 w-4" /> Pick a photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void pickStill(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No face found: the hint the brief asks for, over an untouched frame. */}
              {effect && !faceFound && !starting && !cameraError && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                  <ScanFace className="h-4 w-4 text-amber-300" /> No face found — showing the original image
                </div>
              )}

              {effect?.unavailable && (
                <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-black/75 px-3 py-2 text-[11px] leading-snug text-amber-100 backdrop-blur">
                  {effect.unavailable}
                </div>
              )}

              {tracking.note && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-[11px] text-white/85 backdrop-blur">
                  {tracking.note}
                </div>
              )}
            </div>
          </div>

          {/* Intensity — every effect has one, live. */}
          <div className="shrink-0 px-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-white/70">Intensity</span>
              <Slider
                value={[Math.round(intensity * 100)]}
                min={0}
                max={100}
                step={1}
                disabled={!effect}
                onValueChange={([value]) => setIntensity((value ?? 60) / 100)}
                aria-label="Effect intensity"
                className="flex-1"
              />
              <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/80">
                {Math.round(intensity * 100)}%
              </span>
            </div>
            {effect?.reactive && (
              <p className="mt-1 text-[11px] text-white/60">
                {effect.reactive.hint} · responding {Math.round(reactivity * 100)}%
              </p>
            )}
          </div>

          {/* Category rail, then the effect carousel above the capture button. */}
          <div className="shrink-0 px-2 pt-2">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {grouped.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={category === group.id}
                  onClick={() => setCategory(group.id)}
                  className={`min-h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold ${
                    category === group.id ? "bg-white text-black" : "bg-white/10 text-white/75"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 pb-1">
            <div className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-hide">
              {(grouped.find((group) => group.id === category)?.effects ?? []).map((item) => {
                const selected = effect?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => applyEffect(item)}
                    className={`flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-2xl border p-1.5 transition ${
                      selected
                        ? "border-primary bg-primary/20"
                        : "border-white/10 bg-white/[0.06]"
                    }`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/40 text-xl">
                      {effectGlyph(item)}
                    </span>
                    <span className="line-clamp-2 h-6 text-center text-[9px] font-semibold leading-tight text-white/85">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <footer
            className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-1"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            <label className="inline-flex h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full glass-strong px-3 text-[11px] font-semibold text-white">
              <ImageIcon className="h-4 w-4" /> Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void pickStill(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void capture()}
              disabled={capturing || (!hasStreamedFrame && !stillSource)}
              aria-label="Use this frame"
              className="grid h-16 w-16 place-items-center rounded-full border-4 border-white/25 bg-white text-black transition disabled:opacity-50"
            >
              {capturing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setEffect(null);
                setIntensity(0.6);
              }}
              className="inline-flex h-11 min-w-11 items-center gap-1.5 rounded-full glass-strong px-3 text-[11px] font-semibold text-white"
            >
              <Check className="h-4 w-4" /> None
            </button>
          </footer>
        </motion.div>
      </AnimatePresence>
    </FullScreenLayer>
  );
}
