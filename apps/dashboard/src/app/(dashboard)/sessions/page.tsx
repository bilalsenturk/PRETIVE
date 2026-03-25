"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Clock, RefreshCw, Sparkles } from "lucide-react";
import { get, post } from "@/lib/api";

interface Session {
  id: string;
  title: string;
  status: "draft" | "active" | "completed";
  created_at: string;
  document_count: number;
}

interface DemoSeedResponse {
  session_id: string;
  message: string;
}

const statusStyles: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
  parsed: { bg: "bg-gray-100", text: "text-gray-600", label: "Parsed" },
  preparing: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Preparing" },
  ready: { bg: "bg-green-50", text: "text-green-700", label: "Ready" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  live: { bg: "bg-blue-50", text: "text-blue-700", label: "Live" },
  completed: { bg: "bg-purple-50", text: "text-purple-700", label: "Completed" },
  error: { bg: "bg-red-50", text: "text-red-700", label: "Error" },
};

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl" role="status">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center justify-between rounded-xl border border-gray-200 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="mt-2 flex items-center gap-3">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
              </div>
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading sessions...</span>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const fetchSessions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<Session[]>("/api/sessions", signal);
      if (!signal?.aborted) {
        setSessions(data);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error ? err.message : "Failed to load sessions"
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSessions(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchSessions]);

  function handleRetry() {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSessions(controller.signal);
  }

  async function handleDemoSeed() {
    setDemoLoading(true);
    try {
      const data = await post<DemoSeedResponse>("/api/demo/seed", {});
      router.push(`/sessions/${data.session_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create demo session"
      );
      setDemoLoading(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
          Sessions
        </h1>
        <Link
          href="/sessions/new"
          className="inline-flex items-center gap-2 rounded-xl px-4 h-11 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--red)" }}
          aria-label="Create new session"
        >
          <Plus size={16} aria-hidden="true" />
          + New Session
        </Link>
      </div>

      {/* Demo seed card */}
      <button
        onClick={handleDemoSeed}
        disabled={demoLoading}
        className="mb-4 flex w-full items-center gap-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-5 py-4 text-left transition-all duration-200 hover:shadow-md hover:border-amber-400 disabled:opacity-60"
        aria-label="Start a demo session"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Sparkles size={20} className="text-amber-600" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-900">
            Start Demo Session
          </h3>
          <p className="mt-0.5 text-xs text-amber-700">
            Try Pretive now — start a ready-made demo session
          </p>
        </div>
        {demoLoading && (
          <RefreshCw
            size={16}
            className="shrink-0 animate-spin text-amber-600"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Error state */}
      {error && (
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry loading sessions"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!error && sessions.length === 0 && (
        <div
          className="rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <FileText size={24} className="text-gray-400" aria-hidden="true" />
          </div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            No sessions yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create your first session to get started.
          </p>
          <Link
            href="/sessions/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 h-11 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label="Create your first session"
          >
            <Plus size={16} aria-hidden="true" />
            New Session
          </Link>
        </div>
      )}

      {/* Sessions list */}
      {!error && sessions.length > 0 && (
        <div className="grid gap-3" role="list" aria-label="Sessions">
          {sessions.map((session) => {
            const status =
              statusStyles[session.status] || statusStyles.draft;
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md"
                role="listitem"
                aria-label={`Session: ${session.title}, Status: ${status.label}`}
              >
                <div className="min-w-0">
                  <h3
                    className="truncate text-base font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {session.title || "Untitled"}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} aria-hidden="true" />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} aria-hidden="true" />
                      {session.document_count} document
                      {session.document_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status.bg} ${status.text}`}
                >
                  {status.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
