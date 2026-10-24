"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  Sparkles,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Calendar,
  Heart,
  CheckCircle,
  GraduationCap,
  Hospital,
  ShoppingBag,
  Send,
  Building,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Expand,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PropertyMapDisplay from "@/components/maps/PropertyMapDisplay";

interface PropertyMediaDto {
  id: string;
  url: string;
  mediaType: string;
  category: string;
  isPrimary: boolean;
  aiTags?: string | null;
}

interface PropertyDetailDto {
  id: string;
  title: string;
  description: string;
  aiDraftedDescription?: string | null;
  purpose: string;
  propertyType: string;
  status: string;
  price: number;
  currency: string;
  isNegotiable: boolean;
  expectedRentMin?: number | null;
  expectedRentMax?: number | null;
  province: string;
  city: string;
  area: string;
  subArea?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  privacyLevel?: string | null;
  showExactMap?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  landArea: number;
  landAreaUnit: string;
  coveredAreaSqFt?: number | null;
  parkingSpaces?: number | null;
  furnishing: string;
  constructionYear?: number | null;
  verificationStatus: string;
  listingQualityScore?: number | null;
  media: PropertyMediaDto[];
  agent?: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    role: string;
  } | null;
  createdAtUtc: string;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80";

function formatPkrAmount(amount: number): string {
  if (amount >= 10_000_000) return `PKR ${(amount / 10_000_000).toFixed(2)} Crore`;
  if (amount >= 100_000) return `PKR ${(amount / 100_000).toFixed(2)} Lakh`;
  return `PKR ${amount.toLocaleString()}`;
}

function formatPkrExact(amount: number, currency = "PKR"): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function humanizePropertyType(type: string): string {
  switch (type) {
    case "ApartmentFlat":
      return "Apartment";
    case "CommercialShop":
      return "Commercial Shop";
    case "RoomPortion":
      return "Room / Portion";
    case "AgriculturalLand":
      return "Agricultural Land";
    default:
      return type;
  }
}

function humanizeFurnishing(value: string): string {
  switch (value) {
    case "SemiFurnished":
      return "Semi-Furnished";
    case "FullyFurnished":
      return "Fully Furnished";
    case "Unfurnished":
      return "Unfurnished";
    default:
      return value;
  }
}

interface AiValuationView {
  fairPriceLow: string;
  fairPriceHigh: string;
  estimatedRent: string;
  grossYield: string;
  fiveYearScenario: string;
  confidence: string;
  assumptions: string[];
  valuationSource: string;
  explainSource: string;
  saleCompCount: number;
  rentCompCount: number;
  isLive: boolean;
}

/** Local fallback when scenario API is slow/down — same math, clearly labeled. */
function buildHeuristicValuation(property: PropertyDetailDto): AiValuationView {
  const price = Number(property.price) || 0;
  const fairLow = Math.round(price * 0.94);
  const fairHigh = Math.round(price * 1.05);
  const rentMin =
    property.expectedRentMin != null
      ? Number(property.expectedRentMin)
      : Math.round((price * 0.05) / 12);
  const rentMax =
    property.expectedRentMax != null
      ? Number(property.expectedRentMax)
      : Math.round(rentMin * 1.15);
  const midRent = (rentMin + rentMax) / 2;
  const grossYield = price > 0 ? ((midRent * 12) / price) * 100 : 0;
  const fiveYear = Math.round(price * Math.pow(1.11, 5));
  const fiveYearPct = price > 0 ? Math.round(((fiveYear - price) / price) * 100) : 0;

  return {
    fairPriceLow: formatPkrAmount(fairLow),
    fairPriceHigh: formatPkrAmount(fairHigh),
    estimatedRent: `${formatPkrAmount(rentMin)} - ${formatPkrAmount(rentMax)}/month`,
    grossYield: `${grossYield.toFixed(2)}%`,
    fiveYearScenario: `${formatPkrAmount(fiveYear)} (+${fiveYearPct}%)`,
    confidence: property.listingQualityScore
      ? `${Math.min(95, Math.max(60, property.listingQualityScore))}%`
      : "75%",
    assumptions: [
      `Local fallback for ${property.area}, ${property.city} (live scenario unavailable).`,
      "Assumes ~11% nominal annual corridor appreciation",
      "Rent uses listing expected rent when available, otherwise ~5% gross yield",
      "Excludes transfer fees, stamp duties, and agency commission",
    ],
    valuationSource: "local_fallback",
    explainSource: "none",
    saleCompCount: 0,
    rentCompCount: 0,
    isLive: false,
  };
}

