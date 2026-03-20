"use client";

import Sidebar from "@/components/Sidebar";
import Onboarding from "@/components/Onboarding";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
      <Onboarding />
    </div>
  );
}
