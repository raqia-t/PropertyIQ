"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  MapPin,
  Building2,
  ShieldCheck,
  Search,
  Sparkles,
  ArrowUpRight,
  Layers,
  GraduationCap,
  HeartPulse,
  ShoppingBag,
  Car,
  Trees,
  CheckCircle2,
  AlertCircle,
  Clock,
  Compass,
  DollarSign
} from "lucide-react";

interface DemandGap {
  city: string;
  area: string;
  propertyType: string;
  sizeCategory: string;
  searchVolume: number;
  activeSupply: number;
  ratio: number;
  gapLevel: "High" | "Balanced" | "Oversupplied";
  medianBudget: number;
  recommendation: string;
}

const mockDemandGaps: DemandGap[] = [
  {
    city: "Lahore",
    area: "Raiwind Road",
    propertyType: "Residential Plot",
    sizeCategory: "5 Marla",
    searchVolume: 4820,
    activeSupply: 58,
    ratio: 8.4,
    gapLevel: "High",
    medianBudget: 9500000,
    recommendation: "High buyer appetite for installment plans. Developers can launch 5-marla inventory with rapid 30-day absorption."
  },
  {
    city: "Lahore",
    area: "DHA Phase 6",
    propertyType: "Modern House",
    sizeCategory: "1 Kanal",
    searchVolume: 3210,
    activeSupply: 52,
    ratio: 6.2,
    gapLevel: "High",
    medianBudget: 95000000,
    recommendation: "Strong expatriate and executive demand for newly constructed modern bungalows with solar backup and imported finishes."
  },
  {
    city: "Lahore",
    area: "Gulberg III",
    propertyType: "Luxury Apartment",
    sizeCategory: "2-Bed Serviced",
    searchVolume: 2490,
    activeSupply: 52,
    ratio: 4.8,
    gapLevel: "Balanced",
    medianBudget: 18500000,
    recommendation: "Steady investor appetite for high-yield serviced apartments with rental management and rooftop amenities."
  },
  {
    city: "Islamabad",
    area: "Park Road / Zone 4",
    propertyType: "Residential Plot",
    sizeCategory: "10 Marla",
    searchVolume: 2150,
    activeSupply: 38,
    ratio: 5.7,
    gapLevel: "High",
    medianBudget: 22000000,
    recommendation: "CDA-approved master layouts attract premier capital. Buyers prioritize underground electrification and Margalla views."
  },
  {
    city: "Karachi",
    area: "Clifton Block 2",
    propertyType: "Apartment",
    sizeCategory: "3-Bed Sea View",
    searchVolume: 3890,
    activeSupply: 75,
    ratio: 5.2,
    gapLevel: "High",
    medianBudget: 28000000,
    recommendation: "Waterfront apartments with dual power backup and SBCA verification command top rental yields (7.5%+)."
  }
];

