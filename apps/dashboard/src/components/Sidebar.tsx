"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutList,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/sessions", label: "Sessions", icon: LayoutList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className="flex h-screen flex-col border-r border-gray-200 transition-all duration-200"
      style={{
        width: expanded ? 240 : 64,
        backgroundColor: "var(--paper)",
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{ backgroundColor: "var(--red)" }}
        >
          P
        </div>
        {expanded && (
          <span
            className="ml-3 text-lg font-bold whitespace-nowrap"
            style={{ color: "var(--ink)" }}
          >
            Pretive
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              style={isActive ? { backgroundColor: "var(--red)" } : undefined}
              title={item.label}
            >
              <Icon size={20} className="shrink-0" />
              {expanded && (
                <span className="ml-3 whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-2 space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <ChevronLeft size={20} className="shrink-0" />
          ) : (
            <ChevronRight size={20} className="shrink-0" />
          )}
          {expanded && <span className="ml-3 whitespace-nowrap">Collapse</span>}
        </button>

        <button
          className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Sign out"
        >
          <LogOut size={20} className="shrink-0" />
          {expanded && <span className="ml-3 whitespace-nowrap">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
