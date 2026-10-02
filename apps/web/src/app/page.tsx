"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, ShieldCheck, Building2, MapPin, CheckCircle, ArrowRight, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("Lahore");

  const sampleSuggestions = [
    "5 marla house in Lahore under PKR 3 crore near good schools",
    "1 kanal modern house in DHA Phase 6 Lahore",
    "Plot with 3-year installment plan near Raiwind Road",
    "Apartment in Islamabad with high rental yield"
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-950 text-white pt-20 pb-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
        
        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next-Gen Real Estate Intelligence for Pakistan</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Find. Analyze. <span className="text-emerald-400">Verify.</span> <br />
            Make Confident Property Decisions.
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Not just property listings. PropertyIQ AI delivers fair-value context, rental yields, live project installment inventory, and verifiable due diligence across Pakistan.
          </p>

          {/* AI Search Box */}
          <div className="max-w-3xl mx-auto pt-4">
            <div className="bg-white rounded-2xl p-2 shadow-2xl flex flex-col md:flex-row items-center gap-2 border border-slate-200 text-slate-900">
              <div className="flex items-center gap-2 px-3 py-2 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-auto">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer"
                >
                  <option value="Lahore">Lahore</option>
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Karachi">Karachi</option>
                </select>
              </div>

              <div className="flex-1 flex items-center px-3 py-2 w-full">
                <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Describe in plain English: '5 marla house under 3 crore near hospital and schools...'"
                  className="w-full text-sm font-normal focus:outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <Link
                href={`/search?city=${selectedCity}&q=${encodeURIComponent(searchQuery)}`}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow-md"
              >
                <Search className="w-4 h-4" />
                <span>AI Search</span>
              </Link>
            </div>

            {/* Quick Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-slate-400">Try asking:</span>
              {sampleSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchQuery(suggestion)}
                  className="bg-white/10 hover:bg-white/20 text-slate-200 px-3 py-1 rounded-full border border-white/10 transition text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Built Specifically for Pakistan Real Estate</h2>
          <p className="mt-3 text-slate-600 text-sm">
            Solving the biggest issues of transparency, fake listings, complex payment schedules, and title uncertainty.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">AI Property Intelligence</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Every property includes fair price context, expected rental yields, 3/5/10-year appreciation scenarios, and neighborhood POIs.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Project Inventory Engine</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Direct access to developer projects, phase/block availability, live unit inventory statuses, and milestone installment schedules.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Verification Marketplace</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Paid on-demand due diligence: physical site inspection, document checklists, and checks against accessible authorities (PLRA, RDA, SBCA).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Demand Intelligence</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Aggregated, privacy-preserving search signals showing high-demand / low-supply corridors for agents and developers.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Projects with Installments */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Featured Housing Projects</h2>
            <p className="text-sm text-slate-500">Master-planned schemes with active installment plans</p>
          </div>
          <Link href="/projects" className="text-sm font-semibold text-emerald-600 flex items-center gap-1 hover:text-emerald-700">
            <span>View All Projects</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition">
            <div className="h-48 bg-gradient-to-r from-emerald-800 to-slate-800 p-6 flex flex-col justify-between text-white">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-emerald-500/80 rounded-full text-xs font-semibold backdrop-blur">
                  LDA Approved NOC
                </span>
                <span className="text-xs bg-black/40 px-2 py-1 rounded">Raiwind Road, Lahore</span>
              </div>
              <div>
                <h3 className="text-2xl font-extrabold">Skyline Meadows Lahore</h3>
                <p className="text-xs text-slate-300 mt-1">By Skyline Developers • 3-Year Flexible Quarterly Plan</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-500">Starting Price</p>
                  <p className="text-base font-bold text-slate-900">PKR 95 Lakh</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Booking</p>
                  <p className="text-base font-bold text-emerald-600">10%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Installments</p>
                  <p className="text-base font-bold text-slate-900">36 Months</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>5 & 10 Marla Residential Plots</span>
                </span>
                <span className="font-semibold text-emerald-700">Available: 42 Units</span>
              </div>

              <Link
                href="/projects/skyline-meadows-lahore"
                className="w-full block text-center bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm py-2.5 rounded-xl transition"
              >
                View Live Inventory & Schedule
              </Link>
            </div>
          </div>

          {/* Verification Callout Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-slate-50 to-white rounded-2xl border border-emerald-200 p-8 flex flex-col justify-between shadow-sm">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Independent Property Verification</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Found a property you like? Order a verified due diligence report before paying token money or committing to a purchase.
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Physical boundary & GPS location check by verified field agent</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Ownership document consistency check (Fard / Registry / Allotment)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Authority verification (LDA / RDA / CDA / SBCA NOCs where accessible)</span>
                </li>
              </ul>
            </div>

            <Link
              href="/verification"
              className="mt-6 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow"
            >
              <span>Explore Verification Tiers</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
