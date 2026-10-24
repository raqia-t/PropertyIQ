"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Building2,
  Handshake,
  Loader2,
  Mail,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SalesProject {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
}

interface AgencyOption {
  id: string;
  name: string;
  licenseNumber?: string | null;
  city: string;
  isVerified: boolean;
}

interface InternalRep {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  assignedLeadsCount: number;
  pendingLeadsCount: number;
  createdAtUtc: string;
  channel: string;
}

interface ExternalChannel {
  mandateId: string;
  agencyOrgId: string;
  agencyName: string;
  agencyLicense?: string | null;
  agencyCity: string;
  agencyVerified: boolean;
  agencyContactEmail?: string | null;
  agencyContactPhone?: string | null;
  brokerCount: number;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  isExclusive: boolean;
  status: string;
  commissionPercent?: number | null;
  startDateUtc?: string | null;
  endDateUtc?: string | null;
  notes?: string | null;
  createdAtUtc: string;
  channel: string;
}

interface SalesTeamResponse {
  organization: { name: string; licenseNumber?: string | null };
  summary: {
    internalRepsCount: number;
    activeInternalRepsCount: number;
    externalMandatesCount: number;
    activeMandatesCount: number;
    affiliatedAgenciesCount: number;
    totalAssignedLeads: number;
  };
  projects: SalesProject[];
  agencies: AgencyOption[];
  internalSales: InternalRep[];
  externalChannels: ExternalChannel[];
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export default function DeveloperSalesTeamSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<SalesTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showRepForm, setShowRepForm] = useState(false);
  const [showMandateForm, setShowMandateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [repName, setRepName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [repPhone, setRepPhone] = useState("");
  const [repPassword, setRepPassword] = useState("");
  const [repRole, setRepRole] = useState("Developer");

  const [mandateProjectId, setMandateProjectId] = useState("");
  const [mandateAgencyId, setMandateAgencyId] = useState("");
  const [mandateExclusive, setMandateExclusive] = useState(true);
  const [mandateCommission, setMandateCommission] = useState("2");
  const [mandateNotes, setMandateNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      params.set("channel", channelFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/projects/developer/sales-team?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view the sales team."
              : `Could not load sales team (${res.status}).`)
        );
      }
      setData((await res.json()) as SalesTeamResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load sales team.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter, channelFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view the sales team.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const openRepForm = () => {
    setShowRepForm(true);
    setShowMandateForm(false);
    setFormError(null);
    setActionMsg(null);
    setRepName("");
    setRepEmail("");
    setRepPhone("");
    setRepPassword("");
    setRepRole("Developer");
  };

  const openMandateForm = () => {
    setShowMandateForm(true);
    setShowRepForm(false);
    setFormError(null);
    setActionMsg(null);
    setMandateProjectId(data?.projects[0]?.id ?? "");
    setMandateAgencyId(data?.agencies[0]?.id ?? "");
    setMandateExclusive(true);
    setMandateCommission("2");
    setMandateNotes("");
  };

  const submitRep = async (e: FormEvent) => {
    e.preventDefault();
    if (!repName.trim() || !repEmail.trim() || !repPhone.trim() || !repPassword.trim()) {
      setFormError("All fields are required.");
      return;
    }
    if (repPassword.trim().length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await authFetch("/api/projects/developer/sales-team/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: repName.trim(),
          email: repEmail.trim(),
          phoneNumber: repPhone.trim(),
          password: repPassword.trim(),
          role: repRole,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `Could not add sales rep (${res.status}).`
        );
      }
      setActionMsg("Sales rep added. They can sign in with the email and password you set.");
      setShowRepForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not add sales rep.");
    } finally {
      setSaving(false);
    }
  };

  const submitMandate = async (e: FormEvent) => {
    e.preventDefault();
    if (!mandateProjectId || !mandateAgencyId) {
      setFormError("Select a project and an agency.");
      return;
    }
    const commission = Number(mandateCommission);
    setSaving(true);
    setFormError(null);
    try {
      const res = await authFetch("/api/projects/developer/sales-team/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: mandateProjectId,
          agencyOrgId: mandateAgencyId,
          isExclusive: mandateExclusive,
          commissionPercent: Number.isFinite(commission) ? commission : null,
          notes: mandateNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `Could not create mandate (${res.status}).`
        );
      }
      setActionMsg("Broker mandate created. Agency now appears under external channels.");
      setShowMandateForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not create mandate.");
    } finally {
      setSaving(false);
    }
  };

  const summary = data?.summary;
  const reps = data?.internalSales ?? [];
  const channels = data?.externalChannels ?? [];
  const projects = data?.projects ?? [];
  const agencies = data?.agencies ?? [];

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading sales team…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Sales & broker relations
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {summary?.internalRepsCount ?? 0} internal
            reps · {summary?.externalMandatesCount ?? 0} agency mandates · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openRepForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add sales rep
          </button>
          <button
            type="button"
            onClick={openMandateForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <Handshake className="w-3.5 h-3.5" />
            Affiliate agency
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
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
      {actionMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {actionMsg}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Internal</p>
            <p className="text-xl font-black text-slate-900">{summary.internalRepsCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Active reps</p>
            <p className="text-xl font-black text-emerald-900">{summary.activeInternalRepsCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Mandates</p>
            <p className="text-xl font-black text-amber-900">{summary.externalMandatesCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">Agencies</p>
            <p className="text-xl font-black text-blue-900">{summary.affiliatedAgenciesCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Active mandates</p>
            <p className="text-xl font-black text-emerald-900">{summary.activeMandatesCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Leads</p>
            <p className="text-xl font-black text-slate-900">{summary.totalAssignedLeads}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="all">All channels</option>
          <option value="internal">Internal only</option>
          <option value="external">External only</option>
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">All projects (mandates)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rep or agency…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {showRepForm && (
        <form
          onSubmit={(e) => void submitRep(e)}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-slate-900">Add internal sales rep</h4>
            <button type="button" onClick={() => setShowRepForm(false)} className="text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          {formError && <p className="text-xs text-rose-700">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              placeholder="Full name"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
            <input
              value={repEmail}
              onChange={(e) => setRepEmail(e.target.value)}
              placeholder="email@skylinedev.pk"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
            <input
              value={repPhone}
              onChange={(e) => setRepPhone(e.target.value)}
              placeholder="+92…"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
            <input
              type="password"
              value={repPassword}
              onChange={(e) => setRepPassword(e.target.value)}
              placeholder="Password (min 8)"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
            <select
              value={repRole}
              onChange={(e) => setRepRole(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="Developer">Developer (sales)</option>
              <option value="Finance">Finance</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-xl"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save sales rep
          </button>
        </form>
      )}

      {showMandateForm && (
        <form
          onSubmit={(e) => void submitMandate(e)}
          className="rounded-2xl border border-amber-200 bg-amber-50/20 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-slate-900">Affiliate brokerage to a project</h4>
            <button
              type="button"
              onClick={() => setShowMandateForm(false)}
              className="text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {formError && <p className="text-xs text-rose-700">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={mandateProjectId}
              onChange={(e) => setMandateProjectId(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={mandateAgencyId}
              onChange={(e) => setMandateAgencyId(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="">Select agency</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.licenseNumber ? ` · ${a.licenseNumber}` : ""}
                </option>
              ))}
            </select>
            <input
              value={mandateCommission}
              onChange={(e) => setMandateCommission(e.target.value)}
              placeholder="Commission %"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 px-1">
              <input
                type="checkbox"
                checked={mandateExclusive}
                onChange={(e) => setMandateExclusive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Exclusive marketing rights
            </label>
            <input
              value={mandateNotes}
              onChange={(e) => setMandateNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white sm:col-span-2"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 px-4 py-2 rounded-xl"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Create mandate
          </button>
        </form>
      )}

      {(channelFilter === "all" || channelFilter === "internal") && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            Internal sales reps ({reps.length})
          </h4>
          {reps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              No internal reps yet. Add a sales login for your firm.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reps.map((r) => (
                <div
                  key={r.userId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{r.fullName}</p>
                      <p className="text-[11px] text-slate-500">{r.role}</p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                    <a
                      href={`mailto:${r.email}`}
                      className="inline-flex items-center gap-1 hover:text-emerald-700"
                    >
                      <Mail className="w-3 h-3" />
                      {r.email}
                    </a>
                    {r.phoneNumber && (
                      <a
                        href={`tel:${r.phoneNumber}`}
                        className="inline-flex items-center gap-1 hover:text-emerald-700"
                      >
                        <Phone className="w-3 h-3" />
                        {r.phoneNumber}
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.assignedLeadsCount} leads · {r.pendingLeadsCount} pending · Joined{" "}
                    {formatDate(r.createdAtUtc)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(channelFilter === "all" || channelFilter === "external") && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-2">
            <Handshake className="w-4 h-4 text-amber-700" />
            External broker channels ({channels.length})
          </h4>
          {channels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              No agency mandates on your projects yet. Affiliate a brokerage to grant marketing
              rights.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 font-bold">Agency</th>
                    <th className="px-3 py-2.5 font-bold">Project</th>
                    <th className="px-3 py-2.5 font-bold">Rights</th>
                    <th className="px-3 py-2.5 font-bold">Commission</th>
                    <th className="px-3 py-2.5 font-bold">Brokers</th>
                    <th className="px-3 py-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.mandateId} className="border-b border-slate-50 bg-white">
                      <td className="px-3 py-3 align-top">
                        <p className="font-bold text-slate-900">{c.agencyName}</p>
                        <p className="text-slate-500 mt-0.5">
                          {c.agencyLicense || "No license"} · {c.agencyCity}
                          {c.agencyVerified ? " · Verified" : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1 text-slate-500">
                          {c.agencyContactPhone && (
                            <a href={`tel:${c.agencyContactPhone}`} className="hover:text-emerald-700">
                              {c.agencyContactPhone}
                            </a>
                          )}
                          {c.agencyContactEmail && (
                            <a
                              href={`mailto:${c.agencyContactEmail}`}
                              className="hover:text-emerald-700"
                            >
                              {c.agencyContactEmail}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {c.projectSlug ? (
                          <Link
                            href={`/projects/${c.projectSlug}`}
                            className="font-bold text-emerald-700 hover:underline"
                          >
                            {c.projectName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-800">{c.projectName}</span>
                        )}
                        <p className="text-slate-500 mt-0.5">
                          Since {formatDate(c.startDateUtc || c.createdAtUtc)}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        {c.isExclusive ? "Exclusive" : "Non-exclusive"}
                        {c.notes && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{c.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        {c.commissionPercent != null ? `${c.commissionPercent}%` : "—"}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-slate-800">
                        {c.brokerCount}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(c.status)}`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
