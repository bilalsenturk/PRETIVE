"use client";

import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  id: string;
  index: number;
  heading: string;
  type: string;
  slide_number: number;
  has_notes: boolean;
}

interface SlideProgressStripProps {
  slides: Slide[];
  currentIndex: number | null;
  coveredIndexes: Set<number>;
  onSelectSlide: (index: number) => void;
}

function truncateHeading(heading: string): string {
  if (!heading) return "";
  const words = heading.trim().split(/\s+/);
  if (words.length <= 2) return heading;
  return words.slice(0, 2).join(" ") + "\u2026";
}

export type { Slide };

export default function SlideProgressStrip({
  slides,
  currentIndex,
  coveredIndexes,
  onSelectSlide,
}: SlideProgressStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPillRef = useRef<HTMLButtonElement>(null);

  // Scroll to current slide automatically
  useEffect(() => {
    if (currentPillRef.current && scrollRef.current) {
      currentPillRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  function scrollBy(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }

  if (slides.length === 0) return null;

  return (
    <div className="relative flex items-center gap-1">
      {/* Left arrow */}
      <button
        onClick={() => scrollBy("left")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
        aria-label="Scroll slides left"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-2 overflow-x-auto px-1 py-1 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {slides.map((slide, idx) => {
          const isCurrent = currentIndex === idx;
          const isCovered = coveredIndexes.has(idx);

          let pillClass =
            "inline-flex min-w-[48px] h-[36px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0";

          if (isCurrent) {
            pillClass += " bg-[#D94228] text-white border-transparent shadow-md";
          } else if (isCovered) {
            pillClass += " bg-green-50 text-green-700 border-green-200";
          } else {
            pillClass +=
              " bg-white text-gray-500 border-gray-200 hover:border-gray-300";
          }

          return (
            <button
              key={slide.id}
              ref={isCurrent ? currentPillRef : undefined}
              onClick={() => onSelectSlide(idx)}
              className={pillClass}
              aria-label={`Slide ${slide.slide_number}: ${slide.heading}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              <span className="font-semibold">{slide.slide_number}</span>
              {slide.heading && (
                <span className="hidden sm:inline">
                  {truncateHeading(slide.heading)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy("right")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
        aria-label="Scroll slides right"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
