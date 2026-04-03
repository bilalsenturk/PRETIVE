"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mic, Square, Loader2, MessageCircleQuestion,
  Monitor, ChevronRight, Sparkles, BarChart3,
} from "lucide-react";
import { get, post } from "@/lib/api";
import { startSpeechStream, type SpeechStream } from "@/lib/speech";
import LiveTranscript, { type TranscriptEntry } from "@/components/LiveTranscript";
import QAPanel from "@/components/QAPanel";
import Suggestions, { type Suggestion } from "@/components/Suggestions";
import SlideProgressStrip, { type Slide } from "@/components/SlideProgressStrip";

interface Session { id: string; title: string; status: string; }

interface Card {
  id: string; card_type: string; title: string;
  content: string | { text?: string }; display_order: number;
}

interface MatchResponse {
  cards: Card[];
  position: { heading?: string; chunk_index?: number } | string | null;
  verification?: { status: string; confidence: number } | null;
  suggestions?: Suggestion[];
  prompter?: {
    transition_sentence?: string | null;
    key_reminders?: Array<{ point: string; source_topic: string }>;
    structure_hint?: { type: string; message: string };
  };
}

interface CommandResult {
  content_type: string;
  content: Record<string, unknown>;
  title: string;
}

// Detect voice commands in transcript
const COMMAND_PATTERNS: Array<{ type: string; pattern: RegExp; label: string }> = [
  { type: "generate_chart", pattern: /grafik\s*(göster|hazırla|oluştur)|chart\s*(göster|hazırla|show)/i, label: "Chart" },
  { type: "generate_table", pattern: /tablo\s*(göster|hazırla|oluştur)|karşılaştırma\s*(yap|göster)/i, label: "Table" },
  { type: "generate_summary", pattern: /(özetle|özet\s*göster|toparlayalım|summarize)/i, label: "Summary" },
  { type: "generate_timeline", pattern: /(timeline|zaman\s*çizelgesi|kronoloji)/i, label: "Timeline" },
  { type: "generate_list", pattern: /(madde\s*madde|listele|liste\s*göster|bullet)/i, label: "List" },
  { type: "next_item", pattern: /(sonraki\s*(madde|nokta|item|point)|next\s*(item|point|bullet)|devam\s*et(elim)?)/i, label: "Next Item" },
  { type: "next_topic", pattern: /(sonraki\s*konu|sıradaki|bu\s*konuyu?\s*kapat|next\s*topic)/i, label: "Next Topic" },
];

function detectCommand(text: string) {
  for (const cmd of COMMAND_PATTERNS) {
    if (cmd.pattern.test(text)) return cmd;
  }
  return null;
}

