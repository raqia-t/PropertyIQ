"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PropertyMapDisplay from "@/components/maps/PropertyMapDisplay";

interface AgentVisit {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyArea?: string | null;
  propertyCity?: string | null;
  propertyLatitude?: number | null;
  propertyLongitude?: number | null;
  agentClientName?: string | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  scheduledAtUtc: string;
  durationMinutes: number;
  status: string;
  meetingPoint?: string | null;
  notes?: string | null;
}

type CalendarView = "week" | "month";

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_PX = 48;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function humanizeStatus(status: string): string {
  if (status === "NoShow") return "No-show";
  return status;
}

function statusColor(status: string): string {
  switch (status) {
    case "Confirmed":
      return "bg-emerald-600 border-emerald-700";
    case "Requested":
      return "bg-amber-500 border-amber-600";
    case "Completed":
      return "bg-slate-500 border-slate-600";
    case "Cancelled":
      return "bg-slate-300 border-slate-400 text-slate-700";
    default:
      return "bg-blue-600 border-blue-700";
  }
}

export default function AgentVisitCalendarSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [visits, setVisits] = useState<AgentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentVisit | null>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 7);
      return { start, end, label: `${formatDayHeader(start)} – ${formatDayHeader(addDays(start, 6))}` };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, label: formatMonthYear(cursor) };
  }, [view, cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    return cells;
  }, [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = range.start.toISOString();
      const to = range.end.toISOString();
      const res = await authFetch(`/api/agent/visits?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Sign in as an agent to view the visit calendar."
            : `Could not load visits (${res.status}).`
        );
      }
      const data = (await res.json()) as AgentVisit[];
      setVisits(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setVisits([]);
      setError(e instanceof Error ? e.message : "Failed to load visits.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, range.end, range.start]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view the visit calendar.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const visitsByDay = useMemo(() => {
    const map = new Map<string, AgentVisit[]>();
    for (const v of visits) {
      const d = new Date(v.scheduledAtUtc);
      const key = startOfDay(d).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduledAtUtc.localeCompare(b.scheduledAtUtc));
    }
    return map;
  }, [visits]);

  const goPrev = () => {
    if (view === "week") setCursor((c) => addDays(c, -7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  };

  const goNext = () => {
    if (view === "week") setCursor((c) => addDays(c, 7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  };

  const goToday = () => setCursor(startOfDay(new Date()));

  if (!isHydrated) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            Google Calendar–style schedule of site visits. Click an event for visitor details and
            the exact map pin (always shown to you, even when hidden on the public listing).
          </p>
          <Link
            href="/agent/visits"
            className="inline-block mt-1 text-xs font-bold text-emerald-700 hover:underline"
          >
            Manage visits list →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-3 py-2 ${view === "week" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`px-3 py-2 ${view === "month" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={goPrev} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Previous">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-sm sm:text-base font-black text-slate-900">{range.label}</h2>
        <button type="button" onClick={goNext} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Next">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {loading && visits.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : view === "week" ? (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
            <div className="p-2" />
            {weekDays.map((d) => (
              <div
                key={d.toISOString()}
                className={`p-2 text-center border-l border-slate-200 ${isSameDay(d, new Date()) ? "bg-emerald-50 text-emerald-800" : ""}`}
              >
                {formatDayHeader(d)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
            <div className="border-r border-slate-100">
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => (
                <div
                  key={h}
                  className="text-[10px] text-slate-400 pr-1 text-right border-b border-slate-100"
                  style={{ height: SLOT_PX }}
                >
                  {h}:00
                </div>
              ))}
            </div>
            {weekDays.map((day) => {
              const key = startOfDay(day).toISOString();
              const dayVisits = visitsByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`relative border-l border-slate-100 ${isSameDay(day, new Date()) ? "bg-emerald-50/30" : ""}`}
                  style={{ height: (HOUR_END - HOUR_START) * SLOT_PX }}
                >
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-slate-100/80"
                      style={{ top: i * SLOT_PX, height: SLOT_PX }}
                    />
                  ))}
                  {dayVisits.map((v) => {
                    const start = new Date(v.scheduledAtUtc);
                    const minutesFromStart = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
                    const top = (minutesFromStart / 60) * SLOT_PX;
                    const height = Math.max(28, (v.durationMinutes / 60) * SLOT_PX);
                    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return null;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelected(v)}
                        className={`absolute left-0.5 right-0.5 rounded-md border text-left px-1.5 py-1 text-[10px] font-bold text-white shadow-sm overflow-hidden ${statusColor(v.status)}`}
                        style={{ top, height, minHeight: 24 }}
                      >
                        <span className="block truncate">
                          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="block truncate opacity-95">{v.visitorName}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-2 text-center border-l border-slate-200 first:border-l-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[minmax(88px,1fr)]">
            {monthGrid.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const key = startOfDay(day).toISOString();
              const dayVisits = visitsByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`border border-slate-100 p-1.5 ${inMonth ? "bg-white" : "bg-slate-50/80"} ${isSameDay(day, new Date()) ? "ring-2 ring-inset ring-emerald-400" : ""}`}
                >
                  <p
                    className={`text-[11px] font-bold mb-1 ${inMonth ? "text-slate-800" : "text-slate-400"}`}
                  >
                    {day.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayVisits.slice(0, 3).map((v) => {
                      const t = new Date(v.scheduledAtUtc);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelected(v)}
                          className={`w-full text-left rounded px-1 py-0.5 text-[9px] font-bold text-white truncate ${statusColor(v.status)}`}
                        >
                          {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
                          {v.visitorName}
                        </button>
                      );
                    })}
                    {dayVisits.length > 3 && (
                      <p className="text-[9px] text-slate-500 font-semibold">+{dayVisits.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-700">Site visit</p>
                <h3 className="text-lg font-black text-slate-900">{selected.propertyTitle}</h3>
                <p className="text-xs text-slate-500">
                  {[selected.propertyArea, selected.propertyCity].filter(Boolean).join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">When</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {new Date(selected.scheduledAtUtc).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-slate-500">{selected.durationMinutes} min · {humanizeStatus(selected.status)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">With</p>
                <p className="font-bold text-slate-900 mt-0.5">{selected.visitorName}</p>
                {selected.agentClientName && (
                  <p className="text-slate-500">Client: {selected.agentClientName}</p>
                )}
                {selected.visitorPhone && (
                  <p className="flex items-center gap-1 text-slate-600 mt-1">
                    <Phone className="w-3 h-3" /> {selected.visitorPhone}
                  </p>
                )}
                {selected.visitorEmail && (
                  <p className="flex items-center gap-1 text-slate-600 truncate">
                    <Mail className="w-3 h-3 shrink-0" /> {selected.visitorEmail}
                  </p>
                )}
              </div>
            </div>

            {selected.meetingPoint && (
              <p className="text-xs text-slate-600">
                <span className="font-bold">Meeting point:</span> {selected.meetingPoint}
              </p>
            )}
            {selected.notes && (
              <p className="text-xs text-slate-600 whitespace-pre-wrap">
                <span className="font-bold">Notes:</span> {selected.notes}
              </p>
            )}

            {selected.propertyLatitude != null && selected.propertyLongitude != null ? (
              <PropertyMapDisplay
                latitude={selected.propertyLatitude}
                longitude={selected.propertyLongitude}
                title="Visit location (exact pin)"
              />
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No map pin on this listing yet. Add coordinates when editing the property.
              </p>
            )}

            <Link
              href={`/properties/${selected.propertyId}`}
              className="block text-center text-xs font-bold text-emerald-700 hover:underline"
            >
              View listing
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
