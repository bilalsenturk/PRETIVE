"use client";

import DynamicChart from "./DynamicChart";
import DynamicTable from "./DynamicTable";
import DynamicSummary from "./DynamicSummary";
import DynamicTimeline from "./DynamicTimeline";
import DynamicList from "./DynamicList";

interface DynamicContentProps {
  type: "chart" | "table" | "summary" | "timeline" | "list" | "card";
  data: Record<string, unknown>;
  title: string;
  theme?: "dark" | "light";
}

export default function DynamicContent({ type, data, title, theme = "dark" }: DynamicContentProps) {
  switch (type) {
    case "chart":
      return <DynamicChart data={data} theme={theme} />;
    case "table":
      return <DynamicTable data={data} theme={theme} />;
    case "summary":
      return <DynamicSummary data={data} theme={theme} />;
    case "timeline":
      return <DynamicTimeline data={data} theme={theme} />;
    case "list":
      return <DynamicList data={data} theme={theme} />;
    default:
      return (
        <div className="text-center py-8">
          <p className="text-sm opacity-50">Unknown content type: {type}</p>
        </div>
      );
  }
}
