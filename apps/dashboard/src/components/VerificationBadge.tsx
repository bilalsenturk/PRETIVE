"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";

export interface Verification {
  claim: string | null;
  status: "verified" | "contradicted" | "unverifiable" | "no_claim";
  evidence: string | null;
  confidence: number;
}

interface VerificationBadgeProps {
  verification: Verification;
}

const CONFIG = {
  verified: {
    icon: CheckCircle,
    label: "Verified",
    bg: "rgba(34, 197, 94, 0.1)",
    border: "rgba(34, 197, 94, 0.3)",
    color: "#16a34a",
  },
  contradicted: {
    icon: AlertTriangle,
    label: "Different Information",
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.3)",
    color: "#d97706",
  },
  unverifiable: {
    icon: HelpCircle,
    label: "Unverifiable",
    bg: "rgba(156, 163, 175, 0.15)",
    border: "rgba(156, 163, 175, 0.3)",
    color: "#6b7280",
  },
} as const;

export default function VerificationBadge({
  verification,
}: VerificationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (verification.status === "no_claim") return null;

  const cfg = CONFIG[verification.status];
  const Icon = cfg.icon;

  return (
    <span className="inline-flex flex-col">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
        style={{
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
        }}
        aria-expanded={expanded}
        aria-label={`Verification: ${cfg.label}`}
      >
        <Icon size={12} aria-hidden="true" />
        {cfg.label}
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: expanded ? "200px" : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          className="mt-1 rounded-lg p-2.5 text-xs leading-relaxed"
          style={{
            backgroundColor: cfg.bg,
            border: `1px solid ${cfg.border}`,
            color: "var(--ink)",
          }}
        >
          {verification.claim && (
            <p className="mb-1">
              <span className="font-semibold" style={{ color: cfg.color }}>
                Claim:
              </span>{" "}
              {verification.claim}
            </p>
          )}
          {verification.evidence && (
            <p className="mb-1">
              <span className="font-semibold" style={{ color: cfg.color }}>
                Evidence:
              </span>{" "}
              {verification.evidence}
            </p>
          )}
          <p>
            <span className="font-semibold" style={{ color: cfg.color }}>
              Confidence:
            </span>{" "}
            {Math.round(verification.confidence * 100)}%
          </p>
        </div>
      </div>
    </span>
  );
}
