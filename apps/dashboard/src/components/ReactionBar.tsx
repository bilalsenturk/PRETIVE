"use client";

import { useState, useCallback } from "react";
import EmojiPickerPopover from "./EmojiPickerPopover";

const PRESET_REACTIONS = [
  { emoji: "\u{1F60A}", label: "Happy" },
  { emoji: "\u{1F44D}", label: "Thumbs up" },
  { emoji: "\u{1F44F}", label: "Applause" },
  { emoji: "\u{1F4A1}", label: "Idea" },
  { emoji: "\u{1F914}", label: "Thinking" },
  { emoji: "\u2753", label: "Question" },
];

interface ReactionBarProps {
  sessionId: string;
  onReaction?: (emoji: string) => void;
  compact?: boolean;
}

export default function ReactionBar({ sessionId, onReaction, compact }: ReactionBarProps) {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [animating, setAnimating] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const handleReaction = useCallback((emoji: string) => {
    // Toggle selection
    if (selected === emoji) {
      setSelected(null);
      setReactions(prev => {
        const next = { ...prev };
        next[emoji] = Math.max(0, (next[emoji] || 1) - 1);
        if (next[emoji] === 0) delete next[emoji];
        return next;
      });
    } else {
      // Deselect previous
      if (selected) {
        setReactions(prev => {
          const next = { ...prev };
          next[selected] = Math.max(0, (next[selected] || 1) - 1);
          if (next[selected] === 0) delete next[selected];
          return next;
        });
      }
      setSelected(emoji);
      setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    }

    // Animate
    setAnimating(emoji);
    setTimeout(() => setAnimating(null), 600);

    onReaction?.(emoji);
  }, [selected, onReaction]);

  return (
    <div className={`flex items-center gap-1.5 ${compact ? "gap-1" : "gap-1.5"}`}>
      {PRESET_REACTIONS.map(({ emoji, label }) => {
        const count = reactions[emoji] || 0;
        const isSelected = selected === emoji;
        const isAnimating = animating === emoji;

        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            title={label}
            aria-label={`React with ${label}`}
            className={`
              relative flex items-center gap-1 rounded-full border transition-all duration-200
              ${compact ? "px-2 py-1 text-base" : "px-2.5 py-1.5 text-lg"}
              ${isSelected
                ? "border-[#D94228]/30 bg-[#FEF2F0] ring-1 ring-[#D94228]/20"
                : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
              }
              ${isAnimating ? "scale-125" : "scale-100"}
            `}
            style={{ transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, border-color 0.2s" }}
          >
            <span className={isAnimating ? "animate-bounce" : ""}>{emoji}</span>
            {count > 0 && (
              <span className={`text-xs font-medium ${isSelected ? "text-[#D94228]" : "text-gray-500"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}

      <EmojiPickerPopover
        onSelect={handleReaction}
        compact={compact}
      />
    </div>
  );
}
