"use client";

import { useEffect, useState } from "react";
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [cards]);

  const positionText = resolvePositionDisplay(currentPosition);

  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink)" }}
      >
        Active Cards
      </h2>

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
        {cards.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-gray-400">
              {"Hen\u00FCz e\u015Fle\u015Fme bulunamad\u0131"}
            </p>
          </div>
        ) : (
          <div
            className="space-y-3 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {cards.map((card) => (
              <SessionCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
