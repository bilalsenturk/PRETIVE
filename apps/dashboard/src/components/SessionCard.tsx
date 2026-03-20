"use client";

import { BookOpen, Columns, Lightbulb, Link as LinkIcon, HelpCircle } from "lucide-react";
import type { ComponentType } from "react";

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

interface CardProps {
  card: CardData;
}

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

function extractContentText(content: CardData["content"]): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    // Try known text fields
    if (typeof content.text === "string") return content.text;
    if (typeof content.summary === "string") return content.summary;
    // Fallback: stringify the object for display
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return "[Unable to display content]";
    }
  }
  return String(content);
}

export default function SessionCard({ card }: CardProps) {
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
      {/* Card type badge + icon */}
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

      {/* Title */}
      <h3
        className="mb-1.5 text-sm font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {displayTitle}
      </h3>

      {/* Content preview */}
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
