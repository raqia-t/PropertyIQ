"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLoading } from "@/context/LoadingContext";
import {
  Search,
  Sparkles,
  ShieldCheck,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Heart,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatPkr, mediaUrl, pick } from "@/lib/apiHelpers";
import {
  API_TYPE_TO_UI,
  AiSearchIntent,
  UI_TYPE_TO_API,
  hasStructuredFilters,
  intentFromSearchParams,
  parseAiSearchOrHeuristic,
  purposeFromParam,
  purposeToNavParam,
  shouldSendRawQueryToApi,
} from "@/lib/aiSearch";

interface ListingCard {
  id: string;
  title: string;
  purpose: string;
  propertyType: string;
  city: string;
  area: string;
  price: number;
  currency: string;
  size: string;
  beds: number | null;
  baths: number | null;
  verificationStatus: string;
  qualityScore: number | null;
  image: string;
}

/** API binds PropertyPurpose by name or numeric value */
function purposeToApi(purpose: "Sale" | "Rent"): string {
  return purpose === "Rent" ? "Rent" : "Sale";
}

function formatSize(landArea: unknown, landAreaUnit: unknown, covered?: unknown): string {
  if (landArea != null && landArea !== "" && Number(landArea) > 0) {
    return `${landArea} ${landAreaUnit || ""}`.trim();
  }
  if (covered != null && Number(covered) > 0) {
    return `${Number(covered).toLocaleString("en-PK")} Sq Ft`;
  }
  return "—";
}

