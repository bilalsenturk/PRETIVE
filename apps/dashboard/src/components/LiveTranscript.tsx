"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface LiveTranscriptProps {
  transcripts: TranscriptEntry[];
  sessionStartTime: number | null;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function LiveTranscript({
  transcripts,
  sessionStartTime,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink)" }}
      >
        Live Transcript
      </h2>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-4"
        style={{ backgroundColor: "var(--paper)" }}
      >
        {transcripts.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-gray-400">Listening...</p>
          </div>
        ) : (
          transcripts.map((entry, i) => {
            const elapsed =
              sessionStartTime !== null
                ? formatElapsed(entry.timestamp - sessionStartTime)
                : "--:--";

            return (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 pt-0.5 text-xs font-mono text-gray-400">
                  {elapsed}
                </span>
                <p
                  className={`text-sm leading-relaxed ${
                    entry.isFinal
                      ? "text-gray-800"
                      : "italic text-gray-400"
                  }`}
                >
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
