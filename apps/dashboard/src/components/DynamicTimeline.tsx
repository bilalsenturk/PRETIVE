"use client";

interface TimelineData {
  events?: Array<{ date?: string; title?: string; description?: string }>;
  [key: string]: unknown;
}

interface DynamicTimelineProps {
  data: Record<string, unknown>;
  theme?: "dark" | "light";
}

export default function DynamicTimeline({ data, theme = "dark" }: DynamicTimelineProps) {
  const timelineData = data as TimelineData;
  const events = timelineData.events || [];
  const isDark = theme === "dark";

  if (events.length === 0) {
    return <p className="text-center text-sm opacity-50">No timeline data</p>;
  }

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div
        className="absolute left-3 top-2 bottom-2 w-0.5"
        style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
      />

      <div className="space-y-6">
        {events.map((event, i) => (
          <div key={i} className="relative">
            {/* Dot */}
            <div
              className="absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2"
              style={{
                backgroundColor: i === 0 ? "#D94228" : isDark ? "#1e293b" : "#fff",
                borderColor: "#D94228",
              }}
            />

            {/* Content */}
            <div>
              {event.date && (
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#D94228" }}
                >
                  {event.date}
                </span>
              )}
              {event.title && (
                <p
                  className="mt-0.5 text-sm font-semibold"
                  style={{ color: isDark ? "#fff" : "#1a1a1a" }}
                >
                  {event.title}
                </p>
              )}
              {event.description && (
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                >
                  {event.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
