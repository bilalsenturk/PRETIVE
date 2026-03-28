"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { User, Building2, Users, Bell, Shield, Plug } from "lucide-react";

const tabs = [
  { href: "/settings", label: "Profile", icon: User, exact: true },
  { href: "/settings/organization", label: "Organization", icon: Building2, exact: false },
  { href: "/settings/members", label: "Members", icon: Users, exact: false },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, exact: false },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, exact: false },
  { href: "/settings/security", label: "Security", icon: Shield, exact: false },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <nav className="flex gap-1 border-b border-gray-200 mb-8">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                isActive
                  ? "border-[#D94228] text-[#D94228]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
