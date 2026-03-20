"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Loader2 } from "lucide-react";
import { get, post } from "@/lib/api";
import { startDeepgramStream, type DeepgramStream } from "@/lib/deepgram";
import LiveTranscript, {
  type TranscriptEntry,
} from "@/components/LiveTranscript";
import ActiveCards from "@/components/ActiveCards";
import { type Verification } from "@/components/VerificationBadge";
import Suggestions, { type Suggestion } from "@/components/Suggestions";

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
  verification?: Verification | null;
  suggestions?: Suggestion[];
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
  const [matchCount, setMatchCount] = useState(0);
  const [lastMatchHadCards, setLastMatchHadCards] = useState<boolean | null>(null);
  const [topicVisible, setTopicVisible] = useState(true);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const prevPositionRef = useRef<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<DeepgramStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const matchAbortRef = useRef<AbortController | null>(null);

  // Word count from all final transcripts
  const wordCount = useMemo(() => {
    return transcripts
      .filter((t) => t.isFinal)
      .reduce((count, t) => {
        const words = t.text.trim().split(/\s+/).filter(Boolean);
        return count + words.length;
      }, 0);
  }, [transcripts]);

  // Animate topic transitions
  useEffect(() => {
    if (currentPosition !== prevPositionRef.current) {
      setTopicVisible(false);
      const timer = setTimeout(() => {
        setTopicVisible(true);
        prevPositionRef.current = currentPosition;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentPosition]);

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
            const hasCards = res.cards && res.cards.length > 0;
            if (hasCards) {
              setActiveCards(res.cards);
              setMatchCount((prev) => prev + 1);
            }
            setLastMatchHadCards(hasCards);
            const resolved = resolvePosition(res.position);
            if (resolved) {
              setCurrentPosition(resolved);
            }
            if (res.verification) {
              setVerification(res.verification);
            }
            if (res.suggestions && res.suggestions.length > 0) {
              setSuggestions((prev) => {
                const combined = [...prev, ...res.suggestions!];
                return combined;
              });
            }
          })
          .catch((matchErr) => {
            if (matchController.signal.aborted) return;
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
    setMatchCount(0);
    setLastMatchHadCards(null);
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

      {/* Live stats bar */}
      {liveState !== "idle" && (
        <div className="mt-3 flex items-center gap-6 rounded-lg border border-gray-200 px-5 py-2.5" style={{ backgroundColor: "var(--paper)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Sure</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {formatTimer(elapsed)}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Kelime</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {wordCount}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Eslesme</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {matchCount}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          {/* Match confidence indicator */}
          <div className="flex items-center gap-2">
            {lastMatchHadCards === null ? (
              <span className="text-xs text-gray-400">Bekleniyor...</span>
            ) : lastMatchHadCards ? (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-600">Yuksek Eslesme</span>
              </>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
                <span className="text-xs font-medium text-gray-400">Eslesme yok</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Current topic banner */}
      {currentPosition && liveState !== "idle" && (
        <div
          className="mt-3 rounded-lg px-5 py-3 transition-opacity duration-300"
          style={{
            backgroundColor: "rgba(217, 66, 40, 0.08)",
            opacity: topicVisible ? 1 : 0,
          }}
          aria-live="polite"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Su an
          </span>
          <p className="mt-0.5 text-lg font-semibold" style={{ color: "var(--ink)" }}>
            {currentPosition}
          </p>
        </div>
      )}

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
            currentHeading={currentPosition}
            verification={verification}
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

      {/* Suggestions strip */}
      {liveState !== "idle" && (
        <Suggestions
          suggestions={suggestions}
          onDismiss={(index) =>
            setSuggestions((prev) => prev.filter((_, i) => i !== index))
          }
        />
      )}

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
            onClick={() => router.push(`/sessions/${id}/summary`)}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--ink)" }}
            aria-label="View session summary"
          >
            Ozete Git
          </button>
        )}
      </div>
    </div>
  );
}
