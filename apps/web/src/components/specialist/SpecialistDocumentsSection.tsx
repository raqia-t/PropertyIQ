"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface DocViewerState {
  title: string;
  contentType: string;
  url: string;
  isBlob: boolean;
}

type CheckResult = "NotChecked" | "Pass" | "NeedsEvidence" | "Concern";

interface DocCheck {
  id: string;
  category: string;
  checkCode: string;
  checkTitle: string;
  result: CheckResult;
  notes?: string | null;
}

interface CaseFile {
  id: string;
  evidenceType: string;
  fileUrl: string;
  capturedAtUtc: string;
}

interface TitleDocument {
  id: string;
  propertyId: string;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  reviewerNotes?: string | null;
  uploadedBy: string;
  uploadedAtUtc: string;
  downloadPath: string;
}

interface DocumentCase {
  caseId: string;
  targetName: string;
  targetCity: string;
  targetArea: string;
  propertyId?: string | null;
  serviceLevel: string;
  caseStatus: string;
  docReviewStatus: string;
  customerName: string;
  isAssignedToMe: boolean;
  canSelfAssign: boolean;
  docCheckCount: number;
  docPassedCount: number;
  docConcernCount: number;
  caseFileCount: number;
  titleDocCount: number;
  pendingTitleDocCount: number;
  hasReport: boolean;
  createdAtUtc: string;
  documentChecks: DocCheck[];
  caseFiles: CaseFile[];
  titleDocuments: TitleDocument[];
}

interface DocumentsResponse {
  specialist: { id: string; fullName: string; email: string };
  summary: {
    casesWithDocs: number;
    pendingTitleDocs: number;
    awaitingCount: number;
    inReviewCount: number;
    pendingReviewCount: number;
    docsClearCount: number;
    concernCount: number;
    filteredCount: number;
  };
  cases: DocumentCase[];
}

const SCOPE_OPTIONS = [
  { value: "active", label: "Active cases" },
  { value: "mine", label: "Assigned to me" },
  { value: "queue", label: "Open queue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All visible" },
] as const;

const DOC_STATUS_OPTIONS = [
  "Awaiting",
  "InReview",
  "PendingReview",
  "DocsClear",
  "Concern",
  "Closed",
] as const;

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function serviceLabel(level: string): string {
  return level.replace(/([A-Z])/g, " $1").trim();
}

