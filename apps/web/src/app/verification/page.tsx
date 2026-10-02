"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle, FileText, MapPin, Search, AlertCircle, ArrowRight } from "lucide-react";

export default function VerificationPage() {
  const [selectedTier, setSelectedTier] = useState<string>("site_visit");

  const tiers = [
    {
      id: "basic",
      name: "Basic Document Review",
      price: "PKR 15,000",
      turnaround: "48 Hours",
      description: "Document completeness, consistency check, visible red flags, and seller metadata verification.",
      features: [
        "Registry / Sale Deed / Fard scan consistency check",
        "Seller CNIC vs Ownership record matching",
        "Listing metadata verification",
        "Red-flag detection report",
      ]
    },
    {
      id: "site_visit",
      name: "Property & Site Visit",
      price: "PKR 35,000",
      turnaround: "72 Hours",
      popular: true,
      description: "Physical inspection by a certified field specialist, boundary check, and occupancy verification.",
      features: [
        "Physical site visit by approved specialist",
        "Geotagged & timestamped high-resolution photos",
        "Plot / House boundary verification & road access",
        "Physical possession & occupancy status check",
        "Immediate neighborhood infrastructure check",
      ]
    },
    {
      id: "record_check",
      name: "Official Record Check",
      price: "PKR 45,000",
      turnaround: "4 - 5 Days",
      description: "Verification against accessible official revenue records (PLRA, Sindh BoR, RDA, SBCA).",
      features: [
        "Punjab PLRA digital record inquiry where accessible",
        "Development authority NOC / Approval status check",
        "Record of Rights (Fard Malkiat) check",
        "Outstanding society / development charges verification",
      ]
    },
    {
      id: "enhanced",
      name: "Enhanced Due Diligence",
      price: "PKR 75,000",
      turnaround: "5 - 7 Days",
      description: "Combines complete document chain audit, physical inspection, and authority checks.",
      features: [
        "Includes everything in Site Visit & Official Record Check",
        "Historical ownership transfer / Intiqal trail audit",
        "Developer track record & project compliance check",
        "Detailed comprehensive due diligence dossier",
      ]
    },
    {
      id: "legal_review",
      name: "Formal Legal Title Opinion",
      price: "PKR 120,000",
      turnaround: "7 - 10 Days",
      description: "Independent written legal opinion by a licensed High Court real estate advocate.",
      features: [
        "Licensed High Court lawyer engagement",
        "Litigation & court stay order search",
        "Formal written title legal opinion",
        "Review of sale agreements and indemnities",
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Pakistan Property Verification Service</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Don’t Risk Your Capital. <br />
          <span className="text-emerald-600">Verify Before You Buy.</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Due diligence conducted by verified specialists. Every report includes geotagged photo evidence, authority check notes, and transparent limitations.
        </p>
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.slice(0, 3).map((tier) => (
          <div
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`cursor-pointer rounded-2xl p-6 border transition flex flex-col justify-between ${
              selectedTier === tier.id
                ? "border-emerald-600 ring-2 ring-emerald-600 bg-emerald-50/20 shadow-md"
                : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
            }`}
          >
            <div>
              {tier.popular && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white mb-3">
                  Most Popular for Resale
                </span>
              )}
              <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
              
              <div className="my-6">
                <span className="text-3xl font-extrabold text-slate-900">{tier.price}</span>
                <span className="text-xs text-slate-500 ml-2">/ SLA: {tier.turnaround}</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700">
                {tier.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
                selectedTier === tier.id
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
              }`}
            >
              Select Tier & Proceed
            </button>
          </div>
        ))}
      </div>

      {/* Legal & Operational Disclaimer Box */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">Important Operational & Legal Notice for Pakistan Real Estate</p>
          <p>
            PropertyIQ Verification is an independent, evidence-backed professional due-diligence service. It provides structured records of physical visits, documents inspected, and official accessible sources (such as Punjab PLRA or RDA NOC records). It does not issue official government land titles or replace certified revenue records from competent land authorities.
          </p>
        </div>
      </div>
    </div>
  );
}
