"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Target,
  Layers,
  CreditCard,
  Loader2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { get, post } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  title: string;
  status: string;
  created_at: string;
  metadata?: { summary?: string } | null;
}

interface Analytics {
  session_id: string;
  duration_seconds: number;
  total_events: number;
  match_events: number;
  match_hit_rate: number;
  total_chunks: number;
  matched_chunk_ids: string[];
  coverage_rate: number;
  total_cards: number;
  cards_shown: number;
  avg_response_ms: number;
  topics_covered: string[];
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

interface SummaryResult {
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse" role="status">
      <div className="mb-6 h-4 w-32 rounded bg-gray-200" />
      <div className="mb-2 h-8 w-72 rounded bg-gray-200" />
      <div className="mb-8 h-5 w-48 rounded bg-gray-200" />

      {/* Stats row skeleton */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-gray-200 bg-gray-50"
          />
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="mb-8 rounded-2xl border border-gray-200 p-6">
        <div className="mb-3 h-5 w-40 rounded bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-5/6 rounded bg-gray-200" />
          <div className="h-4 w-4/6 rounded bg-gray-200" />
        </div>
      </div>

      <span className="sr-only">Loading session summary...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl border border-gray-200 p-4"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
          aria-hidden="true"
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p
        className="text-xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SessionSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        // Fetch session, analytics, and cards in parallel
        const [sessionData, analyticsData, cardsData] = await Promise.all([
          get<Session>(`/api/sessions/${id}`, signal),
          get<Analytics>(`/api/sessions/${id}/analytics`, signal),
          get<Card[]>(`/api/sessions/${id}/cards`, signal),
        ]);

        if (signal?.aborted) return;

        setSession(sessionData);
        setAnalytics(analyticsData);
        setCards(cardsData);

        // Check if summary already exists in session metadata
        const existingSummary = sessionData.metadata?.summary;
        if (existingSummary) {
          setSummary(existingSummary);
        }
      } catch (err) {
        if (signal?.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load session data";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  // Generate summary via LLM
  const generateSummary = useCallback(
    async (signal?: AbortSignal) => {
      setSummaryLoading(true);
      try {
        const result = await post<SummaryResult>(
          `/api/sessions/${id}/summary`,
          {},
          signal
        );
        if (signal?.aborted) return;
        setSummary(result.summary);
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate summary"
        );
      } finally {
        if (!signal?.aborted) {
          setSummaryLoading(false);
        }
      }
    },
    [id]
  );

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadData]);

  // Auto-generate summary if not already present
  useEffect(() => {
    if (!loading && session && !summary && !summaryLoading) {
      const controller = new AbortController();
      abortRef.current = controller;
      generateSummary(controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [loading, session, summary, summaryLoading, generateSummary]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  function handleRetry() {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal);
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-4xl">
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry loading session summary"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session || !analytics) return null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          aria-label="Back to sessions list"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Sessions
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--ink)" }}
        >
          Session Summary
        </h1>
        <p className="mt-1 text-sm text-gray-500">{session.title}</p>
      </div>

      {/* Error banner (non-blocking) */}
      {error && (
        <div
          className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry loading"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Duration"
          value={formatDuration(analytics.duration_seconds)}
          color="#6366f1"
        />
        <StatCard
          icon={Target}
          label="Match Rate"
          value={formatPercent(analytics.match_hit_rate)}
          color="var(--red, #d94228)"
        />
        <StatCard
          icon={Layers}
          label="Coverage"
          value={formatPercent(analytics.coverage_rate)}
          color="#10b981"
        />
        <StatCard
          icon={CreditCard}
          label="Cards Shown"
          value={`${analytics.cards_shown} / ${analytics.total_cards}`}
          color="#f59e0b"
        />
      </div>

      {/* Summary text */}
      <div
        className="mb-8 rounded-2xl border border-gray-200 p-6"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <h2
          className="mb-3 text-base font-semibold"
          style={{ color: "var(--ink)" }}
        >
          AI Summary
        </h2>
        {summaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Generating summary...
          </div>
        ) : summary ? (
          <div className="space-y-3 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
            {summary}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No summary available.
          </p>
        )}
      </div>

      {/* Topics covered */}
      {analytics.topics_covered.length > 0 && (
        <div className="mb-8">
          <h2
            className="mb-3 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Topics Covered
          </h2>
          <div className="flex flex-wrap gap-2">
            {analytics.topics_covered.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600"
                style={{ backgroundColor: "var(--paper)" }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cards used */}
      {cards.length > 0 && (
        <div className="mb-8">
          <h2
            className="mb-3 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Cards Used
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

      {/* Action buttons */}
      <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
        <button
          onClick={() => router.push("/sessions/new")}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--red)" }}
          aria-label="Create new session"
        >
          <Plus size={16} aria-hidden="true" />
          New Session
        </button>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ color: "var(--ink)" }}
          aria-label="Back to all sessions"
        >
          Back to Sessions
        </Link>
      </div>
    </div>
  );
}
