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
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Loader2, TriangleAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAT_MODEL_URL, colourwayFor, type CatColourwayId } from "@/features/cat-studio/model";
import { clothingTexture, PANT_COLOUR, outfitStyleFor, type ClothKind } from "./clothes";
import { dropArms } from "./pose";
import { petPreviewCanvas } from "./pet";
import { tintTexture } from "./tint";
import {
  AVATAR_MODELS,
  backgroundFor,
  GLASSES_RE,
  HAIR_MATERIAL_RE,
  SKIN_MATERIAL_RE,
  morphGroup,
  morphLabel,
  type Avatar3DConfig,
  type AvatarCapabilities,
  type AvatarMorphTarget,
} from "./config";

type Status = "loading" | "ready" | "missing" | "failed" | "unsupported";

export type AvatarModelHandle = {
  /** Square transparent PNG of the pose on screen: the person, and their pet. */
  capturePng: (size?: number) => Promise<Blob | null>;
};

const LOAD_TIMEOUT_MS = 15_000;

/**
 * The pet model is authored lying along its own X axis with its head turned, so
 * there is no rotation that makes it stare down the lens. A half turn shows its
 * face instead of its back, which is what reads as "the cat" at preview size.
 */
const PET_FACING = Math.PI;

/**
 * Whether this browser can draw WebGL at all. Kept as its own function because
 * the effect asks twice (mount, and again after a retry) and the answer must be
 * the same both times.
 */
function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * The model's bounds, measured now.
 *
 * A SkinnedMesh caches its own bounding box the first time it is measured, in
 * whatever pose that was. Measure the T-pose once and every later box reports
 * the arms-out width even after they are dropped — which framed a smaller
 * person and parked the pet out to the side. Clearing the cache forces a fresh
 * box from the current pose.
 */
function measureBounds(root: any, THREE: any) {
  // Bounds are read after the model has been moved, and a child's world matrix
  // is only rebuilt on render, so refresh the tree first — without this the box
  // describes where the model used to be.
  root.updateMatrixWorld(true);
  root.traverse((child: any) => {
    if (!child.isSkinnedMesh) return;
    child.boundingBox = null;
    child.boundingSphere = null;
  });
  return new THREE.Box3().setFromObject(root);
}

/**
 * Applies the saved look to a loaded model.
 *
 * Colour goes through the texture (see `tint.ts`) rather than `material.color`,
 * which was the "layer" look: multiplying a detailed texture by a flat colour
 * flattens it. Each material keeps its original map in `userData` so the next
 * swatch paints from the artist's texture, not from the last colour.
 */
function applyAvatarConfig(
  THREE: any,
  meshes: any[],
  materials: { skin: any[]; hair: any[]; top: any[]; bottom: any[] },
  config: Avatar3DConfig,
  track: (item: { dispose?: () => void }) => void,
) {
  const paint = (group: any[], hex: string, fabric?: ClothKind | null) => {
    for (const material of group) {
      const source =
        (fabric ? clothingTexture(fabric) : null) ??
        material.userData.avatarSourceMap ??
        material.map;
      if (!source?.image) continue;
      material.userData.avatarSourceMap = source;
      const canvas = tintTexture(source.image, hex);
      if (!canvas) continue;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = source.colorSpace;
      texture.flipY = source.flipY;
      texture.wrapS = source.wrapS;
      texture.wrapT = source.wrapT;
      if (material.userData.avatarTint) track(material.userData.avatarTint);
      material.userData.avatarTint = texture;
      material.map = texture;
      // The tone now lives in the pixels, so the flat multiplier stays neutral.
      material.color?.set?.("#ffffff");
      material.needsUpdate = true;
    }
  };
  paint(materials.skin, config.skin);
  paint(materials.hair, config.hair);
  // The top is the chosen fabric in the chosen colour; the jeans are one pair,
  // so they keep their own indigo instead of following the top's palette.
  paint(materials.top, config.outfit, outfitStyleFor(config.outfitStyle));
  paint(materials.bottom, PANT_COLOUR, "pant");

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

/**
 * Recolours the cat's body texture, exactly as the Flexes viewer does, so the
 * pet in this scene is the same animal as the pet on the profile. Only
 * `Material_81` is touched: the eyes and teeth share the atlas.
 */
function recolourPet(
  pet: any,
  THREE: any,
  colourway: ReturnType<typeof colourwayFor>,
  track: (item: { dispose?: () => void }) => void,
) {
  pet.traverse((child: any) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    const material = child.material;
    if (!material) return;
    const source = material.userData.petSourceMap ?? material.map;
    if (!source?.image) return;
    if (material.name !== "Material_81") return;
    material.userData.petSourceMap = source;
    // Preview lift: the saved colourway, lit so it can be seen (see `pet.ts`).
    const canvas = petPreviewCanvas(source.image, colourway.id);
    if (!canvas) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = source.colorSpace;
    texture.flipY = source.flipY;
    texture.wrapS = source.wrapS;
    texture.wrapT = source.wrapT;
    // The previous colourway's texture is replaced, not stacked: switching
    // colours ten times must not leave ten textures on the GPU.
    if (material.userData.petMap) track(material.userData.petMap);
    material.userData.petMap = texture;
    material.map = texture;
    material.needsUpdate = true;
  });
}

