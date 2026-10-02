"use client";

import { use } from "react";
import Link from "next/link";
import {
  Building,
  Users,
  Calendar,
  ShieldCheck,
  TrendingUp,
  ArrowLeft,
  PlusCircle,
  BarChart3,
  FileText,
  Briefcase
} from "lucide-react";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function AgencySectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    properties: { title: "Agency Firm Listings", subtitle: "All residential and commercial properties managed by Premier Realty Group brokers" },
    leads: { title: "Firm Lead Pipeline", subtitle: "Central lead inbox and broker assignment rules" },
    clients: { title: "Agency Client Accounts", subtitle: "High-value corporate accounts, diaspora overseas buyers, and sellers" },
    projects: { title: "Exclusive Developer Mandates", subtitle: "Master projects marketed exclusively by Premier Realty Group" },
    team: { title: "Broker Team & Commissions", subtitle: "Broker licensing, performance splits, and transaction volume" },
    analytics: { title: "Agency Business Intelligence", subtitle: "Brokerage commission revenue, market share, and conversion velocity" },
    reports: { title: "Executive Audit & Sales Reports", subtitle: "Quarterly transaction audit logs and compliance documentation" }
  };

  const current = sectionTitles[section] || {
    title: `Agency ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Premier Realty Group Enterprise Workspace"
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
        <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200 text-xs text-purple-900">
          <span className="font-bold">Enterprise Role Scope:</span> Showing active firm data for <strong>Premier Realty Group</strong>. Authorized for Agency Directors and Supervising Brokers.
        </div>

        {section === "team" && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">14 Active Licensed Brokers</h3>
            <p className="text-xs text-slate-500">Each broker has dedicated access to their properties and assigned client inquiries.</p>
          </div>
        )}

        {section === "reports" && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Quarterly Firm Performance & Audit Disclosures</h3>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Q3 2026 Lahore Real Estate Sales Volume Report</h4>
                  <p className="text-slate-500">PKR 38.4 Crore closed transactions • 142 total leads</p>
                </div>
                <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl transition">
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {section === "analytics" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Sales</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">PKR 38.4 Cr</span>
              <span className="text-purple-700 text-[11px] font-semibold">+24% vs Q2</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Commission Revenue</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">PKR 76.8 Lakh</span>
              <span className="text-slate-500 text-[11px]">2% average fee</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Listings</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">48</span>
              <span className="text-emerald-600 text-[11px]">6 new this week</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Avg Days on Market</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">34 Days</span>
              <span className="text-emerald-600 text-[11px]">DHA Lahore average</span>
            </div>
          </div>
        )}

        {["properties", "leads", "clients", "projects"].includes(section) && (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <Building className="w-8 h-8 text-purple-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">Premier Realty Group Firm {section}</h4>
            <p className="max-w-md mx-auto">
              Centralized record management for firm brokers. Filter by agent, project mandate, or transaction pipeline stage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
