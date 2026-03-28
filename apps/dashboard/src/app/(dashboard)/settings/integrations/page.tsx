"use client";

import { useEffect, useState, useCallback } from "react";
import { get, del } from "@/lib/api";
import { Check, X, Loader2, ExternalLink } from "lucide-react";

interface IntegrationStatus {
  connected: boolean;
  connected_at?: string;
}

interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  connectPath: string;
}

const INTEGRATIONS: IntegrationInfo[] = [
  {
    id: "google",
    name: "Google Drive",
    description: "Import PDF, PPTX, and DOCX files directly from your Drive.",
    icon: "G",
    connectPath: "/api/integrations/google/auth-url",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Run Pretive as an overlay panel during Zoom meetings.",
    icon: "Z",
    connectPath: "/api/zoom/auth-url",
  },
];

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    get<Record<string, IntegrationStatus>>("/api/integrations/status")
      .then(setStatuses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = useCallback(async (integration: IntegrationInfo) => {
    setActionLoading(integration.id);
    try {
      const res = await get<{ url: string }>(integration.connectPath);
      if (res.url) {
        const popup = window.open(res.url, `${integration.id}-auth`, "width=500,height=600");

        const handler = (event: MessageEvent) => {
          if (
            event.data?.type === `${integration.id}-oauth-success` ||
            event.data?.type === "google-oauth-success"
          ) {
            window.removeEventListener("message", handler);
            popup?.close();
            setStatuses((prev) => ({
              ...prev,
              [integration.id]: { connected: true, connected_at: new Date().toISOString() },
            }));
          }
        };
        window.addEventListener("message", handler);
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDisconnect = useCallback(async (integrationId: string) => {
    setActionLoading(integrationId);
    try {
      await del(`/api/integrations/${integrationId}`);
      setStatuses((prev) => ({
        ...prev,
        [integrationId]: { connected: false },
      }));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-6 text-sm text-gray-500">
        Connect external services to enhance your Pretive experience.
      </p>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const status = statuses[integration.id];
          const isConnected = status?.connected;
          const isLoading = actionLoading === integration.id;

          return (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {integration.name}
                    </h3>
                    {isConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{integration.description}</p>
                </div>
              </div>

              <div>
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                ) : isConnected ? (
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <X size={12} />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#D94228] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#c13a23]"
                  >
                    <ExternalLink size={12} />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Google Meet — no OAuth needed, just a side panel */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">
              M
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Google Meet</h3>
              <p className="text-xs text-gray-500">
                Open Pretive as a side panel during Meet calls. No connection needed.
              </p>
            </div>
          </div>
          <a
            href="/integrations/meet"
            target="_blank"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <ExternalLink size={12} />
            Open Panel
          </a>
        </div>
      </div>
    </div>
  );
}
