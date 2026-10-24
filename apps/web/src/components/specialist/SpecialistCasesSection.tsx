"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SpecialistCase {
  id: string;
  targetName: string;
  targetCity: string;
  targetArea: string;
  propertyId?: string | null;
  projectId?: string | null;
  serviceLevel: string;
  status: string;
  fee: number;
  currency: string;
  slaHours: number;
  slaRemainingHours: number;
  isSlaBreached: boolean;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  specialistName: string;
  isAssignedToMe: boolean;
  canSelfAssign: boolean;
  totalChecks: number;
  passedChecks: number;
  concernChecks: number;
  hasReport: boolean;
  createdAtUtc: string;
  assignedAtUtc?: string | null;
  completedAtUtc?: string | null;
}

interface CasesResponse {
  specialist: { id: string; fullName: string; email: string };
  summary: {
    totalVisible: number;
    queueCount: number;
    assignedToMeCount: number;
    inProgressCount: number;
    completedCount: number;
    slaBreachedCount: number;
    filteredCount: number;
  };
  cases: SpecialistCase[];
}

const SCOPE_OPTIONS = [
  { value: "all", label: "All visible" },
  { value: "mine", label: "Assigned to me" },
  { value: "queue", label: "Open queue" },
  { value: "active", label: "Active (in progress)" },
  { value: "completed", label: "Completed" },
] as const;

const STATUS_OPTIONS = [
  "Requested",
  "Assigned",
  "InProgress",
  "ReviewPending",
  "Completed",
  "Cancelled",
] as const;

