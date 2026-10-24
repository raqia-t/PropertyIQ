"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileBarChart2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
}

interface DeveloperReport {
  organization: { name: string; licenseNumber?: string | null; city?: string };
  period: string;
  periodLabel: string;
  fromUtc?: string | null;
  toUtc: string;
  generatedAtUtc: string;
  projects: ProjectOption[];
  collections: {
    totalCollected: number;
    outstandingAmount: number;
    overdueAmount: number;
    collectedInPeriod: number;
    scheduledTotal: number;
    recoveryRatePct: number;
    pendingProofCount: number;
    openInstallmentCount: number;
    overdueInstallmentCount: number;
    paidInstallmentCount: number;
    installmentStatusBreakdown: Record<string, number>;
  };
  inventory: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    bookedUnits: number;
    soldUnits: number;
    blockedUnits: number;
    totalValuation: number;
    bookedOrSoldValuation: number;
  };
  bookings: {
    activeCount: number;
    newInPeriod: number;
    confirmedCount: number;
    completedCount: number;
    pendingCount: number;
    totalAgreedValue: number;
  };
  regulatory: {
    projectCount: number;
    approvedCount: number;
    underProcessCount: number;
    unapprovedCount: number;
    withNocReference: number;
    schemes: Array<{
      id: string;
      name: string;
      slug: string;
      city: string;
      area: string;
      regulatoryAuthority?: string | null;
      approvalReferenceNumber?: string | null;
      approvalStatus: string;
      approvalDocumentUrl?: string | null;
    }>;
  };
  projectBreakdown: Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    area: string;
    regulatoryAuthority?: string | null;
    approvalReferenceNumber?: string | null;
    approvalStatus: string;
    totalUnits: number;
    availableUnits: number;
    bookedUnits: number;
    soldUnits: number;
    totalValuation: number;
    bookingCount: number;
    collected: number;
    outstanding: number;
    overdueCount: number;
  }>;
  recentAudits: Array<{
    id: string;
    entityName: string;
    entityId: string;
    action: string;
    reason?: string | null;
    createdAtUtc: string;
  }>;
}

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
] as const;

