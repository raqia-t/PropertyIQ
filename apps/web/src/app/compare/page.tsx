"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, ShieldCheck, Sparkles, Building2 } from "lucide-react";

export default function ComparePropertiesPage() {
  const comparisonData = [
    {
      id: "1",
      title: "1 Kanal Designer House in DHA Phase 6",
      price: "PKR 9.80 Crore",
      rawPrice: 98000000,
      size: "1 Kanal (20 Marla)",
      coveredArea: "4,800 Sq. Ft.",
      bedrooms: "5 Beds",
      bathrooms: "6 Baths",
      area: "DHA Phase 6, Lahore",
      estimatedRent: "PKR 3.8 - 4.4 Lakh/mo",
      yield: "5.04% Gross",
      schoolAccess: "0.8 km (LGS Phase 6)",
      hospitalAccess: "3.2 km (National Hospital)",
      verification: "Verified",
      demandSignal: "High Demand (Trending +14%)",
      installment: "Cash / Direct Sale",
      image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "2",
      title: "5 Marla Luxury Spanish Villa in Bahria Town",
      price: "PKR 2.65 Crore",
      rawPrice: 26500000,
      size: "5 Marla",
      coveredArea: "2,200 Sq. Ft.",
      bedrooms: "3 Beds",
      bathrooms: "4 Baths",
      area: "Bahria Town Sector C, Lahore",
      estimatedRent: "PKR 95,000 - 1.1 Lakh/mo",
      yield: "4.82% Gross",
      schoolAccess: "1.4 km (Beaconhouse)",
      hospitalAccess: "1.8 km (Bahria International)",
      verification: "InReview",
      demandSignal: "Moderate Demand",
      installment: "Cash / Direct Sale",
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "3",
      title: "5 Marla Prime Plot in Skyline Meadows",
      price: "PKR 95 Lakh",
      rawPrice: 9500000,
      size: "5 Marla",
      coveredArea: "N/A (Plot)",
      bedrooms: "N/A",
      bathrooms: "N/A",
      area: "Raiwind Road, Lahore",
      estimatedRent: "N/A (Plot)",
      yield: "Capital Appreciation Focus",
      schoolAccess: "2.5 km (Comsats Area)",
      hospitalAccess: "4.0 km (Sharif Medical City)",
      verification: "Verified (LDA NOC)",
      demandSignal: "Very High Demand (New Launch)",
      installment: "36 Months Flexible Plan",
      image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search Results</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">Side-by-Side Property Comparison</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Compare specifications, AI rental returns, neighborhood accessibility, and verification statuses.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 w-48 font-bold text-slate-600">Metric / Attribute</th>
                {comparisonData.map((item) => (
                  <th key={item.id} className="p-4 w-72">
                    <div className="space-y-2">
                      <div className="h-32 rounded-xl overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">{item.title}</h4>
                      <p className="text-base font-extrabold text-emerald-600">{item.price}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Location</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 font-medium">{p.area}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Land Size & Area</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 font-bold text-slate-900">{p.size}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Covered Area</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">{p.coveredArea}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Beds / Baths</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">{p.bedrooms} • {p.bathrooms}</td>
                ))}
              </tr>

              <tr className="bg-purple-50/30">
                <td className="p-4 font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>AI Estimated Rent</span>
                </td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 font-extrabold text-purple-900">{p.estimatedRent}</td>
                ))}
              </tr>

              <tr className="bg-purple-50/30">
                <td className="p-4 font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Gross Rental Yield</span>
                </td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 font-bold text-emerald-700">{p.yield}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">School Proximity</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">{p.schoolAccess}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Hospital Proximity</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">{p.hospitalAccess}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verification Status</span>
                </td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      p.verification.includes("Verified")
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {p.verification}
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Market Demand Signal</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 text-emerald-700 font-semibold">{p.demandSignal}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Payment / Installment</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4 font-semibold">{p.installment}</td>
                ))}
              </tr>

              <tr>
                <td className="p-4 font-bold text-slate-900 bg-slate-50/50">Action</td>
                {comparisonData.map((p) => (
                  <td key={p.id} className="p-4">
                    <Link
                      href={`/properties/${p.id}`}
                      className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 rounded-xl transition shadow-sm"
                    >
                      View Profile
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
