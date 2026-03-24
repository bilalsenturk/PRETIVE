"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Loader2, MessageCircleQuestion } from "lucide-react";
import { get, post } from "@/lib/api";
import { startSpeechStream, type SpeechStream } from "@/lib/speech";
import LiveTranscript, {
  type TranscriptEntry,
} from "@/components/LiveTranscript";
import ActiveCards from "@/components/ActiveCards";
import { type Verification } from "@/components/VerificationBadge";
import Suggestions, { type Suggestion } from "@/components/Suggestions";
import SlideProgressStrip, { type Slide } from "@/components/SlideProgressStrip";
import PresentationProgress from "@/components/PresentationProgress";
import QAPanel from "@/components/QAPanel";

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
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number | null>(null);
  const [coveredSlides, setCoveredSlides] = useState<Set<number>>(new Set());
  const [qaOpen, setQaOpen] = useState(false);
  const [qaPendingCount, setQaPendingCount] = useState(0);
  const prevPositionRef = useRef<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<SpeechStream | null>(null);
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

  // Poll Q&A pending count
  useEffect(() => {
    let cancelled = false;
    async function pollQA() {
      try {
        const res = await get<{ id: string; status: string }[]>(
          `/api/sessions/${id}/qa/questions`
        );
        if (!cancelled) {
          setQaPendingCount(res.filter((q) => q.status === "pending").length);
        }
      } catch {
        // Ignore
      }
    }
    pollQA();
    const interval = setInterval(pollQA, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

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

        // Fetch slides for screen intelligence
        try {
          const slidesRes = await get<{ slides: Slide[]; total: number }>(
            `/api/sessions/${id}/live/slides`,
            controller.signal
          );
          if (slidesRes.slides) {
            setSlides(slidesRes.slides);
          }
        } catch {
          // Slides may not be available for all sessions — non-blocking
        }
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
            // Track slide position for screen intelligence
            if (
              res.position &&
              typeof res.position === "object" &&
              res.position.chunk_index != null
            ) {
              const chunkIdx = res.position.chunk_index;
              setCurrentSlideIndex(chunkIdx);
              setCoveredSlides((prev) => new Set([...prev, chunkIdx]));
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
      const stream = startSpeechStream(handleTranscript, (err) => {
        setError(err.message);
        handleStopRecording();
      });
      streamRef.current = stream;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLiveState("idle");
    }
  }

  // Navigate to a specific slide manually
  async function navigateToSlide(index: number) {
    try {
      const data = await post<MatchResponse>(
        `/api/sessions/${id}/live/navigate`,
        { slide_index: index }
      );
      setCurrentSlideIndex(index);
      setCoveredSlides((prev) => new Set([...prev, index]));
      if (data.cards && data.cards.length > 0) setActiveCards(data.cards);
      if (data.position) setCurrentPosition(resolvePosition(data.position));
    } catch {
      // Navigation failed — just update the index locally
      setCurrentSlideIndex(index);
    }
  }

  // Keyboard shortcuts for slide navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "ArrowLeft" &&
        currentSlideIndex != null &&
        currentSlideIndex > 0
      ) {
        navigateToSlide(currentSlideIndex - 1);
      }
      if (
        e.key === "ArrowRight" &&
        currentSlideIndex != null &&
        currentSlideIndex < slides.length - 1
      ) {
        navigateToSlide(currentSlideIndex + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideIndex, slides.length]);

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
          <button
            onClick={() => setQaOpen((prev) => !prev)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              qaOpen
                ? "bg-white/20 text-white"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Toggle Q&A panel"
          >
            <MessageCircleQuestion size={16} />
            Q&A
            {qaPendingCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: "var(--red)" }}
              >
                {qaPendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Live stats bar */}
      {liveState !== "idle" && (
        <div className="mt-3 flex items-center gap-6 rounded-lg border border-gray-200 px-5 py-2.5" style={{ backgroundColor: "var(--paper)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Duration</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {formatTimer(elapsed)}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Words</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {wordCount}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Matches</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {matchCount}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          {/* Match confidence indicator */}
          <div className="flex items-center gap-2">
            {lastMatchHadCards === null ? (
              <span className="text-xs text-gray-400">Waiting...</span>
            ) : lastMatchHadCards ? (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-600">High Match</span>
              </>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
                <span className="text-xs font-medium text-gray-400">No match</span>
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
            Current
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

      {/* Slide progress strip + presentation progress */}
      {slides.length > 0 && liveState !== "idle" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 px-4 py-3" style={{ backgroundColor: "var(--paper)" }}>
          <SlideProgressStrip
            slides={slides}
            currentIndex={currentSlideIndex}
            coveredIndexes={coveredSlides}
            onSelectSlide={navigateToSlide}
          />
          <PresentationProgress
            totalSlides={slides.length}
            coveredCount={coveredSlides.size}
            currentIndex={currentSlideIndex}
            elapsedSeconds={elapsed}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden md:flex-row">
        {/* Left panel: Transcript */}
        <div className={`flex flex-col ${qaOpen ? "md:w-1/3" : "md:w-1/2"} w-full`}>
          <LiveTranscript
            transcripts={transcripts}
            sessionStartTime={startTimeRef.current}
            currentHeading={currentPosition}
            verification={verification}
          />
        </div>

        {/* Middle panel: Cards */}
        <div className={`flex flex-col ${qaOpen ? "md:w-1/3" : "md:w-1/2"} w-full`}>
          {/* Slide context */}
          {slides.length > 0 && currentSlideIndex != null && slides[currentSlideIndex] && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
              <span className="inline-flex items-center justify-center rounded-lg bg-[#D94228] px-2 py-0.5 text-xs font-bold text-white">
                {slides[currentSlideIndex].slide_number}
              </span>
              <span className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
                {slides[currentSlideIndex].heading || `Slide ${slides[currentSlideIndex].slide_number}`}
              </span>
            </div>
          )}
          <ActiveCards
            cards={activeCards}
            currentPosition={currentPosition}
          />
        </div>

        {/* Right panel: Q&A (sliding panel) */}
        {qaOpen && (
          <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white md:w-1/3">
            <QAPanel sessionId={id} />
          </div>
        )}
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
            Go to Summary
          </button>
        )}
      </div>
    </div>
  );
}
