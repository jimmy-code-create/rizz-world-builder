/**
 * The Flexes viewer: the supplied cat model, turned by hand.
 *
 * three.js and GLTFLoader are imported dynamically, so the ~600KB renderer only
 * downloads when a Flexes card or Cat Studio actually mounts. The model itself
 * is `public/models/cat.glb`, untouched geometry: its own "Take 001" clip plays
 * on a loop and the colourway recolours the model's base-colour texture.
 *
 * Budget rules baked in: pixel ratio capped at 2, one render per frame only
 * while visible (IntersectionObserver) and while the tab is awake, every
 * geometry/material/texture disposed on unmount, a 10s load timeout with Retry,
 * and a poster image instead of WebGL when the device cannot render.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAT_MODEL_URL, colourwayFor, recolourTexture, type CatColourwayId } from "./model";

export type CatModelHandle = {
  /** Square transparent PNG of the current pose, for share and as the poster. */
  capturePng: (size?: number) => Promise<Blob | null>;
};

type Status = "loading" | "ready" | "failed" | "unsupported";
const LOAD_TIMEOUT_MS = 10_000;

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function CatModel3D({
  colourway,
  className,
  handleRef,
  posterUrl,
  onReady,
}: {
  colourway: CatColourwayId;
  className?: string;
  handleRef?: Ref<CatModelHandle>;
  /** Shown while loading, on failure, and when WebGL is unavailable. */
  posterUrl?: string | null;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const mixerRef = useRef<any>(null);
  const rotation = useRef({ x: 0.05, y: 0 });
  const drag = useRef({ x: 0, y: 0, active: false });
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const colourwayRef = useRef(colourway);

  useImperativeHandle(handleRef, () => ({
    capturePng: async (size = 512) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;
      const canvas = renderer.domElement as HTMLCanvasElement;
      const previousWidth = canvas.width;
      const previousHeight = canvas.height;
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = canvas.toDataURL("image/png");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(previousWidth, previousHeight, false);
      camera.aspect = previousWidth / Math.max(1, previousHeight);
      camera.updateProjectionMatrix();
      const response = await fetch(url);
      return response.blob();
    },
  }));

  // Load once (and again only on Retry).
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    if (!webglAvailable()) {
      setStatus("unsupported");
      return;
    }

    let disposed = false;
    let frame = 0;
    let visible = true;
    const disposables: { dispose?: () => void }[] = [];
    const cleanup: (() => void)[] = [];
    setStatus("loading");

    const timeout = setTimeout(() => {
      if (!disposed && !modelRef.current) setStatus("failed");
    }, LOAD_TIMEOUT_MS);

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 1.1, 6.4);
      camera.lookAt(0, 0.9, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearAlpha(0);
      rendererRef.current = renderer;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight("#ffffff", "#20242c", 1.6));
      const key = new THREE.DirectionalLight("#fff7e6", 2.2);
      key.position.set(2.4, 4, 3.6);
      scene.add(key);
      const rim = new THREE.DirectionalLight("#c8ff3d", 0.7);
      rim.position.set(-3, 1.6, -2.6);
      scene.add(rim);

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      cleanup.push(() => observer.disconnect());

      const onDown = (event: PointerEvent) => {
        drag.current = { x: event.clientX, y: event.clientY, active: true };
        renderer.domElement.setPointerCapture(event.pointerId);
      };
      const onMove = (event: PointerEvent) => {
        if (!drag.current.active) return;
        rotation.current.y += (event.clientX - drag.current.x) * 0.011;
        rotation.current.x = Math.max(
          -0.6,
          Math.min(0.7, rotation.current.x + (event.clientY - drag.current.y) * 0.006),
        );
        drag.current.x = event.clientX;
        drag.current.y = event.clientY;
      };
      const onUp = () => {
        drag.current.active = false;
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);
      cleanup.push(() => {
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onUp);
        renderer.domElement.removeEventListener("pointercancel", onUp);
      });

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
      });
      io.observe(mount);
      cleanup.push(() => io.disconnect());
      const onVisibility = () => {
        visible = !document.hidden;
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));

      try {
        const gltf = await new GLTFLoader().loadAsync(CAT_MODEL_URL);
        if (disposed) return;
        const model = gltf.scene;
        modelRef.current = model;
        scene.add(model);

        // Frame the cat: scale it to ~2.2 units tall and sit it on the origin.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        // Fit the largest side, not the height: this model is about twice as wide
        // as it is tall, so scaling by height pushed it out of the canvas.
        const scale = 2.2 / Math.max(0.0001, Math.max(size.x, size.y));
        model.scale.setScalar(scale);
        const box2 = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        box2.getCenter(centre);
        model.position.sub(centre);
        model.position.y += 0.05;

        model.traverse((child: any) => {
          if (!child.isMesh) return;
          child.frustumCulled = false;
          const material = child.material;
          if (!material) return;
          disposables.push(material);
          // Recolour only the body: the eye, teeth and tuft cards share the atlas
          // in other materials and keep the artist's own look.
          if (material.name === "Material_81" && material.map?.image) {
            const canvas = recolourTexture(material.map.image, colourwayFor(colourwayRef.current));
            if (canvas) {
              const texture = new THREE.CanvasTexture(canvas);
              texture.colorSpace = material.map.colorSpace;
              texture.flipY = material.map.flipY;
              texture.wrapS = material.map.wrapS;
              texture.wrapT = material.map.wrapT;
              disposables.push(texture);
              material.map = texture;
              material.needsUpdate = true;
            }
          }
        });

        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          mixerRef.current = mixer;
        }

        clearTimeout(timeout);
        setStatus("ready");
        onReady?.();
      } catch {
        if (!disposed) setStatus("failed");
      }

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      const clock = new THREE.Clock();

      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!visible) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        mixerRef.current?.update(delta);
        const model = modelRef.current;
        if (model) {
          if (!drag.current.active && !reduced) rotation.current.y += 0.0035;
          model.rotation.set(rotation.current.x, rotation.current.y, 0);
        }
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);
    })().catch(() => {
      if (!disposed) setStatus("failed");
    });

    return () => {
      disposed = true;
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      cleanup.forEach((fn) => fn());
      mixerRef.current?.stopAllAction();
      disposables.forEach((item) => item.dispose?.());
      const scene = sceneRef.current;
      if (scene && modelRef.current) scene.remove(modelRef.current);
      rendererRef.current?.dispose();
      if (rendererRef.current?.domElement?.parentNode === mount) {
        mount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      modelRef.current = null;
      mixerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Colourway swap: recolour the live texture instead of reloading the model.
  useEffect(() => {
    colourwayRef.current = colourway;
    const model = modelRef.current;
    if (!model) return;
    void (async () => {
      const THREE = await import("three");
      const target = colourwayFor(colourway);
      model.traverse((child: any) => {
        if (!child.isMesh || child.material?.name !== "Material_81") return;
        const material = child.material;
        const source = material.userData.originalMap ?? material.map;
        if (!source?.image) return;
        material.userData.originalMap = source;
        const canvas = recolourTexture(source.image, target);
        if (!canvas) return;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = source.colorSpace;
        texture.flipY = source.flipY;
        texture.wrapS = source.wrapS;
        texture.wrapT = source.wrapT;
        material.map?.dispose?.();
        material.map = texture;
        material.needsUpdate = true;
      });
    })();
  }, [colourway, status]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={host} className="h-full w-full" aria-label="3D cat" role="img" />

      {(status === "loading" || status === "failed" || status === "unsupported") && (
        <div className="absolute inset-0 grid place-items-center">
          {posterUrl && status !== "loading" ? (
            <img src={posterUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-2xl bg-[#1c1c1f]" aria-hidden="true" />
          )}
          {status === "failed" && (
            <button
              type="button"
              onClick={retry}
              className="absolute bottom-2 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-[#2a2a2e] bg-[#141416] px-4 text-[13px] font-semibold text-[#f2efe6]"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </button>
          )}
          {status === "unsupported" && (
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-[#9a9aa0]">
              3D isn&apos;t available on this device
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CatModel3D;
