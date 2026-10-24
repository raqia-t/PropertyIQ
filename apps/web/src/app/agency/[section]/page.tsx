"use client";

import { use } from "react";
import Link from "next/link";
import {
  Building,
  ArrowLeft,
  PlusCircle,
} from "lucide-react";
import AgencyPropertiesSection from "@/components/agency/AgencyPropertiesSection";
import AgencyLeadsSection from "@/components/agency/AgencyLeadsSection";
import AgencyClientsSection from "@/components/agency/AgencyClientsSection";
import AgencyProjectsSection from "@/components/agency/AgencyProjectsSection";
import AgencyTeamSection from "@/components/agency/AgencyTeamSection";
import AgencyAnalyticsSection from "@/components/agency/AgencyAnalyticsSection";
import AgencyReportsSection from "@/components/agency/AgencyReportsSection";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function AgencySectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    properties: { title: "Agency Firm Listings", subtitle: "All residential and commercial properties managed by your brokerage firm" },
    leads: { title: "Firm Lead Pipeline", subtitle: "Central lead inbox and broker assignment rules" },
    clients: { title: "Agency Client Accounts", subtitle: "High-value corporate accounts, diaspora overseas buyers, and sellers" },
    projects: { title: "Exclusive Developer Mandates", subtitle: "Master projects marketed exclusively by your brokerage firm" },
    team: { title: "Broker Team & Commissions", subtitle: "Broker licensing, performance splits, and transaction volume" },
    analytics: { title: "Agency Business Intelligence", subtitle: "Brokerage commission revenue, market share, and conversion velocity" },
    reports: { title: "Executive Audit & Sales Reports", subtitle: "Quarterly transaction audit logs and compliance documentation" },
    commissions: { title: "Commission Splits", subtitle: "Broker deal splits, override rules, and payout schedules (UI scaffold — API pending)" },
    settings: { title: "Agency Settings", subtitle: "Firm profile, licensing, branding, and notification preferences (UI scaffold — API pending)" },
  };

  const current = sectionTitles[section] || {
    title: `Agency ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Agency Enterprise Workspace"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/agency"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Agency Workspace</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
              {section}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{current.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Agency Listing</span>
          </Link>
          <Link
            href="/agency"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Overview Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Section Body */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {section === "properties" ? (
          <AgencyPropertiesSection />
        ) : section === "leads" ? (
          <AgencyLeadsSection />
        ) : section === "clients" ? (
          <AgencyClientsSection />
        ) : section === "projects" ? (
          <AgencyProjectsSection />
        ) : section === "team" ? (
          <AgencyTeamSection />
        ) : section === "analytics" ? (
          <AgencyAnalyticsSection />
        ) : section === "reports" ? (
          <AgencyReportsSection />
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200 text-xs text-purple-900">
              <span className="font-bold">Enterprise Role Scope:</span> Firm-level view for Agency Directors
              and supervising brokers. Live data wiring pending for this section.
            </div>

            {["commissions", "settings"].includes(section) && (
              <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                <Building className="w-8 h-8 text-purple-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">Firm {section}</h4>
                <p className="max-w-md mx-auto">
                  Centralized org-scoped management for this section is not wired yet.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
