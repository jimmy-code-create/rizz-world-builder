/**
 * Cat Studio — the 3D cat.
 *
 * This is a real mesh, not a tilted picture: the cat is built from three.js
 * primitives (spheres, cones, tubes) so it can turn under your finger and its
 * shape sliders move actual geometry. There is no model file to download and no
 * react-three-fiber layer — one renderer, one scene, one geometry rebuild when
 * the config changes.
 *
 * Cost control, because this runs on phones:
 *  - pixel ratio capped at 2, antialias on, no shadows, no post-processing
 *  - the animation loop stops when the canvas scrolls away or the tab hides
 *  - everything is disposed on unmount, so leaving the builder frees the GPU
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { sanitizeCatConfig, shapeTransforms, type CatConfig } from "./config";

export type CatModelHandle = {
  /** Square PNG of the current pose, for the avatar upload. */
  capturePng: (size?: number) => Promise<Blob>;
};

type CatParts = {
  root: THREE.Group;
  head: THREE.Group;
  ears: THREE.Group[];
  eyes: THREE.Group;
  tail: THREE.Group;
  hat: THREE.Group;
  eyewear: THREE.Group;
  neck: THREE.Group;
  face: THREE.Group;
  back: THREE.Group;
  backdrop: THREE.Group;
  bodyScale: { x: number; y: number };
};

/** Darker/lighter variant of a fur colour, for stripes and shadows. */
function shade(color: string, amount: number) {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.06, ...extra });
}

function sphere(radius: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function cone(radius: number, height: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.ConeGeometry(radius, height, 20), mat);
}

function box(w: number, h: number, d: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function torus(radius: number, tube: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 32), mat);
}

