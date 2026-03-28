"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, ChevronRight } from "lucide-react";
import SessionCard from "@/components/SessionCard";

interface CardContent {
  text?: string;
  summary?: string;
  [key: string]: unknown;
}

interface Card {
  id: string;
  card_type: string;
  title: string;
  content: string | CardContent | null | undefined;
  display_order: number;
  _score?: number;
  _display_duration?: number;
}

interface ActiveCardsProps {
  cards: Card[];
  currentPosition: string | { heading?: string; [key: string]: unknown } | null;
  onDismiss?: (cardId: string) => void;
  queuedCount?: number;
}

function resolvePositionDisplay(
  position: ActiveCardsProps["currentPosition"]
): string | null {
  if (position === null || position === undefined) return null;
  if (typeof position === "string") return position;
  if (typeof position === "object") {
    if (typeof position.heading === "string" && position.heading.length > 0) {
      return position.heading;
    }
    try {
      return JSON.stringify(position);
    } catch {
      return null;
    }
  }
  return String(position);
}

export default function ActiveCards({
  cards,
  currentPosition,
  onDismiss,
  queuedCount = 0,
}: ActiveCardsProps) {
  const [animState, setAnimState] = useState<"entering" | "visible" | "exiting">("visible");
  const [displayCards, setDisplayCards] = useState<Card[]>(cards);
  const [cardTimers, setCardTimers] = useState<Record<string, number>>({});
  const prevCardsRef = useRef<string>("");
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cardsKey = cards.map((c) => c.id).join(",");
    if (cardsKey === prevCardsRef.current) return;

    if (prevCardsRef.current !== "") {
      setAnimState("exiting");
      const exitTimer = setTimeout(() => {
        setDisplayCards(cards);
        setAnimState("entering");
        // Initialize timers for new cards
        const newTimers: Record<string, number> = {};
        for (const card of cards) {
          newTimers[card.id] = card._display_duration || 30;
        }
        setCardTimers(newTimers);
        const enterTimer = setTimeout(() => {
          setAnimState("visible");
        }, 50);
        return () => clearTimeout(enterTimer);
      }, 250);
      prevCardsRef.current = cardsKey;
      return () => clearTimeout(exitTimer);
    } else {
      setDisplayCards(cards);
      const newTimers: Record<string, number> = {};
      for (const card of cards) {
        newTimers[card.id] = card._display_duration || 30;
      }
      setCardTimers(newTimers);
      setAnimState("entering");
      const timer = setTimeout(() => setAnimState("visible"), 50);
      prevCardsRef.current = cardsKey;
      return () => clearTimeout(timer);
    }
  }, [cards]);

  // Countdown timers for auto-advance
  useEffect(() => {
    if (displayCards.length === 0) return;

    timerIntervalRef.current = setInterval(() => {
      setCardTimers((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id] > 0) {
            next[id] -= 1;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [displayCards]);

  // Auto-dismiss expired cards
  useEffect(() => {
    for (const [cardId, remaining] of Object.entries(cardTimers)) {
      if (remaining <= 0 && onDismiss) {
        onDismiss(cardId);
      }
    }
  }, [cardTimers, onDismiss]);

  const handleDismiss = useCallback(
    (cardId: string) => {
      setDisplayCards((prev) => prev.filter((c) => c.id !== cardId));
      if (onDismiss) onDismiss(cardId);
    },
    [onDismiss]
  );

  const positionText = resolvePositionDisplay(currentPosition);

  const animStyle: React.CSSProperties =
    animState === "exiting"
      ? { opacity: 0, transform: "translateX(-24px)", transition: "opacity 0.25s ease, transform 0.25s ease" }
      : animState === "entering"
        ? { opacity: 0, transform: "translateX(24px)" }
        : { opacity: 1, transform: "translateX(0)", transition: "opacity 0.35s ease, transform 0.35s ease" };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <h2
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--ink)" }}
        >
          Active Cards
        </h2>
        {displayCards.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "rgba(217, 66, 40, 0.1)",
              color: "var(--red)",
            }}
          >
            {displayCards.length} card{displayCards.length !== 1 ? "s" : ""}
          </span>
        )}
        {queuedCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
            <ChevronRight size={12} />
            {queuedCount} in queue
          </span>
        )}
      </div>

      {positionText && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            backgroundColor: "rgba(217, 66, 40, 0.08)",
            color: "var(--red)",
          }}
          aria-live="polite"
        >
          Current topic: {positionText}
        </div>
      )}

      <div
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-4"
        style={{ backgroundColor: "var(--paper)" }}
        aria-live="polite"
        aria-label="Active cards list"
      >
        {displayCards.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-gray-400">
              No matches found yet
            </p>
          </div>
        ) : (
          <div className="space-y-3" style={animStyle}>
            {displayCards.map((card) => {
              const remaining = cardTimers[card.id];
              const duration = card._display_duration || 30;
              const progress = remaining != null ? remaining / duration : 1;

              return (
                <div key={card.id} className="relative group">
                  {/* Timer progress bar */}
                  {remaining != null && remaining > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg overflow-hidden bg-gray-100">
                      <div
                        className="h-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${progress * 100}%`,
                          backgroundColor: progress > 0.3 ? "#2563eb" : "#D94228",
                        }}
                      />
                    </div>
                  )}
                  <SessionCard card={card} />
                  {/* Dismiss button */}
                  <button
                    onClick={() => handleDismiss(card.id)}
                    className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-gray-400 opacity-0 shadow-sm transition-opacity hover:bg-white hover:text-gray-600 group-hover:opacity-100"
                    aria-label={`Dismiss card: ${card.title}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
