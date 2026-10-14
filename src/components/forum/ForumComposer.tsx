import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, ImagePlus, Loader2, Paperclip, Pin, Send, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip, TagChip } from "@/components/forum/ForumBits";
import { ForumRichBody } from "@/components/forum/ForumEmbeds";
import {
  attachmentKind,
  createForumPost,
  updateForumPost,
  uploadForumAttachment,
  type ForumConfig,
  type ForumPost,
  type ForumStatus,
  type ForumTag,
  type ForumTemplate,
} from "@/lib/forums";
import { formatDuration } from "@/lib/music";
import { cn } from "@/lib/utils";

/**
 * Writing or editing a thread.
 *
 * The form is driven by the forum's own setup: its templates add their required
 * fields, its tags become the chip picker (and the required-tag rule is enforced
 * here as well as on the server), its statuses fill the status menu, and its
 * attachment policy decides what the file picker accepts. Nothing about posting
 * is hardcoded per forum.
 */

type ComposerState = {
  title: string;
  body: string;
  tagIds: string[];
  statusId: string | null;
  templateId: string | null;
  fields: Record<string, string>;
  coverUrl: string | null;
  attachments: string[];
};

function emptyState(post?: ForumPost | null): ComposerState {
  if (!post) {
    return {
      title: "",
      body: "",
      tagIds: [],
      statusId: null,
      templateId: null,
      fields: {},
      coverUrl: null,
      attachments: [],
    };
  }
  return {
    title: post.title,
    body: post.body,
    tagIds: post.tag_ids,
    statusId: post.status_id,
    templateId: post.template_id,
    fields: { ...post.fields },
    coverUrl: post.cover_url,
    attachments: post.attachments ?? [],
  };
}

