import { Link } from "@tanstack/react-router";
import { GifContent } from "@/components/GifContent";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { renderGifSegments } from "@/lib/gif-content";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { EmojiText } from "@/components/emoji/EmojiText";

/**
 * A comment body with the same mention chips as chat and reel captions.
 *
 * Every surface that prints a comment goes through here — the post sheet, the
 * inline thread under a feed card, the desktop discussion pane and reel
 * comments — so an `@name` is always highlighted and always one tap from the
 * profile, and a GIF or sticker marker always renders as media instead of its
 * raw shortcode.
 */
export function CommentBody({ body }: { body: string }) {
  return (
    <>
      {renderGifSegments(body).map((segment, segmentIndex) =>
        segment.isGif || segment.isSticker ? (
          <GifContent key={`media-${segmentIndex}`}>{segment.marker ?? ""}</GifContent>
        ) : (
          renderCaptionWithTags(segment.value).map((part, index) => {
            if (part.mention) {
              return (
                <ProfilePreviewTrigger
                  key={index}
                  username={part.mention}
                  className="mention-highlight font-semibold"
                >
                  {part.text}
                </ProfilePreviewTrigger>
              );
            }
            if (part.tag) {
              return (
                <Link
                  key={index}
                  to="/tag/$tag"
                  params={{ tag: part.tag }}
                  className="font-semibold text-primary hover:underline"
                >
                  {part.text}
                </Link>
              );
            }
            if (part.url) {
              return (
                <a
                  key={index}
                  href={part.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {part.text}
                </a>
              );
            }
            // Emoji tokens survive the mention/tag split: `EmojiText` resolves
            // `<:cat:id>` to its picture, and the text pass inside it turns
            // `:cat_love:` into the in-house cat pack.
            return <EmojiText key={index} text={part.text} />;
          })
        ),
      )}
    </>
  );
}
