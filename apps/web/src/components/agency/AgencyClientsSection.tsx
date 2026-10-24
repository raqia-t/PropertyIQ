"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { Loader2, Mail, Phone, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyClient {
  id: string;
  agentUserId: string;
  assignedBrokerName: string;
  fullName: string;
  phone: string;
  email?: string | null;
  clientSide: string;
  status: string;
  budgetMinPkr?: number | null;
  budgetMaxPkr?: number | null;
  targetAreas?: string | null;
  notes?: string | null;
  linkedPropertyId?: string | null;
  linkedPropertyTitle?: string | null;
  sourceInquiryId?: string | null;
  createdAtUtc: string;
}

interface AgencyClientsResponse {
  organization: { id: string; name: string; city: string };
  brokers: Array<{ userId: string; fullName: string }>;
  totalClientsCount: number;
  activeClientsCount: number;
  clients: AgencyClient[];
}

const CLIENT_SIDES = ["Buyer", "Seller", "Investor", "Both"] as const;
const CLIENT_STATUSES = [
  "Prospect",
  "Active",
  "MandateSigned",
  "UnderOffer",
  "Closed",
  "Inactive",
] as const;

function formatBudget(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => {
    if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(1)} Cr`;
    if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(0)} Lakh`;
    return `PKR ${n.toLocaleString()}`;
  };
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function humanizeStatus(status: string): string {
  if (status === "MandateSigned") return "Mandate Signed";
  if (status === "UnderOffer") return "Under Offer";
  return status;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Prospect":
      return "bg-slate-100 text-slate-700";
    case "Active":
      return "bg-emerald-100 text-emerald-800";
    case "MandateSigned":
      return "bg-blue-100 text-blue-800";
    case "UnderOffer":
      return "bg-amber-100 text-amber-800";
    case "Closed":
      return "bg-purple-100 text-purple-800";
    case "Inactive":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AgencyClientsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyClientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState("All");
  const [sideFilter, setSideFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (brokerFilter !== "All") params.set("brokerId", brokerFilter);
      if (sideFilter !== "All") params.set("side", sideFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const qs = params.toString();
      const res = await authFetch(`/api/agency/clients${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load firm clients (${res.status}).`)
        );
      }
      setData((await res.json()) as AgencyClientsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load firm clients.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, brokerFilter, sideFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view firm clients.");
      return;
    }
    void loadClients();
  }, [isHydrated, isAuthenticated, loadClients]);

  const clients = data?.clients ?? [];
  const brokers = data?.brokers ?? [];

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading firm client accounts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Firm Clients ({clients.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.activeClientsCount ?? 0} active pipeline · {data?.totalClientsCount ?? 0} all-time
            {data?.organization?.name ? ` · ${data.organization.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, areas"
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 w-48 focus:outline-none focus:border-purple-600"
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
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All sides</option>
            {CLIENT_SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanizeStatus(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadClients()}
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

      {!error && clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No firm clients found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            CRM contacts owned by your brokers appear here. Clear filters if you expected results.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Property / Areas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {clients.map((c) => {
                const expanded = expandedId === c.id;
                const budget = formatBudget(c.budgetMinPkr, c.budgetMaxPkr);
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{c.fullName}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-slate-500">
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-purple-700">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-purple-700">
                              <Mail className="w-3 h-3" />
                              {c.email}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{c.assignedBrokerName}</td>
                      <td className="px-4 py-3 text-slate-600">{c.clientSide}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(c.status)}`}>
                          {humanizeStatus(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{budget ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                        {c.linkedPropertyId && c.linkedPropertyTitle ? (
                          <Link
                            href={`/properties/${c.linkedPropertyId}`}
                            className="font-semibold text-purple-700 hover:underline line-clamp-2"
                          >
                            {c.linkedPropertyTitle}
                          </Link>
                        ) : (
                          <span className="line-clamp-2">{c.targetAreas || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : c.id)}
                          className="font-bold text-purple-700 hover:underline"
                        >
                          {expanded ? "Hide" : "Notes"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={7} className="px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap">
                          {c.notes?.trim() || "No notes on this client."}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
