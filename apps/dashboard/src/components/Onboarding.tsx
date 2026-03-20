"use client";

import { useState, useEffect } from "react";
import { Upload, Sparkles, Mic, ArrowRight, ArrowLeft, X } from "lucide-react";

const STORAGE_KEY = "pretive_onboarding_seen";

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: Upload,
    title: "Doküman Yükle",
    description:
      "PDF veya PPTX dosyanızı yükleyin. AI içeriğinizi analiz edecek.",
  },
  {
    icon: Sparkles,
    title: "AI Hazırlar",
    description:
      "Yapay zeka anlatı grafiği ve destek kartları oluşturur.",
  },
  {
    icon: Mic,
    title: "Canlı Sunun",
    description:
      "Mikrofonu açın ve konuşun. AI gerçek zamanlı destek sağlar.",
  },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== "true") {
      setVisible(true);
    }
  }, []);

  function handleComplete() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  function handleSkip() {
    handleComplete();
  }

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }

  if (!visible) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-200 p-8 shadow-xl"
        style={{ backgroundColor: "var(--paper)" }}
      >
        {/* Skip / Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Onboarding'i atla"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(217, 66, 40, 0.1)" }}
          >
            <Icon size={32} style={{ color: "var(--red)" }} aria-hidden="true" />
          </div>
        </div>

        {/* Content */}
        <h2
          className="mb-2 text-center text-xl font-bold"
          style={{ color: "var(--ink)" }}
        >
          {step.title}
        </h2>
        <p className="mb-8 text-center text-sm text-gray-500 leading-relaxed">
          {step.description}
        </p>

        {/* Dot indicators */}
        <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Adım ${currentStep + 1} / ${steps.length}`}>
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full transition-all duration-200"
              style={{
                width: i === currentStep ? 24 : 8,
                backgroundColor:
                  i === currentStep ? "var(--red)" : "#D1D5DB",
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3">
          {currentStep > 0 ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ color: "var(--ink)" }}
              aria-label="Önceki adım"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button
              onClick={handleSkip}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              aria-label="Onboarding'i atla"
            >
              Atla
            </button>
          )}

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--red)" }}
            aria-label={isLast ? "Başla" : "Sonraki adım"}
          >
            {isLast ? "Başla" : "İleri"}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
