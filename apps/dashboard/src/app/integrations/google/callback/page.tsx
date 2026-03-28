"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting Google Drive...");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // user_id

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code.");
      return;
    }

    post("/api/integrations/google/callback", { code, user_id: state })
      .then(() => {
        setStatus("success");
        setMessage("Google Drive connected successfully!");

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: "google-oauth-success" }, "*");
          setTimeout(() => window.close(), 1500);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Failed to connect Google Drive. Please try again.");
      });
  }, [searchParams]);

  return (
    <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
      {status === "loading" && (
        <Loader2 size={32} className="mx-auto mb-4 animate-spin text-gray-400" />
      )}
      {status === "success" && (
        <CheckCircle size={32} className="mx-auto mb-4 text-green-500" />
      )}
      {status === "error" && (
        <XCircle size={32} className="mx-auto mb-4 text-red-500" />
      )}
      <p className="text-sm font-medium text-gray-700">{message}</p>
      {status === "success" && (
        <p className="mt-2 text-xs text-gray-400">This window will close automatically.</p>
      )}
      {status === "error" && (
        <button
          onClick={() => window.close()}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200"
        >
          Close
        </button>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Suspense
        fallback={
          <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Connecting...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
