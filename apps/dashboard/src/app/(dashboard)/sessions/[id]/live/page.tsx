"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Loader2 } from "lucide-react";
import { get, post } from "@/lib/api";
import { startDeepgramStream, type DeepgramStream } from "@/lib/deepgram";
import LiveTranscript, {
  type TranscriptEntry,
} from "@/components/LiveTranscript";
import ActiveCards from "@/components/ActiveCards";

interface Session {
  id: string;
  title: string;
  status: "draft" | "preparing" | "ready" | "live" | "completed";
  created_at: string;
}

interface Card {
  id: string;
  card_type: "summary" | "comparison" | "concept" | "context_bridge";
  title: string;
  content: string | { text: string };
  display_order: number;
}

interface MatchResponse {
  cards: Card[];
  position: { heading?: string; chunk_index?: number } | string | null;
}

type LiveState = "idle" | "recording" | "stopped";

function resolvePosition(
  pos: MatchResponse["position"]
): string | null {
  if (pos === null || pos === undefined) return null;
  if (typeof pos === "string") return pos;
  if (typeof pos === "object" && pos !== null) {
    if (typeof pos.heading === "string" && pos.heading.length > 0) {
      return pos.heading;
    }
    if (typeof pos.chunk_index === "number") {
      return `Section ${pos.chunk_index}`;
    }
    // Fallback for unexpected object shapes
    return JSON.stringify(pos);
  }
  return String(pos);
}

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [activeCards, setActiveCards] = useState<Card[]>([]);
  const [currentPosition, setCurrentPosition] = useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<DeepgramStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const matchAbortRef = useRef<AbortController | null>(null);

  // Fetch session on mount and call live/start
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function init() {
      try {
        const data = await get<Session>(
          `/api/sessions/${id}`,
          controller.signal
        );
        setSession(data);
        await post(`/api/sessions/${id}/live/start`, {}, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load session"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    init();

    return () => {
      controller.abort();
    };
  }, [id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.stop();
        streamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (matchAbortRef.current) {
        matchAbortRef.current.abort();
        matchAbortRef.current = null;
      }
    };
  }, []);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      const now = Date.now();

      if (isFinal) {
        setTranscripts((prev) => {
          const filtered = prev.filter((t) => t.isFinal);
          return [...filtered, { text, isFinal: true, timestamp: now }];
        });

        // Cancel previous match request
        if (matchAbortRef.current) {
          matchAbortRef.current.abort();
        }
        const matchController = new AbortController();
        matchAbortRef.current = matchController;

        post<MatchResponse>(
          `/api/sessions/${id}/live/match`,
          { text },
          matchController.signal
        )
          .then((res) => {
            if (matchController.signal.aborted) return;
            if (res.cards && res.cards.length > 0) {
              setActiveCards(res.cards);
            }
            const resolved = resolvePosition(res.position);
            if (resolved) {
              setCurrentPosition(resolved);
            }
          })
          .catch((matchErr) => {
            if (matchController.signal.aborted) return;
            // Log match errors but don't disrupt the session
            console.error("Match request failed:", matchErr);
          });
      } else {
        setTranscripts((prev) => {
          const finals = prev.filter((t) => t.isFinal);
          return [...finals, { text, isFinal: false, timestamp: now }];
        });
      }
    },
    [id]
  );

  function handleStopRecording() {
    if (streamRef.current) {
      streamRef.current.stop();
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (matchAbortRef.current) {
      matchAbortRef.current.abort();
      matchAbortRef.current = null;
    }

    setLiveState("stopped");

    post(`/api/sessions/${id}/live/stop`, {}).catch((stopErr) => {
      console.error("Failed to notify server of session stop:", stopErr);
    });
  }

  function handleStartRecording() {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      setError("Deepgram API anahtarı yapılandırılmamış");
      return;
    }

    setError(null);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setLiveState("recording");

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    try {
      const stream = startDeepgramStream(apiKey, handleTranscript, (err) => {
        setError(err.message);
        handleStopRecording();
      });
      streamRef.current = stream;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kayıt başlatılamadı"
      );
      // Reset state since we failed to start
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLiveState("idle");
    }
  }

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <Loader2
          size={24}
          className="animate-spin text-gray-400"
          aria-hidden="true"
        />
        <span className="sr-only">Loading session...</span>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-3xl">
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div
        className="flex items-center justify-between rounded-xl px-5 py-3"
        style={{ backgroundColor: "var(--ink)" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/sessions/${id}`)}
            className="flex items-center gap-1 text-sm text-gray-300 transition-colors hover:text-white"
            aria-label="Back to session details"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
          <h1 className="text-base font-semibold text-white">
            {session?.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {liveState === "recording" && (
            <div className="flex items-center gap-2" aria-live="polite">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: "var(--red)" }}
                />
                <span
                  className="relative inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--red)" }}
                />
              </span>
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: "var(--red)" }}
              >
                Live
              </span>
            </div>
          )}
          {liveState === "stopped" && (
            <span className="text-xs font-medium text-gray-400">Ended</span>
          )}
          <span
            className="font-mono text-sm text-gray-300"
            aria-label={`Elapsed time: ${formatTimer(elapsed)}`}
          >
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="mt-4 flex flex-1 gap-4 overflow-hidden">
        {/* Left panel: Transcript */}
        <div className="flex w-1/2 flex-col">
          <LiveTranscript
            transcripts={transcripts}
            sessionStartTime={startTimeRef.current}
          />
        </div>

        {/* Right panel: Cards */}
        <div className="flex w-1/2 flex-col">
          <ActiveCards
            cards={activeCards}
            currentPosition={currentPosition}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="mt-4 flex items-center justify-center gap-4 rounded-xl border border-gray-200 px-6 py-4"
        style={{ backgroundColor: "var(--paper)" }}
        role="toolbar"
        aria-label="Recording controls"
      >
        {liveState === "idle" && (
          <button
            onClick={handleStartRecording}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label="Start recording"
          >
            <Mic size={18} aria-hidden="true" />
            Start Recording
          </button>
        )}

        {liveState === "recording" && (
          <button
            onClick={handleStopRecording}
            className="inline-flex items-center gap-2 rounded-lg border-2 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              borderColor: "var(--red)",
              color: "var(--red)",
              backgroundColor: "rgba(217, 66, 40, 0.06)",
            }}
            aria-label="Stop recording and end session"
          >
            <Square size={18} aria-hidden="true" />
            Stop &amp; End
          </button>
        )}

        {liveState === "stopped" && (
          <button
            onClick={() => router.push(`/sessions/${id}`)}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--ink)" }}
            aria-label="Return to session details"
          >
            Back to Session
          </button>
        )}
      </div>
    </div>
  );
}
