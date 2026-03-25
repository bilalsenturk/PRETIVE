"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Sparkles,
  Mic,
  X,
  CheckCircle2,
  Layers,
  Search,
  MonitorPlay,
} from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "pretive_onboarding_seen";
const TOTAL_STEPS = 5;

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== "true") {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }, []);

  const goTo = useCallback(
    (next: number, dir: "forward" | "backward") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setStep(next);
        setAnimating(false);
      }, 200);
    },
    [animating]
  );

  const next = () => {
    if (step < TOTAL_STEPS - 1) goTo(step + 1, "forward");
  };
  const back = () => {
    if (step > 0) goTo(step - 1, "backward");
  };

  if (!visible) return null;

  // -------------------------------------------------------------------------
  // Step content renderers
  // -------------------------------------------------------------------------

  const stepContent: Record<number, React.ReactNode> = {
    // Step 1 — Welcome
    0: (
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
        >
          <Sparkles size={32} style={{ color: "#D94228" }} aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink, #111)" }}>
          Welcome to PRETIVE
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Your AI copilot for live presentations
        </p>
        <input
          type="text"
          placeholder="What's your name?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#D94228] focus:ring-1 focus:ring-[#D94228]/30"
          style={{ color: "var(--ink, #111)" }}
          autoFocus
        />
      </div>
    ),

    // Step 2 — Upload
    1: (
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
        >
          <Upload size={32} style={{ color: "#D94228" }} aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink, #111)" }}>
          Upload Your First Document
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Upload a PDF or PPTX presentation to get started
        </p>
        <Link
          href="/sessions/new"
          onClick={dismiss}
          className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-10 transition-colors hover:border-[#D94228]/40 hover:bg-red-50/30"
        >
          <Upload size={28} className="text-gray-400" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-500">
            Drag & drop or click to upload
          </span>
          <span className="text-xs text-gray-400">PDF, PPTX</span>
        </Link>
      </div>
    ),

    // Step 3 — AI Magic
    2: (
      <div className="flex flex-col items-center text-center">
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink, #111)" }}>
          AI Analyzes Your Content
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Powerful features to support your presentation
        </p>
        <div className="grid w-full max-w-sm gap-3">
          {[
            {
              icon: Layers,
              title: "Smart Cards",
              desc: "AI generates support cards from your content",
            },
            {
              icon: Mic,
              title: "Live Matching",
              desc: "Real-time speech matching during your talk",
            },
            {
              icon: Search,
              title: "Fact Check",
              desc: "Automatic verification of key claims",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
              >
                <feature.icon size={18} style={{ color: "#D94228" }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink, #111)" }}>
                  {feature.title}
                </p>
                <p className="text-xs leading-relaxed text-gray-500">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    // Step 4 — Live Demo
    3: (
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
        >
          <MonitorPlay size={32} style={{ color: "#D94228" }} aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink, #111)" }}>
          Go Live with Confidence
        </h2>
        <p className="mb-2 text-sm leading-relaxed text-gray-500">
          During your session, AI will show relevant cards based on what you&apos;re saying
        </p>
        <div className="mt-4 w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D94228]" />
            </span>
            <span className="text-xs font-semibold text-[#D94228]">Live Session</span>
          </div>
          <div className="space-y-2 p-4">
            {["Summary Card", "Key Concept", "Context Bridge"].map((label) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),

    // Step 5 — Ready
    4: (
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50"
        >
          <CheckCircle2 size={32} className="text-green-500" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--ink, #111)" }}>
          You&apos;re All Set! {"\uD83C\uDF89"}
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-gray-500">
          Create your first session or try a demo
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3 sm:flex-row">
          <Link
            href="/sessions"
            onClick={dismiss}
            className="flex-1 rounded-xl border border-gray-200 px-5 py-3 text-center text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: "var(--ink, #111)" }}
          >
            Try Demo
          </Link>
          <Link
            href="/sessions/new"
            onClick={dismiss}
            className="flex-1 rounded-xl px-5 py-3 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D94228" }}
          >
            Create Session
          </Link>
        </div>
      </div>
    ),
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isFirst = step === 0;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
        style={{ backgroundColor: "#FAFAF8" }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Skip onboarding"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Step number indicator */}
        <div className="px-8 pt-6">
          <span className="text-xs font-medium text-gray-400">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Content area with fade transition */}
        <div
          className="px-8 py-6 transition-opacity duration-200"
          style={{ opacity: animating ? 0 : 1 }}
        >
          {stepContent[step]}
        </div>

        {/* Bottom bar: dots + nav buttons */}
        <div className="flex items-center justify-between border-t border-gray-100 px-8 py-5">
          {/* Dot indicators */}
          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="h-2 rounded-full transition-all duration-200"
                style={{
                  width: i === step ? 20 : 8,
                  backgroundColor: i === step ? "#D94228" : "#D1D5DB",
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {/* Step 0: Skip (dismiss) */}
            {step === 0 && (
              <button
                onClick={dismiss}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              >
                Skip
              </button>
            )}
            {/* Step 1: Skip (go next without uploading) */}
            {step === 1 && (
              <button
                onClick={next}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              >
                Skip
              </button>
            )}
            {/* Steps 2-3: Back button */}
            {(step === 2 || step === 3) && (
              <button
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ color: "var(--ink, #111)" }}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back
              </button>
            )}
            {/* Steps 0-3: Forward button */}
            {!isLast && (
              <button
                onClick={next}
                disabled={step === 0 && name.trim() === ""}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#D94228" }}
              >
                {step === 0 ? "Get Started" : "Next"}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
