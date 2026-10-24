"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ExternalLink,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface DeveloperProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  projectType: string;
  province: string;
  city: string;
  area: string;
  address?: string | null;
  regulatoryAuthority?: string | null;
  approvalReferenceNumber?: string | null;
  approvalStatus: string;
  approvalDocumentUrl?: string | null;
  launchDate?: string | null;
  expectedCompletionDate?: string | null;
  createdAtUtc: string;
  phaseCount: number;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  bookedUnits: number;
  soldUnits: number;
  blockedUnits: number;
  startingPrice: number;
  currency: string;
  isArchived?: boolean;
}

interface DeveloperProjectsResponse {
  organization: {
    id?: string | null;
    name: string;
    licenseNumber?: string | null;
    isVerified: boolean;
  };
  totalProjects: number;
  projects: DeveloperProject[];
}

function formatPkr(amount: number, currency = "PKR"): string {
  if (amount <= 0) return "—";
  if (amount >= 10_000_000) return `${currency} ${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `${currency} ${(amount / 100_000).toFixed(2)} Lakh`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function approvalBadgeClass(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-emerald-100 text-emerald-800";
    case "Pending":
      return "bg-amber-100 text-amber-800";
    case "Rejected":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DeveloperProjectsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<DeveloperProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("HousingScheme");
  const [city, setCity] = useState("Lahore");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [regulatoryAuthority, setRegulatoryAuthority] = useState("LDA");
  const [approvalStatus, setApprovalStatus] = useState("Pending");
  const [approvalRef, setApprovalRef] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (showArchived) params.set("includeArchived", "true");
      const qs = params.toString() ? `?${params}` : "";
      const res = await authFetch(`/api/projects/developer/projects${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer to view projects."
              : `Could not load projects (${res.status}).`)
        );
      }
      setData((await res.json()) as DeveloperProjectsResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, debouncedSearch, showArchived]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to manage schemes.");
      return;
    }
    void loadProjects();
  }, [isHydrated, isAuthenticated, loadProjects]);

  const projects = data?.projects ?? [];

  const totals = useMemo(() => {
    return {
      units: projects.reduce((s, p) => s + p.totalUnits, 0),
      available: projects.reduce((s, p) => s + p.availableUnits, 0),
    };
  }, [projects]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setProjectType("HousingScheme");
    setCity("Lahore");
    setArea("");
    setAddress("");
    setRegulatoryAuthority("LDA");
    setApprovalStatus("Pending");
    setApprovalRef("");
    setEditingId(null);
    setFormError(null);
  };

  const openEdit = (p: DeveloperProject) => {
    setEditingId(p.id);
    setName(p.name);
    setSlug(p.slug);
    setSlugTouched(true);
    setDescription(p.description || "");
    setProjectType(p.projectType || "HousingScheme");
    setCity(p.city || "Lahore");
    setArea(p.area || "");
    setAddress(p.address || "");
    setRegulatoryAuthority(p.regulatoryAuthority || "LDA");
    setApprovalStatus(p.approvalStatus || "Pending");
    setApprovalRef(p.approvalReferenceNumber || "");
    setFormError(null);
    setFormOk(null);
    setShowForm(true);
  };

  const toggleArchive = async (p: DeveloperProject) => {
    const archive = !p.isArchived;
    const label = archive ? "Archive" : "Restore";
    if (
      !window.confirm(
        archive
          ? `Archive “${p.name}”? It stays in the database (bookings/NOC intact) but leaves public and active catalogs.`
          : `Restore “${p.name}” to active catalogs?`
      )
    ) {
      return;
    }
    setBusyId(p.id);
    setFormOk(null);
    setFormError(null);
    try {
      const res = await authFetch(`/api/projects/${p.id}/archive`, {
        method: "PUT",
        body: JSON.stringify({ archived: archive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || `${label} failed (${res.status})`
        );
      }
      const body = (await res.json()) as { message?: string };
      setFormOk(body.message || `${label}d.`);
      await loadProjects();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusyId(null);
    }
  };

  const saveProject = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFormOk(null);
    try {
      if (!name.trim()) throw new Error("Project name is required.");
      if (!area.trim()) throw new Error("Society / area is required.");

      const province =
        city === "Karachi"
          ? "Sindh"
          : city === "Islamabad" || city === "Rawalpindi"
            ? "Islamabad Capital Territory"
            : "Punjab";

      const payload = {
        name: name.trim(),
        description: description.trim(),
        projectType,
        province,
        city,
        area: area.trim(),
        address: address.trim() || null,
        regulatoryAuthority: regulatoryAuthority || null,
        approvalReferenceNumber: approvalRef.trim() || null,
        approvalStatus,
      };

      const res = await authFetch(
        editingId ? `/api/projects/${editingId}` : "/api/projects",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(
            editingId
              ? payload
              : {
                  ...payload,
                  slug: slug.trim() || slugify(name),
                }
          ),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            `Could not save project (${res.status}).`
        );
      }

      const saved = (await res.json()) as { name?: string };
      setFormOk(
        editingId
          ? `Updated ${saved.name || name} (approval / NOC fields saved).`
          : `Created ${saved.name || name} — Phase 1 / Block A seeded.`
      );
      resetForm();
      setShowForm(false);
      await loadProjects();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading developer projects…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            {data?.organization.name || "Developer"} schemes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.totalProjects ?? 0} project
            {(data?.totalProjects ?? 0) === 1 ? "" : "s"} · {totals.units} units ·{" "}
            {totals.available} available
            {data?.organization.licenseNumber
              ? ` · ${data.organization.licenseNumber}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, area…"
              className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 w-48 sm:w-56"
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show archived
          </label>
          <button
            type="button"
            onClick={() => void loadProjects()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                resetForm();
                setShowForm(true);
              }
              setFormError(null);
              setFormOk(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
            {showForm ? "Close" : "New project"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}
      {formOk && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {formOk}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={saveProject}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3"
        >
          <h4 className="font-bold text-sm text-slate-900">
            {editingId ? "Edit project / approval" : "Create housing scheme"}
          </h4>
          <p className="text-[11px] text-slate-500">
            {editingId
              ? "Update scheme details, approval status, and NOC reference. Upload files from NOC Center."
              : "Owned by your developer firm. Creates Phase 1 → Block A automatically so you can add inventory next."}
          </p>
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-600">Project name *</label>
              <input
                required
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slugTouched) setSlug(slugify(v));
                }}
                placeholder="e.g. Canal Residencia"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
              />
            </div>
            {!editingId && (
              <div>
                <label className="font-semibold text-slate-600">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="auto from name"
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            )}
            <div>
              <label className="font-semibold text-slate-600">Type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="HousingScheme">Housing Scheme</option>
                <option value="ApartmentComplex">Apartment Complex</option>
                <option value="CommercialPlaza">Commercial Plaza</option>
                <option value="FarmHouse">Farm House</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Lahore">Lahore</option>
                <option value="Islamabad">Islamabad</option>
                <option value="Rawalpindi">Rawalpindi</option>
                <option value="Karachi">Karachi</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Society / Area *</label>
              <input
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Raiwind Road"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="font-semibold text-slate-600">Address (optional)</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Authority</label>
              <select
                value={regulatoryAuthority}
                onChange={(e) => setRegulatoryAuthority(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="LDA">LDA</option>
                <option value="RDA">RDA</option>
                <option value="CDA">CDA</option>
                <option value="SBCA">SBCA</option>
                <option value="">Other / none</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Approval status</label>
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Approval / NOC ref</label>
              <input
                value={approvalRef}
                onChange={(e) => setApprovalRef(e.target.value)}
                placeholder="e.g. LDA-NOC-2026-001"
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="font-semibold text-slate-600">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2"
                placeholder="Short scheme description for the public project page"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : editingId ? (
                "Save changes"
              ) : (
                "Create project"
              )}
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <Building2 className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No schemes yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create your first housing scheme. It will be owned by your developer organization and
            appear on the public projects catalog once units are added.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            <PlusCircle className="w-4 h-4" />
            New project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 space-y-3 ${
                p.isArchived
                  ? "border-slate-300 bg-slate-100/60 opacity-90"
                  : "border-slate-200 bg-slate-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{p.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${approvalBadgeClass(p.approvalStatus)}`}
                    >
                      {p.approvalStatus}
                    </span>
                    {p.isArchived && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        Archived
                      </span>
                    )}
                    {data?.organization.isVerified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                        <ShieldCheck className="w-3 h-3" />
                        Verified firm
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {[p.area, p.city].filter(Boolean).join(", ")}
                    {p.regulatoryAuthority ? ` · ${p.regulatoryAuthority}` : ""}
                    {p.approvalReferenceNumber ? ` · ${p.approvalReferenceNumber}` : ""}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">/{p.slug}</p>
                </div>
              </div>

              {p.description && (
                <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-xl bg-white border border-slate-100 py-2">
                  <p className="font-black text-slate-900">{p.totalUnits}</p>
                  <p className="text-slate-400 font-semibold">Units</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-100 py-2">
                  <p className="font-black text-emerald-800">{p.availableUnits}</p>
                  <p className="text-slate-400 font-semibold">Available</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-100 py-2">
                  <p className="font-black text-blue-800">
                    {p.bookedUnits + p.soldUnits}
                  </p>
                  <p className="text-slate-400 font-semibold">Booked/Sold</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
                <div className="text-slate-500">
                  {p.phaseCount} phase{p.phaseCount === 1 ? "" : "s"} · From{" "}
                  <span className="font-bold text-slate-800">
                    {formatPkr(Number(p.startingPrice), p.currency)}
                  </span>
                  <span className="block text-[10px] mt-0.5">
                    Launched {formatDate(p.launchDate)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void toggleArchive(p)}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg disabled:opacity-50"
                    title={p.isArchived ? "Restore project" : "Archive project"}
                  >
                    {busyId === p.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : p.isArchived ? (
                      <ArchiveRestore className="w-3 h-3" />
                    ) : (
                      <Archive className="w-3 h-3" />
                    )}
                    {p.isArchived ? "Restore" : "Archive"}
                  </button>
                  {!p.isArchived && (
                    <>
                      <Link
                        href="/developer/structure"
                        className="font-bold text-slate-700 hover:text-emerald-800"
                      >
                        Structure
                      </Link>
                      <Link
                        href="/developer/noc"
                        className="font-bold text-slate-700 hover:text-emerald-800"
                      >
                        NOC
                      </Link>
                      <Link
                        href={`/projects/${p.slug}`}
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                      >
                        Public
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
