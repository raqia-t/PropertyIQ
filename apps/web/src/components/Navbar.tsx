"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import {
  PlusCircle,
  LogIn
} from "lucide-react";

export default function Navbar() {
  const { activeWorkspace, config } = useWorkspace();
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (pathname === href) return true;
    const baseHref = href.split("?")[0];
    if (baseHref !== "/" && pathname.startsWith(baseHref)) {
      return true;
    }
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Tier 1: Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand + Interactive Workspace Switcher */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:bg-emerald-700 transition">
              PQ
            </div>
            <div className="hidden xs:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">PropertyIQ</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Pakistan
                </span>
              </div>
            </div>
          </Link>

          {/* Interactive Workspace Switcher */}
          <WorkspaceSwitcher />
        </div>

        {/* Center: Guest-Only Public Navigation */}
        {activeWorkspace === "guest" && (
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            {config.primaryNav.map((item, idx) => {
              const active = isItemActive(item.href);
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={`transition py-1 relative flex items-center gap-1.5 ${
                    active
                      ? "text-emerald-700 font-extrabold border-b-2 border-emerald-600 pb-0.5"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right: Contextual CTAs & Profile Badge */}
        <div className="flex items-center gap-3 shrink-0">
          {activeWorkspace === "guest" ? (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg transition"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/properties/new"
                className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>List Property</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-xs">
              {(activeWorkspace === "agent" || activeWorkspace === "agency") && (
                <Link
                  href="/properties/new"
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>List Property</span>
                </Link>
              )}

              {activeWorkspace === "developer" && (
                <Link
                  href="/developer"
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Unit</span>
                </Link>
              )}

              <div className="hidden lg:flex flex-col text-right">
                <span className="font-bold text-slate-900 leading-tight">
                  {config.userTitle || config.tagline}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {config.orgName || config.label}
                </span>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                {config.name.charAt(0)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tier 2: Dedicated Workspace Sub-Navigation Bar for Professional Workspaces */}
      {activeWorkspace !== "guest" && (
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-6 overflow-x-auto whitespace-nowrap text-xs font-semibold py-2.5 scrollbar-none">
              {config.primaryNav.map((item, idx) => {
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    className={`transition py-1 flex items-center gap-1.5 shrink-0 ${
                      active
                        ? "text-emerald-700 font-black border-b-2 border-emerald-600 pb-0.5"
                        : "text-slate-600 hover:text-slate-900 border-b-2 border-transparent pb-0.5"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
