/**
 * The avatar viewer.
 *
 * Same budget rules as the cat model: three.js is imported dynamically so the
 * renderer only downloads when this screen mounts, pixel ratio is capped at 2,
 * the loop stops when the element is off screen or the tab is hidden, and every
 * geometry, material and texture is disposed on unmount.
 *
 * Two things are specific to this model.
 *
 * **The arms.** It ships in a T-pose — the hands sit at shoulder height, 0.69m
 * out to each side. Nobody makes an avatar to look like a scarecrow, so the
 * upper arms are rotated down to the sides on load. The angle is not hardcoded:
 * the current arm direction is measured, the rotation that points it at the
 * floor is solved, and that rotation is converted into the bone's parent space.
 * A re-export in a different pose therefore still ends up with arms down.
 *
 * **The controls.** The file carries no morph targets; what it does carry is
 * named materials (`AvatarBody`, `AvatarHead`, `haircut`, `outfit_top`…) and a
 * real `glasses` mesh. Those become the controls, and they are reported upwards
 * as capabilities so the screen never shows a slider that does nothing.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { dropArms } from "./pose";
import {
  AVATAR_MODEL_URL,
  GLASSES_RE,
  HAIR_MATERIAL_RE,
  OUTFIT_MATERIAL_RE,
  SKIN_MATERIAL_RE,
  morphGroup,
  morphLabel,
  type Avatar3DConfig,
  type AvatarCapabilities,
  type AvatarMorphTarget,
} from "./config";

type Status = "loading" | "ready" | "missing" | "failed" | "unsupported";

const LOAD_TIMEOUT_MS = 15_000;

/** Applies the saved look to a loaded model. */
function applyAvatarConfig(
  meshes: any[],
  materials: { skin: any[]; hair: any[]; outfit: any[] },
  config: Avatar3DConfig,
) {
  for (const material of materials.skin) material.color?.set?.(config.skin);
  for (const material of materials.hair) material.color?.set?.(config.hair);
  for (const material of materials.outfit) material.color?.set?.(config.outfit);

  for (const mesh of meshes) {
    if (GLASSES_RE.test(mesh.name ?? "") || GLASSES_RE.test(mesh.material?.name ?? "")) {
      mesh.visible = config.glasses;
    }
    const dict = mesh.morphTargetDictionary as Record<string, number> | undefined;
    const influences = mesh.morphTargetInfluences as number[] | undefined;
    if (!dict || !influences) continue;
    for (const [name, index] of Object.entries(dict)) {
      const value = config.morphs[`${mesh.name}|${name}`];
      if (typeof value === "number") influences[index] = value;
    }
  }
}

