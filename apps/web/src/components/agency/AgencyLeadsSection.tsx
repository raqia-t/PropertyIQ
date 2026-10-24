"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Phone, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyLead {
  id: string;
  propertyId?: string | null;
  propertyTitle: string | null;
  projectId?: string | null;
  projectName: string | null;
  assignedBrokerId?: string | null;
  assignedBrokerName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  status: string;
  agentNotes?: string | null;
  createdAtUtc: string;
}

interface AgencyLeadsResponse {
  organization: { id: string; name: string; city: string };
  brokers: Array<{ userId: string; fullName: string }>;
  newLeadsCount: number;
  totalLeadsCount: number;
  leads: AgencyLead[];
}

const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "ViewingScheduled",
  "Closed",
  "Spam",
] as const;

function formatLeadDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "New":
      return "bg-amber-100 text-amber-800";
    case "Contacted":
      return "bg-blue-100 text-blue-800";
    case "Qualified":
      return "bg-emerald-100 text-emerald-800";
    case "ViewingScheduled":
      return "bg-purple-100 text-purple-800";
    case "Closed":
      return "bg-slate-200 text-slate-700";
    case "Spam":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function humanizeStatus(status: string): string {
  if (status === "ViewingScheduled") return "Viewing Scheduled";
  return status;
}

export default function AgencyLeadsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (brokerFilter !== "All") params.set("brokerId", brokerFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const qs = params.toString();
      const res = await authFetch(`/api/agency/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load firm leads (${res.status}).`)
        );
      }
      setData((await res.json()) as AgencyLeadsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load firm leads.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, brokerFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view firm leads.");
      return;
    }
    void loadLeads();
  }, [isHydrated, isAuthenticated, loadLeads]);

  const leads = data?.leads ?? [];
  const brokers = data?.brokers ?? [];

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading firm lead pipeline…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Firm Leads ({leads.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.newLeadsCount ?? 0} new · {data?.totalLeadsCount ?? 0} all-time
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
              placeholder="Search contact or property"
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanizeStatus(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadLeads()}
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

      {!error && leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No firm leads found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Inquiries on firm listings appear here when buyers contact your brokers. Clear filters if
            you expected results.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const expanded = expandedId === lead.id;
            return (
              <div
                key={lead.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900">{lead.contactName}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(lead.status)}`}
                      >
                        {humanizeStatus(lead.status)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Broker: <span className="font-semibold text-slate-700">{lead.assignedBrokerName}</span>
                      {" · "}
                      {formatLeadDate(lead.createdAtUtc)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {lead.propertyId && lead.propertyTitle ? (
                        <Link
                          href={`/properties/${lead.propertyId}`}
                          className="font-semibold text-purple-700 hover:underline"
                        >
                          {lead.propertyTitle}
                        </Link>
                      ) : lead.projectName ? (
                        <span className="font-semibold text-slate-800">{lead.projectName}</span>
                      ) : (
                        <span className="text-slate-400">No linked listing</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 shrink-0">
                    {lead.contactPhone && (
                      <a
                        href={`tel:${lead.contactPhone}`}
                        className="inline-flex items-center gap-1 hover:text-purple-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {lead.contactPhone}
                      </a>
                    )}
                    {lead.contactEmail && (
                      <a
                        href={`mailto:${lead.contactEmail}`}
                        className="inline-flex items-center gap-1 hover:text-purple-700"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {lead.contactEmail}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : lead.id)}
                      className="font-bold text-purple-700 hover:underline"
                    >
                      {expanded ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                        Message
                      </p>
                      <p className="text-slate-700 whitespace-pre-wrap">
                        {lead.message || "—"}
                      </p>
                    </div>
                    {lead.agentNotes && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                          Broker notes
                        </p>
                        <p className="text-slate-700 whitespace-pre-wrap">{lead.agentNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
