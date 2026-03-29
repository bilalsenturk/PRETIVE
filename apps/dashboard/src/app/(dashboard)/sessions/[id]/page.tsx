"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Presentation,
  Clock,
  Loader2,
  Play,
  Zap,
  RefreshCw,
  Copy,
  Check,
  PlayCircle,
  Trash2,
  Upload,
  ClipboardList,
  BarChart3,
  CloudDownload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { get, post, del } from "@/lib/api";
import SessionCard from "@/components/SessionCard";
import GoogleDrivePicker from "@/components/GoogleDrivePicker";

interface Session {
  id: string;
  title: string;
  status: "draft" | "parsed" | "preparing" | "ready" | "live" | "completed" | "error";
  created_at: string;
}

interface Document {
  id: string;
  file_name: string;
  file_size: number | null;
  type: string;
  status: string;
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

const statusConfig: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
  parsed: { bg: "bg-gray-100", text: "text-gray-700", label: "Parsed" },
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

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string): LucideIcon {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return FileText;
    case "pptx":
    case "ppt":
    case "key":
      return Presentation;
    case "docx":
    case "doc":
    case "rtf":
    case "odt":
      return FileText;
    case "xlsx":
    case "xls":
    case "csv":
      return FileSpreadsheet;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return FileImage;
    default:
      return File;
  }
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse" role="status">
      <div className="mb-6 h-4 w-32 rounded bg-gray-200" />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="mt-2 flex items-center gap-3">
            <div className="h-6 w-20 rounded-full bg-gray-200" />
            <div className="h-4 w-28 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="mb-6 rounded-2xl border border-gray-200 p-5">
        <div className="mb-3 h-5 w-24 rounded bg-gray-200" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading session details...</span>
    </div>
  );
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

  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(3000);

  const fetchSession = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<Session>(`/api/sessions/${id}`, signal);
        setSession(data);
        setError(null);
        return data;
      } catch (err) {
        if (signal?.aborted) return null;
        const message =
          err instanceof Error ? err.message : "Failed to load session";
        setError(message);
        return null;
      }
    },
    [id]
  );

  const fetchDocuments = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<Document[]>(
          `/api/sessions/${id}/documents`,
          signal
        );
        setDocuments(data);
      } catch (err) {
        if (signal?.aborted) return;
        // Documents may not exist yet -- non-critical
        console.warn("Failed to fetch documents:", err);
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

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      const s = await fetchSession(signal);
      if (signal?.aborted) return;
      await fetchDocuments(signal);
      if (signal?.aborted) return;
      if (
        s &&
        (s.status === "ready" ||
          s.status === "live" ||
          s.status === "completed")
      ) {
        await fetchCards(signal);
      }
      if (!signal?.aborted) {
        setLoading(false);
      }
    },
    [fetchSession, fetchDocuments, fetchCards]
  );

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadAll(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadAll]);

  // Poll when preparing with exponential backoff
  useEffect(() => {
    if (!preparing) {
      backoffRef.current = 3000;
      return;
    }

    function schedulePoll() {
      const controller = new AbortController();
      abortRef.current = controller;

      pollIntervalRef.current = setTimeout(async () => {
        const s = await fetchSession(controller.signal);
        if (controller.signal.aborted) return;

        if (s && s.status !== "preparing") {
          setPreparing(false);
          if (s.status === "ready") {
            await fetchCards(controller.signal);
          }
          backoffRef.current = 3000;
        } else {
          // Exponential backoff: 3s -> 6s -> 12s -> max 30s
          backoffRef.current = Math.min(backoffRef.current * 2, 30000);
          schedulePoll();
        }
      }, backoffRef.current);
    }

    schedulePoll();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [preparing, fetchSession, fetchCards]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, []);

  async function handlePrepare() {
    setPreparing(true);
    setError(null);
    try {
      await post(`/api/sessions/${id}/prepare`, {});
      await fetchSession();
    } catch (err) {
      setPreparing(false);
      setError(
        err instanceof Error ? err.message : "Failed to prepare session"
      );
    }
  }

  function handleRetry() {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    loadAll(controller.signal);
  }

  function handleStartSession() {
    router.push(`/sessions/${id}/control`);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await del(`/api/sessions/${id}`);
      router.push("/sessions");
    } catch (err) {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setError(
        err instanceof Error ? err.message : "Failed to delete session"
      );
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-3xl">
        <div
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            aria-label="Retry loading session"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const status = statusConfig[session.status] || statusConfig.draft;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link & delete */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          aria-label="Back to sessions list"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Sessions
        </Link>
        <div className="relative">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            aria-label="Delete session"
          >
            <Trash2 size={14} aria-hidden="true" />
            {deleting ? "Deleting..." : "Delete"}
          </button>
          {showDeleteConfirm && (
            <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
              <p className="mb-3 text-sm font-medium text-red-700">
                Are you sure you want to delete this session?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
              <Clock size={12} aria-hidden="true" />
              {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {(session.status === "draft" || session.status === "parsed") && (
            <button
              onClick={handlePrepare}
              disabled={preparing}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--red)" }}
              aria-label={preparing ? "Preparing session" : "Prepare session"}
            >
              {preparing ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Preparing...
                </>
              ) : (
                <>
                  <Zap size={16} aria-hidden="true" />
                  Prepare Session
                </>
              )}
            </button>
          )}
          {session.status === "ready" && (
            <>
              <Link
                href={`/sessions/${id}/coach`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ color: "var(--ink)" }}
              >
                <ClipboardList size={16} aria-hidden="true" />
                Prepare &amp; Practice
              </Link>
              <button
                onClick={handleStartSession}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--red)" }}
                aria-label="Start live session"
              >
                <Play size={16} aria-hidden="true" />
                Start Session
              </button>
            </>
          )}
          {session.status === "preparing" && (
            <div
              className="flex items-center gap-2 text-sm text-yellow-600"
              role="status"
            >
              <Loader2
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
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
          <div className="text-center py-8">
            <Upload size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Upload a PDF or PPTX to get AI-powered support cards.</p>
            <button
              onClick={() => setShowDrivePicker(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CloudDownload size={14} />
              Import from Google Drive
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => {
              const DocIcon = getFileIcon(doc.file_name);
              const sizeLabel = formatSize(doc.file_size);
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <DocIcon
                      size={16}
                      className="shrink-0 text-gray-400"
                      aria-hidden="true"
                    />
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--ink)" }}
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </span>
                    {sizeLabel && (
                      <span className="shrink-0 text-xs text-gray-400">
                        {sizeLabel}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      doc.status === "processed"
                        ? "bg-green-50 text-green-700"
                        : doc.status === "processing"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {doc.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Participant Link — shown when live or ready */}
      {(session.status === "live" || session.status === "ready") && (
        <div
          className="mb-6 rounded-2xl border border-gray-200 p-5"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <h2
            className="mb-1 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Participant Link
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Share this link with participants to let them follow along during your live session
          </p>
          {(() => {
            const participantUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/participant/${id}`
                : `/participant/${id}`;
            return (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={participantUrl}
                    className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(participantUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        // Fallback: select the input
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{ color: "var(--ink)" }}
                    aria-label="Copy participant link"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-green-600" aria-hidden="true" />
                        <span className="text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-4 flex flex-col items-center gap-1">
                  <QRCodeSVG value={participantUrl} size={128} />
                  <span className="text-xs text-gray-400">Scan to join</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Replay & Analytics buttons — shown when completed */}
      {session.status === "completed" && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push(`/sessions/${id}/replay`)}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label="Watch session replay"
          >
            <PlayCircle size={16} aria-hidden="true" />
            Replay
          </button>
          <Link
            href={`/sessions/${id}/analytics`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: "var(--ink)" }}
          >
            <BarChart3 size={16} aria-hidden="true" />
            View Analytics
          </Link>
        </div>
      )}

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

      {/* Google Drive Picker Modal */}
      {showDrivePicker && (
        <GoogleDrivePicker
          sessionId={id}
          onClose={() => setShowDrivePicker(false)}
          onImportComplete={() => {
            setShowDrivePicker(false);
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
}
