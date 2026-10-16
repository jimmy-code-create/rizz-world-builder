import { useEffect, useRef } from "react";

/**
 * A remote (or local) camera track in a <video>.
 *
 * Muted on purpose: the audio track of the same stream is played by the call's
 * own <audio> elements, and a second unmuted element would double every voice.
 */
export function VideoTile({ stream, className = "" }: { stream: MediaStream; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
