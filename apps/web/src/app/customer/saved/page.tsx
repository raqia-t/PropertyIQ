"use client";

import Link from "next/link";
import {
  Heart,
  Building,
  MapPin,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Trash2,
  Share2,
  ExternalLink
} from "lucide-react";

export default function CustomerSavedPage() {
  const savedProperties = [
    {
      id: "1",
      title: "Brand New 1 Kanal Modern Designer House in DHA Phase 6",
      price: "PKR 9.80 Crore",
      location: "DHA Phase 6, Lahore",
      bedrooms: 5,
      bathrooms: 6,
      area: "1 Kanal (500 Sq Yd)",
      yieldEstimate: "6.2% expected rental yield",
      verification: "Verified",
      addedDate: "Saved 2 days ago",
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "2",
      title: "5 Marla Luxury Spanish Villa near Commercial Hub",
      price: "PKR 2.65 Crore",
      location: "Bahria Town Sector C, Lahore",
      bedrooms: 3,
      bathrooms: 4,
      area: "5 Marla (125 Sq Yd)",
      yieldEstimate: "7.1% expected rental yield",
      verification: "InReview",
      addedDate: "Saved 5 days ago",
      image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800">
              Shortlist
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {savedProperties.length} Saved Properties
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Saved Properties & Watchlist
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Properties you have bookmarked. Compare yields, download due-diligence summaries, and schedule viewings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Compare Properties Side-by-Side</span>
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Browse More</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Saved Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {savedProperties.map((property) => (
          <div
            key={property.id}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              {/* Image banner */}
              <div className="h-48 bg-slate-100 relative overflow-hidden">
                <img
                  src={property.image}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {property.verification}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <button className="p-2 rounded-full bg-white/90 text-rose-600 shadow-sm hover:bg-white transition">
                    <Heart className="w-4 h-4 fill-rose-600" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{property.price}</span>
                  <span className="text-xs text-slate-400 font-medium">{property.addedDate}</span>
                </div>

                <h3 className="font-bold text-sm text-slate-800 line-clamp-1">
                  {property.title}
                </h3>

                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{property.location}</span>
                </p>

                {/* Specs */}
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  <span>{property.bedrooms} Beds</span>
                  <span>•</span>
                  <span>{property.bathrooms} Baths</span>
                  <span>•</span>
                  <span>{property.area}</span>
                </div>

                {/* Contextual Intelligence snippet */}
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/60 p-2 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-medium">{property.yieldEstimate}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-3 mt-4">
              <Link
                href={`/properties/${property.id}`}
                className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm"
              >
                View Full Details
              </Link>
              <Link
                href="/compare"
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition"
              >
                Compare
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
