"use client";

import { SkipForward, ArrowRight, Clock, CheckCircle, X, MessageSquare, Lightbulb, Gauge } from "lucide-react";

export interface Suggestion {
  type: "skipped_topic" | "transition" | "time_warning" | "coverage" | "prompter_transition" | "prompter_reminder" | "prompter_structure";
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
}

interface SuggestionsProps {
  suggestions: Suggestion[];
  onDismiss: (index: number) => void;
}

const TYPE_CONFIG = {
  skipped_topic: { icon: SkipForward, color: "#d97706" },
  transition: { icon: ArrowRight, color: "#2563eb" },
  time_warning: { icon: Clock, color: "#D94228" },
  coverage: { icon: CheckCircle, color: "#16a34a" },
  prompter_transition: { icon: MessageSquare, color: "#0d9488" },
  prompter_reminder: { icon: Lightbulb, color: "#7c3aed" },
  prompter_structure: { icon: Gauge, color: "#ca8a04" },
} as const;

const PRIORITY_BORDER = {
  low: "0.25",
  medium: "0.5",
  high: "0.85",
} as const;

export default function Suggestions({
  suggestions,
  onDismiss,
}: SuggestionsProps) {
  if (suggestions.length === 0) return null;

  const visible = suggestions.slice(0, 3);
  const hiddenCount = suggestions.length - visible.length;

  return (
    <div
      className="mt-3 flex items-center gap-3 overflow-x-auto px-1 py-2"
      role="region"
      aria-label="Suggestions"
    >
      {visible.map((suggestion, index) => {
        const cfg = TYPE_CONFIG[suggestion.type];
        const Icon = cfg.icon;
        const borderOpacity = PRIORITY_BORDER[suggestion.priority];

        return (
          <div
            key={`${suggestion.type}-${index}`}
            className="flex min-w-[220px] max-w-[300px] shrink-0 items-start gap-2.5 rounded-lg px-3 py-2.5 animate-in slide-in-from-bottom-2 duration-300"
            style={{
              backgroundColor: "var(--paper)",
              border: `1.5px solid color-mix(in srgb, ${cfg.color} ${Math.round(Number(borderOpacity) * 100)}%, transparent)`,
            }}
          >
            <Icon
              size={16}
              className="mt-0.5 shrink-0"
              style={{ color: cfg.color }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: "var(--ink)" }}
              >
                {suggestion.title}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-gray-500 line-clamp-2">
                {suggestion.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(index)}
              className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label={`Dismiss suggestion: ${suggestion.title}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <span className="shrink-0 text-xs font-medium text-gray-400">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
