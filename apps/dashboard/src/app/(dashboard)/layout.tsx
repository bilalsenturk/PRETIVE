"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Onboarding from "@/components/Onboarding";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-700">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-red-600">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showOnboarding = pathname === "/";

  return (
    <div
      className="flex min-h-dvh overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 scroll-smooth" style={{ backgroundColor: "#FAFAF8" }}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      {showOnboarding && <Onboarding />}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardContent>{children}</DashboardContent>;
}
