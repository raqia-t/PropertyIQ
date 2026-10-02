"use client";

import { use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ClipboardList,
  MapPin,
  FileText,
  Camera,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink
} from "lucide-react";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function SpecialistSectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    cases: { title: "Assigned Verification Cases", subtitle: "Active buyer-requested and agent-requested property inspections" },
    visits: { title: "Scheduled Site Demarcations", subtitle: "Physical on-ground boundary peg checks and infrastructure surveys" },
    documents: { title: "Title Deeds & Legal Records", subtitle: "LDA NOC letters, PLRA mutations, and registry extracts" },
    evidence: { title: "Geo-Tagged Site Evidence", subtitle: "GPS timestamped photos, road width measurements, and utility checks" },
    reports: { title: "Published Immutable Reports", subtitle: "Signed due-diligence reports issued to buyers and stakeholders" }
  };

  const current = sectionTitles[section] || {
    title: `Verifier ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Specialist Due-Diligence Workbench"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/specialist"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Specialist Workbench</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
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
            href="/specialist"
            className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Active Case Workbench</span>
          </Link>
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Customer View</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Section Body */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200 text-xs text-teal-900">
          <span className="font-bold">Field Specialist Authority:</span> Zahid Hussain (Senior Inspector • PLRA & Society Specialist). All logged findings adhere to the Pakistan Land Due-Diligence Protocol.
        </div>

        {section === "cases" && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Active Queue</h3>
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-slate-500">Case ID: VER-2026-0089</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">Plot-102 (5 Marla) • Skyline Meadows Lahore</h4>
                <p className="text-slate-500">Service: Full Physical Demarcation & Title Registry Check</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                In Progress (38h SLA)
              </span>
            </div>
          </div>
        )}

        {section === "reports" && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Signed Immutable Reports</h3>
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900">1 Kanal Designer Villa — DHA Phase 6 Lahore</span>
                <p className="text-slate-500">Report v1.0 • 7/7 Checks Passed • Full Title Clear</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Published & Locked
              </span>
            </div>
          </div>
        )}

        {!["cases", "reports"].includes(section) && (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <ShieldCheck className="w-8 h-8 text-teal-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">{current.title}</h4>
            <p className="max-w-md mx-auto">
              Evidence-based records collected by field specialists during on-site inspections.
            </p>
            <div className="pt-2">
              <Link
                href="/specialist"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
              >
                <span>Launch Case Inspection Tool</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
