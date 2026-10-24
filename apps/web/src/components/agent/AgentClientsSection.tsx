"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Mail, Phone, PlusCircle, RefreshCw, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgentClient {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  clientSide: string;
  status: string;
  budgetMinPkr?: number | null;
  budgetMaxPkr?: number | null;
  targetAreas?: string | null;
  notes?: string | null;
  sourceInquiryId?: string | null;
  linkedBookingId?: string | null;
  linkedPropertyId?: string | null;
  linkedPropertyTitle?: string | null;
  activeBookingSummary?: string | null;
  createdAtUtc: string;
}

interface ListingOption {
  id: string;
  title: string;
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
    case "Active":
      return "bg-emerald-100 text-emerald-800";
    case "Prospect":
      return "bg-amber-100 text-amber-800";
    case "MandateSigned":
      return "bg-purple-100 text-purple-800";
    case "UnderOffer":
      return "bg-blue-100 text-blue-800";
    case "Closed":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function croreToPkr(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10_000_000);
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultVisitLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(15, 0, 0, 0);
  return toLocalInputValue(d.toISOString());
}

export default function AgentClientsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [cardMsg, setCardMsg] = useState<Record<string, { type: "ok" | "err"; text: string }>>(
    {}
  );
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [visitPropertyDraft, setVisitPropertyDraft] = useState<Record<string, string>>({});
  const [visitWhenDraft, setVisitWhenDraft] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    clientSide: "Buyer",
    status: "Prospect",
    budgetMinCr: "",
    budgetMaxCr: "",
    targetAreas: "",
    notes: "",
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadListings = useCallback(async () => {
    try {
      const res = await authFetch("/api/agent/listings");
      if (!res.ok) return;
      const data = (await res.json()) as ListingOption[];
      setListings(Array.isArray(data) ? data.map((l) => ({ id: l.id, title: l.title })) : []);
    } catch {
      setListings([]);
    }
  }, [authFetch]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sideFilter !== "All") params.set("side", sideFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const qs = params.toString();
      const res = await authFetch(`/api/agent/clients${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load clients (${res.status}).`
        );
      }
      const data = (await res.json()) as AgentClient[];
      const list = Array.isArray(data) ? data : [];
      setClients(list);

      const statuses: Record<string, string> = {};
      const notes: Record<string, string> = {};
      for (const c of list) {
        statuses[c.id] = c.status;
        notes[c.id] = c.notes ?? "";
      }
      setStatusDraft(statuses);
      setNotesDraft(notes);
      setVisitPropertyDraft((prev) => {
        const next = { ...prev };
        for (const c of list) {
          if (!next[c.id]) {
            next[c.id] = c.linkedPropertyId ?? "";
          }
        }
        return next;
      });
      setVisitWhenDraft((prev) => {
        const next = { ...prev };
        for (const c of list) {
          if (!next[c.id]) next[c.id] = defaultVisitLocal();
        }
        return next;
      });
    } catch (e: unknown) {
      setClients([]);
      setError(e instanceof Error ? e.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, sideFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view your CRM.");
      return;
    }
    void loadListings();
    void loadClients();
  }, [isHydrated, isAuthenticated, loadListings, loadClients]);

  const countLabel = useMemo(() => `${clients.length} client${clients.length === 1 ? "" : "s"}`, [clients.length]);

  const resetForm = () => {
    setForm({
      fullName: "",
      phone: "",
      email: "",
      clientSide: "Buyer",
      status: "Prospect",
      budgetMinCr: "",
      budgetMaxCr: "",
      targetAreas: "",
      notes: "",
    });
  };

  const createClient = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/agent/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          clientSide: form.clientSide,
          status: form.status,
          budgetMinPkr: croreToPkr(form.budgetMinCr),
          budgetMaxPkr: croreToPkr(form.budgetMaxCr),
          targetAreas: form.targetAreas.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Create failed (${res.status}).`
        );
      }
      setShowForm(false);
      resetForm();
      await loadClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create client.");
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async (id: string) => {
    setUpdatingId(id);
    setCardMsg((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await authFetch(`/api/agent/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft[id],
          notes: notesDraft[id] ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Update failed (${res.status}).`
        );
      }
      const updated = (await res.json()) as AgentClient;
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setCardMsg((prev) => ({
        ...prev,
        [id]: { type: "ok", text: "Client updated." },
      }));
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Could not update client.";
      setCardMsg((prev) => ({ ...prev, [id]: { type: "err", text } }));
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteClient = async (id: string) => {
    if (!window.confirm("Remove this client from your CRM?")) return;
    setUpdatingId(id);
    try {
      const res = await authFetch(`/api/agent/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Delete failed (${res.status}).`
        );
      }
      setClients((prev) => prev.filter((c) => c.id !== id));
      setExpandedId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete client.");
    } finally {
      setUpdatingId(null);
    }
  };

  const scheduleVisit = async (client: AgentClient) => {
    const propertyId = visitPropertyDraft[client.id] || client.linkedPropertyId || "";
    const whenLocal = visitWhenDraft[client.id];
    if (!propertyId) {
      setCardMsg((prev) => ({
        ...prev,
        [client.id]: { type: "err", text: "Select a listing for the visit." },
      }));
      return;
    }
    if (!whenLocal) {
      setCardMsg((prev) => ({
        ...prev,
        [client.id]: { type: "err", text: "Pick a date and time." },
      }));
      return;
    }

    setSchedulingId(client.id);
    setCardMsg((prev) => {
      const next = { ...prev };
      delete next[client.id];
      return next;
    });

    try {
      const res = await authFetch("/api/agent/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          agentClientId: client.id,
          visitorName: client.fullName,
          visitorPhone: client.phone,
          visitorEmail: client.email ?? null,
          scheduledAtUtc: new Date(whenLocal).toISOString(),
          durationMinutes: 60,
          status: "Confirmed",
          notes: `Scheduled from CRM client ${client.fullName}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Schedule failed (${res.status}).`
        );
      }
      setCardMsg((prev) => ({
        ...prev,
        [client.id]: { type: "ok", text: "Visit scheduled — view in Visits." },
      }));
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Could not schedule visit.";
      setCardMsg((prev) => ({ ...prev, [client.id]: { type: "err", text } }));
    } finally {
      setSchedulingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading client directory…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Client Directory ({countLabel})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Buyers, sellers, and investors in your CRM — live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, area…"
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-44 focus:outline-none focus:border-emerald-600"
          />
          <select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
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
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
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
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl transition"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
            {showForm ? "Close form" : "Add client"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createClient}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3"
        >
          <h4 className="font-bold text-sm text-slate-900">Add CRM client</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-600">Full name *</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Phone *</label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+92 300 1234567"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Side</label>
              <select
                value={form.clientSide}
                onChange={(e) => setForm((f) => ({ ...f, clientSide: e.target.value }))}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              >
                {CLIENT_SIDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanizeStatus(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Target areas</label>
              <input
                value={form.targetAreas}
                onChange={(e) => setForm((f) => ({ ...f, targetAreas: e.target.value }))}
                placeholder="DHA Phase 6, Bahria Town"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Budget min (Crore)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.budgetMinCr}
                onChange={(e) => setForm((f) => ({ ...f, budgetMinCr: e.target.value }))}
                placeholder="e.g. 2"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Budget max (Crore)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.budgetMaxCr}
                onChange={(e) => setForm((f) => ({ ...f, budgetMaxCr: e.target.value }))}
                placeholder="e.g. 10"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="font-semibold text-slate-600">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save client"
              )}
            </button>
          </div>
        </form>
      )}

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No clients in your CRM yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add a buyer/seller manually, or promote a lead from the Leads inbox.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
            >
              <PlusCircle className="w-4 h-4" />
              Add client
            </button>
            <Link
              href="/agent/leads"
              className="inline-flex items-center text-xs font-bold text-emerald-700 hover:underline px-2"
            >
              Open leads inbox
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {clients.map((client) => {
            const budget = formatBudget(client.budgetMinPkr, client.budgetMaxPkr);
            const open = expandedId === client.id;
            const busy = updatingId === client.id;
            return (
              <div
                key={client.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{client.fullName}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {client.clientSide}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(client.status)}`}
                      >
                        {humanizeStatus(client.status)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((prev) => (prev === client.id ? null : client.id))
                    }
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    {open ? "Close" : "Edit"}
                  </button>
                </div>

                {budget && <p className="text-slate-600">Budget: {budget}</p>}
                {client.targetAreas && (
                  <p className="text-slate-500">Target: {client.targetAreas}</p>
                )}
                <div className="flex flex-wrap gap-3 text-slate-500">
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
                      <Phone className="w-3 h-3" />
                      {client.phone}
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
                      <Mail className="w-3 h-3" />
                      {client.email}
                    </a>
                  )}
                </div>
                {client.linkedPropertyTitle && (
                  <p className="text-emerald-700 font-semibold">
                    Linked listing:{" "}
                    {client.linkedPropertyId ? (
                      <Link href={`/properties/${client.linkedPropertyId}`} className="underline">
                        {client.linkedPropertyTitle}
                      </Link>
                    ) : (
                      client.linkedPropertyTitle
                    )}
                  </p>
                )}
                {client.activeBookingSummary && (
                  <p className="text-emerald-700 font-semibold">{client.activeBookingSummary}</p>
                )}
                {client.notes && !open && (
                  <p className="text-slate-500 italic line-clamp-2">&quot;{client.notes}&quot;</p>
                )}

                {open && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    {cardMsg[client.id] && (
                      <div
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          cardMsg[client.id].type === "ok"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border border-rose-200 text-rose-800"
                        }`}
                      >
                        {cardMsg[client.id].text}
                        {cardMsg[client.id].type === "ok" &&
                          cardMsg[client.id].text.startsWith("Visit scheduled") && (
                            <>
                              {" "}
                              <Link href="/agent/visits" className="underline">
                                Open Visits
                              </Link>
                            </>
                          )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Status
                        </label>
                        <select
                          value={statusDraft[client.id] ?? client.status}
                          disabled={busy || schedulingId === client.id}
                          onChange={(e) =>
                            setStatusDraft((prev) => ({
                              ...prev,
                              [client.id]: e.target.value,
                            }))
                          }
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                        >
                          {CLIENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {humanizeStatus(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Notes
                        </label>
                        <input
                          value={notesDraft[client.id] ?? ""}
                          disabled={busy || schedulingId === client.id}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [client.id]: e.target.value,
                            }))
                          }
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
                        Schedule site visit
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="font-semibold text-slate-600">Listing *</label>
                          <select
                            value={
                              visitPropertyDraft[client.id] ||
                              client.linkedPropertyId ||
                              ""
                            }
                            disabled={schedulingId === client.id}
                            onChange={(e) =>
                              setVisitPropertyDraft((prev) => ({
                                ...prev,
                                [client.id]: e.target.value,
                              }))
                            }
                            className="w-full mt-1 bg-white border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Select listing…</option>
                            {listings.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-semibold text-slate-600">When *</label>
                          <input
                            type="datetime-local"
                            value={visitWhenDraft[client.id] ?? defaultVisitLocal()}
                            disabled={schedulingId === client.id}
                            onChange={(e) =>
                              setVisitWhenDraft((prev) => ({
                                ...prev,
                                [client.id]: e.target.value,
                              }))
                            }
                            className="w-full mt-1 bg-white border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={busy || schedulingId === client.id || listings.length === 0}
                          onClick={() => void scheduleVisit(client)}
                          className="inline-flex items-center justify-center gap-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition"
                        >
                          {schedulingId === client.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Scheduling…
                            </>
                          ) : (
                            <>
                              <CalendarClock className="w-3.5 h-3.5" />
                              Schedule visit
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between gap-2">
                      <button
                        type="button"
                        disabled={busy || schedulingId === client.id}
                        onClick={() => void deleteClient(client.id)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                      <button
                        type="button"
                        disabled={busy || schedulingId === client.id}
                        onClick={() => void saveClient(client.id)}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold px-4 py-2 rounded-xl transition"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </button>
                    </div>
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
