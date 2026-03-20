"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { get } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardContent {
  text?: string;
  summary?: string;
  [key: string]: unknown;
}

interface CardData {
  id: string;
  card_type: string;
  title: string;
  content: string | CardContent | null | undefined;
  display_order: number;
}

interface ParticipantSession {
  id: string;
  title: string;
  status: "draft" | "preparing" | "ready" | "live" | "completed";
}

interface ParticipantCardsResponse {
  session: ParticipantSession;
  cards: CardData[];
}

// ---------------------------------------------------------------------------
// Card type styles (inline to avoid cross-layout import issues)
// ---------------------------------------------------------------------------

import {
  BookOpen,
  Columns,
  Lightbulb,
  Link as LinkIcon,
  HelpCircle,
} from "lucide-react";
import type { ComponentType } from "react";

interface CardTypeStyle {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
}

const cardTypeConfig: Record<string, CardTypeStyle> = {
  summary: {
    bg: "bg-blue-50/60",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: BookOpen,
    label: "Summary",
  },
  comparison: {
    bg: "bg-orange-50/60",
    border: "border-orange-200",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    icon: Columns,
    label: "Comparison",
  },
  concept: {
    bg: "bg-green-50/60",
    border: "border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    icon: Lightbulb,
    label: "Concept",
  },
  context_bridge: {
    bg: "bg-purple-50/60",
    border: "border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    icon: LinkIcon,
    label: "Context Bridge",
  },
};

const defaultCardStyle: CardTypeStyle = {
  bg: "bg-gray-50/60",
  border: "border-gray-200",
  iconBg: "bg-gray-100",
  iconColor: "text-gray-600",
  icon: HelpCircle,
  label: "Card",
};

function extractContentText(
  content: CardData["content"]
): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (typeof content.summary === "string") return content.summary;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return "[Unable to display content]";
    }
  }
  return String(content);
}

function ParticipantCard({ card }: { card: CardData }) {
  const config = cardTypeConfig[card.card_type] || defaultCardStyle;
  const Icon = config.icon;
  const rawContent = extractContentText(card.content);
  const contentPreview =
    rawContent.length > 200 ? rawContent.slice(0, 200) + "..." : rawContent;
  const displayTitle = card.title?.trim() || "Untitled";

  return (
    <article
      className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}
      aria-label={`${config.label} card: ${displayTitle}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.iconBg}`}
          aria-hidden="true"
        >
          <Icon size={14} className={config.iconColor} />
        </div>
        <span className={`text-xs font-medium ${config.iconColor}`}>
          {config.label}
        </span>
      </div>
      <h3
        className="mb-1.5 text-sm font-semibold"
        style={{ color: "var(--ink, #111)" }}
      >
        {displayTitle}
      </h3>
      {contentPreview ? (
        <p className="text-xs leading-relaxed text-gray-700">
          {contentPreview}
        </p>
      ) : (
        <p className="text-xs italic text-gray-400">No content</p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Status Messages
// ---------------------------------------------------------------------------

function WaitingMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--red, #D94228)15" }}
      >
        <div
          className="h-6 w-6 rounded-full"
          style={{ backgroundColor: "var(--red, #D94228)" }}
        />
      </div>
      <h2
        className="mb-2 text-lg font-semibold"
        style={{ color: "var(--ink, #111)" }}
      >
        Oturum hen&uuml;z ba&scedil;lamad&imath;
      </h2>
      <p className="text-sm text-gray-500">
        Oturum ba&scedil;lad&imath;&gbreve;&imath;nda kartlar burada g&ouml;r&uuml;necek.
      </p>
    </div>
  );
}

function CompletedMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <svg
          className="h-8 w-8 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h2
        className="mb-2 text-lg font-semibold"
        style={{ color: "var(--ink, #111)" }}
      >
        Oturum tamamland&imath;
      </h2>
      <p className="text-sm text-gray-500">
        Bu oturum sona erdi. Te&scedil;ekk&uuml;rler!
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 3000;

export default function ParticipantViewPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch cards (used for both initial load and polling)
  const fetchCards = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await get<ParticipantCardsResponse>(
          `/api/sessions/${sessionId}/participant/cards`,
          signal
        );
        if (signal?.aborted) return;
        setSession(data.session);
        setCards(data.cards);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        // On first load, show error; on poll, silently ignore
        if (loading) {
          setError(
            err instanceof Error ? err.message : "Failed to load session"
          );
        }
      } finally {
        if (!signal?.aborted && loading) {
          setLoading(false);
        }
      }
    },
    [sessionId, loading]
  );

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchCards(controller.signal);
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Polling when live
  useEffect(() => {
    if (!session) return;

    // Only poll when live
    if (session.status !== "live") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    pollRef.current = setInterval(() => {
      if (!controller.signal.aborted) {
        fetchCards(controller.signal);
      }
    }, POLL_INTERVAL);

    return () => {
      controller.abort();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [session?.status, fetchCards, session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const isLive = session?.status === "live";
  const isCompleted = session?.status === "completed";
  const isWaiting =
    session?.status === "draft" ||
    session?.status === "preparing" ||
    session?.status === "ready";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--red, #D94228)" }}
            aria-hidden="true"
          >
            <span className="text-lg font-bold text-white">P</span>
          </div>
          <div>
            <h1
              className="text-lg font-bold sm:text-xl"
              style={{ color: "var(--ink, #111)" }}
            >
              {loading ? "Loading..." : session?.title || "Session"}
            </h1>
            <span className="text-xs text-gray-500">PRETIVE</span>
          </div>
        </div>

        {/* Live badge */}
        {isLive && (
          <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: "var(--red, #D94228)" }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "var(--red, #D94228)" }}
              />
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--red, #D94228)" }}
            >
              Live
            </span>
          </div>
        )}

        {isCompleted && (
          <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
            Completed
          </span>
        )}
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24" role="status">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "var(--red, #D94228)" }}
          />
          <span className="sr-only">Loading...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600"
          role="alert"
        >
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              const controller = new AbortController();
              abortRef.current = controller;
              fetchCards(controller.signal);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Waiting state */}
      {!loading && !error && isWaiting && <WaitingMessage />}

      {/* Completed state with last cards */}
      {!loading && !error && isCompleted && (
        <>
          {cards.length > 0 && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards
                .sort((a, b) => a.display_order - b.display_order)
                .map((card) => (
                  <ParticipantCard key={card.id} card={card} />
                ))}
            </div>
          )}
          <CompletedMessage />
        </>
      )}

      {/* Live state — show cards */}
      {!loading && !error && isLive && (
        <>
          {cards.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500">
                Kartlar y&uuml;kleniyor...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards
                .sort((a, b) => a.display_order - b.display_order)
                .map((card) => (
                  <ParticipantCard key={card.id} card={card} />
                ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 pt-6 text-center">
        <p className="text-xs text-gray-400">
          Pretive ile sunuldu &middot;{" "}
          <a
            href="https://pretive.com"
            className="underline transition-colors hover:text-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            pretive.com
          </a>
        </p>
      </footer>
    </div>
  );
}
