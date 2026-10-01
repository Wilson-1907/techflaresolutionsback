"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ExternalLink } from "lucide-react";
import { getMainSiteUrl } from "@/lib/main-site";
import { mainNav } from "@/lib/sections";

export function Sidebar() {
  const pathname = usePathname();
  const mainSite = getMainSiteUrl();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-deep-blue/40 min-h-screen p-6 flex flex-col overflow-y-auto">
      <div className="mb-6">
        <p className="text-gold text-xs font-semibold uppercase tracking-wider">TechFlare Solutions</p>
        <h1 className="text-lg font-bold">Admin Panel</h1>
        <p className="text-xs text-muted mt-1">All admin operations live here</p>
      </div>

      <nav className="space-y-0.5 flex-1">
        {mainNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-gold/15 text-gold" : "hover:bg-gold/10 text-foreground/90"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" /> {item.label}
            </Link>
          );
        })}
        <a
          href={mainSite}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gold/10 text-muted mt-4"
        >
          <ExternalLink className="h-4 w-4" /> View main site
        </a>
      </nav>

      <button
        type="button"
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-red-500/10 hover:text-red-300 w-full mt-4"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </aside>
  );
}
