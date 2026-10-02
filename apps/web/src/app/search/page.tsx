"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles, ShieldCheck, MapPin, Bed, Bath, Maximize2, Filter, ArrowUpDown } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialCity = searchParams.get("city") || "Lahore";
  const initialQuery = searchParams.get("q") || "";

  const [city, setCity] = useState(initialCity);
  const [nlQuery, setNlQuery] = useState(initialQuery);
  const [propertyType, setPropertyType] = useState("All");
  const [purpose, setPurpose] = useState("Sale");

  // Sample seed listings demonstrating Property Intelligence
  const mockProperties = [
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
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="text-sm font-semibold bg-transparent focus:outline-none"
          >
            <option value="Lahore">Lahore</option>
            <option value="Islamabad">Islamabad</option>
            <option value="Rawalpindi">Rawalpindi</option>
            <option value="Karachi">Karachi</option>
          </select>
        </div>

        <div className="flex-1 flex items-center border border-slate-200 rounded-xl px-3 py-2 w-full">
          <Sparkles className="w-4 h-4 text-purple-600 mr-2 shrink-0" />
          <input
            type="text"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder="AI Search: '3 bed house in Lahore under 2.5 crore near park...'"
            className="w-full text-sm focus:outline-none text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none"
          >
            <option value="Sale">For Sale</option>
            <option value="Rent">For Rent</option>
          </select>

          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-transparent focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="House">Houses</option>
            <option value="Plot">Plots</option>
            <option value="Apartment">Apartments</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Listings */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          Showing <span className="font-bold text-slate-900">{mockProperties.length}</span> verified results in {city}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort: Recommended</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProperties.map((prop) => (
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
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 text-slate-800 shadow">
                    {prop.size}
                  </span>
                  {prop.verificationStatus === "Verified" && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow">
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
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto p-12 text-center text-sm text-slate-500">Loading listings...</div>}>
      <SearchContent />
    </Suspense>
  );
}
