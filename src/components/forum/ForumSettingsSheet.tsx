import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Layers,
  Loader2,
  Palette,
  Plus,
  Save,
  SmilePlus,
  Tags,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForumHero } from "@/components/forum/ForumHero";
import { ForumPostCard } from "@/components/forum/ForumPostCard";
import {
  deleteForumStatus,
  deleteForumTag,
  deleteForumTemplate,
  forumSaveSettings,
  saveForumStatus,
  saveForumTag,
  saveForumTemplate,
  uploadForumAttachment,
  type ForumConfig,
  type ForumPost,
  type ForumStatus,
  type ForumTag,
  type ForumTemplate,
} from "@/lib/forums";
import type { ForumTemplateField } from "@/lib/forum-content";
import type { ForumDensity, ForumLayout, ForumSort } from "@/lib/forum-prefs";
import { FORUM_SORTS } from "@/lib/forum-prefs";
import { cn } from "@/lib/utils";

/**
 * How each realm dresses its own forum.
 *
 * Every change is previewed live on the right with the *real* hero and card
 * components, so what a moderator sees here is literally what the forum renders.
 * Identity, defaults and posting rules save in one call; tags, statuses and
 * templates are rows, so each one saves on its own.
 */

const SLOWMODE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5, label: "5s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 900, label: "15m" },
  { value: 3600, label: "1h" },
  { value: 21600, label: "6h" },
];

