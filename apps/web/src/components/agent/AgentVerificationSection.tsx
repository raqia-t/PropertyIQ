"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import PropertyMapDisplay from "@/components/maps/PropertyMapDisplay";
import { useAuth } from "@/context/AuthContext";
import { pick } from "@/lib/apiHelpers";
import {
  REQUIRED_VERIFICATION_DOCS,
  VERIFICATION_DOC_TYPES,
  docTypeLabel,
  requiredDocsCoverage,
} from "@/lib/verificationDocuments";

interface CaseReportDetail {
  summary: string;
  specialistNotes?: string;
  recommendations?: string;
  limitations?: string;
  checklist: Array<{ title: string; result: string }>;
}

interface EvidenceDoc {
  id: string;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  uploadedAtUtc: string;
}

interface VerificationListing {
  propertyId: string;
  title: string;
  city: string;
  area: string;
  latitude?: number | null;
  longitude?: number | null;
  privacyLevel?: string;
  listingStatus: string;
  verificationStatus: string;
  activeCaseId?: string | null;
  caseStatus?: string | null;
  serviceLevel?: string | null;
  specialistName?: string | null;
  totalChecks?: number | null;
  passedChecks?: number | null;
  concernChecks?: number | null;
  hasReport: boolean;
  caseCreatedAtUtc?: string | null;
  caseCompletedAtUtc?: string | null;
  slaHours?: number | null;
  feePkr?: number | null;
  evidenceCount?: number;
  evidenceDocumentTypes?: string[];
  evidenceDocuments?: EvidenceDoc[];
}

const SERVICE_LEVELS = [
  { value: "BasicDocumentReview", label: "Basic Document Review" },
  { value: "PropertySiteVisit", label: "Property Site Visit" },
  { value: "RecordCheck", label: "Official Record Check" },
  { value: "EnhancedDueDiligence", label: "Enhanced Due Diligence" },
  { value: "LegalReview", label: "Legal Title Opinion" },
] as const;

function humanize(value?: string | null): string {
  if (!value) return "—";
  if (value === "InReview") return "In Review";
  if (value === "BasicDocumentReview") return "Basic Document Review";
  if (value === "PropertySiteVisit") return "Property Site Visit";
  if (value === "RecordCheck") return "Record Check";
  if (value === "EnhancedDueDiligence") return "Enhanced Due Diligence";
  if (value === "LegalReview") return "Legal Review";
  if (value === "InProgress") return "In Progress";
  if (value === "ReviewPending") return "Review Pending";
  return value;
}

