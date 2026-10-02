"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle,
  FileText,
  MapPin,
  Search,
  AlertCircle,
  ArrowRight,
  Clock,
  User,
  UploadCloud,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  Camera,
  Layers,
  Sparkles
} from "lucide-react";

interface VerificationCaseItem {
  id: string;
  targetName: string;
  city: string;
  area: string;
  serviceLevel: string;
  fee: number;
  slaHours: number;
  status: "Requested" | "Assigned" | "InProgress" | "Completed";
  specialistName: string;
  requestedAt: string;
  completedAt?: string;
  totalChecks: number;
  passedChecks: number;
  hasReport: boolean;
  reportSummary?: string;
  specialistNotes?: string;
  recommendations?: string;
  limitations?: string;
}

const mockCases: VerificationCaseItem[] = [
  {
    id: "VER-2026-0041",
    targetName: "1 Kanal Designer Bungalow in DHA Phase 6",
    city: "Lahore",
    area: "DHA Phase 6, Block L",
    serviceLevel: "Enhanced Due Diligence",
    fee: 60000,
    slaHours: 120,
    status: "Completed",
    specialistName: "Zahid Hussain (PLRA / Field Specialist)",
    requestedAt: "Sep 26, 2026",
    completedAt: "Oct 01, 2026",
    totalChecks: 8,
    passedChecks: 8,
    hasReport: true,
    reportSummary:
      "All physical boundaries, registered sale deed records, and DHA Lahore utility connections have been verified with zero encumbrance or stay orders detected.",
    specialistNotes:
      "Site inspection confirmed 50ft road frontage. Registered deed #3409 registered at Sub-Registrar Cantt Lahore matches the seller CNIC exactly. PLRA electronic mutation is clean.",
    recommendations:
      "Proceed with normal DHA transfer procedure at DHA Main Complex, Phase 6. Ensure original NDC (No Demand Certificate) is presented on transfer day.",
    limitations:
      "This report is an evidence-based verification summary and does not constitute a government title certificate or formal legal advice. Findings reflect records, site observations, and documentation available at the time of review. Final registration and title mutation remain subject to the relevant Land Revenue Authority and qualified legal counsel."
  },
  {
    id: "VER-2026-0089",
    targetName: "5 Marla Residential Plot in Skyline Meadows",
    city: "Lahore",
    area: "Raiwind Road",
    serviceLevel: "Property Site Visit",
    fee: 25000,
    slaHours: 72,
    status: "InProgress",
    specialistName: "Zahid Hussain (PLRA / Field Specialist)",
    requestedAt: "Oct 01, 2026",
    totalChecks: 6,
    passedChecks: 4,
    hasReport: false
  }
];

