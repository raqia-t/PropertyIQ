"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace, WORKSPACE_CONFIGS, WorkspaceRole } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { WORKSPACE_HOME } from "@/lib/roles";
import {
  ChevronDown,
  Check,
  User,
  Building,
  Building2,
  ShieldCheck,
  Home,
  Briefcase,
  X,
  Lock,
  LogIn,
} from "lucide-react";

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const { activeWorkspace, config, setWorkspace } = useWorkspace();
  const { isAuthenticated, availableWorkspaces } = useAuth();
  const { startLoading } = useLoading();
  const [isOpen, setIsOpen] = useState(false);

  const getWorkspaceIcon = (role: WorkspaceRole) => {
    switch (role) {
      case "guest":
        return <User className="w-4 h-4 text-slate-600" />;
      case "customer":
        return <Home className="w-4 h-4 text-emerald-600" />;
      case "agent":
        return <Briefcase className="w-4 h-4 text-blue-600" />;
      case "agency":
        return <Building className="w-4 h-4 text-purple-600" />;
      case "developer":
        return <Building2 className="w-4 h-4 text-amber-600" />;
      case "verifier":
        return <ShieldCheck className="w-4 h-4 text-teal-600" />;
    }
  };

  const handleSelectWorkspace = (role: WorkspaceRole) => {
    const ok = setWorkspace(role);
    if (!ok) {
      setIsOpen(false);
      router.push(`/auth/login?next=${encodeURIComponent(WORKSPACE_HOME[role])}`);
      return;
    }
    setIsOpen(false);
    startLoading(`Loading ${WORKSPACE_CONFIGS[role].name} Workspace...`);
    router.push(WORKSPACE_HOME[role]);
  };

  // Guests only see Guest + Sign in CTA. Authenticated users see only allowed workspaces.
  const rolesList: WorkspaceRole[] = isAuthenticated
    ? availableWorkspaces
    : ["guest"];

  const lockedRoles: WorkspaceRole[] = isAuthenticated
    ? (["customer", "agent", "agency", "developer", "verifier"] as WorkspaceRole[]).filter(
        (r) => !availableWorkspaces.includes(r)
      )
    : ["customer", "agent", "agency", "developer", "verifier"];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-xs font-semibold text-slate-800"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-1.5">
          {getWorkspaceIcon(activeWorkspace)}
          <span className="font-extrabold">{config.name}</span>
          <span className="text-slate-400 font-normal hidden sm:inline">| {config.label}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isAuthenticated ? "Your allowed workspaces" : "Browsing mode"}
                </span>
                <h4 className="text-sm font-black text-slate-900">PropertyIQ Workspaces</h4>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {rolesList.map((role) => {
                const item = WORKSPACE_CONFIGS[role];
                const isSelected = activeWorkspace === role;

                return (
                  <button
                    type="button"
                    key={role}
                    onClick={() => handleSelectWorkspace(role)}
                    className={`w-full text-left cursor-pointer rounded-xl p-2.5 transition flex items-start justify-between border ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
                        : "border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-100 mt-0.5 shrink-0">
                        {getWorkspaceIcon(role)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{item.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">• {item.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.tagline}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />}
                  </button>
                );
              })}

              {lockedRoles.length > 0 && (
                <div className="pt-2 mt-1 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    {isAuthenticated ? "Not available for your role" : "Sign in to unlock"}
                  </p>
                  {lockedRoles.map((role) => {
                    const item = WORKSPACE_CONFIGS[role];
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/auth/login?next=${encodeURIComponent(WORKSPACE_HOME[role])}`);
                        }}
                        className="w-full text-left rounded-xl p-2.5 flex items-start justify-between border border-dashed border-slate-200 bg-slate-50/80 opacity-80 hover:opacity-100 transition"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 mt-0.5 shrink-0 relative">
                            {getWorkspaceIcon(role)}
                            <Lock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-slate-500" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-600">{item.name}</span>
                            <p className="text-[11px] text-slate-400 mt-0.5">Requires authorized account</p>
                          </div>
                        </div>
                        <LogIn className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Navigation and permissions follow your signed-in role — not a global menu of every feature.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
