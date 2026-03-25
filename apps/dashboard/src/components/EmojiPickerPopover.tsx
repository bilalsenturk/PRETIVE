"use client";

import { useState, useRef, useEffect } from "react";
import { EmojiPicker } from "frimousse";
import { Plus } from "lucide-react";

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  compact?: boolean;
}

export default function EmojiPickerPopover({ onSelect, compact }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-all ${compact ? "h-8 w-8" : "h-9 w-9"}`}
        aria-label="More reactions"
        title="More reactions"
      >
        <Plus size={compact ? 14 : 16} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <EmojiPicker.Root
            className="flex h-[320px] w-[320px] flex-col rounded-2xl border bg-white shadow-xl"
            onEmojiSelect={(emoji) => {
              onSelect(emoji.emoji);
              setOpen(false);
            }}
          >
            <div className="p-2 border-b">
              <EmojiPicker.Search
                className="w-full rounded-xl bg-gray-50 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#D94228]/30"
                placeholder="Search emoji..."
                autoFocus
              />
            </div>
            <EmojiPicker.Viewport className="relative flex-1 p-1">
              <EmojiPicker.Loading>
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Loading emoji...
                </div>
              </EmojiPicker.Loading>
              <EmojiPicker.Empty>
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  No emoji found
                </div>
              </EmojiPicker.Empty>
              <EmojiPicker.List
                className="select-none"
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      className="sticky top-0 bg-white/95 backdrop-blur-sm px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide"
                      {...props}
                    >
                      {category.label}
                    </div>
                  ),
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xl hover:bg-[#FEF2F0] transition-colors"
                      {...props}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </div>
      )}
    </div>
  );
}
