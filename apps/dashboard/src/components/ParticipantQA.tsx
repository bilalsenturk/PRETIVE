"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { get, post } from "@/lib/api";
import { ChevronUp, Send, CheckCircle2, MessageCircle } from "lucide-react";

interface Question {
  id: string;
  session_id: string;
  text: string;
  participant_name: string;
  status: "pending" | "answered" | "dismissed";
  upvotes: number;
  ai_context: string | null;
  answer: string | null;
  created_at: string;
}

interface ParticipantQAProps {
  sessionId: string;
}

const POLL_INTERVAL = 5000;

export default function ParticipantQA({ sessionId }: ParticipantQAProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchQuestions = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<Question[]>(
          `/api/sessions/${sessionId}/qa/questions`,
          signal
        );
        if (!signal?.aborted) setQuestions(data);
      } catch {
        // Silently ignore poll errors
      }
    },
    [sessionId]
  );

  // Initial load + polling
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchQuestions(controller.signal);

    pollRef.current = setInterval(() => {
      if (!controller.signal.aborted) {
        fetchQuestions(controller.signal);
      }
    }, POLL_INTERVAL);

    return () => {
      controller.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQuestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionText.trim()) return;
    setSubmitting(true);
    try {
      await post(`/api/sessions/${sessionId}/qa/questions`, {
        text: questionText.trim(),
        participant_name: participantName.trim() || "Anonymous",
      });
      setQuestionText("");
      // Refresh immediately
      const controller = new AbortController();
      await fetchQuestions(controller.signal);
    } catch {
      // Could show error
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpvote(questionId: string) {
    if (votedIds.has(questionId)) return;
    try {
      await post(`/api/sessions/${sessionId}/qa/questions/${questionId}/vote`, {
        direction: "up",
      });
      setVotedIds((prev) => new Set([...prev, questionId]));
      const controller = new AbortController();
      await fetchQuestions(controller.signal);
    } catch {
      // Silently ignore
    }
  }

  // Filter out dismissed for participants
  const visibleQuestions = questions.filter((q) => q.status !== "dismissed");

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle size={18} style={{ color: "var(--red, #D94228)" }} />
        <h2
          className="text-base font-bold sm:text-lg"
          style={{ color: "var(--ink, #111)" }}
        >
          Questions &amp; Answers
        </h2>
      </div>

      {/* Ask a question form */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <div className="mb-3">
          <input
            type="text"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Your name (optional)"
            maxLength={100}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            style={{ color: "var(--ink, #111)" }}
          />
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a question..."
            rows={2}
            maxLength={500}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            style={{ color: "var(--ink, #111)" }}
          />
          <button
            type="submit"
            disabled={submitting || !questionText.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--red, #D94228)" }}
            aria-label="Submit question"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      {/* Questions list */}
      {visibleQuestions.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-8 text-center">
          <p className="text-sm text-gray-400">
            No questions yet. Be the first to ask!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleQuestions.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                {/* Upvote button */}
                <button
                  onClick={() => handleUpvote(q.id)}
                  disabled={votedIds.has(q.id)}
                  className={`flex flex-shrink-0 flex-col items-center rounded-xl px-2 py-1.5 transition-colors ${
                    votedIds.has(q.id)
                      ? "bg-red-50"
                      : "bg-gray-50 hover:bg-red-50"
                  }`}
                  aria-label={`Upvote (${q.upvotes})`}
                >
                  <ChevronUp
                    size={16}
                    className={
                      votedIds.has(q.id) ? "text-red-500" : "text-gray-500"
                    }
                    style={
                      votedIds.has(q.id)
                        ? { color: "var(--red, #D94228)" }
                        : undefined
                    }
                  />
                  <span
                    className={`text-xs font-bold ${
                      votedIds.has(q.id) ? "text-red-600" : "text-gray-600"
                    }`}
                    style={
                      votedIds.has(q.id)
                        ? { color: "var(--red, #D94228)" }
                        : undefined
                    }
                  >
                    {q.upvotes}
                  </span>
                </button>

                {/* Question content */}
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--ink, #111)" }}
                    >
                      {q.participant_name}
                    </span>
                    {q.status === "answered" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        <CheckCircle2 size={10} /> Answered
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--ink, #111)" }}
                  >
                    {q.text}
                  </p>

                  {/* Answer display */}
                  {q.answer && q.status === "answered" && (
                    <div className="mt-2 rounded-xl bg-green-50/60 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">
                        Answer
                      </span>
                      <p className="mt-0.5 text-sm leading-relaxed text-green-800">
                        {q.answer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
