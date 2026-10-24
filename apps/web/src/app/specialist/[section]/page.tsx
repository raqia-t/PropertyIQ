"use client";

import { use } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, ExternalLink } from "lucide-react";
import SpecialistCasesSection from "@/components/specialist/SpecialistCasesSection";
import SpecialistVisitsSection from "@/components/specialist/SpecialistVisitsSection";
import SpecialistDocumentsSection from "@/components/specialist/SpecialistDocumentsSection";
import SpecialistEvidenceSection from "@/components/specialist/SpecialistEvidenceSection";
import SpecialistReportsSection from "@/components/specialist/SpecialistReportsSection";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function SpecialistSectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    cases: {
      title: "Assigned Verification Cases",
      subtitle: "Active buyer-requested and agent-requested property inspections",
    },
    visits: {
      title: "Scheduled Site Demarcations",
      subtitle: "Physical on-ground boundary peg checks and infrastructure surveys",
    },
    documents: {
      title: "Title Deeds & Legal Records",
      subtitle: "LDA NOC letters, PLRA mutations, and registry extracts",
    },
    evidence: {
      title: "Geo-Tagged Site Evidence",
      subtitle: "GPS timestamped photos, road width measurements, and utility checks",
    },
    reports: {
      title: "Published Immutable Reports",
      subtitle: "Signed due-diligence reports issued to buyers and stakeholders",
    },
  };

  const current = sectionTitles[section] || {
    title: `Verifier ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Specialist Due-Diligence Workbench",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {section === "cases" && <SpecialistCasesSection />}

        {section === "visits" && <SpecialistVisitsSection />}

        {section === "documents" && <SpecialistDocumentsSection />}

        {section === "evidence" && <SpecialistEvidenceSection />}

        {section === "reports" && <SpecialistReportsSection />}

        {!["cases", "visits", "documents", "evidence", "reports"].includes(section) && (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <ShieldCheck className="w-8 h-8 text-teal-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">{current.title}</h4>
            <p className="max-w-md mx-auto">
              Section not recognized. Open Cases, Visits, Documents, Evidence, or Reports from the
              specialist nav.
            </p>
            <div className="pt-2">
              <Link
                href="/specialist"
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
              >
                <span>Back to specialist workbench</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
