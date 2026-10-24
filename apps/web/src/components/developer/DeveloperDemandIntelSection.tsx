"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface UnitDemandSignal {
  unitType: string;
  demandIndex: number;
  velocityUnitsPerMonth: number;
  averageClosingPrice: number;
  status: string;
  availableCount?: number;
  bookedOrSoldCount?: number;
  recentBookings?: number;
}

interface BudgetBracket {
  priceBracket: string;
  searcherPercentage: number;
  activeListingsCount: number;
}

interface DemandGap {
  city: string;
  area: string;
  propertyType: string;
  sizeCategory: string;
  monthlySearchVolume: number;
  activeSupplyCount: number;
  demandSupplyRatio: number;
  gapLevel: string;
  medianSearchBudget: number;
  recommendedAction: string;
  signalSource?: string | null;
  recommendationSource?: string | null;
  bookingsCount?: number;
  viewsCount?: number;
  inquiriesCount?: number;
}

interface NeighborhoodPoi {
  name: string;
  category: string;
  distanceKm: number;
  travelTimeMinutes: number;
  rating: number;
}

interface DemandIntelResponse {
  organization: { name: string; licenseNumber?: string | null };
  catchment: {
    city: string;
    area: string;
    projectCount: number;
    primaryProjectName?: string | null;
    primaryProjectSlug?: string | null;
  };
  cities: string[];
  areas: string[];
  dailyAiBriefing?: string | null;
  briefingSource?: string | null;
  pulse: {
    plotSearchSurgePct: number;
    surgeBasis?: string | null;
    bookingsThisMonth?: number;
    bookingsPrevMonth?: number;
    installmentConversionLift: number;
    diasporaInquirySharePct: number;
    diasporaBookingCount?: number;
    preferredInstallmentMonths: number;
    keyTakeaway: string;
    signalSource?: string | null;
  };
  firmSignals: {
    totalUnits: number;
    availableUnits: number;
    bookedOrSoldUnits: number;
    absorptionRatePct: number;
    bookingsThisMonth: number;
    totalActiveBookings: number;
    installmentBookingSharePct: number;
    inventoryByType: Array<{
      label: string;
      total: number;
      available: number;
      bookedOrSold: number;
      startingPrice: number;
    }>;
  };
  radar: {
    projectType: string;
    targetCity: string;
    preferredInstallmentDurationMonths: number;
    keyTakeaway: string;
    unitDemandSignals: UnitDemandSignal[];
    budgetDistribution: BudgetBracket[];
    signalSource?: string | null;
    totalUnitsAnalyzed?: number;
    bookingsAnalyzed?: number;
  };
  demandGaps: DemandGap[];
  neighborhood: {
    city: string;
    area: string;
    livabilityScore: number;
    overallVibe: string;
    securityRating: string;
    infrastructureQuality: string;
    ringRoadAccess: string;
    pointsOfInterest: NeighborhoodPoi[];
    commuteEstimatesMinutes: Record<string, number>;
    aiSummary: string;
    signalSource?: string | null;
    poiSource?: string | null;
  };
}