export default function PresenterControlPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liveState, setLiveState] = useState<"idle" | "recording" | "stopped">("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentPosition, setCurrentPosition] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number | null>(null);
  const [coveredSlides, setCoveredSlides] = useState<Set<number>>(new Set());
  const [qaOpen, setQaOpen] = useState(false);
  const [qaPendingCount, setQaPendingCount] = useState(0);

  // Command state
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [displayOpened, setDisplayOpened] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<SpeechStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const matchAbortRef = useRef<AbortController | null>(null);
  const recentTranscriptsRef = useRef<string[]>([]);
  const summaryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordCount = useMemo(() => {
    return transcripts
      .filter((t) => t.isFinal)
      .reduce((count, t) => count + t.text.trim().split(/\s+/).filter(Boolean).length, 0);
  }, [transcripts]);

  // Poll Q&A
  useEffect(() => {
    let cancelled = false;
    async function pollQA() {
      try {
        const res = await get<{ id: string; status: string }[]>(`/api/sessions/${id}/qa/questions`);
        if (!cancelled) setQaPendingCount(res.filter((q) => q.status === "pending").length);
      } catch {}
    }
    pollQA();
    const interval = setInterval(pollQA, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  // Init session
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    async function init() {
      try {
        const data = await get<Session>(`/api/sessions/${id}`, controller.signal);
        setSession(data);
        await post(`/api/sessions/${id}/live/start`, {}, controller.signal);
        // Init display theme
        await post(`/api/sessions/${id}/live/display`, { theme: "dark", total_slides: 0 }, controller.signal);
        try {
          const slidesRes = await get<{ slides: Slide[]; total: number }>(`/api/sessions/${id}/live/slides`, controller.signal);
          if (slidesRes.slides) {
            setSlides(slidesRes.slides);
            await post(`/api/sessions/${id}/live/display`, { total_slides: slidesRes.total }, controller.signal);
          }
        } catch {}
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    init();
    return () => controller.abort();
  }, [id]);

  // Cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (matchAbortRef.current) matchAbortRef.current.abort();
      if (summaryIntervalRef.current) clearInterval(summaryIntervalRef.current);
    };
  }, []);

  // Execute a voice command
  const executeCommand = useCallback(async (commandType: string, label: string) => {
    setCommandLoading(true);
    setLastCommand(`${label} generating...`);
    try {
      const result = await post<CommandResult>(`/api/sessions/${id}/live/command`, {
        command_type: commandType,
        context_text: recentTranscriptsRef.current.slice(-10).join(" "),
        current_topic: currentPosition,
      });
      setLastCommand(`${label}: ${result.title}`);
    } catch {
      setLastCommand(`${label} failed`);
    } finally {
      setCommandLoading(false);
    }
  }, [id, currentPosition]);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    const now = Date.now();
    if (isFinal) {
      setTranscripts((prev) => [...prev.filter((t) => t.isFinal), { text, isFinal: true, timestamp: now }]);
      recentTranscriptsRef.current.push(text);
      if (recentTranscriptsRef.current.length > 20) recentTranscriptsRef.current.shift();

      // Check for voice commands
      const cmd = detectCommand(text);
      if (cmd) {
        executeCommand(cmd.type, cmd.label);
        return; // Don't send command text as a regular match
      }

      // Regular match
      if (matchAbortRef.current) matchAbortRef.current.abort();
      const mc = new AbortController();
      matchAbortRef.current = mc;

      post<MatchResponse>(`/api/sessions/${id}/live/match`, { text }, mc.signal)
        .then((res) => {
          if (mc.signal.aborted) return;
          if (res.cards?.length > 0) {
            setMatchCount((prev) => prev + 1);
            // Update display with cards
            post(`/api/sessions/${id}/live/display`, {
              active_cards: res.cards.map((c) => c.id),
              display_content: null, // Clear dynamic content, show cards
            }).catch(() => {});
          }
          const pos = res.position;
          if (pos && typeof pos === "object" && "heading" in pos && pos.heading) {
            setCurrentPosition(pos.heading);
            post(`/api/sessions/${id}/live/display`, {
              current_heading: pos.heading,
              current_slide: pos.chunk_index,
            }).catch(() => {});
          }
          if (pos && typeof pos === "object" && "chunk_index" in pos && pos.chunk_index != null) {
            const ci = pos.chunk_index as number;
            setCurrentSlideIndex(ci);
            setCoveredSlides((prev) => new Set([...prev, ci]));
          }
          if (res.suggestions?.length) {
            setSuggestions((prev) => [...res.suggestions!, ...prev]);
          }
          if (res.prompter?.transition_sentence) {
            setSuggestions((prev) => [{
              type: "prompter_transition" as const,
              title: "Transition", message: res.prompter!.transition_sentence!,
              priority: "medium" as const,
            }, ...prev]);
          }
        })
        .catch(() => {});
    } else {
      setTranscripts((prev) => [...prev.filter((t) => t.isFinal), { text, isFinal: false, timestamp: now }]);
    }
  }, [id, executeCommand]);

  function handleStartRecording() {
    setError(null);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setMatchCount(0);
    setLiveState("recording");

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Live summary every 60s
    summaryIntervalRef.current = setInterval(() => {
      if (recentTranscriptsRef.current.length > 0) {
        post(`/api/sessions/${id}/live/summarize`, {
          recent_transcripts: recentTranscriptsRef.current.slice(-10),
          current_topic: currentPosition,
        }).catch(() => {});
      }
    }, 60000);

    try {
      const stream = startSpeechStream(handleTranscript, (err) => {
        setError(err.message);
        handleStopRecording();
      });
      streamRef.current = stream;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      if (timerRef.current) clearInterval(timerRef.current);
      setLiveState("idle");
    }
  }

  function handleStopRecording() {
    streamRef.current?.stop();
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (summaryIntervalRef.current) { clearInterval(summaryIntervalRef.current); summaryIntervalRef.current = null; }
    matchAbortRef.current?.abort();
    setLiveState("stopped");
    post(`/api/sessions/${id}/live/stop`, {}).catch(() => {});
  }

  function openPresenterDisplay() {
    window.open(`/sessions/${id}/present`, "pretive-display", "width=1280,height=720");
    setDisplayOpened(true);
  }

  function navigateToSlide(index: number) {
    post(`/api/sessions/${id}/live/navigate`, { slide_index: index }).then((data: any) => {
      setCurrentSlideIndex(index);
      setCoveredSlides((prev) => new Set([...prev, index]));
      if (data.position?.heading) setCurrentPosition(data.position.heading);
      post(`/api/sessions/${id}/live/display`, {
        current_heading: data.position?.heading,
        current_slide: index,
        active_cards: data.cards?.map((c: Card) => c.id) || [],
        display_content: null,
      }).catch(() => {});
    }).catch(() => setCurrentSlideIndex(index));
  }

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl px-5 py-3" style={{ backgroundColor: "var(--ink)" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/sessions/${id}`)} className="flex items-center gap-1 text-sm text-gray-300 hover:text-white">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-base font-semibold text-white">{session?.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {liveState === "recording" && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: "var(--red)" }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--red)" }} />
              </span>
              <span className="text-xs font-semibold uppercase" style={{ color: "var(--red)" }}>Live</span>
            </div>
          )}
          <span className="font-mono text-sm text-gray-300">{formatTimer(elapsed)}</span>

          {/* Open Presenter Display */}
          <button
            onClick={openPresenterDisplay}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              displayOpened ? "bg-green-500/20 text-green-300" : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            <Monitor size={14} />
            {displayOpened ? "Display Open" : "Open Display"}
          </button>

          <button
            onClick={() => setQaOpen((prev) => !prev)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              qaOpen ? "bg-white/20 text-white" : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <MessageCircleQuestion size={16} /> Q&A
            {qaPendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: "var(--red)" }}>
                {qaPendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {liveState !== "idle" && (
        <div className="mt-3 flex items-center gap-6 rounded-lg border border-gray-200 px-5 py-2.5" style={{ backgroundColor: "var(--paper)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Words</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>{wordCount}</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Matches</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "var(--ink)" }}>{matchCount}</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          {/* Last command */}
          {lastCommand && (
            <div className="flex items-center gap-2">
              <Sparkles size={14} className={commandLoading ? "animate-spin text-amber-500" : "text-green-500"} />
              <span className="text-xs font-medium text-gray-600">{lastCommand}</span>
            </div>
          )}
        </div>
      )}

      {/* Current topic */}
      {currentPosition && liveState !== "idle" && (
        <div className="mt-3 rounded-lg px-5 py-3" style={{ backgroundColor: "rgba(217, 66, 40, 0.08)" }}>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Current</span>
          <p className="mt-0.5 text-lg font-semibold" style={{ color: "var(--ink)" }}>{currentPosition}</p>
        </div>
      )}

      {/* Slide strip */}
      {slides.length > 0 && liveState !== "idle" && (
        <div className="mt-3 rounded-xl border border-gray-200 px-4 py-3" style={{ backgroundColor: "var(--paper)" }}>
          <SlideProgressStrip slides={slides} currentIndex={currentSlideIndex} coveredIndexes={coveredSlides} onSelectSlide={navigateToSlide} />
        </div>
      )}

      {/* Main content: Transcript + Q&A */}
      <div className="mt-4 flex flex-1 gap-4 overflow-hidden">
        <div className={`flex flex-col ${qaOpen ? "w-2/3" : "w-full"}`}>
          <LiveTranscript transcripts={transcripts} sessionStartTime={startTimeRef.current} currentHeading={currentPosition} verification={null} />
        </div>
        {qaOpen && (
          <div className="flex w-1/3 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <QAPanel sessionId={id} />
          </div>
        )}
      </div>

      {/* Suggestions */}
      {liveState !== "idle" && (
        <Suggestions suggestions={suggestions} onDismiss={(i) => setSuggestions((prev) => prev.filter((_, idx) => idx !== i))} />
      )}

      {/* Quick command buttons */}
      {liveState === "recording" && (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto px-1 py-1">
          {COMMAND_PATTERNS.filter((c) => c.type !== "next_topic" && c.type !== "next_item").map((cmd) => (
            <button
              key={cmd.type}
              onClick={() => executeCommand(cmd.type, cmd.label)}
              disabled={commandLoading}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#D94228] hover:text-[#D94228] disabled:opacity-40"
            >
              <BarChart3 size={12} className="mr-1 inline-block -mt-0.5" />
              {cmd.label}
            </button>
          ))}
          <button
            onClick={() => executeCommand("next_item", "Next Item")}
            disabled={commandLoading}
            className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-40"
          >
            <ChevronRight size={12} className="mr-1 inline-block -mt-0.5" />
            Next Item
          </button>
          <button
            onClick={() => executeCommand("next_topic", "Next Topic")}
            disabled={commandLoading}
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-40"
          >
            <ChevronRight size={12} className="mr-1 inline-block -mt-0.5" />
            Next Topic
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div className="mt-3 flex items-center justify-center gap-4 rounded-xl border border-gray-200 px-6 py-4" style={{ backgroundColor: "var(--paper)" }}>
        {liveState === "idle" && (
          <div className="flex items-center gap-4">
            <button onClick={openPresenterDisplay} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Monitor size={18} /> Open Display First
            </button>
            <button onClick={handleStartRecording} className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: "var(--red)" }}>
              <Mic size={18} /> Start Presenting
            </button>
          </div>
        )}
        {liveState === "recording" && (
          <button onClick={handleStopRecording} className="inline-flex items-center gap-2 rounded-lg border-2 px-6 py-3 text-sm font-semibold hover:opacity-90" style={{ borderColor: "var(--red)", color: "var(--red)", backgroundColor: "rgba(217, 66, 40, 0.06)" }}>
            <Square size={18} /> End Presentation
          </button>
        )}
        {liveState === "stopped" && (
          <button onClick={() => router.push(`/sessions/${id}/analytics`)} className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: "var(--ink)" }}>
            View Analytics
          </button>
        )}
      </div>
    </div>
  );
}
