import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Hash,
  ImagePlus,
  Loader2,
  Palette,
  PawPrint,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePurify } from "@/lib/purify";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { fixCommonTypos } from "@/lib/text-fix";
import { compressChatImage, prepareChatImagePreview } from "@/lib/chat-media";
import {
  CANCEL_FEE,
  MIN_TRUST_LABEL,
  MIN_TRUST_OPTIONS,
  PROOF_TYPE_LABEL,
  PROOF_TYPE_OPTIONS,
  cancelFee,
  feeRecipientLabel,
  postPawsBounty,
  useBountyRules,
} from "@/lib/bounties";
import type { MinTrustLevel, ProofType } from "@/lib/bounties";

/** Deadline shortcuts; the hours field stays open for anything else. */
const DEADLINES = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "1d" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
];

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 24;
const MAX_COVER_BYTES = 15 * 1024 * 1024;
const DEFAULT_BOUNTY_HEADING_COLOR = "#f2efe6";

/** Bright enough to read on the dark card; the custom picker can go further. */
const HEADING_COLORS = [
  { value: DEFAULT_BOUNTY_HEADING_COLOR, label: "Cream" },
  { value: "#c8ff3d", label: "Lime" },
  { value: "#ff5fa2", label: "Pink" },
  { value: "#7dd3fc", label: "Sky" },
  { value: "#fbbf24", label: "Gold" },
  { value: "#b794f6", label: "Violet" },
  { value: "#34d399", label: "Mint" },
  { value: "#fb7185", label: "Coral" },
];

const SUGGESTED_TAGS = [
  "design",
  "dev",
  "writing",
  "video",
  "music",
  "marketing",
  "research",
  "gaming",
  "memes",
  "community",
];

const selectClass =
  "min-h-10 w-full rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm text-foreground";

type Mode = "prize" | "open";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeBountyTag(value: string): string {
  return value
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH);
}

/** PostgREST reports a column the live schema does not have yet. */
function missingPresentationColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /heading_color|['"]tags['"]|column .*does not exist|schema cache/i.test(
    error.message ?? "",
  );
}

/**
 * Two ways to post a bounty, because they are two different things:
 *
 *  - **Paws prize** — the poster's own Paws are locked in escrow and paid to
 *    whoever finishes the task and gets approved. This is the feature that
 *    makes a bounty a contract rather than a giveaway, and it is what Purify
 *    members get to post.
 *  - **Open call** — the free version that has always existed: anybody can
 *    claim it and the flat reward is paid on claim.
 *
 * Both share the same presentation controls now: up to five Reddit-style tags,
 * a heading colour, and a cover image with a live card preview. The dialog
 * shows the escrow arithmetic before anything is charged: what leaves the
 * wallet now, what the cancel fee would be, and what the poster keeps if they
 * back out.
 */
