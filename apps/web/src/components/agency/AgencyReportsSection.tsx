"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ReportSummary {
  organization: { id: string; name: string; city: string };
  period: string;
  periodLabel: string;
  fromUtc?: string | null;
  toUtc: string;
  generatedAtUtc: string;
  activeBrokersCount: number;
  activeListingsCount: number;
  totalListingsCount: number;
  newListingsInPeriod: number;
  viewsInPeriod: number;
  inquiriesInPeriod: number;
  pendingInquiriesInPeriod: number;
  visitsScheduledInPeriod: number;
  visitsCompletedInPeriod: number;
  clientsClosedInPeriod: number;
  totalClientsCount: number;
  viewToInquiryRate: number;
  inquiryToVisitRate: number;
  visitToCloseRate: number;
  closedVolumeTracked: boolean;
  inquiryStatusBreakdown: Record<string, number>;
  topBrokers: Array<{
    userId: string;
    fullName: string;
    activeListingsCount: number;
    inquiries: number;
    visitsScheduled: number;
    clientsClosed: number;
  }>;
  topListings: Array<{
    propertyId: string;
    title: string;
    assignedBrokerName: string;
    views: number;
    inquiries: number;
    visits: number;
    viewToInquiryRate: number;
  }>;
}

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
] as const;

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AgencyReportsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [period, setPeriod] = useState<"month" | "quarter" | "all">("month");
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/agency/reports/summary?period=${period}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load report (${res.status}).`)
        );
      }
      setData((await res.json()) as ReportSummary);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load report summary.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, period]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view firm reports.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const downloadCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/agency/reports/export.csv?period=${period}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `CSV export failed (${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agency-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
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
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading firm report…
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

  const breakdown = Object.entries(data.inquiryStatusBreakdown || {}).filter(([, n]) => n > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Executive report — {data.periodLabel}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.organization.name} · Generated {formatWhen(data.generatedAtUtc)}
            {data.fromUtc ? ` · From ${formatWhen(data.fromUtc)}` : " · All-time activity"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "month" | "quarter" | "all")}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
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
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-3 py-2 rounded-xl transition"
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
        Closed deal volume and commission revenue are not tracked yet — this report uses live ops
        metrics only (listings, leads, visits, CRM closes).
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Views</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.viewsInPeriod.toLocaleString()}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.activeListingsCount} active listings
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Inquiries</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.inquiriesInPeriod}
          </span>
          <span className="text-purple-700 text-[11px]">
            {pct(data.viewToInquiryRate)} view → inquiry
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Visits</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.visitsScheduledInPeriod}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.visitsCompletedInPeriod} completed
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Closed clients</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {data.clientsClosedInPeriod}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.totalClientsCount} CRM contacts total
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Brokers</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.activeBrokersCount}</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">New listings</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.newListingsInPeriod}</p>
          <p className="text-slate-500 mt-1">{data.totalListingsCount} inventory total</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Pending leads</p>
          <p className="text-xl font-black text-amber-700 mt-1">{data.pendingInquiriesInPeriod}</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Closed volume</p>
          <p className="text-xl font-black text-slate-900 mt-1">—</p>
          <p className="text-slate-500 mt-1">Not tracked yet</p>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-slate-900">Inquiry mix (period)</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {breakdown.map(([status, count]) => (
              <span
                key={status}
                className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-800 font-semibold border border-purple-100"
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.topBrokers.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900">Broker performance (period)</h4>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Broker</th>
                  <th className="px-3 py-3 font-bold">Active listings</th>
                  <th className="px-3 py-3 font-bold">Inquiries</th>
                  <th className="px-3 py-3 font-bold">Visits sched.</th>
                  <th className="px-3 py-3 font-bold">Closed</th>
                </tr>
              </thead>
              <tbody>
                {data.topBrokers.map((b) => (
                  <tr key={b.userId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{b.fullName}</td>
                    <td className="px-3 py-3">{b.activeListingsCount}</td>
                    <td className="px-3 py-3 font-semibold text-purple-700">{b.inquiries}</td>
                    <td className="px-3 py-3">{b.visitsScheduled}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-700">{b.clientsClosed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.topListings.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900">Top listings (period)</h4>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Listing</th>
                  <th className="px-3 py-3 font-bold">Broker</th>
                  <th className="px-3 py-3 font-bold">Views</th>
                  <th className="px-3 py-3 font-bold">Inquiries</th>
                  <th className="px-3 py-3 font-bold">Visits</th>
                  <th className="px-3 py-3 font-bold">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {data.topListings.map((l) => (
                  <tr key={l.propertyId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${l.propertyId}`}
                        className="font-semibold text-slate-900 hover:text-purple-700"
                      >
                        {l.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{l.assignedBrokerName}</td>
                    <td className="px-3 py-3">{l.views}</td>
                    <td className="px-3 py-3 font-semibold text-purple-700">{l.inquiries}</td>
                    <td className="px-3 py-3">{l.visits}</td>
                    <td className="px-3 py-3">{pct(l.viewToInquiryRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