function mapScenarioToValuation(
  property: PropertyDetailDto,
  result: {
    fairPriceLow: number;
    fairPriceHigh: number;
    estimatedRentMonthlyMin: number;
    estimatedRentMonthlyMax: number;
    grossYieldPercentage: number;
    futureValue5YrScenario: number;
    confidenceScore?: number;
    assumptions?: string[];
    disclaimer?: string;
    valuationSource?: string | null;
    explainSource?: string | null;
    saleCompCount?: number;
    rentCompCount?: number;
  },
  valuationHdr?: string | null,
  explainHdr?: string | null
): AiValuationView {
  const price = Number(property.price) || 0;
  const fiveYear = Number(result.futureValue5YrScenario) || 0;
  const fiveYearPct =
    price > 0 && fiveYear > 0 ? Math.round(((fiveYear - price) / price) * 100) : 0;
  const conf =
    typeof result.confidenceScore === "number" && result.confidenceScore > 0
      ? `${Math.round(Math.min(99, Math.max(40, result.confidenceScore * (result.confidenceScore <= 1 ? 100 : 1))))}%`
      : property.listingQualityScore
        ? `${Math.min(95, Math.max(60, property.listingQualityScore))}%`
        : "72%";

  const assumptions = [...(result.assumptions ?? [])];
  if (result.disclaimer && !assumptions.some((a) => a.includes(result.disclaimer!.slice(0, 40)))) {
    assumptions.push(result.disclaimer);
  }

  return {
    fairPriceLow: formatPkrAmount(Number(result.fairPriceLow) || 0),
    fairPriceHigh: formatPkrAmount(Number(result.fairPriceHigh) || 0),
    estimatedRent: `${formatPkrAmount(Number(result.estimatedRentMonthlyMin) || 0)} - ${formatPkrAmount(Number(result.estimatedRentMonthlyMax) || 0)}/month`,
    grossYield: `${Number(result.grossYieldPercentage || 0).toFixed(2)}%`,
    fiveYearScenario: `${formatPkrAmount(fiveYear)}${fiveYearPct ? ` (+${fiveYearPct}%)` : ""}`,
    confidence: conf,
    assumptions:
      assumptions.length > 0
        ? assumptions
        : [`Live scenario for ${property.area}, ${property.city}.`],
    valuationSource: valuationHdr || result.valuationSource || "hybrid_formula",
    explainSource: explainHdr || result.explainSource || "none",
    saleCompCount: result.saleCompCount ?? 0,
    rentCompCount: result.rentCompCount ?? 0,
    isLive: true,
  };
}

interface NeighborhoodPoiRow {
  name: string;
  type: string;
  distance: string;
  travelMinutes?: number;
  rating?: number;
}

interface NeighborhoodIntelState {
  loading: boolean;
  source: string | null;
  poiSource: string | null;
  summary: string | null;
  livabilityScore: number | null;
  pois: NeighborhoodPoiRow[];
  error: string | null;
}