function docStatusBadge(status: string): string {
  switch (status) {
    case "DocsClear":
    case "Closed":
      return "bg-emerald-100 text-emerald-800";
    case "PendingReview":
    case "Awaiting":
      return "bg-amber-100 text-amber-800";
    case "InReview":
      return "bg-blue-100 text-blue-800";
    case "Concern":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function titleStatusBadge(status: string): string {
  switch (status) {
    case "Accepted":
      return "bg-emerald-100 text-emerald-800";
    case "Submitted":
      return "bg-amber-100 text-amber-800";
    case "Rejected":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function fileHref(url: string): string {
  if (!url) return "#";
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/media-files/${url}`;
}

function isImageType(contentType: string, fileName: string): boolean {
  if (contentType.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

function isPdfType(contentType: string, fileName: string): boolean {
  if (contentType.includes("pdf")) return true;
  return /\.pdf$/i.test(fileName);
}

function guessTypeFromUrl(url: string): string {
  if (/\.pdf($|\?)/i.test(url)) return "application/pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/i.test(url)) return "image/*";
  return "application/octet-stream";
}

function parseDocuments(json: Record<string, unknown>): DocumentsResponse {
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
      casesWithDocs: Number(summary.casesWithDocs ?? summary.CasesWithDocs ?? 0),
      pendingTitleDocs: Number(summary.pendingTitleDocs ?? summary.PendingTitleDocs ?? 0),
      awaitingCount: Number(summary.awaitingCount ?? summary.AwaitingCount ?? 0),
      inReviewCount: Number(summary.inReviewCount ?? summary.InReviewCount ?? 0),
      pendingReviewCount: Number(summary.pendingReviewCount ?? summary.PendingReviewCount ?? 0),
      docsClearCount: Number(summary.docsClearCount ?? summary.DocsClearCount ?? 0),
      concernCount: Number(summary.concernCount ?? summary.ConcernCount ?? 0),
      filteredCount: Number(summary.filteredCount ?? summary.FilteredCount ?? 0),
    },
    cases: rows.map((c) => {
      const checks = (c.documentChecks ?? c.DocumentChecks ?? []) as Record<string, unknown>[];
      const files = (c.caseFiles ?? c.CaseFiles ?? []) as Record<string, unknown>[];
      const titles = (c.titleDocuments ?? c.TitleDocuments ?? []) as Record<string, unknown>[];
      return {
        caseId: String(c.caseId ?? c.CaseId ?? ""),
        targetName: String(c.targetName ?? c.TargetName ?? "Target"),
        targetCity: String(c.targetCity ?? c.TargetCity ?? ""),
        targetArea: String(c.targetArea ?? c.TargetArea ?? ""),
        propertyId: (c.propertyId ?? c.PropertyId) as string | null | undefined,
        serviceLevel: String(c.serviceLevel ?? c.ServiceLevel ?? ""),
        caseStatus: String(c.caseStatus ?? c.CaseStatus ?? ""),
        docReviewStatus: String(c.docReviewStatus ?? c.DocReviewStatus ?? ""),
        customerName: String(c.customerName ?? c.CustomerName ?? "Customer"),
        isAssignedToMe: Boolean(c.isAssignedToMe ?? c.IsAssignedToMe),
        canSelfAssign: Boolean(c.canSelfAssign ?? c.CanSelfAssign),
        docCheckCount: Number(c.docCheckCount ?? c.DocCheckCount ?? 0),
        docPassedCount: Number(c.docPassedCount ?? c.DocPassedCount ?? 0),
        docConcernCount: Number(c.docConcernCount ?? c.DocConcernCount ?? 0),
        caseFileCount: Number(c.caseFileCount ?? c.CaseFileCount ?? 0),
        titleDocCount: Number(c.titleDocCount ?? c.TitleDocCount ?? 0),
        pendingTitleDocCount: Number(c.pendingTitleDocCount ?? c.PendingTitleDocCount ?? 0),
        hasReport: Boolean(c.hasReport ?? c.HasReport),
        createdAtUtc: String(c.createdAtUtc ?? c.CreatedAtUtc ?? ""),
        documentChecks: checks.map((ci) => ({
          id: String(ci.id ?? ci.Id ?? ""),
          category: String(ci.category ?? ci.Category ?? ""),
          checkCode: String(ci.checkCode ?? ci.CheckCode ?? ""),
          checkTitle: String(ci.checkTitle ?? ci.CheckTitle ?? ""),
          result: String(ci.result ?? ci.Result ?? "NotChecked") as CheckResult,
          notes: (ci.notes ?? ci.Notes) as string | null | undefined,
        })),
        caseFiles: files.map((f) => ({
          id: String(f.id ?? f.Id ?? ""),
          evidenceType: String(f.evidenceType ?? f.EvidenceType ?? ""),
          fileUrl: String(f.fileUrl ?? f.FileUrl ?? ""),
          capturedAtUtc: String(f.capturedAtUtc ?? f.CapturedAtUtc ?? ""),
        })),
        titleDocuments: titles.map((t) => ({
          id: String(t.id ?? t.Id ?? ""),
          propertyId: String(t.propertyId ?? t.PropertyId ?? ""),
          documentType: String(t.documentType ?? t.DocumentType ?? ""),
          fileName: String(t.fileName ?? t.FileName ?? ""),
          contentType: String(t.contentType ?? t.ContentType ?? ""),
          sizeBytes: Number(t.sizeBytes ?? t.SizeBytes ?? 0),
          status: String(t.status ?? t.Status ?? ""),
          reviewerNotes: (t.reviewerNotes ?? t.ReviewerNotes) as string | null | undefined,
          uploadedBy: String(t.uploadedBy ?? t.UploadedBy ?? ""),
          uploadedAtUtc: String(t.uploadedAtUtc ?? t.UploadedAtUtc ?? ""),
          downloadPath: String(t.downloadPath ?? t.DownloadPath ?? ""),
        })),
      };
    }),
  };
}

export default function SpecialistDocumentsSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [scope, setScope] = useState("active");
  const [docStatus, setDocStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DocViewerState | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerRef = useRef<DocViewerState | null>(null);
  viewerRef.current = viewer;

  const closeViewer = useCallback(() => {
    setViewer((prev) => {
      if (prev?.isBlob) URL.revokeObjectURL(prev.url);
      return null;
    });
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
      const current = viewerRef.current;
      if (current?.isBlob) URL.revokeObjectURL(current.url);
    };
  }, []);

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
      if (docStatus !== "All") params.set("docStatus", docStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/verification/specialist/documents?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a verification specialist."
              : res.status === 403
                ? "Documents require a Specialist account."
                : `Could not load documents (${res.status}).`)
        );
      }
      setData(parseDocuments((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope, docStatus, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a verification specialist to review documents.");
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
          assignmentNotes: "Self-assigned from Documents page",
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

  const updateCheck = async (
    caseId: string,
    itemId: string,
    result: CheckResult,
    notes?: string
  ) => {
    setBusyKey(itemId);
    try {
      const res = await authFetch(`/api/verification/cases/${caseId}/checklist/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ result, notes: notes ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Update failed");
      }
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not update document check");
    } finally {
      setBusyKey(null);
    }
  };

  const reviewTitleDoc = async (
    doc: TitleDocument,
    caseId: string,
    approve: boolean
  ) => {
    setBusyKey(doc.id);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/verification/specialist/documents/${doc.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          approve,
          linkCaseId: caseId,
          notes: approve
            ? "Accepted from Documents workspace"
            : "Rejected from Documents workspace — re-upload required",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string } | null)?.message || "Review failed");
      }
      setActionMsg(approve ? `Accepted ${doc.fileName}.` : `Rejected ${doc.fileName}.`);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not review document");
    } finally {
      setBusyKey(null);
    }
  };

  const openViewerFromBlob = (blob: Blob, title: string, contentTypeHint?: string) => {
    const contentType = contentTypeHint || blob.type || "application/octet-stream";
    const url = URL.createObjectURL(blob);
    setViewer((prev) => {
      if (prev?.isBlob) URL.revokeObjectURL(prev.url);
      return { title, contentType, url, isBlob: true };
    });
  };

  const viewTitleDoc = async (doc: TitleDocument) => {
    setBusyKey(`view-${doc.id}`);
    setViewerLoading(true);
    setActionMsg(null);
    try {
      const res = await authFetch(doc.downloadPath);
      if (!res.ok) throw new Error(`Could not open document (${res.status})`);
      const blob = await res.blob();
      const header = new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer());
      const looksPdf = header.startsWith("%PDF");
      const looksImage = (doc.contentType || blob.type || "").startsWith("image/");
      // Stub/corrupt uploads (e.g. tiny text labeled as PDF) fail the browser PDF plugin.
      if (
        (doc.contentType?.includes("pdf") || looksPdf || /\.pdf$/i.test(doc.fileName)) &&
        (blob.size < 200 || !looksPdf)
      ) {
        throw new Error(
          `"${doc.fileName}" is not a valid PDF (${blob.size} B). Ask the agent to re-upload the title file.`
        );
      }
      if (!looksPdf && !looksImage && blob.size < 64) {
        throw new Error(`"${doc.fileName}" looks empty or corrupt — re-upload required.`);
      }
      openViewerFromBlob(blob, doc.fileName || "Title document", doc.contentType || blob.type);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not open document");
    } finally {
      setBusyKey(null);
      setViewerLoading(false);
    }
  };

  const viewCaseFile = async (file: CaseFile) => {
    const href = fileHref(file.fileUrl);
    if (!href || href === "#") {
      setActionMsg("No file URL available for this upload.");
      return;
    }
    setBusyKey(`view-case-${file.id}`);
    setViewerLoading(true);
    setActionMsg(null);
    try {
      // Same-origin / API paths need auth; absolute public URLs can load directly.
      if (href.startsWith("http://") || href.startsWith("https://")) {
        setViewer((prev) => {
          if (prev?.isBlob) URL.revokeObjectURL(prev.url);
          return {
            title: `${file.evidenceType} · ${formatDate(file.capturedAtUtc)}`,
            contentType: guessTypeFromUrl(href),
            url: href,
            isBlob: false,
          };
        });
        return;
      }
      const res = await authFetch(href);
      if (!res.ok) throw new Error(`Could not open file (${res.status})`);
      const blob = await res.blob();
      openViewerFromBlob(
        blob,
        `${file.evidenceType} · ${formatDate(file.capturedAtUtc)}`,
        blob.type
      );
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setBusyKey(null);
      setViewerLoading(false);
    }
  };

  const downloadTitleDoc = async (doc: TitleDocument) => {
    setBusyKey(`dl-${doc.id}`);
    try {
      const res = await authFetch(doc.downloadPath);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName || "evidence";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Download failed");
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
        Loading title & legal documents…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Title deeds & legal records
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.specialist.fullName || "Specialist"} · document checklist + private title files ·
            live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/specialist/cases" className="text-xs font-bold text-teal-700 hover:underline px-2">
            Cases →
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
        Documents cover <span className="font-bold">registry / CNIC / NOC / mutation / tax</span>{" "}
        checklist rows, buyer-uploaded case files, and private listing title evidence (Accept /
        Reject). Site photos live under Visits / Evidence.
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
            <p className="text-xl font-black text-slate-900">{summary.casesWithDocs}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-amber-700">Title pending</p>
            <p className="text-xl font-black text-amber-900">{summary.pendingTitleDocs}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-blue-700">In review</p>
            <p className="text-xl font-black text-blue-900">{summary.inReviewCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Docs clear</p>
            <p className="text-xl font-black text-emerald-900">{summary.docsClearCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
            <p className="text-[10px] font-bold uppercase text-rose-700">Concern</p>
            <p className="text-xl font-black text-rose-900">{summary.concernCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Awaiting</p>
            <p className="text-xl font-black text-slate-900">{summary.awaitingCount}</p>
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
          value={docStatus}
          onChange={(e) => setDocStatus(e.target.value)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          <option value="All">Any doc status</option>
          {DOC_STATUS_OPTIONS.map((s) => (
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
            placeholder="Search target, buyer…"
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {(viewer || viewerLoading) && (
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
              {viewerLoading && !viewer ? (
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
                  <p className="text-xs text-slate-500 max-w-sm">
                    This file type can&apos;t be rendered here. Open it in a new tab or download it.
                  </p>
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

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No document work in this view</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cases with checklist document categories appear here. Agents can also upload private title
            evidence on listings for specialist Accept / Reject.
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
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${docStatusBadge(c.docReviewStatus)}`}
                      >
                        {c.docReviewStatus}
                      </span>
                      {c.pendingTitleDocCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {c.pendingTitleDocCount} title pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {[c.targetArea, c.targetCity].filter(Boolean).join(", ")} ·{" "}
                      {serviceLabel(c.serviceLevel)} · {c.customerName}
                    </p>
                    <p className="text-xs text-slate-600">
                      Doc checks {c.docPassedCount}/{c.docCheckCount}
                      {c.docConcernCount > 0 ? ` · ${c.docConcernCount} concern` : ""} ·{" "}
                      {c.caseFileCount} case file{c.caseFileCount === 1 ? "" : "s"} ·{" "}
                      {c.titleDocCount} title doc{c.titleDocCount === 1 ? "" : "s"}
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
                        Requested {formatDate(c.createdAtUtc)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-slate-900">Document checklist</h4>
                      {c.documentChecks.map((check) => {
                        const itemBusy = busyKey === check.id;
                        return (
                          <div
                            key={check.id}
                            className="rounded-xl border border-slate-200 p-3 space-y-2"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="font-mono text-[10px] font-bold text-slate-500">
                                  {check.checkCode}
                                </span>
                                <p className="text-xs font-semibold text-slate-800">
                                  {check.checkTitle}
                                </p>
                                <p className="text-[10px] uppercase text-slate-400 font-bold">
                                  {check.category}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {(["Pass", "NeedsEvidence", "Concern"] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    disabled={itemBusy || !c.isAssignedToMe || c.hasReport}
                                    onClick={() =>
                                      void updateCheck(c.caseId, check.id, r, check.notes ?? "")
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold disabled:opacity-40 ${
                                      check.result === r
                                        ? r === "Pass"
                                          ? "bg-emerald-600 text-white"
                                          : r === "Concern"
                                            ? "bg-rose-600 text-white"
                                            : "bg-amber-500 text-white"
                                        : "bg-white border border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {r === "Pass" ? "Pass" : r === "Concern" ? "Concern" : "Need proof"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="text"
                              defaultValue={check.notes ?? ""}
                              disabled={!c.isAssignedToMe || c.hasReport}
                              onBlur={(e) => {
                                const notes = e.target.value;
                                if (notes !== (check.notes ?? ""))
                                  void updateCheck(c.caseId, check.id, check.result, notes);
                              }}
                              placeholder="Registry ref, NOC number, mutation remarks…"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {c.caseFiles.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm text-slate-900">Case file uploads</h4>
                        <ul className="space-y-2 text-xs">
                          {c.caseFiles.map((f) => (
                            <li
                              key={f.id}
                              className="rounded-xl border border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-slate-800">
                                {f.evidenceType} · {formatDate(f.capturedAtUtc)}
                              </span>
                              <button
                                type="button"
                                disabled={busyKey === `view-case-${f.id}`}
                                onClick={() => void viewCaseFile(f)}
                                className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline disabled:opacity-50"
                              >
                                {busyKey === `view-case-${f.id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                View
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-bold text-sm text-slate-900">
                        Private title evidence ({c.titleDocuments.length})
                      </h4>
                      {c.titleDocuments.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No listing title uploads yet. Agents attach Sale Fard / Registry / Allotment
                          from the property edit flow.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {c.titleDocuments.map((doc) => {
                            const busy = busyKey === doc.id;
                            return (
                              <div
                                key={doc.id}
                                className="rounded-xl border border-slate-200 p-3 text-xs space-y-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900">{doc.fileName}</span>
                                  <span className="text-slate-500">{doc.documentType}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${titleStatusBadge(doc.status)}`}
                                  >
                                    {doc.status}
                                  </span>
                                </div>
                                <p className="text-slate-500">
                                  {formatBytes(doc.sizeBytes)} · by {doc.uploadedBy} ·{" "}
                                  {formatDate(doc.uploadedAtUtc)}
                                </p>
                                {doc.reviewerNotes && (
                                  <p className="text-slate-600">{doc.reviewerNotes}</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busyKey === `view-${doc.id}`}
                                    onClick={() => void viewTitleDoc(doc)}
                                    className="inline-flex items-center gap-1.5 font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-xl disabled:opacity-50"
                                  >
                                    {busyKey === `view-${doc.id}` ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyKey === `dl-${doc.id}`}
                                    onClick={() => void downloadTitleDoc(doc)}
                                    className="font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl disabled:opacity-50"
                                  >
                                    Download
                                  </button>
                                  {doc.status === "Submitted" && c.isAssignedToMe && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void reviewTitleDoc(doc, c.caseId, true)}
                                        className="inline-flex items-center gap-1 font-bold text-emerald-700 disabled:opacity-50"
                                      >
                                        {busy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Check className="w-3 h-3" />
                                        )}
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void reviewTitleDoc(doc, c.caseId, false)}
                                        className="inline-flex items-center gap-1 font-bold text-rose-700 disabled:opacity-50"
                                      >
                                        <X className="w-3 h-3" />
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
