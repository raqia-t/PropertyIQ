"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Check,
  X,
  Eye,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type UnitStatus = "Available" | "Reserved" | "Booked" | "Sold" | "Blocked" | "OnHold" | "Cancelled" | "Transferred";

interface DashboardSummary {
  totalProjects: number;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  bookedUnits: number;
  soldUnits: number;
  blockedUnits: number;
  totalValuation: number;
  bookedValuation: number;
  totalCollections: number;
  pendingInstallments: number;
  pendingProofsCount: number;
}

interface DashboardProject {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
  approvalStatus: string;
  regulatoryAuthority?: string | null;
  totalUnits: number;
  availableUnits: number;
  bookedUnits: number;
}

interface InventoryUnitRow {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  unitNumber: string;
  unitType: string;
  size: number;
  sizeUnit: string;
  facing?: string | null;
  basePrice: number;
  currency: string;
  status: string;
  blockName?: string | null;
}

interface BookingRow {
  id: string;
  unitNumber: string;
  unitType: string;
  projectName?: string | null;
  customerName: string;
  customerPhone: string;
  totalAgreedPrice: number;
  status: string;
  bookedAtUtc: string;
  paidAmount: number;
  totalScheduleItems: number;
  paidScheduleItems: number;
  nextDueDate?: string | null;
  nextDueAmount?: number | null;
  nextDueTitle?: string | null;
}

interface PendingProof {
  id: string;
  bookingId: string;
  scheduleItemId: string;
  unitNumber: string;
  projectName: string;
  projectSlug?: string | null;
  customerName: string;
  customerPhone?: string | null;
  installmentTitle: string;
  amount: number;
  paidAmount: number;
  currency: string;
  dueDate: string;
  status: string;
  proofUrl?: string | null;
  transactionReference?: string | null;
}

interface DefaultProject {
  id: string;
  name: string;
  slug: string;
  phaseId?: string | null;
  phaseName?: string | null;
  blockId?: string | null;
  blockName?: string | null;
}

interface DeveloperDashboard {
  developerOrganization: string;
  organizationId?: string | null;
  licenseNumber?: string | null;
  isVerified: boolean;
  dailyAiBriefing?: string | null;
  briefingSource?: string | null;
  summary: DashboardSummary;
  defaultProject?: DefaultProject | null;
  projects: DashboardProject[];
  inventoryUnits: InventoryUnitRow[];
  recentBookings: BookingRow[];
  pendingProofs: PendingProof[];
}

const UNIT_STATUSES: UnitStatus[] = [
  "Available",
  "Reserved",
  "Booked",
  "Sold",
  "Blocked",
];

function formatPkr(amount: number, currency = "PKR"): string {
  if (amount >= 10_000_000) return `${currency} ${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `${currency} ${(amount / 100_000).toFixed(2)} Lakh`;
  return `${currency} ${amount.toLocaleString()}`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Available":
      return "bg-emerald-100 text-emerald-800";
    case "Reserved":
      return "bg-amber-100 text-amber-800";
    case "Booked":
    case "Confirmed":
      return "bg-blue-100 text-blue-800";
    case "Sold":
    case "Completed":
    case "Paid":
      return "bg-slate-200 text-slate-800";
    case "Blocked":
    case "Cancelled":
      return "bg-rose-100 text-rose-800";
    case "Pending":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function proofHref(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/media-files/${url}`;
}

