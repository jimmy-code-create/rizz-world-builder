import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { parseExternalReelLink, REDNOTE_UNAVAILABLE } from "@/lib/external-reels";

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
  }
}

const INSTAGRAM_SCRIPT_ID = "rizz-instagram-embed-script";

function InstagramPostEmbed({ permalink, title }: { permalink: string; title: string }) {
  const blockquoteRef = useRef<HTMLQuoteElement>(null);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    let active = true;
    let script: HTMLScriptElement | null = null;
    const onScriptLoad = () => {
      if (script) script.dataset.loaded = "true";
      if (active) window.instgrm?.Embeds?.process();
    };
    const onScriptError = () => {
      if (script) script.dataset.failed = "true";
      if (active) setScriptError(true);
    };

    setScriptError(false);
    if (window.instgrm?.Embeds) {
      requestAnimationFrame(onScriptLoad);
      return () => {
        active = false;
      };
    }

    script = document.getElementById(INSTAGRAM_SCRIPT_ID) as HTMLScriptElement | null;
    const needsAppend = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = INSTAGRAM_SCRIPT_ID;
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
    }
    if (script.dataset.failed === "true") {
      setScriptError(true);
      return () => {
        active = false;
      };
    }
    script.addEventListener("load", onScriptLoad);
    script.addEventListener("error", onScriptError);
    if (window.instgrm?.Embeds || script.dataset.loaded === "true") onScriptLoad();
    if (needsAppend) document.body.appendChild(script);

    return () => {
      active = false;
      script?.removeEventListener("load", onScriptLoad);
      script?.removeEventListener("error", onScriptError);
    };
  }, [permalink]);

  if (scriptError) {
    return (
      <div className="grid h-full place-items-center p-5 text-center text-sm text-white/75">
        <div>
          <p>Instagram’s official player could not be loaded.</p>
          <a href={permalink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-white underline">
            Open original <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-white">
      <blockquote
        ref={blockquoteRef}
        className="instagram-media !mx-auto !my-0 !w-full !max-w-[540px]"
        data-instgrm-permalink={permalink}
        data-instgrm-version="14"
        aria-label={title}
      />
      <noscript>Enable JavaScript to play this Instagram post.</noscript>
    </div>
  );
}

export function ExternalVideoEmbed({
  sourceUrl,
  className = "",
}: {
  sourceUrl: string;
  className?: string;
}) {
  const parsed = parseExternalReelLink(sourceUrl);
  if (!parsed.ok) return null;

  if (parsed.value.platform === "rednote") {
    return (
      <div className={`grid place-items-center bg-black p-6 text-center text-sm text-white/75 ${className}`} role="status">
        <div>
          <p>{REDNOTE_UNAVAILABLE}</p>
        </div>
      </div>
    );
  }

  if (parsed.value.platform === "instagram") {
    return (
      <div className={`overflow-hidden bg-black ${className}`}>
        <InstagramPostEmbed permalink={parsed.value.sourceUrl} title="Instagram video player" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-black ${className}`}>
      <iframe
        className="h-full w-full border-0"
        src={parsed.value.embedUrl ?? undefined}
        title="YouTube video player"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}