const mockNeighborhoods: Record<string, any> = {
  "DHA Phase 6, Lahore": {
    city: "Lahore",
    area: "DHA Phase 6",
    livabilityScore: 94,
    overallVibe: "Prestigious Master-Planned Executive Residential Sector",
    securityRating: "Gated & 24/7 DHA Security Patrols",
    infrastructure: "100% Underground Electrification, 50ft-150ft Carpeted Boulevards",
    ringRoadAccess: "2 minutes to DHA Phase 6 Ring Road Interchange",
    pois: [
      { name: "Lahore Grammar School (LGS Phase 6)", category: "School", dist: "0.8 km", time: "3 mins", rating: 4.9 },
      { name: "Beaconhouse Newlands Campus", category: "School", dist: "1.4 km", time: "5 mins", rating: 4.7 },
      { name: "National Hospital & Medical Center DHA", category: "Hospital", dist: "3.2 km", time: "8 mins", rating: 4.6 },
      { name: "Al-Fatah Supermarket (Block CCA)", category: "Market", dist: "0.5 km", time: "2 mins", rating: 4.9 },
      { name: "Phase 6 Central Jamia Mosque", category: "Mosque", dist: "0.4 km", time: "2 mins", rating: 5.0 },
      { name: "Sector L Community Family Park", category: "Park", dist: "0.2 km", time: "1 min", rating: 4.7 }
    ],
    commutes: [
      { to: "Lahore Airport (LHE)", time: "12 mins" },
      { to: "Gulberg Main Boulevard", time: "18 mins" },
      { to: "Mall Road / Old Lahore", time: "28 mins" },
      { to: "DHA Raya Golf & Country Club", time: "6 mins" }
    ],
    summary:
      "DHA Phase 6 represents Lahore’s gold standard for residential peace of mind. It features comprehensive underground civic utilities, premier private schooling within 5 minutes, direct Ring Road transit, and thriving commercial CCA sectors."
  },
  "Raiwind Road, Lahore": {
    city: "Lahore",
    area: "Raiwind Road",
    livabilityScore: 88,
    overallVibe: "Rapidly Expanding Residential Corridor with Master Housing Schemes",
    securityRating: "Gated Communities with Dedicated Surveillance",
    infrastructure: "Dual-Carriageway Raiwind Road with Southern Ring Road Connectivity",
    ringRoadAccess: "5 minutes to Adda Plot Interchange",
    pois: [
      { name: "The City School (Raiwind Campus)", category: "School", dist: "1.2 km", time: "4 mins", rating: 4.6 },
      { name: "Superior University & Medical College", category: "School", dist: "3.5 km", time: "7 mins", rating: 4.7 },
      { name: "Shaukat Khanum Extension Hospital", category: "Hospital", dist: "6.0 km", time: "12 mins", rating: 4.9 },
      { name: "Jalal Sons / Sector Retail Market", category: "Market", dist: "1.0 km", time: "3 mins", rating: 4.8 },
      { name: "Skyline Meadows Central Botanical Park", category: "Park", dist: "0.3 km", time: "1 min", rating: 4.6 }
    ],
    commutes: [
      { to: "Thokar Niaz Baig / Canal Road", time: "14 mins" },
      { to: "DHA Phase 5/6 (via Ring Road)", time: "20 mins" },
      { to: "Allama Iqbal Airport", time: "24 mins" },
      { to: "Johar Town / Emporium Mall", time: "16 mins" }
    ],
    summary:
      "Raiwind Road is Lahore’s fastest-growing residential corridor, combining affordable 5 and 10 Marla plots, modern gated housing schemes with LDA approvals, expanding university campuses, and frictionless southern Ring Road access."
  }
};

