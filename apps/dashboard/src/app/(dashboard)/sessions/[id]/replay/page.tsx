"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { get } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReplayEvent {
  id: string;
  type: "transcript" | "card_add" | "card_remove" | "card_update" | string;
  timestamp_ms: number;
  text?: string;
  card?: {
    id: string;
    card_type: string;
    title: string;
    content: string | { text?: string; summary?: string; [key: string]: unknown } | null;
    display_order: number;
  };
}

interface ReplayData {
  session_id: string;
  title: string;
  duration_ms: number;
  events: ReplayEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Speed = 1 | 1.5 | 2;

export default function SessionReplayPage() {
  const params = useParams();
  const sessionId = params.id as string;

  // Data
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);

  // Fetch replay data
  const loadReplay = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const data = await get<ReplayData>(
          `/api/sessions/${sessionId}/replay`,
          signal
        );
        if (signal?.aborted) return;
        setReplayData(data);
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load replay data"
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [sessionId]
  );

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadReplay(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadReplay]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !replayData) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();

    const TICK_MS = 50; // update every 50ms for smooth slider
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) * speed;
      lastTickRef.current = now;

      setElapsedMs((prev) => {
        const next = prev + delta;
        if (next >= replayData.duration_ms) {
          setIsPlaying(false);
          return replayData.duration_ms;
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, replayData]);

  // Derived state: visible events and cards
  const events = replayData?.events ?? [];
  const durationMs = replayData?.duration_ms ?? 0;

  const visibleTranscriptEvents = events.filter(
    (e) => e.type === "transcript" && e.timestamp_ms <= elapsedMs
  );

  // Build current card state by replaying card events up to elapsedMs
  const currentCards = (() => {
    const cardMap = new Map<
      string,
      ReplayEvent["card"]
    >();
    for (const evt of events) {
      if (evt.timestamp_ms > elapsedMs) break;
      if (evt.type === "card_add" && evt.card) {
        cardMap.set(evt.card.id, evt.card);
      } else if (evt.type === "card_update" && evt.card) {
        cardMap.set(evt.card.id, evt.card);
      } else if (evt.type === "card_remove" && evt.card) {
        cardMap.delete(evt.card.id);
      }
    }
    return Array.from(cardMap.values()).filter(Boolean).sort(
      (a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0)
    );
  })();

  function handlePlayPause() {
    if (!replayData) return;
    if (elapsedMs >= durationMs) {
      // Reset if at end
      setElapsedMs(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }

  function handleSeek(value: number) {
    setElapsedMs(value);
    // If playing, timer will continue from new position
  }

  function handleRetry() {
    const controller = new AbortController();
    abortRef.current = controller;
    loadReplay(controller.signal);
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/sessions/${sessionId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Session
          </Link>
        </div>
        <div className="flex items-center justify-center py-24" role="status">
          <Loader2
            size={32}
            className="animate-spin text-gray-400"
            aria-hidden="true"
          />
          <span className="sr-only">Loading replay...</span>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/sessions/${sessionId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Session
          </Link>
        </div>
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!replayData) return null;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/sessions/${sessionId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Session
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--ink)" }}
        >
          Oturum Kayd&imath;: {replayData.title}
        </h1>
      </div>

      {/* Controls bar */}
      <div
        className="mb-6 rounded-2xl border border-gray-200 p-4"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} className="ml-0.5" aria-hidden="true" />
            )}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {([1, 1.5, 2] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  speed === s
                    ? "text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  speed === s ? { backgroundColor: "var(--red)" } : undefined
                }
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex flex-1 items-center gap-3">
            <span className="text-xs font-mono text-gray-500">
              {formatTime(elapsedMs)}
            </span>
            <input
              type="range"
              min={0}
              max={durationMs}
              value={elapsedMs}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-[var(--red)]"
              aria-label="Timeline"
            />
            <span className="text-xs font-mono text-gray-500">
              {formatTime(durationMs)}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Transcript */}
        <div
          className="rounded-2xl border border-gray-200 p-5"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <h2
            className="mb-4 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Transcript
          </h2>
          <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
            {visibleTranscriptEvents.length === 0 ? (
              <p className="text-sm italic text-gray-400">
                {elapsedMs === 0
                  ? "Play to see transcript..."
                  : "No transcript events yet."}
              </p>
            ) : (
              visibleTranscriptEvents.map((evt) => (
                <div key={evt.id} className="flex gap-3">
                  <span className="shrink-0 font-mono text-xs text-gray-400">
                    {formatTime(evt.timestamp_ms)}
                  </span>
                  <p className="text-sm leading-relaxed text-gray-700">
                    {evt.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Cards */}
        <div
          className="rounded-2xl border border-gray-200 p-5"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <h2
            className="mb-4 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Cards
          </h2>
          <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2">
            {currentCards.length === 0 ? (
              <p className="text-sm italic text-gray-400">
                {elapsedMs === 0
                  ? "Play to see cards..."
                  : "No cards at this point."}
              </p>
            ) : (
              currentCards.map(
                (card) =>
                  card && (
                    <SessionCard
                      key={card.id}
                      card={{
                        id: card.id,
                        card_type: card.card_type,
                        title: card.title,
                        content: card.content,
                        display_order: card.display_order,
                      }}
                    />
                  )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
