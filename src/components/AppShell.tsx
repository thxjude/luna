"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  CheckSquare,
  StickyNote,
  Brain,
  Timer,
  Settings,
  Menu,
  X,
  LogOut,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon; enabled: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/chat", label: "Chat", icon: MessageSquare, enabled: false },
  { href: "/projects", label: "Projects", icon: FolderKanban, enabled: false },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, enabled: false },
  { href: "/notes", label: "Notes", icon: StickyNote, enabled: false },
  { href: "/memory", label: "Memory", icon: Brain, enabled: false },
  { href: "/focus", label: "Focus", icon: Timer, enabled: false },
  { href: "/settings", label: "Settings", icon: Settings, enabled: false },
];

export default function AppShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-slate-950">
          <Sparkles size={18} />
        </span>
        <span className="text-lg font-semibold">Luna</span>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {NAV.map(({ href, label, icon: Icon, enabled }) => {
          const active = pathname === href;
          const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition";
          if (!enabled) {
            return (
              <div
                key={href}
                aria-disabled="true"
                className={`${base} cursor-not-allowed text-slate-600`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`${base} ${
                active
                  ? "bg-indigo-500/15 text-cyan-300"
                  : "text-slate-300 hover:bg-slate-800/70"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-slate-500">{email}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/70"
          >
            <LogOut size={16} />
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-800 bg-slate-950/70 md:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-slate-800 bg-slate-950">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 text-slate-400"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="text-slate-300"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold">Luna</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}