"use client";

interface SummaryData {
  summary?: string;
  key_points?: string[];
  [key: string]: unknown;
}

interface DynamicSummaryProps {
  data: Record<string, unknown>;
  theme?: "dark" | "light";
}

export default function DynamicSummary({ data, theme = "dark" }: DynamicSummaryProps) {
  const summaryData = data as SummaryData;
  const isDark = theme === "dark";

  return (
    <div className="space-y-4">
      {summaryData.summary && (
        <p
          className="text-base leading-relaxed"
          style={{ color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)" }}
        >
          {summaryData.summary}
        </p>
      )}
      {summaryData.key_points && summaryData.key_points.length > 0 && (
        <ul className="space-y-2">
          {summaryData.key_points.map((point, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: "#D94228",
                  color: "#fff",
                }}
              >
                {i + 1}
              </span>
              <span
                className="text-sm leading-relaxed"
                style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)" }}
              >
                {point}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