function verificationBadgeClass(status: string): string {
  switch (status) {
    case "Verified":
      return "bg-emerald-100 text-emerald-800";
    case "InReview":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function caseBadgeClass(status?: string | null): string {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "InProgress":
    case "Assigned":
    case "ReviewPending":
      return "bg-blue-100 text-blue-800";
    case "Requested":
      return "bg-amber-100 text-amber-800";
    case "Cancelled":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case "Accepted":
      return "bg-emerald-100 text-emerald-800";
    case "Rejected":
      return "bg-rose-100 text-rose-800";
    case "Submitted":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

interface DocViewerState {
  title: string;
  contentType: string;
  url: string;
}

function isImageType(contentType: string, fileName: string): boolean {
  if (contentType.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

function isPdfType(contentType: string, fileName: string): boolean {
  if (contentType.includes("pdf")) return true;
  return /\.pdf$/i.test(fileName);
}

function parseListing(raw: Record<string, unknown>): VerificationListing {
  const docs = (raw.evidenceDocuments ?? raw.EvidenceDocuments ?? []) as Record<
    string,
    unknown
  >[];
  const types = (raw.evidenceDocumentTypes ??
    raw.EvidenceDocumentTypes ??
    []) as string[];
  return {
    propertyId: String(raw.propertyId ?? raw.PropertyId ?? ""),
    title: String(raw.title ?? raw.Title ?? ""),
    city: String(raw.city ?? raw.City ?? ""),
    area: String(raw.area ?? raw.Area ?? ""),
    latitude: (raw.latitude ?? raw.Latitude) as number | null | undefined,
    longitude: (raw.longitude ?? raw.Longitude) as number | null | undefined,
    privacyLevel: (raw.privacyLevel ?? raw.PrivacyLevel) as string | undefined,
    listingStatus: String(raw.listingStatus ?? raw.ListingStatus ?? ""),
    verificationStatus: String(
      raw.verificationStatus ?? raw.VerificationStatus ?? "Unverified"
    ),
    activeCaseId: (raw.activeCaseId ??
      raw.ActiveCaseId ??
      raw.caseId ??
      raw.CaseId) as string | null | undefined,
    caseStatus: (raw.caseStatus ?? raw.CaseStatus) as string | null | undefined,
    serviceLevel: (raw.serviceLevel ?? raw.ServiceLevel) as string | null | undefined,
    specialistName: (raw.specialistName ?? raw.SpecialistName) as
      | string
      | null
      | undefined,
    totalChecks: (raw.totalChecks ?? raw.TotalChecks) as number | null | undefined,
    passedChecks: (raw.passedChecks ?? raw.PassedChecks) as number | null | undefined,
    concernChecks: (raw.concernChecks ?? raw.ConcernChecks) as number | null | undefined,
    hasReport: Boolean(raw.hasReport ?? raw.HasReport),
    caseCreatedAtUtc: (raw.caseCreatedAtUtc ?? raw.CaseCreatedAtUtc) as
      | string
      | null
      | undefined,
    caseCompletedAtUtc: (raw.caseCompletedAtUtc ?? raw.CaseCompletedAtUtc) as
      | string
      | null
      | undefined,
    slaHours: (raw.slaHours ?? raw.SlaHours) as number | null | undefined,
    feePkr: (raw.feePkr ?? raw.FeePkr) as number | null | undefined,
    evidenceCount: Number(raw.evidenceCount ?? raw.EvidenceCount ?? docs.length),
    evidenceDocumentTypes: types,
    evidenceDocuments: docs.map((d) => ({
      id: String(d.id ?? d.Id ?? ""),
      documentType: String(d.documentType ?? d.DocumentType ?? ""),
      fileName: String(d.fileName ?? d.FileName ?? ""),
      contentType: String(d.contentType ?? d.ContentType ?? ""),
      sizeBytes: Number(d.sizeBytes ?? d.SizeBytes ?? 0),
      status: String(d.status ?? d.Status ?? "Submitted"),
      uploadedAtUtc: String(d.uploadedAtUtc ?? d.UploadedAtUtc ?? ""),
    })),
  };
}

function UploadDocumentsScreen({
  listing,
  onBack,
  onUploaded,
  authFetch,
}: {
  listing: VerificationListing;
  onBack: () => void;
  onUploaded: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [docType, setDocType] = useState("SaleFard");
  const [uploading, setUploading] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DocViewerState | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewerUrlRef = useRef<string | null>(null);

  const types = listing.evidenceDocumentTypes ?? [];
  const coverage = requiredDocsCoverage(types);
  const uploaded = new Set(types);
  const locked = listing.verificationStatus === "Verified";

  const closeViewer = useCallback(() => {
    if (viewerUrlRef.current) {
      URL.revokeObjectURL(viewerUrlRef.current);
      viewerUrlRef.current = null;
    }
    setViewer(null);
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, closeViewer]);

  useEffect(() => {
    return () => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
    };
  }, []);

  const viewDoc = async (doc: EvidenceDoc) => {
    setViewingId(doc.id);
    setMsg(null);
    try {
      const res = await authFetch(
        `/api/properties/${listing.propertyId}/evidence/${doc.id}/download`
      );
      if (!res.ok) throw new Error(`Could not open document (${res.status})`);
      const blob = await res.blob();
      const header = new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer());
      const contentType = doc.contentType || blob.type || "application/octet-stream";
      if (
        (contentType.includes("pdf") || /\.pdf$/i.test(doc.fileName)) &&
        (blob.size < 200 || !header.startsWith("%PDF"))
      ) {
        throw new Error(
          `"${doc.fileName}" is not a valid PDF (${blob.size} B). Re-upload a proper file.`
        );
      }
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      const url = URL.createObjectURL(blob);
      viewerUrlRef.current = url;
      setViewer({ title: doc.fileName || "Document", contentType, url });
    } catch (e: unknown) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Could not open document",
      });
    } finally {
      setViewingId(null);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);
      const res = await authFetch(`/api/properties/${listing.propertyId}/evidence`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Upload failed (${res.status}).`
        );
      }
      setMsg({ type: "ok", text: `Uploaded ${file.name}.` });
      await onUploaded();
    } catch (e: unknown) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to verification
          </button>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <FileUp className="w-4 h-4 text-emerald-700" />
            Upload verification documents
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{listing.title}</p>
          <p className="text-xs text-slate-500">
            {[listing.area, listing.city].filter(Boolean).join(", ")}
          </p>
        </div>
        <span
          className={`self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold ${verificationBadgeClass(listing.verificationStatus)}`}
        >
          {humanize(listing.verificationStatus)}
        </span>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            msg.type === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900">Required documents</h4>
          <p
            className={`text-xs font-bold ${
              coverage.missingRequired.length === 0 ? "text-emerald-700" : "text-amber-800"
            }`}
          >
            {coverage.requiredMet}/{coverage.requiredTotal} required uploaded
          </p>
        </div>
        <ul className="space-y-2">
          {REQUIRED_VERIFICATION_DOCS.map((doc) => {
            const ok = uploaded.has(doc.documentType);
            return (
              <li
                key={doc.documentType + doc.label}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-start gap-2.5 text-xs"
              >
                {ok ? (
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-900">{doc.label}</span>
                    {doc.required ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        If applicable
                      </span>
                    )}
                    {ok && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-0.5">{doc.why}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {(listing.evidenceDocuments?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Uploaded files</h4>
          <ul className="space-y-2 text-xs">
            {listing.evidenceDocuments!.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800 truncate block">
                    {d.fileName}
                    <span className="text-slate-400"> · {docTypeLabel(d.documentType)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(d.status)}`}
                  >
                    {d.status}
                  </span>
                  <button
                    type="button"
                    disabled={viewingId === d.id}
                    onClick={() => void viewDoc(d)}
                    className="inline-flex items-center gap-1 font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-2.5 py-1.5 rounded-lg"
                  >
                    {viewingId === d.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(viewer || viewingId) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Document viewer"
          onClick={closeViewer}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {viewer?.title || "Loading document…"}
                </p>
                {viewer?.contentType && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {viewer.contentType}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {viewer && (
                  <a
                    href={viewer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl"
                  >
                    Open tab
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700"
                  aria-label="Close viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[60vh] bg-slate-100 relative">
              {viewingId && !viewer ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  Loading document…
                </div>
              ) : viewer && isPdfType(viewer.contentType, viewer.title) ? (
                <iframe
                  title={viewer.title}
                  src={viewer.url}
                  className="w-full h-[70vh] border-0 bg-white"
                />
              ) : viewer && isImageType(viewer.contentType, viewer.title) ? (
                <div className="w-full h-[70vh] overflow-auto flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewer.url}
                    alt={viewer.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : viewer ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <FileText className="w-10 h-10 text-slate-400" />
                  <p className="text-sm font-bold text-slate-800">Preview not available in-app</p>
                  <a
                    href={viewer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl"
                  >
                    Open in new tab
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {locked ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 font-semibold">
          This listing is Verified — new uploads are closed.
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Add a document</h4>
          <p className="text-xs text-slate-600">
            PDF or image. Files stay private — buyers never see them. You can upload after
            publish.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Document type
              </label>
              <select
                value={docType}
                disabled={uploading}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-600"
              >
                {VERIFICATION_DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/jpg,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Choose file
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentVerificationSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [items, setItems] = useState<VerificationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [levelDraft, setLevelDraft] = useState<Record<string, string>>({});
  const [cardMsg, setCardMsg] = useState<Record<string, { type: "ok" | "err"; text: string }>>(
    {}
  );
  const [uploadPropertyId, setUploadPropertyId] = useState<string | null>(null);
  const [reportListing, setReportListing] = useState<VerificationListing | null>(null);
  const [reportDetail, setReportDetail] = useState<CaseReportDetail | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const openReport = async (item: VerificationListing) => {
    const caseId = item.activeCaseId;
    if (!caseId) {
      setCardMsg((prev) => ({
        ...prev,
        [item.propertyId]: {
          type: "err",
          text: "No verification case id available for this listing.",
        },
      }));
      return;
    }
    setReportListing(item);
    setReportDetail(null);
    setReportLoading(true);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}`);
      if (!res.ok) throw new Error("Failed to load report");
      const data = (await res.json()) as Record<string, unknown>;
      const reports =
        (pick<Record<string, unknown>[]>(data, "reports", "Reports") as
          | Record<string, unknown>[]
          | undefined) ?? [];
      const report = reports[0];
      const checklist =
        (pick<Record<string, unknown>[]>(data, "checklistItems", "ChecklistItems") as
          | Record<string, unknown>[]
          | undefined) ?? [];

      setReportDetail({
        summary: report
          ? String(pick(report, "summary", "Summary") ?? "No summary published.")
          : "Report not published yet.",
        specialistNotes: report
          ? pick<string>(report, "specialistNotes", "SpecialistNotes")
          : undefined,
        recommendations: report
          ? pick<string>(report, "customerRecommendations", "CustomerRecommendations")
          : undefined,
        limitations: report
          ? pick<string>(report, "limitations", "Limitations")
          : "Evidence-based verification only — not a government title certificate.",
        checklist: checklist.map((c) => ({
          title: String(pick(c, "checkTitle", "CheckTitle") ?? "Check"),
          result: String(pick(c, "result", "Result") ?? "Pending"),
        })),
      });
    } catch {
      setReportDetail({
        summary: "Could not load full report from API.",
        limitations: "Try again when the API is available.",
        checklist: [],
      });
    } finally {
      setReportLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/agent/verification");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — sign in as agent again."
            : `Could not load verification status (${res.status}).`
        );
      }
      const data = await res.json();
      const list = (Array.isArray(data) ? data : []).map((row) =>
        parseListing(row as Record<string, unknown>)
      );
      setItems(list);
      setLevelDraft((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (!next[item.propertyId]) next[item.propertyId] = "PropertySiteVisit";
        }
        return next;
      });
    } catch (e: unknown) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load verification.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an agent to view listing verification.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const visible = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((i) => i.verificationStatus === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      verified: items.filter((i) => i.verificationStatus === "Verified").length,
      inReview: items.filter((i) => i.verificationStatus === "InReview").length,
      unverified: items.filter((i) => i.verificationStatus === "Unverified").length,
    };
  }, [items]);

  const uploadListing = useMemo(
    () => items.find((i) => i.propertyId === uploadPropertyId) ?? null,
    [items, uploadPropertyId]
  );

  const requestVerification = async (propertyId: string) => {
    setRequestingId(propertyId);
    setCardMsg((prev) => {
      const next = { ...prev };
      delete next[propertyId];
      return next;
    });
    try {
      const res = await authFetch("/api/agent/verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          serviceLevel: levelDraft[propertyId] || "PropertySiteVisit",
          notes: "Requested from agent verification workspace.",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Request failed (${res.status}).`
        );
      }
      setCardMsg((prev) => ({
        ...prev,
        [propertyId]: {
          type: "ok",
          text: "Verification requested — listing is now In Review.",
        },
      }));
      await load();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Could not request verification.";
      setCardMsg((prev) => ({ ...prev, [propertyId]: { type: "err", text } }));
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading verification status…
      </div>
    );
  }

  if (uploadListing) {
    return (
      <UploadDocumentsScreen
        listing={uploadListing}
        onBack={() => setUploadPropertyId(null)}
        onUploaded={load}
        authFetch={authFetch}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Listing Verification
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {counts.verified} verified · {counts.inReview} in review · {counts.unverified}{" "}
            unverified
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600"
          >
            <option value="All">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="InReview">In Review</option>
            <option value="Unverified">Unverified</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
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

      <p className="text-xs text-slate-500">
        Track verification status here. Open <span className="font-semibold">Upload documents</span>{" "}
        for each listing to attach Sale Fard, Registry, CNIC, and other title papers after publish.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No listings in this view</p>
          <Link
            href="/properties/new"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline"
          >
            Add a listing first
          </Link>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {visible.map((item) => {
            const busy = requestingId === item.propertyId;
            const canRequest =
              item.verificationStatus === "Unverified" &&
              (!item.caseStatus ||
                item.caseStatus === "Completed" ||
                item.caseStatus === "Cancelled");
            const progress =
              item.totalChecks && item.totalChecks > 0
                ? Math.round(((item.passedChecks ?? 0) / item.totalChecks) * 100)
                : null;
            const coverage = requiredDocsCoverage(item.evidenceDocumentTypes ?? []);

            return (
              <div
                key={item.propertyId}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${verificationBadgeClass(item.verificationStatus)}`}
                      >
                        {humanize(item.verificationStatus)}
                      </span>
                      {item.caseStatus && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${caseBadgeClass(item.caseStatus)}`}
                        >
                          Case: {humanize(item.caseStatus)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">
                      {[item.area, item.city].filter(Boolean).join(", ")}
                      {item.listingStatus ? ` · Listing ${item.listingStatus}` : ""}
                    </p>
                    {item.latitude != null && item.longitude != null && (
                      <div className="pt-2">
                        <PropertyMapDisplay
                          latitude={item.latitude}
                          longitude={item.longitude}
                          title="Verifier / agent exact pin"
                          heightClass="h-36"
                        />
                      </div>
                    )}
                    {item.specialistName && (
                      <p className="text-slate-600">
                        Specialist:{" "}
                        <span className="font-semibold">{item.specialistName}</span>
                        {item.serviceLevel ? ` · ${humanize(item.serviceLevel)}` : ""}
                      </p>
                    )}
                    {progress != null && (
                      <p className="text-slate-600">
                        Checklist: {item.passedChecks}/{item.totalChecks} passed
                        {item.concernChecks ? ` · ${item.concernChecks} concern` : ""} ({progress}
                        %)
                      </p>
                    )}
                    <p
                      className={
                        coverage.missingRequired.length === 0
                          ? "text-emerald-700 font-semibold"
                          : "text-amber-800 font-semibold"
                      }
                    >
                      Docs {coverage.requiredMet}/{coverage.requiredTotal} required
                      {(item.evidenceCount ?? 0) > 0
                        ? ` · ${item.evidenceCount} file${item.evidenceCount === 1 ? "" : "s"}`
                        : " · none uploaded"}
                    </p>
                    {item.hasReport && (
                      <p className="text-emerald-700 font-semibold">Report published</p>
                    )}
                  </div>
                </div>

                {cardMsg[item.propertyId] && (
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      cardMsg[item.propertyId].type === "ok"
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border border-rose-200 text-rose-800"
                    }`}
                  >
                    {cardMsg[item.propertyId].text}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadPropertyId(item.propertyId)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Upload documents
                  </button>
                  {item.hasReport && item.activeCaseId && (
                    <button
                      type="button"
                      onClick={() => void openReport(item)}
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View report
                    </button>
                  )}
                  <Link
                    href={`/properties/${item.propertyId}/edit`}
                    className="inline-flex items-center font-bold text-slate-700 bg-white border border-slate-200 px-3.5 py-2 rounded-xl"
                  >
                    Edit listing
                  </Link>
                </div>

                {canRequest && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-blue-800">
                        Verification tier
                      </label>
                      <select
                        value={levelDraft[item.propertyId] || "PropertySiteVisit"}
                        disabled={busy}
                        onChange={(e) =>
                          setLevelDraft((prev) => ({
                            ...prev,
                            [item.propertyId]: e.target.value,
                          }))
                        }
                        className="w-full mt-1 bg-white border border-blue-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                      >
                        {SERVICE_LEVELS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void requestVerification(item.propertyId)}
                      className="inline-flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Requesting…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Request verification
                        </>
                      )}
                    </button>
                  </div>
                )}

                {item.verificationStatus === "InReview" && !canRequest && (
                  <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 font-medium">
                    Verification in progress
                    {item.specialistName ? ` with ${item.specialistName}` : ""}. Use Upload
                    documents if the specialist still needs papers.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reportListing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded">
                  {(reportListing.activeCaseId ?? "").slice(0, 8)}…
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Verification Report</h2>
                <p className="text-xs text-slate-500 mt-0.5">{reportListing.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setReportListing(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportLoading && (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                Loading report…
              </div>
            )}

            {!reportLoading && reportDetail && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Target</span>
                    <span className="font-bold text-slate-800">{reportListing.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Specialist</span>
                    <span className="font-bold text-slate-800">
                      {reportListing.specialistName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Service</span>
                    <span className="font-bold text-slate-800">
                      {humanize(reportListing.serviceLevel)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Status</span>
                    <span className="font-bold text-emerald-700">
                      {humanize(reportListing.caseStatus) ||
                        humanize(reportListing.verificationStatus)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Executive Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                    {reportDetail.summary}
                  </p>
                </div>

                {reportDetail.checklist.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Checklist
                    </h3>
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                      {reportDetail.checklist.map((c, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-slate-800">{c.title}</span>
                          </div>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded text-[11px]">
                            {c.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {reportDetail.specialistNotes && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                      <span className="font-bold text-slate-800 block">Specialist Notes</span>
                      <p className="text-slate-600 leading-relaxed">
                        {reportDetail.specialistNotes}
                      </p>
                    </div>
                  )}
                  {reportDetail.recommendations && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                      <span className="font-bold text-slate-800 block">Recommendations</span>
                      <p className="text-slate-600 leading-relaxed">
                        {reportDetail.recommendations}
                      </p>
                    </div>
                  )}
                </div>

                {reportDetail.limitations && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Limitations
                    </div>
                    <p className="text-amber-800 leading-relaxed">{reportDetail.limitations}</p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setReportListing(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