export function AvatarModel3D({
  config,
  className,
  onCapabilities,
}: {
  config: Avatar3DConfig;
  className?: string;
  /** What this model can be changed with. Sent once the file is loaded. */
  onCapabilities?: (capabilities: AvatarCapabilities) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const meshesRef = useRef<any[]>([]);
  const materialsRef = useRef<{ skin: any[]; hair: any[]; outfit: any[] }>({
    skin: [],
    hair: [],
    outfit: [],
  });
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const configRef = useRef(config);

  useEffect(() => {
    if (!webglAvailable()) setStatus("unsupported");
  }, []);

  useEffect(() => {
    configRef.current = config;
    applyAvatarConfig(meshesRef.current, materialsRef.current, config);
  }, [config]);

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
    let renderer: any = null;
    setStatus("loading");

    const timeout = window.setTimeout(() => {
      if (!disposed && meshesRef.current.length === 0) setStatus("missing");
    }, LOAD_TIMEOUT_MS);

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 1.15, 5.4);
      camera.lookAt(0, 1.0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearAlpha(0);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight("#ffffff", "#20242c", 1.7));
      const key = new THREE.DirectionalLight("#fff7e6", 2.0);
      key.position.set(2.2, 4, 3.4);
      scene.add(key);
      const rim = new THREE.DirectionalLight("#c8ff3d", 0.5);
      rim.position.set(-3, 1.4, -2.4);
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

      const rotation = { x: 0.02, y: 0 };
      const drag = { x: 0, y: 0, active: false };
      const onDown = (event: PointerEvent) => {
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.active = true;
        renderer.domElement.setPointerCapture(event.pointerId);
      };
      const onMove = (event: PointerEvent) => {
        if (!drag.active) return;
        rotation.y += (event.clientX - drag.x) * 0.01;
        rotation.x = Math.max(-0.4, Math.min(0.5, rotation.x + (event.clientY - drag.y) * 0.004));
        drag.x = event.clientX;
        drag.y = event.clientY;
      };
      const onUp = () => {
        drag.active = false;
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);
      cleanup.push(() => {
        renderer?.domElement?.removeEventListener("pointerdown", onDown);
        renderer?.domElement?.removeEventListener("pointermove", onMove);
        renderer?.domElement?.removeEventListener("pointerup", onUp);
        renderer?.domElement?.removeEventListener("pointercancel", onUp);
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

      let model: any = null;
      let animation: any = null;
      try {
        const gltf = await new GLTFLoader().loadAsync(AVATAR_MODEL_URL);
        if (disposed) return;
        model = gltf.scene;
        scene.add(model);

        dropArms(model, THREE);

        // Frame whatever arrived: a metre-tall character and a 100-unit export
        // both end up the same height on screen.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 2.0 / Math.max(0.0001, size.y);
        model.scale.setScalar(scale);
        const centred = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        centred.getCenter(centre);
        model.position.sub(centre);
        model.position.y += 0.02;

        const meshes: any[] = [];
        const skin: any[] = [];
        const hair: any[] = [];
        const outfit: any[] = [];
        const targets: AvatarMorphTarget[] = [];

        model.traverse((child: any) => {
          if (!child.isMesh) return;
          child.frustumCulled = false;
          meshes.push(child);

          const materialName = child.material?.name ?? "";
          const group = SKIN_MATERIAL_RE.test(materialName)
            ? skin
            : HAIR_MATERIAL_RE.test(materialName)
              ? hair
              : OUTFIT_MATERIAL_RE.test(materialName)
                ? outfit
                : null;

          // Clone before tinting: one material can be shared by the face and by
          // an accessory, and a face colour must not leak onto an eye card.
          if (group && child.material) {
            const material = child.material.clone();
            disposables.push(material);
            child.material = material;
            group.push(material);
          }

          const dict = child.morphTargetDictionary as Record<string, number> | undefined;
          if (dict) {
            for (const name of Object.keys(dict)) {
              const groupName = morphGroup(name);
              targets.push({
                key: `${child.name}|${name}`,
                mesh: child.name,
                name,
                group: groupName,
                label: morphLabel({ group: groupName, name }),
              });
            }
          }
        });

        meshesRef.current = meshes;
        materialsRef.current = { skin, hair, outfit };
        onCapabilities?.({
          skin: skin.length > 0,
          hair: hair.length > 0,
          outfit: outfit.length > 0,
          glasses: meshes.some(
            (mesh) =>
              GLASSES_RE.test(mesh.name ?? "") || GLASSES_RE.test(mesh.material?.name ?? ""),
          ),
          morphs: targets,
        });

        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          animation = mixer;
        }

        applyAvatarConfig(meshes, materialsRef.current, configRef.current);
        window.clearTimeout(timeout);
        setStatus("ready");
      } catch {
        window.clearTimeout(timeout);
        if (!disposed) setStatus(model ? "failed" : "missing");
      }

      const clock = new THREE.Clock();
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!visible) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        animation?.update(delta);
        if (model) {
          if (!drag.active) rotation.y += 0.0015;
          model.rotation.set(rotation.x, rotation.y, 0);
        }
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);
    })().catch(() => {
      if (!disposed) setStatus("failed");
    });

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      cleanup.forEach((fn) => fn());
      animation?.stopAllAction?.();
      disposables.forEach((item) => item.dispose?.());
      meshesRef.current = [];
      materialsRef.current = { skin: [], hair: [], outfit: [] };
      renderer?.dispose?.();
      if (renderer?.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={host} className="h-full w-full" />

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {(status === "missing" || status === "failed") && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="max-w-[280px] text-center">
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[13px] font-semibold text-foreground">
              {status === "missing"
                ? "The avatar model isn't in the app yet"
                : "Couldn't load the avatar model"}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              It belongs at{" "}
              <code className="rounded bg-white/[0.06] px-1 font-mono text-[10.5px]">
                public/models/avatar.glb
              </code>
              .
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {status === "unsupported" && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div className="max-w-[240px]">
            <TriangleAlert className="mx-auto h-6 w-6 text-[#e8c15a]" />
            <p className="mt-2 text-[12px] text-muted-foreground">
              This device can&apos;t draw 3D, so the avatar can&apos;t be previewed here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
