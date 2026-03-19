"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sessions");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--ink)" }}>
          Pretive
        </h1>
        <p className="text-gray-500 mb-6">Redirecting to dashboard...</p>
        <a
          href="/sessions"
          className="inline-flex items-center px-6 py-3 rounded-lg text-white font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: "var(--red)" }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