function formatPkr(amount: number): string {
  if (amount >= 10_000_000) return `PKR ${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `PKR ${(amount / 100_000).toFixed(1)} Lakh`;
  return `PKR ${Number(amount).toLocaleString()}`;
}

function gapBadgeClass(level: string): string {
  const key = level.toLowerCase();
  if (key.includes("high") || key.includes("lowsupply")) return "bg-rose-100 text-rose-800";
  if (key.includes("over")) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

export default function DeveloperDemandIntelSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<DemandIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("Auto");
  const [area, setArea] = useState("Auto");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (city !== "Auto") params.set("city", city);
      if (area !== "Auto") params.set("area", area);
      const qs = params.toString();
      const res = await authFetch(
        `/api/projects/developer/demand-intelligence${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view demand intelligence."
              : `Could not load demand intel (${res.status}).`)
        );
      }
      setData((await res.json()) as DemandIntelResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load demand intelligence.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, city, area]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view demand intelligence.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading demand intelligence…
      </div>
    );
  }

  const pulse = data?.pulse;
  const firm = data?.firmSignals;
  const radar = data?.radar;
  const gaps = data?.demandGaps ?? [];
  const neighborhood = data?.neighborhood;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            {data?.catchment.area || "Catchment"} demand pulse
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {data?.catchment.city || "—"} · market
            signals + firm inventory absorption
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/demand-intelligence"
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl hover:bg-amber-100"
          >
            Deep heatmap module
            <ExternalLink className="w-3.5 h-3.5" />
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

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setArea("Auto");
          }}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="Auto">
            Auto city{data?.catchment.city ? ` (${data.catchment.city})` : ""}
          </option>
          {(data?.cities ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="Auto">
            Auto area{data?.catchment.area ? ` (${data.catchment.area})` : ""}
          </option>
          {(data?.areas ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {data?.dailyAiBriefing && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 rounded-2xl shadow-md space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h4 className="font-bold text-xs text-amber-200">
              Developer daily brief — live firm signals
            </h4>
            {data.briefingSource && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-amber-100 border border-white/15">
                via {data.briefingSource}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-200 leading-relaxed max-w-4xl">
            {data.dailyAiBriefing}
          </p>
        </div>
      )}

      {pulse && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-slate-500">
              Pulse · {pulse.signalSource === "live_bookings" ? "live bookings" : pulse.signalSource || "pulse"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
              <span className="text-amber-800 font-bold block text-[11px] uppercase">
                Booking velocity MoM
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {pulse.plotSearchSurgePct >= 0 ? "+" : ""}
                {pulse.plotSearchSurgePct}%
              </span>
              <span className="text-slate-500 text-[11px]">
                {typeof pulse.bookingsThisMonth === "number" && typeof pulse.bookingsPrevMonth === "number"
                  ? `${pulse.bookingsThisMonth} MTD vs ${pulse.bookingsPrevMonth} prior · ${pulse.surgeBasis || "bookings"}`
                  : `Preferred plan ~${pulse.preferredInstallmentMonths} months`}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
              <span className="text-amber-800 font-bold block text-[11px] uppercase">
                Installment vs cash
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {pulse.installmentConversionLift}x
              </span>
              <span className="text-slate-500 text-[11px]">
                Multi-installment bookings ÷ cash-only
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center">
              <span className="text-amber-800 font-bold block text-[11px] uppercase">
                Diaspora share (heuristic)
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {pulse.diasporaInquirySharePct}%
              </span>
              <span className="text-slate-500 text-[11px]">
                {typeof pulse.diasporaBookingCount === "number"
                  ? `${pulse.diasporaBookingCount} bookings · intl phone / non-.pk email`
                  : "Intl phone / non-.pk email heuristics"}
              </span>
            </div>
          </div>
        </div>
      )}

      {pulse?.keyTakeaway && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-700 inline-flex gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <span className="font-bold text-slate-900">Key takeaway: </span>
            {pulse.keyTakeaway}
          </p>
        </div>
      )}

      {firm && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Your scheme absorption
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Units</p>
              <p className="text-xl font-black text-slate-900">{firm.totalUnits}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Available</p>
              <p className="text-xl font-black text-emerald-900">{firm.availableUnits}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-[10px] font-bold uppercase text-blue-700">Booked/Sold</p>
              <p className="text-xl font-black text-blue-900">{firm.bookedOrSoldUnits}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
              <p className="text-[10px] font-bold uppercase text-amber-700">Absorption</p>
              <p className="text-xl font-black text-amber-900">{firm.absorptionRatePct}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Bookings MTD</p>
              <p className="text-xl font-black text-slate-900">{firm.bookingsThisMonth}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Installment share</p>
              <p className="text-xl font-black text-slate-900">{firm.installmentBookingSharePct}%</p>
            </div>
          </div>

          {firm.inventoryByType.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2 font-bold">Inventory band</th>
                    <th className="px-3 py-2 font-bold">Available</th>
                    <th className="px-3 py-2 font-bold">Booked/Sold</th>
                    <th className="px-3 py-2 font-bold">From</th>
                  </tr>
                </thead>
                <tbody>
                  {firm.inventoryByType.map((row) => (
                    <tr key={row.label} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                      <td className="px-3 py-2 text-emerald-800">{row.available}</td>
                      <td className="px-3 py-2 text-slate-700">{row.bookedOrSold}</td>
                      <td className="px-3 py-2 text-slate-600">{formatPkr(row.startingPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {radar && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-900">
              Unit demand radar · {radar.targetCity}
            </h4>
            <span className="text-[10px] font-semibold text-slate-500">
              {radar.signalSource === "live_units"
                ? `Live · ${radar.totalUnitsAnalyzed ?? 0} units · ${radar.bookingsAnalyzed ?? 0} bookings/90d`
                : radar.signalSource || "radar"}
            </span>
          </div>
          {radar.unitDemandSignals.length === 0 ? (
            <p className="text-xs text-slate-500 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              No unit mix to chart yet — add inventory for this catchment.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {radar.unitDemandSignals.map((s) => (
                <div
                  key={s.unitType}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-slate-900">{s.unitType}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {s.status}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, s.demandIndex)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Index {s.demandIndex} · {s.velocityUnitsPerMonth}/mo ·{" "}
                    {s.availableCount ?? "—"} available · {s.recentBookings ?? 0} bookings
                    {s.averageClosingPrice > 0 ? ` · avg ${formatPkr(s.averageClosingPrice)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2 font-bold">Budget bracket</th>
                  <th className="px-3 py-2 font-bold">Mix %</th>
                  <th className="px-3 py-2 font-bold">Available stock</th>
                </tr>
              </thead>
              <tbody>
                {radar.budgetDistribution.map((b) => (
                  <tr key={b.priceBracket} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-800">{b.priceBracket}</td>
                    <td className="px-3 py-2 text-slate-700">{b.searcherPercentage}%</td>
                    <td className="px-3 py-2 text-slate-600">{b.activeListingsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-100">
              Mix % = share of recent booking prices (or available asking prices if few bookings).
            </p>
          </div>
        </div>
      )}

      {gaps.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-900">Demand–supply gaps</h4>
            <span className="text-[10px] font-semibold text-slate-500">
              Live from firm inventory + bookings
              {gaps[0]?.signalSource ? ` · ${gaps[0].signalSource}` : ""}
            </span>
          </div>
          <div className="space-y-2">
            {gaps.map((g) => (
              <div
                key={`${g.city}-${g.area}-${g.sizeCategory}-${g.propertyType}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-sm text-slate-900">
                    {g.area} · {g.sizeCategory} {g.propertyType}
                  </p>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${gapBadgeClass(g.gapLevel)}`}
                  >
                    {g.gapLevel}
                  </span>
                  {g.recommendationSource && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      tip via {g.recommendationSource}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {g.monthlySearchVolume.toLocaleString()} interest signals · {g.activeSupplyCount}{" "}
                  available · ratio {g.demandSupplyRatio}
                  {typeof g.bookingsCount === "number" ? ` · ${g.bookingsCount} bookings/90d` : ""}
                  {g.medianSearchBudget > 0
                    ? ` · median ${formatPkr(g.medianSearchBudget)}`
                    : ""}
                </p>
                <p className="text-xs text-slate-700">{g.recommendedAction}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          No live demand gaps yet for this catchment — add inventory units or bookings to generate
          segments.
        </div>
      )}

      {neighborhood && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              Neighborhood · {neighborhood.area}, {neighborhood.city}
            </h4>
            <span className="text-[10px] font-semibold text-slate-500">
              {neighborhood.signalSource === "live_pois"
                ? `Live POIs · ${neighborhood.poiSource || "map"}`
                : neighborhood.signalSource === "curated_seed"
                  ? "Curated seed (map unavailable)"
                  : neighborhood.poiSource || "neighborhood"}
            </span>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-black text-emerald-900">
                {neighborhood.livabilityScore}
              </span>
              <div>
                <p className="font-bold text-slate-900">Livability score</p>
                <p className="text-slate-600">{neighborhood.overallVibe}</p>
              </div>
            </div>
            <p className="text-slate-700">{neighborhood.aiSummary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
              <p>
                <span className="font-bold text-slate-800">Security: </span>
                {neighborhood.securityRating}
              </p>
              <p>
                <span className="font-bold text-slate-800">Infra: </span>
                {neighborhood.infrastructureQuality}
              </p>
              <p>
                <span className="font-bold text-slate-800">Ring Road: </span>
                {neighborhood.ringRoadAccess}
              </p>
            </div>
            {neighborhood.pointsOfInterest?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {neighborhood.pointsOfInterest.slice(0, 6).map((poi) => (
                  <div
                    key={poi.name}
                    className="rounded-xl bg-white border border-emerald-100 px-3 py-2 flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-800">{poi.name}</p>
                      <p className="text-slate-500">
                        {poi.category} · {poi.distanceKm} km · {poi.travelTimeMinutes} min · ★{" "}
                        {poi.rating}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
