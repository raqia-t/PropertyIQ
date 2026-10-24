"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
} from "lucide-react";
import AgentLeadsSection from "@/components/agent/AgentLeadsSection";
import AgentPropertiesSection from "@/components/agent/AgentPropertiesSection";
import AgentClientsSection from "@/components/agent/AgentClientsSection";
import AgentVisitsSection from "@/components/agent/AgentVisitsSection";
import AgentVisitCalendarSection from "@/components/agent/AgentVisitCalendarSection";
import AgentVerificationSection from "@/components/agent/AgentVerificationSection";
import AgentAnalyticsSection from "@/components/agent/AgentAnalyticsSection";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function AgentSectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    properties: { title: "Agent Property Listings", subtitle: "Active, pending and sold properties represented by Kamran Ali" },
    leads: { title: "Lead Inquiries & Negotiation", subtitle: "Direct customer inquiries submitted from property details" },
    clients: { title: "Client Directory & CRM", subtitle: "Buyers, sellers, and investors in your book of business" },
    visits: { title: "Scheduled Site Visits", subtitle: "Confirmed in-person viewings with prospective buyers" },
    "visit-calendar": {
      title: "Visit Calendar",
      subtitle: "Week and month view of site visits with map pins and visitor details",
    },
    verification: { title: "Listing Verification Status", subtitle: "Due-diligence badges and field audit progress" },
    analytics: { title: "Performance & Conversion Analytics", subtitle: "View-to-inquiry rates and listing completeness scores" }
  };

  const current = sectionTitles[section] || {
    title: `Agent ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Lahore Premier Properties Agent Workspace"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/agent"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Agent Workspace</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
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
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Listing</span>
          </Link>
          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Overview Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {section === "properties" && <AgentPropertiesSection />}

        {section === "leads" && <AgentLeadsSection />}

        {section === "clients" && <AgentClientsSection />}

        {section === "visits" && <AgentVisitsSection />}

        {section === "visit-calendar" && <AgentVisitCalendarSection />}

        {section === "verification" && <AgentVerificationSection />}

        {section === "analytics" && <AgentAnalyticsSection />}
      </div>
    </div>
  );
}
