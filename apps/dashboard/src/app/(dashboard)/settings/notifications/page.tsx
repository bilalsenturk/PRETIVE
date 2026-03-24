"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/user-context";
import { Loader2, Check } from "lucide-react";

interface NotificationPrefs {
  session_completion: boolean;
  session_summary: boolean;
  weekly_report: boolean;
  team_member_joined: boolean;
}

export default function NotificationSettings() {
  const { user, loading: userLoading } = useUser();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    session_completion: true,
    session_summary: true,
    weekly_report: false,
    team_member_joined: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      try {
        const res = await fetch(`${apiBase}/api/notifications/preferences`, {
          headers: { "x-user-id": user.id },
        });
        if (res.ok) setPrefs(await res.json());
      } catch (e) {
        console.error("Failed to fetch notification prefs:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [user, apiBase]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/notifications/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save");
      setToast("Preferences saved");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error("Failed to save notification prefs:", e);
    } finally {
      setSaving(false);
    }
  };

  const toggleItems = [
    {
      key: "session_completion" as const,
      label: "Email on session completion",
      description: "Receive an email when a session finishes processing.",
    },
    {
      key: "session_summary" as const,
      label: "Session summary email",
      description: "Get a summary of session insights delivered to your inbox.",
    },
    {
      key: "weekly_report" as const,
      label: "Weekly usage report",
      description: "A weekly digest of your usage statistics and trends.",
    },
    {
      key: "team_member_joined" as const,
      label: "Team member joined",
      description: "Be notified when a new team member accepts an invitation.",
    },
  ];

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">
          <Check size={16} />
          {toast}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Email Notifications
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Choose which notifications you would like to receive.
        </p>

        <div className="space-y-1">
          {toggleItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl px-4 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.description}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[item.key]}
                onClick={() =>
                  setPrefs((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D94228] focus-visible:ring-offset-2 ${
                  prefs[item.key] ? "bg-[#D94228]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    prefs[item.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t border-gray-100 pt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#D94228] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#C13920] disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
