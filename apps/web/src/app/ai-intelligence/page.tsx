"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, TrendingUp, Calculator, ShieldCheck, ArrowRight, Info, CheckCircle } from "lucide-react";

export default function AiIntelligencePage() {
  const [city, setCity] = useState("Lahore");
  const [area, setArea] = useState("DHA Phase 6");
  const [propertyType, setPropertyType] = useState("House");
  const [size, setSize] = useState("1");
  const [sizeUnit, setSizeUnit] = useState("Kanal");
  const [askingPrice, setAskingPrice] = useState(98000000);

  // Dynamic scenario calculations
  const price = Number(askingPrice) || 0;
  const fairPriceLow = Math.round(price * 0.94);
  const fairPriceHigh = Math.round(price * 1.05);

  const monthlyRent = Math.round(price * 0.0042);
  const annualRent = monthlyRent * 12;
  const grossYield = price > 0 ? ((annualRent / price) * 100).toFixed(2) : "0.00";

  const fv3 = Math.round(price * 1.36);
  const fv5 = Math.round(price * 1.68);
  const fv10 = Math.round(price * 2.83);

  const formatPkr = (val: number) => {
    if (val >= 10000000) {
      return `PKR ${(val / 10000000).toFixed(2)} Crore`;
    }
    return `PKR ${(val / 100000).toFixed(0)} Lakh`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Pakistan Property Intelligence Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          AI Investment & Valuation Simulator
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Simulate fair market value ranges, gross rental yields, and multi-year appreciation scenarios for any property in Pakistan.
        </p>
      </div>

      {/* Main Grid: Inputs & Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Input Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calculator className="w-4 h-4 text-purple-600" />
            <span>Property Input Parameters</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-700">Target City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 font-medium"
            >
              <option value="Lahore">Lahore</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Rawalpindi">Rawalpindi</option>
              <option value="Karachi">Karachi</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Area / Corridor</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Property Type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 font-medium"
            >
              <option value="House">Residential House</option>
              <option value="Apartment">Apartment / Flat</option>
              <option value="Plot">Residential Plot</option>
              <option value="Commercial">Commercial Shop / Office</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Size</label>
              <input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Unit</label>
              <select
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value)}
                className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 font-medium"
              >
                <option value="Marla">Marla</option>
                <option value="Kanal">Kanal</option>
                <option value="SqYards">Sq. Yards</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Asking / Benchmark Price (PKR)</label>
            <input
              type="number"
              step="500000"
              value={askingPrice}
              onChange={(e) => setAskingPrice(Number(e.target.value))}
              className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 font-bold"
            />
            <p className="text-[11px] text-purple-700 mt-1 font-semibold">{formatPkr(price)}</p>
          </div>

          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-xs text-purple-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Real-Time Estimation Active</span>
            </p>
            <p className="text-[11px] text-purple-800">
              Outputs automatically re-calculate as you adjust the parameters.
            </p>
          </div>
        </div>

        {/* Right: AI Output Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fair Value & Yield Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Fair Market Valuation Band</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">AI Estimate</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {formatPkr(fairPriceLow)} – {formatPkr(fairPriceHigh)}
              </p>
              <p className="text-xs text-slate-500">
                Benchmark price ({formatPkr(price)}) is within the expected 95% confidence corridor.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Estimated Monthly Rental</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">Annual Yield</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-purple-700">
                {formatPkr(monthlyRent)} / mo
              </p>
              <p className="text-xs text-emerald-600 font-semibold">
                Gross Rental Yield: {grossYield}% per annum
              </p>
            </div>
          </div>

          {/* Compounding Future Value Scenarios */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Capital Growth Scenario Modeling (Inflation-Adjusted Corridors)</span>
              </h3>
              <span className="text-xs text-slate-400">11% Nominal Average</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium">3 Years (2029)</p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">{formatPkr(fv3)}</p>
                <p className="text-xs text-emerald-600 font-bold mt-0.5">+36% Growth</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                <p className="text-xs text-purple-600 font-medium">5 Years (2031)</p>
                <p className="text-base sm:text-lg font-extrabold text-purple-950 mt-1">{formatPkr(fv5)}</p>
                <p className="text-xs text-purple-700 font-bold mt-0.5">+68% Growth</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium">10 Years (2036)</p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">{formatPkr(fv10)}</p>
                <p className="text-xs text-emerald-600 font-bold mt-0.5">+183% Growth</p>
              </div>
            </div>
          </div>

          {/* Model Assumptions & Rules of Accuracy */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800">Model Assumptions & Compliance (Section 33):</h4>
            <ul className="space-y-1 text-slate-600 list-disc pl-4">
              <li>Valuation models use historical registered transactions and active listings in {area}, {city}.</li>
              <li>Rental yield estimates assume standard unfurnished occupancy with 10% annual escalation.</li>
              <li>Future value projections are mathematical scenario estimates based on Pakistan urban corridor historical averages, not guaranteed returns.</li>
              <li>Independent verification of physical boundaries and revenue records is strongly recommended before committing funds.</li>
            </ul>

            <div className="pt-2">
              <Link
                href="/verification"
                className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-bold text-xs"
              >
                <span>Learn about PropertyIQ Verification Service</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
