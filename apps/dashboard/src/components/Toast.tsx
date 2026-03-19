"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose?: () => void;
}

const toastConfig: Record<
  string,
  { bg: string; border: string; text: string; icon: typeof Info }
> = {
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: XCircle,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: Info,
  },
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const config = toastConfig[type] || toastConfig.info;
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg ${config.bg} ${config.border}`}
      >
        <Icon size={16} className={config.text} />
        <span className={`text-sm font-medium ${config.text}`}>
          {message}
        </span>
        <button
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
          className={`ml-2 rounded p-0.5 transition-colors hover:bg-black/5 ${config.text}`}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
