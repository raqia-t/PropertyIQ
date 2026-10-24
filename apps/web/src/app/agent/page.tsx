"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Eye,
  Heart,
  PlusCircle,
  AlertTriangle,
  Sparkles,
  Building,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface DashboardData {
  activeListingsCount: number;
  totalViews: number;
  totalSaves: number;
  totalLeads: number;
  pendingLeadsCount: number;
  dailyAiBriefing: string;
  briefingSource?: string | null;
  weakListings: Array<{
    propertyId: string;
    title: string;
    issue: string;
    recommendation: string;
    recommendationSource?: string | null;
    alertType?: string;
    city?: string;
    area?: string;
    propertyType?: string;
    landArea?: number;
    landAreaUnit?: string;
    askingPrice?: number;
    bedrooms?: number | null;
    priority?: number;
  }>;
}

interface ScenarioResult {
  fairPriceLow: number;
  fairPriceHigh: number;
  estimatedRentMonthlyMin: number;
  estimatedRentMonthlyMax: number;
  grossYieldPercentage: number;
  futureValue3YrScenario: number;
  futureValue5YrScenario: number;
  confidenceScore: number;
  disclaimer: string;
  valuationSource?: string | null;
  saleCompCount?: number;
  rentCompCount?: number;
  explainSource?: string | null;
}

