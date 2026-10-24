"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CreditCard,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface InstallmentProject {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
}

interface DeveloperInstallment {
  id: string;
  bookingId: string;
  scheduleItemId: string;
  sequenceNumber: number;
  title: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  currency: string;
  status: string;
  isOverdue: boolean;
  hasPendingProof: boolean;
  proofUrl?: string | null;
  paidAtUtc?: string | null;
  adjustmentReason?: string | null;
  unitNumber: string;
  unitType: string;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  bookingStatus: string;
}

interface InstallmentsResponse {
  organization: { name: string; licenseNumber?: string | null };
  summary: {
    totalInstallments: number;
    openCount: number;
    paidCount: number;
    dueCount: number;
    overdueCount: number;
    pendingProofCount: number;
    totalCollected: number;
    outstandingAmount: number;
    filteredCount: number;
  };
  projects: InstallmentProject[];
  installments: DeveloperInstallment[];
}

interface ScheduleItemDetail {
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

interface BookingScheduleDetail {
  id: string;
  status: string;
  currency: string;
  totalAgreedPrice: number;
  totalPaid: number;
  remainingBalance: number;
  bookedAtUtc: string;
  scheduleItems: ScheduleItemDetail[];
}

interface BookingGroup {
  bookingId: string;
  unitNumber: string;
  projectName: string;
  projectSlug?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  currency: string;
  items: DeveloperInstallment[];
  recent: DeveloperInstallment;
  openCount: number;
  paidCount: number;
  pendingProofCount: number;
  overdueCount: number;
}

const SCOPE_OPTIONS = [
  { value: "open", label: "Open (unpaid)" },
  { value: "pending_proof", label: "Pending proofs" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Due in 30 days" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
] as const;

const STATUS_OPTIONS = [
  "Scheduled",
  "Due",
  "PartiallyPaid",
  "Paid",
  "Overdue",
  "Waived",
  "Cancelled",
] as const;

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
    case "Paid":
      return "bg-emerald-100 text-emerald-800";
    case "Due":
    case "Scheduled":
      return "bg-amber-100 text-amber-800";
    case "Overdue":
    case "Cancelled":
      return "bg-rose-100 text-rose-800";
    case "PartiallyPaid":
      return "bg-blue-100 text-blue-800";
    case "Waived":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function proofHref(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/media-files/${url}`;
}

/** Prefer actionable installment: pending proof → overdue → due → earliest open → latest seq. */
function pickRecentInstallment(items: DeveloperInstallment[]): DeveloperInstallment {
  const sorted = [...items].sort((a, b) => {
    const score = (x: DeveloperInstallment) => {
      if (x.hasPendingProof) return 0;
      if (x.isOverdue || x.status === "Overdue") return 1;
      if (x.status === "Due") return 2;
      if (x.status === "PartiallyPaid") return 3;
      if (x.status !== "Paid" && x.status !== "Waived" && x.status !== "Cancelled") return 4;
      return 5;
    };
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const da = new Date(a.dueDate).getTime();
    const db = new Date(b.dueDate).getTime();
    if (sa <= 4 && Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
    return b.sequenceNumber - a.sequenceNumber;
  });
  return sorted[0]!;
}

function groupByBooking(installments: DeveloperInstallment[]): BookingGroup[] {
  const map = new Map<string, DeveloperInstallment[]>();
  for (const item of installments) {
    const list = map.get(item.bookingId) ?? [];
    list.push(item);
    map.set(item.bookingId, list);
  }

  const groups: BookingGroup[] = [];
  for (const [bookingId, items] of map) {
    const recent = pickRecentInstallment(items);
    groups.push({
      bookingId,
      unitNumber: recent.unitNumber,
      projectName: recent.projectName,
      projectSlug: recent.projectSlug,
      customerName: recent.customerName,
      customerPhone: recent.customerPhone,
      customerEmail: recent.customerEmail,
      currency: recent.currency,
      items,
      recent,
      openCount: items.filter(
        (i) => i.status !== "Paid" && i.status !== "Waived" && i.status !== "Cancelled"
      ).length,
      paidCount: items.filter((i) => i.status === "Paid").length,
      pendingProofCount: items.filter((i) => i.hasPendingProof).length,
      overdueCount: items.filter((i) => i.isOverdue || i.status === "Overdue").length,
    });
  }

  return groups.sort((a, b) => {
    if (a.pendingProofCount !== b.pendingProofCount) return b.pendingProofCount - a.pendingProofCount;
    if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
    return new Date(a.recent.dueDate).getTime() - new Date(b.recent.dueDate).getTime();
  });
}

export default function DeveloperInstallmentsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<InstallmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("open");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [busyProofId, setBusyProofId] = useState<string | null>(null);

  const [viewGroup, setViewGroup] = useState<BookingGroup | null>(null);
  const [detail, setDetail] = useState<BookingScheduleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadInstallments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      params.set("scope", scopeFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/bookings/developer/installments?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view installments."
              : `Could not load installments (${res.status}).`)
        );
      }
      setData((await res.json()) as InstallmentsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load installments.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter, scopeFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view installments.");
      return;
    }
    void loadInstallments();
  }, [isHydrated, isAuthenticated, loadInstallments]);

  const groups = useMemo(
    () => groupByBooking(data?.installments ?? []),
    [data?.installments]
  );

  const openSchedule = async (group: BookingGroup) => {
    setViewGroup(group);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/bookings/${group.bookingId}`);
      if (!res.ok) throw new Error(`Could not load schedule (${res.status})`);
      const json = (await res.json()) as Record<string, unknown>;
      const items = (json.scheduleItems ?? json.ScheduleItems ?? []) as Record<string, unknown>[];
      setDetail({
        id: String(json.id ?? json.Id ?? group.bookingId),
        status: String(json.status ?? json.Status ?? group.recent.bookingStatus),
        currency: String(json.currency ?? json.Currency ?? group.currency),
        totalAgreedPrice: Number(json.totalAgreedPrice ?? json.TotalAgreedPrice ?? 0),
        totalPaid: Number(json.totalPaid ?? json.TotalPaid ?? 0),
        remainingBalance: Number(json.remainingBalance ?? json.RemainingBalance ?? 0),
        bookedAtUtc: String(json.bookedAtUtc ?? json.BookedAtUtc ?? ""),
        scheduleItems: items
          .map((s) => ({
            id: String(s.id ?? s.Id ?? ""),
            sequenceNumber: Number(s.sequenceNumber ?? s.SequenceNumber ?? 0),
            title: String(s.title ?? s.Title ?? ""),
            dueDate: String(s.dueDate ?? s.DueDate ?? ""),
            amount: Number(s.amount ?? s.Amount ?? 0),
            currency: String(s.currency ?? s.Currency ?? group.currency),
            status: String(s.status ?? s.Status ?? ""),
            paidAmount: Number(s.paidAmount ?? s.PaidAmount ?? 0),
            paidAtUtc: (s.paidAtUtc ?? s.PaidAtUtc) as string | null | undefined,
            paymentProofStorageKey: (s.paymentProofStorageKey ??
              s.PaymentProofStorageKey) as string | null | undefined,
            adjustmentReason: (s.adjustmentReason ?? s.AdjustmentReason) as
              | string
              | null
              | undefined,
          }))
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber),
      });
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Failed to load schedule");
      setViewGroup(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeSchedule = () => {
    setViewGroup(null);
    setDetail(null);
  };

  const verifyProof = async (
    bookingId: string,
    scheduleItemId: string,
    amount: number,
    title: string,
    unitNumber: string,
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
              ? "Approved from developer installments page"
              : "Rejected from developer installments page",
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
      setActionMsg(
        approve
          ? `Approved ${title} for ${unitNumber}.`
          : `Rejected proof for ${unitNumber} · ${title}.`
      );
      await loadInstallments();
      if (viewGroup?.bookingId === bookingId) {
        await openSchedule(viewGroup);
      }
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not verify payment");
    } finally {
      setBusyProofId(null);
    }
  };

