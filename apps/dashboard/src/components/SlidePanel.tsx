"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import SessionCard from "@/components/SessionCard";
import type { Slide } from "@/components/SlideProgressStrip";

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

interface Suggestion {
  text: string;
  type?: string;
}

interface SlidePanelProps {
  currentSlide: Slide | null;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  cards: Card[];
  suggestions: Suggestion[];
}

export default function SlidePanel({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  cards,
  suggestions,
}: SlidePanelProps) {
  const canPrev = currentSlide != null && currentSlide.index > 0;
  const canNext = currentSlide != null && currentSlide.index < totalSlides - 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Top: Slide number badge + heading */}
      {currentSlide ? (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-lg bg-[#D94228] px-2.5 py-1 text-xs font-bold text-white">
              Slide {currentSlide.slide_number}
            </span>
            <span className="text-xs text-gray-400">
              of {totalSlides}
            </span>
          </div>
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--ink, #111)" }}
          >
            {currentSlide.heading || `Slide ${currentSlide.slide_number}`}
          </h3>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-sm italic text-gray-400">
            No slide selected
          </p>
        </div>
      )}

      {/* Middle: Cards */}
      {cards.length > 0 && (
        <div className="mb-4 space-y-3">
          {cards.map((card) => (
            <SessionCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            Suggestions
          </p>
          <ul className="space-y-1">
            {suggestions.slice(0, 3).map((s, i) => (
              <li
                key={i}
                className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
              >
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom: Prev/Next buttons */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous slide"
        >
          <ChevronLeft size={14} />
          Prev
          <kbd className="ml-1 hidden rounded border border-gray-200 bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-400 sm:inline">
            &larr;
          </kbd>
        </button>

        <span className="text-xs text-gray-400">
          {currentSlide
            ? `Slide ${currentSlide.slide_number} of ${totalSlides}`
            : `${totalSlides} slides`}
        </span>

        <button
          onClick={onNext}
          disabled={!canNext}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next slide"
        >
          Next
          <kbd className="ml-1 hidden rounded border border-gray-200 bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-400 sm:inline">
            &rarr;
          </kbd>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
