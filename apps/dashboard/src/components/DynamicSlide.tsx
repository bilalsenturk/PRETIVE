"use client";

interface SlideItem {
  text: string;
  revealed: boolean;
  chunk_ids?: string[];
}

interface DynamicSlideProps {
  topic: {
    id?: string;
    title: string;
    items: SlideItem[];
    status?: string;
  };
  topicIndex: number;
  totalTopics: number;
  theme?: "dark" | "light";
}

export default function DynamicSlide({
  topic,
  topicIndex,
  totalTopics,
  theme = "dark",
}: DynamicSlideProps) {
  const isDark = theme === "dark";

  const bg = isDark ? "#0f172a" : "#fafafa";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const subtextColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  const itemBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  const itemBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const accentColor = "#D94228";

  const revealedItems = topic.items.filter((item) => item.revealed);
  const totalItems = topic.items.length;

  return (
    <div
      className="flex h-full flex-col items-center justify-center px-12 py-10"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {/* Topic number badge */}
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: accentColor }}
        >
          {topicIndex + 1}
        </span>
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: subtextColor }}
        >
          Topic {topicIndex + 1} of {totalTopics}
        </span>
      </div>

      {/* Topic title */}
      <h1
        className="mb-10 text-center text-4xl font-bold leading-tight"
        style={{ color: textColor, maxWidth: "800px" }}
      >
        {topic.title}
      </h1>

      {/* Progressive items */}
      <div className="w-full max-w-3xl space-y-3">
        {topic.items.map((item, idx) => {
          if (!item.revealed) return null;

          return (
            <div
              key={idx}
              className="flex items-start gap-4 rounded-xl px-6 py-4 transition-all duration-500"
              style={{
                backgroundColor: itemBg,
                border: `1px solid ${itemBorder}`,
                animation: "slideReveal 0.4s ease-out forwards",
                animationDelay: `${idx * 0.05}s`,
              }}
            >
              {/* Bullet number */}
              <span
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: accentColor,
                  color: "#ffffff",
                }}
              >
                {idx + 1}
              </span>

              {/* Item text */}
              <p
                className="text-lg font-medium leading-relaxed"
                style={{ color: textColor }}
              >
                {item.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Progress indicator */}
      {totalItems > 0 && (
        <div className="mt-8 flex items-center gap-3">
          <div
            className="h-1.5 w-32 overflow-hidden rounded-full"
            style={{ backgroundColor: itemBorder }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(revealedItems.length / totalItems) * 100}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: subtextColor }}
          >
            {revealedItems.length} / {totalItems}
          </span>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes slideReveal {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
