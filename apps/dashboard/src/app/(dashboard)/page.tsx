"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Clock,
  Radio,
  RefreshCw,
  Play,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { get, post } from "@/lib/api";

interface Session {
  id: string;
  title: string;
  status: "draft" | "active" | "completed";
  created_at: string;
  document_count: number;
}

const statusStyles: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  completed: { bg: "bg-blue-50", text: "text-blue-700", label: "Completed" },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  iconBg = "rgba(217, 66, 40, 0.1)",
  iconColor = "var(--red)",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={20} style={{ color: iconColor }} aria-hidden="true" />
        </div>
        <div>
          {loading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-gray-200" />
          ) : (
            <p
              className="text-2xl font-bold leading-tight"
              style={{ color: "var(--ink)" }}
            >
              {value}
            </p>
          )}
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl" role="status">
      {/* Welcome header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Stats skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>

      {/* Recent sessions skeleton */}
      <div className="mb-8">
        <div className="mb-4 h-6 w-36 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}

export default function DashboardOverview() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async (signal?: AbortSignal) => {
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
        err instanceof Error ? err.message : "Failed to load dashboard"
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
    fetchData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchData]);

  function handleRetry() {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchData(controller.signal);
  }

  async function handleDemoSeed() {
    setDemoLoading(true);
    try {
      const data = await post<{ session_id: string }>("/api/demo/seed", {});
      router.push(`/sessions/${data.session_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create demo session"
      );
      setDemoLoading(false);
    }
  }

  const totalSessions = sessions.length;
  const totalDocuments = sessions.reduce(
    (sum, s) => sum + (s.document_count || 0),
    0
  );
  const liveSessions = sessions.filter((s) => s.status === "active").length;
  const recentSessions = sessions.slice(0, 3);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-gray-400">{formatDate(new Date())}</p>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry loading dashboard"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Quick stats */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={FileText}
              label="Total Sessions"
              value={totalSessions}
              loading={false}
              iconBg="#FEF2F2"
              iconColor="#D94228"
            />
            <StatCard
              icon={Clock}
              label="Uploaded Documents"
              value={totalDocuments}
              loading={false}
              iconBg="#FFFBEB"
              iconColor="#D97706"
            />
            <StatCard
              icon={Radio}
              label="Live Sessions"
              value={liveSessions}
              loading={false}
              iconBg="#EFF6FF"
              iconColor="#2563EB"
            />
          </div>

          {/* Recent sessions */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--ink)" }}
              >
                Recent Sessions
              </h2>
              {sessions.length > 3 && (
                <Link
                  href="/sessions"
                  className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--red)" }}
                >
                  View all
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>

            {recentSessions.length === 0 ? (
              <div
                className="rounded-2xl border border-gray-200 bg-white py-12 text-center shadow-sm"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <FileText
                    size={20}
                    className="text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  No sessions yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Create your first session to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-3" role="list" aria-label="Recent sessions">
                {recentSessions.map((session) => {
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
                            {new Date(session.created_at).toLocaleDateString(
                              "en-US"
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText size={12} aria-hidden="true" />
                            {session.document_count} document{session.document_count !== 1 ? "s" : ""}
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

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sessions/new"
              className="inline-flex items-center gap-2 rounded-xl px-5 h-11 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--red)" }}
              aria-label="Create new session"
            >
              <Plus size={16} aria-hidden="true" />
              Create New Session
            </Link>
            <button
              onClick={handleDemoSeed}
              disabled={demoLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 h-11 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-60"
              style={{ color: "var(--ink)" }}
              aria-label="Try demo session"
            >
              {demoLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <Play size={16} aria-hidden="true" />
                  Try Demo
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
