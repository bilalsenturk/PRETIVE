"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase handles the token exchange automatically via the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          setStatus("success");
          // Redirect to dashboard after a brief success message
          setTimeout(() => {
            router.push("/sessions");
          }, 2000);
        } else {
          // No session yet — try to exchange the code
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setStatus("error");
              setErrorMessage(sessionError.message);
            } else {
              setStatus("success");
              setTimeout(() => {
                router.push("/sessions");
              }, 2000);
            }
          } else {
            setStatus("error");
            setErrorMessage("No valid authentication tokens found. The link may have expired.");
          }
        }
      } catch {
        setStatus("error");
        setErrorMessage("An unexpected error occurred during verification.");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-sm text-center"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <img src="/logo.jpg" alt="PRETIVE" width={40} height={40} className="mx-auto mb-4 rounded-xl" />

        {status === "verifying" && (
          <>
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-gray-400" />
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              Verifying your email...
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Please wait while we confirm your account.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "rgba(42, 125, 79, 0.1)" }}
            >
              <CheckCircle size={28} style={{ color: "#2A7D4F" }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              Email verified!
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your account is ready. Redirecting to your dashboard...
            </p>
            <div className="mt-4">
              <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: "#2A7D4F",
                    animation: "fillBar 2s ease-out forwards",
                  }}
                />
              </div>
            </div>
            <style>{`
              @keyframes fillBar {
                from { width: 0; }
                to { width: 100%; }
              }
            `}</style>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "rgba(217, 66, 40, 0.08)" }}
            >
              <AlertCircle size={28} style={{ color: "#D94228" }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {errorMessage || "Something went wrong. Please try signing up again."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--red)" }}
              >
                Sign up again
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
