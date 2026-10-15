import type { ReactNode } from "react";
import { Fragment } from "react";

type MarkdownTextProps = {
  text: string;
  className?: string;
  renderPlainText?: (text: string) => ReactNode;
};

const INLINE_MARKDOWN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_)/g;
const CODE_FENCE = /^```([A-Za-z0-9+#._-]*)\s*$/;
const HEADING = /^(#{1,3})\s+(.+)$/;
const UNORDERED_ITEM = /^\s*[-*]\s+(.+)$/;
const ORDERED_ITEM = /^\s*\d+\.\s+(.+)$/;
const safeWebUrl = (value: string) => /^https?:\/\//i.test(value);

function renderInline(text: string, renderPlainText?: (text: string) => ReactNode): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MARKDOWN)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const plain = text.slice(lastIndex, index);
      nodes.push(
        <Fragment key={`plain-${lastIndex}`}>{renderPlainText?.(plain) ?? plain}</Fragment>,
      );
    }

    if (token.startsWith("**") || token.startsWith("__")) {
      const inner = token.slice(2, -2);
      nodes.push(<strong key={`bold-${index}`}>{renderInline(inner, renderPlainText)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={`strike-${index}`}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`code-${index}`}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.92em] dark:bg-white/10"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link && safeWebUrl(link[2])) {
        nodes.push(
          <a
            key={`link-${index}`}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (/^https?:\/\//i.test(token)) {
      const trailing = /[.,!?;:)\]]+$/.exec(token)?.[0] ?? "";
      const href = trailing ? token.slice(0, -trailing.length) : token;
      nodes.push(
        <Fragment key={`url-${index}`}>
          {safeWebUrl(href) ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {href}
            </a>
          ) : (
            token
          )}
          {trailing}
        </Fragment>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`italic-${index}`}>{renderInline(token.slice(1, -1), renderPlainText)}</em>,
      );
    } else if (token.startsWith("_")) {
      nodes.push(
        <em key={`italic-${index}`}>{renderInline(token.slice(1, -1), renderPlainText)}</em>,
      );
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    nodes.push(<Fragment key={`plain-${lastIndex}`}>{renderPlainText?.(plain) ?? plain}</Fragment>);
  }
  return nodes;
}

/** Small, safe Markdown renderer shared by posts, forum embeds, and bot replies. */
export function MarkdownText({ text, className, renderPlainText }: MarkdownTextProps) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let code: string[] = [];
  let codeLanguage = "";
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-0 whitespace-pre-wrap break-words">
        {paragraph.map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {renderInline(line, renderPlainText)}
          </Fragment>
        ))}
      </p>,
    );
    paragraph = [];
  };

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (inCode) {
      if (CODE_FENCE.test(line)) {
        blocks.push(
          <pre
            key={`fence-${blocks.length}`}
            className="my-2 max-w-full overflow-x-auto rounded-xl border border-border bg-muted/50 p-3 text-left font-mono text-[0.86em] leading-relaxed"
          >
            {codeLanguage && (
              <span className="mb-2 block text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                {codeLanguage}
              </span>
            )}
            <code>{code.join("\n")}</code>
          </pre>,
        );
        inCode = false;
        code = [];
        codeLanguage = "";
      } else {
        code.push(line);
      }
      continue;
    }

    const fence = CODE_FENCE.exec(line);
    if (fence) {
      flushParagraph();
      inCode = true;
      codeLanguage = fence[1] || "";
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(
        <Tag
          key={`heading-${blocks.length}`}
          className={`my-1 font-display font-bold leading-tight ${level === 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm"}`}
        >
          {renderInline(heading[2], renderPlainText)}
        </Tag>,
      );
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph();
      blocks.push(<hr key={`rule-${blocks.length}`} className="my-2 border-border" />);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (cursor < lines.length && /^\s*>\s?/.test(lines[cursor])) {
        quoteLines.push(lines[cursor].replace(/^\s*>\s?/, ""));
        cursor += 1;
      }
      cursor -= 1;
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="my-1 border-l-2 border-primary/60 pl-3 text-muted-foreground"
        >
          {renderInline(quoteLines.join(" "), renderPlainText)}
        </blockquote>,
      );
      continue;
    }

    if (UNORDERED_ITEM.test(line) || ORDERED_ITEM.test(line)) {
      flushParagraph();
      const ordered = ORDERED_ITEM.test(line);
      const items: string[] = [];
      while (cursor < lines.length) {
        const current = lines[cursor];
        const match = (ordered ? ORDERED_ITEM : UNORDERED_ITEM).exec(current);
        if (!match) break;
        items.push(match[1]);
        cursor += 1;
      }
      cursor -= 1;
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={`my-1 space-y-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items.map((item, index) => (
            <li key={index}>{renderInline(item, renderPlainText)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) {
    blocks.push(
      <pre
        key={`fence-${blocks.length}`}
        className="my-2 max-w-full overflow-x-auto rounded-xl border border-border bg-muted/50 p-3 text-left font-mono text-[0.86em] leading-relaxed"
      >
        {codeLanguage && (
          <span className="mb-2 block text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
            {codeLanguage}
          </span>
        )}
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  flushParagraph();

  return <div className={className}>{blocks}</div>;
}