export function PostBountyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const purify = usePurify();
  const rulesQ = useBountyRules();
  const rules = rulesQ.data ?? undefined;
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("prize");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [requirements, setRequirements] = useState("");
  const [prize, setPrize] = useState("100");
  const [hours, setHours] = useState(72);
  const [limit, setLimit] = useState(100);
  const [busy, setBusy] = useState(false);
  const [preparingCover, setPreparingCover] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [premiumOnly, setPremiumOnly] = useState(true);
  const [proofType, setProofType] = useState<ProofType>("any");
  const [minTrust, setMinTrust] = useState<MinTrustLevel>("any");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [headingColor, setHeadingColor] = useState(DEFAULT_BOUNTY_HEADING_COLOR);
  const fileRef = useRef<HTMLInputElement>(null);

  const balance = Number(profile?.paw_balance ?? 0);
  const prizeValue = Math.max(0, Math.round(Number(prize) || 0));
  const fee = cancelFee(prizeValue, false, rules ?? undefined);
  const takenFee = cancelFee(prizeValue, true, rules ?? undefined);
  const canPostPrize = purify.active;
  const shortfall = mode === "prize" ? prizeValue - balance : 0;
  const titleColor = HEX_COLOR.test(headingColor) ? headingColor : DEFAULT_BOUNTY_HEADING_COLOR;

  // Object URLs are per-selection. Revoke the old one whenever the preview
  // changes and when the dialog unmounts, so a phone does not keep a full-size
  // photo in memory while the member writes the post.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickCover = async (picked: File | null) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Choose an image file for the cover.");
      return;
    }
    if (picked.size === 0) {
      toast.error("That image is empty. Pick another one.");
      return;
    }
    if (picked.size > MAX_COVER_BYTES) {
      toast.error("Cover images must be under 15 MB before compression.");
      return;
    }
    setPreparingCover(true);
    try {
      // Decode the original once, then preview the compressed result. This is
      // the same memory guard the DM and group composers use after a picker.
      const preview = await prepareChatImagePreview(picked);
      setFile(picked);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return preview;
      });
    } catch {
      toast.error("That cover couldn't be prepared. Try a JPG or PNG.");
    } finally {
      setPreparingCover(false);
    }
  };

  const removeCover = () => {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const upload = async (): Promise<string | null> => {
    if (!file || !user) return null;
    let blob: Blob;
    try {
      blob = await compressChatImage(file);
    } catch {
      throw new Error("That cover couldn't be prepared. Try a JPG or PNG under 15 MB.");
    }
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("drops")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      if (/too large|exceeded|payload/i.test(error.message)) {
        throw new Error("That cover was rejected for size. Try a smaller image.");
      }
      throw error;
    }
    return supabase.storage.from("drops").getPublicUrl(path).data.publicUrl;
  };

  const addTag = (raw: string) => {
    const tag = normalizeBountyTag(raw);
    if (!tag) return;
    if (tags.includes(tag)) {
      setTagInput("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      toast.info(`Keep it to ${MAX_TAGS} tags.`);
      return;
    }
    setTags((current) => [...current, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  };

  const onTagInputChange = (value: string) => {
    if (!value.includes(",")) {
      setTagInput(value);
      return;
    }
    // Pasting "design, video, memes" should become three chips, not one string.
    const pieces = value.split(",");
    const remainder = pieces.pop() ?? "";
    const next = [...tags];
    for (const piece of pieces) {
      const tag = normalizeBountyTag(piece);
      if (!tag || next.includes(tag)) continue;
      if (next.length >= MAX_TAGS) {
        toast.info(`Keep it to ${MAX_TAGS} tags.`);
        break;
      }
      next.push(tag);
    }
    setTags(next);
    setTagInput(remainder);
  };

  const reset = () => {
    setMode("prize");
    setTitle("");
    setDesc("");
    setRequirements("");
    setPrize("100");
    setHours(72);
    setLimit(100);
    setPremiumOnly(true);
    setProofType("any");
    setMinTrust("any");
    setTags([]);
    setTagInput("");
    setHeadingColor(DEFAULT_BOUNTY_HEADING_COLOR);
    removeCover();
  };

  const submit = async () => {
    if (!user || !title.trim() || busy) return;
    setBusy(true);
    try {
      const media_url = await upload();
      const cleanTags = tags.slice(0, MAX_TAGS);
      if (mode === "prize") {
        if (!canPostPrize) throw new Error("Paws bounties are a Purify perk.");
        const posted = await postPawsBounty({
          title,
          description: desc,
          requirements,
          prize: prizeValue,
          hours,
          mediaUrl: media_url,
          premiumOnly,
          proofType,
          minTrust,
          tags: cleanTags,
          headingColor: titleColor,
        });
        toast.success(`${formatNumber(posted.prize)} Paws locked in escrow`, {
          description: "They pay out the moment you approve the work.",
        });
      } else {
        const base = {
          creator_id: user.id,
          title: title.trim(),
          description: desc.trim() || null,
          requirements: requirements.trim() || null,
          claim_limit: limit,
          expires_at: new Date(Date.now() + hours * 3.6e6).toISOString(),
          media_url,
        };
        let result = await supabase.from("drops").insert({
          ...base,
          tags: cleanTags,
          heading_color: titleColor,
        });
        let droppedTags = false;
        let droppedHeading = false;
        if (result.error && missingPresentationColumn(result.error)) {
          // The deployment may still be behind the migration. Retry with
          // whichever columns the live schema actually has, then fall back to
          // the plain open call rather than losing the post entirely.
          const message = result.error.message ?? "";
          const retry = {
            ...base,
            ...(message.includes("tags") ? {} : { tags: cleanTags }),
            ...(message.includes("heading_color") ? {} : { heading_color: titleColor }),
          };
          droppedTags = !("tags" in retry);
          droppedHeading = !("heading_color" in retry);
          result = await supabase.from("drops").insert(retry);
          if (result.error && missingPresentationColumn(result.error)) {
            droppedTags = droppedTags || "tags" in retry;
            droppedHeading = droppedHeading || "heading_color" in retry;
            result = await supabase.from("drops").insert(base);
          }
        }
        if (result.error) throw result.error;
        const missingPresentation = [
          droppedTags ? "tags" : null,
          droppedHeading ? "heading colour" : null,
        ]
          .filter(Boolean)
          .join(" and ");
        toast.success(
          "Open call is live 🚀",
          missingPresentation
            ? {
                description: `The ${missingPresentation} will show after the bounty database update.`,
              }
            : undefined,
        );
      }
      await Promise.all([
        refreshProfile(),
        qc.invalidateQueries({ queryKey: ["drops"] }),
        qc.invalidateQueries({ queryKey: ["paw-ledger", user.id] }),
      ]);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't post that bounty");
    } finally {
      setBusy(false);
    }
  };

  const suggested = SUGGESTED_TAGS.filter((tag) => !tags.includes(tag)).slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A phone-height form: the dialog scrolls inside the viewport instead of
          growing past it, and the last control clears the home indicator. */}
      <DialogContent className="glass-strong max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain border-white/10 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Post a bounty</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Give the crew a clear job, a fair prize, and a look that stops the scroll.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* A small live preview: the same title colour, tags and cover the
              board will show, before any Paws leave the wallet. */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {preparingCover ? (
                  <div className="grid h-full place-items-center text-primary">
                    <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{mode === "prize" ? "Paws prize" : "Open call"}</span>
                  <span>·</span>
                  <span>
                    {mode === "prize" ? `${formatNumber(prizeValue)} Paws` : "25 Paws / claim"}
                  </span>
                </div>
                <p
                  className="mt-1 line-clamp-2 font-display text-lg font-bold leading-tight"
                  style={{ color: titleColor, textShadow: `0 0 24px ${titleColor}33` }}
                >
                  {fixCommonTypos(title.trim()) || "Your bounty title"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-primary/25 bg-primary/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                      >
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-muted-foreground">#add-a-tag</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { id: "prize" as Mode, label: "Paws prize", icon: PawPrint },
                { id: "open" as Mode, label: "Open call", icon: Sparkles },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                aria-pressed={mode === tab.id}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${
                  mode === tab.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="bounty-title">
                Title
              </label>
              <span className="text-[10px] text-muted-foreground">{title.length}/80</span>
            </div>
            <Input
              id="bounty-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                mode === "prize" ? "Design a logo for my cat brand" : "Review my landing page copy"
              }
              maxLength={80}
              className="glass border-white/10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="bounty-desc">
              Description
            </label>
            <Textarea
              id="bounty-desc"
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="What should they make, and what does success look like?"
              className="glass min-h-20 resize-y border-white/10"
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="bounty-requirements">
              Requirements
            </label>
            <Textarea
              id="bounty-requirements"
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
              placeholder="File type, dimensions, must-haves — anything they need to know upfront."
              className="glass min-h-16 resize-y border-white/10"
              maxLength={2000}
            />
          </div>

          {mode === "prize" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-prize">
                    Prize (Paws)
                  </label>
                  <Input
                    id="bounty-prize"
                    type="number"
                    inputMode="numeric"
                    value={prize}
                    onChange={(event) => setPrize(event.target.value)}
                    min={rules?.minPrize ?? 25}
                    max={rules?.maxPrize ?? 250_000}
                    className="glass border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-hours">
                    Deadline (hours)
                  </label>
                  <Input
                    id="bounty-hours"
                    type="number"
                    inputMode="numeric"
                    value={hours}
                    onChange={(event) => setHours(+event.target.value)}
                    min={rules?.minHours ?? 1}
                    max={rules?.maxHours ?? 720}
                    className="glass border-white/10"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DEADLINES.map((option) => (
                  <button
                    key={option.hours}
                    type="button"
                    onClick={() => setHours(option.hours)}
                    aria-pressed={hours === option.hours}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      hours === option.hours
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-proof">
                    Proof wanted
                  </label>
                  <select
                    id="bounty-proof"
                    value={proofType}
                    onChange={(event) => setProofType(event.target.value as ProofType)}
                    className={selectClass}
                  >
                    {PROOF_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {PROOF_TYPE_LABEL[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-trust">
                    Who can take it
                  </label>
                  <select
                    id="bounty-trust"
                    value={minTrust}
                    onChange={(event) => setMinTrust(event.target.value as MinTrustLevel)}
                    className={selectClass}
                  >
                    {MIN_TRUST_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {MIN_TRUST_LABEL[level]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold">Premium takers only</p>
                  <p className="text-[11px] text-muted-foreground">
                    Purify members can take every bounty. This pins the badge to the card so it is
                    obvious.
                  </p>
                </div>
                <Switch
                  checked={premiumOnly}
                  onCheckedChange={setPremiumOnly}
                  aria-label="Premium takers only"
                />
              </div>

              {/* The receipt, before anything is charged. */}
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.055] p-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-bold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {formatNumber(Math.max(prizeValue, 0))} Paws move to escrow now
                </p>
                <p className="text-muted-foreground">
                  Wallet after posting: {formatNumber(Math.max(balance - prizeValue, 0))} Paws. The
                  prize leaves your balance the second the bounty goes live and is released only
                  when you approve the work.
                </p>
                <p className="text-muted-foreground">
                  Cancel before anyone takes it and {formatNumber(fee)} Paws is kept as the fee, or{" "}
                  {formatNumber(takenFee)} once somebody is working on it.
                </p>
                <p className="text-muted-foreground">
                  A taker who hands it back or misses the deadline pays {formatNumber(CANCEL_FEE)}{" "}
                  Paws; it goes to {feeRecipientLabel(rules?.feeRecipient ?? "creator")}.
                </p>
                {shortfall > 0 && (
                  <p className="font-semibold text-destructive">
                    You need {formatNumber(shortfall)} more Paws for this prize.
                  </p>
                )}
                {!canPostPrize && (
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Escrow bounties are a Purify perk.
                    <Link to="/purify" className="text-primary hover:underline">
                      Get Purify
                    </Link>
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-limit">
                    Claim limit
                  </label>
                  <Input
                    id="bounty-limit"
                    type="number"
                    inputMode="numeric"
                    value={limit}
                    onChange={(event) => setLimit(+event.target.value)}
                    min={1}
                    max={10000}
                    className="glass border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="bounty-open-hours">
                    Duration (hours)
                  </label>
                  <Input
                    id="bounty-open-hours"
                    type="number"
                    inputMode="numeric"
                    value={hours}
                    onChange={(event) => setHours(+event.target.value)}
                    min={1}
                    max={720}
                    className="glass border-white/10"
                  />
                </div>
              </div>
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-muted-foreground">
                Open calls pay 25 Paws per claim and need no escrow. Anyone can post one.
              </p>
            </>
          )}

          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tags
              </p>
              <span className="text-[10px] text-muted-foreground">
                {tags.length}/{MAX_TAGS}
              </span>
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/[0.08] px-2 py-1 text-[11px] font-bold text-primary"
                >
                  <Hash className="h-3 w-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag} tag`}
                    className="rounded p-0.5 text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag(tagInput);
                  } else if (event.key === "Backspace" && !tagInput && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                placeholder={tags.length ? "Add another…" : "Type a tag and press Enter"}
                maxLength={MAX_TAG_LENGTH + 1}
                className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            {suggested.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Up to {MAX_TAGS}. Anyone can tag a bounty; tags help the right people find it.
            </p>
          </div>

          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Heading colour
              </p>
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {HEADING_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setHeadingColor(color.value)}
                  aria-label={`Heading colour ${color.label}`}
                  aria-pressed={titleColor.toLowerCase() === color.value}
                  title={color.label}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 transition-transform active:scale-95 ${
                    titleColor.toLowerCase() === color.value
                      ? "border-foreground/80 ring-2 ring-primary/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  style={{ backgroundColor: color.value }}
                >
                  {titleColor.toLowerCase() === color.value && (
                    <Check className="h-4 w-4 text-black/70" strokeWidth={3} />
                  )}
                </button>
              ))}
              <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                <Palette className="h-3.5 w-3.5" />
                Custom
                <input
                  type="color"
                  value={titleColor}
                  onChange={(event) => {
                    if (HEX_COLOR.test(event.target.value)) setHeadingColor(event.target.value);
                  }}
                  className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Custom heading colour"
                />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              This is the title colour on the bounty card. Bright shades read best on the dark card.
            </p>
          </div>

          <div className="space-y-2 border-t border-white/5 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Cover image
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void pickCover(event.target.files?.[0] ?? null);
                // Allow picking the same file again after removing it.
                event.currentTarget.value = "";
              }}
            />
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                <img
                  src={previewUrl}
                  alt="Bounty cover"
                  className="aspect-video w-full object-cover"
                />
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="h-8 border-white/20 bg-black/55 text-xs font-bold backdrop-blur hover:bg-black/70"
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={removeCover}
                    aria-label="Remove cover image"
                    className="h-8 w-8 border-white/20 bg-black/55 backdrop-blur hover:bg-destructive/30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={preparingCover}
                className="w-full glass border-white/10"
              >
                {preparingCover ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {preparingCover ? "Preparing image…" : "Add a cover image (optional)"}
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">
              Images are compressed before upload. You can remove or replace one any time before
              posting.
            </p>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-white/10 bg-background/95 px-6 py-4 backdrop-blur">
            <Button
              onClick={() => void submit()}
              disabled={
                busy ||
                preparingCover ||
                !title.trim() ||
                (mode === "prize" && (!canPostPrize || shortfall > 0))
              }
              className="w-full bg-primary text-primary-foreground border-0 shadow-md"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {mode === "prize"
                    ? `Lock ${formatNumber(prizeValue)} Paws & post`
                    : "Launch open call"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
