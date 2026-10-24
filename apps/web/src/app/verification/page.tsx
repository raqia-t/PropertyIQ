"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle,
  FileText,
  MapPin,
  AlertCircle,
  ArrowRight,
  User,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatPkr, pick } from "@/lib/apiHelpers";

interface ServiceTier {
  id: string;
  level: number;
  name: string;
  fee: number;
  turnaroundHours: number;
  description: string;
  features: string[];
  popular?: boolean;
}

interface VerificationCaseItem {
  id: string;
  targetName: string;
  city: string;
  area: string;
  serviceLevel: string;
  fee: number;
  slaHours: number;
  status: string;
  specialistName: string;
  requestedAt: string;
  completedAt?: string;
  totalChecks: number;
  passedChecks: number;
  hasReport: boolean;
}

interface CaseReportDetail {
  summary: string;
  specialistNotes?: string;
  recommendations?: string;
  limitations?: string;
  checklist: Array<{ title: string; result: string }>;
}

const FALLBACK_TIERS: ServiceTier[] = [
  {
    id: "basic",
    level: 1,
    name: "Basic Document Review",
    fee: 15000,
    turnaroundHours: 48,
    description: "Document completeness and seller metadata verification.",
    features: ["Registry consistency", "CNIC match", "Red-flag detection"],
  },
  {
    id: "site_visit",
    level: 2,
    name: "Property & Site Visit",
    fee: 25000,
    turnaroundHours: 72,
    description: "Physical inspection by a field specialist.",
    features: ["Site visit", "Geo photos", "Boundary check"],
  },
  {
    id: "record_check",
    level: 3,
    name: "Official Record Check",
    fee: 35000,
    turnaroundHours: 96,
    description: "Authority / PLRA style record checks.",
    features: ["PLRA inquiry", "NOC status", "Fard check"],
  },
  {
    id: "enhanced",
    level: 4,
    name: "Enhanced Due Diligence",
    fee: 60000,
    turnaroundHours: 120,
    description: "Combined site + records due diligence.",
    features: ["Title trail", "Site inspection", "Authority checks"],
    popular: true,
  },
  {
    id: "legal_review",
    level: 5,
    name: "Formal Legal Title Opinion",
    fee: 95000,
    turnaroundHours: 168,
    description: "Advocate-backed legal title opinion.",
    features: ["High Court advocate", "Litigation search", "Written opinion"],
  },
];

function levelToId(level: number | string): string {
  const n = typeof level === "string" ? Number(level) || 0 : level;
  const map: Record<number, string> = {
    1: "basic",
    2: "site_visit",
    3: "record_check",
    4: "enhanced",
    5: "legal_review",
  };
  if (map[n]) return map[n];
  const s = String(level).toLowerCase();
  if (s.includes("basic")) return "basic";
  if (s.includes("site")) return "site_visit";
  if (s.includes("record")) return "record_check";
  if (s.includes("enhanced")) return "enhanced";
  if (s.includes("legal")) return "legal_review";
  return "enhanced";
}

function turnaroundLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "24 Hours" : `${days} Days`;
  }
  return `${hours} Hours`;
}

