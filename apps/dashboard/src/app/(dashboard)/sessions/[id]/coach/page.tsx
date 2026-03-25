"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Pin,
  Lightbulb,
  Play,
  Loader2,
} from "lucide-react";
import { get } from "@/lib/api";

interface Session {
  id: string;
  title: string;
  status: string;
  created_at: string;
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

function getCardPreview(content: string | CardContent): string {
  if (typeof content === "string") {
    return content.length > 120 ? content.slice(0, 120) + "..." : content;
  }
  const text = content.summary || content.text || "";
  return text.length > 120 ? text.slice(0, 120) + "..." : text;
}

function cardTypeLabel(type: string): string {
  switch (type) {
    case "summary":
      return "Summary";
    case "comparison":
      return "Comparison";
    case "concept":
      return "Concept";
    case "context_bridge":
      return "Context Bridge";
    default:
      return type;
  }
}

export default function PreSessionCoachPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionData, cardsData] = await Promise.all([
        get<Session>(`/api/sessions/${id}`),
        get<Card[]>(`/api/sessions/${id}/cards`),
      ]);
      setSession(sessionData);
      setCards(cardsData.sort((a, b) => a.display_order - b.display_order));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load session data"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-600">
          <p>{error || "Session not found"}</p>
          <button
            onClick={loadData}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const estimatedMinutes = cards.length > 0 ? cards.length * 2 : 5;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <Link
        href={`/sessions/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Session
      </Link>

      {/* Page title */}
      <h1
        className="mb-8 text-2xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        Pre-Session Coach: {session.title}
      </h1>

      {/* Session Briefing */}
      <div
        className="mb-6 rounded-2xl border border-gray-200 p-6 shadow-sm"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList
            size={18}
            className="text-[#D94228]"
            aria-hidden="true"
          />
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Session Briefing
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          Your presentation has{" "}
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            {cards.length}
          </span>{" "}
          AI-generated support cards.
          <br />
          Estimated time:{" "}
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            ~{estimatedMinutes} minutes
          </span>
        </p>
      </div>

      {/* Key Topics */}
      {cards.length > 0 && (
        <div
          className="mb-6 rounded-2xl border border-gray-200 p-6 shadow-sm"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Pin
              size={18}
              className="text-[#D94228]"
              aria-hidden="true"
            />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Key Topics
            </h2>
          </div>
          <ol className="space-y-4">
            {cards.map((card, index) => (
              <li key={card.id}>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: "#D94228" }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {card.title}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        {cardTypeLabel(card.card_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">
                      {getCardPreview(card.content)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Presentation Tips */}
      <div
        className="mb-8 rounded-2xl border border-gray-200 p-6 shadow-sm"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb
            size={18}
            className="text-[#D94228]"
            aria-hidden="true"
          />
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Presentation Tips
          </h2>
        </div>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5 text-[#D94228]" aria-hidden="true">
              &bull;
            </span>
            Start with your main thesis and set the context for your audience
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5 text-[#D94228]" aria-hidden="true">
              &bull;
            </span>
            Use the comparison data and key points to build a convincing
            narrative
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5 text-[#D94228]" aria-hidden="true">
              &bull;
            </span>
            End with a clear call to action or takeaway for your audience
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5 text-[#D94228]" aria-hidden="true">
              &bull;
            </span>
            Review the AI cards above to familiarize yourself with the key
            talking points
          </li>
        </ul>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between">
        <Link
          href={`/sessions/${id}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50"
          style={{ color: "var(--ink)" }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Session
        </Link>
        <button
          onClick={() => router.push(`/sessions/${id}/live`)}
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D94228" }}
        >
          <Play size={16} aria-hidden="true" />
          Start Live Session
        </button>
      </div>
    </div>
  );
}
