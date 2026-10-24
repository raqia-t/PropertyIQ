"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Mail, Phone, RefreshCw, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export interface AgentLead {
  id: string;
  propertyId?: string | null;
  propertyTitle: string | null;
  projectName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  status: string;
  agentNotes?: string | null;
  createdAtUtc: string;
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

export default function AgentLeadsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [cardMessage, setCardMessage] = useState<
    Record<string, { type: "ok" | "err"; text: string }>
  >({});
  const [filter, setFilter] = useState<string>("All");

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/inquiries/agent");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load leads (${res.status}).`
        );
      }
      const data = (await res.json()) as AgentLead[];
      const list = Array.isArray(data) ? data : [];
      setLeads(list);
      const noteDrafts: Record<string, string> = {};
      const statusDrafts: Record<string, string> = {};
      for (const lead of list) {
        noteDrafts[lead.id] = lead.agentNotes ?? "";
        statusDrafts[lead.id] = lead.status;
      }
      setNotesDraft(noteDrafts);
      setStatusDraft(statusDrafts);
      setScheduleDraft((prev) => {
        const next = { ...prev };
        for (const lead of list) {
          if (!next[lead.id]) next[lead.id] = defaultVisitLocal();
        }
        return next;
      });
    } catch (e: unknown) {
      setLeads([]);
      setError(e instanceof Error ? e.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view leads.");
      return;
    }
    void loadLeads();
  }, [isHydrated, isAuthenticated, loadLeads]);

  const pendingCount = useMemo(
    () => leads.filter((l) => l.status === "New").length,
    [leads]
  );

  const visibleLeads = useMemo(() => {
    if (filter === "All") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const parseApiError = async (res: Response): Promise<string> => {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    if (typeof err.message === "string" && err.message) return err.message;
    if (typeof err.title === "string" && err.title) {
      const details = err.errors as Record<string, string[]> | undefined;
      if (details) {
        const first = Object.values(details).flat()[0];
        if (first) return first;
      }
      return err.title;
    }
    return `Update failed (${res.status}).`;
  };

  const saveLead = async (leadId: string) => {
    const status = statusDraft[leadId] || "New";
    const agentNotes = notesDraft[leadId] ?? "";

    setUpdatingId(leadId);
    setError(null);
    setCardMessage((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });

    try {
      const res = await authFetch(`/api/inquiries/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          agentNotes,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
      };

      const savedStatus = result.status || status;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: savedStatus, agentNotes } : l
        )
      );
      setStatusDraft((prev) => ({ ...prev, [leadId]: savedStatus }));
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: { type: "ok", text: "Saved — status and notes updated." },
      }));
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Could not update lead.";
      setError(text);
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: { type: "err", text },
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  const promoteToCrm = async (leadId: string) => {
    setPromotingId(leadId);
    setError(null);
    setCardMessage((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });

    try {
      const res = await authFetch(`/api/agent/clients/from-inquiry/${leadId}`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setCardMessage((prev) => ({
        ...prev,
        [leadId]: {
          type: "ok",
          text: "Added to CRM — view in Clients.",
        },
      }));
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Could not add to CRM.";
      setError(text);
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: { type: "err", text },
      }));
    } finally {
      setPromotingId(null);
    }
  };

  const scheduleVisit = async (leadId: string) => {
    const local = scheduleDraft[leadId];
    if (!local) {
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: { type: "err", text: "Pick a date and time for the visit." },
      }));
      return;
    }

    setSchedulingId(leadId);
    setError(null);
    setCardMessage((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });

    try {
      const res = await authFetch(`/api/agent/visits/from-inquiry/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAtUtc: new Date(local).toISOString(),
          durationMinutes: 60,
          status: "Confirmed",
          updateInquiryStatus: true,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: "ViewingScheduled" } : l
        )
      );
      setStatusDraft((prev) => ({ ...prev, [leadId]: "ViewingScheduled" }));
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: {
          type: "ok",
          text: "Visit scheduled — view in Visits.",
        },
      }));
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Could not schedule visit.";
      setError(text);
      setCardMessage((prev) => ({
        ...prev,
        [leadId]: { type: "err", text },
      }));
    } finally {
      setSchedulingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading lead inquiries…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Inquiry Pipeline
            {pendingCount > 0 ? ` (${pendingCount} New)` : ` (${leads.length})`}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live inquiries from property detail pages for your listings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
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

      {visibleLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No leads yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            When a buyer sends an inquiry from a property detail page, it will appear here with
            status <span className="font-semibold">New</span>.
          </p>
          <Link
            href="/agent"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline pt-1"
          >
            Back to dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleLeads.map((lead) => {
            const open = expandedId === lead.id;
            const busy = updatingId === lead.id;
            return (
              <div
                key={lead.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {lead.contactName}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(lead.status)}`}
                      >
                        {humanizeStatus(lead.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-slate-500">
                      {lead.contactPhone && (
                        <a
                          href={`tel:${lead.contactPhone}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.contactPhone}
                        </a>
                      )}
                      {lead.contactEmail && (
                        <a
                          href={`mailto:${lead.contactEmail}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Mail className="w-3 h-3" />
                          {lead.contactEmail}
                        </a>
                      )}
                      <span className="text-slate-400">{formatLeadDate(lead.createdAtUtc)}</span>
                    </div>
                    <p className="text-slate-700 font-medium">
                      {lead.propertyTitle || lead.projectName || "Property inquiry"}
                    </p>
                    {lead.propertyId && (
                      <Link
                        href={`/properties/${lead.propertyId}`}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        Open listing
                      </Link>
                    )}
                    <p className="text-slate-500 italic">&quot;{lead.message}&quot;</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((prev) => (prev === lead.id ? null : lead.id))
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition"
                    >
                      {open ? "Close" : "Reply / Update"}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    {cardMessage[lead.id] && (
                      <div
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          cardMessage[lead.id].type === "ok"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border border-rose-200 text-rose-800"
                        }`}
                      >
                        {cardMessage[lead.id].text}
                        {cardMessage[lead.id].type === "ok" &&
                          cardMessage[lead.id].text.startsWith("Added to CRM") && (
                            <>
                              {" "}
                              <Link href="/agent/clients" className="underline">
                                Open Clients
                              </Link>
                            </>
                          )}
                        {cardMessage[lead.id].type === "ok" &&
                          cardMessage[lead.id].text.startsWith("Visit scheduled") && (
                            <>
                              {" "}
                              <Link href="/agent/visits" className="underline">
                                Open Visits
                              </Link>
                            </>
                          )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </label>
                        <select
                          value={statusDraft[lead.id] ?? lead.status}
                          disabled={busy}
                          onChange={(e) =>
                            setStatusDraft((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {humanizeStatus(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Agent notes
                        </label>
                        <textarea
                          rows={2}
                          value={notesDraft[lead.id] ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Called buyer, visit proposed for Saturday"
                          className="w-full mt-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    {lead.propertyId && (
                      <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
                            Schedule site visit
                          </label>
                          <input
                            type="datetime-local"
                            value={scheduleDraft[lead.id] ?? defaultVisitLocal()}
                            disabled={schedulingId === lead.id}
                            onChange={(e) =>
                              setScheduleDraft((prev) => ({
                                ...prev,
                                [lead.id]: e.target.value,
                              }))
                            }
                            className="w-full mt-1 text-xs bg-white border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={
                            busy ||
                            schedulingId === lead.id ||
                            promotingId === lead.id ||
                            !lead.propertyId
                          }
                          onClick={() => void scheduleVisit(lead.id)}
                          className="inline-flex items-center justify-center gap-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition"
                        >
                          {schedulingId === lead.id ? (
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
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy || promotingId === lead.id || schedulingId === lead.id}
                        onClick={() => void promoteToCrm(lead.id)}
                        className="inline-flex items-center justify-center gap-1.5 min-w-[120px] bg-white border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 text-emerald-800 font-bold px-4 py-2.5 rounded-xl transition"
                      >
                        {promotingId === lead.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Adding…</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add to CRM</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy || promotingId === lead.id}
                        onClick={() => void saveLead(lead.id)}
                        className="inline-flex items-center justify-center gap-1.5 min-w-[120px] bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold px-4 py-2.5 rounded-xl transition"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving…</span>
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
