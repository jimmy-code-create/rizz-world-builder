import type { FaceGeometry } from "@/components/story/face-mesh";
import type { FaceEffect, GradeSpec, OverlayPart, WarpSpec } from "@/lib/face-effects";

/**
 * The face-effect renderer, in two passes.
 *
 * Pass 1 (`FaceWarpRenderer`, WebGL): ONE mesh-warp shader for every warp lens,
 * driven entirely by uniforms — `uWarp[6]` (centre, radius, signed strength),
 * `uSwirl`, plus the shared colour-grade block. Nothing here loops over pixels;
 * the grid is warped in the vertex shader and the fragment shader only grades.
 * Every entry in the warp category is the same program with different numbers.
 *
 * Pass 2 (`drawOverlays`, 2D canvas): the parts that genuinely are sprites and
 * regions — emoji overlays that follow head rotation, beauty touches clipped to
 * landmark regions, and the world particle layers. The browser composites both
 * canvases on the GPU.
 */

const MAX_WARPS = 6;
const GRID_SEGMENTS = 32;

const VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec4 uWarp[${MAX_WARPS}]; // xy = centre (uv), z = radius, w = signed strength
uniform int uWarpCount;
uniform vec3 uSwirl;             // xy = centre (uv), z = amount
uniform float uAspect;           // width / height
uniform vec2 uOffset;            // clone offset (uv)
uniform float uScale;            // clone scale

out vec2 vUv;