/** Hat, glasses, collar, cheek marks and cape, drawn from primitives. */
function dressCat(parts: CatParts, config: CatConfig) {
  const accent = material(config.colors.accent);
  const gold = material("#e8c15a", { metalness: 0.55, roughness: 0.3 });
  const ink = material("#111114", { roughness: 0.4 });
  const soft = material("#f4f1e7", { roughness: 0.8 });

  const hatId = config.slots.hat;
  if (hatId === "hat_crown" || hatId === "hat_star_crown") {
    const ring = torus(0.34, 0.06, gold);
    ring.rotation.x = Math.PI / 2;
    parts.hat.add(ring);
    for (let i = 0; i < 3; i += 1) {
      const spike = cone(0.09, 0.26, gold);
      spike.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.3, 0.12, Math.sin((i / 3) * Math.PI * 2) * 0.3);
      parts.hat.add(spike);
    }
    if (hatId === "hat_star_crown") {
      for (let i = 0; i < 4; i += 1) {
        const gem = sphere(0.05, accent, Math.cos((i / 4) * Math.PI * 2) * 0.3, 0, Math.sin((i / 4) * Math.PI * 2) * 0.3);
        parts.hat.add(gem);
      }
    }
  } else if (hatId === "hat_top_hat") {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.42, 26), ink);
    crown.position.y = 0.2;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 30), ink);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.08, 26), accent);
    band.position.y = 0.02;
    parts.hat.add(crown, brim, band);
  } else if (hatId === "hat_beret") {
    const cap = sphere(0.34, material("#b45a5a"));
    cap.scale.set(1.15, 0.5, 1.15);
    const knob = sphere(0.06, material("#8f2743"), 0, 0.18, 0);
    parts.hat.add(cap, knob);
  } else if (hatId === "hat_beanie") {
    const cap = sphere(0.34, material("#3a3a44"));
    cap.scale.set(1.05, 0.78, 1.05);
    const rim = torus(0.32, 0.07, material("#4a4a56"));
    rim.rotation.x = Math.PI / 2;
    parts.hat.add(cap, rim, sphere(0.075, accent, 0, 0.3, 0));
  } else if (hatId === "hat_halo") {
    const halo = torus(0.26, 0.035, accent);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.42;
    parts.hat.add(halo);
  }

  const eyewearId = config.slots.eyewear;
  if (eyewearId === "eyewear_sunglasses" || eyewearId === "eyewear_visor") {
    const visor = box(0.98, 0.16, 0.1, ink);
    parts.eyewear.add(visor);
    if (eyewearId === "eyewear_visor") {
      const stripe = box(1, 0.05, 0.11, accent);
      stripe.position.y = 0.06;
      parts.eyewear.add(stripe);
    }
  } else if (eyewearId === "eyewear_monocle") {
    const ring = torus(0.17, 0.022, gold);
    ring.position.x = 0.26;
    parts.eyewear.add(ring);
  } else if (eyewearId === "eyewear_heart") {
    for (const side of [-1, 1]) {
      const lens = sphere(0.15, material("#ff6f91"));
      lens.position.set(side * 0.27, 0, 0);
      lens.scale.set(1, 1, 0.5);
      parts.eyewear.add(lens);
    }
  } else if (eyewearId === "eyewear_diamond") {
    for (const side of [-1, 1]) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), material("#9be8ff", { metalness: 0.4 }));
      gem.position.set(side * 0.27, 0, 0);
      parts.eyewear.add(gem);
    }
  }

  const neckId = config.slots.neck;
  if (neckId === "neck_gold_chain" || neckId === "neck_diamond_collar") {
    const chain = torus(0.42, 0.035, gold);
    chain.rotation.x = Math.PI / 2 + 0.28;
    parts.neck.add(chain);
    if (neckId === "neck_diamond_collar") {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), material("#9be8ff", { metalness: 0.5 }));
      gem.position.set(0, -0.06, 0.42);
      parts.neck.add(gem);
    }
  } else if (neckId === "neck_pearls") {
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const bead = sphere(0.045, soft, (t - 0.5) * 0.8, -0.05 + Math.sin(Math.PI * t) * 0.12, 0.34);
      parts.neck.add(bead);
    }
  } else if (neckId === "neck_bow_tie") {
    for (const side of [-1, 1]) {
      const wing = cone(0.11, 0.22, material("#b43a5b"));
      wing.rotation.z = side * Math.PI * 0.5;
      wing.position.set(side * 0.14, -0.1, 0.4);
      parts.neck.add(wing);
    }
    parts.neck.add(sphere(0.06, material("#8f2743"), 0, -0.1, 0.42));
  } else if (neckId === "neck_bandana") {
    const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.4, 3), material("#b45a5a"));
    cloth.rotation.x = Math.PI;
    cloth.position.set(0, -0.2, 0.16);
    parts.neck.add(cloth);
  }

  const faceId = config.slots.face;
  if (faceId === "face_blush" || faceId === "face_freckles") {
    for (const side of [-1, 1]) {
      const cheek = sphere(0.1, material("#ff8fa8", { transparent: true, opacity: 0.6 }), side * 0.4, -0.1, 0.72);
      cheek.scale.set(1.4, 0.8, 0.3);
      parts.face.add(cheek);
    }
  } else if (faceId === "face_whisker_gems") {
    for (let i = 0; i < 4; i += 1) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), material("#9be8ff", { metalness: 0.4 }));
      gem.position.set((i % 2 === 0 ? -1 : 1) * (0.52 + (i > 1 ? 0.06 : 0)), -0.02 + (i > 1 ? -0.1 : 0), 0.7);
      parts.face.add(gem);
    }
  } else if (faceId === "face_star_sticker") {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), accent);
    star.position.set(0.42, 0.16, 0.72);
    parts.face.add(star);
  } else if (faceId === "face_tear") {
    const tear = sphere(0.05, material("#7fc8ff", { metalness: 0.2 }), 0.3, -0.18, 0.82);
    tear.scale.set(0.7, 1.5, 0.7);
    parts.face.add(tear);
  }

  const backId = config.slots.back;
  if (backId) {
    if (backId === "back_velvet_cape" || backId === "back_aurora_cloak") {
      const cape = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 1.7, 24, 1, true),
        material(backId === "back_velvet_cape" ? "#4a1024" : "#141a2c", {
          side: THREE.DoubleSide,
          roughness: 0.85,
        }),
      );
      cape.position.set(0, -0.18, -0.52);
      cape.rotation.x = Math.PI;
      parts.back.add(cape);
      if (backId === "back_aurora_cloak") {
        const trim = torus(0.5, 0.03, accent);
        trim.rotation.x = Math.PI / 2;
        trim.position.set(0, 0.32, -0.16);
        parts.back.add(trim);
      }
    } else if (backId === "back_wings") {
      for (const side of [-1, 1]) {
        const wing = sphere(0.5, material("#0d0d10"), side * 0.8, -0.05, -0.62);
        wing.scale.set(1, 0.55, 0.16);
        wing.rotation.z = side * 0.5;
        parts.back.add(wing);
      }
    } else if (backId === "back_scarf") {
      const scarf = torus(0.44, 0.08, accent);
      scarf.rotation.x = Math.PI / 2;
      parts.back.add(scarf);
    } else if (backId === "back_backpack") {
      const pack = box(0.5, 0.55, 0.3, material("#3a3a44"));
      pack.position.set(0, 0.05, -0.55);
      parts.back.add(pack);
    }
  }

  const backdropId = config.slots.backdrop;
  if (backdropId) {
    const colours: Record<string, string> = {
      backdrop_solid: "#141418",
      backdrop_marble: "#1b1b20",
      backdrop_velvet: "#2a0d16",
      backdrop_city: "#0b1020",
      backdrop_luxe_night: "#111014",
    };
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      material(colours[backdropId] ?? "#141418", { roughness: 1 }),
    );
    panel.position.z = -3;
    parts.backdrop.add(panel);
  }
}

