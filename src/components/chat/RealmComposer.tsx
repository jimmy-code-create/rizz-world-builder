import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  ChatComposer,
  type ComposerReply,
  type PendingComposerFile,
} from "@/components/chat/MessageComposer";
import type { ComposerInputHandle } from "@/components/chat/ComposerInput";
import { useAvailableEmojis } from "@/lib/emoji-available";
import { parseEmojiToken, type EmojiTokenParts } from "@/lib/emoji-token";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { SlashCommandMenu, wrapIndex } from "@/components/bots/SlashCommandMenu";
import {
  filterSlashCommands,
  insertSlashCommand,
  parseSlashCommand,
  type RealmSlashCommand,
} from "@/lib/bot-commands";
import { toast } from "@/lib/toast";
import {
  makeChatFileDraft,
  releaseChatFileDraft,
  uploadChatFileDraft,
  type ChatFileDraft,
} from "@/lib/chat-files";
import { formatUploadLimit } from "@/lib/purify";
import { AnimatePresence } from "framer-motion";

export type RealmComposerHandle = {
  insert: (text: string, options?: { space?: boolean }) => void;
  /** A custom emoji token, drawn inline at the saved caret. */
  insertEmoji?: (token: string) => void;
  clear: () => void;
  focus: () => void;
};

export type RealmComposerProps = {
  realmId: string;
  realmName?: string;
  channelKey?: string;
  userId?: string | null;
  joined?: boolean;
  sending?: boolean;
  composerBlock?: boolean;
  writeBlockedNote?: string | null;
  memberIds?: string[];
  commands?: RealmSlashCommand[];
  commandsLoading?: boolean;
  onSend: (args: { text: string; files: ChatFileDraft[] }) => Promise<boolean>;
  onManageEmoji?: () => void;
  onPoll?: () => void;
  onSchedule?: (draft: string) => void;
  onInputFocus?: () => void;
  /** Photos already in this channel, newest first: the attach sheet's library. */
  photos?: { id: string; url: string }[];
  /** Current member's avatar for the composer's sticker button. */
  avatarUrl?: string | null;
  /** Per-file upload ceiling for this viewer. */
  uploadLimit?: number;
  /** Quote strip above the row: replying to a message in this channel. */
  reply?: ComposerReply | null;
  /** The transcript scroller, so the dock keeps it pinned to the newest row. */
  scrollRef?: RefObject<HTMLDivElement | null>;
};

const MAX_ATTACHMENTS = 10;

