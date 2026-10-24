"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { canAccessWorkspace, defaultWorkspaceForBackendRole } from "@/lib/roles";

export type WorkspaceRole = "guest" | "customer" | "agent" | "agency" | "developer" | "verifier";

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  iconName?: string;
}

export interface WorkspaceConfig {
  id: WorkspaceRole;
  name: string;
  label: string;
  tagline: string;
  badgeColor: string;
  orgName?: string;
  userTitle?: string;
  primaryNav: NavItem[];
  secondaryNav?: NavItem[];
  mobileBottomNav: Array<{ label: string; href: string; iconName: string }>;
}

const BASE_CONFIGS: Record<WorkspaceRole, WorkspaceConfig> = {
  guest: {
    id: "guest",
    name: "Guest",
    label: "Public Browsing",
    tagline: "Explore properties & projects across Pakistan",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
    primaryNav: [
      { label: "Buy", href: "/search?purpose=1" },
      { label: "Rent", href: "/search?purpose=2" },
      { label: "Projects", href: "/projects" },
      { label: "AI Search", href: "/search" },
    ],
    secondaryNav: [
      { label: "Sign In", href: "/auth/login" },
      { label: "Sign Up", href: "/auth/signup" },
      { label: "Compare Properties", href: "/compare" },
    ],
    mobileBottomNav: [
      { label: "Buy", href: "/search?purpose=1", iconName: "Search" },
      { label: "Rent", href: "/search?purpose=2", iconName: "Key" },
      { label: "Projects", href: "/projects", iconName: "Building2" },
      { label: "AI Search", href: "/search", iconName: "Sparkles" },
    ],
  },
  customer: {
    id: "customer",
    name: "Customer",
    label: "Buyer & Tenant Portal",
    tagline: "Explore, save, and track your property journey",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-300",
    orgName: "Verified Buyer",
    userTitle: "Customer",
    primaryNav: [
      { label: "Home", href: "/" },
      { label: "Buy", href: "/search?purpose=1" },
      { label: "Rent", href: "/search?purpose=2" },
      { label: "Projects", href: "/projects" },
      { label: "Saved", href: "/customer/saved" },
    ],
    secondaryNav: [
      { label: "My Activity", href: "/customer/activity" },
      { label: "My Bookings & Installments", href: "/my-bookings" },
      { label: "Verification Requests", href: "/verification" },
      { label: "Compare Shortlist", href: "/compare" },
      { label: "Profile", href: "/customer/profile" },
    ],
    mobileBottomNav: [
      { label: "Home", href: "/", iconName: "Home" },
      { label: "Buy", href: "/search?purpose=1", iconName: "Search" },
      { label: "Projects", href: "/projects", iconName: "Building2" },
      { label: "Saved", href: "/customer/saved", iconName: "Activity" },
    ],
  },
  agent: {
    id: "agent",
    name: "Agent",
    label: "Agent Workspace",
    tagline: "Listings, leads, visits & client pipeline",
    badgeColor: "bg-blue-50 text-blue-800 border-blue-300",
    orgName: "Agency Partner",
    userTitle: "Licensed Agent",
    primaryNav: [
      { label: "Dashboard", href: "/agent" },
      { label: "Properties", href: "/agent/properties" },
      { label: "Leads", href: "/agent/leads" },
      { label: "Clients", href: "/agent/clients" },
      { label: "Visit Calendar", href: "/agent/visit-calendar" },
      { label: "Visits", href: "/agent/visits" },
      { label: "Verification", href: "/agent/verification" },
      { label: "Analytics", href: "/agent/analytics" },
    ],
    secondaryNav: [
      { label: "Add Listing", href: "/properties/new" },
      { label: "Daily AI Briefing", href: "/agent#brief" },
      { label: "Weak Listing Optimizer", href: "/agent#optimizer" },
    ],
    mobileBottomNav: [
      { label: "Dashboard", href: "/agent", iconName: "LayoutDashboard" },
      { label: "Properties", href: "/agent/properties", iconName: "Building" },
      { label: "Leads", href: "/agent/leads", iconName: "Users" },
      { label: "Calendar", href: "/agent/visit-calendar", iconName: "Calendar" },
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    label: "Agency Enterprise Workspace",
    tagline: "Team roster, firm listings & brokerage ops",
    badgeColor: "bg-purple-50 text-purple-800 border-purple-300",
    orgName: "Brokerage Firm",
    userTitle: "Agency Director",
    primaryNav: [
      { label: "Dashboard", href: "/agency" },
      { label: "Properties", href: "/agency/properties" },
      { label: "Leads", href: "/agency/leads" },
      { label: "Clients", href: "/agency/clients" },
      { label: "Projects", href: "/agency/projects" },
      { label: "Team", href: "/agency/team" },
      { label: "Analytics", href: "/agency/analytics" },
      { label: "Reports", href: "/agency/reports" },
    ],
    secondaryNav: [
      { label: "Add Agency Listing", href: "/properties/new" },
      { label: "Commission Splits", href: "/agency/commissions" },
      { label: "Agency Settings", href: "/agency/settings" },
    ],
    mobileBottomNav: [
      { label: "Dashboard", href: "/agency", iconName: "LayoutDashboard" },
      { label: "Properties", href: "/agency/properties", iconName: "Building" },
      { label: "Leads", href: "/agency/leads", iconName: "Users" },
      { label: "Team", href: "/agency/team", iconName: "Shield" },
    ],
  },
  developer: {
    id: "developer",
    name: "Developer",
    label: "Developer Project Workspace",
    tagline: "Projects, inventory, bookings & installments",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-300",
    orgName: "Developer Firm",
    userTitle: "Project Director",
    primaryNav: [
      { label: "Dashboard", href: "/developer" },
      { label: "Projects", href: "/developer/projects" },
      { label: "Structure", href: "/developer/structure" },
      { label: "Inventory", href: "/developer/inventory" },
      { label: "Bookings", href: "/developer/bookings" },
      { label: "Payment Plans", href: "/developer/payment-plans" },
      { label: "Installments", href: "/developer/installments" },
      { label: "Customers", href: "/developer/customers" },
      { label: "Sales Team", href: "/developer/sales-team" },
      { label: "NOC Docs", href: "/developer/noc" },
      { label: "Demand Intel", href: "/developer/demand-intelligence" },
      { label: "Reports", href: "/developer/reports" },
    ],
    secondaryNav: [
      { label: "Create Payment Plan", href: "/developer/payment-plans" },
      { label: "Bulk Inventory Import", href: "/developer/inventory" },
      { label: "NOC Documentation Center", href: "/developer/noc" },
      { label: "Phases & Blocks", href: "/developer/structure" },
    ],
    mobileBottomNav: [
      { label: "Dashboard", href: "/developer", iconName: "LayoutDashboard" },
      { label: "Inventory", href: "/developer/inventory", iconName: "Layers" },
      { label: "Bookings", href: "/developer/bookings", iconName: "CheckSquare" },
      { label: "Installments", href: "/developer/installments", iconName: "CreditCard" },
    ],
  },
  verifier: {
    id: "verifier",
    name: "Verifier",
    label: "Specialist Verification Workspace",
    tagline: "Cases, field visits, evidence & reports",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-300",
    orgName: "Verification Service",
    userTitle: "Field Specialist",
    primaryNav: [
      { label: "Dashboard", href: "/specialist" },
      { label: "Assigned Cases", href: "/specialist/cases" },
      { label: "Visits", href: "/specialist/visits" },
      { label: "Documents", href: "/specialist/documents" },
      { label: "Evidence", href: "/specialist/evidence" },
      { label: "Reports", href: "/specialist/reports" },
    ],
    secondaryNav: [
      { label: "PLRA Land Portal Integration", href: "/specialist#plra" },
      { label: "GPS Site Inspection Camera", href: "/specialist#camera" },
      { label: "Publish Immutable Report", href: "/specialist#publish" },
    ],
    mobileBottomNav: [
      { label: "Dashboard", href: "/specialist", iconName: "LayoutDashboard" },
      { label: "Cases", href: "/specialist/cases", iconName: "ClipboardList" },
      { label: "Visits", href: "/specialist/visits", iconName: "MapPin" },
      { label: "Evidence", href: "/specialist/evidence", iconName: "Camera" },
    ],
  },
};

export const WORKSPACE_CONFIGS = BASE_CONFIGS;

interface WorkspaceContextType {
  activeWorkspace: WorkspaceRole;
  config: WorkspaceConfig;
  setWorkspace: (role: WorkspaceRole) => boolean;
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: (open: boolean) => void;
  toggleMoreMenu: () => void;
  isWorkspaceReady: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = "propertyiq_active_workspace";

function personalizeConfig(
  role: WorkspaceRole,
  user: { fullName: string; email: string } | null
): WorkspaceConfig {
  const base = BASE_CONFIGS[role];
  if (!user || role === "guest") return base;
  return {
    ...base,
    userTitle: user.fullName,
    tagline: `${user.fullName} · ${base.label}`,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated, availableWorkspaces } = useAuth();
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceRole>("guest");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  // Sync workspace with auth after hydration
  useEffect(() => {
    if (!isHydrated) return;

    const saved = localStorage.getItem(STORAGE_KEY) as WorkspaceRole | null;

    if (!isAuthenticated) {
      // Guests may only stay on guest; clear leftover professional workspace
      if (saved && saved !== "guest") {
        localStorage.setItem(STORAGE_KEY, "guest");
      }
      setActiveWorkspaceState("guest");
      setIsWorkspaceReady(true);
      return;
    }

    const allowed = availableWorkspaces;
    let next: WorkspaceRole = "guest";

    if (saved && canAccessWorkspace(user?.role, saved)) {
      next = saved;
    } else if (user?.role) {
      next = defaultWorkspaceForBackendRole(user.role);
    } else if (allowed.includes("customer")) {
      next = "customer";
    }

    setActiveWorkspaceState(next);
    localStorage.setItem(STORAGE_KEY, next);
    setIsWorkspaceReady(true);
  }, [isHydrated, isAuthenticated, user?.role, availableWorkspaces]);

  const setWorkspace = useCallback(
    (role: WorkspaceRole): boolean => {
      if (role === "guest") {
        setActiveWorkspaceState("guest");
        localStorage.setItem(STORAGE_KEY, "guest");
        setIsMoreMenuOpen(false);
        return true;
      }

      if (!isAuthenticated || !canAccessWorkspace(user?.role, role)) {
        return false;
      }

      setActiveWorkspaceState(role);
      localStorage.setItem(STORAGE_KEY, role);
      setIsMoreMenuOpen(false);
      return true;
    },
    [isAuthenticated, user?.role]
  );

  const toggleMoreMenu = () => setIsMoreMenuOpen((prev) => !prev);

  const config = personalizeConfig(activeWorkspace, user);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        config,
        setWorkspace,
        isMoreMenuOpen,
        setIsMoreMenuOpen,
        toggleMoreMenu,
        isWorkspaceReady,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
