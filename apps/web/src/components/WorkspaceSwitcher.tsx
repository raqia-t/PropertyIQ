"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, WORKSPACE_CONFIGS, WorkspaceRole } from "@/context/WorkspaceContext";
import {
  ChevronDown,
  Check,
  User,
  Building,
  Building2,
  ShieldCheck,
  Home,
  Briefcase,
  X
} from "lucide-react";

const roleDefaultRoutes: Record<WorkspaceRole, string> = {
  guest: "/",
  customer: "/",
  agent: "/agent",
  agency: "/agency",
  developer: "/developer",
  verifier: "/specialist",
};

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const { activeWorkspace, config, setWorkspace } = useWorkspace();
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
    setWorkspace(role);
    setIsOpen(false);
    router.push(roleDefaultRoutes[role]);
  };

  const rolesList: WorkspaceRole[] = ["guest", "customer", "agent", "agency", "developer", "verifier"];

  return (
    <div className="relative">
      {/* Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-xs font-semibold text-slate-800"
      >
        <span className="flex items-center gap-1.5">
          {getWorkspaceIcon(activeWorkspace)}
          <span className="font-extrabold">{config.name}</span>
          <span className="text-slate-400 font-normal hidden sm:inline">| {config.label}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Switcher Modal / Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Switch Active Persona & Scope
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
                  <div
                    key={role}
                    onClick={() => handleSelectWorkspace(role)}
                    className={`cursor-pointer rounded-xl p-2.5 transition flex items-start justify-between border ${
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

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Simulates RBAC permissions and navigates to the selected workspace.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
