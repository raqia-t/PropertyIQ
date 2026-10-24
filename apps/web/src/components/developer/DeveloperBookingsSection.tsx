"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface BookingProject {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
}

interface NextPayment {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  status: string;
}

interface DeveloperBooking {
  id: string;
  unitId: string;
  unitNumber: string;
  unitType: string;
  projectId?: string | null;
  projectName: string;
  projectSlug?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  totalAgreedPrice: number;
  currency: string;
  status: string;
  bookedAtUtc: string;
  totalPaid: number;
  remainingBalance: number;
  scheduleItemCount: number;
  paidScheduleItemCount: number;
  pendingProofCount: number;
  nextPaymentDue?: NextPayment | null;
}

interface ScheduleItem {
  id: string;
  sequenceNumber: number;
  title: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: string;
  paidAmount: number;
  paidAtUtc?: string | null;
  paymentProofStorageKey?: string | null;
  adjustmentReason?: string | null;
}

interface BookingDetail {
  id: string;
  totalAgreedPrice: number;
  currency: string;
  status: string;
  bookedAtUtc: string;
  totalPaid: number;
  remainingBalance: number;
  scheduleItems: ScheduleItem[];
}

interface BookingsResponse {
  organization: { name: string; licenseNumber?: string | null };
  summary: {
    totalBookings: number;
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    cancelledCount: number;
    totalAgreedValue: number;
    totalCollected: number;
    pendingDue: number;
    filteredCount: number;
  };
  projects: BookingProject[];
  bookings: DeveloperBooking[];
}

const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;

function formatPkr(amount: number, currency = "PKR"): string {
  if (amount >= 10_000_000) return `${currency} ${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `${currency} ${(amount / 100_000).toFixed(2)} Lakh`;
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Confirmed":
    case "Paid":
      return "bg-emerald-100 text-emerald-800";
    case "Pending":
    case "Due":
    case "Scheduled":
      return "bg-amber-100 text-amber-800";
    case "Completed":
      return "bg-slate-200 text-slate-800";
    case "Cancelled":
    case "Overdue":
      return "bg-rose-100 text-rose-800";
    case "PartiallyPaid":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function proofHref(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/media-files/${url}`;
}

