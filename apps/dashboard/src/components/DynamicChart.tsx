"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut, Radar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartData {
  chart_type?: string;
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }>;
  [key: string]: unknown;
}

interface DynamicChartProps {
  data: Record<string, unknown>;
  theme?: "dark" | "light";
}

const COLORS = [
  "#D94228", "#2563eb", "#16a34a", "#d97706", "#7c3aed",
  "#0d9488", "#e11d48", "#ea580c", "#4f46e5", "#059669",
];

export default function DynamicChart({ data, theme = "dark" }: DynamicChartProps) {
  const chartData = data as ChartData;
  const chartType = chartData.chart_type || "bar";
  const isDark = theme === "dark";

  const textColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const labels = chartData.labels || [];
  const datasets = (chartData.datasets || []).map((ds, i) => ({
    label: ds.label || `Dataset ${i + 1}`,
    data: ds.data || [],
    backgroundColor: ds.backgroundColor || COLORS[i % COLORS.length],
    borderColor: ds.borderColor || COLORS[i % COLORS.length],
    borderWidth: chartType === "line" ? 2 : 0,
    borderRadius: chartType === "bar" ? 6 : 0,
    pointRadius: chartType === "line" ? 4 : 0,
    tension: 0.3,
    fill: chartType === "line" ? false : undefined,
  }));

  const config = {
    labels,
    datasets,
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 600, easing: "easeOutQuart" as const },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: textColor, padding: 16, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: isDark ? "#1e293b" : "#fff",
        titleColor: isDark ? "#fff" : "#000",
        bodyColor: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: ["bar", "line"].includes(chartType)
      ? {
          x: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
        }
      : undefined,
  };

  const ChartComponent =
    chartType === "line" ? Line
    : chartType === "pie" ? Pie
    : chartType === "doughnut" ? Doughnut
    : chartType === "radar" ? Radar
    : Bar;

  return (
    <div className="mx-auto max-w-2xl">
      <ChartComponent data={config} options={options} />
    </div>
  );
}
