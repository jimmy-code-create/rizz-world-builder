import { useEffect, useRef, useState } from "react";
import type { WarpAnchor } from "@/lib/face-effects";

/**
 * Real-time face tracking: MediaPipe Face Landmarker, loaded lazily.
 *
 * The lens feature is optional, so the library is imported only when a studio
 * actually opens — the app never pays for it on a normal page, and the build
 * stays working when the CDN is unreachable. Everything degrades to "No face
 * found" with the original image intact, never to a broken canvas.
 *
 * It also asks for face *blendshapes* (ARKit-style): `jawOpen`, `mouthPucker`,
 * `tongueOut`, `eyeBlinkLeft/Right`, `browInnerUp`, `mouthSmileLeft/Right`. That
 * is what makes the reactive lenses (fire breath, kiss burst, dog tongue)
 * actually respond to the right expression instead of guessing from geometry.
 */

const TASKS_VISION_VERSION = "1.1.0";
/**
 * Loaded from jsDelivr at a pinned version rather than added to `package.json`.
 *
 * This repo ships three lockfiles and the Render build runs `npm ci` against a
 * `package-lock.json` that is gitignored, so adding a dependency here would mean
 * keeping all three in step just to import a library whose wasm and face model
 * are fetched from a CDN anyway. Pinning the version in one place and importing
 * lazily keeps the install story untouched; if the CDN is unreachable the studio
 * simply reports that tracking is unavailable.
 */
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/vision_bundle.mjs`;
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** MediaPipe Face Mesh indices we actually use. */
const IDX = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  leftEyelidTop: 159,
  leftEyelidBottom: 145,
  rightEyelidTop: 386,
  rightEyelidBottom: 374,
  upperLipInner: 13,
  lowerLipInner: 14,
  mouthLeft: 61,
  mouthRight: 291,
  noseTip: 1,
  noseBridge: 168,
  forehead: 10,
  chin: 152,
  cheekLeft: 234,
  cheekRight: 454,
  jawLeft: 172,
  jawRight: 397,
  browLeft: 105,
  browRight: 334,
} as const;

export type Point = { x: number; y: number; z: number };

export type FaceGeometry = {
  /** Eye-to-eye distance, the unit every other measurement is expressed in. */
  scale: number;
  anchors: Record<WarpAnchor, Point>;
  /** Head rotation in radians, measured from the landmarks. */
  roll: number;
  yaw: number;
  pitch: number;
  /** 0–1 expression channels; blendshapes when available, geometry otherwise. */
  signals: Record<FaceSignal, number>;
};

export type FaceSignal =
  | "mouthOpen"
  | "browRaise"
  | "blink"
  | "smile"
  | "kiss"
  | "tongueOut";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Midpoint of two landmarks. */
function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type BlendShapeCategory = { categoryName: string; score: number };

/** Blendshape lookup that tolerates the shape being absent. */
function blends(
  categories: BlendShapeCategory[] | undefined,
  name: string,
): number | null {
  if (!categories) return null;
  const hit = categories.find((category) => category.categoryName === name);
  return hit ? clamp01(hit.score) : null;
}

/**
 * Turns one face's 468 landmarks (plus optional blendshapes) into the handful of
 * anchors and expression channels the registry refers to.
 */
export function deriveFaceGeometry(
  points: Point[],
  blendCategories?: BlendShapeCategory[],
): FaceGeometry | null {
  const at = (index: number): Point | null => points[index] ?? null;
  const leftEye = at(IDX.leftEyeOuter);
  const rightEye = at(IDX.rightEyeOuter);
  const nose = at(IDX.noseTip);
  const forehead = at(IDX.forehead);
  const chin = at(IDX.chin);
  if (!leftEye || !rightEye || !nose || !forehead || !chin) return null;

  const scale = distance(leftEye, rightEye) || 0.08;
  const faceHeight = distance(forehead, chin) || scale * 1.6;
  const eyesCenter = mid(leftEye, rightEye);
  const mouth = mid(at(IDX.upperLipInner) ?? nose, at(IDX.lowerLipInner) ?? nose);
  const cheeks = mid(at(IDX.cheekLeft) ?? leftEye, at(IDX.cheekRight) ?? rightEye);
  const jaw = mid(at(IDX.jawLeft) ?? chin, at(IDX.jawRight) ?? chin);
  const faceCenter = mid(forehead, chin);

  // Geometry fallbacks, used whenever blendshapes are unavailable.
  const mouthGap = distance(at(IDX.upperLipInner) ?? mouth, at(IDX.lowerLipInner) ?? mouth);
  const mouthWidth = distance(at(IDX.mouthLeft) ?? mouth, at(IDX.mouthRight) ?? mouth);
  const leftEar = distance(at(IDX.leftEyelidTop) ?? leftEye, at(IDX.leftEyelidBottom) ?? leftEye) / scale;
  const rightEar = distance(at(IDX.rightEyelidTop) ?? rightEye, at(IDX.rightEyelidBottom) ?? rightEye) / scale;
  const browGap =
    (distance(at(IDX.browLeft) ?? forehead, at(IDX.leftEyelidTop) ?? leftEye) +
      distance(at(IDX.browRight) ?? forehead, at(IDX.rightEyelidTop) ?? rightEye)) /
    2 /
    faceHeight;

  const eyesOpen = (leftEar + rightEar) / 2;
  const mouthOpenGeo = clamp01((mouthGap / faceHeight - 0.01) / 0.09);
  const smileGeo = clamp01((mouthWidth / scale - 0.72) / 0.4);

  const signals: Record<FaceSignal, number> = {
    mouthOpen: blends(blendCategories, "jawOpen") ?? mouthOpenGeo,
    browRaise: blends(blendCategories, "browInnerUp") ?? clamp01((browGap - 0.11) / 0.06),
    blink:
      blends(blendCategories, "eyeBlinkLeft") ??
      blends(blendCategories, "eyeBlinkRight") ??
      clamp01(1 - eyesOpen / 0.3),
    smile:
      Math.max(
        blends(blendCategories, "mouthSmileLeft") ?? 0,
        blends(blendCategories, "mouthSmileRight") ?? 0,
      ) || smileGeo,
    kiss: blends(blendCategories, "mouthPucker") ?? clamp01((0.82 - mouthWidth / scale) / 0.3),
    tongueOut: blends(blendCategories, "tongueOut") ?? 0,
  };

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  // Yaw: how far the nose sits from the eye midpoint. Pitch: nose height between
  // forehead and chin, re-centred on the neutral third.
  const yaw = ((nose.x - eyesCenter.x) / scale) * 1.6;
  const pitch = ((nose.y - faceCenter.y) / faceHeight) * 1.6 - 0.05;

  return {
    scale,
    roll,
    yaw,
    pitch,
    signals,
    anchors: {
      leftEye,
      rightEye,
      eyes: eyesCenter,
      mouth,
      nose,
      forehead,
      chin,
      cheeks,
      jaw,
      face: faceCenter,
      frame: { x: 0.5, y: 0.5, z: 0 },
    },
  };
}

/** The handful of exports of `@mediapipe/tasks-vision` that we actually use. */
type VisionModule = {
  FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
  FaceLandmarker: {
    createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<unknown>;
  };
};

type LandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    faceLandmarks?: Point[][];
    faceBlendshapes?: { categories: BlendShapeCategory[] }[];
  };
  close?: () => void;
};

let landmarkerPromise: Promise<LandmarkerLike | null> | null = null;
let loadFailure: string | null = null;

/**
 * Loads the landmarker once per page. Returns null (never throws) when the model
 * cannot be fetched, so the studio can show a plain message instead of dying.
 */
export async function loadFaceLandmarker(): Promise<LandmarkerLike | null> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    try {
      // A computed specifier with @vite-ignore: the bundler must leave this URL
      // alone and let the browser fetch it at runtime.
      const vision = (await import(/* @vite-ignore */ TASKS_VISION_URL)) as VisionModule;
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 4,
        outputFaceBlendshapes: true,
      });
      return landmarker as unknown as LandmarkerLike;
    } catch (error) {
      loadFailure =
        error instanceof Error
          ? `Face tracking couldn't start (${error.message}). You can still use filters and overlays without it.`
          : "Face tracking couldn't start.";
      console.warn("[face-mesh] landmarker unavailable", error);
      return null;
    }
  })();
  return landmarkerPromise;
}

