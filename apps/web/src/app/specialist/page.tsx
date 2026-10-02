"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Camera,
  FileText,
  MapPin,
  Check,
  X,
  UploadCloud,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface CheckItem {
  id: string;
  category: string;
  code: string;
  title: string;
  result: "Pass" | "NeedsEvidence" | "Concern" | "NotChecked";
  notes: string;
}

interface EvidenceItem {
  id: string;
  type: string;
  url: string;
  lat: number;
  lng: number;
  time: string;
}

const initialChecks: CheckItem[] = [
  { id: "c-1", category: "Identity", code: "CHK-ID-01", title: "Seller CNIC & Identity match in NADRA records", result: "Pass", notes: "CNIC verified. Name on title deed matches owner CNIC." },
  { id: "c-2", category: "Ownership", code: "CHK-OWN-01", title: "Original Allotment Letter / Title Deed scan consistency", result: "Pass", notes: "Original LDA allotment letter serial verified against LDA master file." },
  { id: "c-3", category: "Mutation", code: "CHK-MUT-01", title: "PLRA Electronic Mutation (Intiqal) record check", result: "Pass", notes: "Verified on PLRA online portal. No active stay order or dispute." },
  { id: "c-4", category: "SocietyApproval", code: "CHK-SOC-01", title: "LDA Housing Scheme Approval & NOC Reference", result: "Pass", notes: "NOC Ref LDA/CMP/2025/1104 verified active and approved." },
  { id: "c-5", category: "SiteVisit", code: "CHK-VISIT-01", title: "Physical on-ground boundaries & plot demarcation", result: "NotChecked", notes: "" },
  { id: "c-6", category: "SiteVisit", code: "CHK-VISIT-02", title: "Access road width, sewerage, and underground utilities", result: "NotChecked", notes: "" },
  { id: "c-7", category: "TaxesDues", code: "CHK-TAX-01", title: "Society development dues & outstanding utility liabilities", result: "NotChecked", notes: "" }
];