function buildCat(config: CatConfig): CatParts {
  const t = shapeTransforms(config.shape);
  const fur = material(config.colors.fur);
  const furDark = material(shade(config.colors.fur, -0.09));
  const accent = material(config.colors.accent);
  const eyeWhite = material(config.colors.eye, { roughness: 0.25 });
  const pupil = material("#0b0b0e", { roughness: 0.2 });
  const cream = material("#f4f1e7", { roughness: 0.8 });

  const root = new THREE.Group();

  const backdrop = new THREE.Group();
  const back = new THREE.Group();
  const tail = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 0.72;

  // Tail: a tube along a curve, scaled by the length slider.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.15, -0.45, -0.55),
    new THREE.Vector3(0.75 * t.tail.scale, -0.35, -0.95 * t.tail.scale),
    new THREE.Vector3(0.95 * t.tail.scale, 0.25, -0.9 * t.tail.scale),
    new THREE.Vector3(0.6 * t.tail.scale, 0.62, -0.68 * t.tail.scale),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.11, 10, false), fur));
  const tailTip = sphere(0.12, accent, 0.6 * t.tail.scale, 0.62, -0.68 * t.tail.scale);

  // Body.
  const torso = sphere(1, fur);
  torso.scale.set(1.05 * t.body.scaleX, 0.98 * t.body.scaleY, 1.02);
  torso.position.y = -0.35;
  body.add(torso);
  if (config.pattern === "tuxedo") {
    const belly = sphere(0.78, cream, 0, -0.38, 0.42);
    belly.scale.set(0.8, 0.9, 0.5);
    body.add(belly);
  } else if (config.pattern === "calico") {
    const patch = sphere(0.3, material(config.colors.accent, { transparent: true, opacity: 0.35 }), 0.56, -0.08, 0.6);
    patch.scale.set(1, 1.2, 0.4);
    body.add(patch);
  } else if (config.pattern === "tabby") {
    for (let i = 0; i < 3; i += 1) {
      const stripe = torus(0.55 - i * 0.1, 0.03, furDark);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.2 - i * 0.22;
      body.add(stripe);
    }
  }

  for (const side of [-1, 1]) {
    const paw = sphere(0.26, fur, side * 0.44, -1.05, 0.5);
    paw.scale.set(1, 0.8, 1.2);
    body.add(paw);
  }

  // Head.
  const skull = sphere(0.92, fur);
  skull.scale.set(t.head.scaleX, 1, 0.95);
  head.add(skull);

  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.5, 0.78, 0);
    ear.rotation.z = side * -0.16;
    const outer = cone(0.3, 0.66, fur);
    outer.scale.setScalar(t.ears.scale);
    ear.add(outer);
    const inner = cone(0.13, 0.36, accent);
    inner.scale.setScalar(t.ears.scale);
    inner.position.set(0, 0.05, 0.05);
    ear.add(inner);
    ear.rotation.z += THREE.MathUtils.degToRad(t.ears.tilt) * side * -1;
    head.add(ear);
    ears.push(ear);
  }

  // Eyes.
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.06, 0.72);
  for (const side of [-1, 1]) {
    const gapX = (t.eyes.gap / 52) * 0.3;
    const white = sphere(0.27 * t.eyes.scale, eyeWhite, side * gapX, 0, 0);
    white.scale.set(0.92, 1, 0.55);
    const dot = sphere(0.12 * t.eyes.scale, pupil, side * gapX, 0, 0.16);
    eyes.add(white, dot);
  }
  head.add(eyes);

  // Muzzle, nose, whiskers.
  const muzzle = sphere(0.3, cream, 0, -0.26, 0.7);
  muzzle.scale.set(1.2, 0.62, 0.45);
  head.add(muzzle);
  const nose = cone(0.07, 0.1, accent);
  nose.rotation.x = Math.PI;
  nose.position.set(0, -0.12, 0.9);
  head.add(nose);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i += 1) {
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), accent);
      whisker.rotation.z = Math.PI / 2 + side * (0.24 + i * 0.12);
      whisker.position.set(side * 0.62, -0.24 - i * 0.09, 0.42);
      head.add(whisker);
    }
  }

  const parts: CatParts = {
    root,
    head,
    ears,
    eyes,
    tail,
    hat: new THREE.Group(),
    eyewear: new THREE.Group(),
    neck: new THREE.Group(),
    face: new THREE.Group(),
    back,
    backdrop,
    bodyScale: { x: t.body.scaleX, y: t.body.scaleY },
  };

  parts.hat.position.set(0, 0.98, 0);
  parts.eyewear.position.set(0, 0.1, 0.88);
  parts.neck.position.set(0, 0.5, 0);
  parts.face.position.set(0, -0.16, 0);
  head.add(parts.hat, parts.eyewear, parts.face);
  body.add(parts.neck);

  dressCat(parts, config);

  root.add(backdrop, back, tail, body, head, tailTip);
  return parts;
}

