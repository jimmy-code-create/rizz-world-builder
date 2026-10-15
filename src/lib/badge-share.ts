/**
 * Branded badge share images: a 1080x1350 PNG drawn on canvas in the app's
 * own style (near-black, lime accents, tier glow, app fonts, avatar + name).
 * Mobile uses the Web Share API with the file attached; otherwise it downloads.
 */

export type ShareBadgeInput = {
  badgeName: string;
  flavor: string;
  slug: string;
  tier: string;
  /** Tier glow color, e.g. "#ff4d6d". */
  glow: string;
  unlockedAt: string | null;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

const W = 1080;
const H = 1350;
const CREAM = "#f2efe6";
const MUTED = "#8A8A8E";
const INK = "#0B0B0C";
const LIME = "#c8ff3d";
const DISPLAY = '"Bricolage Grotesque", sans-serif';
const SANS = '"Instrument Sans", sans-serif';

function loadImage(src: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    const timer = window.setTimeout(() => reject(new Error("image timeout")), 10_000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("image load failed"));
    };
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, base: number, family: string, weight: number, maxWidth: number) {
  let size = base;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  while (size > 28) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

export async function buildBadgeSharePng(input: ShareBadgeInput): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`700 100px ${DISPLAY}`),
      document.fonts.load(`400 44px ${SANS}`),
      document.fonts.load(`700 48px ${SANS}`),
    ]);
  } catch {
    /* system fonts are an acceptable fallback */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available here.");

  // Backdrop + lime aura + card frame.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const aura = ctx.createRadialGradient(W / 2, 200, 40, W / 2, 200, 560);
  aura.addColorStop(0, "rgba(200,255,61,0.14)");
  aura.addColorStop(1, "rgba(200,255,61,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#262629";
  roundRectPath(ctx, 48, 48, W - 96, H - 96, 48);
  ctx.stroke();

  // Wordmark.
  ctx.fillStyle = CREAM;
  fitFont(ctx, "RIZZ", 64, DISPLAY, 700, 400);
  ctx.fillText("RIZZ", W / 2, 168);

  // Badge art: rasterize the live on-screen SVG so the PNG shows the exact
  // app artwork (with its tier glow), never a generic icon.
  const artBox = 340;
  const artX = W / 2 - artBox / 2;
  const artY = 300;
  let drewArt = false;
  try {
    const node = document.querySelector("[data-badge-art] svg") as SVGSVGElement | null;
    if (node) {
      const xml = new XMLSerializer().serializeToString(node);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      try {
        const img = await loadImage(url);
        ctx.save();
        ctx.shadowColor = input.glow;
        ctx.shadowBlur = 90;
        ctx.drawImage(img, artX, artY, artBox, artBox);
        ctx.restore();
        drewArt = true;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    /* fall through to the glow initial */
  }
  if (!drewArt) {
    ctx.save();
    ctx.shadowColor = input.glow;
    ctx.shadowBlur = 80;
    ctx.fillStyle = input.glow;
    ctx.beginPath();
    ctx.arc(W / 2, artY + artBox / 2, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK;
    fitFont(ctx, input.badgeName.charAt(0).toUpperCase(), 120, DISPLAY, 700, 200);
    ctx.fillText(input.badgeName.charAt(0).toUpperCase(), W / 2, artY + artBox / 2 + 42);
  }

  // Name, tier chip, flavor.
  ctx.fillStyle = CREAM;
  const nameSize = fitFont(ctx, input.badgeName, 96, DISPLAY, 700, 880);
  ctx.fillText(input.badgeName, W / 2, 780);
  const tierText = input.tier.toUpperCase();
  ctx.font = `700 36px ${SANS}`;
  const tierW = ctx.measureText(tierText).width + 64;
  ctx.lineWidth = 3;
  ctx.strokeStyle = input.glow;
  ctx.fillStyle = `${input.glow}22`;
  roundRectPath(ctx, W / 2 - tierW / 2, 812, tierW, 64, 32);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = input.glow;
  ctx.fillText(tierText, W / 2, 857);

  ctx.fillStyle = MUTED;
  ctx.font = `400 44px ${SANS}`;
  const flavorLines = wrapLines(ctx, input.flavor, 860);
  flavorLines.forEach((line, i) => ctx.fillText(line, W / 2, 940 + i * 56));

  ctx.fillStyle = input.unlockedAt ? LIME : MUTED;
  ctx.font = `400 38px ${SANS}`;
  const unlockedText = input.unlockedAt
    ? `Unlocked ${new Date(input.unlockedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
    : "Locked — keep vibing";
  ctx.fillText(unlockedText, W / 2, 1080);

  // Owner row: avatar + name + handle.
  const avatarCX = W / 2;
  const avatarCY = 1160;
  const avatarR = 44;
  let drewAvatar = false;
  if (input.avatarUrl) {
    try {
      const avatar = await loadImage(input.avatarUrl, "anonymous");
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
      ctx.clip();
      const side = Math.min(avatar.width, avatar.height);
      ctx.drawImage(
        avatar,
        (avatar.width - side) / 2,
        (avatar.height - side) / 2,
        side,
        side,
        avatarCX - avatarR,
        avatarCY - avatarR,
        avatarR * 2,
        avatarR * 2,
      );
      ctx.restore();
      drewAvatar = true;
    } catch {
      /* initial-letter fallback below */
    }
  }
  if (!drewAvatar) {
    ctx.fillStyle = "#1c1c1f";
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    fitFont(ctx, input.displayName.charAt(0).toUpperCase(), 52, DISPLAY, 700, 60);
    ctx.fillText(input.displayName.charAt(0).toUpperCase(), avatarCX, avatarCY + 18);
  }
  ctx.strokeStyle = "#2a2a2e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = CREAM;
  fitFont(ctx, input.displayName, 48, SANS, 700, 700);
  ctx.fillText(input.displayName, W / 2, 1245);
  ctx.fillStyle = MUTED;
  ctx.font = `400 38px ${SANS}`;
  ctx.fillText(`@${input.username}`, W / 2, 1290);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't render the image.");
  return blob;
}

export async function shareBadgePng(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "My RIZZ badge" });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
