"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface PublishedReport {
  id: string;
  caseId: string;
  version: number;
  summary: string;
  specialistNotes?: string | null;
  customerRecommendations?: string | null;
  limitations: string;
  publishedAtUtc: string;
  isImmutable: boolean;
  targetName: string;
  targetCity: string;
  targetArea: string;
  serviceLevel: string;
  caseStatus: string;
  customerName: string;
  totalChecks: number;
  passedChecks: number;
  concernChecks: number;
  uncheckedCount: number;
  isReviewedByMe: boolean;
}

interface PublishCandidate {
  caseId: string;
  targetName: string;
  targetCity: string;
  targetArea: string;
  serviceLevel: string;
  caseStatus: string;
  customerName: string;
  totalChecks: number;
  passedChecks: number;
  concernChecks: number;
  uncheckedCount: number;
  evidenceCount: number;
  readyToPublish: boolean;
}

interface ReportsResponse {
  specialist: { id: string; fullName: string; email: string };
  summary: {
    publishedReportsCount: number;
    casesReadyToPublish: number;
    publishCandidates: number;
    latestPublishedAtUtc?: string | null;
    filteredCount: number;
  };
  reports: PublishedReport[];
  publishCandidates: PublishCandidate[];
}

const SCOPE_OPTIONS = [
  { value: "published", label: "All published" },
  { value: "mine", label: "Signed by me" },
  { value: "recent", label: "Last 30 days" },
  { value: "all", label: "All visible" },
] as const;

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function serviceLabel(level: string): string {
  return level.replace(/([A-Z])/g, " $1").trim();
}

