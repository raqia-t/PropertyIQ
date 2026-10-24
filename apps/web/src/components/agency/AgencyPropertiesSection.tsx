"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Loader2, PlusCircle, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyListing {
  id: string;
  title: string;
  city: string;
  area: string;
  assignedBrokerId: string;
  assignedBrokerName: string;
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
  leadsCount: number;
  createdAtUtc: string;
}

interface AgencyListingsResponse {
  organization: {
    id: string;
    name: string;
    city: string;
  };
  brokers: Array<{ userId: string; fullName: string }>;
  listings: AgencyListing[];
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
      return "bg-amber-100 text-amber-800";
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

export default function AgencyPropertiesSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (brokerFilter !== "All") params.set("brokerId", brokerFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (verificationFilter !== "All") params.set("verificationStatus", verificationFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const qs = params.toString();
      const res = await authFetch(`/api/agency/listings${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load firm listings (${res.status}).`)
        );
      }
      const json = (await res.json()) as AgencyListingsResponse;
      setData(json);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load firm listings.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, brokerFilter, statusFilter, verificationFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view firm listings.");
      return;
    }
    void loadListings();
  }, [isHydrated, isAuthenticated, loadListings]);

  const listings = data?.listings ?? [];
  const brokers = data?.brokers ?? [];
  const publishedCount = useMemo(
    () => listings.filter((l) => l.status === "Published").length,
    [listings]
  );

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading firm property listings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Firm Listings ({listings.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {publishedCount} published
            {data?.organization?.name ? ` · ${data.organization.name}` : ""}
            {" · "}live org inventory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, city, area"
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 w-44 focus:outline-none focus:border-purple-600"
            />
          </div>
          <select
            value={brokerFilter}
            onChange={(e) => setBrokerFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All brokers</option>
            {brokers.map((b) => (
              <option key={b.userId} value={b.userId}>
                {b.fullName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="PendingModeration">Pending moderation</option>
            <option value="Archived">Archived</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All verification</option>
            <option value="Verified">Verified</option>
            <option value="InReview">In Review</option>
            <option value="Unverified">Unverified</option>
          </select>
          <button
            type="button"
            onClick={() => void loadListings()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {!error && listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No firm listings found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add a listing for this agency or clear filters. New listings inherit the firm organization
            automatically.
          </p>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <PlusCircle className="w-4 h-4" />
            Add Agency Listing
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {listings.map((l) => {
                const imageSrc =
                  l.primaryImageUrl && l.primaryImageUrl !== "/placeholder-property.jpg"
                    ? l.primaryImageUrl
                    : FALLBACK_IMAGE;

                return (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${l.id}`}
                        className="flex items-center gap-3 group min-w-[220px]"
                      >
                        <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {l.mediaCount === 0 && (
                            <ImageIcon className="w-4 h-4 text-slate-400 absolute inset-0 m-auto" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-purple-700 line-clamp-2">
                            {l.title}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {l.area}
                            {l.area && l.city ? ", " : ""}
                            {l.city}
                            {l.bedrooms != null ? ` · ${l.bedrooms} bed` : ""}
                            {l.landArea
                              ? ` · ${l.landArea} ${l.landAreaUnit}`
                              : ""}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {l.assignedBrokerName}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-emerald-700 whitespace-nowrap">
                      {formatPkr(l.price, l.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.status}</td>
                    <td className="px-4 py-3 font-semibold text-purple-700">{l.leadsCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${verificationBadgeClass(l.verificationStatus)}`}
                      >
                        {humanizeVerification(l.verificationStatus)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
