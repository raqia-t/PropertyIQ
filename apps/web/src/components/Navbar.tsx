"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import {
  Building2,
  ShieldCheck,
  Sparkles,
  PlusCircle,
  User,
  Bell,
  LogIn
} from "lucide-react";

export default function Navbar() {
  const { activeWorkspace, config } = useWorkspace();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand + Active Workspace Identifier */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:bg-emerald-700 transition">
              PQ
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">PropertyIQ</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Pakistan
                </span>
              </div>
            </div>
          </Link>

          {/* Active Workspace Tag (Desktop) */}
          <div className="hidden xl:flex items-center">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${config.badgeColor}`}
            >
              {config.name} Scope
            </span>
          </div>
        </div>

        {/* Center: Role-Aware Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-600">
          {config.primaryNav.map((item, idx) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={idx}
                href={item.href}
                className={`transition py-1 relative flex items-center gap-1.5 ${
                  isActive
                    ? "text-emerald-700 font-extrabold border-b-2 border-emerald-600 pb-0.5"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Workspace Switcher + Contextual User CTA */}
        <div className="flex items-center gap-3">
          {/* Workspace Switcher Component */}
          <WorkspaceSwitcher />

          {/* Contextual Action depending on Workspace */}
          {activeWorkspace === "guest" && (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg transition"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/properties/new"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl shadow-xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>List Property</span>
              </Link>
            </div>
          )}

          {activeWorkspace !== "guest" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:inline-block text-slate-500 font-medium text-[11px] truncate max-w-[140px]">
                {config.userTitle || config.tagline}
              </span>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                {config.name.charAt(0)}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
