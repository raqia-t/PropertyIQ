"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface EvidenceItem {
  id: string;
  evidenceType: string;
  fileUrl: string;
  storageKey?: string;
  downloadPath?: string;
  latitude?: number | null;
  longitude?: number | null;
  capturedAtUtc: string;
  hasGeo: boolean;
}

interface EvidenceCase {
  caseId: string;
  targetName: string;
  targetCity: string;
  targetArea: string;
  serviceLevel: string;
  caseStatus: string;
  customerName: string;
  isAssignedToMe: boolean;
  canSelfAssign: boolean;
  canAddEvidence: boolean;
  evidenceCount: number;
  geoTaggedCount: number;
  sitePhotoCount: number;
  gpsObservationCount: number;
  hasReport: boolean;
  createdAtUtc: string;
  evidences: EvidenceItem[];
}

interface EvidenceResponse {
  specialist: { id: string; fullName: string; email: string };
  summary: {
    casesInView: number;
    totalEvidenceItems: number;
    geoTaggedCount: number;
    sitePhotoCount: number;
    gpsObservationCount: number;
    casesWithEvidence: number;
    filteredCount: number;
  };
  cases: EvidenceCase[];
}

const SCOPE_OPTIONS = [
  { value: "active", label: "Active cases" },
  { value: "mine", label: "Assigned to me" },
  { value: "with-evidence", label: "With field evidence" },
  { value: "queue", label: "Open queue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All visible" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All field types" },
  { value: "SitePhoto", label: "Site photos" },
  { value: "GPSObservation", label: "GPS observations" },
] as const;

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function serviceLabel(level: string): string {
  return level.replace(/([A-Z])/g, " $1").trim();
}

function parseEvidence(json: Record<string, unknown>): EvidenceResponse {
  const specialist = (json.specialist ?? json.Specialist ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const rows = (json.cases ?? json.Cases ?? []) as Record<string, unknown>[];

  return {
    specialist: {
      id: String(specialist.id ?? specialist.Id ?? ""),
      fullName: String(specialist.fullName ?? specialist.FullName ?? "Specialist"),
      email: String(specialist.email ?? specialist.Email ?? ""),
    },
    summary: {
      casesInView: Number(summary.casesInView ?? summary.CasesInView ?? 0),
      totalEvidenceItems: Number(summary.totalEvidenceItems ?? summary.TotalEvidenceItems ?? 0),
      geoTaggedCount: Number(summary.geoTaggedCount ?? summary.GeoTaggedCount ?? 0),
      sitePhotoCount: Number(summary.sitePhotoCount ?? summary.SitePhotoCount ?? 0),
      gpsObservationCount: Number(
        summary.gpsObservationCount ?? summary.GpsObservationCount ?? 0
      ),
      casesWithEvidence: Number(summary.casesWithEvidence ?? summary.CasesWithEvidence ?? 0),
      filteredCount: Number(summary.filteredCount ?? summary.FilteredCount ?? 0),
    },
    cases: rows.map((c) => {
      const evidences = (c.evidences ?? c.Evidences ?? []) as Record<string, unknown>[];
      return {
        caseId: String(c.caseId ?? c.CaseId ?? ""),
        targetName: String(c.targetName ?? c.TargetName ?? "Target"),
        targetCity: String(c.targetCity ?? c.TargetCity ?? ""),
        targetArea: String(c.targetArea ?? c.TargetArea ?? ""),
        serviceLevel: String(c.serviceLevel ?? c.ServiceLevel ?? ""),
        caseStatus: String(c.caseStatus ?? c.CaseStatus ?? ""),
        customerName: String(c.customerName ?? c.CustomerName ?? "Customer"),
        isAssignedToMe: Boolean(c.isAssignedToMe ?? c.IsAssignedToMe),
        canSelfAssign: Boolean(c.canSelfAssign ?? c.CanSelfAssign),
        canAddEvidence: Boolean(c.canAddEvidence ?? c.CanAddEvidence),
        evidenceCount: Number(c.evidenceCount ?? c.EvidenceCount ?? 0),
        geoTaggedCount: Number(c.geoTaggedCount ?? c.GeoTaggedCount ?? 0),
        sitePhotoCount: Number(c.sitePhotoCount ?? c.SitePhotoCount ?? 0),
        gpsObservationCount: Number(c.gpsObservationCount ?? c.GpsObservationCount ?? 0),
        hasReport: Boolean(c.hasReport ?? c.HasReport),
        createdAtUtc: String(c.createdAtUtc ?? c.CreatedAtUtc ?? ""),
        evidences: evidences.map((e) => {
          const id = String(e.id ?? e.Id ?? "");
          const caseId = String(c.caseId ?? c.CaseId ?? "");
          const fromApi = String(e.downloadPath ?? e.DownloadPath ?? "").trim();
          const storageKey = String(e.storageKey ?? e.StorageKey ?? "");
          // Prefer API downloadPath; otherwise derive for stored files (not plain URL paste)
          const downloadPath =
            fromApi ||
            (id &&
            caseId &&
            storageKey &&
            !storageKey.startsWith("http") &&
            !storageKey.startsWith("documents/")
              ? `/api/verification/cases/${caseId}/evidence/${id}/download`
              : "");
          return {
            id,
            evidenceType: String(e.evidenceType ?? e.EvidenceType ?? "SitePhoto"),
            fileUrl: String(e.fileUrl ?? e.FileUrl ?? ""),
            storageKey: storageKey || undefined,
            downloadPath: downloadPath || undefined,
            latitude: (e.latitude ?? e.Latitude) as number | null | undefined,
            longitude: (e.longitude ?? e.Longitude) as number | null | undefined,
            capturedAtUtc: String(e.capturedAtUtc ?? e.CapturedAtUtc ?? ""),
            hasGeo: Boolean(e.hasGeo ?? e.HasGeo),
          };
        }),
      };
    }),
  };
}

export default function SpecialistEvidenceSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [scope, setScope] = useState("active");
  const [evidenceType, setEvidenceType] = useState("all");
  const [geoOnly, setGeoOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [fileUrl, setFileUrl] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [uploadType, setUploadType] = useState("SitePhoto");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (evidenceType !== "all") params.set("evidenceType", evidenceType);
      if (geoOnly) params.set("hasGeo", "true");
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/verification/specialist/evidence?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "Evidence requires a Specialist account."
                : `Could not load evidence (${res.status}).`)
        );
      }
      setData(parseEvidence((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load evidence.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, evidenceType, geoOnly, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to review field evidence.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const takeCase = async (caseId: string) => {
    if (!data?.specialist.id) return;
    setBusyKey(`assign-${caseId}`);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          specialistId: data.specialist.id,
          assignmentNotes: "Self-assigned from Evidence page",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Assign failed");
      }
      setActionMsg("Case assigned.");
      setExpandedId(caseId);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not assign case");
    } finally {
      setBusyKey(null);
    }
  };

  const addEvidence = async (caseId: string) => {
    const latN = lat.trim() ? Number(lat) : null;
    const lngN = lng.trim() ? Number(lng) : null;
    const latitude = latN != null && !Number.isNaN(latN) ? latN : null;
    const longitude = lngN != null && !Number.isNaN(lngN) ? lngN : null;
    const notes = uploadNotes.trim() || "Captured from Evidence workspace";

    if (!selectedFile && !fileUrl.trim()) {
      setActionMsg("Choose a file to upload, or paste a URL as fallback.");
      return;
    }

    setBusyKey(`add-${caseId}`);
    setActionMsg(null);
    try {
      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("evidenceType", uploadType);
        if (latitude != null) formData.append("latitude", String(latitude));
        if (longitude != null) formData.append("longitude", String(longitude));
        formData.append("notes", notes);
        // Do not set Content-Type — browser sets multipart boundary
        res = await authFetch(`/api/verification/cases/${caseId}/evidence/upload`, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await authFetch(`/api/verification/cases/${caseId}/evidence`, {
          method: "POST",
          body: JSON.stringify({
            evidenceType: uploadType,
            fileUrl: fileUrl.trim(),
            storageKey: `evidence/${caseId}/${Date.now()}`,
            latitude,
            longitude,
            notes,
          }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Upload failed");
      }
      setActionMsg(selectedFile ? "Evidence file uploaded." : "Field evidence recorded.");
      setFileUrl("");
      setSelectedFile(null);
      setUploadNotes("");
      setLat("");
      setLng("");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not add evidence");
    } finally {
      setBusyKey(null);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setActionMsg("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setActionMsg("GPS coordinates filled from device.");
      },
      () => setActionMsg("Could not read device location.")
    );
  };

  const openDownload = async (ev: EvidenceItem) => {
    if (!ev.downloadPath) return;
    setBusyKey(`dl-${ev.id}`);
    setActionMsg(null);
    try {
      const res = await authFetch(ev.downloadPath);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not download evidence");
    } finally {
      setBusyKey(null);
    }
  };

  const cases = data?.cases ?? [];
  const summary = data?.summary;

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        Loading geo-tagged field evidence…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-600" />
            Geo-tagged site evidence
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.specialist.fullName || "Specialist"} · SitePhoto &amp; GPSObservation · live from
            Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/specialist/visits" className="text-xs font-bold text-teal-700 hover:underline px-2">
            Visits →
          </Link>
          <Link
            href="/specialist/reports"
            className="text-xs font-bold text-teal-700 hover:underline px-2"
          >
            Reports →
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-teal-200 bg-teal-50/40 px-4 py-3 text-xs text-teal-900">
        Evidence is the photo / GPS trail for a case — road width, utilities, pin accuracy. Title
        PDFs stay on Documents; boundary checklist stays on Visits.
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900">
          {actionMsg}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Cases</p>
            <p className="text-xl font-black text-slate-900">{summary.casesInView}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">My items</p>
            <p className="text-xl font-black text-slate-900">{summary.totalEvidenceItems}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">Geo-tagged</p>
            <p className="text-xl font-black text-blue-900">{summary.geoTaggedCount}</p>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-teal-700">Site photos</p>
            <p className="text-xl font-black text-teal-900">{summary.sitePhotoCount}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-violet-700">GPS notes</p>
            <p className="text-xl font-black text-violet-900">{summary.gpsObservationCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">With evidence</p>
            <p className="text-xl font-black text-emerald-900">{summary.casesWithEvidence}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={geoOnly}
            onChange={(e) => setGeoOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Geo only
        </label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target, buyer…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No field evidence in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Assign an active case, then attach SitePhoto or GPSObservation captures with optional
            coordinates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const open = expandedId === c.caseId;
            return (
              <div
                key={c.caseId}
                className="rounded-2xl border border-slate-200 bg-slate-50/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : c.caseId)}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.targetName}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.caseStatus}
                      </span>
                      {c.geoTaggedCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.geoTaggedCount} geo
                        </span>
                      )}
                      {c.hasReport && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Report published
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {[c.targetArea, c.targetCity].filter(Boolean).join(", ")} ·{" "}
                      {serviceLabel(c.serviceLevel)} · {c.customerName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {c.evidenceCount} item{c.evidenceCount === 1 ? "" : "s"} · {c.sitePhotoCount}{" "}
                      photo{c.sitePhotoCount === 1 ? "" : "s"} · {c.gpsObservationCount} GPS
                    </p>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {open && (
                  <div className="border-t border-slate-200 bg-white p-4 space-y-5">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {c.canSelfAssign && (
                        <button
                          type="button"
                          disabled={busyKey === `assign-${c.caseId}`}
                          onClick={() => void takeCase(c.caseId)}
                          className="font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-2 rounded-xl"
                        >
                          Take case
                        </button>
                      )}
                      <Link
                        href={`/specialist?focusCaseId=${c.caseId}`}
                        className="font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl"
                      >
                        Full workbench
                      </Link>
                      <span className="text-slate-400 px-2 py-2">
                        Opened {formatDate(c.createdAtUtc)}
                      </span>
                    </div>

                    {c.canAddEvidence && (
                      <div
                        id="camera"
                        className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 space-y-3 scroll-mt-24"
                      >
                        <h4 className="font-bold text-sm text-slate-900 inline-flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-teal-600" />
                          Add field capture
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-2">
                          <select
                            value={uploadType}
                            onChange={(e) => setUploadType(e.target.value)}
                            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2"
                          >
                            <option value="SitePhoto">SitePhoto</option>
                            <option value="GPSObservation">GPSObservation</option>
                          </select>
                          <input
                            type="file"
                            accept="image/*,application/pdf,.pdf"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 file:mr-2 file:text-xs file:font-bold file:border-0 file:bg-teal-50 file:text-teal-800"
                          />
                          <input
                            value={lat}
                            onChange={(e) => setLat(e.target.value)}
                            placeholder="Latitude"
                            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-600"
                          />
                          <input
                            value={lng}
                            onChange={(e) => setLng(e.target.value)}
                            placeholder="Longitude"
                            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-600"
                          />
                          <input
                            value={uploadNotes}
                            onChange={(e) => setUploadNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="sm:col-span-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-600"
                          />
                          <input
                            value={fileUrl}
                            onChange={(e) => setFileUrl(e.target.value)}
                            placeholder="URL fallback (if no file)"
                            className="sm:col-span-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        {selectedFile && (
                          <p className="text-[11px] text-teal-800 font-semibold">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={useMyLocation}
                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl"
                          >
                            Use my GPS
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `add-${c.caseId}`}
                            onClick={() => void addEvidence(c.caseId)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-2 rounded-xl"
                          >
                            {busyKey === `add-${c.caseId}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {selectedFile ? "Upload file" : "Record evidence"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-bold text-sm text-slate-900">Captures</h4>
                      {c.evidences.length === 0 ? (
                        <p className="text-xs text-slate-500">No SitePhoto / GPSObservation yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {c.evidences.map((ev) => (
                            <li
                              key={ev.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900">{ev.evidenceType}</span>
                                  {ev.hasGeo && (
                                    <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                                      <MapPin className="w-3 h-3" />
                                      {ev.latitude?.toFixed(5)}, {ev.longitude?.toFixed(5)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-500 truncate">{ev.fileUrl || "—"}</p>
                                <p className="text-slate-400">
                                  Captured {formatDateTime(ev.capturedAtUtc)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                {ev.downloadPath && (
                                  <button
                                    type="button"
                                    disabled={busyKey === `dl-${ev.id}`}
                                    onClick={() => void openDownload(ev)}
                                    className="inline-flex items-center gap-1 font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                                  >
                                    {busyKey === `dl-${ev.id}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Download className="w-3 h-3" />
                                    )}
                                    View / Download
                                  </button>
                                )}
                                {!ev.downloadPath && ev.fileUrl && (
                                  <a
                                    href={ev.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-teal-700 hover:underline"
                                  >
                                    Open file
                                  </a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
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
