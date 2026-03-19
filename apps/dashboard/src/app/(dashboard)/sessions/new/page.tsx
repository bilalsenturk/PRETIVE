"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import { post, upload } from "@/lib/api";

interface CreateSessionResponse {
  id: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Please enter a session title.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Create the session
      const session = await post<CreateSessionResponse>("/api/sessions", {
        title: title.trim(),
      });

      // Upload documents if any
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          await upload(`/api/sessions/${session.id}/documents`, formData);
        }
      }

      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Back to Sessions
        </Link>
        <h1
          className="mt-3 text-2xl font-bold"
          style={{ color: "var(--ink)" }}
        >
          New Session
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          className="rounded-2xl border border-gray-200 p-6 space-y-6"
          style={{ backgroundColor: "var(--paper)" }}
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--ink)" }}
            >
              Session Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Product Review"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-gray-400"
              style={{ backgroundColor: "var(--paper)" }}
            />
          </div>

          {/* File Upload */}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--ink)" }}
            >
              Documents
            </label>
            <FileUpload files={files} onFilesChange={setFiles} />
          </div>
        </div>

        {/* Submit */}
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--red)" }}
          >
            {loading ? "Creating..." : "Create Session"}
          </button>
        </div>
      </form>
    </div>
  );
}