export function AvatarModel3D({
  config,
  className,
  petColourway,
  onCapabilities,
  handleRef,
}: {
  config: Avatar3DConfig;
  className?: string;
  /** The pet stands beside the person; omit it for no pet. */
  petColourway?: CatColourwayId | string | null;
  /** What this model can be changed with. Sent once the file is loaded. */
  onCapabilities?: (capabilities: AvatarCapabilities) => void;
  handleRef?: Ref<AvatarModelHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const petRef = useRef<any>(null);
  const threeRef = useRef<any>(null);
  const tintDisposables = useRef<{ dispose?: () => void }[]>([]);
  const meshesRef = useRef<any[]>([]);
  const materialsRef = useRef<{ skin: any[]; hair: any[]; top: any[]; bottom: any[] }>({
    skin: [],
    hair: [],
    top: [],
    bottom: [],
  });
  const background = backgroundFor(config.background);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const configRef = useRef(config);
  const petColourwayRef = useRef(petColourway);

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

  useEffect(() => {
    petColourwayRef.current = petColourway;
    const pet = petRef.current;
    if (!pet || !petColourway) return;
    // A colourway tap recolours the live pet instead of reloading 3MB of cat.
    void (async () => {
      const THREE = await import("three");
      recolourPet(pet, THREE, colourwayFor(petColourway), (item) => item.dispose?.());
    })();
  }, [petColourway]);

  useEffect(() => {
    if (!webglAvailable()) setStatus("unsupported");
  }, []);

  // Textures painted by a swatch are owned here, not by the render loop, so
  // leaving the screen disposes every one of them.
  useEffect(() => {
    const owned = tintDisposables.current;
    return () => {
      owned.forEach((item) => item.dispose?.());
      tintDisposables.current = [];
    };
  }, []);

  useEffect(() => {
    configRef.current = config;
    const THREE = threeRef.current;
    if (!THREE) return;
    applyAvatarConfig(THREE, meshesRef.current, materialsRef.current, config, (item) =>
      tintDisposables.current.push(item),
    );
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
    // Hoisted to the effect scope on purpose: the cleanup below stops this mixer
    // while the loader is still awaiting, and a `let` inside the async body is
    // not visible there — that was the "animation is not defined" crash on
    // leaving the tab.
    let animation: any = null;
    let petAnimation: any = null;
    // One pivot holds the whole cast, so the person and the pet turn together.
    // Rotating each of them about its own centre would slide the pet sideways.
    let pivot: any = null;
    let frameModel: (() => void) | null = null;
    setStatus("loading");

    const timeout = window.setTimeout(() => {
      if (!disposed && meshesRef.current.length === 0) setStatus("missing");
    }, LOAD_TIMEOUT_MS);

    void (async () => {
      const THREE = await import("three");
      threeRef.current = THREE;
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      sceneRef.current = scene;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 1.15, 5.4);
      camera.lookAt(0, 1.0, 0);
      cameraRef.current = camera;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rendererRef.current = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearAlpha(0);
      // Film-style tone mapping: without it the key light clips the forehead to
      // a white patch and the shadows crush, which is most of "looks flat".
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight("#ffffff", "#20242c", 1.9));
      const key = new THREE.DirectionalLight("#fff7e6", 2.6);
      key.position.set(2.2, 4, 3.4);
      scene.add(key);
      const rim = new THREE.DirectionalLight("#c8ff3d", 0.6);
      rim.position.set(-3, 1.4, -2.4);
      scene.add(rim);
      // Low fill from the near side: it is what lifts the cat out of the floor
      // into readable fur, and keeps the underside of the jaw from going black.
      const fill = new THREE.DirectionalLight("#e8f0ff", 0.75);
      fill.position.set(-1.6, 0.9, 3.2);
      scene.add(fill);

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        frameModel?.();
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
      try {
        const gltf = await new GLTFLoader().loadAsync(
          AVATAR_MODELS[configRef.current.gender] ?? AVATAR_MODELS.male,
        );
        if (disposed) return;
        model = gltf.scene;
        pivot = new THREE.Group();
        scene.add(pivot);
        pivot.add(model);

        // Some exports are authored Z-up, so the model arrives lying on its back
        // (deeper than it is tall). Stand it up before anything measures it.
        model.updateMatrixWorld(true);
        const lying = measureBounds(model, THREE);
        const lyingSize = new THREE.Vector3();
        lying.getSize(lyingSize);
        if (lyingSize.y < lyingSize.z) model.rotation.x = Math.PI / 2;

        dropArms(model, THREE);

        // Frame whatever arrived: a metre-tall character and a 100-unit export
        // both end up the same height on screen.
        const box = measureBounds(model, THREE);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 2.0 / Math.max(0.0001, size.y);
        model.scale.setScalar(scale);
        const centred = measureBounds(model, THREE);
        const centre = new THREE.Vector3();
        centred.getCenter(centre);
        model.position.sub(centre);
        model.position.y += 0.02;

        // Measured again *after* the model is put back on the floor. The box
        // above still carries the export's own offset, and framing from it
        // aimed the camera at the model's head: the person was drawn from the
        // middle of the stage down, cropped at the thighs.
        const placed = measureBounds(model, THREE);

        // Frame the whole body, head to feet. A fixed camera only fits one
        // aspect ratio: on a phone the feet were cropped and the figure sat in
        // the middle of the box. This solves the distance from the model's own
        // height and the viewport's aspect, and runs again on resize.
        const fitHeight = placed.max.y - placed.min.y;
        // A little wider than the body: the pet stands to the right of the feet,
        // and reserving that space up front means the view does not jump when
        // the (slower) cat model finishes loading.
        const fitWidth = Math.max(placed.max.x - placed.min.x, placed.max.z - placed.min.z) * 1.14;
        const lookX = 0.06;
        const centerY = (placed.max.y + placed.min.y) / 2;
        frameModel = () => {
          const vFov = (camera.fov * Math.PI) / 180;
          const forHeight = fitHeight / 2 / Math.tan(vFov / 2);
          const forWidth = fitWidth / 2 / (Math.tan(vFov / 2) * Math.max(0.0001, camera.aspect));
          const distance = Math.max(forHeight, forWidth) * 1.12;
          camera.position.set(lookX, centerY, distance);
          camera.lookAt(lookX, centerY, 0);
          camera.updateProjectionMatrix();
        };
        frameModel();

        // A soft contact shadow under the feet. There is no shadow map in this
        // scene — a 4MB model on a phone does not need one — so it is a radial
        // gradient on a plane, which is the cheap way to stop the figure from
        // floating above the floor line.
        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = 128;
        shadowCanvas.height = 128;
        const shadowCtx = shadowCanvas.getContext("2d");
        if (shadowCtx) {
          const gradient = shadowCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
          gradient.addColorStop(0, "rgba(0,0,0,0.5)");
          gradient.addColorStop(0.5, "rgba(0,0,0,0.24)");
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          shadowCtx.fillStyle = gradient;
          shadowCtx.fillRect(0, 0, 128, 128);
          const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
          const shadowMaterial = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
          });
          const shadowGeometry = new THREE.PlaneGeometry(
            Math.max(0.4, placed.max.x - placed.min.x) * 2.1,
            Math.max(0.4, placed.max.z - placed.min.z) * 3.2,
          );
          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.set(0, placed.min.y + 0.002, 0.02);
          scene.add(shadow);
          disposables.push(shadowGeometry, shadowMaterial, shadowTexture);
        }

        const meshes: any[] = [];
        const skin: any[] = [];
        const hair: any[] = [];
        const top: any[] = [];
        const bottom: any[] = [];
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
              : /^outfit_top/i.test(materialName)
                ? top
                : /^outfit_bottom/i.test(materialName)
                  ? bottom
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
        materialsRef.current = { skin, hair, top, bottom };
        onCapabilities?.({
          skin: skin.length > 0,
          hair: hair.length > 0,
          outfit: top.length > 0 || bottom.length > 0,
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

        applyAvatarConfig(THREE, meshes, materialsRef.current, configRef.current, (item) =>
          tintDisposables.current.push(item),
        );
        window.clearTimeout(timeout);
        setStatus("ready");

        // The pet shares this scene, so it shares the light, the floor and the
        // camera. It is loaded after the person and never blocks them: a missing
        // or slow cat just means the person shows alone for a moment.
        if (petColourwayRef.current) {
          void (async () => {
            try {
              const petGltf = await new GLTFLoader().loadAsync(CAT_MODEL_URL);
              if (disposed) return;
              const pet = petGltf.scene;
              const petBox = measureBounds(pet, THREE);
              const petSize = new THREE.Vector3();
              petBox.getSize(petSize);
              // This cat is broader than it is tall (43 x 21 in its own units), so
              // scaling it to a height made it wider than the person and it read
              // as a grey boulder. Scale to whichever side runs out first: a
              // companion at about a quarter of the person's height that never
              // outgrows their stance.
              const targetHeight = fitHeight * 0.26;
              const maxWidth = fitHeight * 0.4;
              pet.scale.setScalar(
                Math.min(
                  targetHeight / Math.max(0.0001, petSize.y),
                  maxWidth / Math.max(0.0001, Math.max(petSize.x, petSize.z)),
                ),
              );
              const scaled = measureBounds(pet, THREE);
              const petCentre = new THREE.Vector3();
              scaled.getCenter(petCentre);
              const personNow = measureBounds(model, THREE);
              // Straight in front of its person, centred, facing the camera.
              // This model is laid out along its own X axis, so a quarter turn
              // stands it square to the viewer instead of showing a profile.
              pet.rotation.y += PET_FACING;
              pet.position.x += 0 - petCentre.x;
              pet.position.z += 0.25 - petCentre.z;
              pet.position.y += personNow.min.y - scaled.min.y;

              pet.traverse((child: any) => {
                if (child.isMesh) disposables.push(child.material);
              });
              recolourPet(pet, THREE, colourwayFor(petColourwayRef.current), (item) =>
                disposables.push(item),
              );

              if (petGltf.animations?.length) {
                const petMixer = new THREE.AnimationMixer(pet);
                petMixer.clipAction(petGltf.animations[0]).play();
                petAnimation = petMixer;
                if (visible) petMixer.update(0);
              }
              petRef.current = pet;
              pivot?.add(pet);
            } catch {
              // No pet model: the person is already on screen, so nothing to say.
            }
          })();
        }
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
        petAnimation?.update(delta);
        if (pivot) {
          if (!drag.active) rotation.y += 0.0015;
          pivot.rotation.set(rotation.x, rotation.y, 0);
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
      petAnimation?.stopAllAction?.();
      disposables.forEach((item) => item.dispose?.());
      meshesRef.current = [];
      materialsRef.current = { skin: [], hair: [], top: [], bottom: [] };
      petRef.current = null;
      pivot = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      renderer?.dispose?.();
      if (renderer?.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, config.gender]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {background.url && (
        <img
          src={background.url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div ref={host} className="relative h-full w-full" />

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
