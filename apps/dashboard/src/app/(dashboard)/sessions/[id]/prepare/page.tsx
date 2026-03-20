"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, RefreshCw } from "lucide-react";
import { get } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

interface Session {
  id: string;
  title: string;
  status: "draft" | "preparing" | "ready" | "live" | "completed";
}

interface CardContent {
  text?: string;
  summary?: string;
  [key: string]: unknown;
}

interface Card {
  id: string;
  card_type: "summary" | "comparison" | "concept" | "context_bridge";
  title: string;
  content: string | CardContent;
  display_order: number;
}

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

export default function PreparePage() {
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [steps, setSteps] = useState<Step[]>([
    { label: "Parsing documents", done: false, active: true },
    { label: "Building narrative graph", done: false, active: false },
    { label: "Generating support cards", done: false, active: false },
  ]);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchSession = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<Session>(`/api/sessions/${id}`, signal);
        setSession(data);
        return data;
      } catch (err) {
        if (signal?.aborted) return null;
        setError(
          err instanceof Error ? err.message : "Failed to load session"
        );
        return null;
      }
    },
    [id]
  );

  const fetchCards = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<Card[]>(`/api/sessions/${id}/cards`, signal);
        setCards(data);
      } catch (err) {
        if (signal?.aborted) return;
        console.warn("Failed to fetch cards:", err);
      }
    },
    [id]
  );

  function markAllStepsDone() {
    setSteps((prev) =>
      prev.map((step) => ({ ...step, done: true, active: false }))
    );
  }

  // Simulate step progression while polling
  useEffect(() => {
    if (completed) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, done: true, active: false }
              : i === 1
              ? { ...s, active: true }
              : s
          )
        );
      }, 2000)
    );

    timers.push(
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === 1
              ? { ...s, done: true, active: false }
              : i === 2
              ? { ...s, active: true }
              : s
          )
        );
      }, 5000)
    );

    return () => timers.forEach(clearTimeout);
  }, [completed]);

  // Poll for session status
  useEffect(() => {
    if (completed) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const interval = setInterval(async () => {
      const s = await fetchSession(controller.signal);
      if (controller.signal.aborted) return;

      if (s && s.status === "ready") {
        markAllStepsDone();
        await fetchCards(controller.signal);
        setCompleted(true);
      } else if (s && s.status !== "preparing") {
        // If status is something unexpected (e.g. draft, failed), stop polling
        setError(`Unexpected session status: ${s.status}`);
      }
    }, 3000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [completed, fetchSession, fetchCards]);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      const s = await fetchSession(controller.signal);
      if (controller.signal.aborted) return;

      if (s && s.status === "ready") {
        markAllStepsDone();
        await fetchCards(controller.signal);
        setCompleted(true);
      }
    }
    init();

    return () => {
      controller.abort();
    };
  }, [fetchSession, fetchCards]);

  function handleRetry() {
    setError(null);
    setCompleted(false);
    setSteps([
      { label: "Parsing documents", done: false, active: true },
      { label: "Building narrative graph", done: false, active: false },
      { label: "Generating support cards", done: false, active: false },
    ]);
  }

  const progressPercent = Math.round(
    (steps.filter((s) => s.done).length / steps.length) * 100
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/sessions/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          aria-label="Back to session details"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Session
        </Link>
      </div>

      {/* Header */}
      <h1
        className="mb-6 text-2xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        {completed ? "Preparation Complete" : "Preparing Session"}
        {session ? `: ${session.title}` : ""}
      </h1>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry preparation"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Progress steps */}
      <div
        className="mb-8 rounded-2xl border border-gray-200 p-6"
        style={{ backgroundColor: "var(--paper)" }}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: completed ? "var(--green, #16a34a)" : "var(--red)",
              }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Preparation progress"
            />
          </div>
        </div>

        <div className="space-y-4" role="list" aria-label="Preparation steps">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3"
              role="listitem"
            >
              {/* Step indicator */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? "bg-green-100 text-green-600"
                    : step.active
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-gray-100 text-gray-400"
                }`}
                aria-hidden="true"
              >
                {step.done ? (
                  <Check size={16} />
                ) : step.active ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-sm font-medium ${
                  step.done
                    ? "text-green-700"
                    : step.active
                    ? "text-yellow-700"
                    : "text-gray-400"
                }`}
              >
                Step {index + 1}: {step.label}
                {step.done && (
                  <span className="sr-only"> - completed</span>
                )}
                {step.active && (
                  <span className="sr-only"> - in progress</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cards grid (visible when complete) */}
      {completed && cards.length > 0 && (
        <div className="mb-6">
          <h2
            className="mb-3 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Generated Cards
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards
              .sort((a, b) => a.display_order - b.display_order)
              .map((card) => (
                <SessionCard key={card.id} card={card} />
              ))}
          </div>
        </div>
      )}

      {/* Back to Session button */}
      {completed && (
        <div className="flex justify-end">
          <Link
            href={`/sessions/${id}`}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label="Return to session details"
          >
            Back to Session
          </Link>
        </div>
      )}
    </div>
  );
}
