"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Layers,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/sessions", label: "Sessions", icon: Layers, exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className="flex h-screen flex-col bg-white border-r border-[#E5E7EB] p-4 transition-all duration-300 ease-in-out"
      style={{ width: expanded ? 260 : 72 }}
      aria-label="Main sidebar navigation"
    >
      {/* Logo area */}
      <Link
        href="/"
        className={`flex items-center mb-6 ${expanded ? "gap-3 px-2" : "justify-center"}`}
      >
        <Image
          src="/logo.jpg"
          alt="PRETIVE logo"
          width={32}
          height={32}
          className="shrink-0 rounded-xl"
        />
        {expanded && (
          <span
            className="text-sm font-bold tracking-wider uppercase text-gray-900 whitespace-nowrap transition-opacity duration-150"
          >
            PRETIVE
          </span>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center h-[44px] rounded-xl px-3 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-[#FEF2F0] text-[#D94228] font-semibold"
                  : "text-gray-500 hover:bg-gray-50 font-medium"
              } ${!expanded ? "justify-center px-0" : ""}`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {expanded && (
                <span className="ml-3 whitespace-nowrap transition-opacity duration-150">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        <div className="border-t border-[#F3F4F6] my-4" />

        <div className="flex flex-col gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center h-9 w-9 rounded-lg bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 ${
              expanded ? "" : "mx-auto"
            }`}
            style={expanded ? { width: "auto", paddingLeft: 10, paddingRight: 10 } : {}}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? (
              <ChevronLeft size={18} className="shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight size={18} className="shrink-0" aria-hidden="true" />
            )}
            {expanded && (
              <span className="ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-150">
                Collapse
              </span>
            )}
          </button>

          <button
            onClick={async () => {
              if (!window.confirm("Are you sure you want to sign out?")) return;
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className={`flex items-center h-[44px] rounded-xl text-gray-400 transition-colors hover:text-red-500 ${
              expanded ? "px-3" : "justify-center"
            }`}
            aria-label="Sign out"
          >
            <LogOut size={20} className="shrink-0" aria-hidden="true" />
            {expanded && (
              <span className="ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-150">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
