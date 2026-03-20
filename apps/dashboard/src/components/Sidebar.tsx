"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/sessions", label: "Sessions", icon: LayoutList, exact: false },
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
      aria-label="Main sidebar navigation"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{ backgroundColor: "var(--red)" }}
          aria-hidden="true"
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
      <nav className="flex-1 space-y-1 p-2" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
              style={isActive ? { backgroundColor: "var(--red)" } : undefined}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
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
          className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <ChevronLeft size={20} className="shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight size={20} className="shrink-0" aria-hidden="true" />
          )}
          {expanded && <span className="ml-3 whitespace-nowrap">Collapse</span>}
        </button>

        <button
          className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label="Sign out"
        >
          <LogOut size={20} className="shrink-0" aria-hidden="true" />
          {expanded && <span className="ml-3 whitespace-nowrap">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
