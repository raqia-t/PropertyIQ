"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace, WORKSPACE_CONFIGS, WorkspaceRole } from "@/context/WorkspaceContext";
import {
  Home,
  Search,
  Key,
  Building2,
  Sparkles,
  LayoutDashboard,
  Building,
  Users,
  Calendar,
  Layers,
  CheckSquare,
  CreditCard,
  ClipboardList,
  MapPin,
  Camera,
  Activity,
  Menu,
  X,
  Check,
  User,
  ShieldCheck,
  Briefcase
} from "lucide-react";

const roleDefaultRoutes: Record<WorkspaceRole, string> = {
  guest: "/",
  customer: "/",
  agent: "/agent",
  agency: "/agency",
  developer: "/developer",
  verifier: "/specialist",
};

export default function MobileBottomNav() {
  const router = useRouter();
  const { activeWorkspace, config, setWorkspace, isMoreMenuOpen, setIsMoreMenuOpen } = useWorkspace();
  const pathname = usePathname();

  const getNavIcon = (iconName: string, active: boolean) => {
    const className = `w-5 h-5 ${active ? "text-emerald-600" : "text-slate-500"}`;
    switch (iconName) {
      case "Home":
        return <Home className={className} />;
      case "Search":
        return <Search className={className} />;
      case "Key":
        return <Key className={className} />;
      case "Building2":
        return <Building2 className={className} />;
      case "Sparkles":
        return <Sparkles className={className} />;
      case "LayoutDashboard":
        return <LayoutDashboard className={className} />;
      case "Building":
        return <Building className={className} />;
      case "Users":
        return <Users className={className} />;
      case "Calendar":
        return <Calendar className={className} />;
      case "Layers":
        return <Layers className={className} />;
      case "CheckSquare":
        return <CheckSquare className={className} />;
      case "CreditCard":
        return <CreditCard className={className} />;
      case "ClipboardList":
        return <ClipboardList className={className} />;
      case "MapPin":
        return <MapPin className={className} />;
      case "Camera":
        return <Camera className={className} />;
      case "Activity":
        return <Activity className={className} />;
      default:
        return <Home className={className} />;
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
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
    setIsMoreMenuOpen(false);
    router.push(roleDefaultRoutes[role]);
  };

  const rolesList: WorkspaceRole[] = ["guest", "customer", "agent", "agency", "developer", "verifier"];

  return (
    <>
      {/* Fixed Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {config.mobileBottomNav.map((item, idx) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center justify-center py-1 px-2 min-w-[60px]"
            >
              {getNavIcon(item.iconName, isActive)}
              <span
                className={`text-[10px] mt-1 font-semibold ${
                  isActive ? "text-emerald-700 font-extrabold" : "text-slate-600"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 5th Tab: More Button */}
        <button
          onClick={() => setIsMoreMenuOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 min-w-[60px]"
        >
          <Menu className={`w-5 h-5 ${isMoreMenuOpen ? "text-emerald-600" : "text-slate-500"}`} />
          <span
            className={`text-[10px] mt-1 font-semibold ${
              isMoreMenuOpen ? "text-emerald-700 font-extrabold" : "text-slate-600"
            }`}
          >
            More
          </span>
        </button>
      </nav>

      {/* "More" Drawer / Bottom Sheet Modal */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div
            className="flex-1"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl transition-all">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {config.name} Workspace
                </span>
                <h3 className="text-base font-black text-slate-900">{config.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{config.tagline}</p>
              </div>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Secondary Links for this Workspace */}
            {config.secondaryNav && config.secondaryNav.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Workspace Actions & Shortcuts
                </h4>
                <div className="space-y-1">
                  {config.secondaryNav.map((link, idx) => (
                    <Link
                      key={idx}
                      href={link.href}
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-100"
                    >
                      <span>{link.label}</span>
                      <span className="text-slate-400">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Switch Workspace Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Switch Workspace Persona
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {rolesList.map((role) => {
                  const item = WORKSPACE_CONFIGS[role];
                  const isSelected = activeWorkspace === role;

                  return (
                    <div
                      key={role}
                      onClick={() => handleSelectWorkspace(role)}
                      className={`cursor-pointer rounded-xl p-2.5 transition flex items-center justify-between border ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        <span className="text-xs">{item.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
