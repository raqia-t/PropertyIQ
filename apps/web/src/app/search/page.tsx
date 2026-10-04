"use client";

import { Suspense, useState, useEffect } from "react";
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
  Filter,
  ArrowUpDown,
  Loader2,
  CheckCircle2
} from "lucide-react";

const allMockProperties = [
  {
    id: "1",
    title: "Brand New 1 Kanal Modern Designer House in DHA Phase 6",
    purpose: "Sale",
    propertyType: "House",
    city: "Lahore",
    area: "DHA Phase 6, Block L",
    price: "PKR 9.80 Crore",
    rawPrice: 98000000,
    size: "1 Kanal",
    beds: 5,
    baths: 6,
    verificationStatus: "Verified",
    qualityScore: 95,
    estimatedRent: "PKR 3.8 - 4.4 Lakh/mo",
    yield: "5.0%",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "2",
    title: "5 Marla Luxury Spanish Villa near Commercial Hub",
    purpose: "Sale",
    propertyType: "House",
    city: "Lahore",
    area: "Bahria Town, Sector C",
    price: "PKR 2.65 Crore",
    rawPrice: 26500000,
    size: "5 Marla",
    beds: 3,
    baths: 4,
    verificationStatus: "InReview",
    qualityScore: 88,
    estimatedRent: "PKR 95,000 - 1.1 Lakh/mo",
    yield: "4.8%",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "3",
    title: "5 Marla Prime Residential Plot in Skyline Meadows",
    purpose: "Sale",
    propertyType: "Plot",
    city: "Lahore",
    area: "Raiwind Road",
    price: "PKR 95 Lakh (Installment)",
    rawPrice: 9500000,
    size: "5 Marla",
    beds: null,
    baths: null,
    verificationStatus: "Verified",
    qualityScore: 92,
    estimatedRent: "N/A (Plot)",
    yield: "High Capital Growth",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "4",
    title: "Executive 2-Bed Luxury Apartment in Gulberg Greens",
    purpose: "Rent",
    propertyType: "Apartment",
    city: "Islamabad",
    area: "Gulberg Greens, Block A",
    price: "PKR 1.25 Lakh/mo",
    rawPrice: 125000,
    size: "1,450 Sq Ft",
    beds: 2,
    baths: 2,
    verificationStatus: "Verified",
    qualityScore: 94,
    estimatedRent: "PKR 1.25 Lakh/mo",
    yield: "7.2%",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
  }
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();

  const initialCity = searchParams.get("city") || "Lahore";
  const initialQuery = searchParams.get("q") || "";
  const initialPurposeParam = searchParams.get("purpose");
  const initialPurpose = initialPurposeParam === "2" ? "Rent" : "Sale";

  const [city, setCity] = useState(initialCity);
  const [nlQuery, setNlQuery] = useState(initialQuery);
  const [propertyType, setPropertyType] = useState("All");
  const [purpose, setPurpose] = useState(initialPurpose);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [properties, setProperties] = useState(allMockProperties);

  // Synchronize when query parameters change (e.g. from nav clicks)
  useEffect(() => {
    const qCity = searchParams.get("city") || "Lahore";
    const qQuery = searchParams.get("q") || "";
    const qPurpose = searchParams.get("purpose") === "2" ? "Rent" : "Sale";

    setCity(qCity);
    setNlQuery(qQuery);
    setPurpose(qPurpose);
    executeSearch(qCity, qQuery, qPurpose, propertyType);
  }, [searchParams]);

  const executeSearch = (
    targetCity: string,
    targetQuery: string,
    targetPurpose: string,
    targetType: string
  ) => {
    setIsSearching(true);

    setTimeout(() => {
      let filtered = allMockProperties;

      if (targetCity && targetCity !== "All") {
        filtered = filtered.filter(
          (p) => p.city.toLowerCase() === targetCity.toLowerCase()
        );
      }

      if (targetPurpose && targetPurpose !== "All") {
        filtered = filtered.filter(
          (p) => p.purpose.toLowerCase() === targetPurpose.toLowerCase()
        );
      }

      if (targetType && targetType !== "All") {
        filtered = filtered.filter(
          (p) => p.propertyType.toLowerCase() === targetType.toLowerCase()
        );
      }

      if (targetQuery && targetQuery.trim().length > 0) {
        const queryLower = targetQuery.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title.toLowerCase().includes(queryLower) ||
            p.area.toLowerCase().includes(queryLower) ||
            p.size.toLowerCase().includes(queryLower)
        );
      }

      // If strict filter yielded empty, fallback gracefully with relevant city listings
      if (filtered.length === 0) {
        filtered = allMockProperties.filter(
          (p) => p.city.toLowerCase() === targetCity.toLowerCase()
        );
        if (filtered.length === 0) filtered = allMockProperties;
      }

      setProperties(filtered);
      setIsSearching(false);
      stopLoading();
    }, 400);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startLoading(`Searching ${city} real estate...`);
    executeSearch(city, nlQuery, purpose, propertyType);
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    startLoading(`Filtering ${newCity} properties...`);
    executeSearch(newCity, nlQuery, purpose, propertyType);
  };

  const handlePurposeChange = (newPurpose: string) => {
    setPurpose(newPurpose);
    startLoading(`Filtering for ${newPurpose}...`);
    executeSearch(city, nlQuery, newPurpose, propertyType);
  };

  const handleTypeChange = (newType: string) => {
    setPropertyType(newType);
    startLoading(`Filtering ${newType}...`);
    executeSearch(city, nlQuery, purpose, newType);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Search & Filter Bar */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3"
      >
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 shrink-0 w-full md:w-auto">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <select
            value={city}
            disabled={isSearching}
            onChange={(e) => handleCityChange(e.target.value)}
            className="text-sm font-semibold bg-transparent focus:outline-none cursor-pointer w-full"
          >
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
            value={nlQuery}
            disabled={isSearching}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder="AI Search: '3 bed house in Lahore under 2.5 crore near park...'"
            className="w-full text-sm focus:outline-none text-slate-800 disabled:opacity-60"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={purpose}
            disabled={isSearching}
            onChange={(e) => handlePurposeChange(e.target.value)}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="Sale">For Sale</option>
            <option value="Rent">For Rent</option>
          </select>

          <select
            value={propertyType}
            disabled={isSearching}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="House">Houses</option>
            <option value="Plot">Plots</option>
            <option value="Apartment">Apartments</option>
            <option value="Commercial">Commercial</option>
          </select>

          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition shrink-0 disabled:opacity-60"
          >
            {isSearching ? (
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

      {/* AI Intent & Constraints Bar */}
      {nlQuery.length > 3 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-purple-950 flex items-center gap-1.5 mr-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Intent Extracted:</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
            📍 City: {city}
          </span>
          {nlQuery.toLowerCase().includes("crore") && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              💰 Budget: {nlQuery.toLowerCase().includes("3 crore") ? "Under PKR 3 Crore" : "Price Range Mapped"}
            </span>
          )}
          {nlQuery.toLowerCase().includes("marla") && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              📐 Size: {nlQuery.toLowerCase().includes("5 marla") ? "5 Marla" : "10 Marla"}
            </span>
          )}
          {(nlQuery.toLowerCase().includes("school") || nlQuery.toLowerCase().includes("hospital")) && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold">
              🏫 Lifestyle: Proximity to Schools & Healthcare
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-purple-200/70 text-purple-950 font-bold ml-auto">
            Confidence: 94%
          </span>
        </div>
      )}

      {/* Processing Loader Banner */}
      {isSearching && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-950 animate-pulse">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
            <span className="font-semibold">
              AI Real Estate Engine: Searching verified properties, calculating fair-value benchmarks & rental yields in {city}...
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Fetching Data
          </span>
        </div>
      )}

      {/* Main Grid: Listings */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {isSearching ? (
            <span className="flex items-center gap-2 text-emerald-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing market listings...</span>
            </span>
          ) : (
            <>
              Showing <span className="font-bold text-slate-900">{properties.length}</span> verified results in {city}
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort: Recommended</span>
        </div>
      </div>

      {/* Shimmer Skeleton Loaders while isSearching */}
      {isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-0 space-y-4 animate-pulse"
            >
              <div className="h-52 bg-slate-200 relative flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin opacity-50" />
              </div>
              <div className="p-5 space-y-3">
                <div className="h-6 bg-slate-200 rounded-md w-1/2" />
                <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                <div className="h-3 bg-slate-100 rounded-md w-1/3" />
                <div className="h-10 bg-slate-100 rounded-xl w-full" />
                <div className="h-8 bg-slate-200 rounded-xl w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => (
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
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 text-slate-800 shadow-sm">
                      {prop.size}
                    </span>
                    {prop.verificationStatus === "Verified" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <p className="text-xl font-extrabold text-slate-900">{prop.price}</p>
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">{prop.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{prop.area}, {prop.city}</span>
                    </p>
                  </div>

                  {prop.beds && (
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5 text-slate-400" />
                        {prop.beds} Beds
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-slate-400" />
                        {prop.baths} Baths
                      </span>
                      <span className="flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                        {prop.size}
                      </span>
                    </div>
                  )}

                  {/* AI Intelligence Snapshot */}
                  <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-purple-900 font-semibold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>AI Intelligence</span>
                      </span>
                      <span className="text-purple-700">{prop.yield} Yield</span>
                    </div>
                    <p className="text-purple-800/80">Est. Rent: <span className="font-medium text-purple-950">{prop.estimatedRent}</span></p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 pt-0">
                <Link
                  href={`/properties/${prop.id}`}
                  className="w-full block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl transition shadow-sm"
                >
                  View Full Intelligence Profile
                </Link>
              </div>
            </div>
          ))}
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
          <p className="font-semibold text-slate-700">Loading PropertyIQ Search Engine...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
