import type { TemplateDef, TextStyleId } from "./content";

/**
 * Template layering, kept pure so it can be tested without a DOM.
 *
 * Applying a template is deliberately Instagram-like: the frame owns its photo
 * slots and sample text, and anything the member made by hand is untouched.
 * Photos already sitting in template slots follow across to the new layout
 * instead of being thrown away, which is what makes switching layouts feel like
 * resizing a page rather than starting over.
 *
 * `template: true` marks a layer as belonging to the template, so the next
 * apply knows exactly what it is allowed to replace.
 */

export type TemplateSlotLayer = {
  id: string;
  kind: "image";
  value: "";
  x: number;
  y: number;
  scale: number;
  rotate: number;
  w: number;
  h: number;
  src?: string;
  template: true;
};

export type TemplateTextLayer = {
  id: string;
  kind: "text";
  value: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  color: string;
  font: string;
  style: TextStyleId;
  template: true;
};

export type TemplateLayer = TemplateSlotLayer | TemplateTextLayer;

/** Any overlay shape: member layers are passed through untouched. */
export type LayeredOverlay = {
  id: string;
  kind: string;
  template?: boolean;
  src?: string;
};

/**
 * Build the layers for `def` and merge them with the member's own layers.
 * `makeId` is injected so the result is deterministic in tests.
 */
export function mergeTemplateLayers<L extends LayeredOverlay>(
  layers: L[],
  def: TemplateDef,
  makeId: () => string,
): { layers: L[]; firstEmptyId: string | null } {
  const carried = layers
    .filter((layer) => layer.template && layer.kind === "image" && layer.src)
    .map((layer) => layer.src!);

  const slots: TemplateSlotLayer[] = def.slots.map((slot, index) => ({
    id: makeId(),
    kind: "image",
    value: "",
    x: slot.x + slot.w / 2,
    y: slot.y + slot.h / 2,
    scale: 1,
    rotate: 0,
    w: slot.w,
    h: slot.h,
    ...(carried[index] ? { src: carried[index] } : {}),
    template: true,
  }));

  const texts: TemplateTextLayer[] = def.texts.map((preset) => ({
    id: makeId(),
    kind: "text",
    value: preset.text,
    // Honors the authored size: text exports at 72 * scale * W / 1080.
    x: preset.x,
    y: preset.y,
    scale: Math.max(0.25, preset.size / 72),
    rotate: 0,
    color: preset.color,
    font: preset.font,
    style: preset.style,
    template: true,
  }));

  const mine = layers.filter((layer) => !layer.template);
  const fresh = [...slots, ...texts] as unknown as L[];
  const firstEmpty = slots.find((slot) => !slot.src);
  return { layers: [...mine, ...fresh], firstEmptyId: firstEmpty?.id ?? null };
}
