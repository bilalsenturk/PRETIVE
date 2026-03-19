"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Clock,
  Loader2,
  Play,
  Zap,
} from "lucide-react";
import { get, post } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

interface Session {
  id: string;
  title: string;
  status: "draft" | "preparing" | "ready" | "live" | "completed";
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: string;
}

interface Card {
  id: string;
  card_type: "summary" | "comparison" | "concept" | "context_bridge";
  title: string;
  content: string;
  display_order: number;
}

const statusConfig: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  preparing: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    label: "Preparing",
  },
  ready: { bg: "bg-green-50", text: "text-green-700", label: "Ready" },
  live: { bg: "bg-blue-50", text: "text-blue-700", label: "Live" },
  completed: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    label: "Completed",
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

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

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await get<Document[]>(`/api/sessions/${id}/documents`);
      setDocuments(data);
    } catch {
      // Documents may not exist yet
    }
  }, [id]);

  const fetchCards = useCallback(async () => {
    try {
      const data = await get<Card[]>(`/api/sessions/${id}/cards`);
      setCards(data);
    } catch {
      // Cards may not exist yet
    }
  }, [id]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const s = await fetchSession();
      await fetchDocuments();
      if (s && (s.status === "ready" || s.status === "live" || s.status === "completed")) {
        await fetchCards();
      }
      setLoading(false);
    }
    loadAll();
  }, [fetchSession, fetchDocuments, fetchCards]);

  // Poll when preparing
  useEffect(() => {
    if (!preparing) return;

    const interval = setInterval(async () => {
      const s = await fetchSession();
      if (s && s.status !== "preparing") {
        setPreparing(false);
        if (s.status === "ready") {
          await fetchCards();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [preparing, fetchSession, fetchCards]);

  async function handlePrepare() {
    setPreparing(true);
    try {
      await post(`/api/sessions/${id}/prepare`, {});
      await fetchSession();
    } catch (err) {
      setPreparing(false);
      setError(err instanceof Error ? err.message : "Failed to prepare session");
    }
  }

  function handleStartSession() {
    router.push(`/sessions/${id}/prepare`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error || "Session not found"}
        </div>
      </div>
    );
  }

  const status = statusConfig[session.status] || statusConfig.draft;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Back to Sessions
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--ink)" }}
          >
            {session.title}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.text}`}
            >
              {status.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {session.status === "draft" && (
            <button
              onClick={handlePrepare}
              disabled={preparing}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--red)" }}
            >
              {preparing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Prepare Session
                </>
              )}
            </button>
          )}
          {session.status === "ready" && (
            <button
              onClick={handleStartSession}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--red)" }}
            >
              <Play size={16} />
              Start Session
            </button>
          )}
          {session.status === "preparing" && (
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <Loader2 size={16} className="animate-spin" />
              Preparing session...
            </div>
          )}
        </div>
      </div>

      {/* Documents section */}
      <div
        className="mb-6 rounded-2xl border border-gray-200 p-5"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <h2
          className="mb-3 text-base font-semibold"
          style={{ color: "var(--ink)" }}
        >
          Documents
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="shrink-0 text-gray-400" />
                  <span
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {doc.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {doc.type}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatSize(doc.size)}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    doc.status === "processed"
                      ? "bg-green-50 text-green-700"
                      : doc.status === "processing"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cards section */}
      {cards.length > 0 && (
        <div>
          <h2
            className="mb-3 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Session Cards
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
    </div>
  );
}
