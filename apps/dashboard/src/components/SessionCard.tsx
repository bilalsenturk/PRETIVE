"use client";

import { BookOpen, Columns, Lightbulb, Link as LinkIcon } from "lucide-react";

interface CardProps {
  card: {
    id: string;
    card_type: "summary" | "comparison" | "concept" | "context_bridge";
    title: string;
    content: string | { text: string };
    display_order: number;
  };
}

const cardTypeConfig: Record<
  string,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    icon: typeof BookOpen;
    label: string;
  }
> = {
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

export default function SessionCard({ card }: CardProps) {
  const config = cardTypeConfig[card.card_type] || cardTypeConfig.summary;
  const Icon = config.icon;
  const rawContent =
    typeof card.content === "string"
      ? card.content
      : card.content?.text || "";
  const contentPreview =
    rawContent.length > 200 ? rawContent.slice(0, 200) + "..." : rawContent;

  return (
    <div
      className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}
    >
      {/* Card type badge + icon */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.iconBg}`}
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
        {card.title}
      </h3>

      {/* Content preview */}
      <p className="text-xs leading-relaxed text-gray-600">
        {contentPreview}
      </p>
    </div>
  );
}
