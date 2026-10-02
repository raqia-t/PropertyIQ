"use client";

import { use } from "react";
import Link from "next/link";
import {
  Building2,
  Layers,
  CheckSquare,
  CreditCard,
  Users,
  BarChart3,
  FileText,
  ArrowLeft,
  PlusCircle,
  ShieldCheck,
  ExternalLink
} from "lucide-react";

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
    customers: { title: "Scheme Buyer Directory", subtitle: "Verified allottees, installment payment compliance, and ledger records" },
    "sales-team": { title: "Developer Sales & Broker Relations", subtitle: "Internal project sales reps and affiliated external broker channels" },
    "demand-intelligence": { title: "Demand & Pricing Intelligence", subtitle: "AI buyer search velocity, pricing elasticities, and catchment area analytics" },
    reports: { title: "Collections & Regulatory Audits", subtitle: "LDA compliance statements, installment recovery, and inventory audits" }
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
        {section === "demand-intelligence" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Raiwind Road Catchment Demand Pulse</h3>
                <p className="text-xs text-slate-500">Live AI demand tracking from buyer search queries across Pakistan</p>
              </div>
              <Link
                href="/demand-intelligence"
                className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200"
              >
                Launch Deep Heatmap Module →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
                <span className="text-amber-800 font-bold block text-[11px] uppercase">5 Marla Plots Search Surge</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">+38% MoM</span>
                <span className="text-slate-500 text-[11px]">Primary budget range: PKR 90L - 1 Cr</span>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
                <span className="text-amber-800 font-bold block text-[11px] uppercase">Installment Conversion Lift</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">3.2x</span>
                <span className="text-slate-500 text-[11px]">vs 100% upfront cash sales</span>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
                <span className="text-amber-800 font-bold block text-[11px] uppercase">Diaspora Inquiries</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">42%</span>
                <span className="text-slate-500 text-[11px]">UK, UAE & US Pakistani expat buyers</span>
              </div>
            </div>
          </div>
        )}

        {section === "installments" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Scheme Installment Collections Overview</h3>
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 text-xs text-emerald-950 flex items-center justify-between">
              <div>
                <span className="font-bold block">82% On-Time Collection Rate</span>
                <span className="text-emerald-800">PKR 3.9 Crore collected across 120 scheduled units in Skyline Meadows</span>
              </div>
              <Link
                href="/developer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition"
              >
                Review Pending Proofs
              </Link>
            </div>
          </div>
        )}

        {section === "inventory" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">120 Inventory Units in Skyline Meadows</h3>
            <p className="text-xs text-slate-500">
              Manage live status (Available, Reserved, Booked, Sold, Blocked) directly from the Developer Hub.
            </p>
            <div className="pt-2">
              <Link
                href="/developer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <span>Switch to Interactive Inventory Grid</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}

        {!["demand-intelligence", "installments", "inventory"].includes(section) && (
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
