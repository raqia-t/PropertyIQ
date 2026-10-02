"use client";

import { useState } from "react";
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
  Share2,
  CheckCircle,
  GraduationCap,
  Hospital,
  ShoppingBag,
  Send,
  Building,
  ArrowLeft,
  AlertCircle
} from "lucide-react";

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [isSaved, setIsSaved] = useState(false);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState(
    "Hello, I am interested in this property. Please share further details and arrange a site visit."
  );
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  // Realistic Lahore listing model
  const property = {
    id: propertyId || "1",
    title: "Brand New 1 Kanal Modern Designer House in DHA Phase 6",
    price: "PKR 9.80 Crore",
    priceInPkr: 98000000,
    purpose: "For Sale",
    propertyType: "House",
    province: "Punjab",
    city: "Lahore",
    area: "DHA Phase 6, Block L",
    address: "House 42, Street 8, Block L, DHA Phase 6, Lahore",
    beds: 5,
    baths: 6,
    landArea: "1 Kanal",
    coveredAreaSqFt: 4800,
    yearBuilt: 2025,
    furnishing: "Semi-Furnished",
    parkingSpaces: 3,
    verificationStatus: "Verified",
    qualityScore: 95,
    description:
      "Spectacular newly constructed Spanish architecture bungalow with imported fixtures, SMEG appliances, high ceilings, basement home theater, separate servant quarters, and solar backup system.",
    aiSummary:
      "Executive 5-bed designer residence situated in a quiet, high-security sector of DHA Phase 6. Excellent investment profile with competitive rental yield potential and clean documentation.",
    aiValuation: {
      fairPriceLow: "PKR 9.20 Crore",
      fairPriceHigh: "PKR 10.30 Crore",
      estimatedRent: "PKR 3.8 - 4.4 Lakh/month",
      grossYield: "5.04%",
      threeYearScenario: "PKR 13.4 Crore (+36%)",
      fiveYearScenario: "PKR 16.5 Crore (+68%)",
      confidence: "88%",
      assumptions: [
        "Based on recent registered transactions in DHA Phase 6 Block L & M",
        "Assumes 11% nominal annual corridor appreciation",
        "Assumes standard 10% annual residential rent escalation",
        "Excludes DHA transfer fees and stamp duties"
      ]
    },
    neighborhood: [
      { name: "Lahore Grammar School (LGS)", type: "School", distance: "0.8 km (3 mins)" },
      { name: "Beaconhouse Newlands", type: "School", distance: "2.1 km (6 mins)" },
      { name: "National Hospital DHA Phase 5", type: "Hospital", distance: "3.2 km (8 mins)" },
      { name: "Jalal Sons & Commercial Broadway", type: "Market", distance: "1.2 km (4 mins)" },
      { name: "Phase 6 Central Mosque", type: "Mosque", distance: "0.4 km (1 min)" }
    ],
    agent: {
      name: "Kamran Ali",
      company: "Lahore Premier Properties",
      phone: "+92 321 4567890",
      verified: true
    },
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80"
    ]
  };

  const [activeImage, setActiveImage] = useState(property.images[0]);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search Results</span>
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {property.purpose}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {property.propertyType}
            </span>
            {property.verificationStatus === "Verified" && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Property</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{property.title}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>{property.address}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-extrabold text-emerald-600">{property.price}</p>
            <p className="text-xs text-slate-400">PKR 98,000,000 • Negotiable</p>
          </div>
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={`p-3 rounded-xl border transition ${
              isSaved
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Heart className={`w-5 h-5 ${isSaved ? "fill-red-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Media Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden h-[420px] bg-slate-900 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage}
            alt={property.title}
            className="w-full h-full object-cover transition duration-300"
          />
        </div>
        <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible">
          {property.images.map((img, idx) => (
            <div
              key={idx}
              onClick={() => setActiveImage(img)}
              className={`cursor-pointer rounded-xl overflow-hidden h-32 flex-1 relative border-2 transition ${
                activeImage === img ? "border-emerald-600 shadow-md" : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Details + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Intelligence */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Specs Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Bed className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Bedrooms</p>
                <p className="text-sm font-bold text-slate-800">{property.beds} Master Beds</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Bathrooms</p>
                <p className="text-sm font-bold text-slate-800">{property.baths} Attached</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Land Area</p>
                <p className="text-sm font-bold text-slate-800">{property.landArea}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Built Year</p>
                <p className="text-sm font-bold text-slate-800">{property.yearBuilt}</p>
              </div>
            </div>
          </div>

          {/* AI Property Intelligence Profile */}
          <div className="bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-6 rounded-2xl border border-purple-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-purple-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">AI Property Intelligence Profile</h3>
                  <p className="text-xs text-purple-700">Model Confidence: {property.aiValuation.confidence}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                Pakistan Market Engine
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white/80 p-3.5 rounded-xl border border-purple-100">
              {property.aiSummary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">Fair Market Price Range</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">
                  {property.aiValuation.fairPriceLow} - {property.aiValuation.fairPriceHigh}
                </p>
                <p className="text-xs text-emerald-600 mt-1">Asking price is within fair band</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">Estimated Monthly Rent</p>
                <p className="text-base font-extrabold text-purple-700 mt-1">
                  {property.aiValuation.estimatedRent}
                </p>
                <p className="text-xs text-slate-500 mt-1">Gross Yield: <span className="font-bold text-slate-800">{property.aiValuation.grossYield}</span></p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-slate-500">5-Year Capital Scenario</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">
                  {property.aiValuation.fiveYearScenario}
                </p>
                <p className="text-xs text-emerald-600 mt-1">Compound Growth Scenario</p>
              </div>
            </div>

            {/* Assumptions */}
            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-700">Model Assumptions:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {property.aiValuation.assumptions.map((asm, idx) => (
                  <li key={idx}>{asm}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Property Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
          </div>

          {/* Neighborhood Intelligence */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Neighborhood Daily Needs</h3>
              <span className="text-xs text-emerald-600 font-semibold">Location: DHA Phase 6</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {property.neighborhood.map((poi, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    {poi.type === "School" && <GraduationCap className="w-4 h-4 text-blue-600" />}
                    {poi.type === "Hospital" && <Hospital className="w-4 h-4 text-red-600" />}
                    {poi.type === "Market" && <ShoppingBag className="w-4 h-4 text-amber-600" />}
                    {poi.type === "Mosque" && <Building className="w-4 h-4 text-emerald-600" />}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{poi.name}</p>
                      <p className="text-[10px] text-slate-500">{poi.type}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{poi.distance}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Inquiries & Verification CTA */}
        <div className="space-y-6">
          {/* Inquiry Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-24">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Contact Listing Agent</h3>
              <p className="text-xs text-slate-500">{property.agent.name} • {property.agent.company}</p>
            </div>

            {inquirySubmitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Inquiry Sent Successfully!</h4>
                <p className="text-xs text-emerald-700">
                  The listing agent has been notified and will contact you via phone/WhatsApp shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3">
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
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 rounded-xl transition shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Inquiry</span>
                </button>
              </form>
            )}

            {/* Independent Verification Callout */}
            <div className="pt-4 border-t border-slate-100">
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold">Need Peace of Mind?</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Request an independent on-site boundary inspection and title document review before making a payment.
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
