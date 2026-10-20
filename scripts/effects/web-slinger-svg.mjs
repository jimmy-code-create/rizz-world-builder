/**
 * Renders a frame of the scene as a static SVG.
 *
 * The Lottie file is the deliverable; this is the still that proves the
 * geometry is right without needing a browser or a video codec. It walks the
 * same layer list, samples every animated property at the requested frame and
 * emits plain SVG.
 */

import { valueAt, rgba } from "./web-slinger-lib.mjs";

/** Lottie vertex/tangent data back into an SVG path string. */
function pathData(shape, frame) {
  let k = shape.ks.k;
  if (shape.ks.a === 1) k = sampleShape(shape.ks, frame);
  const v = k.v;
  const i = k.i;
  const o = k.o;
  if (!v.length) return "";
  let d = `M ${round(v[0][0])} ${round(v[0][1])}`;
  for (let n = 1; n < v.length; n += 1) {
    const prev = v[n - 1];
    const curr = v[n];
    const c1 = [prev[0] + (o[n - 1]?.[0] ?? 0), prev[1] + (o[n - 1]?.[1] ?? 0)];
    const c2 = [curr[0] + (i[n]?.[0] ?? 0), curr[1] + (i[n]?.[1] ?? 0)];
    d += ` C ${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(curr[0])} ${round(curr[1])}`;
  }
  if (k.c) {
    const last = v[v.length - 1];
    const first = v[0];
    const c1 = [last[0] + (o[v.length - 1]?.[0] ?? 0), last[1] + (o[v.length - 1]?.[1] ?? 0)];
    const c2 = [first[0] + (i[0]?.[0] ?? 0), first[1] + (i[0]?.[1] ?? 0)];
    d += ` C ${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(first[0])} ${round(first[1])}`;
    d += " Z";
  }
  return d;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Sample an animated shape at a frame. The web lines keep a constant vertex
 * count, so a straight lerp of the vertices and tangents is exact enough for
 * the still renderer.
 */
function sampleShape(ks, frame) {
  const keys = ks.k;
  if (!keys.length) return { v: [], i: [], o: [], c: false };
  const at = (key) => key.s?.[0] ?? key.s;
  if (frame <= keys[0].t) return at(keys[0]);
  for (let n = 0; n < keys.length - 1; n += 1) {
    const a = at(keys[n]);
    const b = at(keys[n + 1]);
    if (frame >= keys[n].t && frame <= keys[n + 1].t) {
      if (!a?.v || !b?.v || a.v.length !== b.v.length) return a;
      const t = (frame - keys[n].t) / (keys[n + 1].t - keys[n].t || 1);
      const e = t * t * (3 - 2 * t);
      const lerp = (p, q) => [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e];
      return {
        v: a.v.map((p, idx) => lerp(p, b.v[idx])),
        i: a.i.map((p, idx) => lerp(p, b.i[idx] ?? p)),
        o: a.o.map((p, idx) => lerp(p, b.o[idx] ?? p)),
        c: a.c,
      };
    }
  }
  return at(keys[keys.length - 1]);
}

function transformString(ks, frame) {
  const position = valueAt(ks.p, frame);
  const anchor = valueAt(ks.a, frame);
  const scale = valueAt(ks.s, frame);
  const rotation = valueAt(ks.r, frame)[0];
  const sx = (scale[0] ?? 100) / 100;
  const sy = (scale[1] ?? 100) / 100;
  const parts = [
    `translate(${round(position[0] ?? 0)} ${round(position[1] ?? 0)})`,
    `rotate(${round(rotation)})`,
    `scale(${round(sx, 4)} ${round(sy, 4)})`,
    `translate(${round(-(anchor[0] ?? 0))} ${round(-(anchor[1] ?? 0))})`,
  ];
  return parts.join(" ");
}

/**
 * The gradient's stops, in the shape the player reads them: the colour block
 * first (offset, r, g, b) and the opacity block after it (offset, alpha).
 */
function readGradientStops(gradient) {
  const raw = gradient.g.k.k;
  const count = gradient.g.p;
  const colours = [];
  const alphas = [];
  for (let i = 0; i < count; i += 1) {
    colours.push([raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2], raw[i * 4 + 3]]);
    alphas.push(raw[count * 4 + i * 2 + 1] ?? 1);
  }
  return colours.map(([offset, r, g, b], i) => [offset, r, g, b, alphas[i]]);
}

function gradientDef(id, stops, x1, y1, x2, y2) {
  const list = stops
    .map(
      ([offset, r, g, b, a]) =>
        `<stop offset="${round(offset * 100)}%" stop-color="rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})" stop-opacity="${round(a, 3)}"/>`,
    )
    .join("");
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}">${list}</linearGradient>`;
}