export default function VerificationMarketplacePage() {
  const [selectedTier, setSelectedTier] = useState<string>("enhanced");
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [selectedCaseForReport, setSelectedCaseForReport] = useState<VerificationCaseItem | null>(null);

  // New Request Form State
  const [propertyTitle, setPropertyTitle] = useState<string>("1 Kanal Designer Bungalow in DHA Phase 6, Lahore");
  const [city, setCity] = useState<string>("Lahore");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [attachedDoc, setAttachedDoc] = useState<string>("Registry_Deed_Copy_DHA.pdf");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const tiers = [
    {
      id: "basic",
      level: 1,
      name: "Basic Document Review",
      fee: 15000,
      turnaround: "48 Hours",
      description: "Document completeness, consistency check, visible red flags, and seller metadata verification.",
      features: [
        "Registry / Sale Deed / Fard scan consistency check",
        "Seller CNIC vs Ownership record matching",
        "Listing metadata verification",
        "Red-flag detection report"
      ]
    },
    {
      id: "site_visit",
      level: 2,
      name: "Property & Site Visit",
      fee: 25000,
      turnaround: "72 Hours",
      description: "Physical inspection by a certified field specialist, boundary check, and occupancy verification.",
      features: [
        "Physical site visit by approved specialist",
        "Geotagged & timestamped high-resolution photos",
        "Plot / House boundary verification & road access",
        "Physical possession & occupancy status check",
        "Immediate neighborhood infrastructure check"
      ]
    },
    {
      id: "record_check",
      level: 3,
      name: "Official Record Check",
      fee: 35000,
      turnaround: "96 Hours",
      description: "Verification against accessible official revenue records (PLRA, Sindh BoR, RDA, SBCA).",
      features: [
        "Punjab PLRA digital record inquiry where accessible",
        "Development authority NOC / Approval status check",
        "Record of Rights (Fard Malkiat) check",
        "Outstanding society / development charges verification"
      ]
    },
    {
      id: "enhanced",
      level: 4,
      name: "Enhanced Due Diligence",
      fee: 60000,
      turnaround: "5 Days",
      popular: true,
      description: "Combines complete multi-decade document chain audit, physical site inspection, and authority checks.",
      features: [
        "Includes everything in Site Visit & Official Record Check",
        "Historical ownership transfer / Intiqal trail audit",
        "Developer track record & project compliance check",
        "Detailed comprehensive due diligence dossier",
        "Dedicated verification specialist assigned"
      ]
    },
    {
      id: "legal_review",
      level: 5,
      name: "Formal Legal Title Opinion",
      fee: 95000,
      turnaround: "7 Days",
      description: "Independent written legal opinion by a licensed High Court real estate advocate.",
      features: [
        "Licensed High Court lawyer engagement",
        "Litigation & court stay order search",
        "Formal written title legal opinion",
        "Review of sale agreements and indemnities"
      ]
    }
  ];

  const formatPkr = (val: number) => {
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  const handleCreateRequest = async () => {
    setIsSubmitting(true);
    const chosen = tiers.find((t) => t.id === selectedTier) || tiers[3];

    try {
      await fetch("http://localhost:5000/api/verification/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceLevel: chosen.level,
          customerNotes: `${customerNotes} (Property: ${propertyTitle}, City: ${city})`,
          documents: [
            { documentType: "RegistryOrDeed", fileUrl: attachedDoc, title: "Title Deed Copy" }
          ]
        })
      });
    } catch {
      // Fallback
    }

    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Pakistan Property Verification Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Don’t Risk Your Capital. <br />
            <span className="text-emerald-400">Verify Before You Transact.</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Professional on-ground due diligence conducted by licensed field specialists and PLRA experts. Every report includes geotagged photo evidence, authority check notes, and transparent limitations.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={() => {
                setShowRequestModal(true);
                setSubmitSuccess(false);
              }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition"
            >
              <span>Request Verification Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/specialist"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-5 py-3 rounded-xl border border-white/10 transition"
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span>Specialist Workbench</span>
            </Link>
          </div>
        </div>

        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Customer Active Cases Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Active Verification Cases & Reports
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Track inspection progress, view specialist field observations, and download published due-diligence reports.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
            {mockCases.length} Cases On Record
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockCases.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                    {item.id}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      item.status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {item.status === "Completed" ? "Report Published" : "Inspection In Progress"}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{item.targetName}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {item.area}, {item.city}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Service Tier</span>
                    <span className="font-bold text-slate-800">{item.serviceLevel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Specialist</span>
                    <span className="font-bold text-slate-800 truncate block">{item.specialistName}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                    <span>Checklist Progress</span>
                    <span>{item.passedChecks} of {item.totalChecks} checks complete</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${item.status === "Completed" ? "bg-emerald-600" : "bg-blue-600"}`}
                      style={{ width: `${(item.passedChecks / item.totalChecks) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Requested: <strong>{item.requestedAt}</strong>
                </span>

                {item.hasReport ? (
                  <button
                    onClick={() => setSelectedCaseForReport(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Official Report</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic font-medium">Report in generation</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Catalog & Tiers Grid */}
      <div>
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Select Your Due-Diligence Scope
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Choose from basic document matching to full title-chain investigations backed by High Court advocates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`cursor-pointer rounded-2xl p-5 border transition flex flex-col justify-between ${
                selectedTier === tier.id
                  ? "border-emerald-600 ring-2 ring-emerald-600 bg-emerald-50/20 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
              }`}
            >
              <div>
                {tier.popular && (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white mb-2 uppercase tracking-wider">
                    Recommended
                  </span>
                )}
                <h3 className="text-base font-extrabold text-slate-900">{tier.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{tier.description}</p>

                <div className="my-4">
                  <span className="text-xl font-black text-slate-900">{formatPkr(tier.fee)}</span>
                  <span className="text-[10px] text-slate-500 block">SLA: {tier.turnaround}</span>
                </div>

                <ul className="space-y-2 text-[11px] text-slate-700">
                  {tier.features.slice(0, 3).map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTier(tier.id);
                  setShowRequestModal(true);
                }}
                className={`mt-6 w-full py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                  selectedTier === tier.id
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                Select & Order
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Legal & Authority Disclaimer Box */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">Important Operational & Legal Notice for Pakistan Real Estate</p>
          <p>
            PropertyIQ Verification is an independent, evidence-backed professional due-diligence service. It provides structured records of physical visits, documents inspected, and official accessible sources (such as Punjab PLRA or RDA NOC records). It does not issue official government land titles or replace certified revenue records from competent land authorities.
          </p>
        </div>
      </div>

      {/* REQUEST VERIFICATION MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  New Due-Diligence Request
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Initiate Property Verification</h3>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!submitSuccess ? (
              <div className="mt-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Property</label>
                  <input
                    type="text"
                    value={propertyTitle}
                    onChange={(e) => setPropertyTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                    >
                      <option value="Lahore">Lahore</option>
                      <option value="Islamabad">Islamabad</option>
                      <option value="Karachi">Karachi</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Selected Tier</label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                    >
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({formatPkr(t.fee)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Document Attachment</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attachedDoc}
                      onChange={(e) => setAttachedDoc(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-[11px] bg-slate-50"
                    />
                    <span className="text-[11px] text-emerald-600 font-semibold px-2">Uploaded</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instructions for Field Specialist</label>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Please specifically verify the plot boundary demarcations and seller identity match."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Estimated Turnaround</span>
                    <span className="font-bold text-slate-800">
                      {tiers.find((t) => t.id === selectedTier)?.turnaround}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Due-Diligence Fee</span>
                    <span className="font-black text-emerald-700 text-sm">
                      {formatPkr(tiers.find((t) => t.id === selectedTier)?.fee || 60000)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={handleCreateRequest}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Initiating Case..." : "Confirm & Submit Request"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">Verification Case Created!</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Your verification request for <strong>{propertyTitle}</strong> has been logged. An approved specialist will be assigned within 4 hours.
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL VERIFICATION REPORT MODAL */}
      {selectedCaseForReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded">
                    {selectedCaseForReport.id}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">• Version 1.0 (Final & Immutable)</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Official Verification & Due-Diligence Report
                </h2>
              </div>
              <button
                onClick={() => setSelectedCaseForReport(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Case Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Target Property</span>
                <span className="font-bold text-slate-800">{selectedCaseForReport.targetName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Assigned Specialist</span>
                <span className="font-bold text-slate-800">{selectedCaseForReport.specialistName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Completed Date</span>
                <span className="font-bold text-slate-800">{selectedCaseForReport.completedAt}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Overall Status</span>
                <span className="font-bold text-emerald-700">Verified & Clear</span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Executive Summary
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                {selectedCaseForReport.reportSummary}
              </p>
            </div>

            {/* Factual Observations & Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Factual Observations & Inspection Checklist
              </h3>
              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">Seller Identity & CNIC Matching</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">Pass</span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">Sale Deed Registration at Sub-Registrar</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">Pass</span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">PLRA Electronic Mutation (Intiqal) Record</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">Pass</span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">Physical Site Boundaries & Access Road (50ft)</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">Pass</span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">DHA Utility Connections & Property Tax Status</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">Pass</span>
                </div>
              </div>
            </div>

            {/* Specialist Notes & Recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">Field Specialist Notes</span>
                <p className="text-slate-600 leading-relaxed">{selectedCaseForReport.specialistNotes}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">Customer Recommendations</span>
                <p className="text-slate-600 leading-relaxed">{selectedCaseForReport.recommendations}</p>
              </div>
            </div>

            {/* Mandatory Limitations Disclaimer */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Mandatory Scope & Legal Limitations Disclaimer</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                {selectedCaseForReport.limitations}
              </p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setSelectedCaseForReport(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
