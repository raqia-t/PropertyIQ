"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building,
  Users,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Briefcase,
  BarChart3,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyDashboard {
  organization: {
    id: string;
    name: string;
    city: string;
    licenseNumber: string | null;
    isVerified: boolean;
  };
  activeListingsCount: number;
  totalListingsCount: number;
  activeBrokersCount: number;
  monthlyLeadsCount: number;
  totalLeadsCount: number;
  pendingLeadsCount: number;
  closedVolumeTracked: boolean;
  dailyAiBriefing?: string | null;
  briefingSource?: string | null;
  weakListings?: Array<{
    propertyId: string;
    title: string;
    issue: string;
    recommendation: string;
    recommendationSource?: string | null;
    alertType?: string;
    assignedBrokerId?: string;
    assignedBrokerName?: string;
    city?: string;
    area?: string;
    propertyType?: string;
    landArea?: number;
    landAreaUnit?: string;
    askingPrice?: number;
    bedrooms?: number | null;
    listingQualityScore?: number;
    priority?: number;
  }>;
  brokers: Array<{
    userId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    activeListingsCount: number;
    totalListingsCount: number;
    assignedLeadsCount: number;
    pendingLeadsCount: number;
  }>;
  listings: Array<{
    id: string;
    title: string;
    assignedBrokerId: string;
    assignedBrokerName: string;
    price: number;
    currency: string;
    status: string;
    verificationStatus: string;
    leadsCount: number;
    createdAtUtc: string;
  }>;
}

interface ScenarioResult {
  estimatedRentMonthlyMin: number;
  estimatedRentMonthlyMax: number;
  grossYieldPercentage: number;
  fairPriceLow: number;
  fairPriceHigh: number;
  valuationSource?: string;
  saleCompCount?: number;
  rentCompCount?: number;
  explainSource?: string;
}

