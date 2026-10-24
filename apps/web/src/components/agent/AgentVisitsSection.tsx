"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Mail, Phone, PlusCircle, RefreshCw, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgentVisit {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyArea?: string | null;
  propertyCity?: string | null;
  agentClientId?: string | null;
  agentClientName?: string | null;
  inquiryId?: string | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  scheduledAtUtc: string;
  durationMinutes: number;
  status: string;
  meetingPoint?: string | null;
  notes?: string | null;
  createdAtUtc: string;
}

interface ListingOption {
  id: string;
  title: string;
}

interface ClientOption {
  id: string;
  fullName: string;
  phone: string;
}

const VISIT_STATUSES = [
  "Requested",
  "Confirmed",
  "Completed",
  "NoShow",
  "Cancelled",
] as const;

function humanizeStatus(status: string): string {
  if (status === "NoShow") return "No-show";
  return status;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Confirmed":
      return "bg-emerald-100 text-emerald-800";
    case "Requested":
      return "bg-amber-100 text-amber-800";
    case "Completed":
      return "bg-slate-200 text-slate-700";
    case "NoShow":
      return "bg-rose-100 text-rose-800";
    case "Cancelled":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatVisitWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Convert ISO UTC to value suitable for datetime-local input (local timezone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local string → ISO UTC for API */
function localInputToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

function defaultScheduleLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(15, 0, 0, 0);
  return toLocalInputValue(d.toISOString());
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function visitLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localDateKey(d);
}

function formatDayHeading(key: string): string {
  const [y, m, day] = key.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AgentVisitsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [visits, setVisits] = useState<AgentVisit[]>([]);
  const [calendarVisits, setCalendarVisits] = useState<AgentVisit[]>([]);
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cardMsg, setCardMsg] = useState<Record<string, { type: "ok" | "err"; text: string }>>(
    {}
  );
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [whenDraft, setWhenDraft] = useState<Record<string, string>>({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(() => localDateKey(new Date()));

  const [form, setForm] = useState({
    propertyId: "",
    agentClientId: "",
    visitorName: "",
    visitorPhone: "",
    scheduledLocal: defaultScheduleLocal(),
    durationMinutes: "60",
    status: "Confirmed",
    meetingPoint: "",
    notes: "",
  });

  const loadOptions = useCallback(async () => {
    const [listRes, clientRes] = await Promise.all([
      authFetch("/api/agent/listings"),
      authFetch("/api/agent/clients"),
    ]);
    if (listRes.ok) {
      const data = (await listRes.json()) as ListingOption[];
      setListings(Array.isArray(data) ? data.map((l) => ({ id: l.id, title: l.title })) : []);
    }
    if (clientRes.ok) {
      const data = (await clientRes.json()) as ClientOption[];
      setClients(
        Array.isArray(data)
          ? data.map((c) => ({ id: c.id, fullName: c.fullName, phone: c.phone }))
          : []
      );
    }
  }, [authFetch]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scope !== "all") params.set("scope", scope);
      if (statusFilter !== "All") params.set("status", statusFilter);
      const qs = params.toString();

      const [listRes, calRes] = await Promise.all([
        authFetch(`/api/agent/visits${qs ? `?${qs}` : ""}`),
        authFetch("/api/agent/visits?scope=all"),
      ]);

      if (!listRes.ok) {
        throw new Error(
          listRes.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load visits (${listRes.status}).`
        );
      }
      const data = (await listRes.json()) as AgentVisit[];
      const list = Array.isArray(data) ? data : [];
      setVisits(list);

      if (calRes.ok) {
        const calData = (await calRes.json()) as AgentVisit[];
        setCalendarVisits(
          (Array.isArray(calData) ? calData : []).filter((v) => v.status !== "Cancelled")
        );
      }

      const statuses: Record<string, string> = {};
      const notes: Record<string, string> = {};
      const whens: Record<string, string> = {};
      for (const v of list) {
        statuses[v.id] = v.status;
        notes[v.id] = v.notes ?? "";
        whens[v.id] = toLocalInputValue(v.scheduledAtUtc);
      }
      setStatusDraft(statuses);
      setNotesDraft(notes);
      setWhenDraft(whens);
    } catch (e: unknown) {
      setVisits([]);
      setError(e instanceof Error ? e.message : "Failed to load visits.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, statusFilter]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view scheduled visits.");
      return;
    }
    void loadOptions();
    void loadVisits();
  }, [isHydrated, isAuthenticated, loadOptions, loadVisits]);

  const countLabel = useMemo(
    () => `${visits.length} visit${visits.length === 1 ? "" : "s"}`,
    [visits.length]
  );

  const visitsByDay = useMemo(() => {
    const map = new Map<string, AgentVisit[]>();
    for (const v of calendarVisits) {
      const key = visitLocalDateKey(v.scheduledAtUtc);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(v);
      map.set(key, bucket);
    }
    for (const [, bucket] of map) {
      bucket.sort(
        (a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime()
      );
    }
    return map;
  }, [calendarVisits]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; day: number; inMonth: boolean } | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        key: `${year}-${pad2(month + 1)}-${pad2(day)}`,
        day,
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const selectedDayVisits = useMemo(
    () => visitsByDay.get(selectedDayKey) ?? [],
    [visitsByDay, selectedDayKey]
  );

  const monthLabel = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const todayKey = localDateKey(new Date());

  const resetForm = () => {
    setForm({
      propertyId: listings[0]?.id ?? "",
      agentClientId: "",
      visitorName: "",
      visitorPhone: "",
      scheduledLocal: defaultScheduleLocal(),
      durationMinutes: "60",
      status: "Confirmed",
      meetingPoint: "",
      notes: "",
    });
  };

  const onClientPick = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setForm((f) => ({
      ...f,
      agentClientId: clientId,
      visitorName: client?.fullName ?? f.visitorName,
      visitorPhone: client?.phone ?? f.visitorPhone,
    }));
  };

  const createVisit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.propertyId) throw new Error("Select a property listing.");
      if (!form.visitorName.trim() && !form.agentClientId) {
        throw new Error("Pick a CRM client or enter a visitor name.");
      }

      const res = await authFetch("/api/agent/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          agentClientId: form.agentClientId || null,
          visitorName: form.visitorName.trim() || null,
          visitorPhone: form.visitorPhone.trim() || null,
          scheduledAtUtc: localInputToIso(form.scheduledLocal),
          durationMinutes: Number(form.durationMinutes) || 60,
          status: form.status,
          meetingPoint: form.meetingPoint.trim() || null,
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
      await loadVisits();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not schedule visit.");
    } finally {
      setSaving(false);
    }
  };

  const saveVisit = async (id: string) => {
    setUpdatingId(id);
    setCardMsg((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await authFetch(`/api/agent/visits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft[id],
          notes: notesDraft[id] ?? "",
          scheduledAtUtc: whenDraft[id] ? localInputToIso(whenDraft[id]) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Update failed (${res.status}).`
        );
      }
      const updated = (await res.json()) as AgentVisit;
      setVisits((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setWhenDraft((prev) => ({ ...prev, [id]: toLocalInputValue(updated.scheduledAtUtc) }));
      setCardMsg((prev) => ({ ...prev, [id]: { type: "ok", text: "Visit updated." } }));
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Could not update visit.";
      setCardMsg((prev) => ({ ...prev, [id]: { type: "err", text } }));
    } finally {
      setUpdatingId(null);
    }
  };

  const cancelVisit = async (id: string) => {
    if (!window.confirm("Cancel and remove this site visit?")) return;
    setUpdatingId(id);
    try {
      const res = await authFetch(`/api/agent/visits/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Cancel failed (${res.status}).`
        );
      }
      setVisits((prev) => prev.filter((v) => v.id !== id));
      setExpandedId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not cancel visit.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Site Visits ({countLabel})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Confirmed in-person viewings for your listings — live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "upcoming" | "past" | "all")}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
          >
            <option value="All">All statuses</option>
            {VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanizeStatus(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadVisits()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              if (!showForm) {
                setForm((f) => ({
                  ...f,
                  propertyId: f.propertyId || listings[0]?.id || "",
                  scheduledLocal: f.scheduledLocal || defaultScheduleLocal(),
                }));
              }
              setShowForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl transition"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
            {showForm ? "Close form" : "Schedule visit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {loading && visits.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading scheduled visits…
            </div>
          )}

          {showForm && (
            <form
              onSubmit={createVisit}
              className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3"
            >
              <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-emerald-700" />
                Schedule site visit
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="font-semibold text-slate-600">Property *</label>
                  <select
                    required
                    value={form.propertyId}
                    onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
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
                  <label className="font-semibold text-slate-600">CRM client</label>
                  <select
                    value={form.agentClientId}
                    onChange={(e) => onClientPick(e.target.value)}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Manual visitor…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600">When *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.scheduledLocal}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledLocal: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Visitor name *</label>
                  <input
                    required={!form.agentClientId}
                    value={form.visitorName}
                    onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Phone</label>
                  <input
                    value={form.visitorPhone}
                    onChange={(e) => setForm((f) => ({ ...f, visitorPhone: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={form.durationMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                  >
                    {VISIT_STATUSES.filter((s) => s !== "Cancelled").map((s) => (
                      <option key={s} value={s}>
                        {humanizeStatus(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Meeting point</label>
                  <input
                    value={form.meetingPoint}
                    onChange={(e) => setForm((f) => ({ ...f, meetingPoint: e.target.value }))}
                    placeholder="Gate / driveway"
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
                    "Save visit"
                  )}
                </button>
              </div>
            </form>
          )}

          {!loading && visits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
              <p className="text-sm font-bold text-slate-800">No visits in this view</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Schedule a viewing for one of your listings, or create one from a lead in the inbox.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Schedule visit
                </button>
                <Link
                  href="/agent/leads"
                  className="inline-flex items-center text-xs font-bold text-emerald-700 hover:underline px-2"
                >
                  Open leads inbox
                </Link>
              </div>
            </div>
          ) : visits.length > 0 ? (
            <div className="space-y-3 text-xs">
              {visits.map((visit) => {
                const open = expandedId === visit.id;
                const busy = updatingId === visit.id;
                return (
                  <div
                    key={visit.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {visit.propertyTitle}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(visit.status)}`}
                          >
                            {humanizeStatus(visit.status)}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium">
                          Client: {visit.visitorName}
                          {visit.agentClientName && visit.agentClientName !== visit.visitorName
                            ? ` (${visit.agentClientName})`
                            : ""}
                          {" · "}
                          {formatVisitWhen(visit.scheduledAtUtc)}
                          {" · "}
                          {visit.durationMinutes} min
                        </p>
                        {(visit.propertyArea || visit.propertyCity) && (
                          <p className="text-slate-500">
                            {[visit.propertyArea, visit.propertyCity].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {visit.meetingPoint && (
                          <p className="text-slate-500">Meet: {visit.meetingPoint}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-slate-500">
                          {visit.visitorPhone && (
                            <a
                              href={`tel:${visit.visitorPhone}`}
                              className="inline-flex items-center gap-1 hover:text-emerald-700"
                            >
                              <Phone className="w-3 h-3" />
                              {visit.visitorPhone}
                            </a>
                          )}
                          {visit.visitorEmail && (
                            <a
                              href={`mailto:${visit.visitorEmail}`}
                              className="inline-flex items-center gap-1 hover:text-emerald-700"
                            >
                              <Mail className="w-3 h-3" />
                              {visit.visitorEmail}
                            </a>
                          )}
                          <Link
                            href={`/properties/${visit.propertyId}`}
                            className="text-emerald-700 font-semibold hover:underline"
                          >
                            Open listing
                          </Link>
                        </div>
                        {visit.notes && !open && (
                          <p className="text-slate-500 italic line-clamp-2">&quot;{visit.notes}&quot;</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === visit.id ? null : visit.id))
                        }
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition"
                      >
                        {open ? "Close" : "Update"}
                      </button>
                    </div>

                    {open && (
                      <div className="pt-3 border-t border-slate-200 space-y-3">
                        {cardMsg[visit.id] && (
                          <div
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                              cardMsg[visit.id].type === "ok"
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border border-rose-200 text-rose-800"
                            }`}
                          >
                            {cardMsg[visit.id].text}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">
                              Status
                            </label>
                            <select
                              value={statusDraft[visit.id] ?? visit.status}
                              disabled={busy}
                              onChange={(e) =>
                                setStatusDraft((prev) => ({
                                  ...prev,
                                  [visit.id]: e.target.value,
                                }))
                              }
                              className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                            >
                              {VISIT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {humanizeStatus(s)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">
                              When
                            </label>
                            <input
                              type="datetime-local"
                              value={whenDraft[visit.id] ?? ""}
                              disabled={busy}
                              onChange={(e) =>
                                setWhenDraft((prev) => ({
                                  ...prev,
                                  [visit.id]: e.target.value,
                                }))
                              }
                              className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">
                              Notes
                            </label>
                            <input
                              value={notesDraft[visit.id] ?? ""}
                              disabled={busy}
                              onChange={(e) =>
                                setNotesDraft((prev) => ({
                                  ...prev,
                                  [visit.id]: e.target.value,
                                }))
                              }
                              className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void cancelVisit(visit.id)}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancel visit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveVisit(visit.id)}
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
          ) : null}
        </div>

        {/* Calendar panel — right column on lg+ (shown first on narrow screens) */}
        <aside className="lg:sticky lg:top-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-emerald-50/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Visit calendar
            </p>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h4 className="text-sm font-extrabold text-slate-900">{monthLabel}</h4>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[10px] font-bold uppercase text-slate-400 py-1">
                  {d}
                </div>
              ))}
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }
                const dayVisits = visitsByDay.get(cell.key) ?? [];
                const count = dayVisits.length;
                const isSelected = cell.key === selectedDayKey;
                const isToday = cell.key === todayKey;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDayKey(cell.key)}
                    className={`aspect-square rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition relative ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : isToday
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"
                          : count > 0
                            ? "bg-emerald-50/70 text-slate-900 hover:bg-emerald-100"
                            : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{cell.day}</span>
                    {count > 0 && (
                      <span
                        className={`text-[9px] font-extrabold leading-none ${
                          isSelected ? "text-emerald-100" : "text-emerald-700"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Selected day
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {formatDayHeading(selectedDayKey)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedDayVisits.length} visit
                  {selectedDayVisits.length === 1 ? "" : "s"}
                </span>
              </div>

              {selectedDayVisits.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No visits scheduled on this date.
                </p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedDayVisits.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs space-y-0.5 cursor-pointer hover:border-emerald-300 transition"
                      onClick={() => setExpandedId(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(v.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {v.visitorName}
                        </span>
                        <span className="shrink-0 text-slate-500 font-semibold">
                          {formatTimeOnly(v.scheduledAtUtc)}
                        </span>
                      </div>
                      <p className="text-slate-600 truncate">{v.propertyTitle}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(v.status)}`}
                      >
                        {humanizeStatus(v.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              Days with visits show a count. Click a date to see customers.
            </p>
            <Link
              href="/agent/visit-calendar"
              className="block text-center text-[11px] font-bold text-emerald-700 hover:underline pt-1"
            >
              Full week / month calendar →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
