"use client";

import { useEffect, useState } from "react";
import SessionCard from "@/components/SessionCard";

interface Card {
  id: string;
  card_type: "summary" | "comparison" | "concept" | "context_bridge";
  title: string;
  content: string | { text: string };
  display_order: number;
}

interface ActiveCardsProps {
  cards: Card[];
  currentPosition: string | null;
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

  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink)" }}
      >
        Active Cards
      </h2>

      {currentPosition && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-xs font-medium"
          style={{ backgroundColor: "rgba(217, 66, 40, 0.08)", color: "var(--red)" }}
        >
          Current topic: {currentPosition}
        </div>
      )}

      <div
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-4"
        style={{ backgroundColor: "var(--paper)" }}
      >
        {cards.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-gray-400">
              Waiting for speech...
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
