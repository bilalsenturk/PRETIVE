"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Target,
  Activity,
  Zap,
  Lightbulb,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { get } from "@/lib/api";

interface Analytics {
  session_id: string;
  title: string;
  duration_seconds: number;
  match_hit_rate: number;
  total_events: number;
  match_events: number;
  topics: TopicCoverage[];
  tips: string[];
}

interface TopicCoverage {
  name: string;
  coverage: number;
  matched_chunks: number;
  total_chunks: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatCard({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-gray-200 p-5 shadow-sm"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <Icon size={20} className="mb-2 text-[#D94228]" aria-hidden="true" />
      <span
        className="text-2xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </span>
      <span className="mt-1 text-xs text-gray-500">{label}</span>
    </div>
  );
}

export default function SessionAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<Analytics>(`/api/sessions/${id}/analytics`);
      setAnalytics(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/sessions/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Session
        </Link>
        <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-600">
          <p>{error || "Analytics not available"}</p>
          <button
            onClick={loadAnalytics}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hitRatePercent = Math.round(analytics.match_hit_rate * 100);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <Link
        href={`/sessions/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Session
      </Link>

      {/* Page title */}
      <h1
        className="mb-8 text-2xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        Session Analytics: {analytics.title}
      </h1>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          value={formatDuration(analytics.duration_seconds)}
          label="Duration"
          icon={Clock}
        />
        <StatCard
          value={`${hitRatePercent}%`}
          label="Coverage"
          icon={Target}
        />
        <StatCard
          value={String(analytics.total_events)}
          label="Total Events"
          icon={Activity}
        />
        <StatCard
          value={String(analytics.match_events)}
          label="Matches"
          icon={Zap}
        />
      </div>

      {/* Topic Coverage */}
      {analytics.topics && analytics.topics.length > 0 && (
        <div
          className="mb-8 rounded-2xl border border-gray-200 p-6 shadow-sm"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <h2
            className="mb-5 text-base font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Topic Coverage
          </h2>
          <div className="space-y-4">
            {analytics.topics.map((topic) => {
              const percent = Math.round(topic.coverage * 100);
              const isSkipped = percent === 0;
              return (
                <div key={topic.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {topic.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-600">
                        {percent}%
                      </span>
                      {isSkipped && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                          <AlertTriangle size={10} aria-hidden="true" />
                          Skipped
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-[#D94228] transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement Tips */}
      {analytics.tips && analytics.tips.length > 0 && (
        <div
          className="mb-8 rounded-2xl border border-gray-200 p-6 shadow-sm"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb
              size={18}
              className="text-[#D94228]"
              aria-hidden="true"
            />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Improvement Tips
            </h2>
          </div>
          <ul className="space-y-3">
            {analytics.tips.map((tip, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm leading-relaxed text-gray-600"
              >
                <Lightbulb
                  size={14}
                  className="mt-0.5 shrink-0 text-[#D94228]"
                  aria-hidden="true"
                />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Back button */}
      <div>
        <Link
          href={`/sessions/${id}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50"
          style={{ color: "var(--ink)" }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Session
        </Link>
      </div>
    </div>
  );
}
