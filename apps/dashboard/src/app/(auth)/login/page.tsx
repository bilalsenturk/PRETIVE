"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login")) {
          setError("Invalid email or password. Please check your credentials and try again.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("Please verify your email address before signing in. Check your inbox for the confirmation link.");
        } else {
          setError(authError.message);
        }
        return;
      }

      router.push("/sessions");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetSent(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Password reset sent state
  if (resetSent) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-sm text-center"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(42, 125, 79, 0.1)" }}
          >
            <Mail size={24} style={{ color: "#2A7D4F" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
            Reset link sent
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            If an account exists for <strong>{email}</strong>, you will receive a password reset link.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Check your spam folder if you do not see the email.
          </p>
          <button
            onClick={() => { setResetMode(false); setResetSent(false); }}
            className="mt-6 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--red)" }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // Password reset form
  if (resetMode) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-sm"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <button
            onClick={() => { setResetMode(false); setError(null); }}
            className="mb-4 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>

          <div className="mb-6">
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              Reset your password
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter your email and we will send you a reset link.
            </p>
          </div>

          <form onSubmit={handlePasswordReset} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="reset-email"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@institution.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-gray-400"
                style={{ backgroundColor: "var(--paper)" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--red)" }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main login form
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-sm"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div className="mb-8 text-center">
          <img src="/logo.jpg" alt="PRETIVE" width={40} height={40} className="mx-auto mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your PRETIVE account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--ink)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@institution.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-gray-400"
              style={{ backgroundColor: "var(--paper)" }}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setResetMode(true)}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--red)" }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-gray-400"
                style={{ backgroundColor: "var(--paper)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--red)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--red)" }}
          >
            Sign up
          </Link>
        </p>

        <p className="mt-4 text-center text-[10px] text-gray-300">
          PRETIVE B.V. (in formation) &middot; EU-based &middot; GDPR compliant
        </p>
      </div>
    </div>
  );
}
