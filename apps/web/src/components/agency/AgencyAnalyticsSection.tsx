"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ListingAnalytics {
  propertyId: string;
  title: string;
  city: string;
  area: string;
  assignedBrokerId: string;
  assignedBrokerName: string;
  status: string;
  verificationStatus: string;
  listingQualityScore: number;
  views: number;
  saves: number;
  inquiries: number;
  visits: number;
  viewToInquiryRate: number;
}

interface BrokerAnalytics {
  userId: string;
  fullName: string;
  activeListingsCount: number;
  inquiries: number;
  visitsScheduled: number;
  clientsClosed: number;
}

interface AgencyAnalytics {
  organization: { id: string; name: string; city: string };
  activeBrokersCount: number;
  activeListingsCount: number;
  totalViews: number;
  totalSaves: number;
  totalInquiries: number;
  pendingInquiries: number;
  visitsScheduled: number;
  visitsCompleted: number;
  clientsClosed: number;
  avgListingQualityScore: number;
  viewToInquiryRate: number;
  inquiryToVisitRate: number;
  visitToCloseRate: number;
  inquiryStatusBreakdown: Record<string, number>;
  brokers: BrokerAnalytics[];
  listings: ListingAnalytics[];
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function humanizeStatus(status: string): string {
  if (status === "ViewingScheduled") return "Viewing Scheduled";
  if (status === "InReview") return "In Review";
  return status;
}

export default function AgencyAnalyticsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyAnalytics | null>(null);
  const [brokerOptions, setBrokerOptions] = useState<Array<{ userId: string; fullName: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState("All");

  const loadBrokers = useCallback(async () => {
    try {
      const res = await authFetch("/api/agency/brokers");
      if (!res.ok) return;
      const json = (await res.json()) as {
        brokers: Array<{ userId: string; fullName: string }>;
      };
      setBrokerOptions(
        (json.brokers ?? []).map((b) => ({ userId: b.userId, fullName: b.fullName }))
      );
    } catch {
      /* keep prior options */
    }
  }, [authFetch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (brokerFilter !== "All") params.set("brokerId", brokerFilter);
      const qs = params.toString();
      const res = await authFetch(`/api/agency/analytics${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load firm analytics (${res.status}).`)
        );
      }
      setData((await res.json()) as AgencyAnalytics);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load firm analytics.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, brokerFilter]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view firm analytics.");
      return;
    }
    void loadBrokers();
    void load();
  }, [isHydrated, isAuthenticated, loadBrokers, load]);

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading firm analytics…
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

  const breakdownEntries = Object.entries(data.inquiryStatusBreakdown || {}).filter(
    ([, n]) => n > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Firm Performance & Conversion
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live org funnel — views, saves, inquiries, visits, closed clients
            {data.organization?.name ? ` · ${data.organization.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={brokerFilter}
            onChange={(e) => setBrokerFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All brokers</option>
            {brokerOptions.map((b) => (
              <option key={b.userId} value={b.userId}>
                {b.fullName}
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
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Views</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.totalViews.toLocaleString()}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.activeListingsCount} active · {data.activeBrokersCount} broker
            {data.activeBrokersCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Inquiries</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.totalInquiries}
          </span>
          <span className="text-purple-700 text-[11px]">
            {pct(data.viewToInquiryRate)} view → inquiry
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Wishlist Saves</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{data.totalSaves}</span>
          <span className="text-slate-500 text-[11px]">
            {data.pendingInquiries} new lead{data.pendingInquiries === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Completeness</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {Math.round(data.avgListingQualityScore)}%
          </span>
          <span className="text-emerald-600 text-[11px]">Avg listing quality</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Visits scheduled</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.visitsScheduled}</p>
          <p className="text-slate-500 mt-1">{pct(data.inquiryToVisitRate)} inquiry → visit</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Visits completed</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.visitsCompleted}</p>
          <p className="text-slate-500 mt-1">{pct(data.visitToCloseRate)} visit → close</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <p className="text-[10px] font-bold uppercase text-slate-400">Clients closed</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.clientsClosed}</p>
          <p className="text-slate-500 mt-1">CRM Closed status</p>
        </div>
      </div>

      {breakdownEntries.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-slate-900">Firm lead pipeline mix</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {breakdownEntries.map(([status, count]) => (
              <span
                key={status}
                className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-800 font-semibold border border-purple-100"
              >
                {humanizeStatus(status)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {brokerFilter === "All" && data.brokers.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900">Broker leaderboard</h4>
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
                {[...data.brokers]
                  .sort((a, b) => b.inquiries - a.inquiries)
                  .map((b) => (
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

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-900">Per-listing breakdown</h4>
        {data.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            No firm listings yet.{" "}
            <Link href="/properties/new" className="text-purple-700 font-bold hover:underline">
              Add a listing
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Listing</th>
                  <th className="px-3 py-3 font-bold">Broker</th>
                  <th className="px-3 py-3 font-bold">Quality</th>
                  <th className="px-3 py-3 font-bold">Views</th>
                  <th className="px-3 py-3 font-bold">Saves</th>
                  <th className="px-3 py-3 font-bold">Inquiries</th>
                  <th className="px-3 py-3 font-bold">Visits</th>
                  <th className="px-3 py-3 font-bold">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map((row) => (
                  <tr key={row.propertyId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${row.propertyId}`}
                        className="font-semibold text-slate-900 hover:text-purple-700"
                      >
                        {row.title}
                      </Link>
                      <p className="text-slate-500 mt-0.5">
                        {[row.area, row.city].filter(Boolean).join(", ")} ·{" "}
                        {humanizeStatus(row.verificationStatus)}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700">
                      {row.assignedBrokerName}
                    </td>
                    <td className="px-3 py-3 font-bold text-emerald-700">
                      {row.listingQualityScore}%
                    </td>
                    <td className="px-3 py-3">{row.views}</td>
                    <td className="px-3 py-3">{row.saves}</td>
                    <td className="px-3 py-3">{row.inquiries}</td>
                    <td className="px-3 py-3">{row.visits}</td>
                    <td className="px-3 py-3 text-slate-600">{pct(row.viewToInquiryRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
