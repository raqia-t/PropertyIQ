"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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

export const WORKSPACE_CONFIGS: Record<WorkspaceRole, WorkspaceConfig> = {
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
      { label: "List Property", href: "/properties/new" },
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
    tagline: "Usman Farooq • Investor / Buyer",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-300",
    orgName: "Verified Buyer",
    userTitle: "Usman Farooq",
    primaryNav: [
      { label: "Home", href: "/" },
      { label: "Buy", href: "/search?purpose=1" },
      { label: "Rent", href: "/search?purpose=2" },
      { label: "Projects", href: "/projects" },
      { label: "Saved", href: "/customer/saved" },
      { label: "My Activity", href: "/customer/activity" },
      { label: "Profile", href: "/customer/profile" },
    ],
    secondaryNav: [
      { label: "My Bookings & Installments", href: "/my-bookings" },
      { label: "Verification Requests", href: "/verification" },
      { label: "Compare Shortlist", href: "/compare" },
    ],
    mobileBottomNav: [
      { label: "Home", href: "/", iconName: "Home" },
      { label: "Buy", href: "/search?purpose=1", iconName: "Search" },
      { label: "Projects", href: "/projects", iconName: "Building2" },
      { label: "Activity", href: "/customer/activity", iconName: "Activity" },
    ],
  },
  agent: {
    id: "agent",
    name: "Agent",
    label: "Agent Workspace",
    tagline: "Kamran Ali • Lahore Real Estate",
    badgeColor: "bg-blue-50 text-blue-800 border-blue-300",
    orgName: "Lahore Properties Network",
    userTitle: "Kamran Ali (Licensed Agent)",
    primaryNav: [
      { label: "Dashboard", href: "/agent" },
      { label: "Properties", href: "/agent/properties" },
      { label: "Leads", href: "/agent/leads", badge: "3 New" },
      { label: "Clients", href: "/agent/clients" },
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
      { label: "Visits", href: "/agent/visits", iconName: "Calendar" },
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    label: "Agency Enterprise Workspace",
    tagline: "Premier Realty Group • 14 Active Brokers",
    badgeColor: "bg-purple-50 text-purple-800 border-purple-300",
    orgName: "Premier Realty Group (Brokerage)",
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
    tagline: "Skyline Developers Lahore • LDA-REG-2024-889",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-300",
    orgName: "Skyline Developers Lahore",
    userTitle: "Tariq Mahmood (Project Director)",
    primaryNav: [
      { label: "Dashboard", href: "/developer" },
      { label: "Projects", href: "/developer/projects" },
      { label: "Inventory", href: "/developer/inventory" },
      { label: "Bookings", href: "/developer/bookings" },
      { label: "Installments", href: "/developer/installments" },
      { label: "Customers", href: "/developer/customers" },
      { label: "Sales Team", href: "/developer/sales-team" },
      { label: "Demand Intelligence", href: "/developer/demand-intelligence" },
      { label: "Reports", href: "/developer/reports" },
    ],
    secondaryNav: [
      { label: "Add Inventory Unit", href: "/developer#add-unit" },
      { label: "Payment Verification Queue", href: "/developer#proofs" },
      { label: "NOC Documentation Center", href: "/developer/noc" },
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
    tagline: "Zahid Hussain • PLRA / Field Specialist",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-300",
    orgName: "Pakistan Land Revenue Verification Service",
    userTitle: "Zahid Hussain (Senior Inspector)",
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

interface WorkspaceContextType {
  activeWorkspace: WorkspaceRole;
  config: WorkspaceConfig;
  setWorkspace: (role: WorkspaceRole) => void;
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: (open: boolean) => void;
  toggleMoreMenu: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = "propertyiq_active_workspace";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceRole>("guest");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    // Check localStorage or URL query param on mount
    const saved = localStorage.getItem(STORAGE_KEY) as WorkspaceRole | null;
    if (saved && WORKSPACE_CONFIGS[saved]) {
      setActiveWorkspaceState(saved);
    }
  }, []);

  const setWorkspace = (role: WorkspaceRole) => {
    setActiveWorkspaceState(role);
    localStorage.setItem(STORAGE_KEY, role);
    setIsMoreMenuOpen(false);
  };

  const toggleMoreMenu = () => {
    setIsMoreMenuOpen((prev) => !prev);
  };

  const config = WORKSPACE_CONFIGS[activeWorkspace];

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        config,
        setWorkspace,
        isMoreMenuOpen,
        setIsMoreMenuOpen,
        toggleMoreMenu,
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