export default function DeveloperBookingsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<BookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyProofId, setBusyProofId] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/bookings/developer${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view bookings."
              : `Could not load bookings (${res.status}).`)
        );
      }
      setData((await res.json()) as BookingsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view bookings.");
      return;
    }
    void loadBookings();
  }, [isHydrated, isAuthenticated, loadBookings]);

  const loadDetail = async (bookingId: string) => {
    if (expandedId === bookingId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(bookingId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error(`Could not load booking detail (${res.status}).`);
      setDetail((await res.json()) as BookingDetail);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Failed to load schedule");
      setExpandedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateBookingStatus = async (
    bookingId: string,
    status: "Cancelled" | "Confirmed" | "Completed",
    reason: string
  ) => {
    setBusyBookingId(bookingId);
    setActionMsg(null);
    try {
      const path =
        status === "Cancelled"
          ? `/api/bookings/${bookingId}/cancel`
          : `/api/bookings/${bookingId}/status`;
      const res = await authFetch(path, {
        method: status === "Cancelled" ? "POST" : "PUT",
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `Status update failed (${res.status})`
        );
      }
      const body = (await res.json()) as { message?: string };
      setActionMsg(body.message || `Booking → ${status}`);
      await loadBookings();
      if (expandedId === bookingId) {
        const detailRes = await authFetch(`/api/bookings/${bookingId}`);
        if (detailRes.ok) setDetail((await detailRes.json()) as BookingDetail);
      }
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not update booking");
    } finally {
      setBusyBookingId(null);
    }
  };

  const verifyProof = async (
    bookingId: string,
    scheduleItemId: string,
    amount: number,
    approve: boolean
  ) => {
    setBusyProofId(scheduleItemId);
    setActionMsg(null);
    try {
      const res = await authFetch(
        `/api/bookings/${bookingId}/schedule/${scheduleItemId}/verify`,
        {
          method: "POST",
          body: JSON.stringify({
            approve,
            approvedAmount: approve ? amount : undefined,
            reason: approve
              ? "Approved from developer bookings page"
              : "Rejected from developer bookings page",
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `Verification failed (${res.status})`
        );
      }
      setActionMsg(approve ? "Payment proof approved." : "Payment proof rejected.");
      await loadBookings();
      const detailRes = await authFetch(`/api/bookings/${bookingId}`);
      if (detailRes.ok) setDetail((await detailRes.json()) as BookingDetail);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not verify payment");
    } finally {
      setBusyProofId(null);
    }
  };

  const bookings = data?.bookings ?? [];
  const summary = data?.summary;
  const projects = data?.projects ?? [];

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading bookings…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Customer bookings
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {summary?.totalBookings ?? 0} bookings
            firm-wide
            {summary ? ` · showing ${summary.filteredCount}` : ""} · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/developer/installments"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Installments →
          </Link>
          <button
            type="button"
            onClick={() => void loadBookings()}
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
            <p className="text-[10px] font-bold uppercase text-slate-400">Bookings</p>
            <p className="text-xl font-black text-slate-900">{summary.totalBookings}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Pending</p>
            <p className="text-xl font-black text-amber-900">{summary.pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Confirmed</p>
            <p className="text-xl font-black text-emerald-900">{summary.confirmedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Completed</p>
            <p className="text-xl font-black text-slate-900">{summary.completedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Collected</p>
            <p className="text-sm font-black text-slate-900 mt-1">
              {formatPkr(summary.totalCollected)}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">Due / overdue</p>
            <p className="text-sm font-black text-rose-900 mt-1">
              {formatPkr(summary.pendingDue)}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit, buyer, project…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No bookings in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            When buyers reserve/book units from a public project page, contracts appear here with
            installment schedules.
          </p>
          <Link
            href="/developer/projects"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline"
          >
            View projects →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const open = expandedId === b.id;
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => void loadDetail(b.id)}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {b.unitNumber}
                        {b.projectName ? ` · ${b.projectName}` : ""}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(b.status)}`}
                      >
                        {b.status}
                      </span>
                      {b.pendingProofCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {b.pendingProofCount} proof
                          {b.pendingProofCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {b.customerName}
                      {b.customerPhone ? ` · ${b.customerPhone}` : ""}
                      {b.customerEmail ? ` · ${b.customerEmail}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Booked {formatDate(b.bookedAtUtc)} · Paid {formatPkr(b.totalPaid, b.currency)}{" "}
                      of {formatPkr(b.totalAgreedPrice, b.currency)} · Schedule{" "}
                      {b.paidScheduleItemCount}/{b.scheduleItemCount}
                    </p>
                    {b.nextPaymentDue && (
                      <p className="text-xs text-amber-700">
                        Next: {b.nextPaymentDue.title} · {formatDate(b.nextPaymentDue.dueDate)} ·{" "}
                        {formatPkr(b.nextPaymentDue.amount, b.currency)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-slate-600">
                    <span className="text-slate-800">
                      Balance {formatPkr(b.remainingBalance, b.currency)}
                    </span>
                    {open ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {b.status !== "Cancelled" && b.status !== "Completed" && (
                        <button
                          type="button"
                          disabled={busyBookingId === b.id}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Cancel this booking and free the unit (only if no paid installments)?"
                              )
                            ) {
                              void updateBookingStatus(
                                b.id,
                                "Cancelled",
                                "Cancelled from developer bookings page"
                              );
                            }
                          }}
                          className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl disabled:opacity-50"
                        >
                          Cancel booking
                        </button>
                      )}
                      {b.status === "Pending" && (
                        <button
                          type="button"
                          disabled={busyBookingId === b.id}
                          onClick={() =>
                            void updateBookingStatus(
                              b.id,
                              "Confirmed",
                              "Confirmed from developer bookings page"
                            )
                          }
                          className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl disabled:opacity-50"
                        >
                          Mark confirmed
                        </button>
                      )}
                      {b.status === "Confirmed" && (
                        <button
                          type="button"
                          disabled={busyBookingId === b.id}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Mark booking Completed and unit Sold? Prefer this when all installments are paid."
                              )
                            ) {
                              void updateBookingStatus(
                                b.id,
                                "Completed",
                                "Manually completed from developer bookings page"
                              );
                            }
                          }}
                          className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl disabled:opacity-50"
                        >
                          Mark completed / sold
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      {b.customerPhone && (
                        <a
                          href={`tel:${b.customerPhone}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Phone className="w-3 h-3" />
                          {b.customerPhone}
                        </a>
                      )}
                      {b.customerEmail && (
                        <a
                          href={`mailto:${b.customerEmail}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Mail className="w-3 h-3" />
                          {b.customerEmail}
                        </a>
                      )}
                      {b.projectSlug && (
                        <Link
                          href={`/projects/${b.projectSlug}`}
                          className="font-bold text-emerald-700 hover:underline"
                        >
                          Public project
                        </Link>
                      )}
                    </div>

                    {detailLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading installment schedule…
                      </div>
                    )}

                    {detail && detail.id === b.id && (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                              <th className="px-3 py-2 font-bold">#</th>
                              <th className="px-3 py-2 font-bold">Installment</th>
                              <th className="px-3 py-2 font-bold">Due</th>
                              <th className="px-3 py-2 font-bold">Amount</th>
                              <th className="px-3 py-2 font-bold">Paid</th>
                              <th className="px-3 py-2 font-bold">Status</th>
                              <th className="px-3 py-2 font-bold text-right">Proof</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.scheduleItems.map((item) => {
                              const href = proofHref(item.paymentProofStorageKey);
                              const needsVerify =
                                Boolean(item.paymentProofStorageKey) &&
                                item.status !== "Paid";
                              const busy = busyProofId === item.id;
                              return (
                                <tr key={item.id} className="border-b border-slate-50">
                                  <td className="px-3 py-2 text-slate-500">
                                    {item.sequenceNumber}
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-slate-800">
                                    {item.title}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {formatDate(item.dueDate)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-800">
                                    {formatPkr(item.amount, item.currency)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {formatPkr(item.paidAmount, item.currency)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(item.status)}`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                      {href && (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-bold text-slate-600 hover:underline"
                                        >
                                          View
                                        </a>
                                      )}
                                      {needsVerify && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void verifyProof(b.id, item.id, item.amount, true)
                                            }
                                            className="inline-flex items-center gap-0.5 font-bold text-emerald-700 disabled:opacity-50"
                                          >
                                            {busy ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Check className="w-3 h-3" />
                                            )}
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void verifyProof(b.id, item.id, item.amount, false)
                                            }
                                            className="inline-flex items-center gap-0.5 font-bold text-rose-700 disabled:opacity-50"
                                          >
                                            <X className="w-3 h-3" />
                                            Reject
                                          </button>
                                        </>
                                      )}
                                      {!href && !needsVerify && (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
