"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MapPin,
  TrendingUp,
  ArrowRight,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatPkr, mediaUrl, pick } from "@/lib/apiHelpers";

interface SavedProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  area: string;
  bedrooms: number | null;
  bathrooms: number | null;
  landArea: number | null;
  landAreaUnit: string | null;
  primaryImageUrl: string;
  savedAtUtc: string;
}

export default function CustomerSavedPage() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [items, setItems] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in to view your saved properties.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/properties/saved");
      if (!res.ok) throw new Error(`Failed to load saved properties (${res.status})`);
      const rows = (await res.json()) as Record<string, unknown>[];
      setItems(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(pick(r, "id", "Id") ?? ""),
          title: String(pick(r, "title", "Title") ?? "Property"),
          price: Number(pick(r, "price", "Price") ?? 0),
          currency: String(pick(r, "currency", "Currency") ?? "PKR"),
          city: String(pick(r, "city", "City") ?? ""),
          area: String(pick(r, "area", "Area") ?? ""),
          bedrooms: pick<number | null>(r, "bedrooms", "Bedrooms") ?? null,
          bathrooms: pick<number | null>(r, "bathrooms", "Bathrooms") ?? null,
          landArea: pick<number | null>(r, "landArea", "LandArea") ?? null,
          landAreaUnit: pick<string | null>(r, "landAreaUnit", "LandAreaUnit") ?? null,
          primaryImageUrl: mediaUrl(
            pick<string>(r, "primaryImageUrl", "PrimaryImageUrl")
          ),
          savedAtUtc: String(pick(r, "savedAtUtc", "SavedAtUtc") ?? ""),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load saved properties");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated, isHydrated]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnsave = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await authFetch(`/api/properties/${id}/save`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // keep item if delete failed
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800">
              Shortlist
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {loading ? "…" : `${items.length} Saved Properties`}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Saved Properties & Watchlist
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live bookmarks from your account. Remove anytime or open full listing details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Compare Properties</span>
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

      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          Loading saved properties…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load saved list</p>
            <p className="mt-1 text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center space-y-3">
          <Heart className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No saved properties yet</p>
          <p className="text-xs text-slate-500">Save listings from a property detail page to build your shortlist.</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            Browse properties <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((property) => {
            const land =
              property.landArea != null
                ? `${property.landArea} ${property.landAreaUnit || ""}`.trim()
                : null;
            return (
              <div
                key={property.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="h-48 bg-slate-100 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={property.primaryImageUrl}
                      alt={property.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80";
                      }}
                    />
                    <div className="absolute top-3 right-3">
                      <button
                        type="button"
                        onClick={() => handleUnsave(property.id)}
                        disabled={removingId === property.id}
                        className="p-2 rounded-full bg-white/90 text-rose-600 shadow-sm hover:bg-white transition disabled:opacity-50"
                        title="Remove from saved"
                      >
                        {removingId === property.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xl font-black text-slate-900">
                        {formatPkr(property.price)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium shrink-0">
                        Saved {formatDate(property.savedAtUtc)}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-800 line-clamp-2">
                      {property.title}
                    </h3>

                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {[property.area, property.city].filter(Boolean).join(", ") || "Pakistan"}
                      </span>
                    </p>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                      {property.bedrooms != null && <span>{property.bedrooms} Beds</span>}
                      {property.bathrooms != null && (
                        <>
                          <span>•</span>
                          <span>{property.bathrooms} Baths</span>
                        </>
                      )}
                      {land && (
                        <>
                          <span>•</span>
                          <span>{land}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
