"use client";

interface ListData {
  items?: string[];
  ordered?: boolean;
  [key: string]: unknown;
}

interface DynamicListProps {
  data: Record<string, unknown>;
  theme?: "dark" | "light";
}

export default function DynamicList({ data, theme = "dark" }: DynamicListProps) {
  const listData = data as ListData;
  const items = listData.items || [];
  const ordered = listData.ordered ?? false;
  const isDark = theme === "dark";

  if (items.length === 0) {
    return <p className="text-center text-sm opacity-50">No list data</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
            style={{
              backgroundColor: isDark ? "rgba(217,66,40,0.15)" : "rgba(217,66,40,0.1)",
              color: "#D94228",
            }}
          >
            {ordered ? i + 1 : ""}
          </span>
          <span
            className="text-sm leading-relaxed"
            style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
