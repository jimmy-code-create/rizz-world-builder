import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, PawPrint, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePurify } from "@/lib/purify";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { fixCommonTypos, hasKnownTypo } from "@/lib/text-fix";
import { cancelFee, postPawsBounty, useBountyRules } from "@/lib/bounties";

/** Deadline shortcuts; the hours field stays open for anything else. */
const DEADLINES = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "1d" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
];

type Mode = "prize" | "open";

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
 * The dialog shows the escrow arithmetic before anything is charged: what
 * leaves the wallet now, what the cancel fee would be, and what the poster
 * keeps if they back out.
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
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const balance = Number(profile?.paw_balance ?? 0);
  const prizeValue = Math.max(0, Math.round(Number(prize) || 0));
  const fee = cancelFee(prizeValue, false, rules ?? undefined);
  const takenFee = cancelFee(prizeValue, true, rules ?? undefined);
  const canPostPrize = purify.active;

  const upload = async (): Promise<string | null> => {
    if (!file || !user) return null;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("drops").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("drops").getPublicUrl(path).data.publicUrl;
  };

  const reset = () => {
    setTitle("");
    setDesc("");
    setRequirements("");
    setFile(null);
  };

  const submit = async () => {
    if (!user || !title.trim() || busy) return;
    setBusy(true);
    try {
      const media_url = await upload();
      if (mode === "prize") {
        if (!canPostPrize) throw new Error("Paws bounties are a Purify perk.");
        const posted = await postPawsBounty({
          title,
          description: desc,
          requirements,
          prize: prizeValue,
          hours,
          mediaUrl: media_url,
        });
        toast.success(`${formatNumber(posted.prize)} Paws locked in escrow`, {
          description: "They pay out the moment you approve the work.",
        });
      } else {
        const { error } = await supabase.from("drops").insert({
          creator_id: user.id,
          title: title.trim(),
          description: desc.trim() || null,
          claim_limit: limit,
          expires_at: new Date(Date.now() + hours * 3.6e6).toISOString(),
          media_url,
        });
        if (error) throw error;
        toast.success("Open call is live 🚀");
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

  const shortfall = mode === "prize" ? prizeValue - balance : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Post a bounty</DialogTitle>
        </DialogHeader>

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

        <div className="space-y-3">
          <Input
            placeholder="What needs doing?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            className="glass border-white/10"
          />
          {hasKnownTypo(title) && (
            <button
              type="button"
              onClick={() => setTitle(fixCommonTypos(title))}
              className="-mt-1 text-left text-[11px] text-primary hover:underline"
            >
              Did you mean “{fixCommonTypos(title)}”?
            </button>
          )}

          <Textarea
            placeholder={
              mode === "prize"
                ? "Describe the job — what does finished look like?"
                : "Hype it up"
            }
            value={desc}
            onChange={(event) => setDesc(event.target.value)}
            maxLength={280}
            className="glass border-white/10"
          />

          {mode === "prize" && (
            <>
              <Textarea
                placeholder="Proof you expect (a link, a screenshot, a build…)"
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                maxLength={280}
                className="glass border-white/10"
              />

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

              {/* The receipt, before anything is charged. */}
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.055] p-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-bold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {formatNumber(Math.max(prizeValue, 0))} Paws move to escrow now
                </p>
                <p className="text-muted-foreground">
                  Wallet after posting: {formatNumber(Math.max(balance - prizeValue, 0))} Paws.
                  The prize leaves your balance the second the bounty goes live and is released
                  only when you approve the work.
                </p>
                <p className="text-muted-foreground">
                  Cancel before anyone takes it and {formatNumber(fee)} Paws is kept as the fee —
                  {" "}
                  {formatNumber(takenFee)} once somebody is working on it.
                </p>
                {shortfall > 0 && (
                  <p className="font-semibold text-[#ff5d5d]">
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
          )}

          {mode === "open" && (
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
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full glass border-white/10"
          >
            {file ? `📎 ${file.name}` : "Add a cover image (optional)"}
          </Button>

          <Button
            onClick={() => void submit()}
            disabled={
              busy || !title.trim() || (mode === "prize" && (!canPostPrize || shortfall > 0))
            }
            className="w-full bg-primary text-primary-foreground border-0 shadow-md"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {mode === "prize" ? `Lock ${formatNumber(prizeValue)} Paws & post` : "Launch open call"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