export default function DemandIntelligencePage() {
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [selectedNeighborhoodKey, setSelectedNeighborhoodKey] = useState<string>("DHA Phase 6, Lahore");

  const filteredGaps = mockDemandGaps.filter((g) => {
    if (selectedCity !== "All" && g.city.toLowerCase() !== selectedCity.toLowerCase()) return false;
    return true;
  });

  const activeNeighborhood = mockNeighborhoods[selectedNeighborhoodKey] || mockNeighborhoods["DHA Phase 6, Lahore"];

  const formatPkr = (val: number) => {
    if (val >= 10000000) return `PKR ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  const getPoiIcon = (category: string) => {
    switch (category) {
      case "School":
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case "Hospital":
        return <HeartPulse className="w-4 h-4 text-rose-600" />;
      case "Market":
        return <ShoppingBag className="w-4 h-4 text-amber-600" />;
      case "Park":
        return <Trees className="w-4 h-4 text-emerald-600" />;
      default:
        return <MapPin className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold uppercase tracking-wider mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>AI Demand Intelligence & Market Gaps</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Real Estate Market Signals & <br />
            <span className="text-emerald-400">Neighborhood Intelligence</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Synthesized from anonymous buyer search behavior, supply inventory velocity, and geospatial infrastructure data across Lahore, Islamabad, and Karachi.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Personal Data Exposure (Aggregated)
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <BarChart3 className="w-4 h-4 text-emerald-400" /> Real-time Demand vs Supply Ratios
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Compass className="w-4 h-4 text-emerald-400" /> 15-Minute City Commute Analytics
            </span>
          </div>
        </div>

        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* SECTION 1: DEMAND GAPS & UNDER-SUPPLIED SEGMENTS */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
              <span>High-Demand vs Low-Supply Opportunities</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Segments where search intent heavily outpaces active published inventory in Pakistan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Filter City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All Cities</option>
              <option value="Lahore">Lahore</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Karachi">Karachi</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGaps.map((gap, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">{gap.city} • {gap.area}</span>
                    <h3 className="text-lg font-black text-slate-900">
                      {gap.sizeCategory} {gap.propertyType}
                    </h3>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 shrink-0">
                    {gap.ratio}x Demand Ratio
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Monthly Searches</span>
                    <span className="font-extrabold text-slate-900 text-sm">{gap.searchVolume.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Active Supply</span>
                    <span className="font-extrabold text-slate-900 text-sm">{gap.activeSupply} Listings</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-200 pt-2">
                    <span className="text-slate-400 block text-[11px] font-medium">Median Search Budget</span>
                    <span className="font-black text-emerald-700 text-sm">{formatPkr(gap.medianBudget)}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-0.5">
                    Market Advisory
                  </span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">{gap.recommendation}</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Status: <strong className="text-rose-700">Undersupplied</strong></span>
                <Link
                  href={`/search?city=${gap.city}&area=${gap.area}`}
                  className="font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                >
                  <span>Explore Supply</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: DEVELOPER DEMAND RADAR & BUDGET DISTRIBUTION */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Off-Plan & Housing Scheme Analytics
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Buyer Budget Distribution & Inventory Velocity
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Revealing where buyer budgets concentrate and which plot sizes experience the fastest absorption.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Budget distribution bars */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Buyer Searcher Budget Concentration
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className="text-slate-800">PKR 75 Lakh - 1.25 Crore (Sweet Spot)</span>
                  <span className="text-emerald-700">42% of Buyers</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-emerald-600 h-3 rounded-full" style={{ width: "42%" }} />
                </div>
                <span className="text-[11px] text-slate-400">Undersupplied: Only 22 active listings/plots available</span>
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className="text-slate-800">Under PKR 75 Lakh (Affordable Plots)</span>
                  <span className="text-indigo-700">24.5% of Buyers</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-indigo-600 h-3 rounded-full" style={{ width: "24.5%" }} />
                </div>
                <span className="text-[11px] text-slate-400">High velocity: 8 active listings</span>
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className="text-slate-800">PKR 1.25 Crore - 2.5 Crore (Mid-Luxury)</span>
                  <span className="text-slate-700">21.5% of Buyers</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-slate-700 h-3 rounded-full" style={{ width: "21.5%" }} />
                </div>
                <span className="text-[11px] text-slate-400">Balanced market: 38 listings</span>
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className="text-slate-800">Above PKR 2.5 Crore (Executive 1 Kanal+)</span>
                  <span className="text-slate-500">12% of Buyers</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-slate-400 h-3 rounded-full" style={{ width: "12%" }} />
                </div>
                <span className="text-[11px] text-slate-400">Competitive supply: 45 listings</span>
              </div>
            </div>
          </div>

          {/* Unit Absorption Velocity */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Unit Velocity & Absorption Index
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">5 Marla Residential Plot</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">14.2 Units / Month Absorption</span>
                </div>
                <span className="font-mono text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                  95 / 100 Velocity
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Commercial Boulevard Shop</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">5.1 Units / Month Absorption</span>
                </div>
                <span className="font-mono text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                  82 / 100 Velocity
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">10 Marla Residential Plot</span>
                  <span className="text-[11px] text-slate-600">7.5 Units / Month Absorption</span>
                </div>
                <span className="font-mono text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md">
                  78 / 100 Velocity
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic pt-1">
              Key Takeaway: Over 66% of all active buyer demand seeks plots priced under PKR 1.25 Crore with 3-year flexible quarterly installment schedules.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: NEIGHBORHOOD LIVABILITY & POI INTELLIGENCE */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Hyper-Local Living Infrastructure
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Neighborhood Intelligence & POI Radar
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Schools, hospitals, supermarkets, parks, and Ring Road transit access times.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Sector:</span>
            {["DHA Phase 6, Lahore", "Raiwind Road, Lahore"].map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedNeighborhoodKey(sec)}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                  selectedNeighborhoodKey === sec
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Livability Score & Vibe Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                Livability Score: {activeNeighborhood.livabilityScore} / 100
              </span>
              <span className="text-xs font-semibold text-slate-600">
                • {activeNeighborhood.securityRating}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{activeNeighborhood.overallVibe}</h3>
            <p className="text-xs text-slate-600 mt-1">{activeNeighborhood.infrastructure}</p>
            <p className="text-xs font-semibold text-emerald-800 mt-2 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-emerald-600" />
              {activeNeighborhood.ringRoadAccess}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs shrink-0">
            {activeNeighborhood.commutes.map((c: any, i: number) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 block">{c.to}</span>
                <span className="font-extrabold text-slate-900 text-sm">{c.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* POI List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Nearby Daily Essentials & Key Landmarks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeNeighborhood.pois.map((poi: any, i: number) => (
              <div
                key={i}
                className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    {getPoiIcon(poi.category)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">{poi.name}</span>
                    <span className="text-[11px] text-slate-400">{poi.category}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{poi.time}</span>
                  <span className="text-[10px] text-slate-400">{poi.dist}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Synthesis Summary */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-slate-900 mb-0.5">AI Neighborhood Assessment</strong>
            <p className="text-slate-600 leading-relaxed">{activeNeighborhood.summary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
