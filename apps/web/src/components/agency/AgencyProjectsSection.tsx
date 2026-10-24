"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Loader2, PlusCircle, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyMandate {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectType: string;
  city: string;
  area: string;
  developerName: string;
  developerVerified: boolean;
  approvalStatus: string;
  regulatoryAuthority?: string | null;
  totalUnits: number;
  availableUnits: number;
  startingPrice: number;
  currency: string;
  isExclusive: boolean;
  status: string;
  commissionPercent?: number | null;
  startDateUtc?: string | null;
  endDateUtc?: string | null;
  notes?: string | null;
  createdAtUtc: string;
}

interface AgencyProjectsResponse {
  organization: { id: string; name: string; city: string };
  activeMandatesCount: number;
  totalMandatesCount: number;
  mandates: AgencyMandate[];
}

interface CatalogProject {
  id: string;
  name: string;
  city: string;
  area: string;
  developerName: string;
}

const MANDATE_STATUSES = ["Active", "Suspended", "Ended"] as const;

function formatPkr(price: number, currency = "PKR"): string {
  if (price <= 0) return "—";
  if (price >= 10_000_000) return `${currency} ${(price / 10_000_000).toFixed(2)} Crore`;
  if (price >= 100_000) return `${currency} ${(price / 100_000).toFixed(2)} Lakh`;
  return `${currency} ${price.toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-800";
    case "Suspended":
      return "bg-amber-100 text-amber-800";
    case "Ended":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AgencyProjectsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProject[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [isExclusive, setIsExclusive] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState("2");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/agency/projects${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load firm mandates (${res.status}).`)
        );
      }
      setData((await res.json()) as AgencyProjectsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load firm project mandates.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, debouncedSearch]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await authFetch("/api/projects?pageSize=50");
      if (!res.ok) throw new Error(`Could not load projects (${res.status}).`);
      const json = (await res.json()) as {
        items?: Array<{
          id: string;
          name: string;
          city: string;
          area: string;
          developerName: string;
        }>;
        Items?: Array<{
          id: string;
          name: string;
          city: string;
          area: string;
          developerName: string;
        }>;
      };
      const items = json.items ?? json.Items ?? [];
      setCatalog(
        items.map((p) => ({
          id: p.id,
          name: p.name,
          city: p.city,
          area: p.area,
          developerName: p.developerName,
        }))
      );
    } catch {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to view developer mandates.");
      return;
    }
    void loadProjects();
  }, [isHydrated, isAuthenticated, loadProjects]);

  useEffect(() => {
    if (!showForm || !isAuthenticated) return;
    void loadCatalog();
  }, [showForm, isAuthenticated, loadCatalog]);

  const mandatedIds = useMemo(
    () => new Set((data?.mandates ?? []).map((m) => m.projectId)),
    [data?.mandates]
  );

  const availableProjects = useMemo(
    () => catalog.filter((p) => !mandatedIds.has(p.id)),
    [catalog, mandatedIds]
  );

  const openForm = () => {
    setShowForm(true);
    setFormError(null);
    setFormOk(null);
    setProjectId("");
    setIsExclusive(true);
    setCommissionPercent("2");
    setStartDate(todayInputValue());
    setEndDate("");
    setNotes("");
  };

  const submitMandate = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setFormError("Select a developer project.");
      return;
    }

    const commission = commissionPercent.trim() === "" ? null : Number(commissionPercent);
    if (commission != null && (Number.isNaN(commission) || commission < 0 || commission > 100)) {
      setFormError("Commission must be a number between 0 and 100.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormOk(null);
    try {
      const res = await authFetch("/api/agency/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          isExclusive,
          commissionPercent: commission,
          startDateUtc: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null,
          endDateUtc: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Could not create mandate (${res.status}).`);
      }
      setFormOk("Mandate added to your firm pipeline.");
      setShowForm(false);
      await loadProjects();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not create mandate.");
    } finally {
      setSaving(false);
    }
  };

  const mandates = data?.mandates ?? [];

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading exclusive developer mandates…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Developer Mandates ({mandates.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.activeMandatesCount ?? 0} active · {data?.totalMandatesCount ?? 0} total
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
              placeholder="Search project or developer"
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 w-52 focus:outline-none focus:border-purple-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600"
          >
            <option value="All">All statuses</option>
            {MANDATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadProjects()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-xl transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Mandate
          </button>
        </div>
      </div>

      {formOk && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {formOk}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void submitMandate(e)}
          className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Add developer mandate</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Link an existing developer project your firm is authorized to market.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs space-y-1 md:col-span-2">
              <span className="font-bold text-slate-600">Developer project</span>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={catalogLoading}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
              >
                <option value="">
                  {catalogLoading ? "Loading projects…" : "Select a project"}
                </option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.developerName} ({p.area}, {p.city})
                  </option>
                ))}
              </select>
              {!catalogLoading && availableProjects.length === 0 && (
                <span className="text-[11px] text-slate-500">
                  No unassigned projects available (all catalog projects may already be mandated).
                </span>
              )}
            </label>

            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Commission %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 mt-6">
              <input
                type="checkbox"
                checked={isExclusive}
                onChange={(e) => setIsExclusive(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-600"
              />
              Exclusive marketing rights
            </label>

            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
              />
            </label>

            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">End date (optional)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
              />
            </label>

            <label className="block text-xs space-y-1 md:col-span-2">
              <span className="font-bold text-slate-600">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Exclusive DHA corridor inventory mandate"
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600 resize-y"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !projectId}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-4 py-2.5 rounded-xl transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
              Save mandate
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!error && mandates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <Building2 className="w-8 h-8 text-purple-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No developer mandates yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Mandates link your brokerage to developer projects you are authorized to market. They do
            not take ownership of the developer’s inventory.
          </p>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl"
          >
            <PlusCircle className="w-4 h-4" />
            Add Mandate
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mandates.map((m) => {
            const href = m.projectSlug ? `/projects/${m.projectSlug}` : `/projects`;
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      className="font-extrabold text-sm text-slate-900 hover:text-purple-700 line-clamp-2"
                    >
                      {m.projectName}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {m.developerName}
                      {m.developerVerified ? " · Verified developer" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(m.status)}`}>
                      {m.status}
                    </span>
                    {m.isExclusive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        Exclusive
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  {m.area}
                  {m.area && m.city ? ", " : ""}
                  {m.city}
                  {m.projectType ? ` · ${m.projectType}` : ""}
                  {m.regulatoryAuthority ? ` · ${m.regulatoryAuthority}` : ""}
                </p>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Available</span>
                    <span className="font-black text-slate-900">
                      {m.availableUnits}/{m.totalUnits}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">From</span>
                    <span className="font-black text-emerald-700">
                      {formatPkr(m.startingPrice, m.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Commission</span>
                    <span className="font-black text-purple-700">
                      {m.commissionPercent != null ? `${m.commissionPercent}%` : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>
                    Mandate {formatDate(m.startDateUtc)}
                    {m.endDateUtc ? ` → ${formatDate(m.endDateUtc)}` : ""}
                  </span>
                  <span>Approval: {m.approvalStatus || "—"}</span>
                </div>

                {m.notes && (
                  <p className="text-xs text-slate-600 line-clamp-2">{m.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