/** Render one shape group to SVG. */
function renderGroup(groupItem, frame, defs, gradientIndex) {
  const items = groupItem.it ?? [];
  const groupTransform = items.find((item) => item.ty === "tr");
  const paths = items.filter((item) => item.ty === "sh" || item.ty === "el");
  const nested = items.filter((item) => item.ty === "gr");

  // Nested groups carry their own paint, so they are rendered recursively.
  const nestedMarkup = nested.map((item) => renderGroup(item, frame, defs, gradientIndex)).join("");

  if (!paths.length) {
    const transform = groupTransform ? transformString(groupTransform, frame) : "";
    return nestedMarkup ? `<g transform="${transform}">${nestedMarkup}</g>` : "";
  }

  const fillItem = items.find((item) => item.ty === "fl" || item.ty === "gf");
  const strokeItem = items.find((item) => item.ty === "st" || item.ty === "gs");
  const trimItem = items.find((item) => item.ty === "tm");

  const body = paths
    .map((shape) => {
      if (shape.ty === "el") {
        const size = valueAt(shape.s, frame);
        const centre = valueAt(shape.p, frame);
        return `<ellipse cx="${round(centre[0])}" cy="${round(centre[1])}" rx="${round((size[0] ?? 0) / 2)}" ry="${round((size[1] ?? 0) / 2)}"/>`;
      }
      return `<path d="${pathData(shape, frame)}"/>`;
    })
    .join("");

  let paint = "";
  if (fillItem?.ty === "gf") {
    const id = `g${gradientIndex.next++}`;
    const start = valueAt(fillItem.s, frame);
    const end = valueAt(fillItem.e, frame);
    defs.push(gradientDef(id, readGradientStops(fillItem), start[0], start[1], end[0], end[1]));
    paint += ` fill="url(#${id})"`;
  } else if (fillItem) {
    const colour = valueAt(fillItem.c, frame);
    const opacity = valueAt(fillItem.o, frame)[0] / 100;
    paint += ` fill="rgb(${Math.round(colour[0] * 255)},${Math.round(colour[1] * 255)},${Math.round(colour[2] * 255)})" fill-opacity="${round(opacity, 3)}"`;
  } else {
    // A stroke-only group must not fill its paths, and a group with nested
    // paint must not leak its own paint into them.
    paint += ` fill="none"`;
  }
  if (strokeItem) {
    const width = valueAt(strokeItem.w, frame)[0];
    const opacity = (valueAt(strokeItem.o, frame)[0] ?? 100) / 100;
    if (strokeItem.ty === "gs") {
      const id = `g${gradientIndex.next++}`;
      const start = valueAt(strokeItem.s, frame);
      const end = valueAt(strokeItem.e, frame);
      defs.push(gradientDef(id, readGradientStops(strokeItem), start[0], start[1], end[0], end[1]));
      paint += ` stroke="url(#${id})" stroke-width="${round(width, 2)}" stroke-opacity="${round(opacity, 3)}" stroke-linecap="round"`;
    } else {
      const colour = valueAt(strokeItem.c, frame);
      paint += ` stroke="rgb(${Math.round(colour[0] * 255)},${Math.round(colour[1] * 255)},${Math.round(colour[2] * 255)})" stroke-width="${round(width, 2)}" stroke-opacity="${round(opacity, 3)}" stroke-linecap="round"`;
    }
  } else {
    paint += ` stroke="none"`;
  }

  // Trim paths are approximated by the still: the full strand is drawn.
  void trimItem;

  const transform = groupTransform ? transformString(groupTransform, frame) : "";
  return `<g transform="${transform}"${paint}>${body}${nestedMarkup}</g>`;
}

function renderLayer(layer, frame, defs, gradientIndex) {
  const shapes = layer.shapes ?? [];
  const inner = shapes
    .map((item) => (item.ty === "gr" ? renderGroup(item, frame, defs, gradientIndex) : ""))
    .join("");
  const opacity = (valueAt(layer.ks.o, frame)[0] ?? 100) / 100;
  const transform = transformString(layer.ks, frame);
  return `<g transform="${transform}" opacity="${round(opacity, 3)}">${inner}</g>`;
}

/** Render the whole scene at one frame as a standalone SVG document. */
export function renderSvg(layers, frame, { width, height, background = "transparent" } = {}) {
  const defs = [];
  const gradientIndex = { next: 1 };
  const body = layers.map((layer) => renderLayer(layer, frame, defs, gradientIndex)).join("");
  const bg =
    background === "transparent" ? "" : `<rect width="100%" height="100%" fill="${background}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<defs>${defs.join("")}</defs>`,
    bg,
    body,
    `</svg>`,
  ].join("\n");
}

export { rgba };
