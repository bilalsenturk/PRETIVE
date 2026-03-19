"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { get } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

interface Session {
  id: string;
  title: string;
  status: "draft" | "preparing" | "ready" | "live" | "completed";
}

interface Card {
  id: string;
  card_type: "summary" | "comparison" | "concept" | "context_bridge";
  title: string;
  content: string;
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

  const fetchSession = useCallback(async () => {
    try {
      const data = await get<Session>(`/api/sessions/${id}`);
      setSession(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
      return null;
    }
  }, [id]);

  // Simulate step progression while polling
  useEffect(() => {
    if (completed) return;

    const timers: NodeJS.Timeout[] = [];

    // Step 1 completes after 2s
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

    // Step 2 completes after 5s
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

    const interval = setInterval(async () => {
      const s = await fetchSession();
      if (s && s.status === "ready") {
        // Mark all steps done
        setSteps((prev) =>
          prev.map((step) => ({ ...step, done: true, active: false }))
        );
        // Fetch generated cards
        try {
          const cardsData = await get<Card[]>(`/api/sessions/${id}/cards`);
          setCards(cardsData);
        } catch {
          // Cards fetch may fail
        }
        setCompleted(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [completed, fetchSession, id]);

  // Initial load
  useEffect(() => {
    async function init() {
      const s = await fetchSession();
      if (s && s.status === "ready") {
        setSteps((prev) =>
          prev.map((step) => ({ ...step, done: true, active: false }))
        );
        try {
          const cardsData = await get<Card[]>(`/api/sessions/${id}/cards`);
          setCards(cardsData);
        } catch {
          // ignore
        }
        setCompleted(true);
      }
    }
    init();
  }, [fetchSession, id]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/sessions/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={16} />
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
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Progress steps */}
      <div
        className="mb-8 rounded-2xl border border-gray-200 p-6"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {/* Step indicator */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? "bg-green-100 text-green-600"
                    : step.active
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-gray-100 text-gray-400"
                }`}
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
                {step.done && " \u2713"}
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
          >
            Back to Session
          </Link>
        </div>
      )}
    </div>
  );
}
