"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Shield } from "lucide-react";

const CONSENT_KEY = "pretive_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so page renders first
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: true, date: new Date().toISOString() }));
    setVisible(false);
  }

  function handleEssentialOnly() {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: false, date: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <Shield size={20} className="mt-0.5 shrink-0 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Privacy & Cookies</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              We use essential cookies to make Pretive work. We also use analytics cookies to understand
              how you use the product and improve it. Your data is processed in accordance with our{" "}
              <Link href="/privacy" className="font-medium underline" style={{ color: "var(--red)" }}>
                Privacy Policy
              </Link>
              . AI-generated content is clearly labeled throughout the platform.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleAccept}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--red)" }}
              >
                Accept All
              </button>
              <button
                onClick={handleEssentialOnly}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Essential Only
              </button>
            </div>
          </div>
          <button
            onClick={handleEssentialOnly}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close cookie banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
