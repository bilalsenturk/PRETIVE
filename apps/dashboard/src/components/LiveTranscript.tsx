"use client";

import { useEffect, useRef, useMemo } from "react";
import VerificationBadge, {
  type Verification,
} from "@/components/VerificationBadge";

export interface TranscriptEntry {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface LiveTranscriptProps {
  transcripts: TranscriptEntry[];
  sessionStartTime: number | null;
  currentHeading?: string | null;
  verification?: Verification | null;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function extractKeywords(heading: string | null | undefined): string[] {
  if (!heading) return [];
  // Split heading into words, filter out short/common words
  const stopWords = new Set(["the", "and", "or", "is", "in", "on", "at", "to", "for", "of", "a", "an", "it", "be", "as", "do", "if", "so", "no", "not", "but", "by", "from", "has", "was", "are", "with", "this", "that"]);
  return heading
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function highlightText(text: string, keywords: string[]): React.ReactNode {
  if (keywords.length === 0) return text;

  // Build a regex that matches any keyword (case-insensitive)
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = keywords.some((k) => part.toLowerCase() === k.toLowerCase());
    if (isMatch) {
      return (
        <span key={i} className="font-bold" style={{ color: "var(--red)" }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function LiveTranscript({
  transcripts,
  sessionStartTime,
  currentHeading,
  verification,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const keywords = useMemo(() => extractKeywords(currentHeading), [currentHeading]);

  const lastFinalIndex = useMemo(() => {
    for (let i = transcripts.length - 1; i >= 0; i--) {
      if (transcripts[i].isFinal) return i;
    }
    return -1;
  }, [transcripts]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [transcripts]);

  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink)" }}
        id="transcript-heading"
      >
        Live Transcript
      </h2>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-4"
        style={{ backgroundColor: "var(--paper)" }}
        role="log"
        aria-live="polite"
        aria-labelledby="transcript-heading"
      >
        {transcripts.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-gray-400">Listening...</p>
          </div>
        ) : (
          <>
            {transcripts.map((entry, i) => {
              const elapsed =
                sessionStartTime !== null
                  ? formatElapsed(entry.timestamp - sessionStartTime)
                  : "--:--";

              return (
                <div key={`${entry.timestamp}-${i}`} className="flex gap-3">
                  <span
                    className="shrink-0 pt-0.5 font-mono text-xs text-gray-400"
                    aria-label={`at ${elapsed}`}
                  >
                    {elapsed}
                  </span>
                  <p
                    className={`text-sm leading-relaxed ${
                      entry.isFinal
                        ? "text-gray-800"
                        : "italic text-gray-400"
                    }`}
                  >
                    {entry.isFinal ? highlightText(entry.text, keywords) : entry.text}
                    {i === lastFinalIndex && verification && (
                      <span className="ml-2 inline-flex align-middle">
                        <VerificationBadge verification={verification} />
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
