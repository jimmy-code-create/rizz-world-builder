import type { ProfileEffect, ProfileEffectType } from "@/lib/effects";

export type EffectOrder = {
  id: string;
  /** ISO timestamp of the purchase. */
  date: string;
  account: string;
  effect: Pick<ProfileEffect, "name" | "slug" | "type" | "rarity" | "paw_price">;
  amount: number;
  balanceAfter: number;
};

const SLOT_LABEL: Record<ProfileEffectType, string> = {
  avatar_decoration: "Avatar decoration",
  profile_effect: "Banner effect",
  profile_frame: "Profile frame",
};

/** A short, readable order id — e.g. RZ-7K2M-4Q9X. */
export function newOrderId(now = Date.now()): string {
  const base = now.toString(36).toUpperCase().padStart(8, "0").slice(-8);
  return `RZ-${base.slice(0, 4)}-${base.slice(4)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} Paws`;
}

function niceDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function receiptLines(order: EffectOrder): Array<[string, string]> {
  return [
    ["Order", order.id],
    ["Date", niceDate(order.date)],
    ["Account", order.account],
    ["Item", order.effect.name],
    ["Slot", SLOT_LABEL[order.effect.type]],
    ["Rarity", order.effect.rarity],
    ["Payment", "Paws balance"],
    ["Unit price", money(order.amount)],
    ["Total paid", money(order.amount)],
    ["Balance after", money(order.balanceAfter)],
    ["Status", "Paid · equipped"],
  ];
}

/** Plain text fallback for people who want something they can paste. */
export function buildReceiptText(order: EffectOrder): string {
  const width = 54;
  const line = "─".repeat(width);
  const rows = receiptLines(order)
    .map(([label, value]) => `${label.padEnd(14)} ${value}`)
    .join("\n");
  return [
    "RIZZ · COSMETICS RECEIPT",
    line,
    rows,
    line,
    "Paid with Paws. No card was charged.",
    `Issued ${niceDate(order.date)} · rizz.app`,
  ].join("\n");
}

/** A self-contained receipt page, ready to save, print or email. */
export function buildReceiptHtml(order: EffectOrder): string {
  const rows = receiptLines(order)
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RIZZ receipt ${escapeHtml(order.id)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 18px; background: #0a0a0b; color: #f2efe6; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .receipt { width: min(440px, 100%); border: 1px solid #2a2a2e; border-radius: 22px; background: linear-gradient(160deg, #17171a, #101012 62%); padding: 26px; box-shadow: 0 28px 80px -40px #000; }
  .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid #2a2a2e; }
  .mark { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; letter-spacing: .12em; font-size: 12px; color: #c9ff3d; }
  .mark span { width: 9px; height: 9px; border-radius: 999px; background: #c9ff3d; box-shadow: 0 0 14px #c9ff3d; }
  .paid { border: 1px solid #3f5d12; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #d7ff71; background: #1b2409; }
  h1 { margin: 22px 0 2px; font-size: 22px; letter-spacing: -0.02em; }
  .sub { margin: 0 0 18px; color: #a9a69c; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #232327; }
  tr:last-child { border: 0; }
  th, td { padding: 9px 0; text-align: left; font-size: 12.5px; }
  th { color: #8e8b83; font-weight: 500; width: 42%; }
  td { text-align: right; font-weight: 600; }
  .total { margin-top: 16px; border: 1px solid #33420f; border-radius: 14px; background: #182007; padding: 14px; display: flex; align-items: center; justify-content: space-between; }
  .total small { display: block; color: #a9a69c; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: .1em; }
  .total b { color: #c9ff3d; font-size: 18px; }
  footer { margin-top: 18px; color: #77746d; font-size: 10.5px; line-height: 1.6; }
  @media print { body { background: #fff; color: #111; } .receipt { border-color: #ddd; background: #fff; box-shadow: none; } th { color: #666; } .sub, footer { color: #666; } .paid { border-color: #b8d77e; color: #36520a; background: #f0f7df; } .total { border-color: #c8dda2; background: #f7faef; } .total b { color: #36520a; } }
</style>
</head>
<body>
  <main class="receipt">
    <div class="brand">
      <div class="mark"><span></span> RIZZ</div>
      <div class="paid">Paid</div>
    </div>
    <h1>Cosmetics receipt</h1>
    <p class="sub">${escapeHtml(order.effect.name)} · ${escapeHtml(SLOT_LABEL[order.effect.type])}</p>
    <table><tbody>${rows}</tbody></table>
    <div class="total">
      <div><small>Total paid</small><b>${escapeHtml(money(order.amount))}</b></div>
      <div style="text-align:right"><small>Balance after</small><b>${escapeHtml(money(order.balanceAfter))}</b></div>
    </div>
    <footer>
      Paid from your Paws balance. No card was charged. This receipt was issued by RIZZ
      for order ${escapeHtml(order.id)}. The look is equipped on your profile immediately.
    </footer>
  </main>
</body>
</html>`;
}

function triggerDownload(name: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser start reading the blob before it is revoked.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function receiptFilename(order: EffectOrder, extension: "html" | "txt"): string {
  return `rizz-${order.id.toLowerCase()}-${order.effect.slug.replace(/^fx-/, "")}.${extension}`;
}

export function downloadReceipt(order: EffectOrder): void {
  triggerDownload(receiptFilename(order, "html"), buildReceiptHtml(order), "text/html;charset=utf-8");
}

export function downloadReceiptText(order: EffectOrder): void {
  triggerDownload(receiptFilename(order, "txt"), buildReceiptText(order), "text/plain;charset=utf-8");
}

const STORE_PREFIX = "rizz.effect-receipts.";

/** Recent receipts survive a reload, so the order is still downloadable later. */
export function loadStoredReceipts(userId: string | null | undefined): EffectOrder[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EffectOrder[];
    return Array.isArray(parsed) ? parsed.filter((order) => order && order.id && order.effect) : [];
  } catch {
    return [];
  }
}

export function storeReceipt(userId: string | null | undefined, order: EffectOrder): EffectOrder[] {
  if (!userId) return [];
  const next = [order, ...loadStoredReceipts(userId).filter((item) => item.id !== order.id)].slice(0, 12);
  try {
    localStorage.setItem(`${STORE_PREFIX}${userId}`, JSON.stringify(next));
  } catch {}
  return next;
}