export function ForumComposer({
  open,
  onOpenChange,
  config,
  tags,
  statuses,
  templates,
  userId,
  post = null,
  canModerate = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ForumConfig;
  tags: ForumTag[];
  statuses: ForumStatus[];
  templates: ForumTemplate[];
  userId: string | null;
  post?: ForumPost | null;
  canModerate?: boolean;
  onSaved: () => void;
}) {
  const editing = !!post;
  const [state, setState] = useState<ComposerState>(() => emptyState(post));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pinAsGuidelines, setPinAsGuidelines] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Reopening for a different thread (or for a new one) starts clean.
  useEffect(() => {
    if (!open) return;
    setState(emptyState(post));
    setAccepted(!config.guidelines);
    setPinAsGuidelines(false);
  }, [open, post, config.guidelines]);

  const template = useMemo(
    () => templates.find((entry) => entry.id === state.templateId) ?? null,
    [templates, state.templateId],
  );

  const templateFields = template?.fields ?? [];
  const requiredFields = templateFields.filter((field) => field.required);
  const missingFields = requiredFields.filter((field) => !(state.fields[field.label] ?? "").trim());
  const needsTag = config.require_tag && state.tagIds.length === 0;
  const canPost = !!userId
    && state.title.trim().length >= 3
    && !needsTag
    && missingFields.length === 0
    && (accepted || !config.guidelines)
    && !saving;

  const patch = (next: Partial<ComposerState>) => setState((current) => ({ ...current, ...next }));

  const accept = (files: FileList | null) => {
    if (!files || files.length === 0 || !userId) return;
    const chosen = Array.from(files).slice(0, 10 - state.attachments.length);
    const rejected = chosen.filter((file) => !config.allowed_attachments.includes(attachmentKind(file)));
    if (rejected.length > 0) {
      toast.error(
        `This forum takes ${config.allowed_attachments.join(", ")} only — skipped ${rejected
          .map((file) => file.name)
          .join(", ")}`,
      );
    }
    const allowed = chosen.filter((file) => config.allowed_attachments.includes(attachmentKind(file)));
    if (allowed.length === 0) return;

    setUploading(true);
    void (async () => {
      try {
        const urls: string[] = [];
        for (const file of allowed) {
          urls.push(await uploadForumAttachment({ userId, file }));
        }
        setState((current) => ({
          ...current,
          attachments: [...current.attachments, ...urls],
          coverUrl:
            current.coverUrl
            ?? urls.find((url) => /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url))
            ?? null,
        }));
        toast.success(urls.length === 1 ? "Attachment added" : `${urls.length} attachments added`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That upload failed");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    })();
  };

  const submit = async () => {
    if (!canPost || !userId) return;
    setSaving(true);
    try {
      if (editing && post) {
        await updateForumPost({
          postId: post.id,
          title: state.title.trim(),
          body: state.body,
          tagIds: state.tagIds,
          statusId: state.statusId,
          fields: state.fields,
          coverUrl: state.coverUrl,
          attachments: state.attachments,
        });
        toast.success("Thread updated");
      } else {
        await createForumPost({
          roomId: config.room_id,
          title: state.title.trim(),
          body: state.body,
          tagIds: state.tagIds,
          statusId: state.statusId,
          templateId: state.templateId,
          fields: state.fields,
          coverUrl: state.coverUrl,
          attachments: state.attachments,
          asGuidelines: pinAsGuidelines,
        });
        toast.success(pinAsGuidelines ? "Thread pinned as the forum's guidelines" : "Thread published");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't publish that thread");
    } finally {
      setSaving(false);
    }
  };

  const imageAttachments = state.attachments.filter((url) => /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[92dvh] w-[min(46rem,95vw)] overflow-y-auto border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display text-left">
            {editing ? "Edit thread" : "New thread"}
          </DialogTitle>
          <DialogDescription className="text-left text-xs text-muted-foreground">
            {config.guidelines
              ? "Read the forum guidelines first — they are pinned at the top of the list."
              : "Give it a clear title. Code fences and links render as real blocks."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {config.guidelines && (
            <div className="rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-3">
              <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Guidelines
              </p>
              <p className="whitespace-pre-wrap text-[12px] text-muted-foreground">{config.guidelines}</p>
              <label className="mt-2 flex items-center gap-2 text-[12px]">
                <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
                I've read these
              </label>
            </div>
          )}

          {!editing && templates.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Start from a template
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((entry) => {
                  const active = state.templateId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={active}
                      // Switching template re-labels the form, so previous
                      // answers are cleared rather than silently reattached.
                      onClick={() => patch({ templateId: active ? null : entry.id, fields: {} })}
                      className={cn(
                        "forum-chip",
                        active
                          ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {entry.emoji ? <span aria-hidden>{entry.emoji}</span> : null}
                      {entry.name}
                    </button>
                  );
                })}
              </div>
              {template?.description && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">{template.description}</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="forum-title" className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              id="forum-title"
              value={state.title}
              onChange={(event) => patch({ title: event.target.value })}
              maxLength={160}
              placeholder="What do you need help with?"
              className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
            />
          </div>

          {templateFields.length > 0 && (
            <div className="space-y-3">
              {templateFields.map((field) => (
                <div key={field.label}>
                  <Label
                    htmlFor={`forum-field-${field.label}`}
                    className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {field.label}
                    {field.required ? <span className="ml-1 text-[var(--forum-pinned)]">required</span> : null}
                  </Label>
                  <Textarea
                    id={`forum-field-${field.label}`}
                    value={state.fields[field.label] ?? ""}
                    onChange={(event) =>
                      patch({ fields: { ...state.fields, [field.label]: event.target.value } })
                    }
                    placeholder={field.placeholder}
                    rows={2}
                    maxLength={2000}
                    className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label htmlFor="forum-body" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Post
              </Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => patch({ body: `${state.body}${state.body.endsWith("\n") || !state.body ? "" : "\n"}\`\`\`\n\`\`\`\n` })}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--forum-border)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Code2 className="h-3 w-3" aria-hidden />
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--forum-border)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ImagePlus className="h-3 w-3" aria-hidden />
                  Attach
                </button>
              </div>
            </div>
            <Textarea
              id="forum-body"
              value={state.body}
              onChange={(event) => patch({ body: event.target.value })}
              rows={6}
              maxLength={20_000}
              placeholder={"Explain it…\n\n```\ncode goes here\n```\n\nPaste a link on its own line to embed a picture, a clip or a track."}
              className="border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] font-sans"
            />
          </div>

          {state.body.trim() && (
            <details className="rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-3">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Preview
              </summary>
              <div className="mt-2">
                <ForumRichBody body={state.body} attachments={state.attachments} />
              </div>
            </details>
          )}

          {tags.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Tags {config.require_tag && <span className="text-[var(--forum-pinned)]">(at least one)</span>}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = state.tagIds.includes(tag.id);
                  return (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      active={active}
                      onClick={() =>
                        patch({
                          tagIds: active
                            ? state.tagIds.filter((id) => id !== tag.id)
                            : [...state.tagIds, tag.id],
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {statuses.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => patch({ statusId: null })}
                  aria-pressed={state.statusId === null}
                  className={cn(
                    "forum-chip",
                    state.statusId === null ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)]" : "text-muted-foreground",
                  )}
                >
                  Default
                </button>
                {statuses.map((status) => (
                  <button key={status.id} type="button" onClick={() => patch({ statusId: status.id })}>
                    <StatusChip
                      status={status}
                      className={cn(
                        state.statusId === status.id
                          ? "outline outline-1 outline-[var(--forum-accent)]"
                          : "opacity-80 hover:opacity-100",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.attachments.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Attachments
              </Label>
              <div className="flex flex-wrap gap-2">
                {state.attachments.map((url) => (
                  <span
                    key={url}
                    className="group relative overflow-hidden rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)]"
                  >
                    {imageAttachments.includes(url) ? (
                      <img src={url} alt="" loading="lazy" className="h-16 w-16 object-cover" />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center bg-[var(--forum-surface-sunken)] text-muted-foreground">
                        <Paperclip className="h-4 w-4" aria-hidden />
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          attachments: current.attachments.filter((item) => item !== url),
                          coverUrl: current.coverUrl === url ? null : current.coverUrl,
                        }))
                      }
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {imageAttachments.includes(url) && (
                      <button
                        type="button"
                        onClick={() => patch({ coverUrl: state.coverUrl === url ? null : url })}
                        className={cn(
                          "absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-[10px] font-bold",
                          state.coverUrl === url ? "bg-[var(--forum-accent)] text-white" : "bg-black/70 text-white/80",
                        )}
                      >
                        {state.coverUrl === url ? "Cover" : "Set cover"}
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {canModerate && !editing && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] p-3">
              <span className="inline-flex items-center gap-2 text-[12px]">
                <Pin className="h-3.5 w-3.5 text-[var(--forum-pinned)]" aria-hidden />
                Pin this as the forum's guidelines
              </span>
              <Switch checked={pinAsGuidelines} onCheckedChange={setPinAsGuidelines} />
            </div>
          )}

          {config.slowmode_seconds > 0 && (
            <p className="text-[11px] text-[var(--forum-pinned)]">
              Slowmode is on: one thread or reply every {formatDuration(config.slowmode_seconds * 1000) || `${config.slowmode_seconds}s`}.
            </p>
          )}

          {needsTag && <p className="text-[11px] text-[var(--forum-pinned)]">Pick at least one tag to post.</p>}
          {missingFields.length > 0 && (
            <p className="text-[11px] text-[var(--forum-pinned)]">
              Fill in {missingFields.map((field) => `"${field.label}"`).join(", ")}.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!canPost}
            className="h-11 gap-2 border-0 bg-primary text-primary-foreground shadow-md"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {editing ? "Save changes" : "Publish"}
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={config.allowed_attachments
            .map((kind) =>
              kind === "image" ? "image/*" : kind === "video" ? "video/*" : kind === "audio" ? "audio/*" : "*/*",
            )
            .join(",")}
          onChange={(event) => accept(event.target.files)}
        />
        {uploading && (
          <p className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Uploading…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