void main() {
  vec2 p = position.xy;          // grid in [-1, 1]
  vec2 uv = p * 0.5 + 0.5;

  for (int i = 0; i < ${MAX_WARPS}; i++) {
    if (i >= uWarpCount) break;
    vec4 spec = uWarp[i];
    float radius = max(spec.z, 0.001);
    vec2 delta = (uv - spec.xy) * vec2(uAspect, 1.0);
    float dist = length(delta);
    float falloff = 1.0 - smoothstep(0.0, radius, dist);
    if (falloff <= 0.0) continue;
    float amount = spec.w * falloff * falloff;
    vec2 dir = delta / max(dist, 1e-5);
    uv -= vec2(dir.x / uAspect, dir.y) * amount * radius * 0.5;
  }

  if (abs(uSwirl.z) > 0.0001) {
    vec2 delta = (uv - uSwirl.xy) * vec2(uAspect, 1.0);
    float dist = length(delta);
    float falloff = 1.0 - smoothstep(0.0, 0.75, dist);
    float angle = uSwirl.z * falloff * falloff * 2.4;
    float s = sin(angle);
    float c = cos(angle);
    vec2 rotated = vec2(delta.x * c - delta.y * s, delta.x * s + delta.y * c);
    uv = uSwirl.xy + vec2(rotated.x / uAspect, rotated.y);
  }

  vUv = uv * uScale + uOffset;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform float uTime;

// geometry
uniform int uMirror;      // 0 none, 1 horizontal, 2 vertical, 3 split
uniform int uFlip;
uniform float uKaleido;   // segments, 0 disables

// grade
uniform float uSaturation;
uniform float uContrast;
uniform float uBrightness;
uniform float uHueShift;
uniform float uSepia;
uniform float uGrain;
uniform float uVhs;
uniform float uPosterize;
uniform float uPixelate;
uniform float uSketch;
uniform float uNeon;
uniform float uVignette;
uniform vec3 uTint;
uniform float uMix;

vec3 hueRotate(vec3 color, float angle) {
  const vec3 k = vec3(0.57735);
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 mapGeometry(vec2 uv) {
  if (uFlip == 1) uv = vec2(uv.x, 1.0 - uv.y);
  if (uMirror == 1) uv = vec2(1.0 - uv.x, uv.y);
  else if (uMirror == 2) uv = vec2(uv.x, 1.0 - uv.y);
  else if (uMirror == 3) {
    // Split: the left half is mirrored onto the right, so one half of the face
    // is duplicated — the classic "mirror / split" lens.
    uv = vec2(uv.x < 0.5 ? uv.x : 1.0 - uv.x, uv.y);
  }
  if (uKaleido > 1.0) {
    vec2 centred = uv - 0.5;
    float radius = length(centred);
    float angle = atan(centred.y, centred.x);
    float segment = 6.28318530718 / uKaleido;
    angle = mod(angle, segment);
    angle = abs(angle - segment * 0.5);
    uv = 0.5 + vec2(cos(angle), sin(angle)) * radius;
  }
  return uv;
}

vec3 sampleFrame(vec2 uv) {
  vec2 coord = mapGeometry(uv);
  if (uPixelate > 0.5) {
    coord = floor(coord * (1.0 / (uPixelate * uTexel))) * (uPixelate * uTexel) + uTexel * 0.5;
  }
  return texture(uTexture, clamp(coord, vec2(0.001), vec2(0.999))).rgb;
}

vec3 grade(vec3 color, vec2 uv) {
  if (uSketch > 0.5) {
    // Cheap edge response: luminance gradient across neighbouring texels.
    float l = dot(sampleFrame(uv - uTexel), vec3(0.299, 0.587, 0.114));
    float lx = dot(sampleFrame(uv + uTexel), vec3(0.299, 0.587, 0.114));
    float ly = dot(sampleFrame(uv + vec2(0.0, uTexel.y * 2.0)), vec3(0.299, 0.587, 0.114));
    float edge = clamp(1.0 - abs(l - (lx + ly) * 0.5) * 6.0, 0.0, 1.0);
    color = mix(color, vec3(edge), uSketch * uMix);
  }

  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  color *= uBrightness;
  if (abs(uHueShift) > 0.0001) color = hueRotate(color, uHueShift);
  if (uSepia > 0.0001) {
    vec3 sepia = vec3(
      dot(color, vec3(0.393, 0.769, 0.189)),
      dot(color, vec3(0.349, 0.686, 0.168)),
      dot(color, vec3(0.272, 0.534, 0.131))
    );
    color = mix(color, sepia, uSepia);
  }
  if (uPosterize > 0.5) {
    color = floor(color * uPosterize) / uPosterize;
  }
  color *= uTint;
  if (uNeon > 0.0001) {
    float boosted = pow(clamp(luminance, 0.0, 1.0), 2.2);
    color += vec3(0.35, 0.1, 0.55) * boosted * uNeon;
  }
  if (uGrain > 0.0001) {
    float noise = hash(uv * vec2(1024.0, 1024.0) + uTime * 60.0) - 0.5;
    color += noise * uGrain * 0.35;
  }
  if (uVhs > 0.0001) {
    float line = sin((uv.y + uTime * 0.35) * 900.0);
    color += line * uVhs * 0.05;
    float band = step(0.995, hash(vec2(floor(uv.y * 120.0), floor(uTime * 6.0))));
    color = mix(color, color.brg, band * uVhs * 0.6);
  }
  if (uVignette > 0.0001) {
    float d = distance(uv, vec2(0.5));
    color *= 1.0 - smoothstep(0.35, 0.85, d) * uVignette;
  }
  return color;
}

void main() {
  vec3 base = sampleFrame(vUv);
  vec3 graded = grade(base, vUv);
  outColor = vec4(mix(base, graded, clamp(uMix, 0.0, 1.0)), 1.0);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[face-pipeline] shader failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type UniformName =
  | "uTexture"
  | "uTexel"
  | "uTime"
  | "uWarp"
  | "uWarpCount"
  | "uSwirl"
  | "uAspect"
  | "uOffset"
  | "uScale"
  | "uMirror"
  | "uFlip"
  | "uKaleido"
  | "uSaturation"
  | "uContrast"
  | "uBrightness"
  | "uHueShift"
  | "uSepia"
  | "uGrain"
  | "uVhs"
  | "uPosterize"
  | "uPixelate"
  | "uSketch"
  | "uNeon"
  | "uVignette"
  | "uTint"
  | "uMix";

export type WarpRenderInput = {
  effect: FaceEffect | null;
  /** 0–1 slider position. */
  intensity: number;
  faces: FaceGeometry[];
  time: number;
};

/** The single shared mesh-warp renderer for every warp lens and filter. */
export class FaceWarpRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms = new Map<UniformName, WebGLUniformLocation | null>();
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  /** The current frame source: a live `<video>` or a picked `<img>`. */
  private video: TexImageSource | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) {
      console.warn("[face-pipeline] WebGL2 is unavailable; effects fall back to overlays only");
      return;
    }
    this.gl = gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = vertex && fragment ? gl.createProgram() : null;
    if (!program || !vertex || !fragment) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[face-pipeline] program link failed", gl.getProgramInfoLog(program));
      return;
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    this.program = program;
    gl.useProgram(program);

    for (const name of [
      "uTexture",
      "uTexel",
      "uTime",
      "uWarp",
      "uWarpCount",
      "uSwirl",
      "uAspect",
      "uOffset",
      "uScale",
      "uMirror",
      "uFlip",
      "uKaleido",
      "uSaturation",
      "uContrast",
      "uBrightness",
      "uHueShift",
      "uSepia",
      "uGrain",
      "uVhs",
      "uPosterize",
      "uPixelate",
      "uSketch",
      "uNeon",
      "uVignette",
      "uTint",
      "uMix",
    ] as UniformName[]) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }

    // A subdivided grid is what makes the vertex warp smooth instead of a
    // stretched quad.
    const positions: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= GRID_SEGMENTS; row += 1) {
      for (let column = 0; column <= GRID_SEGMENTS; column += 1) {
        positions.push((column / GRID_SEGMENTS) * 2 - 1, (row / GRID_SEGMENTS) * 2 - 1);
      }
    }
    for (let row = 0; row < GRID_SEGMENTS; row += 1) {
      for (let column = 0; column < GRID_SEGMENTS; column += 1) {
        const a = row * (GRID_SEGMENTS + 1) + column;
        const b = a + 1;
        const c = a + GRID_SEGMENTS + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    this.indexCount = indices.length;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.vao = vao;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  get available(): boolean {
    return !!this.gl && !!this.program;
  }

  /** Rebinds to the given element (a `<video>`, an `<img>` or a canvas). */
  setVideo(video: TexImageSource | null) {
    this.video = video;
  }

  resize(width: number, height: number) {
    const canvas = this.canvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  render({ effect, intensity, faces, time }: WarpRenderInput) {
    const gl = this.gl;
    const program = this.program;
    const video = this.video;
    if (!gl || !program || !video) return;
    const width = this.canvas.width || 1;
    const height = this.canvas.height || 1;

    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      // The video may not have a frame yet; keep the last texture.
    }
    this.set("uTexture", (location) => gl.uniform1i(location, 0));
    this.set("uTexel", (location) => gl.uniform2f(location, 1 / width, 1 / height));
    this.set("uTime", (location) => gl.uniform1f(location, time % 1000));
    this.set("uAspect", (location) => gl.uniform1f(location, width / height));

    const face = faces[0] ?? null;
    const warpData = new Float32Array(MAX_WARPS * 4);
    let warpCount = 0;
    const warps: WarpSpec[] = effect?.warp ?? [];
    for (const spec of warps.slice(0, MAX_WARPS)) {
      const anchor = face?.anchors[spec.anchor] ?? { x: 0.5, y: 0.5 };
      const faceScale = face?.scale ?? 0.08;
      warpData[warpCount * 4] = anchor.x;
      warpData[warpCount * 4 + 1] = anchor.y;
      // Radius is expressed in face widths so the same lens feels identical on
      // every face size and distance from the camera.
      warpData[warpCount * 4 + 2] = Math.max(0.05, spec.radius * faceScale * 4);
      warpData[warpCount * 4 + 3] = spec.strength * intensity;
      warpCount += 1;
    }
    this.set("uWarp", (location) => gl.uniform4fv(location, warpData));
    this.set("uWarpCount", (location) => gl.uniform1i(location, warpCount));

    const swirlCentre = face?.anchors.face ?? { x: 0.5, y: 0.5 };
    this.set("uSwirl", (location) =>
      gl.uniform3f(location, swirlCentre.x, swirlCentre.y, (effect?.swirl ?? 0) * intensity),
    );

    const geometry = effect?.geometry ?? {};
    this.set("uMirror", (location) =>
      gl.uniform1i(location, geometry.mirror === "horizontal" ? 1 : geometry.mirror === "vertical" ? 2 : geometry.mirror === "split" ? 3 : 0),
    );
    this.set("uFlip", (location) => gl.uniform1i(location, geometry.flip ? 1 : 0));
    this.set("uKaleido", (location) =>
      gl.uniform1f(location, geometry.kaleidoscope ? 2 + (geometry.kaleidoscope - 2) * intensity : 0),
    );

    const grade: GradeSpec = effect?.grade ?? {};
    this.setGrade(grade, intensity);

    // `clone` repeats the draw at offsets around the face centre.
    const cloneCount = Math.max(1, Math.min(4, Math.round(geometry.clone ?? 1)));
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (let index = 0; index < cloneCount; index += 1) {
      const spread = 0.22 * intensity;
      const offsetX = cloneCount === 1 ? 0 : (index - (cloneCount - 1) / 2) * spread * 2;
      const scale = cloneCount === 1 ? 1 : 0.72;
      this.set("uOffset", (location) =>
        gl.uniform2f(location, 0.5 - 0.5 / scale + offsetX, 0.5 - 0.5 / scale),
      );
      this.set("uScale", (location) => gl.uniform1f(location, 1 / scale));
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  private setGrade(grade: GradeSpec, intensity: number) {
    const mix = grade.mix ?? intensity;
    this.set("uSaturation", (location) =>
      this.gl!.uniform1f(location, grade.saturation === undefined ? 1 : 1 + (grade.saturation - 1) * intensity),
    );
    this.set("uContrast", (location) =>
      this.gl!.uniform1f(location, grade.contrast === undefined ? 1 : 1 + (grade.contrast - 1) * intensity),
    );
    this.set("uBrightness", (location) =>
      this.gl!.uniform1f(location, grade.brightness === undefined ? 1 : 1 + (grade.brightness - 1) * intensity),
    );
    this.set("uHueShift", (location) => this.gl!.uniform1f(location, (grade.hueShift ?? 0) * intensity));
    this.set("uSepia", (location) => this.gl!.uniform1f(location, (grade.sepia ?? 0) * intensity));
    this.set("uGrain", (location) => this.gl!.uniform1f(location, (grade.grain ?? 0) * intensity));
    this.set("uVhs", (location) => this.gl!.uniform1f(location, (grade.vhs ?? 0) * intensity));
    this.set("uPosterize", (location) => this.gl!.uniform1f(location, grade.posterize ?? 0));
    this.set("uPixelate", (location) => this.gl!.uniform1f(location, grade.pixelate ?? 0));
    this.set("uSketch", (location) => this.gl!.uniform1f(location, grade.sketch ?? 0));
    this.set("uNeon", (location) => this.gl!.uniform1f(location, (grade.neon ?? 0) * intensity));
    this.set("uVignette", (location) => this.gl!.uniform1f(location, (grade.vignette ?? 0) * intensity));
    this.set("uTint", (location) => {
      const tint = grade.tint ?? [1, 1, 1];
      this.gl!.uniform3f(
        location,
        1 + (tint[0] - 1) * intensity,
        1 + (tint[1] - 1) * intensity,
        1 + (tint[2] - 1) * intensity,
      );
    });
    this.set("uMix", (location) => this.gl!.uniform1f(location, mix));
  }

  private set(name: UniformName, apply: (location: WebGLUniformLocation) => void) {
    const location = this.uniforms.get(name);
    if (location) apply(location);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    this.video = null;
    if (this.program) gl.deleteProgram(this.program);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.program = null;
    this.texture = null;
    this.vao = null;
  }
}

export type OverlayInput = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  effect: FaceEffect | null;
  intensity: number;
  faces: FaceGeometry[];
  time: number;
  /** 0–1 activity of the effect's reactive trigger, when it has one. */
  reactivity: number;
  /** The sharp GL canvas, used as the source for background blur. */
  source: HTMLCanvasElement | null;
};

/** Draws the sprite, beauty and world layers of an effect. */
export function drawOverlays({
  ctx,
  width,
  height,
  effect,
  intensity,
  faces,
  time,
  reactivity,
  source,
}: OverlayInput) {
  ctx.clearRect(0, 0, width, height);
  if (!effect) return;
  const face = faces[0] ?? null;
  const strength = effect.reactive ? reactivity : intensity;

  if (effect.world && effect.world.kind === "blur" && face) {
    // Background blur without segmentation: the sharp frame stays inside a
    // face-shaped ellipse and everything outside it is a blurred copy.
    const cx = face.anchors.face.x * width;
    const cy = face.anchors.face.y * height;
    const rx = face.scale * width * 1.35;
    const ry = rx * 1.35;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.ellipse(cx, cy, rx, ry, face.roll, 0, Math.PI * 2);
    ctx.clip("evenodd");
    ctx.filter = `blur(${Math.round(4 + 18 * effect.world.amount * strength)}px)`;
    if (source) ctx.drawImage(source, 0, 0, width, height);
    ctx.filter = "none";
    ctx.restore();
  }

  if (effect.beauty && face) {
    drawBeauty(ctx, width, height, effect.beauty, face, intensity);
  }

  if (effect.overlay && face) {
    for (const part of effect.overlay.parts) {
      drawSprite(ctx, width, height, part, face, intensity);
    }
  }

  if (effect.reactive?.overlay && face && strength > 0.02) {
    for (const part of effect.reactive.overlay.parts) {
      drawSprite(ctx, width, height, part, face, strength);
    }
  }

  const particles =
    effect.world && effect.world.kind !== "blur" && effect.world.kind !== "replace"
      ? effect.world.kind
      : effect.reactive?.particles ?? null;
  if (particles) {
    drawParticles(ctx, width, height, particles, effect.world?.amount ?? 0.7, intensity, time, effect.reactive ? strength : 1);
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  part: OverlayPart,
  face: FaceGeometry,
  intensity: number,
) {
  const anchor = face.anchors[part.anchor];
  const size = Math.max(18, face.scale * part.scale * width * (0.55 + intensity * 0.45));
  const offsetX = (part.offset?.x ?? 0) * face.scale * width;
  const offsetY = (part.offset?.y ?? 0) * face.scale * width;
  ctx.save();
  // Head rotation drives the sprite's own transform, so ears, horns and hats
  // stay glued to the head as it tilts.
  ctx.translate(anchor.x * width + offsetX, anchor.y * height + offsetY);
  ctx.rotate(face.roll * 0.85);
  ctx.globalAlpha = 0.35 + 0.65 * intensity;
  ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(part.sprite, 0, 0);
  ctx.restore();
}

function drawBeauty(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  beauty: NonNullable<FaceEffect["beauty"]>,
  face: FaceGeometry,
  intensity: number,
) {
  const px = (point: { x: number; y: number }) => ({ x: point.x * width, y: point.y * height });
  const faceWidth = face.scale * width;

  // Skin smoothing: a blurred copy of the face card at low alpha. `ctx.filter`
  // is browser-accelerated, so this is not a JS pixel loop.
  if (beauty.smooth) {
    const centre = px(face.anchors.face);
    const radius = faceWidth * 1.05;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius, radius * 1.25, face.roll, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = Math.min(0.75, beauty.smooth * intensity);
    ctx.filter = `blur(${Math.max(1, faceWidth * 0.05)}px)`;
    ctx.fillStyle = "rgba(255,240,235,0.6)";
    ctx.fillRect(0, 0, width, height);
    ctx.filter = "none";
    ctx.restore();
  }

  if (beauty.glow || beauty.softFocus) {
    const amount = (beauty.glow ?? 0) + (beauty.softFocus ?? 0);
    const centre = px(face.anchors.face);
    const radius = faceWidth * 1.5;
    const gradient = ctx.createRadialGradient(centre.x, centre.y, faceWidth * 0.3, centre.x, centre.y, radius);
    gradient.addColorStop(0, `rgba(255,236,244,${0.22 * amount * intensity})`);
    gradient.addColorStop(1, "rgba(255,236,244,0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (beauty.blush) {
    const amount = beauty.blush * intensity;
    const radius = faceWidth * 0.3;
    for (const anchor of [face.anchors.cheeks]) {
      const { x, y } = px(anchor);
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
      gradient.addColorStop(0, `rgba(255,96,140,${0.4 * amount})`);
      gradient.addColorStop(1, "rgba(255,96,140,0)");
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      // Two lobes so the blush sits on both cheeks rather than the midpoint.
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x - faceWidth * 0.42, y, radius, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(x + faceWidth * 0.42, y, radius, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (beauty.brightenEyes) {
    const amount = beauty.brightenEyes * intensity;
    for (const anchor of [face.anchors.leftEye, face.anchors.rightEye]) {
      const { x, y } = px(anchor);
      const radius = faceWidth * 0.24;
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${0.32 * amount})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  if (beauty.whitenTeeth) {
    const { x, y } = px(face.anchors.mouth);
    const amount = beauty.whitenTeeth * intensity;
    const w = faceWidth * 0.5;
    const h = faceWidth * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.5 * amount;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (beauty.lipstick) {
    const { x, y } = px(face.anchors.mouth);
    const amount = intensity;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55 * amount;
    ctx.fillStyle = beauty.lipstick;
    ctx.beginPath();
    ctx.ellipse(x, y, faceWidth * 0.32, faceWidth * 0.17, face.roll, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (beauty.freckles) {
    const amount = beauty.freckles * intensity;
    const { x, y } = px(face.anchors.cheeks);
    ctx.save();
    ctx.fillStyle = `rgba(120,72,50,${0.5 * amount})`;
    // Deterministic pattern (no Math.random) so freckles don't dance per frame.
    for (let index = 0; index < 26; index += 1) {
      const angle = (index / 26) * Math.PI * 2;
      const spread = faceWidth * (0.28 + (index % 5) * 0.04);
      const fx = x + Math.cos(angle) * spread;
      const fy = y + Math.sin(angle) * spread * 0.5;
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(0.8, faceWidth * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "snow" | "rain" | "confetti" | "hearts" | "galaxy" | "fire" | "sparkles" | "rainbow",
  amount: number,
  intensity: number,
  time: number,
  activity: number,
) {
  const count = Math.round(30 + 70 * amount * intensity * (activity > 0 ? activity : 1));
  const seconds = time / 1000;
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    // Deterministic per-index hash, animated by time: no per-frame randomness.
    const seed = (index * 9301 + 49297) % 233280;
    const rand = seed / 233280;
    const drift = Math.sin(seconds * (0.4 + rand) + index) * width * 0.08;

    if (kind === "rain") {
      const x = ((rand * width + drift) % width + width) % width;
      const speed = 700 + rand * 500;
      const y = ((rand * height + seconds * speed) % (height + 40)) - 20;
      ctx.strokeStyle = `rgba(190,220,255,${0.35 * intensity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 16);
      ctx.stroke();
      continue;
    }

    if (kind === "fire") {
      const x = width * (0.3 + rand * 0.4) + drift;
      const y = height * (0.9 - ((seconds * (0.6 + rand * 0.6) + rand) % 1) * 0.9);
      const radius = width * (0.02 + rand * 0.05) * (1 - (y / height) * 0.5);
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
      gradient.addColorStop(0, `rgba(255,220,120,${0.8 * intensity})`);
      gradient.addColorStop(0.5, `rgba(255,120,40,${0.5 * intensity})`);
      gradient.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (kind === "galaxy") {
      const x = (rand * width + drift * 0.2) % width;
      const y = rand * height;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(seconds * (0.8 + rand) + index));
      ctx.fillStyle = `rgba(${170 + Math.round(70 * rand)},${140 + Math.round(60 * rand)},255,${0.5 * intensity * twinkle})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + rand * 2.2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (kind === "rainbow") {
      const x = width * (0.2 + rand * 0.6) + drift;
      const y = height * (0.15 + rand * 0.2);
      const hue = (index * 24 + seconds * 90) % 360;
      ctx.strokeStyle = `hsla(${hue},95%,62%,${0.7 * intensity * activity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, width * 0.06, Math.PI, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    // snow / confetti / hearts / sparkles
    const speed = kind === "snow" ? 70 : 150;
    const y = ((rand * height + seconds * speed) % (height + 30)) - 15;
    const x = ((rand * width + drift) % width + width) % width;
    const glyph = kind === "confetti" ? ["🎉", "🎊", "✨"][index % 3] : kind === "hearts" ? "❤️" : kind === "sparkles" ? "✨" : "❄️";
    ctx.globalAlpha = 0.55 + 0.45 * intensity;
    ctx.font = `${Math.max(12, width * (0.018 + rand * 0.02))}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(glyph, x, y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
