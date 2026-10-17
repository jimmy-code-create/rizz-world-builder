/**
 * Premium, locally-rendered badge share cards. Canvas keeps this private,
 * instant, and free of image-generation API calls; it produces a portrait PNG
 * sized for Instagram stories and direct-message sharing.
 */
export type ShareBadgeInput = {
  badgeName: string;
  flavor: string;
  slug: string;
  tier: string;
  glow: string;
  unlockedAt: string | null;
  earned?: boolean;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  artUrl?: string;
};

const W = 1080;
const H = 1350;
const CREAM = "#f4f3ee";
const MUTED = "#a0a1a8";
const INK = "#080a0e";
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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  base: number,
  family: string,
  weight: number,
  maxWidth: number,
) {
  let size = base;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  while (size > 24) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = `${color}18`;
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export async function buildBadgeSharePng(input: ShareBadgeInput): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`700 100px ${DISPLAY}`),
      document.fonts.load(`400 44px ${SANS}`),
      document.fonts.load(`700 48px ${SANS}`),
    ]);
  } catch {
    // System fonts are a good fallback if the app font has not loaded yet.
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available here.");

  // Deep ink backdrop with a slow, polished tier-colored light bloom.
  const backdrop = ctx.createLinearGradient(0, 0, W, H);
  backdrop.addColorStop(0, "#080a0e");
  backdrop.addColorStop(0.54, "#11141b");
  backdrop.addColorStop(1, "#08090c");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, W, H);
  const bloom = ctx.createRadialGradient(W / 2, 405, 20, W / 2, 405, 540);
  bloom.addColorStop(0, `${input.glow}3b`);
  bloom.addColorStop(0.45, `${input.glow}16`);
  bloom.addColorStop(1, `${input.glow}00`);
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  // Subtle technical grid and floating specks add depth without fighting text.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 104; x < W; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, H - 80);
    ctx.stroke();
  }
  for (let y = 104; y < H; y += 72) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();
  }
  ctx.restore();
  for (const [x, y, r] of [
    [153, 313, 3],
    [899, 267, 2],
    [923, 574, 3],
    [171, 634, 2],
    [861, 1007, 2],
  ] as const) {
    ctx.fillStyle = `${input.glow}b0`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine double frame.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  roundRectPath(ctx, 42, 42, W - 84, H - 84, 44);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  roundRectPath(ctx, 55, 55, W - 110, H - 110, 36);
  ctx.stroke();

  // Header lockup.
  ctx.textAlign = "left";
  ctx.fillStyle = LIME;
  ctx.font = `700 42px ${DISPLAY}`;
  ctx.fillText("RIZZ", 102, 138);
  ctx.fillStyle = MUTED;
  ctx.font = `700 20px ${SANS}`;
  ctx.fillText("THE BADGE DROP", 106, 171);
  drawPill(ctx, 726, 102, 252, 54, input.glow);
  ctx.textAlign = "center";
  ctx.fillStyle = input.glow;
  ctx.font = `700 19px ${SANS}`;
  ctx.fillText("OFFICIAL COLLECTION", 852, 137);

  // Layered medallion mount.
  const cx = W / 2;
  const cy = 430;
  ctx.save();
  ctx.shadowColor = `${input.glow}66`;
  ctx.shadowBlur = 64;
  ctx.fillStyle = "#0b0d12";
  ctx.beginPath();
  ctx.arc(cx, cy, 212, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${input.glow}88`;
  ctx.beginPath();
  ctx.arc(cx, cy, 212, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.beginPath();
  ctx.arc(cx, cy, 195, 0, Math.PI * 2);
  ctx.stroke();
  const mount = ctx.createRadialGradient(cx - 45, cy - 65, 10, cx, cy, 187);
  mount.addColorStop(0, `${input.glow}20`);
  mount.addColorStop(1, "#0b0d12");
  ctx.fillStyle = mount;
  ctx.beginPath();
  ctx.arc(cx, cy, 184, 0, Math.PI * 2);
  ctx.fill();

  let drewArt = false;
  const artUrl = input.artUrl ?? `/badges/${input.slug}.png`;
  try {
    const art = await loadImage(artUrl);
    ctx.save();
    ctx.shadowColor = `${input.glow}a0`;
    ctx.shadowBlur = 40;
    ctx.drawImage(art, cx - 174, cy - 174, 348, 348);
    ctx.restore();
    drewArt = true;
  } catch {
    // A missing art file never prevents sharing; draw a clean monogram medallion.
  }
  if (!drewArt) {
    ctx.fillStyle = input.glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    fitFont(ctx, input.badgeName.charAt(0).toUpperCase(), 120, DISPLAY, 700, 180);
    ctx.fillText(input.badgeName.charAt(0).toUpperCase(), cx, cy + 42);
  }

  // Badge title and tier treatment.
  ctx.fillStyle = CREAM;
  fitFont(ctx, input.badgeName, 86, DISPLAY, 700, 880);
  ctx.fillText(input.badgeName, cx, 720);
  const tierText = input.tier.toUpperCase();
  ctx.font = `700 22px ${SANS}`;
  const tierWidth = Math.max(162, ctx.measureText(tierText).width + 58);
  drawPill(ctx, cx - tierWidth / 2, 755, tierWidth, 52, input.glow);
  ctx.fillStyle = input.glow;
  ctx.textAlign = "center";
  ctx.font = `700 20px ${SANS}`;
  ctx.fillText(tierText, cx, 788);

  ctx.fillStyle = MUTED;
  ctx.font = `400 32px ${SANS}`;
  wrapLines(ctx, input.flavor, 790).forEach((line, index) => {
    ctx.fillText(line, cx, 865 + index * 43);
  });

  // Earned / locked status is explicit, so the card never implies a locked badge is owned.
  const isEarned = input.earned ?? Boolean(input.unlockedAt);
  const statusText = isEarned
    ? `UNLOCKED  ·  ${new Date(input.unlockedAt!).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
    : "LOCKED  ·  KEEP SHOWING UP";
  const statusColor = isEarned ? LIME : "#b0b2bb";
  const statusWidth = 445;
  drawPill(ctx, cx - statusWidth / 2, 954, statusWidth, 58, statusColor);
  ctx.fillStyle = statusColor;
  ctx.font = `700 20px ${SANS}`;
  ctx.fillText(statusText, cx, 991);

  // Owner card.
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 106, 1062, 868, 148, 30);
  ctx.fill();
  ctx.stroke();
  const avatarCX = 184;
  const avatarCY = 1136;
  const avatarR = 43;
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
      /* Initial fallback below handles cross-origin avatars. */
    }
  }
  if (!drewAvatar) {
    ctx.fillStyle = "#20242d";
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    fitFont(ctx, input.displayName.charAt(0).toUpperCase(), 48, DISPLAY, 700, 58);
    ctx.fillText(input.displayName.charAt(0).toUpperCase(), avatarCX, avatarCY + 17);
  }
  ctx.strokeStyle = `${input.glow}99`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = CREAM;
  fitFont(ctx, input.displayName, 37, SANS, 700, 650);
  ctx.fillText(input.displayName, 254, 1128);
  ctx.fillStyle = MUTED;
  ctx.font = `400 25px ${SANS}`;
  ctx.fillText(`@${input.username}`, 254, 1172);
  ctx.textAlign = "right";
  ctx.fillStyle = input.glow;
  ctx.font = `700 16px ${SANS}`;
  ctx.fillText("RIZZ MEMBER", 936, 1170);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(244,243,238,0.48)";
  ctx.font = `700 17px ${SANS}`;
  ctx.fillText("SHOW UP. STAND OUT.", cx, 1270);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't render the image.");
  return blob;
}

export async function shareBadgePng(
  blob: Blob,
  filename: string,
): Promise<"shared" | "downloaded"> {
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
