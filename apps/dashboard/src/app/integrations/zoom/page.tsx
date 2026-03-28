"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { get, post } from "@/lib/api";
import { Loader2, Play, Square, Zap } from "lucide-react";
import ActiveCards from "@/components/ActiveCards";
import Suggestions, { type Suggestion } from "@/components/Suggestions";

interface Session {
  id: string;
  title: string;
  status: string;
}

interface Card {
  id: string;
  card_type: string;
  title: string;
  content: string | { text?: string; [key: string]: unknown };
  display_order: number;
}

interface MatchResponse {
  cards: Card[];
  position: { heading?: string; chunk_index?: number } | string | null;
  suggestions?: Suggestion[];
  prompter?: {
    transition_sentence?: string | null;
    key_reminders?: Array<{ point: string; source_topic: string }>;
    structure_hint?: { type: string; message: string };
  };
}

export default function ZoomPanelPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [activeCards, setActiveCards] = useState<Card[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [currentPosition, setCurrentPosition] = useState<string | null>(null);
  const [transcriptInput, setTranscriptInput] = useState("");
  const matchAbortRef = useRef<AbortController | null>(null);

  // Load sessions on mount
  useEffect(() => {
    get<Session[]>("/api/sessions")
      .then((data) => {
        setSessions(data.filter((s) => s.status === "ready" || s.status === "live"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleStartLive = useCallback(async () => {
    if (!selectedSession) return;
    try {
      await post(`/api/sessions/${selectedSession.id}/live/start`, {});
      setIsLive(true);
    } catch (err) {
      console.error("Failed to start live session:", err);
    }
  }, [selectedSession]);

  const handleStopLive = useCallback(async () => {
    if (!selectedSession) return;
    try {
      await post(`/api/sessions/${selectedSession.id}/live/stop`, {});
      setIsLive(false);
    } catch (err) {
      console.error("Failed to stop live session:", err);
    }
  }, [selectedSession]);

  const handleSendTranscript = useCallback(async () => {
    if (!selectedSession || !transcriptInput.trim()) return;

    if (matchAbortRef.current) matchAbortRef.current.abort();
    const controller = new AbortController();
    matchAbortRef.current = controller;

    try {
      const res = await post<MatchResponse>(
        `/api/sessions/${selectedSession.id}/live/match`,
        { text: transcriptInput.trim() },
        controller.signal
      );

      if (res.cards?.length > 0) setActiveCards(res.cards);
      if (res.position) {
        const heading =
          typeof res.position === "string"
            ? res.position
            : res.position?.heading || null;
        if (heading) setCurrentPosition(heading);
      }
      if (res.suggestions?.length) {
        setSuggestions((prev) => [...res.suggestions!, ...prev]);
      }
      // Handle prompter
      if (res.prompter?.transition_sentence) {
        setSuggestions((prev) => [
          {
            type: "prompter_transition" as const,
            title: "Transition",
            message: res.prompter!.transition_sentence!,
            priority: "medium" as const,
          },
          ...prev,
        ]);
      }

      setTranscriptInput("");
    } catch {
      // ignore aborted
    }
  }, [selectedSession, transcriptInput]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Session selector
  if (!selectedSession) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Zap size={20} style={{ color: "#D94228" }} />
          <h1 className="text-lg font-bold text-gray-900">Pretive</h1>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Select a session to start live presentation support.
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">
            No ready sessions found. Create a session in the dashboard first.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:border-[#D94228] hover:bg-red-50/50"
              >
                <p className="text-sm font-medium text-gray-900">{session.title}</p>
                <p className="text-xs text-gray-400">{session.status}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Compact live view
  return (
    <div className="flex h-screen flex-col p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} style={{ color: "#D94228" }} />
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">
            {selectedSession.title}
          </span>
        </div>
        {isLive ? (
          <button
            onClick={handleStopLive}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Square size={12} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleStartLive}
            className="inline-flex items-center gap-1 rounded-lg bg-[#D94228] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c13a23]"
          >
            <Play size={12} />
            Go Live
          </button>
        )}
      </div>

      {/* Current position */}
      {currentPosition && (
        <div className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-[#D94228]">
          {currentPosition}
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto">
        <ActiveCards cards={activeCards} currentPosition={currentPosition} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Suggestions
          suggestions={suggestions}
          onDismiss={(i) => setSuggestions((prev) => prev.filter((_, idx) => idx !== i))}
        />
      )}

      {/* Transcript input (for manual input when mic not available in iframe) */}
      {isLive && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={transcriptInput}
            onChange={(e) => setTranscriptInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendTranscript()}
            placeholder="Paste transcript here..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D94228] focus:outline-none"
          />
          <button
            onClick={handleSendTranscript}
            disabled={!transcriptInput.trim()}
            className="rounded-lg bg-[#D94228] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c13a23] disabled:opacity-40"
          >
            Match
          </button>
        </div>
      )}
    </div>
  );
}
