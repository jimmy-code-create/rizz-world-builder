import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  CalendarClock,
  Camera,
  ImagePlus,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/chat/MessageComposer";
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
};

const MAX_ATTACHMENTS = 10;

export const RealmComposer = forwardRef<RealmComposerHandle, RealmComposerProps>(
  function RealmComposer(
    {
      realmId,
      realmName = "",
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

    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        insert: (text: string, options?: { space?: boolean }) => {
          setBody((prev) => {
            const needsLeading = options?.space && prev && !prev.endsWith(" ");
            const needsTrailing = options?.space;
            return `${prev}${needsLeading ? " " : ""}${text}${needsTrailing ? " " : ""}`;
          });
          requestAnimationFrame(() => {
            inputRef.current?.focus();
          });
        },
        clear: () => {
          setBody("");
          clearAttachments();
        },
        focus: () => {
          inputRef.current?.focus();
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [previews],
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
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
        inputRef.current?.setSelectionRange(next.length, next.length);
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
    const disabledHint = writeBlockedNote || (!joined ? "Join realm to send messages" : "Chat locked");
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
          textareaRef={inputRef}
          sending={sending}
          canSend={Boolean(body.trim() || attachments.length)}
          allowVoice={false}
          onPaste={handlePaste}
          above={
            previews.length > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                {previews.map((preview, i) => (
                  <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                    <img
                      src={preview}
                      alt="Attachment"
                      className="h-full w-full object-cover"
                    />
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
                  label: "Photo",
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
                  inputRef.current?.setSelectionRange(next.caret, next.caret);
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
          onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onTextareaClick={(e) => {
            setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0);
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
          onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`)}
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
