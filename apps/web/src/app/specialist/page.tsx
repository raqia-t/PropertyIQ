"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Check,
  X,
  ExternalLink,
  ArrowRight,
  Loader2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type CheckResult = "NotChecked" | "Pass" | "NeedsEvidence" | "Concern";

interface FocusChecklistItem {
  id: string;
  category: string;
  checkCode: string;
  checkTitle: string;
  result: CheckResult;
  notes?: string | null;
}

interface FocusEvidence {
  id: string;
  evidenceType: string;
  fileUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  capturedAtUtc: string;
}

interface FocusCase {
  id: string;
  target: {
    name: string;
    city: string;
    area: string;
    propertyId?: string | null;
    projectId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  customer?: { fullName: string; email: string; phoneNumber?: string | null } | null;
  serviceLevel: string;
  status: string;
  fee: number;
  currency: string;
  slaHours: number;
  slaRemainingHours: number;
  isSlaBreached: boolean;
  canSelfAssign: boolean;
  isAssignedToMe: boolean;
  totalChecks: number;
  passedChecks: number;
  concernChecks: number;
  evidenceCount: number;
  hasReport: boolean;
  checklistItems: FocusChecklistItem[];
  evidences: FocusEvidence[];
}

interface DashboardResponse {
  specialist: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  summary: {
    queueCount: number;
    assignedToMeCount: number;
    inProgressCount: number;
    completedCount: number;
    slaAtRiskCount: number;
    totalOpenCount: number;
    publishedReportsCount: number;
  };
  queue: Array<{
    id: string;
    targetName: string;
    targetCity: string;
    serviceLevel: string;
    status: string;
    fee: number;
    currency: string;
    customerName: string;
  }>;
  myCases: Array<{
    id: string;
    targetName: string;
    status: string;
    passedChecks: number;
    totalChecks: number;
    hasReport: boolean;
  }>;
  focusCase?: FocusCase | null;
}

function formatPkr(amount: number, currency = "PKR"): string {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function serviceLabel(level: string): string {
  return level.replace(/([A-Z])/g, " $1").trim();
}

function mapFocusCase(raw: Record<string, unknown>): FocusCase {
  const target = (raw.target ?? raw.Target ?? {}) as Record<string, unknown>;
  const customerRaw = (raw.customer ?? raw.Customer) as Record<string, unknown> | null | undefined;
  const checklist = (raw.checklistItems ?? raw.ChecklistItems ?? []) as Record<string, unknown>[];
  const evidences = (raw.evidences ?? raw.Evidences ?? []) as Record<string, unknown>[];

  return {
    id: String(raw.id ?? raw.Id ?? ""),
    target: {
      name: String(target.name ?? target.Name ?? "Target"),
      city: String(target.city ?? target.City ?? ""),
      area: String(target.area ?? target.Area ?? ""),
      propertyId: (target.propertyId ?? target.PropertyId) as string | null | undefined,
      projectId: (target.projectId ?? target.ProjectId) as string | null | undefined,
      latitude: (target.latitude ?? target.Latitude) as number | null | undefined,
      longitude: (target.longitude ?? target.Longitude) as number | null | undefined,
    },
    customer: customerRaw
      ? {
          fullName: String(customerRaw.fullName ?? customerRaw.FullName ?? "Customer"),
          email: String(customerRaw.email ?? customerRaw.Email ?? ""),
          phoneNumber: (customerRaw.phoneNumber ?? customerRaw.PhoneNumber) as string | null,
        }
      : null,
    serviceLevel: String(raw.serviceLevel ?? raw.ServiceLevel ?? ""),
    status: String(raw.status ?? raw.Status ?? ""),
    fee: Number(raw.fee ?? raw.Fee ?? 0),
    currency: String(raw.currency ?? raw.Currency ?? "PKR"),
    slaHours: Number(raw.slaHours ?? raw.SLAHours ?? 0),
    slaRemainingHours: Number(raw.slaRemainingHours ?? raw.SlaRemainingHours ?? 0),
    isSlaBreached: Boolean(raw.isSlaBreached ?? raw.IsSlaBreached),
    canSelfAssign: Boolean(raw.canSelfAssign ?? raw.CanSelfAssign),
    isAssignedToMe: Boolean(raw.isAssignedToMe ?? raw.IsAssignedToMe),
    totalChecks: Number(raw.totalChecks ?? raw.TotalChecks ?? 0),
    passedChecks: Number(raw.passedChecks ?? raw.PassedChecks ?? 0),
    concernChecks: Number(raw.concernChecks ?? raw.ConcernChecks ?? 0),
    evidenceCount: Number(raw.evidenceCount ?? raw.EvidenceCount ?? 0),
    hasReport: Boolean(raw.hasReport ?? raw.HasReport),
    checklistItems: checklist.map((ci) => ({
      id: String(ci.id ?? ci.Id ?? ""),
      category: String(ci.category ?? ci.Category ?? ""),
      checkCode: String(ci.checkCode ?? ci.CheckCode ?? ""),
      checkTitle: String(ci.checkTitle ?? ci.CheckTitle ?? ""),
      result: String(ci.result ?? ci.Result ?? "NotChecked") as CheckResult,
      notes: (ci.notes ?? ci.Notes) as string | null | undefined,
    })),
    evidences: evidences.map((e) => ({
      id: String(e.id ?? e.Id ?? ""),
      evidenceType: String(e.evidenceType ?? e.EvidenceType ?? "SitePhoto"),
      fileUrl: String(e.fileUrl ?? e.FileUrl ?? ""),
      latitude: (e.latitude ?? e.Latitude) as number | null | undefined,
      longitude: (e.longitude ?? e.Longitude) as number | null | undefined,
      capturedAtUtc: String(e.capturedAtUtc ?? e.CapturedAtUtc ?? ""),
    })),
  };
}

function parseDashboard(json: Record<string, unknown>): DashboardResponse {
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const specialist = (json.specialist ?? json.Specialist ?? {}) as Record<string, unknown>;
  const queue = (json.queue ?? json.Queue ?? []) as Record<string, unknown>[];
  const myCases = (json.myCases ?? json.MyCases ?? []) as Record<string, unknown>[];
  const focusRaw = (json.focusCase ?? json.FocusCase) as Record<string, unknown> | null | undefined;

  return {
    specialist: {
      id: String(specialist.id ?? specialist.Id ?? ""),
      fullName: String(specialist.fullName ?? specialist.FullName ?? "Specialist"),
      email: String(specialist.email ?? specialist.Email ?? ""),
      phoneNumber: String(specialist.phoneNumber ?? specialist.PhoneNumber ?? ""),
    },
    summary: {
      queueCount: Number(summary.queueCount ?? summary.QueueCount ?? 0),
      assignedToMeCount: Number(summary.assignedToMeCount ?? summary.AssignedToMeCount ?? 0),
      inProgressCount: Number(summary.inProgressCount ?? summary.InProgressCount ?? 0),
      completedCount: Number(summary.completedCount ?? summary.CompletedCount ?? 0),
      slaAtRiskCount: Number(summary.slaAtRiskCount ?? summary.SlaAtRiskCount ?? 0),
      totalOpenCount: Number(summary.totalOpenCount ?? summary.TotalOpenCount ?? 0),
      publishedReportsCount: Number(
        summary.publishedReportsCount ?? summary.PublishedReportsCount ?? 0
      ),
    },
    queue: queue.map((q) => ({
      id: String(q.id ?? q.Id ?? ""),
      targetName: String(q.targetName ?? q.TargetName ?? ""),
      targetCity: String(q.targetCity ?? q.TargetCity ?? ""),
      serviceLevel: String(q.serviceLevel ?? q.ServiceLevel ?? ""),
      status: String(q.status ?? q.Status ?? ""),
      fee: Number(q.fee ?? q.Fee ?? 0),
      currency: String(q.currency ?? q.Currency ?? "PKR"),
      customerName: String(q.customerName ?? q.CustomerName ?? ""),
    })),
    myCases: myCases.map((c) => ({
      id: String(c.id ?? c.Id ?? ""),
      targetName: String(c.targetName ?? c.TargetName ?? ""),
      status: String(c.status ?? c.Status ?? ""),
      passedChecks: Number(c.passedChecks ?? c.PassedChecks ?? 0),
      totalChecks: Number(c.totalChecks ?? c.TotalChecks ?? 0),
      hasReport: Boolean(c.hasReport ?? c.HasReport),
    })),
    focusCase: focusRaw ? mapFocusCase(focusRaw) : null,
  };
}

function SpecialistWorkbenchContent() {
  const { isHydrated, isAuthenticated, authFetch, user } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [focusCaseId, setFocusCaseId] = useState<string | null>(
    searchParams.get("focusCaseId")
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fromUrl = searchParams.get("focusCaseId");
    if (fromUrl) setFocusCaseId(fromUrl);
  }, [searchParams]);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState("");
  const [latitude, setLatitude] = useState<number | "">("");
  const [longitude, setLongitude] = useState<number | "">("");
  const [reportSummary, setReportSummary] = useState("");
  const [specialistNotes, setSpecialistNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (focusCaseId) params.set("focusCaseId", focusCaseId);
      const qs = params.toString();
      const res = await authFetch(
        `/api/verification/specialist/dashboard${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "This workspace requires a Specialist account."
                : `Could not load dashboard (${res.status}).`)
        );
      }
      const parsed = parseDashboard((await res.json()) as Record<string, unknown>);
      setData(parsed);
      if (parsed.focusCase && !focusCaseId) setFocusCaseId(parsed.focusCase.id);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, focusCaseId]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to open the workbench.");
      return;
    }
    void loadDashboard();
  }, [isHydrated, isAuthenticated, loadDashboard]);

  const focus = data?.focusCase ?? null;

  const selfAssign = async () => {
    if (!focus || !data?.specialist.id) return;
    setBusy("assign");
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${focus.id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          specialistId: data.specialist.id,
          assignmentNotes: "Self-assigned from specialist dashboard",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Assign failed");
      }
      setActionMsg("Case assigned to you.");
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not assign case");
    } finally {
      setBusy(null);
    }
  };

  const updateCheck = async (itemId: string, result: CheckResult, notes?: string) => {
    if (!focus) return;
    setBusy(itemId);
    try {
      const res = await authFetch(
        `/api/verification/cases/${focus.id}/checklist/${itemId}`,
        {
          method: "PUT",
          body: JSON.stringify({ result, notes: notes ?? "" }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Update failed");
      }
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not update checklist");
    } finally {
      setBusy(null);
    }
  };

  const addEvidence = async () => {
    if (!focus || !photoUrl.trim()) return;
    setBusy("evidence");
    try {
      const url = photoUrl.trim();
      const res = await authFetch(`/api/verification/cases/${focus.id}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          evidenceType: "SitePhoto",
          fileUrl: url,
          storageKey: url,
          latitude: latitude === "" ? undefined : Number(latitude),
          longitude: longitude === "" ? undefined : Number(longitude),
          notes: "Uploaded from specialist dashboard",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Upload failed");
      }
      setPhotoUrl("");
      setActionMsg("Evidence attached.");
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not add evidence");
    } finally {
      setBusy(null);
    }
  };

