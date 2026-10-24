"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Layers,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type UnitStatus = "Available" | "Reserved" | "Booked" | "Sold" | "Blocked";

interface InventoryProjectOption {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
  phaseId?: string | null;
  phaseName?: string | null;
  blockId?: string | null;
  blockName?: string | null;
  phases?: {
    id: string;
    name: string;
    blocks: { id: string; name: string; blockType?: string | null }[];
  }[];
}

interface InventoryUnit {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  phaseName?: string | null;
  blockName?: string | null;
  unitNumber: string;
  unitType: string;
  size: number;
  sizeUnit: string;
  facing?: string | null;
  basePrice: number;
  currency: string;
  status: string;
  updatedAtUtc?: string;
}

interface InventoryResponse {
  organization: { name: string; licenseNumber?: string | null };
  summary: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    bookedUnits: number;
    soldUnits: number;
    blockedUnits: number;
    totalValuation: number;
    filteredCount: number;
  };
  projects: InventoryProjectOption[];
  units: InventoryUnit[];
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
      return "bg-blue-100 text-blue-800";
    case "Sold":
      return "bg-slate-200 text-slate-800";
    case "Blocked":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function DeveloperInventorySection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [newStatus, setNewStatus] = useState<UnitStatus>("Available");
  const [statusReason, setStatusReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [addProjectId, setAddProjectId] = useState("");
  const [addUnitNumber, setAddUnitNumber] = useState("");
  const [addSize, setAddSize] = useState("5");
  const [addSizeUnit, setAddSizeUnit] = useState("Marla");
  const [addFacing, setAddFacing] = useState("Road Facing");
  const [addPrice, setAddPrice] = useState("9500000");
  const [addUnitType, setAddUnitType] = useState("Plot");
  const [bulkPhaseId, setBulkPhaseId] = useState("");
  const [bulkBlockId, setBulkBlockId] = useState("");
  const [bulkPrefix, setBulkPrefix] = useState("Plot-");
  const [bulkStart, setBulkStart] = useState("101");
  const [bulkCount, setBulkCount] = useState("10");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectFilter !== "All") params.set("projectId", projectFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/projects/developer/inventory${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to manage inventory."
              : `Could not load inventory (${res.status}).`)
        );
      }
      const json = (await res.json()) as InventoryResponse;
      setData(json);
      setAddProjectId((prev) => prev || json.projects[0]?.id || "");
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to manage inventory.");
      return;
    }
    void loadInventory();
  }, [isHydrated, isAuthenticated, loadInventory]);

  const units = data?.units ?? [];
  const summary = data?.summary;
  const projects = data?.projects ?? [];

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
          (body as { message?: string } | null)?.message ||
            `Status update failed (${res.status})`
        );
      }
      setActionMsg(`Updated ${selectedUnit.unitNumber} → ${newStatus}`);
      setSelectedUnit(null);
      setStatusReason("");
      await loadInventory();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteUnit = async (unit: InventoryUnit) => {
    if (unit.status !== "Available") {
      setActionMsg("Only Available units can be deleted.");
      return;
    }
    if (
      !window.confirm(
        `Remove unit ${unit.unitNumber}? Only allowed when Available with no booking history.`
      )
    ) {
      return;
    }
    setBusyId(unit.id);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/projects/units/${unit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `Delete failed (${res.status})`
        );
      }
      setActionMsg(`Removed ${unit.unitNumber}`);
      if (selectedUnit?.id === unit.id) setSelectedUnit(null);
      await loadInventory();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not delete unit");
    } finally {
      setBusyId(null);
    }
  };

  const handleAddUnit = async (e: FormEvent) => {
    e.preventDefault();
    const projectId = addProjectId || projects[0]?.id;
    if (!projectId) {
      setActionMsg("Create a project before adding units.");
      return;
    }
    const price = Number(addPrice);
    const size = Number(addSize);
    if (!addUnitNumber.trim()) {
      setActionMsg("Unit number is required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0) {
      setActionMsg("Enter a valid size and base price.");
      return;
    }

    const project = projects.find((p) => p.id === projectId);
    setBusyId("add-unit");
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/projects/${projectId}/units`, {
        method: "POST",
        body: JSON.stringify({
          phaseId: project?.phaseId ?? null,
          blockId: project?.blockId ?? null,
          unitNumber: addUnitNumber.trim(),
          unitType: addUnitType,
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
          (body as { message?: string } | null)?.message ||
            `Could not add unit (${res.status})`
        );
      }
      setShowAdd(false);
      setAddUnitNumber("");
      setActionMsg(`Added ${addUnitNumber.trim()} to ${project?.name || "project"}`);
      await loadInventory();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Could not add unit");
    } finally {
      setBusyId(null);
    }
  };

  const bulkProject = projects.find((p) => p.id === addProjectId);
  const bulkPhases = bulkProject?.phases ?? [];
  const bulkBlocks =
    bulkPhases.find((ph) => ph.id === bulkPhaseId)?.blocks ??
    bulkPhases[0]?.blocks ??
    [];

  const handleBulkAdd = async (e: FormEvent) => {
    e.preventDefault();
    const projectId = addProjectId || projects[0]?.id;
    if (!projectId) {
      setActionMsg("Select a project.");
      return;
    }
    const count = Number(bulkCount);
    const start = Number(bulkStart);
    const price = Number(addPrice);
    const size = Number(addSize);
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      setActionMsg("Count must be between 1 and 200.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0) {
      setActionMsg("Enter valid size and price.");
      return;
    }
    setBusyId("bulk");
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/projects/${projectId}/units/bulk`, {
        method: "POST",
        body: JSON.stringify({
          phaseId: bulkPhaseId || bulkProject?.phaseId || null,
          blockId: bulkBlockId || bulkProject?.blockId || null,
          unitType: addUnitType,
          size,
          sizeUnit: addSizeUnit,
          basePrice: price,
          prefix: bulkPrefix || "Plot-",
          startNumber: Number.isFinite(start) ? start : 1,
          count,
          facing: addFacing,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `Bulk failed (${res.status})`
        );
      }
      const body = (await res.json()) as { count?: number; message?: string };
      setShowBulk(false);
      setActionMsg(body.message || `Created ${body.count ?? count} units.`);
      await loadInventory();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading inventory matrix…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Inventory matrix
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · {summary?.totalUnits ?? 0} units firm-wide
            {summary ? ` · showing ${summary.filteredCount}` : ""} · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/developer/structure"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Phases/blocks →
          </Link>
          <button
            type="button"
            disabled={!projects.length}
            onClick={() => {
              setShowBulk(true);
              setShowAdd(false);
              const pid = projects[0]?.id || "";
              setAddProjectId(pid);
              const ph = projects[0]?.phases?.[0];
              setBulkPhaseId(ph?.id || projects[0]?.phaseId || "");
              setBulkBlockId(ph?.blocks?.[0]?.id || projects[0]?.blockId || "");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 disabled:opacity-40 px-3 py-2 rounded-xl"
          >
            Bulk import
          </button>
          <button
            type="button"
            disabled={!projects.length}
            onClick={() => {
              setShowAdd(true);
              setShowBulk(false);
              setAddProjectId(projects[0]?.id || "");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 px-3 py-2 rounded-xl"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add unit
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
            <p className="text-[10px] font-bold uppercase text-slate-400">Total</p>
            <p className="text-xl font-black text-slate-900">{summary.totalUnits}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Available</p>
            <p className="text-xl font-black text-emerald-900">{summary.availableUnits}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Reserved</p>
            <p className="text-xl font-black text-amber-900">{summary.reservedUnits}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">Booked</p>
            <p className="text-xl font-black text-blue-900">{summary.bookedUnits}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Sold</p>
            <p className="text-xl font-black text-slate-900">{summary.soldUnits}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Valuation</p>
            <p className="text-sm font-black text-slate-900 mt-1">
              {formatPkr(summary.totalValuation)}
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
          {UNIT_STATUSES.map((s) => (
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
            placeholder="Search unit, facing, project…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-52 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {showBulk && (
        <form
          onSubmit={handleBulkAdd}
          className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Bulk import units</h4>
            <button
              type="button"
              onClick={() => setShowBulk(false)}
              className="p-1 hover:bg-white rounded-lg"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Creates sequential unit numbers (e.g. Plot-101 … Plot-110) under a phase/block.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-600">Project</label>
              <select
                value={addProjectId}
                onChange={(e) => {
                  setAddProjectId(e.target.value);
                  const p = projects.find((x) => x.id === e.target.value);
                  const ph = p?.phases?.[0];
                  setBulkPhaseId(ph?.id || p?.phaseId || "");
                  setBulkBlockId(ph?.blocks?.[0]?.id || p?.blockId || "");
                }}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Phase</label>
              <select
                value={bulkPhaseId}
                onChange={(e) => {
                  setBulkPhaseId(e.target.value);
                  const ph = bulkPhases.find((x) => x.id === e.target.value);
                  setBulkBlockId(ph?.blocks?.[0]?.id || "");
                }}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                {bulkPhases.length === 0 ? (
                  <option value="">Default phase</option>
                ) : (
                  bulkPhases.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Block</label>
              <select
                value={bulkBlockId}
                onChange={(e) => setBulkBlockId(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                {bulkBlocks.length === 0 ? (
                  <option value="">Default block</option>
                ) : (
                  bulkBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Prefix</label>
              <input
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Start number</label>
              <input
                type="number"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Count</label>
              <input
                type="number"
                min={1}
                max={200}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Size</label>
              <input
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Size unit</label>
              <select
                value={addSizeUnit}
                onChange={(e) => setAddSizeUnit(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Marla">Marla</option>
                <option value="Kanal">Kanal</option>
                <option value="SqFt">Sq Ft</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Base price (PKR)</label>
              <input
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busyId === "bulk"}
            className="text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 px-4 py-2.5 rounded-xl"
          >
            {busyId === "bulk" ? "Creating…" : `Create ${bulkCount} units`}
          </button>
        </form>
      )}

      {showAdd && (
        <form
          onSubmit={handleAddUnit}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Add inventory unit</h4>
            <button type="button" onClick={() => setShowAdd(false)} className="p-1 hover:bg-white rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-600">Project *</label>
              <select
                value={addProjectId}
                onChange={(e) => setAddProjectId(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.blockName ? ` (${p.blockName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Unit number *</label>
              <input
                required
                value={addUnitNumber}
                onChange={(e) => setAddUnitNumber(e.target.value)}
                placeholder="Plot-107"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Type</label>
              <select
                value={addUnitType}
                onChange={(e) => setAddUnitType(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Plot">Plot</option>
                <option value="Apartment">Apartment</option>
                <option value="Shop">Shop</option>
                <option value="Office">Office</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Size</label>
              <input
                type="number"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Size unit</label>
              <select
                value={addSizeUnit}
                onChange={(e) => setAddSizeUnit(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Marla">Marla</option>
                <option value="Kanal">Kanal</option>
                <option value="SqYards">Sq. Yards</option>
                <option value="SqFt">Sq. Feet</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Facing</label>
              <input
                value={addFacing}
                onChange={(e) => setAddFacing(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Base price (PKR)</label>
              <input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busyId === "add-unit"}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              {busyId === "add-unit" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save unit
            </button>
          </div>
        </form>
      )}

      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">No units in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {projects.length === 0
              ? "Create a project first, then add inventory units."
              : "Add a unit or clear filters to see inventory."}
          </p>
          {projects.length === 0 ? (
            <Link
              href="/developer/projects"
              className="inline-flex text-xs font-bold text-emerald-700 hover:underline"
            >
              Go to Projects →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              <PlusCircle className="w-4 h-4" />
              Add unit
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/80">
                <th className="px-3 py-3 font-bold">Unit</th>
                <th className="px-3 py-3 font-bold">Project / Block</th>
                <th className="px-3 py-3 font-bold">Size</th>
                <th className="px-3 py-3 font-bold">Facing</th>
                <th className="px-3 py-3 font-bold">Price</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-3 font-bold text-slate-900">
                    {unit.unitNumber}
                    <span className="block text-[10px] font-semibold text-slate-400">
                      {unit.unitType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {unit.projectName}
                    {(unit.blockName || unit.phaseName) && (
                      <span className="block text-[10px] text-slate-400">
                        {[unit.phaseName, unit.blockName].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {unit.size} {unit.sizeUnit}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{unit.facing || "—"}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">
                    {formatPkr(Number(unit.basePrice), unit.currency)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(unit.status)}`}
                    >
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right space-x-2 whitespace-nowrap">
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
                      className="font-bold text-emerald-700 hover:underline"
                    >
                      Status
                    </button>
                    {unit.status === "Available" && (
                      <button
                        type="button"
                        disabled={busyId === unit.id}
                        onClick={() => void handleDeleteUnit(unit)}
                        className="inline-flex items-center gap-0.5 font-bold text-rose-700 hover:underline disabled:opacity-50"
                        title="Soft-delete Available unit with no bookings"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                    {unit.projectSlug && (
                      <Link
                        href={`/projects/${unit.projectSlug}`}
                        className="inline-flex items-center gap-0.5 font-bold text-slate-600 hover:text-emerald-800"
                      >
                        Public
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-black text-slate-900">
              Change status — {selectedUnit.unitNumber}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedUnit.projectName} · Current:{" "}
              <span className="font-bold">{selectedUnit.status}</span>
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
              <label className="text-xs font-semibold text-slate-700">Reason (audit)</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={2}
                className="w-full mt-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                placeholder="e.g. Token received / hold for investor"
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
                {busyId === selectedUnit.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
