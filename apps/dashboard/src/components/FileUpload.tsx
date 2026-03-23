"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_EXTENSIONS = ".pdf,.pptx,.docx";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 10;

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const valid = Array.from(newFiles).filter(
        (f) =>
          ACCEPTED_TYPES.includes(f.type) ||
          /\.(pdf|pptx|docx)$/i.test(f.name)
      );
      if (valid.length > 0) {
        const remaining = MAX_FILES - files.length;
        const toAdd = valid.slice(0, Math.max(0, remaining));
        if (toAdd.length > 0) {
          onFilesChange([...files, ...toAdd]);
        }
        if (valid.length > remaining) {
          alert(`Maximum ${MAX_FILES} files allowed. Some files were not added.`);
        }
      }
    },
    [files, onFilesChange]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? "border-red-400 bg-red-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        style={dragOver ? undefined : { backgroundColor: "var(--bg)" }}
      >
        <Upload
          size={32}
          className={dragOver ? "text-red-500" : "text-gray-400"}
        />
        <p className="mt-3 text-sm font-medium" style={{ color: "var(--ink)" }}>
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, PPTX, DOCX accepted &middot; Max 50MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              style={{ backgroundColor: "var(--paper)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="shrink-0 text-gray-400" />
                <span
                  className="truncate text-sm font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
