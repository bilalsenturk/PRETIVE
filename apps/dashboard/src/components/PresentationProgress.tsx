"use client";

interface PresentationProgressProps {
  totalSlides: number;
  coveredCount: number;
  currentIndex: number | null;
  elapsedSeconds: number;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PresentationProgress({
  totalSlides,
  coveredCount,
  currentIndex,
  elapsedSeconds,
}: PresentationProgressProps) {
  if (totalSlides === 0) return null;

  const coveragePercent = Math.round((coveredCount / totalSlides) * 100);
  const fillPercent = Math.min(100, coveragePercent);

  return (
    <div className="flex items-center gap-3">
      {/* Progress bar */}
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: "#D94228",
          }}
        />
      </div>

      {/* Stats text */}
      <span className="shrink-0 text-xs text-gray-500">
        {coveredCount}/{totalSlides} slides
        <span className="mx-1.5 text-gray-300">&middot;</span>
        {coveragePercent}% covered
        <span className="mx-1.5 text-gray-300">&middot;</span>
        {formatElapsed(elapsedSeconds)} elapsed
      </span>
    </div>
  );
}