function formatPkrShort(n: number): string {
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

interface AgentListing {
  id: string;
  title: string;
  city: string;
  area: string;
  price: number;
  currency: string;
  status: string;
  verificationStatus: string;
  listingQualityScore: number;
  mediaCount: number;
  createdAtUtc: string;
}

interface AgentLead {
  id: string;
  propertyTitle: string | null;
  projectName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  status: string;
  createdAtUtc: string;
}

function formatPkr(price: number, currency = "PKR"): string {
  if (price >= 10_000_000) {
    return `${currency} ${(price / 10_000_000).toFixed(2)} Crore`;
  }
  if (price >= 100_000) {
    return `${currency} ${(price / 100_000).toFixed(2)} Lakh`;
  }
  return `${currency} ${price.toLocaleString()}`;
}

function formatLeadDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AgentDashboardPage() {
  const { user, isHydrated, isAuthenticated, authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [scenarioBusyId, setScenarioBusyId] = useState<string | null>(null);
  const [scenarioById, setScenarioById] = useState<
    Record<string, { result?: ScenarioResult; error?: string; saved?: boolean }>
  >({});

  const runRentScenario = async (alert: DashboardData["weakListings"][number]) => {
    setScenarioBusyId(alert.propertyId);
    setScenarioById((prev) => {
      const next = { ...prev };
      delete next[alert.propertyId];
      return next;
    });
    try {
      const res = await authFetch("/api/ai/property-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: alert.propertyId,
          city: alert.city || "Lahore",
          area: alert.area || "DHA",
          propertyType: alert.propertyType || "House",
          size: alert.landArea || 1,
          sizeUnit: alert.landAreaUnit || "Marla",
          askingPrice: alert.askingPrice || 0,
          bedrooms: alert.bedrooms ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Scenario failed (${res.status}).`
        );
      }
      const result = (await res.json()) as ScenarioResult;

      const saveRes = await authFetch(`/api/properties/${alert.propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRentMin: result.estimatedRentMonthlyMin,
          expectedRentMax: result.estimatedRentMonthlyMax,
        }),
      });

      setScenarioById((prev) => ({
        ...prev,
        [alert.propertyId]: {
          result,
          saved: saveRes.ok,
          error: saveRes.ok ? undefined : "Scenario ready, but rent was not saved to listing.",
        },
      }));

      if (saveRes.ok) {
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                weakListings: prev.weakListings.filter(
                  (w) =>
                    !(w.propertyId === alert.propertyId && w.alertType === "RentScenario")
                ),
              }
            : prev
        );
      }
    } catch (e: unknown) {
      setScenarioById((prev) => ({
        ...prev,
        [alert.propertyId]: {
          error: e instanceof Error ? e.message : "Could not run rent scenario.",
        },
      }));
    } finally {
      setScenarioBusyId(null);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to load your dashboard.");
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [dashboardRes, listingsRes, leadsRes] = await Promise.all([
          authFetch("/api/agent/dashboard"),
          authFetch("/api/agent/listings"),
          authFetch("/api/inquiries/agent"),
        ]);

        if (!dashboardRes.ok) {
          throw new Error(
            dashboardRes.status === 401
              ? "Session expired — please sign in again."
              : `Dashboard API failed (${dashboardRes.status}). Is the API running on :5000?`
          );
        }

        const dashboardJson = (await dashboardRes.json()) as DashboardData;
        const listingsJson = listingsRes.ok
          ? ((await listingsRes.json()) as AgentListing[])
          : [];
        const leadsJson = leadsRes.ok
          ? ((await leadsRes.json()) as AgentLead[])
          : [];

        if (cancelled) return;

        setDashboard(dashboardJson);
        setListings(Array.isArray(listingsJson) ? listingsJson : []);
        setLeads(Array.isArray(leadsJson) ? leadsJson : []);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Could not load agent dashboard from the API.";
        setError(msg);
        setDashboard(null);
        setListings([]);
        setLeads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, isAuthenticated, authFetch]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-slate-500">Loading your agent dashboard…</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Agent Performance Dashboard</h1>
        <p className="text-sm text-red-600">{error ?? "No dashboard data available."}</p>
        <p className="text-xs text-slate-500">
          Make sure you are signed in as an agent and the API is running on port 5000.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Agent Performance Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Welcome back, {user?.fullName ?? "Agent"}
          </p>
        </div>

        <Link
          href="/properties/new"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add New Listing</span>
        </Link>
      </div>

      {/* AI Daily Briefing Banner */}
      <div
        id="brief"
        className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-2xl shadow-md space-y-3 scroll-mt-24"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-300" />
          <h2 className="font-bold text-sm text-emerald-200">
            Daily agent brief — from your live data
          </h2>
          {dashboard.briefingSource && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-100 border border-white/15">
              via {dashboard.briefingSource}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-4xl">
          {dashboard.dailyAiBriefing}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Listings</span>
            <Building className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {dashboard.activeListingsCount}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">From your live listings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Views</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {dashboard.totalViews}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">From listing detail views</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Buyer Saves</span>
            <Heart className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {dashboard.totalSaves}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Qualified wishlist saves</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Pending Leads</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
            {dashboard.pendingLeadsCount}
          </p>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            {dashboard.totalLeads} total leads
          </p>
        </div>
      </div>

      {/* Weak Listings Diagnostics */}
      <div
        id="optimizer"
        className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4 scroll-mt-24"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">Listing Optimization Suggestions</h3>
        </div>

        {dashboard.weakListings.length === 0 &&
        Object.keys(scenarioById).length === 0 ? (
          <p className="text-xs text-slate-500">
            No weak-listing alerts right now. Your published listings look healthy.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboard.weakListings.map((alert) => {
              const busy = scenarioBusyId === alert.propertyId;
              const scenario = scenarioById[alert.propertyId];
              return (
                <div
                  key={`${alert.propertyId}-${alert.alertType || "alert"}`}
                  className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2"
                >
                  <h4 className="font-bold text-xs text-slate-900">{alert.title}</h4>
                  <p className="text-xs text-red-600 font-medium">⚠️ {alert.issue}</p>
                  <p className="text-xs text-slate-600">💡 {alert.recommendation}</p>
                  {alert.recommendationSource && (
                    <p className="text-[10px] text-slate-400">tip via {alert.recommendationSource}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {alert.alertType === "RentScenario" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runRentScenario(alert)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Running AI…
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Generate rent scenario
                          </>
                        )}
                      </button>
                    )}
                    {(alert.alertType === "Photos" ||
                      alert.alertType === "MediaMix" ||
                      alert.alertType === "Completeness") && (
                      <Link
                        href={`/properties/${alert.propertyId}`}
                        className="inline-flex items-center text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        Open listing →
                      </Link>
                    )}
                  </div>
                  {scenario?.error && (
                    <p className="text-[11px] text-rose-700 font-semibold">{scenario.error}</p>
                  )}
                  {scenario?.result && (
                    <div className="text-[11px] text-slate-700 bg-white/80 border border-amber-100 rounded-lg p-2 space-y-1">
                      <p>
                        Rent est:{" "}
                        <span className="font-bold">
                          {formatPkrShort(scenario.result.estimatedRentMonthlyMin)} –{" "}
                          {formatPkrShort(scenario.result.estimatedRentMonthlyMax)}
                        </span>
                        /mo · Yield {scenario.result.grossYieldPercentage.toFixed(1)}%
                      </p>
                      <p>
                        Fair price: {formatPkrShort(scenario.result.fairPriceLow)} –{" "}
                        {formatPkrShort(scenario.result.fairPriceHigh)}
                      </p>
                      <p className="text-slate-500">
                        via {scenario.result.valuationSource || "formula"}
                        {scenario.result.saleCompCount != null
                          ? ` · ${scenario.result.saleCompCount} sale / ${scenario.result.rentCompCount ?? 0} rent comps`
                          : ""}
                        {scenario.result.explainSource === "ollama" ? " · ollama explain" : ""}
                      </p>
                      {scenario.saved && (
                        <p className="text-emerald-700 font-semibold">Saved to listing expected rent.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.entries(scenarioById)
              .filter(([id]) => !dashboard.weakListings.some((w) => w.propertyId === id))
              .map(([id, scenario]) =>
                scenario.result ? (
                  <div
                    key={`done-${id}`}
                    className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2 text-xs"
                  >
                    <p className="font-bold text-emerald-900">Rent scenario applied</p>
                    <p className="text-slate-700">
                      {formatPkrShort(scenario.result.estimatedRentMonthlyMin)} –{" "}
                      {formatPkrShort(scenario.result.estimatedRentMonthlyMax)} /mo
                    </p>
                  </div>
                ) : null
              )}
          </div>
        )}
      </div>

      {/* Recent Leads / Inquiries Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Customer Leads</h3>
            <p className="text-xs text-slate-500">Inquiries submitted by buyers & investors</p>
          </div>
          <Link
            href="/agent/leads"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full"
          >
            Open full inbox →
          </Link>
        </div>

        {leads.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No leads in the database yet. When buyers send inquiries on your listings, they will
            appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Target Property</th>
                  <th className="pb-3 font-semibold">Message</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition">
                    <td className="py-3">
                      <p className="font-bold text-slate-900">{lead.contactName}</p>
                      <p className="text-slate-500 text-[11px]">{lead.contactPhone}</p>
                    </td>
                    <td className="py-3 max-w-xs truncate text-slate-700 font-medium">
                      {lead.propertyTitle || lead.projectName || "—"}
                    </td>
                    <td className="py-3 max-w-xs truncate text-slate-500">{lead.message}</td>
                    <td className="py-3 text-slate-400">{formatLeadDate(lead.createdAtUtc)}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lead.status === "New"
                            ? "bg-amber-100 text-amber-800"
                            : lead.status === "Contacted"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Listings Management Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Your Property Listings</h3>
            <p className="text-xs text-slate-500">Manage pricing, media, and verification status</p>
          </div>
        </div>

        {listings.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            You have no listings yet. Use Add New Listing once that flow is wired to the API.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-semibold">Property Title</th>
                  <th className="pb-3 font-semibold">Price</th>
                  <th className="pb-3 font-semibold">Location</th>
                  <th className="pb-3 font-semibold">Media</th>
                  <th className="pb-3 font-semibold">Verification</th>
                  <th className="pb-3 font-semibold">Quality</th>
                  <th className="pb-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-bold text-slate-900 max-w-sm truncate">{l.title}</td>
                    <td className="py-3 font-extrabold text-emerald-600">
                      {formatPkr(l.price, l.currency)}
                    </td>
                    <td className="py-3 text-slate-600">
                      {l.area}, {l.city}
                    </td>
                    <td className="py-3 text-slate-600">{l.mediaCount} photos</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.verificationStatus === "Verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : l.verificationStatus === "InReview"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {l.verificationStatus}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-700">
                      {l.listingQualityScore}%
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/properties/${l.id}`}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        View Details
                      </Link>
                    </td>
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
