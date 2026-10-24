"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type CheckResult = "NotChecked" | "Pass" | "NeedsEvidence" | "Concern";

interface SiteCheck {
  id: string;
  checkCode: string;
  checkTitle: string;
  result: CheckResult;
  notes?: string | null;
}

interface VisitEvidence {
  id: string;
  evidenceType: string;
  fileUrl: string;
  downloadPath?: string;
  latitude?: number | null;
  longitude?: number | null;
  capturedAtUtc: string;
}

interface SpecialistVisit {
  caseId: string;
  targetName: string;
  targetCity: string;
  targetArea: string;
  latitude?: number | null;
  longitude?: number | null;
  serviceLevel: string;
  caseStatus: string;
  visitStatus: string;
  fee: number;
  currency: string;
  slaHours: number;
  slaRemainingHours: number;
  customerName: string;
  customerPhone?: string | null;
  isAssignedToMe: boolean;
  canSelfAssign: boolean;
  siteCheckCount: number;
  sitePassedCount: number;
  siteConcernCount: number;
  geoEvidenceCount: number;
  hasReport: boolean;
  createdAtUtc: string;
  assignedAtUtc?: string | null;
  scheduledVisitAtUtc?: string | null;
  visitNotes?: string | null;
  siteChecks: SiteCheck[];
  evidences: VisitEvidence[];
}

interface VisitsResponse {
  specialist: { id: string; fullName: string; email: string };
  summary: {
    totalSiteCases: number;
    scheduledCount: number;
    inFieldCount: number;
    fieldClearCount: number;
    concernCount: number;
    completedCount: number;
    queueCount: number;
    geoEvidenceCount: number;
    filteredCount: number;
  };
  visits: SpecialistVisit[];
}

const SCOPE_OPTIONS = [
  { value: "active", label: "Active visits" },
  { value: "mine", label: "Assigned to me" },
  { value: "queue", label: "Open queue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All site cases" },
] as const;

const VISIT_STATUS_OPTIONS = [
  "Scheduled",
  "InField",
  "FieldClear",
  "Concern",
  "Completed",
] as const;

