"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { matchProtectedRoute, WORKSPACE_HOME } from "@/lib/roles";

/**
 * Global client-side guard: enforces auth + workspace for protected prefixes.
 * Mount once in the root layout.
 */
export default function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isHydrated, user, availableWorkspaces } = useAuth();
  const { activeWorkspace, isWorkspaceReady, setWorkspace } = useWorkspace();

  const rule = matchProtectedRoute(pathname);
  const ready = isHydrated && isWorkspaceReady;

  useEffect(() => {
    if (!ready || !rule) return;

    // If user is authenticated and allowed into a matching workspace but currently on guest,
    // auto-switch into the first matching allowed workspace.
    if (isAuthenticated && rule.requireAuth) {
      const canUse = rule.workspaces.some((w) => availableWorkspaces.includes(w));
      if (canUse && !rule.workspaces.includes(activeWorkspace)) {
        const target = rule.workspaces.find((w) => availableWorkspaces.includes(w));
        if (target) setWorkspace(target);
      }
    }
  }, [ready, rule, isAuthenticated, availableWorkspaces, activeWorkspace, setWorkspace]);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!rule) {
    return <>{children}</>;
  }

  if (rule.requireAuth && !isAuthenticated) {
    const next = encodeURIComponent(pathname);
    return (
      <AccessDenied
        title="Sign in required"
        message="This area is only available after you authenticate with your PropertyIQ account."
        primaryHref={`/auth/login?next=${next}`}
        primaryLabel="Sign in"
        primaryIcon={<LogIn className="w-4 h-4" />}
      />
    );
  }

  const workspaceAllowed = rule.workspaces.includes(activeWorkspace);
  const roleAllowed = rule.workspaces.some((w) => availableWorkspaces.includes(w));

  if (!workspaceAllowed || !roleAllowed) {
    const home = isAuthenticated
      ? WORKSPACE_HOME[
          availableWorkspaces.find((w) => w !== "guest") ?? "guest"
        ]
      : "/";

    return (
      <AccessDenied
        title="Workspace not authorized"
        message={
          isAuthenticated
            ? `Your account role (${user?.role ?? "Unknown"}) cannot open this area. Switch to an allowed workspace or return to your home.`
            : "You do not have permission to view this workspace."
        }
        primaryHref={home}
        primaryLabel="Go to my workspace"
        primaryIcon={<ArrowLeft className="w-4 h-4" />}
        secondaryHref="/auth/login"
        secondaryLabel="Switch account"
      />
    );
  }

  return <>{children}</>;
}

function AccessDenied({
  title,
  message,
  primaryHref,
  primaryLabel,
  primaryIcon,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  message: string;
  primaryHref: string;
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            {primaryIcon}
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