function formatPkrShort(n: number): string {
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(2)} L`;
  return `PKR ${Math.round(n).toLocaleString()}`;
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

function verificationBadgeClass(status: string): string {
  switch (status) {
    case "Verified":
      return "bg-emerald-100 text-emerald-800";
    case "InReview":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AgencyDashboardPage() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "team" | "listings">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AgencyDashboard | null>(null);
  const [scenarioBusyId, setScenarioBusyId] = useState<string | null>(null);
  const [scenarioById, setScenarioById] = useState<
    Record<string, { result?: ScenarioResult; error?: string; saved?: boolean }>
  >({});

  const runRentScenario = async (
    alert: NonNullable<AgencyDashboard["weakListings"]>[number]
  ) => {
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
        setData((prev) =>
          prev
            ? {
                ...prev,
                weakListings: (prev.weakListings ?? []).filter(
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
          error: e instanceof Error ? e.message : "Rent scenario failed.",
        },
      }));
    } finally {
      setScenarioBusyId(null);
    }
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/agency/dashboard");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Failed to load agency dashboard (${res.status})`);
      }
      const json = (await res.json()) as AgencyDashboard;
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load agency dashboard");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director (Agent account) to view firm data.");
      return;
    }
    void loadDashboard();
  }, [isHydrated, isAuthenticated, loadDashboard]);

  if (!isHydrated || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading agency dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="font-bold text-slate-900">Could not load firm dashboard</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { organization: org, brokers, listings } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800">
              Agency Enterprise Workspace
            </span>
            {org.licenseNumber && (
              <span className="text-xs font-semibold text-slate-500">
                License {org.licenseNumber}
              </span>
            )}
            {org.isVerified && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Verified firm
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {org.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live firm overview · {data.activeBrokersCount} active broker
            {data.activeBrokersCount === 1 ? "" : "s"} · {org.city}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Agency Listing</span>
          </Link>
          <Link
            href="/demand-intelligence"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span>Market Intelligence</span>
          </Link>
        </div>
      </div>

      {data.dailyAiBriefing && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white p-6 rounded-2xl shadow-md space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-300" />
            <h2 className="font-bold text-sm text-purple-200">
              Firm daily brief — from your live org data
            </h2>
            {data.briefingSource && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-purple-100 border border-white/15">
                via {data.briefingSource}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-4xl">
            {data.dailyAiBriefing}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Firm Listings</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {data.activeListingsCount}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {data.totalListingsCount} total in firm inventory
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Agents / Team</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {data.activeBrokersCount}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Linked to this organization</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Monthly Lead Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {data.monthlyLeadsCount}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">
            {data.pendingLeadsCount} new · {data.totalLeadsCount} all-time
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Closed Volume</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2">—</p>
          <p className="text-[11px] text-slate-500 font-medium">Deal tracking not enabled yet</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-amber-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Firm listing optimizer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Weak listings across brokers — photos, media mix, rent yield gaps
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {(data.weakListings ?? []).length} alert
            {(data.weakListings ?? []).length === 1 ? "" : "s"}
          </span>
        </div>

        {(data.weakListings ?? []).length === 0 && Object.keys(scenarioById).length === 0 ? (
          <p className="text-xs text-slate-500">
            No weak-listing alerts right now. Firm inventory looks healthy.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data.weakListings ?? []).map((alert) => {
              const busy = scenarioBusyId === alert.propertyId;
              const scenario = scenarioById[alert.propertyId];
              return (
                <div
                  key={`${alert.propertyId}-${alert.alertType || "alert"}`}
                  className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-xs text-slate-900">{alert.title}</h4>
                    {typeof alert.listingQualityScore === "number" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                        {alert.listingQualityScore}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Broker: {alert.assignedBrokerName || "Unassigned"}
                    {alert.alertType ? ` · ${alert.alertType}` : ""}
                  </p>
                  <p className="text-xs text-red-600 font-medium">⚠️ {alert.issue}</p>
                  <p className="text-xs text-slate-600">💡 {alert.recommendation}</p>
                  {alert.recommendationSource && (
                    <p className="text-[10px] text-slate-400">
                      tip via {alert.recommendationSource}
                    </p>
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
                    <Link
                      href={`/properties/${alert.propertyId}`}
                      className="inline-flex items-center text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Open listing →
                    </Link>
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
                      {scenario.saved && (
                        <p className="text-emerald-700 font-semibold">
                          Saved to listing expected rent.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === "overview"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Agency Operations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === "team"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Broker Team Roster ({brokers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("listings")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === "listings"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Firm Listings ({listings.length})</span>
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">Broker Team Performance</h3>
              <p className="text-xs text-slate-500">
                Live listing and lead counts for agents in {org.name}
              </p>
            </div>
          </div>

          {brokers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No brokers linked to this firm yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Broker</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Active Listings</th>
                    <th className="pb-3">Total Listings</th>
                    <th className="pb-3">Assigned Leads</th>
                    <th className="pb-3">Pending Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brokers.map((b) => (
                    <tr key={b.userId} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 font-bold text-slate-900">{b.fullName}</td>
                      <td className="py-3.5 text-slate-600">{b.email}</td>
                      <td className="py-3.5 font-semibold text-slate-800">{b.activeListingsCount}</td>
                      <td className="py-3.5 font-semibold text-slate-800">{b.totalListingsCount}</td>
                      <td className="py-3.5 font-semibold text-purple-700">{b.assignedLeadsCount}</td>
                      <td className="py-3.5 font-semibold text-amber-700">{b.pendingLeadsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "team" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {brokers.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-full text-center py-8">
              No brokers linked to this firm yet.
            </p>
          ) : (
            brokers.map((b) => (
              <div
                key={b.userId}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4"
              >
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">{b.fullName}</h4>
                  <p className="text-xs text-slate-500">{b.email}</p>
                  {b.phoneNumber && (
                    <p className="text-xs text-slate-500 mt-0.5">{b.phoneNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Active</span>
                    <span className="font-black text-slate-900 text-sm">{b.activeListingsCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Leads</span>
                    <span className="font-black text-purple-700 text-sm">{b.assignedLeadsCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pending</span>
                    <span className="font-black text-amber-700 text-sm">{b.pendingLeadsCount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "listings" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          {listings.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No firm listings yet.{" "}
              <Link href="/properties/new" className="text-purple-700 font-bold hover:underline">
                Add a listing
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Property Title</th>
                    <th className="pb-3">Assigned Broker</th>
                    <th className="pb-3">Price</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Leads</th>
                    <th className="pb-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listings.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 font-bold text-slate-900">
                        <Link href={`/properties/${l.id}`} className="hover:text-purple-700">
                          {l.title}
                        </Link>
                      </td>
                      <td className="py-3.5 text-slate-600">{l.assignedBrokerName}</td>
                      <td className="py-3.5 font-extrabold text-emerald-700">
                        {formatPkr(l.price, l.currency)}
                      </td>
                      <td className="py-3.5 text-slate-600">{l.status}</td>
                      <td className="py-3.5 font-semibold text-purple-700">{l.leadsCount}</td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${verificationBadgeClass(l.verificationStatus)}`}
                        >
                          {l.verificationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