const LEVEL_OPTIONS = [
  "BasicDocumentReview",
  "PropertySiteVisit",
  "RecordCheck",
  "EnhancedDueDiligence",
  "LegalReview",
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "InProgress":
    case "Assigned":
      return "bg-blue-100 text-blue-800";
    case "Requested":
    case "ReviewPending":
      return "bg-amber-100 text-amber-800";
    case "Cancelled":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function parseCasesResponse(json: Record<string, unknown>): CasesResponse {
  const specialist = (json.specialist ?? json.Specialist ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const rows = (json.cases ?? json.Cases ?? []) as Record<string, unknown>[];

  return {
    specialist: {
      id: String(specialist.id ?? specialist.Id ?? ""),
      fullName: String(specialist.fullName ?? specialist.FullName ?? "Specialist"),
      email: String(specialist.email ?? specialist.Email ?? ""),
    },
    summary: {
      totalVisible: Number(summary.totalVisible ?? summary.TotalVisible ?? 0),
      queueCount: Number(summary.queueCount ?? summary.QueueCount ?? 0),
      assignedToMeCount: Number(summary.assignedToMeCount ?? summary.AssignedToMeCount ?? 0),
      inProgressCount: Number(summary.inProgressCount ?? summary.InProgressCount ?? 0),
      completedCount: Number(summary.completedCount ?? summary.CompletedCount ?? 0),
      slaBreachedCount: Number(summary.slaBreachedCount ?? summary.SlaBreachedCount ?? 0),
      filteredCount: Number(summary.filteredCount ?? summary.FilteredCount ?? 0),
    },
    cases: rows.map((c) => ({
      id: String(c.id ?? c.Id ?? ""),
      targetName: String(c.targetName ?? c.TargetName ?? "Target"),
      targetCity: String(c.targetCity ?? c.TargetCity ?? ""),
      targetArea: String(c.targetArea ?? c.TargetArea ?? ""),
      propertyId: (c.propertyId ?? c.PropertyId) as string | null | undefined,
      projectId: (c.projectId ?? c.ProjectId) as string | null | undefined,
      serviceLevel: String(c.serviceLevel ?? c.ServiceLevel ?? ""),
      status: String(c.status ?? c.Status ?? ""),
      fee: Number(c.fee ?? c.Fee ?? 0),
      currency: String(c.currency ?? c.Currency ?? "PKR"),
      slaHours: Number(c.slaHours ?? c.SLAHours ?? 0),
      slaRemainingHours: Number(c.slaRemainingHours ?? c.SlaRemainingHours ?? 0),
      isSlaBreached: Boolean(c.isSlaBreached ?? c.IsSlaBreached),
      customerName: String(c.customerName ?? c.CustomerName ?? "Customer"),
      customerEmail: (c.customerEmail ?? c.CustomerEmail) as string | null | undefined,
      customerPhone: (c.customerPhone ?? c.CustomerPhone) as string | null | undefined,
      specialistName: String(c.specialistName ?? c.SpecialistName ?? "Unassigned"),
      isAssignedToMe: Boolean(c.isAssignedToMe ?? c.IsAssignedToMe),
      canSelfAssign: Boolean(c.canSelfAssign ?? c.CanSelfAssign),
      totalChecks: Number(c.totalChecks ?? c.TotalChecks ?? 0),
      passedChecks: Number(c.passedChecks ?? c.PassedChecks ?? 0),
      concernChecks: Number(c.concernChecks ?? c.ConcernChecks ?? 0),
      hasReport: Boolean(c.hasReport ?? c.HasReport),
      createdAtUtc: String(c.createdAtUtc ?? c.CreatedAtUtc ?? ""),
      assignedAtUtc: (c.assignedAtUtc ?? c.AssignedAtUtc) as string | null | undefined,
      completedAtUtc: (c.completedAtUtc ?? c.CompletedAtUtc) as string | null | undefined,
    })),
  };
}

export default function SpecialistCasesSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [scope, setScope] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (levelFilter !== "All") params.set("level", levelFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/verification/specialist/cases?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "Assigned cases require a Specialist account."
                : `Could not load cases (${res.status}).`)
        );
      }
      setData(parseCasesResponse((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load cases.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, statusFilter, levelFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to view assigned cases.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const takeCase = async (caseId: string) => {
    if (!data?.specialist.id) return;
    setBusyId(caseId);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          specialistId: data.specialist.id,
          assignmentNotes: "Self-assigned from Assigned Cases page",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `Assign failed (${res.status})`
        );
      }
      setActionMsg("Case assigned to you. Open the workbench to continue.");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not assign case");
    } finally {
      setBusyId(null);
    }
  };

  const cases = data?.cases ?? [];
  const summary = data?.summary;

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        Loading assigned cases…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-600" />
            Assigned & queue cases
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.specialist.fullName || "Specialist"} · {summary?.totalVisible ?? 0} visible
            {summary ? ` · showing ${summary.filteredCount}` : ""} · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/specialist"
            className="text-xs font-bold text-teal-700 hover:underline px-2 inline-flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3" />
            Workbench
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
            <p className="text-[10px] font-bold uppercase text-slate-400">Visible</p>
            <p className="text-xl font-black text-slate-900">{summary.totalVisible}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Queue</p>
            <p className="text-xl font-black text-amber-900">{summary.queueCount}</p>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-teal-700">Mine</p>
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">SLA breached</p>
            <p className="text-xl font-black text-rose-900">{summary.slaBreachedCount}</p>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">Any service tier</option>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {serviceLabel(l)}
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

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No cases in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cases appear when buyers request verification from the marketplace. Open-queue items can
            be taken here; assigned cases open in the workbench.
          </p>
          <Link
            href="/verification"
            className="inline-block text-xs font-bold text-teal-700 hover:underline"
          >
            Open verification marketplace →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  c.isSlaBreached
                    ? "border-rose-200 bg-rose-50/20"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        {c.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(c.status)}`}
                      >
                        {c.status}
                      </span>
                      {c.hasReport && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Report published
                        </span>
                      )}
                      {c.isSlaBreached && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          SLA breached
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{c.targetName}</h4>
                    <p className="text-xs text-slate-500">
                      {[c.targetArea, c.targetCity].filter(Boolean).join(", ")} ·{" "}
                      {serviceLabel(c.serviceLevel)} · {formatPkr(c.fee, c.currency)}
                    </p>
                    <p className="text-xs text-slate-600">
                      Buyer: {c.customerName}
                      {c.specialistName !== "Unassigned" ? ` · Specialist: ${c.specialistName}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Checks {c.passedChecks}/{c.totalChecks}
                      {c.concernChecks > 0 ? ` · ${c.concernChecks} concern` : ""} · SLA{" "}
                      {Math.round(c.slaRemainingHours)}h left of {c.slaHours}h · Requested{" "}
                      {formatDate(c.createdAtUtc)}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {c.customerPhone && (
                        <a
                          href={`tel:${c.customerPhone}`}
                          className="inline-flex items-center gap-1 hover:text-teal-700"
                        >
                          <Phone className="w-3 h-3" />
                          {c.customerPhone}
                        </a>
                      )}
                      {c.customerEmail && (
                        <a
                          href={`mailto:${c.customerEmail}`}
                          className="inline-flex items-center gap-1 hover:text-teal-700"
                        >
                          <Mail className="w-3 h-3" />
                          {c.customerEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {c.canSelfAssign && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void takeCase(c.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-2 rounded-xl"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Take case
                      </button>
                    )}
                    <Link
                      href={`/specialist?focusCaseId=${c.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-2 rounded-xl"
                    >
                      Open workbench
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
