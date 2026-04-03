"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { get } from "@/lib/api";
import DynamicContent from "@/components/DynamicContent";
import DynamicSlide from "@/components/DynamicSlide";
import SessionCard from "@/components/SessionCard";

interface SlideItem {
  text: string;
  revealed: boolean;
  chunk_ids?: string[];
}

interface DynamicSlideData {
  current_topic_index: number;
  current_item_index: number;
  total_topics: number;
  topic: {
    id?: string;
    title: string;
    items: SlideItem[];
    status?: string;
  };
  all_topics?: Array<{ id: string; title: string; status: string; item_count: number }>;
}

interface DisplayData {
  display_content: {
    type: string;
    data: Record<string, unknown>;
    title: string;
  } | null;
  active_cards: string[];
  current_heading: string | null;
  current_slide: number | null;
  total_slides: number;
  live_summary: string | null;
  theme: "dark" | "light";
  status: string;
  dynamic_slide: DynamicSlideData | null;
}

interface Card {
  id: string;
  card_type: string;
  title: string;
  content: string | { text?: string; [key: string]: unknown };
  display_order: number;
}

export default function PresenterDisplayPage() {
  const params = useParams();
  const id = params.id as string;

  const [display, setDisplay] = useState<DisplayData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [prevContentKey, setPrevContentKey] = useState("");
  const [animating, setAnimating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll display data every 1s
  useEffect(() => {
    async function poll() {
      try {
        const data = await get<DisplayData>(`/api/sessions/${id}/live/display`);
        setDisplay(data);

        // Fetch full card data if active_cards changed
        if (data.active_cards?.length > 0) {
          const cardsData = await get<Card[]>(`/api/sessions/${id}/cards`);
          const activeCards = cardsData.filter((c) =>
            data.active_cards.includes(c.id)
          );
          setCards(activeCards);
        }
      } catch {
        // Session may not be live yet
      }
    }

    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  // Animate content transitions
  useEffect(() => {
    const key = display?.display_content
      ? `${display.display_content.type}-${display.display_content.title}`
      : "none";
    if (key !== prevContentKey) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setAnimating(false);
        setPrevContentKey(key);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [display?.display_content, prevContentKey]);

  const theme = display?.theme || "dark";
  const isDark = theme === "dark";

  const bg = isDark ? "#0f172a" : "#fafafa";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const subtextColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  // Waiting state — show briefing if dynamic slides exist
  if (!display || display.status !== "live") {
    const briefingTopics = display?.dynamic_slide?.all_topics;
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <div className="text-center" style={{ maxWidth: "600px" }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "#D94228" }}>
            <span className="text-2xl font-black text-white">P</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: textColor }}>
            PRETIVE
          </p>
          {briefingTopics && briefingTopics.length > 0 ? (
            <div className="mt-6">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: "#D94228" }}>
                Session Outline
              </p>
              <div className="space-y-2 text-left">
                {briefingTopics.map((t, i) => (
                  <div
                    key={t.id || i}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5"
                    style={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  >
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                      style={{ backgroundColor: "#D94228" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium" style={{ color: textColor }}>
                      {t.title}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: subtextColor }}>
                      {t.item_count} items
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs" style={{ color: subtextColor }}>
                Session will begin when the presenter starts speaking.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm" style={{ color: subtextColor }}>
              Waiting for session to start...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {/* Main content area */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div
          className={`w-full max-w-4xl transition-all duration-300 ${
            animating ? "scale-95 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          {/* Priority: display_content (voice command) > dynamic_slide > cards > heading */}
          {display.display_content ? (
            <div>
              <h2
                className="mb-6 text-center text-2xl font-bold"
                style={{ color: textColor }}
              >
                {display.display_content.title}
              </h2>
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
              >
                <DynamicContent
                  type={display.display_content.type as any}
                  data={display.display_content.data}
                  title=""
                  theme={theme}
                />
              </div>
            </div>
          ) : display.dynamic_slide?.topic ? (
            <DynamicSlide
              topic={display.dynamic_slide.topic}
              topicIndex={display.dynamic_slide.current_topic_index}
              totalTopics={display.dynamic_slide.total_topics}
              theme={theme}
            />
          ) : cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {cards.slice(0, 4).map((card) => (
                <SessionCard key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xl font-semibold" style={{ color: textColor }}>
                {display.current_heading || "Session Active"}
              </p>
              {display.live_summary && (
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: subtextColor }}>
                  {display.live_summary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live summary strip */}
      {display.live_summary && display.display_content && (
        <div
          className="px-8 py-3"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}
        >
          <p className="text-center text-xs leading-relaxed" style={{ color: subtextColor }}>
            {display.live_summary}
          </p>
        </div>
      )}

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-8 py-4"
        style={{
          backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)",
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        {/* Topic */}
        <div className="flex items-center gap-3">
          {display.current_heading && (
            <>
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: "#D94228", color: "#fff" }}
              >
                {display.current_slide != null ? display.current_slide + 1 : ""}
              </span>
              <span className="text-sm font-medium" style={{ color: textColor }}>
                {display.current_heading}
              </span>
            </>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4">
          {display.total_slides > 0 && display.current_slide != null && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full" style={{ backgroundColor: borderColor }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((display.current_slide + 1) / display.total_slides) * 100}%`,
                    backgroundColor: "#D94228",
                  }}
                />
              </div>
              <span className="text-xs font-medium" style={{ color: subtextColor }}>
                {display.current_slide + 1}/{display.total_slides}
              </span>
            </div>
          )}

          {/* PRETIVE watermark */}
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: subtextColor }}
          >
            PRETIVE
          </span>
        </div>
      </div>
    </div>
  );
}
