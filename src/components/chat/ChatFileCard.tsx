import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";
import { formatFileSize, type ChatFileCard } from "@/lib/chat-files";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (/zip|rar|7z|tar|gzip|compressed/.test(mime)) return FileArchive;
  if (/pdf|text|document|sheet|presentation|json|xml|csv/.test(mime)) return FileText;
  return FileIcon;
}

/**
 * A file message: icon by type, then name and size. The whole card is a link,
 * so tapping opens the file and the browser offers download from there.
 */
export function ChatFileCardView({ file, className }: { file: ChatFileCard; className?: string }) {
  const Icon = iconFor(file.mime);
  return (
    <a
      href={file.url}
      download={file.name}
      target="_blank"
      rel="noreferrer"
      className={className ? `chat-file-card ${className}` : "chat-file-card"}
    >
      <span className="chat-file-card__icon">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      <span className="chat-file-card__meta">
        <span className="block truncate text-[13px] font-semibold leading-tight">{file.name}</span>
        <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
      </span>
    </a>
  );
}
