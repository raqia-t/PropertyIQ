"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Loader2, Pencil, PlusCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgentListing {
  id: string;
  title: string;
  city: string;
  area: string;
  price: number;
  currency: string;
  landArea: number;
  landAreaUnit: string;
  bedrooms?: number | null;
  status: string;
  verificationStatus: string;
  listingQualityScore: number;
  mediaCount: number;
  primaryImageUrl: string;
  createdAtUtc: string;
}

function formatPkr(price: number, currency = "PKR"): string {
  if (price >= 10_000_000) return `${currency} ${(price / 10_000_000).toFixed(2)} Crore`;
  if (price >= 100_000) return `${currency} ${(price / 100_000).toFixed(2)} Lakh`;
  return `${currency} ${price.toLocaleString()}`;
}

function verificationBadgeClass(status: string): string {
  switch (status) {
    case "Verified":
      return "bg-emerald-100 text-emerald-800";
    case "InReview":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function humanizeVerification(status: string): string {
  if (status === "InReview") return "In Review";
  return status;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80";

export default function AgentPropertiesSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/agent/listings");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load listings (${res.status}).`
        );
      }
      const data = (await res.json()) as AgentListing[];
      setListings(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setListings([]);
      setError(e instanceof Error ? e.message : "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view your listings.");
      return;
    }
    void loadListings();
  }, [isHydrated, isAuthenticated, loadListings]);

  const visible = useMemo(() => {
    if (statusFilter === "All") return listings;
    return listings.filter((l) => l.status === statusFilter);
  }, [listings, statusFilter]);

  const publishedCount = useMemo(
    () => listings.filter((l) => l.status === "Published").length,
    [listings]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading your property listings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Active Listings ({publishedCount})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {listings.length} total in your account • live from Postgres
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
          >
            <option value="All">All statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="PendingModeration">Pending moderation</option>
            <option value="Archived">Archived</option>
          </select>
          <button
            type="button"
            onClick={() => void loadListings()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No listings found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create a listing from the form and it will appear here for your agent account.
          </p>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <PlusCircle className="w-4 h-4" />
            Add New Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((listing) => {
            const imageSrc =
              listing.primaryImageUrl && listing.primaryImageUrl !== "/placeholder-property.jpg"
                ? listing.primaryImageUrl
                : FALLBACK_IMAGE;

            return (
              <div
                key={listing.id}
                className="group p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 hover:border-emerald-300 hover:shadow-sm transition"
              >
                <Link href={`/properties/${listing.id}`} className="block relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={listing.title}
                    className="w-full h-full object-cover transition group-hover:scale-[1.02]"
                  />
                  <span className="absolute top-2 left-2 text-[10px] font-mono font-bold bg-black/60 text-white px-2 py-0.5 rounded-md">
                    {listing.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${verificationBadgeClass(listing.verificationStatus)}`}
                  >
                    {humanizeVerification(listing.verificationStatus)}
                  </span>
                </Link>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {listing.status}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Quality {listing.listingQualityScore ?? 0}%
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-emerald-800">
                    {listing.title}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {listing.area}, {listing.city}
                    {listing.landArea
                      ? ` • ${listing.landArea} ${listing.landAreaUnit}`
                      : ""}
                    {listing.bedrooms != null ? ` • ${listing.bedrooms} Beds` : ""}
                  </p>
                  <p className="text-xs font-black text-emerald-700">
                    {formatPkr(Number(listing.price), listing.currency)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {listing.mediaCount} photo{listing.mediaCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/properties/${listing.id}`}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/properties/${listing.id}/edit`}
                      className="inline-flex items-center gap-1 text-slate-700 font-bold hover:text-emerald-800"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