function parseReports(json: Record<string, unknown>): ReportsResponse {
  const specialist = (json.specialist ?? json.Specialist ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const reports = (json.reports ?? json.Reports ?? []) as Record<string, unknown>[];
  const candidates = (json.publishCandidates ?? json.PublishCandidates ?? []) as Record<
    string,
    unknown
  >[];

  return {
    specialist: {
      id: String(specialist.id ?? specialist.Id ?? ""),
      fullName: String(specialist.fullName ?? specialist.FullName ?? "Specialist"),
      email: String(specialist.email ?? specialist.Email ?? ""),
    },
    summary: {
      publishedReportsCount: Number(
        summary.publishedReportsCount ?? summary.PublishedReportsCount ?? 0
      ),
      casesReadyToPublish: Number(summary.casesReadyToPublish ?? summary.CasesReadyToPublish ?? 0),
      publishCandidates: Number(summary.publishCandidates ?? summary.PublishCandidates ?? 0),
      latestPublishedAtUtc: (summary.latestPublishedAtUtc ??
        summary.LatestPublishedAtUtc) as string | null | undefined,
      filteredCount: Number(summary.filteredCount ?? summary.FilteredCount ?? 0),
    },
    reports: reports.map((r) => ({
      id: String(r.id ?? r.Id ?? ""),
      caseId: String(r.caseId ?? r.CaseId ?? ""),
      version: Number(r.version ?? r.Version ?? 1),
      summary: String(r.summary ?? r.Summary ?? ""),
      specialistNotes: (r.specialistNotes ?? r.SpecialistNotes) as string | null | undefined,
      customerRecommendations: (r.customerRecommendations ?? r.CustomerRecommendations) as
        | string
        | null
        | undefined,
      limitations: String(r.limitations ?? r.Limitations ?? ""),
      publishedAtUtc: String(r.publishedAtUtc ?? r.PublishedAtUtc ?? ""),
      isImmutable: Boolean(r.isImmutable ?? r.IsImmutable ?? true),
      targetName: String(r.targetName ?? r.TargetName ?? "Target"),
      targetCity: String(r.targetCity ?? r.TargetCity ?? ""),
      targetArea: String(r.targetArea ?? r.TargetArea ?? ""),
      serviceLevel: String(r.serviceLevel ?? r.ServiceLevel ?? ""),
      caseStatus: String(r.caseStatus ?? r.CaseStatus ?? ""),
      customerName: String(r.customerName ?? r.CustomerName ?? "Customer"),
      totalChecks: Number(r.totalChecks ?? r.TotalChecks ?? 0),
      passedChecks: Number(r.passedChecks ?? r.PassedChecks ?? 0),
      concernChecks: Number(r.concernChecks ?? r.ConcernChecks ?? 0),
      uncheckedCount: Number(r.uncheckedCount ?? r.UncheckedCount ?? 0),
      isReviewedByMe: Boolean(r.isReviewedByMe ?? r.IsReviewedByMe),
    })),
    publishCandidates: candidates.map((c) => ({
      caseId: String(c.caseId ?? c.CaseId ?? ""),
      targetName: String(c.targetName ?? c.TargetName ?? "Target"),
      targetCity: String(c.targetCity ?? c.TargetCity ?? ""),
      targetArea: String(c.targetArea ?? c.TargetArea ?? ""),
      serviceLevel: String(c.serviceLevel ?? c.ServiceLevel ?? ""),
      caseStatus: String(c.caseStatus ?? c.CaseStatus ?? ""),
      customerName: String(c.customerName ?? c.CustomerName ?? "Customer"),
      totalChecks: Number(c.totalChecks ?? c.TotalChecks ?? 0),
      passedChecks: Number(c.passedChecks ?? c.PassedChecks ?? 0),
      concernChecks: Number(c.concernChecks ?? c.ConcernChecks ?? 0),
      uncheckedCount: Number(c.uncheckedCount ?? c.UncheckedCount ?? 0),
      evidenceCount: Number(c.evidenceCount ?? c.EvidenceCount ?? 0),
      readyToPublish: Boolean(c.readyToPublish ?? c.ReadyToPublish),
    })),
  };
}

export default function SpecialistReportsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [scope, setScope] = useState("published");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [publishNotes, setPublishNotes] = useState<Record<string, string>>({});

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
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/verification/specialist/reports?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "Reports require a Specialist account."
                : `Could not load reports (${res.status}).`)
        );
      }
      setData(parseReports((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to view published reports.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const publishReport = async (c: PublishCandidate) => {
    setBusyKey(`pub-${c.caseId}`);
    setActionMsg(null);
    try {
      const notes = publishNotes[c.caseId]?.trim() || "";
      const summary =
        notes ||
        `Verification complete for ${c.targetName}. Checks ${c.passedChecks}/${c.totalChecks} passed` +
          (c.concernChecks > 0 ? `; ${c.concernChecks} concern(s) flagged.` : ".");
      const res = await authFetch(`/api/verification/cases/${c.caseId}/generate-report`, {
        method: "POST",
        body: JSON.stringify({
          summary,
          specialistNotes: notes || `Published from Reports workspace by specialist.`,
          customerRecommendations:
            c.concernChecks > 0
              ? "Review flagged checklist concerns with qualified legal counsel before transaction."
              : "No severe concerns recorded at time of review; confirm final mutation with the relevant land authority.",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Publish failed");
      }
      const body = (await res.json()) as Record<string, unknown>;
      setActionMsg(
        `Published report v${body.version ?? body.Version ?? "?"} — case locked as Completed.`
      );
      setExpandedId(String(body.id ?? body.Id ?? ""));
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not publish report");
    } finally {
      setBusyKey(null);
    }
  };

  const reports = data?.reports ?? [];
  const candidates = data?.publishCandidates ?? [];
  const summary = data?.summary;

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        Loading published verification reports…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            Published immutable reports
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.specialist.fullName || "Specialist"} · signed due-diligence packs · live from
            Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/specialist/evidence"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            Evidence →
          </Link>
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
        Publishing finalizes the case as <span className="font-bold">Completed</span>, locks the
        report as immutable, and may mark the listing{" "}
        <span className="font-bold">Verified</span> when no checklist Concern remains.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Published</p>
            <p className="text-xl font-black text-emerald-900">{summary.publishedReportsCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Ready to publish</p>
            <p className="text-xl font-black text-amber-900">{summary.casesReadyToPublish}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Open candidates</p>
            <p className="text-xl font-black text-slate-900">{summary.publishCandidates}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Latest</p>
            <p className="text-sm font-black text-slate-900 mt-1">
              {formatDate(summary.latestPublishedAtUtc)}
            </p>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900">Publish queue</h4>
          {candidates.map((c) => (
            <div
              key={c.caseId}
              className="rounded-2xl border border-amber-200 bg-amber-50/20 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{c.targetName}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {c.caseStatus}
                    </span>
                    {c.readyToPublish ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Ready
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {c.uncheckedCount} unchecked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {[c.targetArea, c.targetCity].filter(Boolean).join(", ")} ·{" "}
                    {serviceLabel(c.serviceLevel)} · {c.customerName}
                  </p>
                  <p className="text-xs text-slate-600">
                    Checks {c.passedChecks}/{c.totalChecks}
                    {c.concernChecks > 0 ? ` · ${c.concernChecks} concern` : ""} · {c.evidenceCount}{" "}
                    evidence
                  </p>
                </div>
                <Link
                  href={`/specialist?focusCaseId=${c.caseId}`}
                  className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl shrink-0"
                >
                  Workbench
                </Link>
              </div>
              <textarea
                value={publishNotes[c.caseId] ?? ""}
                onChange={(e) =>
                  setPublishNotes((prev) => ({ ...prev, [c.caseId]: e.target.value }))
                }
                rows={2}
                placeholder="Optional summary / specialist notes for the published report…"
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-600"
              />
              <button
                type="button"
                disabled={busyKey === `pub-${c.caseId}` || !c.readyToPublish}
                onClick={() => void publishReport(c)}
                title={
                  c.readyToPublish
                    ? "Publish immutable report"
                    : "Complete all checklist items before publishing"
                }
                className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-4 py-2.5 rounded-xl"
              >
                {c.readyToPublish ? "Publish & lock report" : "Finish checklist first"}
              </button>
            </div>
          ))}
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
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target, summary…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No published reports yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Complete checklist work on an assigned case, then publish from the queue above. Reports
            are immutable once issued.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const open = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : r.id)}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-emerald-50/40"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{r.targetName}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        v{r.version} · Published &amp; Locked
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {[r.targetArea, r.targetCity].filter(Boolean).join(", ")} ·{" "}
                      {serviceLabel(r.serviceLevel)} · {r.customerName}
                    </p>
                    <p className="text-xs text-slate-600">
                      Checks {r.passedChecks}/{r.totalChecks}
                      {r.concernChecks > 0 ? ` · ${r.concernChecks} concern` : ""} ·{" "}
                      {formatDateTime(r.publishedAtUtc)}
                    </p>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {open && (
                  <div className="border-t border-emerald-100 bg-white p-4 space-y-4 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Summary</p>
                      <p className="text-slate-800 leading-relaxed">{r.summary || "—"}</p>
                    </div>
                    {r.specialistNotes && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Specialist notes
                        </p>
                        <p className="text-slate-700 leading-relaxed">{r.specialistNotes}</p>
                      </div>
                    )}
                    {r.customerRecommendations && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Customer recommendations
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                          {r.customerRecommendations}
                        </p>
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Limitations
                      </p>
                      <p className="text-slate-600 leading-relaxed">{r.limitations}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/specialist?focusCaseId=${r.caseId}`}
                        className="font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl"
                      >
                        Open case
                      </Link>
                      {r.isImmutable && (
                        <span className="inline-flex items-center gap-1 text-slate-500 px-2 py-2">
                          <Lock className="w-3.5 h-3.5" />
                          Immutable — edits disabled
                        </span>
                      )}
                    </div>
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