export default function DeveloperDashboardPage() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"inventory" | "bookings" | "proofs">("inventory");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeveloperDashboard | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedUnit, setSelectedUnit] = useState<InventoryUnitRow | null>(null);
  const [newStatus, setNewStatus] = useState<UnitStatus>("Available");
  const [statusReason, setStatusReason] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addUnitNumber, setAddUnitNumber] = useState("");
  const [addSize, setAddSize] = useState("5");
  const [addSizeUnit, setAddSizeUnit] = useState("Marla");
  const [addFacing, setAddFacing] = useState("Road Facing");
  const [addPrice, setAddPrice] = useState("9500000");
  const [addProjectId, setAddProjectId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/projects/developer/dashboard");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view this dashboard."
              : `Failed to load developer dashboard (${res.status})`)
        );
      }
      const json = (await res.json()) as DeveloperDashboard;
      setData(json);
      setAddProjectId((prev) => prev || json.defaultProject?.id || json.projects[0]?.id || "");
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load developer dashboard");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to view this dashboard.");
      return;
    }
    void loadDashboard();
  }, [isHydrated, isAuthenticated, loadDashboard]);

  const units = data?.inventoryUnits ?? [];
  const bookings = data?.recentBookings ?? [];
  const proofs = data?.pendingProofs ?? [];
  const summary = data?.summary;

  const filteredUnits = useMemo(() => {
    if (statusFilter === "All") return units;
    return units.filter((u) => u.status === statusFilter);
  }, [units, statusFilter]);

  const primarySlug =
    data?.defaultProject?.slug || data?.projects[0]?.slug || "skyline-meadows-lahore";

  const handleStatusUpdate = async () => {
    if (!selectedUnit) return;
    setBusyId(selectedUnit.id);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/projects/units/${selectedUnit.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim() || `Status changed to ${newStatus}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `Status update failed (${res.status})`
        );
      }
      setSelectedUnit(null);
      setStatusReason("");
      setActionMsg(`Updated ${selectedUnit.unitNumber} → ${newStatus}`);
      await loadDashboard();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Could not update unit status");
    } finally {
      setBusyId(null);
    }
  };

  const handleAddUnit = async () => {
    const projectId = addProjectId || data?.defaultProject?.id || data?.projects[0]?.id;
    if (!projectId) {
      setActionMsg("Create a project before adding inventory units.");
      return;
    }
    if (!addUnitNumber.trim()) {
      setActionMsg("Unit number is required.");
      return;
    }
    const price = Number(addPrice);
    const size = Number(addSize);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0) {
      setActionMsg("Enter a valid size and base price.");
      return;
    }

    setBusyId("add-unit");
    setActionMsg(null);
    try {
      const selectedProject =
        data?.projects.find((p) => p.id === projectId) ||
        (data?.defaultProject?.id === projectId ? data.defaultProject : null);
      const res = await authFetch(`/api/projects/${projectId}/units`, {
        method: "POST",
        body: JSON.stringify({
          phaseId: data?.defaultProject?.id === projectId ? data.defaultProject.phaseId : null,
          blockId: data?.defaultProject?.id === projectId ? data.defaultProject.blockId : null,
          unitNumber: addUnitNumber.trim(),
          unitType: "Plot",
          size,
          sizeUnit: addSizeUnit,
          facing: addFacing,
          basePrice: price,
          currency: "PKR",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `Could not add unit (${res.status})`
        );
      }
      setShowAddModal(false);
      setAddUnitNumber("");
      setActionMsg(
        `Added ${addUnitNumber.trim()} to ${
          "name" in (selectedProject || {}) ? (selectedProject as { name: string }).name : "project"
        }`
      );
      await loadDashboard();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Could not add unit");
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyProof = async (proof: PendingProof, approve: boolean) => {
    setBusyId(proof.scheduleItemId);
    setActionMsg(null);
    try {
      const res = await authFetch(
        `/api/bookings/${proof.bookingId}/schedule/${proof.scheduleItemId}/verify`,
        {
          method: "POST",
          body: JSON.stringify({
            approve,
            approvedAmount: approve ? proof.amount : undefined,
            reason: approve
              ? "Payment verified from developer dashboard"
              : "Payment proof rejected from developer dashboard",
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
          ? `Approved proof for ${proof.unitNumber} (${proof.installmentTitle})`
          : `Rejected proof for ${proof.unitNumber}`
      );
      await loadDashboard();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Could not verify payment");
    } finally {
      setBusyId(null);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        Loading developer dashboard…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Developer Operations Hub
            </span>
            {data?.licenseNumber && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {data.isVerified ? "Licensed" : "Registered"} • {data.licenseNumber}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {data?.developerOrganization || "Developer Workspace"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {summary
              ? `${summary.totalProjects} project${summary.totalProjects === 1 ? "" : "s"} • ${summary.totalUnits} inventory units • live from Postgres`
              : "Org-scoped inventory, bookings, and collections"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setAddProjectId(data?.defaultProject?.id || data?.projects[0]?.id || "");
            }}
            disabled={!data?.projects.length}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            Add Inventory Unit
          </button>
          <Link
            href={`/projects/${primarySlug}`}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            Public View
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{error}</p>
            {!isAuthenticated && (
              <Link href="/auth/login" className="underline font-semibold">
                Sign in as developer
              </Link>
            )}
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {actionMsg}
        </div>
      )}

      {data?.dailyAiBriefing && (
        <div className="mb-8 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-2xl shadow-md space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <h2 className="font-bold text-sm text-emerald-200">
              Developer daily brief — from your live inventory
            </h2>
            {data.briefingSource && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-100 border border-white/15">
                via {data.briefingSource}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-4xl">
            {data.dailyAiBriefing}
          </p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Inventory
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {summary.totalUnits}
            </span>
            <span className="text-[11px] text-slate-500">Across {summary.totalProjects} schemes</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm text-center bg-emerald-50/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Available
            </span>
            <span className="text-2xl font-black text-emerald-800 mt-0.5 block">
              {summary.availableUnits}
            </span>
            <span className="text-[11px] text-emerald-600">Ready for booking</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm text-center bg-amber-50/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Reserved
            </span>
            <span className="text-2xl font-black text-amber-800 mt-0.5 block">
              {summary.reservedUnits}
            </span>
            <span className="text-[11px] text-amber-600">Locked pending deposit</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm text-center bg-blue-50/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Booked / Sold
            </span>
            <span className="text-2xl font-black text-blue-800 mt-0.5 block">
              {summary.bookedUnits + summary.soldUnits}
            </span>
            <span className="text-[11px] text-blue-600">
              {summary.bookedUnits} booked · {summary.soldUnits} sold
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Collections
            </span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {formatPkr(summary.totalCollections)}
            </span>
            <span className="text-[11px] text-slate-500">
              Pending {formatPkr(summary.pendingInstallments)}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Pending Proofs
            </span>
            <span className="text-2xl font-black text-rose-700 mt-0.5 block">
              {summary.pendingProofsCount}
            </span>
            <span className="text-[11px] text-slate-500">Awaiting verification</span>
          </div>
        </div>
      )}

      {data?.projects && data.projects.length > 0 && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.projects.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {[p.area, p.city].filter(Boolean).join(", ")}
                  {p.regulatoryAuthority ? ` · ${p.regulatoryAuthority}` : ""}
                  {p.approvalStatus ? ` · ${p.approvalStatus}` : ""}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  {p.availableUnits} available · {p.bookedUnits} booked/sold · {p.totalUnits} total
                </p>
              </div>
              <Link
                href={`/projects/${p.slug}`}
                className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
            {(
              [
                ["inventory", "Inventory"],
                ["bookings", "Recent Bookings"],
                ["proofs", "Payment Proofs"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 ${
                  activeTab === key
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
                {key === "proofs" && proofs.length > 0 ? ` (${proofs.length})` : ""}
              </button>
            ))}
          </div>

          {activeTab === "inventory" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
            >
              <option value="All">All statuses</option>
              {UNIT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "inventory" && (
            filteredUnits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-600">
                No inventory units yet. Add a unit to your primary project.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="pb-3 font-bold">Unit</th>
                      <th className="pb-3 font-bold">Project / Block</th>
                      <th className="pb-3 font-bold">Size</th>
                      <th className="pb-3 font-bold">Facing</th>
                      <th className="pb-3 font-bold">Price</th>
                      <th className="pb-3 font-bold">Status</th>
                      <th className="pb-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id} className="border-b border-slate-50">
                        <td className="py-3 font-bold text-slate-900">{unit.unitNumber}</td>
                        <td className="py-3 text-slate-600">
                          {unit.projectName}
                          {unit.blockName ? ` · ${unit.blockName}` : ""}
                        </td>
                        <td className="py-3 text-slate-600">
                          {unit.size} {unit.sizeUnit}
                        </td>
                        <td className="py-3 text-slate-600">{unit.facing || "—"}</td>
                        <td className="py-3 font-semibold text-slate-800">
                          {formatPkr(Number(unit.basePrice), unit.currency)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(unit.status)}`}
                          >
                            {unit.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUnit(unit);
                              setNewStatus(
                                UNIT_STATUSES.includes(unit.status as UnitStatus)
                                  ? (unit.status as UnitStatus)
                                  : "Available"
                              );
                              setStatusReason("");
                            }}
                            className="text-emerald-700 font-bold hover:underline"
                          >
                            Change status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === "bookings" && (
            bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-600">
                No bookings yet. When buyers reserve or book units from the public project page, they
                appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
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
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {b.customerName} · {b.customerPhone}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Booked {formatDate(b.bookedAtUtc)} · Paid {formatPkr(Number(b.paidAmount))} of{" "}
                        {formatPkr(Number(b.totalAgreedPrice))} · Schedule {b.paidScheduleItems}/
                        {b.totalScheduleItems}
                      </p>
                      {b.nextDueDate && (
                        <p className="text-xs text-amber-700 mt-1">
                          Next: {b.nextDueTitle || "Installment"} · {formatDate(b.nextDueDate)}
                          {b.nextDueAmount != null ? ` · ${formatPkr(Number(b.nextDueAmount))}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "proofs" && (
            proofs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No payment proofs waiting</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When customers upload installment receipts from My Bookings, they land here for
                  approve / reject.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {proofs.map((proof) => {
                  const href = proofHref(proof.proofUrl);
                  const busy = busyId === proof.scheduleItemId;
                  return (
                    <div
                      key={proof.scheduleItemId}
                      className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {proof.unitNumber} · {proof.installmentTitle}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(proof.status)}`}
                            >
                              {proof.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {proof.customerName}
                            {proof.customerPhone ? ` · ${proof.customerPhone}` : ""} ·{" "}
                            {proof.projectName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Amount {formatPkr(Number(proof.amount), proof.currency)} · Due{" "}
                            {formatDate(proof.dueDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View proof
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleVerifyProof(proof, true)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 px-3 py-2 rounded-xl"
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleVerifyProof(proof, false)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 px-3 py-2 rounded-xl"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-black text-slate-900">Change status — {selectedUnit.unitNumber}</h3>
            <p className="text-xs text-slate-500">
              Current: <span className="font-bold">{selectedUnit.status}</span>
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700">New status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as UnitStatus)}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              >
                {UNIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Reason (audit log)</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={2}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                placeholder="e.g. Customer token received"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === selectedUnit.id}
                onClick={() => void handleStatusUpdate()}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300 inline-flex items-center gap-1.5"
              >
                {busyId === selectedUnit.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save status
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-black text-slate-900">Add inventory unit</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700">Project</label>
              <select
                value={addProjectId}
                onChange={(e) => setAddProjectId(e.target.value)}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              >
                {(data?.projects || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Unit number</label>
              <input
                value={addUnitNumber}
                onChange={(e) => setAddUnitNumber(e.target.value)}
                placeholder="e.g. Plot-107"
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Size</label>
                <input
                  type="number"
                  value={addSize}
                  onChange={(e) => setAddSize(e.target.value)}
                  className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Unit</label>
                <select
                  value={addSizeUnit}
                  onChange={(e) => setAddSizeUnit(e.target.value)}
                  className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="Marla">Marla</option>
                  <option value="Kanal">Kanal</option>
                  <option value="SqYards">Sq. Yards</option>
                  <option value="SqFt">Sq. Feet</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Facing</label>
              <input
                value={addFacing}
                onChange={(e) => setAddFacing(e.target.value)}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Base price (PKR)</label>
              <input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === "add-unit"}
                onClick={() => void handleAddUnit()}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300 inline-flex items-center gap-1.5"
              >
                {busyId === "add-unit" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
