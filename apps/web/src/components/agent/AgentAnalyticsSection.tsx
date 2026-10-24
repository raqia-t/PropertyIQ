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
  status: string;
  verificationStatus: string;
  listingQualityScore: number;
  views: number;
  saves: number;
  inquiries: number;
  visits: number;
  viewToInquiryRate: number;
}

interface AgentAnalytics {
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

export default function AgentAnalyticsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/agent/analytics");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load analytics (${res.status}).`
        );
      }
      setData((await res.json()) as AgentAnalytics);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view performance analytics.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading performance analytics…
      </div>
    );
  }

  if (error) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Performance & Conversion
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live funnel from your listings — views, saves, inquiries, visits, and closed clients
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Views</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.totalViews.toLocaleString()}
          </span>
          <span className="text-slate-500 text-[11px]">
            {data.activeListingsCount} active listing
            {data.activeListingsCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Inquiries</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {data.totalInquiries}
          </span>
          <span className="text-emerald-600 text-[11px]">
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
          <h4 className="font-bold text-sm text-slate-900">Lead pipeline mix</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {breakdownEntries.map(([status, count]) => (
              <span
                key={status}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold"
              >
                {humanizeStatus(status)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-900">Per-listing breakdown</h4>
        {data.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            No listings yet.{" "}
            <Link href="/properties/new" className="text-emerald-700 font-bold hover:underline">
              Add a listing
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Listing</th>
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
                        className="font-semibold text-slate-900 hover:text-emerald-700"
                      >
                        {row.title}
                      </Link>
                      <p className="text-slate-500 mt-0.5">
                        {[row.area, row.city].filter(Boolean).join(", ")} ·{" "}
                        {humanizeStatus(row.verificationStatus)}
                      </p>
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