function formatPkr(amount: number, currency = "PKR"): string {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function serviceLabel(level: string): string {
  return level.replace(/([A-Z])/g, " $1").trim();
}

function visitBadgeClass(status: string): string {
  switch (status) {
    case "FieldClear":
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "InField":
      return "bg-blue-100 text-blue-800";
    case "Concern":
      return "bg-rose-100 text-rose-800";
    case "Scheduled":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function parseVisits(json: Record<string, unknown>): VisitsResponse {
  const specialist = (json.specialist ?? json.Specialist ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const rows = (json.visits ?? json.Visits ?? []) as Record<string, unknown>[];

  return {
    specialist: {
      id: String(specialist.id ?? specialist.Id ?? ""),
      fullName: String(specialist.fullName ?? specialist.FullName ?? "Specialist"),
      email: String(specialist.email ?? specialist.Email ?? ""),
    },
    summary: {
      totalSiteCases: Number(summary.totalSiteCases ?? summary.TotalSiteCases ?? 0),
      scheduledCount: Number(summary.scheduledCount ?? summary.ScheduledCount ?? 0),
      inFieldCount: Number(summary.inFieldCount ?? summary.InFieldCount ?? 0),
      fieldClearCount: Number(summary.fieldClearCount ?? summary.FieldClearCount ?? 0),
      concernCount: Number(summary.concernCount ?? summary.ConcernCount ?? 0),
      completedCount: Number(summary.completedCount ?? summary.CompletedCount ?? 0),
      queueCount: Number(summary.queueCount ?? summary.QueueCount ?? 0),
      geoEvidenceCount: Number(summary.geoEvidenceCount ?? summary.GeoEvidenceCount ?? 0),
      filteredCount: Number(summary.filteredCount ?? summary.FilteredCount ?? 0),
    },
    visits: rows.map((v) => {
      const checks = (v.siteChecks ?? v.SiteChecks ?? []) as Record<string, unknown>[];
      const evidences = (v.evidences ?? v.Evidences ?? []) as Record<string, unknown>[];
      return {
        caseId: String(v.caseId ?? v.CaseId ?? ""),
        targetName: String(v.targetName ?? v.TargetName ?? "Target"),
        targetCity: String(v.targetCity ?? v.TargetCity ?? ""),
        targetArea: String(v.targetArea ?? v.TargetArea ?? ""),
        latitude: (v.latitude ?? v.Latitude) as number | null | undefined,
        longitude: (v.longitude ?? v.Longitude) as number | null | undefined,
        serviceLevel: String(v.serviceLevel ?? v.ServiceLevel ?? ""),
        caseStatus: String(v.caseStatus ?? v.CaseStatus ?? ""),
        visitStatus: String(v.visitStatus ?? v.VisitStatus ?? ""),
        fee: Number(v.fee ?? v.Fee ?? 0),
        currency: String(v.currency ?? v.Currency ?? "PKR"),
        slaHours: Number(v.slaHours ?? v.SLAHours ?? 0),
        slaRemainingHours: Number(v.slaRemainingHours ?? v.SlaRemainingHours ?? 0),
        customerName: String(v.customerName ?? v.CustomerName ?? "Customer"),
        customerPhone: (v.customerPhone ?? v.CustomerPhone) as string | null | undefined,
        isAssignedToMe: Boolean(v.isAssignedToMe ?? v.IsAssignedToMe),
        canSelfAssign: Boolean(v.canSelfAssign ?? v.CanSelfAssign),
        siteCheckCount: Number(v.siteCheckCount ?? v.SiteCheckCount ?? 0),
        sitePassedCount: Number(v.sitePassedCount ?? v.SitePassedCount ?? 0),
        siteConcernCount: Number(v.siteConcernCount ?? v.SiteConcernCount ?? 0),
        geoEvidenceCount: Number(v.geoEvidenceCount ?? v.GeoEvidenceCount ?? 0),
        hasReport: Boolean(v.hasReport ?? v.HasReport),
        createdAtUtc: String(v.createdAtUtc ?? v.CreatedAtUtc ?? ""),
        assignedAtUtc: (v.assignedAtUtc ?? v.AssignedAtUtc) as string | null | undefined,
        scheduledVisitAtUtc: (v.scheduledVisitAtUtc ?? v.ScheduledVisitAtUtc) as
          | string
          | null
          | undefined,
        visitNotes: (v.visitNotes ?? v.VisitNotes) as string | null | undefined,
        siteChecks: checks.map((ci) => ({
          id: String(ci.id ?? ci.Id ?? ""),
          checkCode: String(ci.checkCode ?? ci.CheckCode ?? ""),
          checkTitle: String(ci.checkTitle ?? ci.CheckTitle ?? ""),
          result: String(ci.result ?? ci.Result ?? "NotChecked") as CheckResult,
          notes: (ci.notes ?? ci.Notes) as string | null | undefined,
        })),
        evidences: evidences.map((e) => {
          const fromApi = String(e.downloadPath ?? e.DownloadPath ?? "").trim();
          return {
            id: String(e.id ?? e.Id ?? ""),
            evidenceType: String(e.evidenceType ?? e.EvidenceType ?? "SitePhoto"),
            fileUrl: String(e.fileUrl ?? e.FileUrl ?? ""),
            downloadPath: fromApi || undefined,
            latitude: (e.latitude ?? e.Latitude) as number | null | undefined,
            longitude: (e.longitude ?? e.Longitude) as number | null | undefined,
            capturedAtUtc: String(e.capturedAtUtc ?? e.CapturedAtUtc ?? ""),
          };
        }),
      };
    }),
  };
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SpecialistVisitsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<VisitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [scope, setScope] = useState("active");
  const [visitStatus, setVisitStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [latitude, setLatitude] = useState<number | "">("");
  const [longitude, setLongitude] = useState<number | "">("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (visitStatus !== "All") params.set("visitStatus", visitStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/verification/specialist/visits?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "Site visits require a Specialist account."
                : `Could not load visits (${res.status}).`)
        );
      }
      setData(parseVisits((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load visits.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, visitStatus, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to view site visits.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const takeCase = async (caseId: string) => {
    if (!data?.specialist.id) return;
    setBusyKey(`assign-${caseId}`);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          specialistId: data.specialist.id,
          assignmentNotes: "Self-assigned from Visits page for site demarcation",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Assign failed");
      }
      setActionMsg("Case assigned. Expand it to log field checks.");
      setExpandedId(caseId);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not assign case");
    } finally {
      setBusyKey(null);
    }
  };

  const updateCheck = async (
    caseId: string,
    itemId: string,
    result: CheckResult,
    notes?: string
  ) => {
    setBusyKey(itemId);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}/checklist/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ result, notes: notes ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Update failed");
      }
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not update site check");
    } finally {
      setBusyKey(null);
    }
  };

  const scheduleVisit = async (caseId: string) => {
    if (!scheduleAt) {
      setActionMsg("Pick a visit date and time.");
      return;
    }
    setBusyKey(`sched-${caseId}`);
    setActionMsg(null);
    try {
      const iso = new Date(scheduleAt).toISOString();
      const res = await authFetch(`/api/verification/cases/${caseId}/schedule-visit`, {
        method: "PUT",
        body: JSON.stringify({
          scheduledVisitAtUtc: iso,
          visitNotes: scheduleNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Schedule failed");
      }
      setActionMsg("Site visit scheduled.");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not schedule visit");
    } finally {
      setBusyKey(null);
    }
  };

  const addEvidence = async (caseId: string) => {
    if (!photoFile && !photoUrl.trim()) {
      setActionMsg("Choose a geo photo file, or paste a URL as fallback.");
      return;
    }
    setBusyKey(`ev-${caseId}`);
    setActionMsg(null);
    try {
      const lat = latitude === "" ? null : Number(latitude);
      const lng = longitude === "" ? null : Number(longitude);
      let res: Response;
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        formData.append("evidenceType", "SitePhoto");
        if (lat != null && !Number.isNaN(lat)) formData.append("latitude", String(lat));
        if (lng != null && !Number.isNaN(lng)) formData.append("longitude", String(lng));
        formData.append("notes", "Field photo from Visits page");
        res = await authFetch(`/api/verification/cases/${caseId}/evidence/upload`, {
          method: "POST",
          body: formData,
        });
      } else {
        const url = photoUrl.trim();
        res = await authFetch(`/api/verification/cases/${caseId}/evidence`, {
          method: "POST",
          body: JSON.stringify({
            evidenceType: "SitePhoto",
            fileUrl: url,
            storageKey: url,
            latitude: lat ?? undefined,
            longitude: lng ?? undefined,
            notes: "Field photo from Visits page",
          }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Upload failed");
      }
      setPhotoUrl("");
      setPhotoFile(null);
      setActionMsg(photoFile ? "Geo photo uploaded." : "Geo evidence attached.");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not add evidence");
    } finally {
      setBusyKey(null);
    }
  };

  const visits = data?.visits ?? [];
  const summary = data?.summary;

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        Loading site visits…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            Site demarcations & field visits
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.specialist.fullName || "Specialist"} · cases with SiteVisit checklist · live from
            Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/specialist/cases" className="text-xs font-bold text-teal-700 hover:underline px-2">
            Cases →
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-teal-200 bg-teal-50/40 px-4 py-3 text-xs text-teal-900">
        Specialist visits are the <span className="font-bold">SiteVisit</span> checks on verification
        cases (Property Site Visit tier and above) — not agent viewing appointments. Log boundary /
        utility results and attach GPS photos here.
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900">
          {actionMsg}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Site cases</p>
            <p className="text-xl font-black text-slate-900">{summary.totalSiteCases}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Scheduled</p>
            <p className="text-xl font-black text-amber-900">{summary.scheduledCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">In field</p>
            <p className="text-xl font-black text-blue-900">{summary.inFieldCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Field clear</p>
            <p className="text-xl font-black text-emerald-900">{summary.fieldClearCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">Concern</p>
            <p className="text-xl font-black text-rose-900">{summary.concernCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Geo photos</p>
            <p className="text-xl font-black text-slate-900">{summary.geoEvidenceCount}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={visitStatus}
          onChange={(e) => setVisitStatus(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">Any visit status</option>
          {VISIT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target, buyer, city…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No site visits in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Visits appear for verification cases at Property Site Visit tier or higher (with SiteVisit
            checklist rows). Request one from the marketplace or open an assigned case.
          </p>
          <Link
            href="/verification"
            className="inline-block text-xs font-bold text-teal-700 hover:underline"
          >
            Verification marketplace →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const open = expandedId === v.caseId;
            return (
              <div
                key={v.caseId}
                className="rounded-2xl border border-slate-200 bg-slate-50/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = open ? null : v.caseId;
                    setExpandedId(next);
                    if (next) {
                      setScheduleAt(toDatetimeLocalValue(v.scheduledVisitAtUtc));
                      setScheduleNotes(v.visitNotes ?? "");
                    }
                  }}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{v.targetName}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${visitBadgeClass(v.visitStatus)}`}
                      >
                        {v.visitStatus}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {v.caseStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {[v.targetArea, v.targetCity].filter(Boolean).join(", ")} ·{" "}
                      {serviceLabel(v.serviceLevel)} · {formatPkr(v.fee, v.currency)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {v.customerName}
                      {v.customerPhone ? ` · ${v.customerPhone}` : ""} · Site checks{" "}
                      {v.sitePassedCount}/{v.siteCheckCount}
                      {v.geoEvidenceCount > 0 ? ` · ${v.geoEvidenceCount} geo photo` : ""} · SLA{" "}
                      {Math.round(v.slaRemainingHours)}h left
                    </p>
                    {v.scheduledVisitAtUtc && (
                      <p className="text-[11px] text-amber-800 inline-flex items-center gap-1 font-semibold">
                        <CalendarClock className="w-3 h-3" />
                        Visit {formatDate(v.scheduledVisitAtUtc)}
                        {v.visitNotes ? ` · ${v.visitNotes}` : ""}
                      </p>
                    )}
                    {v.latitude != null && v.longitude != null && (
                      <p className="text-[11px] font-mono text-teal-800 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-200 bg-white p-4 space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {v.canSelfAssign && (
                        <button
                          type="button"
                          disabled={busyKey === `assign-${v.caseId}`}
                          onClick={() => void takeCase(v.caseId)}
                          className="inline-flex items-center gap-1.5 font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-2 rounded-xl"
                        >
                          {busyKey === `assign-${v.caseId}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Take case
                        </button>
                      )}
                      <Link
                        href={`/specialist?focusCaseId=${v.caseId}`}
                        className="inline-flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl"
                      >
                        Full workbench
                      </Link>
                      {v.customerPhone && (
                        <a
                          href={`tel:${v.customerPhone}`}
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 px-2"
                        >
                          <Phone className="w-3 h-3" />
                          {v.customerPhone}
                        </a>
                      )}
                      <span className="text-slate-400 px-2 py-2">
                        Requested {formatDate(v.createdAtUtc)}
                        {v.assignedAtUtc ? ` · Assigned ${formatDate(v.assignedAtUtc)}` : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-slate-900">Site visit checklist</h4>
                      {v.siteChecks.map((check) => {
                        const itemBusy = busyKey === check.id;
                        return (
                          <div
                            key={check.id}
                            className="rounded-xl border border-slate-200 p-3 space-y-2"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="font-mono text-[10px] font-bold text-slate-500">
                                  {check.checkCode}
                                </span>
                                <p className="text-xs font-semibold text-slate-800">
                                  {check.checkTitle}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {(["Pass", "NeedsEvidence", "Concern"] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    disabled={itemBusy || !v.isAssignedToMe || v.hasReport}
                                    onClick={() =>
                                      void updateCheck(v.caseId, check.id, r, check.notes ?? "")
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold disabled:opacity-40 ${
                                      check.result === r
                                        ? r === "Pass"
                                          ? "bg-emerald-600 text-white"
                                          : r === "Concern"
                                            ? "bg-rose-600 text-white"
                                            : "bg-amber-500 text-white"
                                        : "bg-white border border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {r === "Pass" ? (
                                      <span className="inline-flex items-center gap-0.5">
                                        <Check className="w-3 h-3" /> Pass
                                      </span>
                                    ) : r === "Concern" ? (
                                      <span className="inline-flex items-center gap-0.5">
                                        <X className="w-3 h-3" /> Concern
                                      </span>
                                    ) : (
                                      "Need proof"
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="text"
                              defaultValue={check.notes ?? ""}
                              disabled={!v.isAssignedToMe || v.hasReport}
                              onBlur={(e) => {
                                const notes = e.target.value;
                                if (notes !== (check.notes ?? ""))
                                  void updateCheck(v.caseId, check.id, check.result, notes);
                              }}
                              placeholder="Field notes (road width, pegs, utilities…)"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {v.isAssignedToMe && !v.hasReport && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2 text-xs">
                        <h4 className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                          Schedule site visit
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-2">
                          <input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          />
                          <input
                            value={scheduleNotes}
                            onChange={(e) => setScheduleNotes(e.target.value)}
                            placeholder="Visit notes (optional)"
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={busyKey === `sched-${v.caseId}` || !scheduleAt}
                          onClick={() => void scheduleVisit(v.caseId)}
                          className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2 rounded-xl disabled:opacity-50"
                        >
                          {busyKey === `sched-${v.caseId}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CalendarClock className="w-3.5 h-3.5" />
                          )}
                          Save schedule
                        </button>
                      </div>
                    )}

                    {v.isAssignedToMe && !v.hasReport && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                        <h4 className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-teal-600" />
                          Attach geo photo
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                          <div className="sm:col-span-2 space-y-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf,.pdf"
                              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 file:mr-2 file:text-xs file:font-bold file:border-0 file:bg-teal-50 file:text-teal-800"
                            />
                            <input
                              value={photoUrl}
                              onChange={(e) => setPhotoUrl(e.target.value)}
                              placeholder="URL fallback (if no file)"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="Lat"
                              value={latitude}
                              onChange={(e) =>
                                setLatitude(e.target.value === "" ? "" : Number(e.target.value))
                              }
                              className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 bg-white"
                            />
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="Lng"
                              value={longitude}
                              onChange={(e) =>
                                setLongitude(e.target.value === "" ? "" : Number(e.target.value))
                              }
                              className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={
                              busyKey === `ev-${v.caseId}` ||
                              (!photoFile && !photoUrl.trim())
                            }
                            onClick={() => void addEvidence(v.caseId)}
                            className="inline-flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl disabled:opacity-50"
                          >
                            {busyKey === `ev-${v.caseId}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : photoFile ? (
                              <Upload className="w-3.5 h-3.5" />
                            ) : (
                              <Camera className="w-3.5 h-3.5" />
                            )}
                            {photoFile ? "Upload" : "Attach"}
                          </button>
                        </div>
                      </div>
                    )}

                    {v.evidences.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {v.evidences.map((ev) => (
                          <div
                            key={ev.id}
                            className="rounded-xl border border-slate-200 overflow-hidden text-xs"
                          >
                            <div className="h-24 bg-slate-100">
                              {ev.fileUrl.startsWith("http") || ev.fileUrl.startsWith("/") ? (
                                <img
                                  src={ev.fileUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  {ev.evidenceType}
                                </div>
                              )}
                            </div>
                            <div className="p-2 space-y-0.5">
                              {ev.latitude != null && ev.longitude != null && (
                                <p className="font-mono text-[10px] text-teal-800">
                                  {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400">
                                {formatDate(ev.capturedAtUtc)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
