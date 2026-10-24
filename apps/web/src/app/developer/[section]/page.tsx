"use client";

import { use } from "react";
import Link from "next/link";
import {
  Building2,
  Layers,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import DeveloperProjectsSection from "@/components/developer/DeveloperProjectsSection";
import DeveloperInventorySection from "@/components/developer/DeveloperInventorySection";
import DeveloperBookingsSection from "@/components/developer/DeveloperBookingsSection";
import DeveloperInstallmentsSection from "@/components/developer/DeveloperInstallmentsSection";
import DeveloperCustomersSection from "@/components/developer/DeveloperCustomersSection";
import DeveloperSalesTeamSection from "@/components/developer/DeveloperSalesTeamSection";
import DeveloperDemandIntelSection from "@/components/developer/DeveloperDemandIntelSection";
import DeveloperReportsSection from "@/components/developer/DeveloperReportsSection";
import DeveloperPaymentPlansSection from "@/components/developer/DeveloperPaymentPlansSection";
import DeveloperNocSection from "@/components/developer/DeveloperNocSection";
import DeveloperStructureSection from "@/components/developer/DeveloperStructureSection";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function DeveloperSectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    projects: { title: "Developer Project Schemes", subtitle: "Active master planned schemes and LDA/CDA regulatory approvals" },
    inventory: { title: "Scheme Inventory Matrix", subtitle: "Unit-level status, pricing, facing, and availability grid" },
    bookings: { title: "Customer Bookings & Contracts", subtitle: "All confirmed, completed, and pending buyer bookings" },
    installments: { title: "Installment Schedules & Proofs", subtitle: "Customer installment plans, due dates, and payment verification queue" },
    "payment-plans": {
      title: "Project Payment Plans",
      subtitle: "Create installment templates customers select when booking a unit",
    },
    customers: { title: "Scheme Buyer Directory", subtitle: "Verified allottees, installment payment compliance, and ledger records" },
    "sales-team": { title: "Developer Sales & Broker Relations", subtitle: "Internal project sales reps and affiliated external broker channels" },
    "demand-intelligence": { title: "Demand & Pricing Intelligence", subtitle: "AI buyer search velocity, pricing elasticities, and catchment area analytics" },
    reports: { title: "Collections & Regulatory Audits", subtitle: "LDA compliance statements, installment recovery, and inventory audits" },
    noc: {
      title: "NOC Documentation Center",
      subtitle: "LDA/CDA NOCs, society approvals, and scheme compliance files",
    },
    structure: {
      title: "Phases & Blocks",
      subtitle: "Scheme structure used when placing inventory units",
    },
  };

  const current = sectionTitles[section] || {
    title: `Developer ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Skyline Developers Lahore Hub"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/developer"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Developer Workspace</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
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
            href="/developer"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Layers className="w-4 h-4" />
            <span>Open Interactive Workbench</span>
          </Link>
          <Link
            href="/projects/skyline-meadows-lahore"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Public Scheme View</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {section === "projects" && <DeveloperProjectsSection />}

        {section === "inventory" && <DeveloperInventorySection />}

        {section === "bookings" && <DeveloperBookingsSection />}

        {section === "demand-intelligence" && <DeveloperDemandIntelSection />}

        {section === "installments" && <DeveloperInstallmentsSection />}

        {section === "payment-plans" && <DeveloperPaymentPlansSection />}

        {section === "customers" && <DeveloperCustomersSection />}

        {section === "sales-team" && <DeveloperSalesTeamSection />}

        {section === "reports" && <DeveloperReportsSection />}

        {section === "noc" && <DeveloperNocSection />}

        {section === "structure" && <DeveloperStructureSection />}

        {!["projects", "inventory", "bookings", "demand-intelligence", "installments", "payment-plans", "customers", "sales-team", "reports", "noc", "structure"].includes(section) && (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <Building2 className="w-8 h-8 text-amber-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">Skyline Developers — {current.title}</h4>
            <p className="max-w-md mx-auto">
              Project management and financial reporting module for approved schemes.
            </p>
            <div className="pt-2">
              <Link
                href="/developer"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <span>Return to Developer Workbench</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
