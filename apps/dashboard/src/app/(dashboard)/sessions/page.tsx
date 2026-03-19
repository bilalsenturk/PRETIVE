"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Clock } from "lucide-react";
import { get } from "@/lib/api";

interface Session {
  id: string;
  title: string;
  status: "draft" | "active" | "completed";
  created_at: string;
  document_count: number;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  completed: { bg: "bg-blue-50", text: "text-blue-700", label: "Completed" },
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await get<Session[]>("/sessions");
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
          Sessions
        </h1>
        <Link
          href="/sessions/new"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--red)" }}
        >
          <Plus size={16} />
          New Session
        </Link>
      </div>

      {/* Content */}
      {loading && (
        <div className="py-20 text-center text-gray-500">
          Loading sessions...
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div
          className="rounded-2xl border border-gray-200 py-20 text-center"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <FileText size={24} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
            No sessions yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create your first session to get started.
          </p>
          <Link
            href="/sessions/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
          >
            <Plus size={16} />
            New Session
          </Link>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const status = statusStyles[session.status] || statusStyles.draft;
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4 transition-shadow hover:shadow-md"
                style={{ backgroundColor: "var(--paper)" }}
              >
                <div className="min-w-0">
                  <h3
                    className="truncate text-base font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {session.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {session.document_count} document
                      {session.document_count !== 1 ? "s" : ""}
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
  );
}
