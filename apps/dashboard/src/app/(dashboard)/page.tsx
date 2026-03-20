"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  Clock,
  Radio,
  RefreshCw,
  Play,
  ArrowRight,
} from "lucide-react";
import { get } from "@/lib/api";

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
  return date.toLocaleDateString("tr-TR", {
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
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-gray-200 px-5 py-4"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
        >
          <Icon size={20} style={{ color: "var(--red)" }} aria-hidden="true" />
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
  const abortRef = useRef<AbortController | null>(null);

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
          Hoş geldiniz
        </h1>
        <p className="mt-1 text-sm text-gray-500">{formatDate(new Date())}</p>
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
              label="Toplam Oturum"
              value={totalSessions}
              loading={false}
            />
            <StatCard
              icon={Clock}
              label="Yüklenen Doküman"
              value={totalDocuments}
              loading={false}
            />
            <StatCard
              icon={Radio}
              label="Canlı Oturum"
              value={liveSessions}
              loading={false}
            />
          </div>

          {/* Recent sessions */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--ink)" }}
              >
                Son Oturumlar
              </h2>
              {sessions.length > 3 && (
                <Link
                  href="/sessions"
                  className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--red)" }}
                >
                  Tümünü gör
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>

            {recentSessions.length === 0 ? (
              <div
                className="rounded-xl border border-gray-200 py-12 text-center"
                style={{ backgroundColor: "var(--paper)" }}
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
                  Henüz oturum yok
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  İlk oturumunuzu oluşturarak başlayın.
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
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4 transition-shadow hover:shadow-md"
                      style={{ backgroundColor: "var(--paper)" }}
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
                              "tr-TR"
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText size={12} aria-hidden="true" />
                            {session.document_count} doküman
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.text}`}
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
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--red)" }}
              aria-label="Yeni oturum oluştur"
            >
              <Plus size={16} aria-hidden="true" />
              Yeni Oturum Oluştur
            </Link>
            <Link
              href="/sessions/new?demo=true"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ color: "var(--ink)", backgroundColor: "var(--paper)" }}
              aria-label="Demo oturumu dene"
            >
              <Play size={16} aria-hidden="true" />
              Demo Dene
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