  const publishReport = async () => {
    if (!focus || !reportSummary.trim()) return;
    setBusy("publish");
    try {
      const res = await authFetch(`/api/verification/cases/${focus.id}/generate-report`, {
        method: "POST",
        body: JSON.stringify({
          summary: reportSummary.trim(),
          specialistNotes: specialistNotes.trim() || undefined,
          customerRecommendations: recommendations.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Publish failed");
      }
      setActionMsg("Verification report published.");
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not publish report");
    } finally {
      setBusy(null);
    }
  };

  const markReviewPending = async () => {
    if (!focus) return;
    setBusy("review-pending");
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${focus.id}/review-pending`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Could not mark review pending"
        );
      }
      setActionMsg("Case marked Review Pending.");
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not mark review pending");
    } finally {
      setBusy(null);
    }
  };

  const cancelCase = async () => {
    if (!focus) return;
    const ok = window.confirm(
      `Cancel verification case for “${focus.target.name}”? This cannot be undone from the dashboard.`
    );
    if (!ok) return;
    setBusy("cancel");
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${focus.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled from specialist workbench" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Cancel failed");
      }
      setActionMsg("Case cancelled.");
      setFocusCaseId(null);
      await loadDashboard();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not cancel case");
    } finally {
      setBusy(null);
    }
  };

  const checklistComplete =
    !!focus &&
    focus.checklistItems.length > 0 &&
    focus.checklistItems.every((c) => c.result !== "NotChecked");
  const canCancelFocus =
    !!focus &&
    !focus.hasReport &&
    focus.status !== "Completed" &&
    focus.status !== "Cancelled";

  if (!isHydrated || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        Loading specialist dashboard…
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800">
              Verification Specialist Dashboard
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> live from Postgres
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {data?.specialist.fullName ?? user?.fullName ?? "Field Specialist"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {focus
              ? `Focus case · ${focus.target.name} · ${focus.status}`
              : "No open case — pick one from the queue below"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#plra"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            PLRA
          </a>
          <a
            href="#camera"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            Camera
          </a>
          <a
            href="#publish"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            Publish
          </a>
          <Link
            href="/specialist/cases"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            All cases →
          </Link>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            Customer view
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      <div
        id="plra"
        className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-700 scroll-mt-24"
      >
        <p className="font-bold text-slate-900 mb-0.5">RecordCheck / PLRA</p>
        <p>
          Official record checks are checklist-assisted guidance only — there is no live PLRA /
          authority portal integration. Log outcomes against checklist items and attach supporting
          evidence.
        </p>
      </div>

      <div
        id="camera"
        className="rounded-xl border border-teal-200 bg-teal-50/40 px-4 py-3 text-xs text-teal-900 scroll-mt-24 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <p>
          <span className="font-bold">Field camera / GPS evidence</span> — geo-tagged site photos
          and observations.
        </p>
        <Link
          href="/specialist/evidence"
          className="inline-flex items-center gap-1.5 font-bold text-teal-800 bg-white border border-teal-200 px-3 py-2 rounded-xl shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          Open evidence workspace
        </Link>
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
            <p className="text-[10px] font-bold uppercase text-slate-400">Open queue</p>
            <p className="text-xl font-black text-slate-900">{summary.queueCount}</p>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-teal-700">My cases</p>
            <p className="text-xl font-black text-teal-900">{summary.assignedToMeCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">In progress</p>
            <p className="text-xl font-black text-blue-900">{summary.inProgressCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Completed</p>
            <p className="text-xl font-black text-emerald-900">{summary.completedCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">SLA at risk</p>
            <p className="text-xl font-black text-amber-900">{summary.slaAtRiskCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Reports</p>
            <p className="text-xl font-black text-slate-900">{summary.publishedReportsCount}</p>
          </div>
        </div>
      )}

      {(data?.queue.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
            <Inbox className="w-4 h-4 text-teal-600" />
            Unassigned queue
          </h2>
          <div className="space-y-2">
            {data!.queue.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setFocusCaseId(q.id)}
                className="w-full text-left p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-teal-50/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-900">{q.targetName}</p>
                  <p className="text-slate-500">
                    {q.customerName} · {serviceLabel(q.serviceLevel)} ·{" "}
                    {formatPkr(q.fee, q.currency)}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                  {q.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!focus ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No verification case in focus</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            When a buyer requests verification from the marketplace, cases appear in the queue.
            Select a case or ask a customer to create one from{" "}
            <Link href="/verification" className="text-teal-700 font-bold hover:underline">
              /verification
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Target asset</span>
              <span className="font-bold text-slate-900 text-sm">{focus.target.name}</span>
              <span className="text-[11px] text-slate-500 block">
                {focus.target.area ? `${focus.target.area}, ` : ""}
                {focus.target.city}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Service scope</span>
              <span className="font-bold text-slate-800">{serviceLabel(focus.serviceLevel)}</span>
              <span className="text-[11px] text-teal-700 font-semibold block">
                {formatPkr(focus.fee, focus.currency)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">SLA remaining</span>
              <span
                className={`font-bold ${focus.isSlaBreached ? "text-rose-700" : "text-amber-700"}`}
              >
                {Math.round(focus.slaRemainingHours)}h left
              </span>
              <span className="text-[11px] text-slate-500 block">{focus.slaHours}h SLA</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Progress</span>
              <span className="font-bold text-slate-900">
                {focus.passedChecks} / {focus.totalChecks} passed
              </span>
              <span className="text-[11px] text-blue-600 font-semibold block">{focus.status}</span>
            </div>
          </div>

          {focus.canSelfAssign && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <p className="text-amber-900">
                This case is in the open queue. Assign it to yourself to start checklist and
                evidence work.
              </p>
              <button
                type="button"
                disabled={busy === "assign"}
                onClick={() => void selfAssign()}
                className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {busy === "assign" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                Take case
              </button>
            </div>
          )}

          {canCancelFocus && focus.isAssignedToMe && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy === "cancel"}
                onClick={() => void cancelCase()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3.5 py-2 rounded-xl disabled:opacity-50"
              >
                {busy === "cancel" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Cancel case
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Due-diligence checklist</h2>
              <p className="text-xs text-slate-500 mt-1">
                Updates save to the case immediately (Pass / Needs evidence / Concern).
              </p>
            </div>
            <div className="space-y-4">
              {focus.checklistItems.map((check) => {
                const itemBusy = busy === check.id;
                return (
                  <div
                    key={check.id}
                    className="border border-slate-200 rounded-2xl p-4 bg-slate-50/30 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700 shrink-0">
                          {check.checkCode}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{check.checkTitle}</h3>
                          <span className="text-[11px] text-slate-400 uppercase font-semibold">
                            {check.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(["Pass", "NeedsEvidence", "Concern"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={itemBusy || focus.hasReport}
                            onClick={() => void updateCheck(check.id, r, check.notes ?? "")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 ${
                              check.result === r
                                ? r === "Pass"
                                  ? "bg-emerald-600 text-white"
                                  : r === "Concern"
                                    ? "bg-rose-600 text-white"
                                    : "bg-amber-500 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {r === "Pass" && <Check className="w-3.5 h-3.5" />}
                            {r === "Concern" && <X className="w-3.5 h-3.5" />}
                            {r === "Pass" ? "Pass" : r === "Concern" ? "Concern" : "Need proof"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      defaultValue={check.notes ?? ""}
                      disabled={focus.hasReport}
                      onBlur={(e) => {
                        const notes = e.target.value;
                        if (notes !== (check.notes ?? ""))
                          void updateCheck(check.id, check.result, notes);
                      }}
                      placeholder="Observations, reference numbers…"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                );
              })}
            </div>
            {checklistComplete && !focus.hasReport && focus.isAssignedToMe && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <p className="text-xs text-emerald-800 font-semibold">
                  All checklist items reviewed — optionally mark the case Review Pending before
                  publishing.
                </p>
                <button
                  type="button"
                  disabled={busy === "review-pending" || focus.status === "ReviewPending"}
                  onClick={() => void markReviewPending()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 px-4 py-2.5 rounded-xl"
                >
                  {busy === "review-pending" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {focus.status === "ReviewPending" ? "Review pending" : "Mark review pending"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-900">Geo-tagged evidence</h2>
            {!focus.hasReport && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Photo / file URL</label>
                  <input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                    className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Lng"
                    value={longitude}
                    onChange={(e) =>
                      setLongitude(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy === "evidence" || !focus.isAssignedToMe}
                  onClick={() => void addEvidence()}
                  className="inline-flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl disabled:opacity-50"
                >
                  {busy === "evidence" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Attach
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {focus.evidences.map((ev) => (
                <div
                  key={ev.id}
                  className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 text-xs"
                >
                  <div className="h-32 bg-slate-200 relative overflow-hidden">
                    {ev.fileUrl.startsWith("http") || ev.fileUrl.startsWith("/") ? (
                      <img
                        src={ev.fileUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        {ev.evidenceType}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    {ev.latitude != null && ev.longitude != null && (
                      <p className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{formatDate(ev.capturedAtUtc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="publish"
            className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 scroll-mt-24"
          >
            <h2 className="text-xl font-black text-slate-900">Publish verification report</h2>
            {focus.hasReport ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-slate-900">Report published for this case</p>
                <Link
                  href="/verification"
                  className="inline-flex items-center gap-2 text-xs font-bold text-teal-700 hover:underline"
                >
                  View in verification portal →
                </Link>
              </div>
            ) : (
              <>
                <textarea
                  rows={2}
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Executive summary…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <textarea
                    rows={3}
                    value={specialistNotes}
                    onChange={(e) => setSpecialistNotes(e.target.value)}
                    placeholder="Field specialist observations…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                  <textarea
                    rows={3}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    placeholder="Recommendations for buyer…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>
                    Publishing locks the report and marks the case completed. Statutory disclaimer is
                    appended automatically.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={
                      busy === "publish" || !focus.isAssignedToMe || !reportSummary.trim()
                    }
                    onClick={() => void publishReport()}
                    className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-6 py-3 rounded-xl disabled:opacity-50"
                  >
                    {busy === "publish" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Publish report
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SpecialistWorkbenchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-10 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          Loading specialist workbench…
        </div>
      }
    >
      <SpecialistWorkbenchContent />
    </Suspense>
  );
}
