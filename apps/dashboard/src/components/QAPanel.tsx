"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { get, patch } from "@/lib/api";
import { X, ChevronUp, MessageCircle, CheckCircle2 } from "lucide-react";

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

interface QAPanelProps {
  sessionId: string;
}

const POLL_INTERVAL = 5000;

export default function QAPanel({ sessionId }: QAPanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pendingCount = questions.filter((q) => q.status === "pending").length;

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

  async function handleAnswer(questionId: string) {
    if (!answerText.trim()) return;
    setSubmitting(true);
    try {
      await patch(
        `/api/sessions/${sessionId}/qa/questions/${questionId}/answer`,
        { answer: answerText.trim() }
      );
      setAnsweringId(null);
      setAnswerText("");
      // Refresh immediately
      const controller = new AbortController();
      await fetchQuestions(controller.signal);
    } catch {
      // Could show toast here
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDismiss(questionId: string) {
    try {
      await patch(
        `/api/sessions/${sessionId}/qa/questions/${questionId}/dismiss`,
        {}
      );
      const controller = new AbortController();
      await fetchQuestions(controller.signal);
    } catch {
      // Silently ignore
    }
  }

  function statusBadge(status: Question["status"]) {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-700">
            Pending
          </span>
        );
      case "answered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            <CheckCircle2 size={10} /> Answered
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Dismissed
          </span>
        );
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: "var(--red, #D94228)" }} />
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--ink, #111)" }}
          >
            Q&A
          </h2>
          {pendingCount > 0 && (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--red, #D94228)" }}
            >
              {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {questions.length === 0 ? (
          <div className="py-12 text-center">
            <MessageCircle
              size={32}
              className="mx-auto mb-3 text-gray-300"
            />
            <p className="text-sm text-gray-400">
              No questions yet. Participants can submit questions during the
              session.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                {/* Question header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--ink, #111)" }}
                      >
                        {q.participant_name}
                      </span>
                      {statusBadge(q.status)}
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--ink, #111)" }}
                    >
                      {q.text}
                    </p>
                  </div>

                  {/* Upvote count + actions */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1">
                      <ChevronUp size={14} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600">
                        {q.upvotes}
                      </span>
                    </div>
                    {q.status === "pending" && (
                      <button
                        onClick={() => handleDismiss(q.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Dismiss question"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* AI context hint */}
                {q.ai_context && q.status === "pending" && (
                  <div className="mb-2 rounded-xl bg-blue-50/60 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                      AI Suggestion
                    </span>
                    <p className="mt-0.5 text-xs leading-relaxed text-blue-700">
                      {q.ai_context.length > 200
                        ? q.ai_context.slice(0, 200) + "..."
                        : q.ai_context}
                    </p>
                  </div>
                )}

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

                {/* Answer input (inline) */}
                {q.status === "pending" && answeringId === q.id && (
                  <div className="mt-2">
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Type your answer..."
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-gray-300 focus:bg-white"
                      style={{ color: "var(--ink, #111)" }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleAnswer(q.id)}
                        disabled={submitting || !answerText.trim()}
                        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: "var(--red, #D94228)" }}
                      >
                        {submitting ? "Sending..." : "Submit Answer"}
                      </button>
                      <button
                        onClick={() => {
                          setAnsweringId(null);
                          setAnswerText("");
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Answer button */}
                {q.status === "pending" && answeringId !== q.id && (
                  <button
                    onClick={() => {
                      setAnsweringId(q.id);
                      setAnswerText("");
                    }}
                    className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-50"
                    style={{ color: "var(--red, #D94228)" }}
                  >
                    Answer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