function fallbackNeighborhoodPois(area: string, city: string): NeighborhoodPoiRow[] {
  return [
    { name: `Nearby schools around ${area}`, type: "School", distance: "Within 1–3 km" },
    { name: `Local hospital / clinic (${city})`, type: "Hospital", distance: "Within 3–5 km" },
    { name: `Commercial market near ${area}`, type: "Market", distance: "Within 1–2 km" },
    { name: `Community mosque / jamia`, type: "Mosque", distance: "Within 1 km" },
  ];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const { user, isAuthenticated, authFetch } = useAuth();

  const [property, setProperty] = useState<PropertyDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [neighborhoodIntel, setNeighborhoodIntel] = useState<NeighborhoodIntelState>({
    loading: false,
    source: null,
    poiSource: null,
    summary: null,
    livabilityScore: null,
    pois: [],
    error: null,
  });
  const [aiValuation, setAiValuation] = useState<AiValuationView | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState(
    "Hello, I am interested in this property. Please share further details and arrange a site visit."
  );
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryBusy, setInquiryBusy] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = isAuthenticated
          ? await authFetch(`/api/properties/${propertyId}`)
          : await fetch(`/api/properties/${propertyId}`);
        if (res.status === 404) {
          throw new Error("Property not found.");
        }
        if (!res.ok) {
          throw new Error(`Could not load property (${res.status}). Is the API running?`);
        }
        const data = (await res.json()) as PropertyDetailDto;
        if (cancelled) return;

        setProperty(data);
        setActiveIndex(0);

        if (user?.fullName) setInquiryName(user.fullName);
        if (user?.email) setInquiryEmail(user.email);
      } catch (e: unknown) {
        if (cancelled) return;
        setProperty(null);
        setError(e instanceof Error ? e.message : "Failed to load property.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, user?.email, user?.fullName, isAuthenticated, authFetch]);

  useEffect(() => {
    if (!propertyId || !property) return;

    let sessionKey = "";
    try {
      sessionKey = window.sessionStorage.getItem("piq_view_session") || "";
      if (!sessionKey) {
        sessionKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem("piq_view_session", sessionKey);
      }
    } catch {
      sessionKey = `s-${Date.now()}`;
    }

    void fetch(`/api/properties/${propertyId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    }).catch(() => {
      /* analytics should not block UX */
    });
  }, [propertyId, property?.id]);

  const images = useMemo(() => {
    if (!property) return [FALLBACK_IMAGE];
    const urls = (property.media || [])
      .slice()
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((m) => m.url)
      .filter(Boolean);
    return urls.length > 0 ? urls : [FALLBACK_IMAGE];
  }, [property]);

  // Live AI Property Intelligence Profile (comps + hybrid formula + optional Ollama explain).
  useEffect(() => {
    if (!property) return;

    let cancelled = false;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 90_000);

    // Show heuristic immediately so the card isn't blank while scenario runs.
    setAiValuation(buildHeuristicValuation(property));
    setScenarioLoading(true);
    setScenarioError(null);

    async function loadScenario() {
      try {
        const res = await fetch("/api/ai/property-scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          cache: "no-store",
          body: JSON.stringify({
            propertyId: property!.id,
            city: property!.city,
            area: property!.area,
            propertyType: property!.propertyType || "House",
            size: property!.landArea || 1,
            sizeUnit: property!.landAreaUnit || "Marla",
            askingPrice: property!.price,
            bedrooms: property!.bedrooms ?? null,
            purpose: property!.purpose === "Rent" ? "Rent" : "Sale",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message || `Scenario failed (${res.status}).`
          );
        }

        const valuationHdr =
          res.headers.get("X-PropertyIQ-Valuation") ||
          res.headers.get("x-propertyiq-valuation");
        const explainHdr =
          res.headers.get("X-PropertyIQ-Scenario-Explain") ||
          res.headers.get("x-propertyiq-scenario-explain");
        const result = await res.json();
        if (cancelled) return;

        setAiValuation(mapScenarioToValuation(property!, result, valuationHdr, explainHdr));
        setScenarioError(null);
      } catch (e: unknown) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) {
          if (!cancelled) {
            setScenarioError("Live valuation timed out — showing local estimate.");
          }
          return;
        }
        setScenarioError(
          e instanceof Error ? e.message : "Live valuation unavailable — showing local estimate."
        );
      } finally {
        if (!cancelled) setScenarioLoading(false);
      }
    }

    void loadScenario();
    return () => {
      cancelled = true;
      clearTimeout(abortTimer);
      controller.abort();
    };
  }, [property?.id, property?.price, property?.area, property?.city, scenarioRefreshKey]);

  // Live Neighborhood Daily Needs POIs (Nominatim / Places / seed via Intelligence API).
  useEffect(() => {
    if (!property?.city || !property?.area) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadNeighborhood() {
      setNeighborhoodIntel((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const params = new URLSearchParams({
          city: property!.city,
          area: property!.area,
        });
        // Use exact pin when publicly shown (or always when coords exist — improves POI radius).
        if (
          property!.latitude != null &&
          property!.longitude != null &&
          Number.isFinite(property!.latitude) &&
          Number.isFinite(property!.longitude)
        ) {
          params.set("lat", String(property!.latitude));
          params.set("lng", String(property!.longitude));
        }

        const res = await fetch(`/api/intelligence/neighborhood?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Neighborhood lookup failed (${res.status}).`);
        }

        const data = (await res.json()) as {
          signalSource?: string | null;
          poiSource?: string | null;
          aiSummary?: string | null;
          livabilityScore?: number;
          pointsOfInterest?: Array<{
            name: string;
            category: string;
            distanceKm: number;
            travelTimeMinutes: number;
            rating: number;
          }>;
        };

        if (cancelled) return;

        const pois: NeighborhoodPoiRow[] = (data.pointsOfInterest ?? []).map((p) => ({
          name: p.name,
          type: p.category || "Market",
          distance:
            typeof p.distanceKm === "number"
              ? `${p.distanceKm.toFixed(1)} km`
              : "Nearby",
          travelMinutes: p.travelTimeMinutes,
          rating: p.rating,
        }));

        setNeighborhoodIntel({
          loading: false,
          source: data.signalSource ?? null,
          poiSource: data.poiSource ?? null,
          summary: data.aiSummary ?? null,
          livabilityScore:
            typeof data.livabilityScore === "number" ? data.livabilityScore : null,
          pois:
            pois.length > 0
              ? pois
              : fallbackNeighborhoodPois(property!.area, property!.city),
          error: null,
        });
      } catch (e: unknown) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) return;
        setNeighborhoodIntel({
          loading: false,
          source: "curated_seed",
          poiSource: "fallback",
          summary: null,
          livabilityScore: null,
          pois: fallbackNeighborhoodPois(property!.area, property!.city),
          error: e instanceof Error ? e.message : "Could not load neighborhood POIs.",
        });
      }
    }

    void loadNeighborhood();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [property?.id, property?.city, property?.area, property?.latitude, property?.longitude]);

  const neighborhood = neighborhoodIntel.pois;

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
      }
      if (e.key === "ArrowRight") {
        setActiveIndex((prev) => (prev + 1) % images.length);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, images.length]);

  const goPrev = () =>
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % images.length);

  const handleSave = async () => {
    if (!property) return;
    if (!isAuthenticated) {
      setError("Sign in to save properties to your wishlist.");
      return;
    }
    setSaveBusy(true);
    try {
      const res = await authFetch(`/api/properties/${property.id}/save`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Could not save property.");
      }
      setIsSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save property.");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setInquiryError(null);
    setInquiryBusy(true);
    try {
      const res = await authFetch("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          propertyId: property.id,
          contactName: inquiryName.trim(),
          contactEmail: inquiryEmail.trim(),
          contactPhone: inquiryPhone.trim(),
          message: inquiryMessage.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Inquiry failed (${res.status}).`);
      }
      setInquirySubmitted(true);
    } catch (err: unknown) {
      setInquiryError(err instanceof Error ? err.message : "Failed to send inquiry.");
    } finally {
      setInquiryBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading property details…
      </div>
    );
  }

  if (error && !property) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-4">
        <div className="flex items-start gap-2 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Property unavailable</h1>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/agent" className="text-xs font-bold text-emerald-700 hover:underline">
            Back to Agent Dashboard
          </Link>
          <Link href="/search" className="text-xs font-bold text-slate-600 hover:underline">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!property) return null;

  // Prefer live scenario; fall back to local heuristic until fetch completes.
  const valuation = aiValuation ?? buildHeuristicValuation(property);

  const locationLine = [property.address, property.subArea, property.area, property.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search Results</span>
        </Link>
        <Link
          href="/agent"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Agent Dashboard
        </Link>
        {isAuthenticated &&
          user?.userId &&
          property.agent?.id === user.userId && (
            <Link
              href={`/properties/${property.id}/edit`}
              className="text-xs font-bold text-slate-700 hover:text-emerald-800 underline-offset-2 hover:underline"
            >
              Edit listing
            </Link>
          )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              For {property.purpose}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {humanizePropertyType(property.propertyType)}
            </span>
            {property.verificationStatus === "Verified" && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Property</span>
              </span>
            )}
            {property.verificationStatus !== "Verified" && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                {property.verificationStatus}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{property.title}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{locationLine}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-extrabold text-emerald-600">
              {formatPkrAmount(Number(property.price))}
            </p>
            <p className="text-xs text-slate-400">
              {formatPkrExact(Number(property.price), property.currency)}
              {property.isNegotiable ? " • Negotiable" : ""}
            </p>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saveBusy || isSaved}
            className={`p-3 rounded-xl border transition ${
              isSaved
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={isAuthenticated ? "Save to wishlist" : "Sign in to save"}
          >
            <Heart className={`w-5 h-5 ${isSaved ? "fill-red-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Zameen-style gallery: one large image + thumbnails underneath */}
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 h-[300px] sm:h-[440px] lg:h-[540px] group">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 z-0 cursor-zoom-in flex items-center justify-center bg-slate-100"
            aria-label="View full image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[activeIndex] || FALLBACK_IMAGE}
              alt={`${property.title} — photo ${activeIndex + 1}`}
              className="max-w-full max-h-full w-auto h-auto object-contain transition duration-300"
            />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-lg transition opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-lg transition opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 bg-black/65 hover:bg-black/80 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full transition"
          >
            <Expand className="w-3.5 h-3.5" />
            <span>View full image</span>
          </button>

          <div className="absolute bottom-3 right-3 z-10 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            {Math.min(activeIndex + 1, images.length)} / {images.length}
          </div>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {images.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                onDoubleClick={() => {
                  setActiveIndex(idx);
                  setLightboxOpen(true);
                }}
                className={`relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 rounded-lg overflow-hidden border-2 transition ${
                  activeIndex === idx
                    ? "border-emerald-600 ring-2 ring-emerald-500/30"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
                aria-label={`View photo ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Full image viewer"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <p className="text-xs sm:text-sm font-semibold truncate pr-4">
              {property.title}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/80">
                {activeIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Close full image"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center px-4 pb-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[activeIndex] || FALLBACK_IMAGE}
              alt={`${property.title} — full photo ${activeIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />

            {images.length > 1 && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div
              className="shrink-0 flex justify-center gap-2 px-4 pb-5 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={`lb-${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`shrink-0 w-14 h-12 rounded-md overflow-hidden border-2 transition ${
                    activeIndex === idx
                      ? "border-emerald-400"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Bed className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Bedrooms</p>
                <p className="text-sm font-bold text-slate-800">
                  {property.bedrooms != null ? `${property.bedrooms} Beds` : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Bathrooms</p>
                <p className="text-sm font-bold text-slate-800">
                  {property.bathrooms != null ? `${property.bathrooms} Baths` : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Land Area</p>
                <p className="text-sm font-bold text-slate-800">
                  {property.landArea} {property.landAreaUnit}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Built Year</p>
                <p className="text-sm font-bold text-slate-800">
                  {property.constructionYear ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-6 rounded-2xl border border-purple-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  {scenarioLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">AI Property Intelligence Profile</h3>
                  <p className="text-xs text-purple-700">
                    Confidence: {valuation.confidence}
                    {scenarioLoading ? " · refreshing live valuation…" : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                  {valuation.isLive
                    ? `via ${valuation.valuationSource}`
                    : "local estimate"}
                </span>
                {valuation.isLive && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                    {valuation.saleCompCount} sale / {valuation.rentCompCount} rent comps
                    {valuation.explainSource === "ollama" || valuation.explainSource === "ollama_explain"
                      ? " · ollama explain"
                      : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setScenarioRefreshKey((k) => k + 1)}
                  disabled={scenarioLoading}
                  className="text-[10px] font-bold text-purple-800 bg-white border border-purple-200 hover:bg-purple-50 disabled:opacity-50 px-2.5 py-1 rounded-full transition"
                >
                  Refresh
                </button>
              </div>
            </div>

            {scenarioError && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {scenarioError}
              </p>
            )}

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white/80 p-3.5 rounded-xl border border-purple-100">
              {property.aiDraftedDescription ||
                `${humanizePropertyType(property.propertyType)} in ${property.area}, ${property.city}. ${humanizeFurnishing(property.furnishing)}${
                  property.coveredAreaSqFt ? ` • ${property.coveredAreaSqFt} sq ft covered` : ""
                }.`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">Fair Market Price Range</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">
                  {valuation.fairPriceLow} - {valuation.fairPriceHigh}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {valuation.isLive
                    ? valuation.saleCompCount > 0
                      ? "From live inventory comps + asking"
                      : "Hybrid formula on asking + market band"
                    : "Local asking-price band"}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">Estimated Monthly Rent</p>
                <p className="text-base font-extrabold text-purple-700 mt-1">
                  {valuation.estimatedRent}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Gross Yield:{" "}
                  <span className="font-bold text-slate-800">{valuation.grossYield}</span>
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">5-Year Capital Scenario</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">
                  {valuation.fiveYearScenario}
                </p>
                <p className="text-xs text-emerald-600 mt-1">~11% p.a. compound corridor</p>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-700">
                {valuation.isLive ? "Scenario notes:" : "Model assumptions:"}
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {valuation.assumptions.map((asm, idx) => (
                  <li key={idx}>{asm}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Property Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {property.description}
            </p>
            {(property.parkingSpaces != null || property.coveredAreaSqFt != null) && (
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                {property.coveredAreaSqFt != null && (
                  <span>Covered area: {property.coveredAreaSqFt} sq ft. </span>
                )}
                {property.parkingSpaces != null && (
                  <span>Parking: {property.parkingSpaces}. </span>
                )}
                Furnishing: {humanizeFurnishing(property.furnishing)}.
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Location on map</h3>
            {property.showExactMap &&
            property.latitude != null &&
            property.longitude != null ? (
              <PropertyMapDisplay
                latitude={property.latitude}
                longitude={property.longitude}
                title={property.title}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  Exact pin not shown publicly
                </p>
                <p>
                  This listing is in{" "}
                  <span className="font-bold">
                    {property.area}, {property.city}
                  </span>
                  . The agent chose not to display the precise map location to customers. Contact
                  the agent to arrange a visit.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900">Neighborhood Daily Needs</h3>
              <div className="flex flex-wrap items-center gap-2">
                {neighborhoodIntel.livabilityScore != null && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Livability {neighborhoodIntel.livabilityScore}/100
                  </span>
                )}
                <span className="text-xs text-emerald-600 font-semibold">
                  {property.area}, {property.city}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              {neighborhoodIntel.loading
                ? "Loading nearby schools, clinics, markets, and parks…"
                : neighborhoodIntel.source === "live_pois"
                  ? `Live map amenities · ${neighborhoodIntel.poiSource || "map"}`
                  : neighborhoodIntel.source === "curated_seed"
                    ? "Area profile (live map scan unavailable — showing curated essentials)."
                    : "Nearby daily essentials for this catchment."}
            </p>
            {neighborhoodIntel.loading && neighborhood.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                Scanning neighborhood amenities…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {neighborhood.map((poi, idx) => (
                  <div
                    key={`${poi.name}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {poi.type === "School" && (
                        <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                      {poi.type === "Hospital" && (
                        <Hospital className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      {poi.type === "Market" && (
                        <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      {(poi.type === "Mosque" || poi.type === "Transport") && (
                        <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {(poi.type === "Park" ||
                        !["School", "Hospital", "Market", "Mosque", "Transport"].includes(
                          poi.type
                        )) && <MapPin className="w-4 h-4 text-slate-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{poi.name}</p>
                        <p className="text-[10px] text-slate-500">{poi.type}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-600 block">
                        {poi.distance}
                      </span>
                      {typeof poi.travelMinutes === "number" && (
                        <span className="text-[10px] text-slate-400">
                          ~{poi.travelMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {neighborhoodIntel.summary && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600 flex gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{neighborhoodIntel.summary}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-24">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Contact Listing Agent</h3>
              <p className="text-xs text-slate-500">
                {property.agent?.fullName ?? "Listing agent"}
                {property.agent?.phoneNumber ? ` • ${property.agent.phoneNumber}` : ""}
              </p>
              {property.agent?.email && (
                <p className="text-[11px] text-slate-400">{property.agent.email}</p>
              )}
            </div>

            {inquirySubmitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Inquiry Sent Successfully!</h4>
                <p className="text-xs text-emerald-700">
                  The listing agent has been notified. It will appear in their leads inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3">
                {inquiryError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {inquiryError}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="e.g. Tariq Mahmood"
                    className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    placeholder="e.g. buyer@example.com"
                    className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Message</label>
                  <textarea
                    rows={3}
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inquiryBusy}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-xs py-3 rounded-xl transition shadow"
                >
                  {inquiryBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Inquiry</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-slate-100">
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold">Need Peace of Mind?</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Request an independent on-site boundary inspection and title document review
                  before making a payment.
                </p>
                <Link
                  href="/verification"
                  className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition"
                >
                  Order Verification Report
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