function formatPkr(amount: number): string {
  if (amount >= 10_000_000) return `PKR ${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `PKR ${(amount / 100_000).toFixed(2)} Lakh`;
  return `PKR ${Number(amount).toLocaleString()}`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function approvalBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("approved") && !s.includes("un")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("process")) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default function DeveloperReportsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [period, setPeriod] = useState<"month" | "quarter" | "all">("month");
  const [projectFilter, setProjectFilter] = useState("All");
  const [data, setData] = useState<DeveloperReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      const res = await authFetch(`/api/projects/developer/reports/summary?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view reports."
              : `Could not load report (${res.status}).`)
        );
      }
      setData((await res.json()) as DeveloperReport);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, period, projectFilter]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view reports.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const downloadCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      const res = await authFetch(`/api/projects/developer/reports/export.csv?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `CSV export failed (${res.status}).`
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `developer-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "CSV export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading collections & audit report…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const statusBreakdown = Object.entries(data.collections.installmentStatusBreakdown || {}).filter(
    ([, n]) => n > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-emerald-600" />
            Collections & regulatory report — {data.periodLabel}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.organization.name}
            {data.organization.licenseNumber ? ` · ${data.organization.licenseNumber}` : ""} ·
            Generated {formatWhen(data.generatedAtUtc)}
            {data.fromUtc ? ` · From ${formatWhen(data.fromUtc)}` : " · All-time"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
          >
            <option value="All">All projects</option>
            {(data.projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "month" | "quarter" | "all")}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-3 py-2 rounded-xl"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200">
          <span className="text-emerald-700 block text-[10px] uppercase font-bold">Collected</span>
          <span className="text-lg font-black text-emerald-950 mt-1 block">
            {formatPkr(data.collections.totalCollected)}
          </span>
          <span className="text-slate-500 text-[11px]">
            {formatPkr(data.collections.collectedInPeriod)} in period
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200">
          <span className="text-amber-700 block text-[10px] uppercase font-bold">Outstanding</span>
          <span className="text-lg font-black text-amber-950 mt-1 block">
            {formatPkr(data.collections.outstandingAmount)}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.collections.openInstallmentCount} open installments
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50/30 border border-rose-200">
          <span className="text-rose-700 block text-[10px] uppercase font-bold">Overdue</span>
          <span className="text-lg font-black text-rose-950 mt-1 block">
            {formatPkr(data.collections.overdueAmount)}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.collections.overdueInstallmentCount} items
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Recovery rate</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.collections.recoveryRatePct}%
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.collections.pendingProofCount} pending proofs
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-400">Units</p>
          <p className="text-xl font-black text-slate-900">{data.inventory.totalUnits}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Available</p>
          <p className="text-xl font-black text-emerald-900">{data.inventory.availableUnits}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
          <p className="text-[10px] font-bold uppercase text-blue-700">Booked</p>
          <p className="text-xl font-black text-blue-900">{data.inventory.bookedUnits}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-400">Sold</p>
          <p className="text-xl font-black text-slate-900">{data.inventory.soldUnits}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-700">New bookings</p>
          <p className="text-xl font-black text-amber-900">{data.bookings.newInPeriod}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-400">Inventory value</p>
          <p className="text-sm font-black text-slate-900 mt-1">
            {formatPkr(data.inventory.totalValuation)}
          </p>
        </div>
      </div>

      {statusBreakdown.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-slate-900">Installment status mix</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {statusBreakdown.map(([status, count]) => (
              <span
                key={status}
                className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-800 font-semibold border border-slate-200"
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Regulatory / LDA compliance
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Approved</p>
            <p className="text-xl font-black text-emerald-900">{data.regulatory.approvedCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Under process</p>
            <p className="text-xl font-black text-amber-900">{data.regulatory.underProcessCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">Unapproved</p>
            <p className="text-xl font-black text-rose-900">{data.regulatory.unapprovedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">With NOC ref</p>
            <p className="text-xl font-black text-slate-900">{data.regulatory.withNocReference}</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 font-bold">Scheme</th>
                <th className="px-3 py-2 font-bold">Authority</th>
                <th className="px-3 py-2 font-bold">NOC / Ref</th>
                <th className="px-3 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.regulatory.schemes.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/projects/${s.slug}`}
                      className="font-bold text-emerald-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="text-slate-500">
                      {s.city} · {s.area}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{s.regulatoryAuthority || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {s.approvalReferenceNumber || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${approvalBadgeClass(s.approvalStatus)}`}
                    >
                      {s.approvalStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-900">Project collections breakdown</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 font-bold">Project</th>
                <th className="px-3 py-2 font-bold">Units</th>
                <th className="px-3 py-2 font-bold">Bookings</th>
                <th className="px-3 py-2 font-bold">Collected</th>
                <th className="px-3 py-2 font-bold">Outstanding</th>
                <th className="px-3 py-2 font-bold">Overdue #</th>
              </tr>
            </thead>
            <tbody>
              {data.projectBreakdown.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {p.name}
                    <p className="font-normal text-slate-500">
                      {p.availableUnits} avail · {p.bookedUnits} booked · {p.soldUnits} sold
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{p.totalUnits}</td>
                  <td className="px-3 py-2 text-slate-700">{p.bookingCount}</td>
                  <td className="px-3 py-2 text-emerald-800 font-semibold">
                    {formatPkr(p.collected)}
                  </td>
                  <td className="px-3 py-2 text-amber-800">{formatPkr(p.outstanding)}</td>
                  <td className="px-3 py-2 text-rose-800 font-semibold">{p.overdueCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-900">Recent audit trail</h4>
        {data.recentAudits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            No payment / inventory audit events in this period yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2 font-bold">When</th>
                  <th className="px-3 py-2 font-bold">Action</th>
                  <th className="px-3 py-2 font-bold">Entity</th>
                  <th className="px-3 py-2 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAudits.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatWhen(a.createdAtUtc)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{a.action}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {a.entityName}
                      <span className="text-slate-400"> · {a.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-xs truncate">
                      {a.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/developer/installments" className="font-bold text-emerald-700 hover:underline">
          Open installments →
        </Link>
        <Link href="/developer/inventory" className="font-bold text-emerald-700 hover:underline">
          Inventory audit →
        </Link>
        <Link href="/developer/noc" className="font-bold text-emerald-700 hover:underline">
          NOC center →
        </Link>
      </div>
    </div>
  );
}
