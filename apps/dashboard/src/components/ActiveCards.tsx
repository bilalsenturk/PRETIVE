"use client";

import { useEffect, useState, useRef } from "react";
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
}

interface ActiveCardsProps {
  cards: Card[];
  currentPosition: string | { heading?: string; [key: string]: unknown } | null;
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
}: ActiveCardsProps) {
  const [animState, setAnimState] = useState<"entering" | "visible" | "exiting">("visible");
  const [displayCards, setDisplayCards] = useState<Card[]>(cards);
  const prevCardsRef = useRef<string>("");

  useEffect(() => {
    const cardsKey = cards.map((c) => c.id).join(",");
    if (cardsKey === prevCardsRef.current) return;

    // If we had previous cards, exit them first
    if (prevCardsRef.current !== "") {
      setAnimState("exiting");
      const exitTimer = setTimeout(() => {
        setDisplayCards(cards);
        setAnimState("entering");
        const enterTimer = setTimeout(() => {
          setAnimState("visible");
        }, 50);
        return () => clearTimeout(enterTimer);
      }, 250);
      prevCardsRef.current = cardsKey;
      return () => clearTimeout(exitTimer);
    } else {
      // First load — just enter
      setDisplayCards(cards);
      setAnimState("entering");
      const timer = setTimeout(() => setAnimState("visible"), 50);
      prevCardsRef.current = cardsKey;
      return () => clearTimeout(timer);
    }
  }, [cards]);

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
            {displayCards.length} kart
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
              {"\u0048en\u00FCz e\u015Fle\u015Fme bulunamad\u0131"}
            </p>
          </div>
        ) : (
          <div className="space-y-3" style={animStyle}>
            {displayCards.map((card) => (
              <SessionCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