export const RealmComposer = forwardRef<RealmComposerHandle, RealmComposerProps>(
  function RealmComposer(
    {
      realmId,
      realmName = "",
      photos = [],
      avatarUrl = null,
      uploadLimit = Number.POSITIVE_INFINITY,
      channelKey: _channelKey,
      userId,
      joined = true,
      sending = false,
      composerBlock = false,
      writeBlockedNote = null,
      memberIds = [],
      commands = [],
      commandsLoading = false,
      onSend,
      onManageEmoji,
      onPoll,
      onSchedule,
      onInputFocus,
      reply = null,
      scrollRef,
    },
    ref,
  ) {
    const [body, setBody] = useState("");
    const [attachments, setAttachments] = useState<ChatFileDraft[]>([]);
    const [caret, setCaret] = useState(0);
    const [slashIndex, setSlashIndex] = useState(0);
    const [slashHidden, setSlashHidden] = useState(false);

    const inputRef = useRef<ComposerInputHandle | null>(null);
    const objectUrlsRef = useRef(new Set<string>());

    /**
     * One source for the inline images the composer draws: the same cached list
     * the picker reads, plus any pending upload (a local blob) so an emoji is
     * visible the instant it is added.
     */
    const available = useAvailableEmojis();
    const emojiById = useMemo(() => {
      const map = new Map<string, string>();
      for (const emoji of available.data?.private ?? []) map.set(emoji.id, emoji.url);
      for (const realm of available.data?.realms ?? []) {
        for (const emoji of realm.emojis) map.set(emoji.id, emoji.url);
      }
      return map;
    }, [available.data]);

    const resolveEmoji = useCallback(
      (parts: EmojiTokenParts) => emojiById.get(parts.id) ?? null,
      [emojiById],
    );

    useImperativeHandle(
      ref,
      () => ({
        insert: (text: string, options?: { space?: boolean }) => {
          // A token becomes a picture in the field; a mention or a slash
          // command is plain text. Either way the message still carries the
          // token, never the image.
          const parsed = parseEmojiToken(text);
          const el = inputRef.current;
          if (el) {
            if (options?.space) el.insertText(" ");
            if (parsed) el.insertEmoji(text, parsed);
            else el.insertText(text);
            if (options?.space) el.insertText(" ");
            el.focus();
            // The composer is controlled from `body`; take the field's value so
            // the screen's `value` prop never overwrites what was just typed.
            setBody(el.getValue());
          } else {
            setBody((prev) => {
              const needsLeading = options?.space && prev && !prev.endsWith(" ");
              const needsTrailing = options?.space;
              return `${prev}${needsLeading ? " " : ""}${text}${needsTrailing ? " " : ""}`;
            });
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        },
        clear: () => {
          setBody("");
          inputRef.current?.clear();
          clearAttachments();
        },
        focus: () => {
          inputRef.current?.focus();
        },
        insertEmoji: (token: string) => {
          const parsed = parseEmojiToken(token);
          inputRef.current?.insertEmoji(token, parsed);
          const next = inputRef.current?.getValue() ?? body;
          setBody(next);
          setCaret(next.length);
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [body, attachments],
    );

    useEffect(
      () => () => {
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      },
      [],
    );

    const uploadDraft = useCallback(
      async (draft: ChatFileDraft) => {
        if (!userId) return;
        try {
          const result = await uploadChatFileDraft(draft, userId, (progress) =>
            setAttachments((current) =>
              current.map((file) => (file.id === draft.id ? { ...file, progress } : file)),
            ),
          );
          setAttachments((current) =>
            current.map((file) =>
              file.id === draft.id ? { ...file, ...result, progress: 100, status: "ready" } : file,
            ),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Couldn't upload that file.";
          setAttachments((current) =>
            current.map((file) =>
              file.id === draft.id ? { ...file, status: "error", error: message } : file,
            ),
          );
          toast.error(message);
        }
      },
      [userId],
    );

    const addFiles = useCallback(
      (input: FileList | File[] | null) => {
        if (!input) return;
        const files = Array.from(input);
        if (!files.length) return;
        const accepted: ChatFileDraft[] = [];
        for (const file of files) {
          if (file.size > uploadLimit) {
            toast.error(`${file.name || "That file"} is too large to upload.`);
            continue;
          }
          const draft = makeChatFileDraft(file);
          if (draft.preview) objectUrlsRef.current.add(draft.preview);
          accepted.push(draft);
        }
        if (!accepted.length) return;
        const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
        if (!room) {
          toast.error(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
          accepted.forEach(releaseChatFileDraft);
          return;
        }
        const batch = accepted.slice(0, room);
        if (batch.length < accepted.length) {
          toast.error(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
          accepted.slice(room).forEach(releaseChatFileDraft);
        }
        setAttachments((prev) => [...prev, ...batch]);
        batch.forEach((draft) => void uploadDraft(draft));
      },
      [attachments.length, uploadLimit, uploadDraft],
    );

    /** Send an attachment that is already in this channel: the sheet library. */
    const pickRecentPhoto = useCallback(
      async (url: string) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("missing");
          const blob = await response.blob();
          if (!blob.type.startsWith("image/") && !blob.type.startsWith("video/")) {
            throw new Error("unsupported");
          }
          const extension = (blob.type.split("/")[1] ?? "jpg").split("+")[0];
          addFiles([new File([blob], `attachment.${extension}`, { type: blob.type })]);
        } catch {
          toast.error("Couldn't open that attachment.");
        }
      },
      [addFiles],
    );

    const removeAttachment = useCallback(
      (index: number) => {
        const target = attachments[index];
        if (target) {
          releaseChatFileDraft(target);
          objectUrlsRef.current.delete(target.preview ?? "");
        }
        setAttachments((prev) => prev.filter((_, i) => i !== index));
      },
      [attachments],
    );

    const clearAttachments = useCallback(() => {
      attachments.forEach(releaseChatFileDraft);
      setAttachments([]);
    }, [attachments]);

    const slashQuery = parseSlashCommand(body);
    const slashMatches = slashQuery ? filterSlashCommands(commands, slashQuery.name) : [];
    const slashMenuOpen =
      !slashHidden && !sending && !commandsLoading && !!slashQuery && slashQuery.typingName;
    const slashMatchCount = slashMatches.length;
    const slashActive = Math.min(slashIndex, Math.max(slashMatchCount - 1, 0));
    const slashHint =
      !slashMenuOpen || slashMatchCount > 0
        ? undefined
        : slashMatchCount === 0 && !slashQuery?.name
          ? "No bot commands in this channel yet."
          : `No command matches "/${slashQuery?.name ?? ""}". Try /music or /game.`;

    const pickSlashCommand = (command: { name: string }) => {
      const next = insertSlashCommand(body, command.name);
      setBody(next);
      setCaret(next.length);
      setSlashIndex(0);
      setSlashHidden(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelection(next.length);
      });
    };

    const submit = async () => {
      if (composerBlock || sending) return;
      if (!body.trim() && !attachments.length) return;
      if (attachments.some((file) => file.status === "uploading")) {
        toast.info("One moment — the upload is still finishing");
        return;
      }
      const outgoingFiles = attachments.filter((file) => file.status === "ready" && file.url);
      if (attachments.length && !outgoingFiles.length) {
        toast.error("Remove the failed file and try again.");
        return;
      }
      // Clear the row before the network round trip; the payload is already
      // uploaded, so this is a fast insert.
      const outgoingBody = body;
      setBody("");
      setCaret(0);
      setSlashIndex(0);
      setSlashHidden(false);
      setAttachments([]);
      const success = await onSend({ text: outgoingBody, files: outgoingFiles });
      if (success) {
        outgoingFiles.forEach(releaseChatFileDraft);
      } else {
        setBody((current) => (current ? current : outgoingBody));
        if (outgoingFiles.length) {
          setAttachments((current) => (current.length ? current : outgoingFiles));
        }
      }
    };

    const sendMarker = async (marker: string) => {
      if (composerBlock || sending) return;
      const success = await onSend({ text: marker, files: [] });
      if (!success) toast.error("Couldn't send that sticker.");
    };

    const disabled = composerBlock || !!writeBlockedNote;
    const disabledHint =
      writeBlockedNote || (!joined ? "Join realm to send messages" : "Chat locked");
    const placeholder = disabled ? disabledHint : `Message #${realmName || "chat"}`;

    return (
      <div className="mx-auto w-full max-w-3xl">
        <ChatComposer
          value={body}
          onChange={(next, nextCaret) => {
            setBody(next);
            setSlashHidden(false);
            setSlashIndex(0);
            setCaret(nextCaret);
          }}
          onSend={() => void submit()}
          onPickEmoji={(token) => {
            const parsed = parseEmojiToken(token);
            const el = inputRef.current;
            if (!el) return;
            el.insertEmoji(token, parsed);
            const next = el.getValue() ?? body;
            setBody(next);
            setCaret(next.length);
          }}
          onSendMarker={(marker) => void sendMarker(marker)}
          onFilesSelected={(files) => addFiles(files)}
          pendingFiles={attachments as PendingComposerFile[]}
          onRemovePendingFile={removeAttachment}
          avatarUrl={avatarUrl}
          scrollRef={scrollRef}
          onManageEmoji={onManageEmoji}
          recentPhotos={photos}
          onPickRecentPhoto={(url) => void pickRecentPhoto(url)}
          onPoll={onPoll}
          onSchedule={onSchedule ? () => onSchedule(body) : undefined}
          scheduleDisabled={!body.trim()}
          disabled={disabled}
          disabledHint={disabledHint}
          placeholder={placeholder}
          maxLength={2000}
          inputRef={inputRef}
          resolveEmoji={resolveEmoji}
          sending={sending}
          reply={reply}
          canSend={Boolean(body.trim() || attachments.length)}
          allowVoice={false}
          onPasteFiles={(files) => addFiles(files)}
          mentions={
            <MentionAutocomplete
              value={body}
              caret={caret}
              memberIds={memberIds}
              emptyHint="No realm member matches that name."
              onPick={(username) => {
                const next = replaceMention(body, caret, username);
                setBody(next.value);
                setCaret(next.caret);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  inputRef.current?.setSelection(next.caret);
                });
              }}
            />
          }
          overlay={
            <AnimatePresence>
              {slashMenuOpen && (
                <div className="absolute inset-x-0 bottom-full z-40 mb-2">
                  <SlashCommandMenu
                    commands={slashMatches}
                    activeIndex={slashActive}
                    emptyHint={slashHint}
                    onHover={setSlashIndex}
                    onSelect={pickSlashCommand}
                  />
                </div>
              )}
            </AnimatePresence>
          }
          onKeyDown={(e) => {
            if (slashMatchCount > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setSlashIndex((current) =>
                wrapIndex(current + (e.key === "ArrowDown" ? 1 : -1), slashMatches.length),
              );
              return;
            }
            if (slashMatchCount > 0 && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
              e.preventDefault();
              const chosen = slashMatches[slashActive] ?? slashMatches[0];
              if (chosen) pickSlashCommand(chosen);
              return;
            }
            if (slashMenuOpen && e.key === "Escape") {
              e.preventDefault();
              setSlashHidden(true);
            }
          }}
          onKeyUp={() => setCaret(inputRef.current?.getCaret() ?? 0)}
          onTextareaClick={() => {
            setCaret(inputRef.current?.getCaret() ?? 0);
            onInputFocus?.();
          }}
          onFocus={onInputFocus}
        />
      </div>
    );
  },
);

RealmComposer.displayName = "RealmComposer";
