"use client";

/**
 * ProjectAudioPlayer
 * ------------------
 * User-initiated play/pause for a static project overview MP3 (sign-in screen).
 */

import { Pause, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ProjectAudioPlayerProps {
  src: string;
  /** Accessible name for the control (e.g. "Project overview narration"). */
  title: string;
  /** Optional label shown next to the button. */
  label?: string;
  /** Visual variant for light-on-dark (sign-in gradient) vs default. */
  variant?: "light" | "default";
  className?: string;
}

export function ProjectAudioPlayer({
  src,
  title,
  label = "Listen to overview",
  variant = "default",
  className,
}: ProjectAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setAvailable(false);
      setPlaying(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !available) return;

    if (playing) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  if (!available) {
    return null;
  }

  const isLight = variant === "light";

  return (
    <div className={cn("space-y-2", className)}>
      <p
        className={cn(
          "text-sm font-medium",
          isLight ? "text-blue-100" : "text-muted-foreground",
        )}
      >
        Hear a quick overview
      </p>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? `Pause: ${title}` : `Play: ${title}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
          isLight
            ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
            : "border-border bg-background hover:bg-muted",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Volume2 className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {playing ? "Pause" : label}
      </button>
    </div>
  );
}
