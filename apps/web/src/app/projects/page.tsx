"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Layers,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDate, formatPkr, pick } from "@/lib/apiHelpers";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  developerName: string;
  developerVerified: boolean;
  projectType: string;
  city: string;
  area: string;
  regulatoryAuthority: string;
  approvalReference: string;
  approvalStatus: string;
  totalUnits: number;
  availableUnits: number;
  startingPrice: number;
  completionDate: string;
  description: string;
}

function mapProject(row: Record<string, unknown>): ProjectItem {
  const completion = pick(row, "expectedCompletionDate", "ExpectedCompletionDate");
  return {
    id: String(pick(row, "id", "Id") ?? ""),
    name: String(pick(row, "name", "Name") ?? "Untitled project"),
    slug: String(pick(row, "slug", "Slug") ?? ""),
    developerName: String(pick(row, "developerName", "DeveloperName") ?? "Developer"),
    developerVerified: Boolean(pick(row, "developerVerified", "DeveloperVerified")),
    projectType: String(pick(row, "projectType", "ProjectType") ?? ""),
    city: String(pick(row, "city", "City") ?? ""),
    area: String(pick(row, "area", "Area") ?? ""),
    regulatoryAuthority: String(
      pick(row, "regulatoryAuthority", "RegulatoryAuthority") ?? ""
    ),
    approvalReference: String(
      pick(row, "approvalReferenceNumber", "ApprovalReferenceNumber") ?? ""
    ),
    approvalStatus: String(pick(row, "approvalStatus", "ApprovalStatus") ?? ""),
    totalUnits: Number(pick(row, "totalUnits", "TotalUnits") ?? 0),
    availableUnits: Number(pick(row, "availableUnits", "AvailableUnits") ?? 0),
    startingPrice: Number(pick(row, "startingPrice", "StartingPrice") ?? 0),
    completionDate: completion ? formatDate(String(completion)) : "—",
    description: String(pick(row, "description", "Description") ?? ""),
  };
}

export default function ProjectsDirectoryPage() {
  const [cityFilter, setCityFilter] = useState("All");
  const [authorityFilter, setAuthorityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (cityFilter !== "All") params.set("city", cityFilter);
    if (authorityFilter !== "All") params.set("regulatoryAuthority", authorityFilter);
    if (typeFilter !== "All") params.set("projectType", typeFilter);

    try {
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
      const data = await res.json();
      const items = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
      setProjects(items.map(mapProject));
      setTotal(Number(data.total ?? data.Total ?? items.length));
    } catch (e) {
      setProjects([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Could not load projects");
    } finally {
      setLoading(false);
    }
  }, [authorityFilter, cityFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.area.toLowerCase().includes(term) ||
        p.city.toLowerCase().includes(term) ||
        p.developerName.toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Live project inventory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Off-Plan Projects & Housing Schemes
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Browse developer projects from GET /api/projects — NOC status, live unit counts, and
            installment-ready inventory.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Regulatory fields from API
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Layers className="w-4 h-4 text-emerald-400" /> Real-time unit availability
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Book from unit detail
            </span>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Search Project or Location
            </label>
            <input
              type="text"
              placeholder="e.g. Skyline Meadows, Raiwind Road..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Major Cities</option>
              <option value="Lahore">Lahore</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Karachi">Karachi</option>
              <option value="Rawalpindi">Rawalpindi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Regulatory Authority
            </label>
            <select
              value={authorityFilter}
              onChange={(e) => setAuthorityFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Authorities</option>
              <option value="LDA">LDA (Lahore)</option>
              <option value="CDA">CDA (Islamabad)</option>
              <option value="SBCA">SBCA (Karachi)</option>
              <option value="RDA">RDA (Rawalpindi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Project Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Project Types</option>
              <option value="HousingScheme">Residential Housing Schemes</option>
              <option value="ApartmentComplex">Apartment Complexes & Towers</option>
              <option value="CommercialMall">Commercial Malls & Hubs</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 text-sm text-slate-600">
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading projects…
            </span>
          ) : (
            <>
              Showing{" "}
              <span className="font-bold text-slate-900">{filteredProjects.length}</span>
              {total > 0 ? (
                <>
                  {" "}
                  of <span className="font-bold text-slate-900">{total}</span>
                </>
              ) : null}{" "}
              live projects
            </>
          )}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3 text-sm text-rose-800 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load projects</p>
            <p className="mt-1 text-rose-700">{error}. Is the API running on :5000?</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white rounded-3xl border border-slate-200 h-72 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && !error && filteredProjects.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700">No projects from the API</p>
          <p className="text-xs text-slate-500">
            Try clearing filters. Projects appear here when present in the database.
          </p>
        </div>
      )}

      {!loading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {project.projectType || "Project"}
                        </span>
                        {(project.regulatoryAuthority || project.approvalStatus) && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {[project.regulatoryAuthority, project.approvalStatus]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        <Link
                          href={project.slug ? `/projects/${project.slug}` : "/projects"}
                          className="hover:text-emerald-600 transition"
                        >
                          {project.name}
                        </Link>
                      </h2>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {[project.area, project.city].filter(Boolean).join(", ") || "Pakistan"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 block font-medium">Starting From</span>
                      <span className="text-lg font-black text-emerald-700">
                        {formatPkr(project.startingPrice)}
                      </span>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="p-6 bg-slate-50/50 space-y-4 text-xs text-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px] font-medium">
                        Live Inventory
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {project.availableUnits} Available
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {" "}
                        of {project.totalUnits} total
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px] font-medium">
                        Expected Handover
                      </span>
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {project.completionDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      Developer: <strong>{project.developerName}</strong>
                      {project.developerVerified ? " · Verified" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 truncate">
                  NOC Ref:{" "}
                  <span className="font-mono text-slate-700">
                    {project.approvalReference || "—"}
                  </span>
                </div>
                <Link
                  href={project.slug ? `/projects/${project.slug}` : "/projects"}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition shrink-0"
                >
                  <span>Explore Inventory & Plans</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
