"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface CustomerProject {
  id: string;
  name: string;
  slug: string;
}

interface CustomerBooking {
  id: string;
  unitNumber: string;
  unitType: string;
  projectId?: string | null;
  projectName: string;
  projectSlug?: string | null;
  totalAgreedPrice: number;
  currency: string;
  status: string;
  bookedAtUtc: string;
  totalPaid: number;
  remainingBalance: number;
  scheduleItemCount: number;
  paidScheduleItemCount: number;
  pendingProofCount: number;
  nextPaymentDue?: {
    id: string;
    title: string;
    dueDate: string;
    amount: number;
    status: string;
  } | null;
}

interface DeveloperCustomer {
  customerId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  bookingCount: number;
  activeBookingCount: number;
  completedBookingCount: number;
  units: string[];
  projects: CustomerProject[];
  totalAgreedValue: number;
  totalCollected: number;
  outstandingAmount: number;
  scheduleItemCount: number;
  paidScheduleItemCount: number;
  overdueInstallmentCount: number;
  pendingProofCount: number;
  compliance: string;
  firstBookedAtUtc: string;
  lastBookedAtUtc: string;
  currency: string;
  bookings: CustomerBooking[];
}

interface CustomersResponse {
  organization: { name: string; licenseNumber?: string | null };
  summary: {
    totalBuyers: number;
    currentCount: number;
    overdueCount: number;
    pendingProofBuyers: number;
    fullyPaidCount: number;
    totalAgreedValue: number;
    totalCollected: number;
    outstandingAmount: number;
    filteredCount: number;
  };
  projects: { id: string; name: string; slug: string; city: string; area: string }[];
  customers: DeveloperCustomer[];
}

const COMPLIANCE_OPTIONS = [
  { value: "all", label: "All buyers" },
  { value: "current", label: "Current" },
  { value: "overdue", label: "Overdue" },
  { value: "pending_proof", label: "Pending proofs" },
  { value: "fully_paid", label: "Fully paid" },
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

function complianceBadgeClass(compliance: string): string {
  switch (compliance) {
    case "FullyPaid":
      return "bg-emerald-100 text-emerald-800";
    case "Current":
      return "bg-blue-100 text-blue-800";
    case "PendingProof":
      return "bg-amber-100 text-amber-800";
    case "Overdue":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function complianceLabel(compliance: string): string {
  switch (compliance) {
    case "FullyPaid":
      return "Fully paid";
    case "PendingProof":
      return "Proof pending";
    default:
      return compliance;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Confirmed":
    case "Paid":
      return "bg-emerald-100 text-emerald-800";
    case "Pending":
    case "Due":
      return "bg-amber-100 text-amber-800";
    case "Completed":
      return "bg-slate-200 text-slate-800";
    case "Cancelled":
    case "Overdue":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function DeveloperCustomersSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState("All");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      params.set("compliance", complianceFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/bookings/developer/customers?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view buyers."
              : `Could not load customers (${res.status}).`)
        );
      }
      setData((await res.json()) as CustomersResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter, complianceFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view buyers.");
      return;
    }
    void loadCustomers();
  }, [isHydrated, isAuthenticated, loadCustomers]);

  const customers = data?.customers ?? [];
  const summary = data?.summary;
  const projects = data?.projects ?? [];

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading buyer directory…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Scheme buyer directory
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {summary?.totalBuyers ?? 0} buyers with
            bookings
            {summary ? ` · showing ${summary.filteredCount}` : ""} · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/developer/bookings"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Bookings →
          </Link>
          <Link
            href="/developer/installments"
            className="text-xs font-bold text-emerald-700 hover:underline px-2 inline-flex items-center gap-1"
          >
            <CreditCard className="w-3 h-3" />
            Installments
          </Link>
          <button
            type="button"
            onClick={() => void loadCustomers()}
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

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Buyers</p>
            <p className="text-xl font-black text-slate-900">{summary.totalBuyers}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">Current</p>
            <p className="text-xl font-black text-blue-900">{summary.currentCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">Overdue</p>
            <p className="text-xl font-black text-rose-900">{summary.overdueCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Proofs</p>
            <p className="text-xl font-black text-amber-900">{summary.pendingProofBuyers}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Collected</p>
            <p className="text-sm font-black text-emerald-900 mt-1">
              {formatPkr(summary.totalCollected)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p>
            <p className="text-sm font-black text-slate-900 mt-1">
              {formatPkr(summary.outstandingAmount)}
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
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {COMPLIANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, unit…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No buyers in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Buyers appear here once they book a unit in one of your schemes. Compliance is derived
            from their installment schedules.
          </p>
          <Link
            href="/developer/bookings"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline"
          >
            View bookings →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => {
            const open = expandedId === c.customerId;
            return (
              <div
                key={c.customerId}
                className="rounded-2xl border border-slate-200 bg-slate-50/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : c.customerId)}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.fullName}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${complianceBadgeClass(c.compliance)}`}
                      >
                        {complianceLabel(c.compliance)}
                      </span>
                      {c.pendingProofCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {c.pendingProofCount} proof{c.pendingProofCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {c.overdueInstallmentCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {c.overdueInstallmentCount} overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {c.units.join(", ")}
                      {c.projects.length > 0
                        ? ` · ${c.projects.map((p) => p.name).join(", ")}`
                        : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"} · Paid{" "}
                      {c.paidScheduleItemCount}/{c.scheduleItemCount} installments · Collected{" "}
                      {formatPkr(c.totalCollected, c.currency)} of{" "}
                      {formatPkr(c.totalAgreedValue, c.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-slate-600">
                    <span className="text-slate-800">
                      Outstanding {formatPkr(c.outstandingAmount, c.currency)}
                    </span>
                    {open ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-200 bg-white p-4 space-y-4">
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </a>
                      )}
                      <span className="text-slate-400">
                        First booked {formatDate(c.firstBookedAtUtc)} · Last{" "}
                        {formatDate(c.lastBookedAtUtc)}
                      </span>
                      <Link
                        href="/developer/installments"
                        className="font-bold text-emerald-700 hover:underline"
                      >
                        Open installments →
                      </Link>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                            <th className="px-3 py-2 font-bold">Unit</th>
                            <th className="px-3 py-2 font-bold">Project</th>
                            <th className="px-3 py-2 font-bold">Status</th>
                            <th className="px-3 py-2 font-bold">Paid / Agreed</th>
                            <th className="px-3 py-2 font-bold">Schedule</th>
                            <th className="px-3 py-2 font-bold">Next due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.bookings.map((b) => (
                            <tr key={b.id} className="border-b border-slate-50">
                              <td className="px-3 py-2 font-semibold text-slate-800">
                                {b.unitNumber}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {b.projectSlug ? (
                                  <Link
                                    href={`/projects/${b.projectSlug}`}
                                    className="font-bold text-emerald-700 hover:underline"
                                  >
                                    {b.projectName}
                                  </Link>
                                ) : (
                                  b.projectName
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(b.status)}`}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {formatPkr(b.totalPaid, b.currency)} /{" "}
                                {formatPkr(b.totalAgreedPrice, b.currency)}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {b.paidScheduleItemCount}/{b.scheduleItemCount}
                                {b.pendingProofCount > 0
                                  ? ` · ${b.pendingProofCount} proof`
                                  : ""}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {b.nextPaymentDue
                                  ? `${b.nextPaymentDue.title} · ${formatDate(b.nextPaymentDue.dueDate)} · ${formatPkr(b.nextPaymentDue.amount, b.currency)}`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