/**
 * One-shot detection for a still image (a gallery photo). The studio uses the
 * live hook for video and this for photos, so both paths get real tracking
 * instead of the photo going untracked.
 */
export async function detectStill(image: HTMLImageElement): Promise<FaceGeometry[]> {
  const landmarker = await loadFaceLandmarker();
  if (!landmarker) return [];
  try {
    const result = (landmarker as unknown as {
      detect: (input: HTMLImageElement) => {
        faceLandmarks?: Point[][];
        faceBlendshapes?: { categories: BlendShapeCategory[] }[];
      };
    }).detect(image);
    const geometries: FaceGeometry[] = [];
    for (let index = 0; index < (result.faceLandmarks?.length ?? 0); index += 1) {
      const geometry = deriveFaceGeometry(
        result.faceLandmarks![index] as Point[],
        result.faceBlendshapes?.[index]?.categories,
      );
      if (geometry) geometries.push(geometry);
    }
    return geometries;
  } catch (error) {
    console.debug("[face-mesh] still detection failed", error);
    return [];
  }
}

export type FaceTracking = {
  faces: FaceGeometry[];
  /** Measured detection rate, so the UI can be honest about performance. */
  fps: number;
  /** Set to "low" when the frame rate drops, which lowers the render resolution. */
  quality: "high" | "low";
  ready: boolean;
  note: string | null;
};

