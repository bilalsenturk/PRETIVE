"use client";

interface TableData {
  headers?: string[];
  rows?: string[][];
  [key: string]: unknown;
}

interface DynamicTableProps {
  data: Record<string, unknown>;
  theme?: "dark" | "light";
}

export default function DynamicTable({ data, theme = "dark" }: DynamicTableProps) {
  const tableData = data as TableData;
  const headers = tableData.headers || [];
  const rows = tableData.rows || [];
  const isDark = theme === "dark";

  if (headers.length === 0 && rows.length === 0) {
    return <p className="text-center text-sm opacity-50">No table data</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full text-sm">
        {headers.length > 0 && (
          <thead>
            <tr
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              }}
            >
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-3 text-sm"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                    fontWeight: ci === 0 ? 500 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
