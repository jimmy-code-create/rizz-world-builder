import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarChart3, CalendarClock, Camera, Folder, ImagePlus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageComposer, type ComposerReply } from "@/components/chat/MessageComposer";
import type { ComposerInputHandle } from "@/components/chat/ComposerInput";
import { useAvailableEmojis } from "@/lib/emoji-available";
import { parseEmojiToken, type EmojiTokenParts } from "@/lib/emoji-token";
import { ChatAttachButton } from "@/components/chat/ChatAttachSheet";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { SlashCommandMenu, wrapIndex } from "@/components/bots/SlashCommandMenu";
import { GifPicker } from "@/components/GifPicker";
import { CatStickerSheet } from "@/components/chat/CatStickerSheet";
import {
  filterSlashCommands,
  insertSlashCommand,
  parseSlashCommand,
  type RealmSlashCommand,
} from "@/lib/bot-commands";
import { toast } from "@/lib/toast";
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
  onSend: (args: { text: string; files: File[] }) => Promise<boolean>;
  onManageEmoji?: () => void;
  onPoll?: () => void;
  onSchedule?: (draft: string) => void;
  onInputFocus?: () => void;
  /** Photos already in this channel, newest first: the attach sheet's library. */
  photos?: { id: string; url: string }[];
  /** Quote strip above the row: replying to a message in this channel. */
  reply?: ComposerReply | null;
};

const MAX_ATTACHMENTS = 10;

export const RealmComposer = forwardRef<RealmComposerHandle, RealmComposerProps>(
  function RealmComposer(
    {
      realmId,
      realmName = "",
      photos = [],
      channelKey: _channelKey,
      userId: _userId,
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
    },
    ref,
  ) {
    const [body, setBody] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [caret, setCaret] = useState(0);
    const [slashIndex, setSlashIndex] = useState(0);
    const [slashHidden, setSlashHidden] = useState(false);
    const [gifOpen, setGifOpen] = useState(false);
    const [catOpen, setCatOpen] = useState(false);

    const inputRef = useRef<ComposerInputHandle | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);

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
      [body, previews],
    );

    useEffect(() => {
      return () => {
        previews.forEach((url) => URL.revokeObjectURL(url));
      };
    }, [previews]);

    const addFiles = useCallback((files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (!arr.length) {
        toast.error("Choose an image or video file.");
        return;
      }
      setAttachments((prev) => [...prev, ...arr].slice(0, MAX_ATTACHMENTS));
      const newUrls = arr.map((f) => URL.createObjectURL(f));
      setPreviews((prev) => [...prev, ...newUrls].slice(0, MAX_ATTACHMENTS));
    }, []);

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

    const removeAttachment = useCallback((index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
      setPreviews((prev) => {
        if (prev[index]) URL.revokeObjectURL(prev[index]);
        return prev.filter((_, i) => i !== index);
      });
    }, []);

    const clearAttachments = useCallback(() => {
      previews.forEach((url) => URL.revokeObjectURL(url));
      setAttachments([]);
      setPreviews([]);
    }, [previews]);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<Element>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/") || items[i].type.startsWith("video/")) {
            const f = items[i].getAsFile();
            if (f) pastedFiles.push(f);
          }
        }
        if (pastedFiles.length) {
          addFiles(pastedFiles);
        }
      },
      [addFiles],
    );

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
      // Clear the row before the network round trip. The draft comes back only
      // if the send actually failed, so typing the next message never waits on
      // Supabase.
      const outgoingBody = body;
      const outgoingFiles = attachments;
      setBody("");
      setCaret(0);
      setSlashIndex(0);
      setSlashHidden(false);
      clearAttachments();
      const success = await onSend({ text: outgoingBody, files: outgoingFiles });
      if (!success) {
        setBody((current) => (current ? current : outgoingBody));
        if (outgoingFiles.length) addFiles(outgoingFiles);
      }
    };

    const disabled = composerBlock || !!writeBlockedNote;
    const disabledHint =
      writeBlockedNote || (!joined ? "Join realm to send messages" : "Chat locked");
    const placeholder = disabled ? disabledHint : `Message #${realmName || "chat"}`;

    return (
      <div className="mx-auto w-full max-w-3xl">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        {/* Photos comes from the library; Files opens the device's own file
            browser for the same images and clips. */}
        <input
          ref={filesInputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />

        <MessageComposer
          value={body}
          onChange={(next, nextCaret) => {
            setBody(next);
            setSlashHidden(false);
            setSlashIndex(0);
            setCaret(nextCaret);
          }}
          onSend={() => void submit()}
          onEmoji={() => setGifOpen(true)}
          onStickers={() => setCatOpen(true)}
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
          onPaste={handlePaste}
          above={
            previews.length > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                {previews.map((preview, i) => (
                  <div
                    key={i}
                    className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10"
                  >
                    <img src={preview} alt="Attachment" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white/80 hover:text-white"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  Photo compresses before upload
                </span>
              </div>
            ) : null
          }
          attach={
            <ChatAttachButton
              appearance="circle"
              disabled={disabled}
              actions={[
                {
                  id: "photo",
                  label: "Photos",
                  hint: "Your library",
                  icon: ImagePlus,
                  onSelect: () => fileInputRef.current?.click(),
                },
                {
                  id: "camera",
                  label: "Camera",
                  hint: "Take a shot",
                  icon: Camera,
                  onSelect: () => cameraInputRef.current?.click(),
                },
                {
                  id: "files",
                  label: "Files",
                  hint: "Browse device",
                  icon: Folder,
                  onSelect: () => filesInputRef.current?.click(),
                },
                ...(onPoll
                  ? [
                      {
                        id: "poll",
                        label: "Poll",
                        hint: "Ask the room",
                        icon: BarChart3,
                        onSelect: onPoll,
                      },
                    ]
                  : []),
                ...(onSchedule
                  ? [
                      {
                        id: "schedule",
                        label: "Schedule",
                        hint: "Send later",
                        icon: CalendarClock,
                        onSelect: () => onSchedule(body),
                        disabled: !body.trim(),
                      },
                    ]
                  : []),
              ]}
              photos={photos}
              onPickPhoto={(url) => void pickRecentPhoto(url)}
            />
          }
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

        <GifPicker
          hideTrigger
          triggerClassName="h-11 w-11"
          open={gifOpen}
          onOpenChange={setGifOpen}
          realmId={realmId}
          initialTab="emoji"
          keepOpenOnPick={false}
          onSelect={(marker) => {
            // Custom emoji (and cat shortcodes) go in as pictures at the caret,
            // not appended to the end of the draft. GIF and sticker markers are
            // still plain legacy text.
            const parsed = parseEmojiToken(marker);
            if (parsed) {
              inputRef.current?.insertEmoji(marker, parsed);
              const next = inputRef.current?.getValue() ?? body;
              setBody(next);
              setCaret(next.length);
              return;
            }
            if (marker.startsWith(":") && !marker.startsWith(":cat")) {
              inputRef.current?.insertText(marker);
              const next = inputRef.current?.getValue() ?? body;
              setBody(next);
              return;
            }
            setBody((current) => `${current}${current ? " " : ""}${marker}`);
          }}
          onCustomEmoji={onManageEmoji}
        />
        <CatStickerSheet
          open={catOpen}
          onOpenChange={setCatOpen}
          onPick={(shortcode) =>
            setBody(
              (current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${shortcode} `,
            )
          }
        />
      </div>
    );
  },
);

RealmComposer.displayName = "RealmComposer";