/**
 * Runs the landmarker over a live `<video>` on a rAF loop.
 *
 * Two performance guards, exactly as asked for: detection is skipped when the
 * video has not produced a new frame, and a sustained frame rate below 24fps
 * drops `quality` to "low" (the studio then renders at half resolution) until it
 * recovers above 28fps.
 */
export function useFaceTracking({
  video,
  enabled,
}: {
  video: HTMLVideoElement | null;
  enabled: boolean;
}): FaceTracking {
  const [faces, setFaces] = useState<FaceGeometry[]>([]);
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !video) {
      setFaces([]);
      setReady(false);
      return;
    }
    let disposed = false;
    let frame = 0;
    let lastVideoTime = -1;
    let lastStamp = 0;
    const samples: number[] = [];
    let qualityRef: "high" | "low" = "high";
    /** The shared landmarker; the loop reads it every frame. */
    const landmarkerRef: { current: LandmarkerLike | null } = { current: null };

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const landmarker = landmarkerRef.current;
      if (!landmarker) return;
      const now = performance.now();
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      try {
        const result = landmarker.detectForVideo(video, now);
        const geometries: FaceGeometry[] = [];
        for (let index = 0; index < (result.faceLandmarks?.length ?? 0); index += 1) {
          const geometry = deriveFaceGeometry(
            result.faceLandmarks![index] as Point[],
            result.faceBlendshapes?.[index]?.categories,
          );
          if (geometry) geometries.push(geometry);
        }
        setFaces(geometries);
        setReady(true);
      } catch (error) {
        console.debug("[face-mesh] detection frame skipped", error);
      }

      // Rolling frame-rate window over roughly a second of detections.
      if (lastStamp) samples.push(now - lastStamp);
      lastStamp = now;
      if (samples.length > 30) samples.shift();
      if (samples.length >= 12) {
        const average = samples.reduce((total, value) => total + value, 0) / samples.length;
        const measured = average > 0 ? Math.round(1000 / average) : 0;
        setFps((current) => (Math.abs(current - measured) > 2 ? measured : current));
        if (qualityRef === "high" && measured < 24) {
          qualityRef = "low";
          setQuality("low");
        } else if (qualityRef === "low" && measured > 28) {
          qualityRef = "high";
          setQuality("high");
        }
      }
    };

    void (async () => {
      const landmarker = await loadFaceLandmarker();
      // The instance is shared for the life of the page, so a disposed mount must
      // NOT close it — a later studio would then get a dead landmarker.
      if (disposed) return;
      landmarkerRef.current = landmarker;
      if (!landmarker) {
        setNote(loadFailure ?? "Face tracking isn't available in this browser.");
        return;
      }
      frame = window.requestAnimationFrame(tick);
    })();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      // The landmarker is shared across mounts; only the loop stops here.
      landmarkerRef.current = null;
    };
  }, [enabled, video]);

  return { faces, fps, quality, ready, note };
}

/** The signal value that fires a reactive lens, or 0. */
export function signalFor(face: FaceGeometry | null, trigger: string): number {
  if (!face) return 0;
  switch (trigger) {
    case "mouthOpen":
      return face.signals.mouthOpen;
    case "browRaise":
      return face.signals.browRaise;
    case "blink":
      return face.signals.blink;
    case "smile":
      return face.signals.smile;
    case "kiss":
      return face.signals.kiss;
    case "tongueOut":
      return face.signals.tongueOut;
    default:
      return 0;
  }
}

/** Keeps a rolling record of nose-x so a head shake can be detected. */
export function useHeadShake(faces: FaceGeometry[], active: boolean): number {
  const history = useRef<{ t: number; x: number }[]>([]);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (!active) {
      history.current = [];
      setShake(0);
      return;
    }
    const x = faces[0]?.anchors.nose.x;
    if (x === undefined) return;
    const now = Date.now();
    history.current = [...history.current.filter((entry) => now - entry.t < 700), { t: now, x }];
    const xs = history.current.map((entry) => entry.x);
    if (xs.length < 4) return;
    const spread = Math.max(...xs) - Math.min(...xs);
    // A shake moves the nose back and forth, so a wide spread in a short window
    // means motion rather than a still head held off-centre.
    setShake(clamp01((spread - 0.03) / 0.06));
  }, [faces, active]);

  return shake;
}