function mapListing(row: Record<string, unknown>): ListingCard {
  return {
    id: String(pick(row, "id", "Id") ?? ""),
    title: String(pick(row, "title", "Title") ?? "Property"),
    purpose: String(pick(row, "purpose", "Purpose") ?? "Sale"),
    propertyType: String(pick(row, "propertyType", "PropertyType") ?? ""),
    city: String(pick(row, "city", "City") ?? ""),
    area: String(pick(row, "area", "Area") ?? ""),
    price: Number(pick(row, "price", "Price") ?? 0),
    currency: String(pick(row, "currency", "Currency") ?? "PKR"),
    size: formatSize(
      pick(row, "landArea", "LandArea"),
      pick(row, "landAreaUnit", "LandAreaUnit"),
      pick(row, "coveredAreaSqFt", "CoveredAreaSqFt")
    ),
    beds: pick<number | null>(row, "bedrooms", "Bedrooms") ?? null,
    baths: pick<number | null>(row, "bathrooms", "Bathrooms") ?? null,
    verificationStatus: String(
      pick(row, "verificationStatus", "VerificationStatus") ?? "Unverified"
    ),
    qualityScore: pick<number | null>(row, "listingQualityScore", "ListingQualityScore") ?? null,
    image: mediaUrl(pick<string>(row, "primaryImageUrl", "PrimaryImageUrl")),
  };
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();
  const { isAuthenticated, authFetch } = useAuth();

  const purpose = purposeFromParam(searchParams.get("purpose"));
  const cityParam = searchParams.get("city");
  // Rent nav is /search?purpose=2 with no city — don't force Lahore or rentals look "broken"
  const city = cityParam || (purpose === "Rent" ? "All" : "Lahore");
  const nlQuery = searchParams.get("q") || "";
  const propertyTypeParam = searchParams.get("propertyType");
  const propertyTypeUi: string = propertyTypeParam
    ? API_TYPE_TO_UI[propertyTypeParam] ||
      (UI_TYPE_TO_API[propertyTypeParam] ? propertyTypeParam : "All")
    : "All";
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const bedrooms = searchParams.get("bedrooms");
  const area = searchParams.get("area");
  const landArea = searchParams.get("landArea");
  const landAreaUnit = searchParams.get("landAreaUnit");
  const aiFlag = searchParams.get("ai");
  const structured = hasStructuredFilters(searchParams);

  const [draftQuery, setDraftQuery] = useState(nlQuery);
  const [properties, setProperties] = useState<ListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiIntent, setAiIntent] = useState<AiSearchIntent | null>(() =>
    intentFromSearchParams(new URLSearchParams(searchParams.toString()))
  );
  const [matchMode, setMatchMode] = useState<"exact" | "relaxed" | null>(null);
  const [relaxedReason, setRelaxedReason] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  const updateParams = useCallback(
    (patch: Record<string, string | null | undefined>, replace = true) => {
      const params = new URLSearchParams(searchParams.toString());
      let changed = false;
      for (const [key, value] of Object.entries(patch)) {
        const next =
          value === null || value === undefined || value === "" || value === "All"
            ? null
            : value;
        const current = params.get(key);
        if (next === null) {
          if (current !== null) {
            params.delete(key);
            changed = true;
          }
        } else if (current !== next) {
          params.set(key, next);
          changed = true;
        }
      }
      if (!changed) return;
      const qs = params.toString();
      const href = qs ? `/search?${qs}` : "/search";
      if (replace) router.replace(href, { scroll: false });
      else router.push(href);
    },
    [router, searchParams]
  );

  useEffect(() => {
    setDraftQuery(nlQuery);
  }, [nlQuery]);

  // Restore chips when URL already carries structured AI filters
  useEffect(() => {
    if (structured || aiFlag === "1") {
      setAiIntent(intentFromSearchParams(new URLSearchParams(searchParams.toString())));
    }
  }, [queryKey, structured, aiFlag, searchParams]);

  // Home (or deep link) sent only ?q=… — parse once, then rewrite to structured URL
  useEffect(() => {
    const q = nlQuery.trim();
    if (!q || q.length <= 8 || structured || aiFlag === "1") return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsParsing(true);
      startLoading("Understanding query…");
      try {
        const preferredCity = city !== "All" ? city : "Lahore";
        const intent = await parseAiSearchOrHeuristic(q, preferredCity, controller.signal);
        if (cancelled) return;
        setAiIntent(intent);
        const nextType = intent.propertyType
          ? API_TYPE_TO_UI[intent.propertyType] || intent.propertyType
          : propertyTypeUi;
        const apiType = UI_TYPE_TO_API[nextType] || intent.propertyType || null;
        updateParams({
          city: intent.city && intent.city !== "All" ? intent.city : city === "All" ? null : city,
          q,
          purpose: purposeToNavParam(intent.purpose || purpose),
          propertyType: apiType,
          minPrice: intent.minPrice != null ? String(intent.minPrice) : null,
          maxPrice: intent.maxPrice != null ? String(intent.maxPrice) : null,
          bedrooms: intent.bedrooms != null ? String(intent.bedrooms) : null,
          area: intent.area || null,
          landArea: intent.landArea != null ? String(intent.landArea) : null,
          landAreaUnit: intent.landAreaUnit || null,
          ai: "1",
          page: "1",
        });
      } catch {
        if (!cancelled) {
          // Abort or unexpected — still avoid raw-q substring zero-hits
          setAiIntent({
            rawQuery: q,
            city: city !== "All" ? city : "Lahore",
            purpose,
            confidenceScore: 0.4,
            parserSource: "unavailable",
          });
          updateParams({
            city: city !== "All" ? city : "Lahore",
            q,
            purpose: purposeToNavParam(purpose),
            ai: "1",
            page: "1",
          });
        }
      } finally {
        if (!cancelled) {
          setIsParsing(false);
          stopLoading();
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlQuery, structured, aiFlag]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setIsSearching(true);
      setError(null);

      const params = new URLSearchParams();
      // Rent/Buy mode — always filter by purpose against live inventory
      params.set("purpose", purposeToApi(purpose));
      if (city && city !== "All") params.set("city", city);
      if (area) params.set("area", area);

      const apiType =
        UI_TYPE_TO_API[propertyTypeUi] ??
        (propertyTypeParam && propertyTypeParam !== "All" ? propertyTypeParam : undefined);
      if (apiType) params.set("propertyType", apiType);

      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (bedrooms) params.set("bedrooms", bedrooms);
      // Phase 7: land size filters for AI-parsed marla/kanal searches
      if (landArea) params.set("landArea", landArea);
      if (landAreaUnit) params.set("landAreaUnit", landAreaUnit);
      params.set("relax", "true");

      // Phase 6: when AI structured filters exist, do not send raw NL `q`
      // (substring match fights city/type/price filters).
      if (
        shouldSendRawQueryToApi({
          aiFlag,
          hasStructured: structured,
          q: nlQuery,
        })
      ) {
        params.set("q", nlQuery.trim());
      }

      params.set("page", String(page));
      params.set("pageSize", "24");

      try {
        const res = await fetch(`/api/properties?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to load listings (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const items = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
        // Defense: only show rows that match the active purpose (in case of loose API data)
        const purposeName = purposeToApi(purpose);
        const filtered = items.filter((row) => {
          const p = String(pick(row, "purpose", "Purpose") ?? "");
          return (
            p === purposeName ||
            p === purposeToNavParam(purpose) ||
            (purpose === "Rent" && p.toLowerCase() === "rent") ||
            (purpose === "Sale" && p.toLowerCase() === "sale")
          );
        });
        setProperties(filtered.map(mapListing));
        setTotal(Number(data.total ?? data.Total ?? filtered.length));
        const mode = String(data.matchMode ?? data.MatchMode ?? "exact").toLowerCase();
        setMatchMode(mode === "relaxed" ? "relaxed" : "exact");
        setRelaxedReason(
          (pick<string>(data, "relaxedReason", "RelaxedReason") as string | undefined) ?? null
        );
        setHasLoadedOnce(true);
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        setProperties([]);
        setTotal(0);
        setMatchMode(null);
        setRelaxedReason(null);
        setError(e instanceof Error ? e.message : "Could not load listings");
        setHasLoadedOnce(true);
      } finally {
        if (!cancelled) {
          setIsSearching(false);
          stopLoading();
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // queryKey captures all URL filter changes; avoid depending on unstable callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/properties/saved");
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as Record<string, unknown>[];
        if (cancelled) return;
        setSavedIds(
          new Set(
            (Array.isArray(rows) ? rows : []).map((r) => String(pick(r, "id", "Id") ?? ""))
          )
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const query = draftQuery.trim();
    let nextCity = city;
    let nextType = propertyTypeUi;
    let nextPurpose: "Sale" | "Rent" = purpose;
    let nextMin: string | null = minPrice;
    let nextMax: string | null = maxPrice;
    let nextBeds: string | null = bedrooms;
    let nextArea: string | null = area;
    let nextLandArea: string | null = landArea;
    let nextLandUnit: string | null = landAreaUnit;
    let markAi = aiFlag === "1" || structured;

    const preferredCity = city !== "All" ? city : "Lahore";

    // Natural-language query → ASP.NET bridge → FastAPI/Ollama → structured filters
    // (falls back to client heuristics if API/AI is down so raw `q` does not zero-out results)
    if (query.length > 8) {
      setIsParsing(true);
      startLoading("Understanding query…");
      try {
        const intent = await parseAiSearchOrHeuristic(query, preferredCity);
        setAiIntent(intent);
        markAi = true;
        if (intent.city) nextCity = intent.city;
        if (intent.area) nextArea = intent.area;
        if (intent.purpose) nextPurpose = intent.purpose;
        if (intent.propertyType) {
          nextType = API_TYPE_TO_UI[intent.propertyType] || intent.propertyType;
        }
        if (intent.minPrice != null) nextMin = String(intent.minPrice);
        if (intent.maxPrice != null) nextMax = String(intent.maxPrice);
        if (intent.bedrooms != null) nextBeds = String(intent.bedrooms);
        if (intent.landArea != null) nextLandArea = String(intent.landArea);
        if (intent.landAreaUnit) nextLandUnit = intent.landAreaUnit;
      } finally {
        setIsParsing(false);
        stopLoading();
      }
    } else {
      setAiIntent(null);
      markAi = false;
    }

    const apiType = UI_TYPE_TO_API[nextType];
    updateParams({
      city: nextCity === "All" ? null : nextCity,
      q: query || null,
      purpose: purposeToNavParam(nextPurpose),
      propertyType: apiType || (nextType !== "All" ? nextType : null),
      minPrice: nextMin,
      maxPrice: nextMax,
      bedrooms: nextBeds,
      area: nextArea,
      landArea: nextLandArea,
      landAreaUnit: nextLandUnit,
      ai: markAi ? "1" : null,
      page: "1",
    });
  };

  const clearAiFilters = () => {
    setAiIntent(null);
    updateParams({
      q: null,
      area: null,
      propertyType: null,
      minPrice: null,
      maxPrice: null,
      bedrooms: null,
      landArea: null,
      landAreaUnit: null,
      ai: null,
      page: "1",
      purpose: purposeToNavParam(purpose),
      city: city === "All" ? null : city,
    });
    setDraftQuery("");
  };

  const handleSaveToggle = async (id: string) => {
    if (!isAuthenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(`/search?${searchParams.toString()}`)}`);
      return;
    }
    setSavingId(id);
    try {
      const isSaved = savedIds.has(id);
      const res = await authFetch(`/api/properties/${id}/save`, {
        method: isSaved ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setSavingId(null);
    }
  };

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / 24)), [total]);
  const modeLabel = purpose === "Rent" ? "Rent" : "Buy";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            {modeLabel} · Live listings
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {purpose === "Rent" ? "Properties for Rent" : "Properties for Sale"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {purpose === "Rent"
              ? "Live rentals via GET /api/properties?purpose=Rent"
              : "Live sale listings via GET /api/properties?purpose=Sale"}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3"
      >
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 shrink-0 w-full md:w-auto">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <select
            value={city}
            onChange={(e) =>
              updateParams({
                city: e.target.value === "All" ? null : e.target.value,
                page: "1",
                purpose: purposeToNavParam(purpose),
              })
            }
            className="text-sm font-semibold bg-transparent focus:outline-none cursor-pointer w-full"
          >
            <option value="All">All Cities</option>
            <option value="Lahore">Lahore</option>
            <option value="Islamabad">Islamabad</option>
            <option value="Rawalpindi">Rawalpindi</option>
            <option value="Karachi">Karachi</option>
          </select>
        </div>

        <div className="flex-1 flex items-center border border-slate-200 rounded-xl px-3 py-2 w-full focus-within:ring-2 focus-within:ring-emerald-500 transition">
          <Sparkles className="w-4 h-4 text-purple-600 mr-2 shrink-0" />
          <input
            type="text"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder={
              purpose === "Rent"
                ? "Search rentals: '2 bed apartment in Islamabad under 1.5 lakh...'"
                : "Search or describe: '3 bed house in Lahore under 2.5 crore...'"
            }
            className="w-full text-sm focus:outline-none text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={purpose}
            onChange={(e) => {
              const next = e.target.value as "Sale" | "Rent";
              updateParams({
                purpose: purposeToNavParam(next),
                page: "1",
                // Switching to Rent: clear city so we query all rentals from API
                city: next === "Rent" ? null : city === "All" ? "Lahore" : city,
              });
            }}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="Sale">For Sale (Buy)</option>
            <option value="Rent">For Rent</option>
          </select>

          <select
            value={propertyTypeUi}
            onChange={(e) => {
              const ui = e.target.value;
              updateParams({
                propertyType: UI_TYPE_TO_API[ui] || null,
                page: "1",
                purpose: purposeToNavParam(purpose),
              });
            }}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="House">Houses</option>
            {purpose === "Sale" && <option value="Plot">Plots</option>}
            <option value="Apartment">Apartments</option>
            <option value="Commercial">Commercial</option>
          </select>

          <button
            type="submit"
            disabled={isSearching || isParsing}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition shrink-0 disabled:opacity-60"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Understanding…</span>
              </>
            ) : isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {isParsing && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-violet-950">
          <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin shrink-0" />
          <span className="font-semibold">Understanding query with PropertyIQ AI…</span>
        </div>
      )}

      {aiIntent && (nlQuery.length > 3 || (aiIntent.rawQuery?.length ?? 0) > 3) && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-purple-950 flex items-center gap-1.5 mr-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Understood:</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
            City: {aiIntent.city || city}
          </span>
          {aiIntent.purpose && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              {aiIntent.purpose === "Rent" ? "For Rent" : "For Sale"}
            </span>
          )}
          {aiIntent.area && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              Area: {aiIntent.area}
            </span>
          )}
          {aiIntent.propertyType && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              Type: {API_TYPE_TO_UI[aiIntent.propertyType] || aiIntent.propertyType}
            </span>
          )}
          {aiIntent.landArea != null && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              Size: {aiIntent.landArea} {aiIntent.landAreaUnit || ""}
            </span>
          )}
          {aiIntent.maxPrice != null && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              Max: {formatPkr(aiIntent.maxPrice)}
            </span>
          )}
          {aiIntent.bedrooms != null && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              Beds: {aiIntent.bedrooms}+
            </span>
          )}
          {(aiIntent.lifestylePreferences ?? []).slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold"
            >
              {tag}
            </span>
          ))}
          {aiIntent.parserSource && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
              via {aiIntent.parserSource}
            </span>
          )}
          {aiIntent.confidenceScore != null && (
            <span className="px-2.5 py-1 rounded-lg bg-purple-200/70 text-purple-950 font-bold">
              Confidence: {Math.round(aiIntent.confidenceScore * 100)}%
            </span>
          )}
          <button
            type="button"
            onClick={clearAiFilters}
            className="ml-auto text-[11px] font-semibold text-purple-800 hover:text-purple-950 underline-offset-2 hover:underline"
          >
            Clear AI filters
          </button>
        </div>
      )}

      {isSearching && hasLoadedOnce && !isParsing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-950">
          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
          <span className="font-semibold">Updating results…</span>
        </div>
      )}

      {!isSearching && matchMode === "relaxed" && properties.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-950">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Showing nearest matches</p>
            <p className="text-amber-800/90 mt-0.5">
              {relaxedReason ||
                "No exact listing matched every filter — results were widened so you still see useful options."}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load live listings</p>
            <p className="mt-1 text-rose-700">{error}. Is the API running on :5000?</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {isSearching ? (
            <span className="flex items-center gap-2 text-emerald-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Fetching listings…
            </span>
          ) : (
            <>
              Showing <span className="font-bold text-slate-900">{properties.length}</span>
              {total > properties.length ? (
                <>
                  {" "}
                  of <span className="font-bold text-slate-900">{total}</span>
                </>
              ) : null}{" "}
              {purpose === "Rent" ? "rental" : "sale"} results
              {city === "All" ? " across Pakistan" : ` in ${city}`}
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort: Newest</span>
        </div>
      </div>

      {isSearching && !hasLoadedOnce ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse"
            >
              <div className="h-52 bg-slate-200 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin opacity-50" />
              </div>
              <div className="p-5 space-y-3">
                <div className="h-6 bg-slate-200 rounded-md w-1/2" />
                <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                <div className="h-10 bg-slate-100 rounded-xl w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !error && properties.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {aiFlag === "1" || structured
              ? "No listings match what we understood"
              : purpose === "Rent"
                ? "No published rental listings from the API"
                : "No published sale listings match"}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {aiFlag === "1" || structured
              ? "Try clearing AI filters, widening the budget, or switching city. Structured filters are applied without the raw search phrase so results stay precise."
              : purpose === "Rent"
                ? "This page calls GET /api/properties?purpose=Rent. When agents publish Rent listings, they appear here automatically — no mock data."
                : "Try another city, clear the search text, or switch to Rent."}
          </p>
          {(aiFlag === "1" || structured) && (
            <button
              type="button"
              onClick={clearAiFilters}
              className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
            >
              Clear AI filters
            </button>
          )}
          {purpose === "Rent" && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => updateParams({ city: null, q: null, page: "1", purpose: "2" })}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                Clear filters
              </button>
              <Link
                href="/search?purpose=1"
                className="text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Browse Buy instead
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => {
            const verified = prop.verificationStatus.toLowerCase().includes("verif");
            const isSaved = savedIds.has(prop.id);
            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={prop.image}
                      alt={prop.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80";
                      }}
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 text-slate-800 shadow-sm">
                        {prop.size}
                      </span>
                      {verified && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveToggle(prop.id)}
                      disabled={savingId === prop.id}
                      className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition ${
                        isSaved
                          ? "bg-rose-600 text-white"
                          : "bg-white/90 text-rose-600 hover:bg-white"
                      }`}
                      title={isSaved ? "Remove from saved" : "Save property"}
                    >
                      {savingId === prop.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
                      )}
                    </button>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xl font-extrabold text-slate-900">
                        {formatPkr(prop.price)}
                        {prop.purpose === "Rent" ? (
                          <span className="text-sm font-semibold text-slate-500"> /mo</span>
                        ) : null}
                      </p>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mt-0.5">
                        {prop.title}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {[prop.area, prop.city].filter(Boolean).join(", ") || "Pakistan"}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600 border-t border-slate-100 pt-3 flex-wrap">
                      {prop.beds != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5 text-slate-400" />
                          {prop.beds} Beds
                        </span>
                      )}
                      {prop.baths != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-slate-400" />
                          {prop.baths} Baths
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                        {prop.size}
                      </span>
                      <span className="text-slate-400">{prop.propertyType}</span>
                    </div>

                    {prop.qualityScore != null && (
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs">
                        <div className="flex items-center justify-between text-emerald-900 font-semibold">
                          <span>Listing quality</span>
                          <span>{prop.qualityScore}/100</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-0">
                  <Link
                    href={`/properties/${prop.id}`}
                    className="w-full block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl transition shadow-sm"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isSearching && !error && total > 24 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
            className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600 font-semibold">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => updateParams({ page: String(page + 1) })}
            className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <p className="font-semibold text-slate-700">Loading PropertyIQ Search…</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