  const summary = data?.summary;
  const projects = data?.projects ?? [];
  const collectionRate =
    summary && summary.totalInstallments > 0
      ? Math.round((summary.paidCount / summary.totalInstallments) * 100)
      : 0;

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading installment schedule…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Installment schedules & proofs
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {summary?.totalInstallments ?? 0} schedule
            items firm-wide
            {summary ? ` · ${groups.length} buyer schedule${groups.length === 1 ? "" : "s"}` : ""}{" "}
            · one row per booking · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/developer/payment-plans"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Payment plans →
          </Link>
          <Link
            href="/developer/bookings"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            ← Bookings
          </Link>
          <button
            type="button"
            onClick={() => void loadInstallments()}
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
        <>
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold block text-sm">
                {collectionRate}% of schedule items marked Paid
              </span>
              <span className="text-emerald-800">
                {formatPkr(summary.totalCollected)} collected ·{" "}
                {formatPkr(summary.outstandingAmount)} outstanding across open installments
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScopeFilter("pending_proof")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shrink-0"
            >
              Review Pending Proofs ({summary.pendingProofCount})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Open</p>
              <p className="text-xl font-black text-slate-900">{summary.openCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Paid</p>
              <p className="text-xl font-black text-emerald-900">{summary.paidCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
              <p className="text-[10px] font-bold uppercase text-amber-700">Due</p>
              <p className="text-xl font-black text-amber-900">{summary.dueCount}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
              <p className="text-[10px] font-bold uppercase text-rose-700">Overdue</p>
              <p className="text-xl font-black text-rose-900">{summary.overdueCount}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-3">
              <p className="text-[10px] font-bold uppercase text-rose-700">Proofs</p>
              <p className="text-xl font-black text-rose-900">{summary.pendingProofCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p>
              <p className="text-sm font-black text-slate-900 mt-1">
                {formatPkr(summary.outstandingAmount)}
              </p>
            </div>
          </div>
        </>
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
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {SCOPE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">Any status</option>
          {STATUS_OPTIONS.map((s) => (
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
            placeholder="Search unit, buyer, title…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No installments in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Schedules are created when a booking is confirmed. Buyers upload proofs from My Bookings;
            they appear here for approve / reject.
          </p>
          <Link
            href="/developer/bookings"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline"
          >
            View bookings →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs min-w-[880px]">
            <thead>
              <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 font-bold">Unit / Buyer</th>
                <th className="px-3 py-2.5 font-bold">Current installment</th>
                <th className="px-3 py-2.5 font-bold">Due</th>
                <th className="px-3 py-2.5 font-bold">Amount</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const item = group.recent;
                const href = proofHref(item.proofUrl);
                const needsVerify = item.hasPendingProof;
                const busy = busyProofId === item.scheduleItemId;
                return (
                  <tr
                    key={group.bookingId}
                    className={`border-b border-slate-50 ${
                      group.overdueCount > 0
                        ? "bg-rose-50/30"
                        : group.pendingProofCount > 0
                          ? "bg-amber-50/20"
                          : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">
                          {group.unitNumber}
                          <span className="font-semibold text-slate-500">
                            {" "}
                            · {group.projectName}
                          </span>
                        </p>
                        <p className="text-slate-600">{group.customerName}</p>
                        <div className="flex flex-wrap gap-2 text-slate-500">
                          {group.customerPhone && (
                            <a
                              href={`tel:${group.customerPhone}`}
                              className="inline-flex items-center gap-0.5 hover:text-emerald-700"
                            >
                              <Phone className="w-3 h-3" />
                              {group.customerPhone}
                            </a>
                          )}
                          {group.customerEmail && (
                            <a
                              href={`mailto:${group.customerEmail}`}
                              className="inline-flex items-center gap-0.5 hover:text-emerald-700"
                            >
                              <Mail className="w-3 h-3" />
                              {group.customerEmail}
                            </a>
                          )}
                          {group.projectSlug && (
                            <Link
                              href={`/projects/${group.projectSlug}`}
                              className="inline-flex items-center gap-0.5 font-bold text-emerald-700 hover:underline"
                            >
                              Project
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 pt-0.5">
                          {group.items.length} installment
                          {group.items.length === 1 ? "" : "s"} in filter · {group.paidCount} paid
                          {group.openCount > 0 ? ` · ${group.openCount} open` : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-slate-800">
                        #{item.sequenceNumber} · {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Most relevant / current</p>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600">
                      {formatDate(item.dueDate)}
                      {item.isOverdue && (
                        <span className="block text-[10px] font-bold text-rose-700 mt-0.5">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-slate-800">
                        {formatPkr(item.amount, item.currency)}
                      </p>
                      {item.remaining > 0 && item.status !== "Paid" && (
                        <p className="text-amber-700 mt-0.5">
                          Left {formatPkr(item.remaining, item.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      {group.pendingProofCount > 0 && (
                        <span className="block mt-1 text-[10px] font-bold text-amber-800">
                          {group.pendingProofCount} proof
                          {group.pendingProofCount === 1 ? "" : "s"} pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openSchedule(group)}
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-slate-600 hover:underline"
                          >
                            View proof
                          </a>
                        )}
                        {needsVerify && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void verifyProof(
                                  item.bookingId,
                                  item.scheduleItemId,
                                  item.amount,
                                  item.title,
                                  item.unitNumber,
                                  true
                                )
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
                                void verifyProof(
                                  item.bookingId,
                                  item.scheduleItemId,
                                  item.amount,
                                  item.title,
                                  item.unitNumber,
                                  false
                                )
                              }
                              className="inline-flex items-center gap-0.5 font-bold text-rose-700 disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
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

      {viewGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {viewGroup.unitNumber} · {viewGroup.customerName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewGroup.projectName}
                  {detail
                    ? ` · ${detail.scheduleItems.length} installments · Paid ${formatPkr(detail.totalPaid, detail.currency)} of ${formatPkr(detail.totalAgreedPrice, detail.currency)}`
                    : " · Full payment schedule"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSchedule}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-3">
              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  Loading schedule…
                </div>
              )}

              {!detailLoading && detail && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 py-2">
                      <p className="font-black text-slate-900">
                        {formatPkr(detail.totalAgreedPrice, detail.currency)}
                      </p>
                      <p className="text-slate-400 font-semibold">Agreed</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-2">
                      <p className="font-black text-emerald-900">
                        {formatPkr(detail.totalPaid, detail.currency)}
                      </p>
                      <p className="text-slate-400 font-semibold">Collected</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 py-2">
                      <p className="font-black text-amber-900">
                        {formatPkr(detail.remainingBalance, detail.currency)}
                      </p>
                      <p className="text-slate-400 font-semibold">Balance</p>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {detail.scheduleItems.map((s) => {
                      const href = proofHref(s.paymentProofStorageKey);
                      const remaining = Math.max(0, Number(s.amount) - Number(s.paidAmount));
                      const needsVerify =
                        !!s.paymentProofStorageKey &&
                        s.status !== "Paid" &&
                        s.status !== "Waived" &&
                        s.status !== "Cancelled";
                      const busy = busyProofId === s.id;
                      const isOverdue =
                        s.status !== "Paid" &&
                        s.status !== "Waived" &&
                        s.status !== "Cancelled" &&
                        new Date(s.dueDate).getTime() < Date.now();
                      return (
                        <li
                          key={s.id}
                          className={`rounded-xl border px-3 py-3 ${
                            isOverdue
                              ? "border-rose-200 bg-rose-50/40"
                              : needsVerify
                                ? "border-amber-200 bg-amber-50/30"
                                : "border-slate-200 bg-slate-50/40"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-bold text-sm text-slate-900">
                                #{s.sequenceNumber} · {s.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                Due {formatDate(s.dueDate)}
                                {isOverdue ? " · Overdue" : ""}
                                {s.paidAtUtc ? ` · Paid ${formatDate(s.paidAtUtc)}` : ""}
                              </p>
                              {s.adjustmentReason && (
                                <p className="text-[11px] text-slate-500">{s.adjustmentReason}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <p className="font-bold text-sm text-slate-900">
                                {formatPkr(s.amount, s.currency)}
                              </p>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(s.status)}`}
                              >
                                {s.status}
                              </span>
                              {remaining > 0 && s.status !== "Paid" && (
                                <p className="text-[11px] text-amber-700">
                                  Left {formatPkr(remaining, s.currency)}
                                </p>
                              )}
                            </div>
                          </div>
                          {(href || needsVerify) && (
                            <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-200/80">
                              {href && (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-slate-600 hover:underline"
                                >
                                  View proof
                                </a>
                              )}
                              {needsVerify && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void verifyProof(
                                        viewGroup.bookingId,
                                        s.id,
                                        s.amount,
                                        s.title,
                                        viewGroup.unitNumber,
                                        true
                                      )
                                    }
                                    className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 disabled:opacity-50"
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
                                      void verifyProof(
                                        viewGroup.bookingId,
                                        s.id,
                                        s.amount,
                                        s.title,
                                        viewGroup.unitNumber,
                                        false
                                      )
                                    }
                                    className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={closeSchedule}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