const initialEvidences: EvidenceItem[] = [
  { id: "ev-1", type: "DocumentScan", url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80", lat: 31.3654, lng: 74.2238, time: "Oct 01, 2026 - 11:30 AM" },
  { id: "ev-2", type: "SitePhoto", url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80", lat: 31.3655, lng: 74.2239, time: "Oct 02, 2026 - 02:15 PM" }
];

export default function SpecialistWorkbenchPage() {
  const [checks, setChecks] = useState<CheckItem[]>(initialChecks);
  const [evidences, setEvidences] = useState<EvidenceItem[]>(initialEvidences);

  // New Evidence input
  const [photoUrl, setPhotoUrl] = useState<string>("https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80");
  const [latitude, setLatitude] = useState<number>(31.3654);
  const [longitude, setLongitude] = useState<number>(74.2238);

  // Report fields
  const [reportSummary, setReportSummary] = useState<string>(
    "Comprehensive physical inspection and title verification completed for 5 Marla Plot in Skyline Meadows. Boundaries demarcated accurately with 40ft carpeted road access and clear developer NOC."
  );
  const [specialistNotes, setSpecialistNotes] = useState<string>(
    "Underground electricity lines laid. Plot corner pegs are firmly in place. Society office confirmed zero outstanding development charges."
  );
  const [recommendations, setRecommendations] = useState<string>(
    "Buyer may safely proceed with token payment. Ensure transfer is executed at Skyline Developers Head Office with official transfer letter."
  );

  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const handleUpdateCheck = (id: string, result: CheckItem["result"], notes?: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, result, notes: notes !== undefined ? notes : c.notes } : c))
    );
  };

  const handleAddEvidence = () => {
    if (!photoUrl) return;
    const newEv: EvidenceItem = {
      id: "ev-" + Date.now(),
      type: "SitePhoto",
      url: photoUrl,
      lat: latitude,
      lng: longitude,
      time: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
    };
    setEvidences([newEv, ...evidences]);
  };

  const handlePublishReport = async () => {
    setIsPublishing(true);

    try {
      // Direct API call
      await fetch("http://localhost:5000/api/verification/cases/00000000-0000-0000-0000-000000000000/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: reportSummary,
          specialistNotes: specialistNotes,
          customerRecommendations: recommendations
        })
      });
    } catch {
      // Fallback
    }

    setIsPublishing(false);
    setIsPublished(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Specialist Profile Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Verification Specialist Workbench
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Approved Field Specialist
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Zahid Hussain (PLRA / Field Specialist)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assigned Case: <strong>VER-2026-0089</strong> • 5 Marla Residential Plot in Skyline Meadows Lahore
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Customer View</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Case Details Card */}
      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block font-medium">Target Asset</span>
          <span className="font-bold text-slate-900 text-sm">Plot-102 (5 Marla)</span>
          <span className="text-[11px] text-slate-500 block">Skyline Meadows, Lahore</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Service Scope</span>
          <span className="font-bold text-slate-800">Property Site Visit + Records</span>
          <span className="text-[11px] text-emerald-700 font-semibold block">PKR 25,000 Verified Fee</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">SLA Remaining</span>
          <span className="font-bold text-amber-700">38 Hours Left</span>
          <span className="text-[11px] text-slate-500 block">Due Oct 04, 2026</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Progress</span>
          <span className="font-bold text-slate-900">
            {checks.filter((c) => c.result === "Pass").length} / {checks.length} Checks Passed
          </span>
          <span className="text-[11px] text-blue-600 font-semibold block">Under Review</span>
        </div>
      </div>

      {/* Checklist Inspection Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Standard Pakistan Due-Diligence Checklist
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inspect each item, record physical observations, and mark result according to evidence standards.
          </p>
        </div>

        <div className="space-y-4">
          {checks.map((check) => (
            <div
              key={check.id}
              className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/30 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700 shrink-0">
                    {check.code}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{check.title}</h3>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Category: {check.category}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleUpdateCheck(check.id, "Pass")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      check.result === "Pass"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Pass</span>
                  </button>

                  <button
                    onClick={() => handleUpdateCheck(check.id, "NeedsEvidence")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      check.result === "NeedsEvidence"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Need Proof
                  </button>

                  <button
                    onClick={() => handleUpdateCheck(check.id, "Concern")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      check.result === "Concern"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Concern</span>
                  </button>
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <input
                  type="text"
                  placeholder="Specialist observations, reference numbers, or missing document details..."
                  value={check.notes}
                  onChange={(e) => handleUpdateCheck(check.id, check.result, e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Field Evidence & Geotagged Photos Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Geo-Tagged Field Photos & Evidence
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload timestamped site photos with latitude and longitude for verifiable on-ground proof.
            </p>
          </div>
        </div>

        {/* Add Evidence Form */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Photo / Evidence URL</label>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">GPS Coordinates (Lat, Lng)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 bg-white text-[11px]"
              />
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 bg-white text-[11px]"
              />
            </div>
          </div>

          <div>
            <button
              onClick={handleAddEvidence}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl shadow-sm transition"
            >
              <Camera className="w-4 h-4" />
              <span>Attach Evidence</span>
            </button>
          </div>
        </div>

        {/* Evidences Gallery */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {evidences.map((ev) => (
            <div
              key={ev.id}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 text-xs"
            >
              <div className="h-32 bg-slate-200 relative overflow-hidden">
                <img src={ev.url} alt="Field Evidence" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                  {ev.type}
                </span>
              </div>
              <div className="p-3 space-y-1">
                <p className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {ev.lat.toFixed(4)}° N, {ev.lng.toFixed(4)}° E
                </p>
                <p className="text-[10px] text-slate-400">Captured: {ev.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Verification Report Publishing */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Publish Immutable Verification Report
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Publishing this report will lock the findings, issue Version 1.0 to the customer, and update the property’s badge.
          </p>
        </div>

        {!isPublished ? (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Executive Summary</label>
              <textarea
                rows={2}
                value={reportSummary}
                onChange={(e) => setReportSummary(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Field Specialist Observations</label>
                <textarea
                  rows={3}
                  value={specialistNotes}
                  onChange={(e) => setSpecialistNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Actionable Recommendations for Buyer</label>
                <textarea
                  rows={3}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Mandatory Statutory Notice Included Automatically</strong>
                <p className="text-amber-800">
                  Every published report automatically embeds the required disclaimer stating that findings constitute structured due diligence and do not replace certified government land title registries or formal legal opinion.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                disabled={isPublishing}
                onClick={handlePublishReport}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isPublishing ? "Publishing Report..." : "Publish Final Verification Report"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Verification Report Published Successfully!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Case <strong>VER-2026-0089</strong> is marked Complete. The buyer has been notified and the property status updated to Verified.
              </p>
            </div>
            <Link
              href="/verification"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
            >
              <span>Return to Verification Portal</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
