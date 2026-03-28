"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, FileSpreadsheet, Presentation, Loader2, CheckSquare, Square, CloudDownload } from "lucide-react";
import { get, post } from "@/lib/api";

interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  file_type: string;
  size: number;
  modified_at: string;
  icon_url: string;
}

interface GoogleDrivePickerProps {
  sessionId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  pptx: Presentation,
  docx: FileSpreadsheet,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GoogleDrivePicker({
  sessionId,
  onClose,
  onImportComplete,
}: GoogleDrivePickerProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check connection status
  useEffect(() => {
    get<Record<string, { connected: boolean }>>("/api/integrations/status")
      .then((status) => {
        const isConnected = status.google?.connected ?? false;
        setConnected(isConnected);
        if (isConnected) loadFiles();
        else setLoading(false);
      })
      .catch(() => {
        setConnected(false);
        setLoading(false);
      });
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ files: DriveFile[]; next_page_token: string | null }>(
        "/api/integrations/google/files"
      );
      setFiles(res.files || []);
    } catch (err) {
      setError("Failed to load files from Google Drive");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const res = await get<{ url: string }>("/api/integrations/google/auth-url");
      if (res.url) {
        // Open in popup
        const popup = window.open(res.url, "google-auth", "width=500,height=600");

        // Listen for callback message
        const handler = (event: MessageEvent) => {
          if (event.data?.type === "google-oauth-success") {
            window.removeEventListener("message", handler);
            popup?.close();
            setConnected(true);
            loadFiles();
          }
        };
        window.addEventListener("message", handler);
      }
    } catch {
      setError("Failed to initiate Google connection");
    }
  }, [loadFiles]);

  const toggleSelect = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setImportProgress(0);
    setError(null);

    const ids = Array.from(selectedIds);
    let completed = 0;

    for (const fileId of ids) {
      try {
        await post("/api/integrations/google/import", {
          file_id: fileId,
          session_id: sessionId,
        });
        completed++;
        setImportProgress(Math.round((completed / ids.length) * 100));
      } catch {
        setError(`Failed to import file. ${completed}/${ids.length} completed.`);
        break;
      }
    }

    setImporting(false);
    if (completed === ids.length) {
      onImportComplete();
    }
  }, [selectedIds, sessionId, onImportComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <CloudDownload size={20} style={{ color: "var(--red)" }} />
            <h2 className="text-lg font-bold text-gray-900">Import from Google Drive</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : connected === false ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-sm text-gray-500">
                Connect your Google Drive to import documents directly.
              </p>
              <button
                onClick={handleConnect}
                className="rounded-xl bg-[#D94228] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c13a23]"
              >
                Connect Google Drive
              </button>
            </div>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No PDF, PPTX, or DOCX files found in your Drive.
            </p>
          ) : (
            <div className="space-y-1">
              {files.map((file) => {
                const Icon = FILE_ICONS[file.file_type] || FileText;
                const isSelected = selectedIds.has(file.id);

                return (
                  <button
                    key={file.id}
                    onClick={() => toggleSelect(file.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-red-50 border border-red-200" : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="shrink-0 text-[#D94228]" />
                    ) : (
                      <Square size={18} className="shrink-0 text-gray-300" />
                    )}
                    <Icon size={18} className="shrink-0 text-gray-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatSize(file.size)} — {file.file_type.toUpperCase()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
          )}
        </div>

        {/* Footer */}
        {connected && files.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <span className="text-xs text-gray-400">
              {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D94228] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing ({importProgress}%)
                </>
              ) : (
                <>
                  <CloudDownload size={14} />
                  Import Selected
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