function disposeTree(node: THREE.Object3D) {
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((entry) => entry.dispose());
    else mat?.dispose?.();
  });
}

export function CatModel3D({
  config,
  className,
  handleRef,
}: {
  config: unknown;
  className?: string;
  handleRef?: Ref<CatModelHandle>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const partsRef = useRef<CatParts | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rotationRef = useRef({ x: 0.08, y: 0 });
  const dragRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  useImperativeHandle(handleRef, () => ({
    capturePng: async (size = 512) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) throw new Error("The 3D cat is not ready yet.");
      const canvas = renderer.domElement;
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
      const response = await fetch(url);
      return response.blob();
    },
  }));

  // Scene, camera, lights, renderer — once per mount.
  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 0.5, 8.2);
    camera.lookAt(0, 0.18, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    scene.add(new THREE.HemisphereLight("#ffffff", "#20242c", 1.5));
    const key = new THREE.DirectionalLight("#fff7e6", 2.1);
    key.position.set(2.4, 3.4, 3.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#c8ff3d", 0.9);
    rim.position.set(-3, 1.6, -2.4);
    scene.add(rim);

    const applySize = (width: number, height: number) => {
      if (width < 1 || height < 1) return;
      // updateStyle stays on: the drawing buffer and the CSS box must match, or
      // the cat renders stretched while the box is still laying out.
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      applySize(Math.round(rect.width), Math.round(rect.height));
    };
    // First paint can happen before layout settles; measure again next frame.
    const first = requestAnimationFrame(resize);
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      applySize(Math.round(box.width), Math.round(box.height));
    });
    observer.observe(host);

    // Pointer orbit.
    const onDown = (event: PointerEvent) => {
      dragRef.current = { x: event.clientX, y: event.clientY, active: true };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      rotationRef.current.y += dx * 0.01;
      rotationRef.current.x = THREE.MathUtils.clamp(rotationRef.current.x + dy * 0.006, -0.5, 0.6);
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    let visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
    });
    io.observe(host);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const clock = new THREE.Clock();
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const parts = partsRef.current;
      if (parts) {
        if (!dragRef.current.active && !reduced) rotationRef.current.y += 0.0025;
        parts.root.rotation.set(rotationRef.current.x, rotationRef.current.y, 0);
        parts.root.position.y = reduced ? 0 : Math.sin(t * 1.6) * 0.035;
        // Blink every 4s, ear twitch every 7s.
        const blink = t % 4 > 3.86;
        parts.eyes.scale.y = blink ? 0.12 : 1;
        const twitch = t % 7;
        const ear = twitch > 6.7 ? Math.sin((twitch - 6.7) * 30) * 0.18 : 0;
        parts.ears[0].rotation.z = -0.28 + ear;
        parts.ears[1].rotation.z = 0.28 - ear;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(first);
      io.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      if (partsRef.current) {
        scene.remove(partsRef.current.root);
        disposeTree(partsRef.current.root);
        partsRef.current = null;
      }
      renderer.dispose();
      host.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Rebuild the cat when the config changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const safe = sanitizeCatConfig(config);
    const next = buildCat(safe);
    if (partsRef.current) {
      scene.remove(partsRef.current.root);
      disposeTree(partsRef.current.root);
    }
    partsRef.current = next;
    scene.add(next.root);
  }, [config]);

  return (
    <div
      ref={mount}
      className={cn("h-full w-full", className)}
      style={{ width: "100%", height: "100%" }}
      aria-label="3D cat preview"
      role="img"
    />
  );
}
