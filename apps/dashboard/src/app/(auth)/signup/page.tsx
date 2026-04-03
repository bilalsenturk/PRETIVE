"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedAI, setAcceptedAI] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedTerms || !acceptedAI) {
      setError("Please accept both the Privacy Policy and AI processing consent to continue.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            accepted_terms_at: new Date().toISOString(),
            accepted_ai_consent_at: new Date().toISOString(),
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("This email is already registered. Please sign in instead.");
        } else {
          setError(authError.message);
        }
        return;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required — show success state
        setEmailSent(true);
      } else if (data.session) {
        // No confirmation needed — direct login
        router.push("/sessions");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Email sent success state
  if (emailSent) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 shadow-sm text-center"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(42, 125, 79, 0.1)" }}
          >
            <Mail size={28} style={{ color: "#2A7D4F" }} />
          </div>

          <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
            Check your email
          </h1>

          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            We sent a verification link to
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {email}
          </p>

          <div
            className="mt-6 rounded-xl p-4 text-left"
            style={{ backgroundColor: "rgba(42, 125, 79, 0.04)", border: "1px solid rgba(42, 125, 79, 0.1)" }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0" style={{ color: "#2A7D4F" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  What happens next
                </p>
                <ol className="mt-2 space-y-1.5 text-xs text-gray-500 list-decimal list-inside">
                  <li>Open the email from PRETIVE</li>
                  <li>Click the confirmation link</li>
                  <li>You will be redirected to your dashboard</li>
                </ol>
              </div>
            </div>
          </div>

          <p className="mt-5 text-xs text-gray-400">
            Did not receive the email? Check your spam folder or{" "}
            <button
              onClick={() => setEmailSent(false)}
              className="font-medium underline"
              style={{ color: "var(--red)" }}
            >
              try again
            </button>
          </p>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <Link
              href="/login"
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--red)" }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start using PRETIVE for live teaching
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
              Work email
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
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--ink)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
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

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--ink)" }}
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter your password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-gray-400"
                style={{ backgroundColor: "var(--paper)" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* GDPR-compliant separate consents */}
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#D94228]"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I have read and agree to the{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "var(--red)" }}>
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/dpa" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "var(--red)" }}>
                  Data Processing Agreement
                </a>.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedAI}
                onChange={(e) => setAcceptedAI(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#D94228]"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I consent to my uploaded content and session transcripts being processed by AI for real-time content matching and delivery assistance. I can withdraw this consent at any time via Settings.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptedTerms || !acceptedAI}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--red)" }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--red)" }}
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-[10px] text-gray-300">
          PRETIVE B.V. (in formation) &middot; EU-based &middot; GDPR compliant
        </p>
      </div>
    </div>
  );
}
