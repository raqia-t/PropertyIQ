"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { WORKSPACE_HOME, isNavItemActive } from "@/lib/roles";
import { PlusCircle, LogIn, LogOut, MoreHorizontal, ChevronDown } from "lucide-react";

function NavbarInner() {
  const { activeWorkspace, config } = useWorkspace();
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.toString();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const brandHome = WORKSPACE_HOME[activeWorkspace];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const displayName = user?.fullName || config.userTitle || config.tagline;
  const displayOrg = config.orgName || config.label;
  const initials = (user?.fullName || config.name || "P")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link href={brandHome} className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:bg-emerald-700 transition">
              PQ
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">PropertyIQ</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Pakistan
                </span>
              </div>
            </div>
          </Link>

          <WorkspaceSwitcher />
        </div>

        {activeWorkspace === "guest" && (
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            {config.primaryNav.map((item, idx) => {
              const active = isNavItemActive(pathname, search, item.href);
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
                href="/auth/signup"
                className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm transition"
              >
                <span>Sign Up</span>
              </Link>
              <Link
                href="/auth/login?next=%2Fproperties%2Fnew"
                className="hidden md:inline-flex items-center gap-1 text-xs font-bold border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
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
                <span className="font-bold text-slate-900 leading-tight">{displayName}</span>
                <span className="text-[10px] text-slate-400 font-medium">{displayOrg}</span>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px]">
                {initials}
              </div>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-rose-700 px-2 py-1.5 rounded-lg hover:bg-rose-50 transition"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Sign out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeWorkspace !== "guest" && (
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-5 overflow-x-auto whitespace-nowrap text-xs font-semibold py-2.5 scrollbar-none">
              {config.primaryNav.map((item, idx) => {
                const active = isNavItemActive(pathname, search, item.href);
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

              {config.secondaryNav && config.secondaryNav.length > 0 && (
                <div className="relative shrink-0 ml-auto" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 py-1 border-b-2 border-transparent"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span>More</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {moreOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50">
                      {config.secondaryNav.map((item, idx) => (
                        <Link
                          key={idx}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {item.label}
                        </Link>
                      ))}
                      {isAuthenticated && (
                        <button
                          type="button"
                          onClick={() => {
                            setMoreOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:hidden"
                        >
                          Sign out
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
      <NavbarInner />
    </Suspense>
  );
}