const ARCHIVE_OPTIONS = [
  { value: null, label: "Never" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
];

const ATTACHMENT_KINDS = ["image", "video", "audio", "file", "link"] as const;
const REACTION_PRESETS = ["👍,❤️,🔥,😂,🎉,👀", "👍,👎,✅,❓,💡", "⭐,🔥,💯,🙌,🤝", "😀,😍,😮,😢,😡"];

type Draft = {
  banner_url: string;
  icon_emoji: string;
  accent_color: string;
  description: string;
  guidelines: string;
  default_layout: ForumLayout;
  default_sort: ForumSort;
  default_density: ForumDensity;
  require_tag: boolean;
  allowed_attachments: string[];
  reactions: string;
  slowmode_seconds: number;
  post_permission: "everyone" | "mods";
  reply_permission: "everyone" | "mods";
  auto_archive_days: number | null;
};

function toDraft(config: ForumConfig): Draft {
  return {
    banner_url: config.banner_url ?? "",
    icon_emoji: config.icon_emoji ?? "",
    accent_color: config.accent_color ?? "",
    description: config.description ?? "",
    guidelines: config.guidelines ?? "",
    default_layout: config.default_layout,
    default_sort: config.default_sort,
    default_density: config.default_density,
    require_tag: config.require_tag,
    allowed_attachments: config.allowed_attachments,
    reactions: config.reactions.join(","),
    slowmode_seconds: config.slowmode_seconds,
    post_permission: config.post_permission,
    reply_permission: config.reply_permission,
    auto_archive_days: config.auto_archive_days,
  };
}

/** A representative thread for the preview, built from the draft's own tags. */
function previewPost(tags: ForumTag[], statuses: ForumStatus[], draft: Draft): ForumPost {
  return {
    id: "preview",
    forum_id: "preview",
    realm_id: "preview",
    room_id: "preview",
    author_id: "preview",
    title: "How do I pin a thread to the top?",
    body: "Mark a thread as pinned and it stays above everything else.\n\n```\n/forum pin\n```",
    cover_url: null,
    attachments: [],
    tag_ids: tags.slice(0, 2).map((tag) => tag.id),
    status_id: statuses[0]?.id ?? null,
    template_id: null,
    fields: {},
    is_pinned: true,
    is_locked: false,
    is_solved: false,
    best_reply_id: null,
    reply_count: 12,
    like_count: 34,
    view_count: 210,
    last_activity_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    edited_at: null,
    archived_at: null,
    author: {
      id: "preview",
      username: "you",
      display_name: "A member",
      avatar_url: null,
      accent_color: null,
      created_at: new Date().toISOString(),
    },
    recent_repliers: [],
    reactions: [],
    liked: false,
    read_at: null,
    status: statuses[0] ?? null,
  };
}

export function ForumSettingsSheet({
  open,
  onOpenChange,
  config,
  tags,
  statuses,
  templates,
  realmName,
  roomId,
  roomName,
  userId,
  canModerate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ForumConfig;
  tags: ForumTag[];
  statuses: ForumStatus[];
  templates: ForumTemplate[];
  realmName: string;
  roomId: string;
  roomName: string;
  userId: string | null;
  canModerate: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(config));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // New tag / status / template forms.
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#38bdf8");
  const [tagEmoji, setTagEmoji] = useState("");
  const [statusName, setStatusName] = useState("");
  const [statusColor, setStatusColor] = useState("#22c55e");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [statusDefault, setStatusDefault] = useState(false);
  const [statusClosed, setStatusClosed] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateEmoji, setTemplateEmoji] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateFields, setTemplateFields] = useState<ForumTemplateField[]>([{ label: "", placeholder: "", required: true }]);

  useEffect(() => {
    if (open) setDraft(toDraft(config));
  }, [open, config]);

  const previewConfig = useMemo<ForumConfig>(
    () => ({
      ...config,
      ...draft,
      banner_url: draft.banner_url || null,
      icon_emoji: draft.icon_emoji || null,
      accent_color: draft.accent_color || null,
      description: draft.description || null,
      guidelines: draft.guidelines || null,
      reactions: draft.reactions.split(",").map((emoji) => emoji.trim()).filter(Boolean),
    }),
    [config, draft],
  );

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const save = () => {
    setSaving(true);
    void forumSaveSettings(roomId, {
      banner_url: draft.banner_url || null,
      icon_emoji: draft.icon_emoji || null,
      accent_color: draft.accent_color || null,
      description: draft.description || null,
      guidelines: draft.guidelines || null,
      default_layout: draft.default_layout,
      default_sort: draft.default_sort,
      default_density: draft.default_density,
      require_tag: draft.require_tag,
      allowed_attachments: draft.allowed_attachments,
      reactions: previewConfig.reactions,
      slowmode_seconds: draft.slowmode_seconds,
      post_permission: draft.post_permission,
      reply_permission: draft.reply_permission,
      auto_archive_days: draft.auto_archive_days,
    })
      .then(() => {
        toast.success("Forum settings saved");
        onSaved();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't save the forum"))
      .finally(() => setSaving(false));
  };

  const uploadBanner = (file: File | undefined) => {
    if (!file || !userId) return;
    setUploading(true);
    void uploadForumAttachment({ userId, file })
      .then((url) => patch({ banner_url: url }))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't upload that banner"))
      .finally(() => setUploading(false));
  };

  const addTag = () => {
    if (!tagName.trim()) return;
    setBusyRow("tag");
    void saveForumTag({
      forumId: config.id ?? "",
      name: tagName.trim().slice(0, 24),
      color: tagColor,
      emoji: tagEmoji.trim() || null,
      position: tags.length,
    })
      .then(() => {
        setTagName("");
        setTagEmoji("");
        toast.success("Tag added");
        onSaved();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't add that tag"))
      .finally(() => setBusyRow(null));
  };

  const addStatus = () => {
    if (!statusName.trim()) return;
    setBusyRow("status");
    void saveForumStatus({
      forumId: config.id ?? "",
      name: statusName.trim().slice(0, 24),
      color: statusColor,
      emoji: statusEmoji.trim() || null,
      position: statuses.length,
      isDefault: statusDefault,
      isClosed: statusClosed,
    })
      .then(() => {
        setStatusName("");
        setStatusEmoji("");
        setStatusDefault(false);
        setStatusClosed(false);
        toast.success("Status added");
        onSaved();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't add that status"))
      .finally(() => setBusyRow(null));
  };

  const addTemplate = () => {
    const fields = templateFields
      .map((field) => ({ ...field, label: field.label.trim() }))
      .filter((field) => field.label);
    if (!templateName.trim() || fields.length === 0) {
      toast.error("A template needs a name and at least one field");
      return;
    }
    setBusyRow("template");
    void saveForumTemplate({
      forumId: config.id ?? "",
      name: templateName.trim().slice(0, 40),
      emoji: templateEmoji.trim() || null,
      description: templateDescription.trim() || null,
      fields,
      position: templates.length,
    })
      .then(() => {
        setTemplateName("");
        setTemplateEmoji("");
        setTemplateDescription("");
        setTemplateFields([{ label: "", placeholder: "", required: true }]);
        toast.success("Template added");
        onSaved();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't add that template"))
      .finally(() => setBusyRow(null));
  };

  const removeRow = (kind: "tag" | "status" | "template", id: string) => {
    setBusyRow(id);
    const run =
      kind === "tag" ? deleteForumTag(id) : kind === "status" ? deleteForumStatus(id) : deleteForumTemplate(id);
    void run
      .then(() => onSaved())
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't remove that"))
      .finally(() => setBusyRow(null));
  };

  if (!canModerate) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Forum settings</SheetTitle>
            <SheetDescription>Only the realm's owner and moderators can customize this forum.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle className="font-display">Customize “{roomName}”</SheetTitle>
          <SheetDescription>
            How this realm's forum looks, what it accepts and who can post — previewed live on the right.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Tabs defaultValue="identity" className="min-w-0">
            <TabsList className="glass mb-3 flex-wrap border border-white/5">
              <TabsTrigger value="identity" className="gap-1.5 text-[12px]">
                <Palette className="h-3.5 w-3.5" aria-hidden /> Look
              </TabsTrigger>
              <TabsTrigger value="layout" className="gap-1.5 text-[12px]">
                <Layers className="h-3.5 w-3.5" aria-hidden /> Defaults
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-1.5 text-[12px]">
                <Tags className="h-3.5 w-3.5" aria-hidden /> Tags
              </TabsTrigger>
              <TabsTrigger value="statuses" className="gap-1.5 text-[12px]">
                <Wrench className="h-3.5 w-3.5" aria-hidden /> Statuses
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5 text-[12px]">
                <Plus className="h-3.5 w-3.5" aria-hidden /> Templates
              </TabsTrigger>
              <TabsTrigger value="posting" className="gap-1.5 text-[12px]">
                <SmilePlus className="h-3.5 w-3.5" aria-hidden /> Posting
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">Banner</Label>
                <div className="flex gap-2">
                  <Input
                    value={draft.banner_url}
                    onChange={(event) => patch({ banner_url: event.target.value })}
                    placeholder="https://…/banner.jpg"
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                  <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--forum-border)] px-3 text-[12px] font-semibold">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => uploadBanner(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="forum-icon" className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Icon emoji
                  </Label>
                  <Input
                    id="forum-icon"
                    value={draft.icon_emoji}
                    onChange={(event) => patch({ icon_emoji: event.target.value })}
                    maxLength={4}
                    placeholder="🗂️"
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                </div>
                <div>
                  <Label htmlFor="forum-accent" className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Accent color
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="forum-accent"
                      type="color"
                      value={draft.accent_color || "#c9ff3d"}
                      onChange={(event) => patch({ accent_color: event.target.value })}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--forum-border)] bg-transparent"
                    />
                    <Input
                      value={draft.accent_color}
                      onChange={(event) => patch({ accent_color: event.target.value })}
                      placeholder="Uses the realm's accent"
                      className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="forum-description" className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="forum-description"
                  value={draft.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  rows={2}
                  maxLength={280}
                  placeholder="What is this forum for?"
                  className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                />
              </div>

              <div>
                <Label htmlFor="forum-guidelines" className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Guidelines
                </Label>
                <Textarea
                  id="forum-guidelines"
                  value={draft.guidelines}
                  onChange={(event) => patch({ guidelines: event.target.value })}
                  rows={4}
                  maxLength={2000}
                  placeholder="Be kind. Search before posting. One topic per thread."
                  className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  New threads are shown these and ask the author to confirm they read them. Tick “Pin as guidelines”
                  when you publish a thread to make that the pinned copy too.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="layout" className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Default layout
                </Label>
                <div className="flex gap-2">
                  {(["card", "compact", "gallery"] as ForumLayout[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => patch({ default_layout: option })}
                      aria-pressed={draft.default_layout === option}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize",
                        draft.default_layout === option
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Default sort
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {FORUM_SORTS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => patch({ default_sort: option.id })}
                        aria-pressed={draft.default_sort === option.id}
                        className={cn(
                          "forum-chip",
                          draft.default_sort === option.id
                            ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                            : "text-muted-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Card density
                  </Label>
                  <div className="flex gap-2">
                    {(["comfortable", "compact"] as ForumDensity[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => patch({ default_density: option })}
                        aria-pressed={draft.default_density === option}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize",
                          draft.default_density === option
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-3">
                <div>
                  <p className="text-[13px] font-semibold">Require a tag</p>
                  <p className="text-[11px] text-muted-foreground">Every new thread must carry at least one tag.</p>
                </div>
                <Switch checked={draft.require_tag} onCheckedChange={(value) => patch({ require_tag: value })} />
              </div>
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              <ul className="space-y-2">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-2"
                  >
                    <span className="forum-chip" style={{ borderColor: tag.color, backgroundColor: `${tag.color}22` }}>
                      {tag.emoji} {tag.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRow("tag", tag.id)}
                      aria-label={`Delete ${tag.name}`}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      {busyRow === tag.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
                {tags.length === 0 && <li className="text-[12px] text-muted-foreground">No tags yet.</li>}
              </ul>

              <div className="space-y-2 rounded-xl border border-[var(--forum-border)] p-3">
                <p className="text-[12px] font-semibold">Add a tag</p>
                <div className="flex gap-2">
                  <Input
                    value={tagEmoji}
                    onChange={(event) => setTagEmoji(event.target.value)}
                    placeholder="🐞"
                    maxLength={4}
                    className="w-16 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] text-center"
                  />
                  <Input
                    value={tagName}
                    onChange={(event) => setTagName(event.target.value)}
                    placeholder="Bug report"
                    maxLength={24}
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(event) => setTagColor(event.target.value)}
                    aria-label="Tag color"
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--forum-border)] bg-transparent"
                  />
                  <Button type="button" onClick={addTag} disabled={!tagName.trim() || busyRow === "tag"} className="h-10 shrink-0 gap-1.5">
                    <Plus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="statuses" className="space-y-4">
              <ul className="space-y-2">
                {statuses.map((status) => (
                  <li
                    key={status.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-2"
                  >
                    <span className="forum-chip" style={{ borderColor: status.color, backgroundColor: `${status.color}22` }}>
                      {status.emoji} {status.name}
                    </span>
                    {status.is_default && <span className="text-[10px] font-bold uppercase text-muted-foreground">default</span>}
                    {status.is_closed && <span className="text-[10px] font-bold uppercase text-muted-foreground">closed</span>}
                    <button
                      type="button"
                      onClick={() => removeRow("status", status.id)}
                      aria-label={`Delete ${status.name}`}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      {busyRow === status.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
                {statuses.length === 0 && <li className="text-[12px] text-muted-foreground">No statuses yet.</li>}
              </ul>

              <div className="space-y-3 rounded-xl border border-[var(--forum-border)] p-3">
                <p className="text-[12px] font-semibold">Add a status</p>
                <div className="flex gap-2">
                  <Input
                    value={statusEmoji}
                    onChange={(event) => setStatusEmoji(event.target.value)}
                    placeholder="✅"
                    maxLength={4}
                    className="w-16 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] text-center"
                  />
                  <Input
                    value={statusName}
                    onChange={(event) => setStatusName(event.target.value)}
                    placeholder="In progress"
                    maxLength={24}
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                  <input
                    type="color"
                    value={statusColor}
                    onChange={(event) => setStatusColor(event.target.value)}
                    aria-label="Status color"
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--forum-border)] bg-transparent"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[12px]">
                    <Switch checked={statusDefault} onCheckedChange={setStatusDefault} />
                    Default for new threads
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <Switch checked={statusClosed} onCheckedChange={setStatusClosed} />
                    Closed (no new replies)
                  </label>
                  <Button type="button" onClick={addStatus} disabled={!statusName.trim() || busyRow === "status"} className="ml-auto h-10 gap-1.5">
                    <Plus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <ul className="space-y-2">
                {templates.map((template) => (
                  <li
                    key={template.id}
                    className="rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">
                        {template.emoji} {template.name}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {template.fields.length} field{template.fields.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow("template", template.id)}
                        aria-label={`Delete ${template.name}`}
                        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                      >
                        {busyRow === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {template.fields.map((field) => (
                        <li key={field.label} className="text-[11px] text-muted-foreground">
                          {field.label}
                          {field.required ? " · required" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {templates.length === 0 && <li className="text-[12px] text-muted-foreground">No templates yet.</li>}
              </ul>

              <div className="space-y-3 rounded-xl border border-[var(--forum-border)] p-3">
                <p className="text-[12px] font-semibold">Add a template</p>
                <div className="flex gap-2">
                  <Input
                    value={templateEmoji}
                    onChange={(event) => setTemplateEmoji(event.target.value)}
                    placeholder="🐞"
                    maxLength={4}
                    className="w-16 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] text-center"
                  />
                  <Input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Bug report"
                    maxLength={40}
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                </div>
                <Input
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="What is this template for?"
                  maxLength={160}
                  className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                />
                <div className="space-y-2">
                  {templateFields.map((field, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={field.label}
                        onChange={(event) =>
                          setTemplateFields((current) =>
                            current.map((entry, position) =>
                              position === index ? { ...entry, label: event.target.value } : entry,
                            ),
                          )
                        }
                        placeholder="Steps to reproduce"
                        className="min-w-[10rem] flex-1 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                      />
                      <Input
                        value={field.placeholder ?? ""}
                        onChange={(event) =>
                          setTemplateFields((current) =>
                            current.map((entry, position) =>
                              position === index ? { ...entry, placeholder: event.target.value } : entry,
                            ),
                          )
                        }
                        placeholder="Hint shown in the field"
                        className="min-w-[10rem] flex-1 border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                      />
                      <label className="flex items-center gap-2 text-[11px]">
                        <Switch
                          checked={field.required === true}
                          onCheckedChange={(value) =>
                            setTemplateFields((current) =>
                              current.map((entry, position) =>
                                position === index ? { ...entry, required: value } : entry,
                              ),
                            )
                          }
                        />
                        required
                      </label>
                      <button
                        type="button"
                        aria-label="Remove field"
                        onClick={() =>
                          setTemplateFields((current) =>
                            current.length === 1 ? current : current.filter((_, position) => position !== index),
                          )
                        }
                        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTemplateFields((current) => [...current, { label: "", placeholder: "", required: false }])}
                    className="h-10 gap-1.5 border-[var(--forum-border)]"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Field
                  </Button>
                  <Button
                    type="button"
                    onClick={addTemplate}
                    disabled={busyRow === "template"}
                    className="h-10 gap-1.5 border-0 bg-primary text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add template
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="posting" className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reactions
                </Label>
                <Input
                  value={draft.reactions}
                  onChange={(event) => patch({ reactions: event.target.value })}
                  placeholder="👍,❤️,🔥"
                  className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {REACTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => patch({ reactions: preset })}
                      className="forum-chip text-muted-foreground hover:text-foreground"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Allowed attachments
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {ATTACHMENT_KINDS.map((kind) => {
                    const active = draft.allowed_attachments.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          patch({
                            allowed_attachments: active
                              ? draft.allowed_attachments.filter((entry) => entry !== kind)
                              : [...draft.allowed_attachments, kind],
                          })
                        }
                        className={cn(
                          "forum-chip capitalize",
                          active ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]" : "text-muted-foreground",
                        )}
                      >
                        {kind}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Who can start threads
                  </Label>
                  <div className="flex gap-2">
                    {(["everyone", "mods"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => patch({ post_permission: option })}
                        aria-pressed={draft.post_permission === option}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize",
                          draft.post_permission === option
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
                        )}
                      >
                        {option === "mods" ? "Moderators" : "Everyone"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Who can reply
                  </Label>
                  <div className="flex gap-2">
                    {(["everyone", "mods"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => patch({ reply_permission: option })}
                        aria-pressed={draft.reply_permission === option}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize",
                          draft.reply_permission === option
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
                        )}
                      >
                        {option === "mods" ? "Moderators" : "Everyone"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">Slowmode</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SLOWMODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch({ slowmode_seconds: option.value })}
                      aria-pressed={draft.slowmode_seconds === option.value}
                      className={cn(
                        "forum-chip",
                        draft.slowmode_seconds === option.value
                          ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Auto-archive after inactivity
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {ARCHIVE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => patch({ auto_archive_days: option.value })}
                      aria-pressed={draft.auto_archive_days === option.value}
                      className={cn(
                        "forum-chip",
                        draft.auto_archive_days === option.value
                          ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Archived threads stay readable and stop taking replies. You can reopen one any time.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Live preview: the real hero and a real card, with the draft applied. */}
          <aside className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Live preview
            </p>
            <div className="overflow-hidden rounded-[var(--forum-radius)] border border-[var(--forum-border)]">
              <ForumHero
                config={previewConfig}
                name={roomName}
                realmName={realmName}
                threadCount={18}
                postCount24h={3}
                canCustomize={false}
                onNewPost={() => undefined}
                onCustomize={() => undefined}
              />
            </div>
            <div style={{ fontSize: `${draft.default_density === "compact" ? "0.96em" : "1em"}` }}>
              <ForumPostCard
                post={previewPost(tags, statuses, draft)}
                layout={draft.default_layout}
                density={draft.default_density}
                tags={tags.slice(0, 3)}
                status={statuses[0] ?? null}
                unread
                onOpen={() => undefined}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Previewed with the same components the forum renders, in the realm “{realmName}”.
            </p>
          </aside>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--forum-border)" }}>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11">
            Close
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-11 gap-2 border-0 bg-primary text-primary-foreground shadow-md"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Save forum
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