export default function VerificationMarketplacePage() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [tiers, setTiers] = useState<ServiceTier[]>(FALLBACK_TIERS);
  const [cases, setCases] = useState<VerificationCaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [selectedTier, setSelectedTier] = useState("enhanced");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedCaseForReport, setSelectedCaseForReport] =
    useState<VerificationCaseItem | null>(null);
  const [reportDetail, setReportDetail] = useState<CaseReportDetail | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [properties, setProperties] = useState<
    Array<{ id: string; title: string; city: string }>
  >([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [acknowledgeFee, setAcknowledgeFee] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [attachedDoc, setAttachedDoc] = useState("documents/title-deed.pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setPropertiesLoading(true);
    try {
      const res = await fetch("/api/properties?page=1&pageSize=50");
      if (!res.ok) throw new Error(`Failed to load properties (${res.status})`);
      const data = (await res.json()) as Record<string, unknown>;
      const rows = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
      setProperties(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(pick(r, "id", "Id") ?? ""),
          title: String(pick(r, "title", "Title") ?? "Property"),
          city: String(pick(r, "city", "City") ?? ""),
        })).filter((p) => p.id)
      );
    } catch {
      setProperties([]);
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadCases = useCallback(async () => {
    if (!isHydrated || !isAuthenticated) {
      setCases([]);
      return;
    }
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await authFetch("/api/verification/cases");
      if (!res.ok) throw new Error(`Failed to load cases (${res.status})`);
      const rows = (await res.json()) as Record<string, unknown>[];
      setCases(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(pick(r, "id", "Id") ?? ""),
          targetName: String(pick(r, "targetName", "TargetName") ?? "Property"),
          city: String(pick(r, "targetCity", "TargetCity") ?? ""),
          area: String(pick(r, "targetArea", "TargetArea") ?? ""),
          serviceLevel: String(pick(r, "serviceLevel", "ServiceLevel") ?? ""),
          fee: Number(pick(r, "fee", "Fee") ?? 0),
          slaHours: Number(pick(r, "slaHours", "SLAHours") ?? 0),
          status: String(pick(r, "status", "Status") ?? ""),
          specialistName: String(pick(r, "specialistName", "SpecialistName") ?? "Unassigned"),
          requestedAt: formatDate(String(pick(r, "createdAtUtc", "CreatedAtUtc") ?? "")),
          completedAt: pick(r, "completedAtUtc", "CompletedAtUtc")
            ? formatDate(String(pick(r, "completedAtUtc", "CompletedAtUtc")))
            : undefined,
          totalChecks: Number(pick(r, "totalChecks", "TotalChecks") ?? 0),
          passedChecks: Number(pick(r, "passedChecks", "PassedChecks") ?? 0),
          hasReport: Boolean(pick(r, "hasReport", "HasReport")),
        }))
      );
    } catch (e) {
      setCasesError(e instanceof Error ? e.message : "Could not load cases");
      setCases([]);
    } finally {
      setCasesLoading(false);
    }
  }, [authFetch, isAuthenticated, isHydrated]);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      try {
        const res = await fetch("/api/verification/services");
        if (!res.ok) return;
        const rows = (await res.json()) as Record<string, unknown>[];
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setTiers(
          rows.map((r, idx) => {
            const levelRaw = pick(r, "level", "Level");
            const levelNum =
              typeof levelRaw === "number"
                ? levelRaw
                : Number(
                    String(levelRaw)
                      .replace(/\D/g, "")
                      .slice(0, 1) || idx + 1
                  ) || idx + 1;
            // Enum may serialize as string name
            let level = levelNum;
            const levelStr = String(levelRaw ?? "");
            if (levelStr.includes("Basic")) level = 1;
            else if (levelStr.includes("Site")) level = 2;
            else if (levelStr.includes("Record")) level = 3;
            else if (levelStr.includes("Enhanced")) level = 4;
            else if (levelStr.includes("Legal")) level = 5;

            const features =
              (pick<string[]>(r, "includedChecks", "IncludedChecks") as string[] | undefined) ??
              [];
            const hours = Number(pick(r, "turnaroundHours", "TurnaroundHours") ?? 48);
            return {
              id: levelToId(level),
              level,
              name: String(pick(r, "name", "Name") ?? "Service"),
              fee: Number(pick(r, "fee", "Fee") ?? 0),
              turnaroundHours: hours,
              description: String(pick(r, "description", "Description") ?? ""),
              features,
              popular: level === 4,
            };
          })
        );
      } catch {
        // keep fallback tiers
      }
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const openReport = async (item: VerificationCaseItem) => {
    setSelectedCaseForReport(item);
    setReportDetail(null);
    setReportLoading(true);
    try {
      const res = await authFetch(`/api/verification/cases/${item.id}`);
      if (!res.ok) throw new Error("Failed to load report");
      const data = (await res.json()) as Record<string, unknown>;
      const reports =
        (pick<Record<string, unknown>[]>(data, "reports", "Reports") as
          | Record<string, unknown>[]
          | undefined) ?? [];
      const report = reports[0];
      const checklist =
        (pick<Record<string, unknown>[]>(data, "checklistItems", "ChecklistItems") as
          | Record<string, unknown>[]
          | undefined) ?? [];

      setReportDetail({
        summary: report
          ? String(pick(report, "summary", "Summary") ?? "No summary published.")
          : "Report not published yet.",
        specialistNotes: report
          ? pick<string>(report, "specialistNotes", "SpecialistNotes")
          : undefined,
        recommendations: report
          ? pick<string>(report, "customerRecommendations", "CustomerRecommendations")
          : undefined,
        limitations: report
          ? pick<string>(report, "limitations", "Limitations")
          : "Evidence-based verification only — not a government title certificate.",
        checklist: checklist.map((c) => ({
          title: String(pick(c, "checkTitle", "CheckTitle") ?? "Check"),
          result: String(pick(c, "result", "Result") ?? "Pending"),
        })),
      });
    } catch {
      setReportDetail({
        summary: "Could not load full report from API.",
        limitations: "Try again when the API is available.",
        checklist: [],
      });
    } finally {
      setReportLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!isAuthenticated) {
      setSubmitError("Sign in as a customer to create a verification case.");
      return;
    }
    if (!propertyId) {
      setSubmitError("Select a property listing to verify.");
      return;
    }
    if (!acknowledgeFee) {
      setSubmitError("Acknowledge the verification fee to continue.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const chosen = tiers.find((t) => t.id === selectedTier) || tiers[3] || FALLBACK_TIERS[3];

    try {
      const res = await authFetch("/api/verification/cases", {
        method: "POST",
        body: JSON.stringify({
          propertyId,
          serviceLevel: chosen.level,
          customerNotes: customerNotes.trim() || undefined,
          acknowledgeFee: true,
          documents: attachedDoc.trim()
            ? [
                {
                  documentType: "RegistryOrDeed",
                  fileUrl: attachedDoc.trim(),
                  title: "Title Deed Copy",
                },
              ]
            : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Create failed (${res.status})`
        );
      }
      setSubmitSuccess(true);
      setAcknowledgeFee(false);
      await loadCases();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create case");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
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
            Cases and service tiers load from the API. Order due diligence before paying token money.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => {
                setShowRequestModal(true);
                setSubmitSuccess(false);
                setSubmitError(null);
                setAcknowledgeFee(false);
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

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Active Verification Cases & Reports
            </h2>
            <p className="text-xs text-slate-500 mt-1">Live from GET /api/verification/cases</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {casesLoading ? "…" : `${cases.length} Cases On Record`}
          </span>
        </div>

        {!isAuthenticated && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-100">
            Sign in as a customer to see your verification cases.
          </p>
        )}

        {casesLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            Loading cases…
          </div>
        )}

        {!casesLoading && casesError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {casesError}
          </div>
        )}

        {!casesLoading && isAuthenticated && !casesError && cases.length === 0 && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-100">
            No verification cases yet. Use “Request Verification Now” to create one.
          </p>
        )}

        {!casesLoading && cases.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cases.map((item) => {
              const done = item.status.toLowerCase().includes("completed");
              const progress =
                item.totalChecks > 0
                  ? Math.round((item.passedChecks / item.totalChecks) * 100)
                  : done
                    ? 100
                    : 10;
              return (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition bg-slate-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                        {item.id.slice(0, 8)}…
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          done
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{item.targetName}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {[item.area, item.city].filter(Boolean).join(", ") || "Pakistan"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Service Tier</span>
                        <span className="font-bold text-slate-800">{item.serviceLevel}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Specialist</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {item.specialistName}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                        <span>Checklist Progress</span>
                        <span>
                          {item.passedChecks} of {item.totalChecks || "—"} checks
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${done ? "bg-emerald-600" : "bg-blue-600"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Requested: <strong>{item.requestedAt}</strong>
                    </span>
                    {item.hasReport || done ? (
                      <button
                        type="button"
                        onClick={() => openReport(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-lg border border-emerald-200"
                      >
                        <FileText className="w-4 h-4" />
                        View Report
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic font-medium">
                        Report pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Select Your Due-Diligence Scope
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Service catalog from GET /api/verification/services
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
                  <span className="text-xl font-black text-slate-900">
                    {formatPkr(tier.fee)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    SLA: {turnaroundLabel(tier.turnaroundHours)}
                  </span>
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
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTier(tier.id);
                  setShowRequestModal(true);
                  setSubmitSuccess(false);
                  setSubmitError(null);
                  setAcknowledgeFee(false);
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

      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">Important Operational & Legal Notice</p>
          <p>
            PropertyIQ Verification is an independent, evidence-backed due-diligence service. It does
            not issue official government land titles.
          </p>
        </div>
      </div>

      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  New Due-Diligence Request
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Initiate Property Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!submitSuccess ? (
              <div className="mt-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Property</label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    disabled={propertiesLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">
                      {propertiesLoading ? "Loading listings…" : "Select a listing…"}
                    </option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {p.city ? ` · ${p.city}` : ""} ({p.id.slice(0, 8)}…)
                      </option>
                    ))}
                  </select>
                  {properties.length === 0 && !propertiesLoading && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      No listings found. Publish a property first, then request verification.
                    </p>
                  )}
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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Document URL / Key (optional)
                  </label>
                  <input
                    type="text"
                    value={attachedDoc}
                    onChange={(e) => setAttachedDoc(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-[11px] bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Instructions for Specialist
                  </label>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgeFee}
                    onChange={(e) => setAcknowledgeFee(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="text-slate-700 leading-relaxed">
                    I acknowledge the verification fee of{" "}
                    <span className="font-bold text-emerald-800">
                      {formatPkr(
                        (tiers.find((t) => t.id === selectedTier) || tiers[0])?.fee ?? 0
                      )}
                    </span>{" "}
                    (demo payment) for this due-diligence request.
                  </span>
                </label>

                {submitError && (
                  <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {submitError}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      isSubmitting ||
                      !isAuthenticated ||
                      !propertyId ||
                      !acknowledgeFee
                    }
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
                  <p className="text-xs text-slate-600 mt-1">
                    Your request is logged. Refresh the cases list above for the new entry.
                  </p>
                </div>
                <button
                  type="button"
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

      {selectedCaseForReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded">
                  {selectedCaseForReport.id.slice(0, 8)}…
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  Verification Report
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCaseForReport(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportLoading && (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                Loading report…
              </div>
            )}

            {!reportLoading && reportDetail && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Target</span>
                    <span className="font-bold text-slate-800">
                      {selectedCaseForReport.targetName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Specialist</span>
                    <span className="font-bold text-slate-800">
                      {selectedCaseForReport.specialistName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Completed</span>
                    <span className="font-bold text-slate-800">
                      {selectedCaseForReport.completedAt || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Status</span>
                    <span className="font-bold text-emerald-700">
                      {selectedCaseForReport.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Executive Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                    {reportDetail.summary}
                  </p>
                </div>

                {reportDetail.checklist.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Checklist
                    </h3>
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                      {reportDetail.checklist.map((c, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-slate-800">{c.title}</span>
                          </div>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">
                            {c.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {reportDetail.specialistNotes && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                      <span className="font-bold text-slate-800 block">Specialist Notes</span>
                      <p className="text-slate-600 leading-relaxed">
                        {reportDetail.specialistNotes}
                      </p>
                    </div>
                  )}
                  {reportDetail.recommendations && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                      <span className="font-bold text-slate-800 block">Recommendations</span>
                      <p className="text-slate-600 leading-relaxed">
                        {reportDetail.recommendations}
                      </p>
                    </div>
                  )}
                </div>

                {reportDetail.limitations && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Limitations
                    </div>
                    <p className="text-amber-800 leading-relaxed">{reportDetail.limitations}</p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
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
