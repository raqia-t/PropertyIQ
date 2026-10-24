"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NocProject {
  id: string;
  name: string;
  slug: string;
  city: string;
  approvalStatus: string;
  approvalReferenceNumber?: string | null;
  regulatoryAuthority?: string | null;
}

interface NocDocument {
  id: string;
  projectId: string;
  projectName: string;
  documentType: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  notes?: string | null;
  uploadedAtUtc: string;
  downloadPath: string;
}

const DOC_TYPES = ["NOC", "ApprovalLetter", "LayoutPlan", "Other"] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function parse(json: Record<string, unknown>) {
  const org = (json.organization ?? json.Organization ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const projects = (json.projects ?? json.Projects ?? []) as Record<string, unknown>[];
  const documents = (json.documents ?? json.Documents ?? []) as Record<string, unknown>[];
  return {
    organization: { name: String(org.name ?? org.Name ?? "Developer") },
    summary: {
      projectCount: Number(summary.projectCount ?? summary.ProjectCount ?? 0),
      documentCount: Number(summary.documentCount ?? summary.DocumentCount ?? 0),
      approvedProjects: Number(summary.approvedProjects ?? summary.ApprovedProjects ?? 0),
    },
    projects: projects.map((p) => ({
      id: String(p.id ?? p.Id ?? ""),
      name: String(p.name ?? p.Name ?? ""),
      slug: String(p.slug ?? p.Slug ?? ""),
      city: String(p.city ?? p.City ?? ""),
      approvalStatus: String(p.approvalStatus ?? p.ApprovalStatus ?? "Pending"),
      approvalReferenceNumber: (p.approvalReferenceNumber ??
        p.ApprovalReferenceNumber) as string | null | undefined,
      regulatoryAuthority: (p.regulatoryAuthority ?? p.RegulatoryAuthority) as
        | string
        | null
        | undefined,
    })),
    documents: documents.map((d) => ({
      id: String(d.id ?? d.Id ?? ""),
      projectId: String(d.projectId ?? d.ProjectId ?? ""),
      projectName: String(d.projectName ?? d.ProjectName ?? ""),
      documentType: String(d.documentType ?? d.DocumentType ?? "NOC"),
      title: String(d.title ?? d.Title ?? ""),
      fileName: String(d.fileName ?? d.FileName ?? ""),
      contentType: String(d.contentType ?? d.ContentType ?? ""),
      sizeBytes: Number(d.sizeBytes ?? d.SizeBytes ?? 0),
      notes: (d.notes ?? d.Notes) as string | null | undefined,
      uploadedAtUtc: String(d.uploadedAtUtc ?? d.UploadedAtUtc ?? ""),
      downloadPath: String(d.downloadPath ?? d.DownloadPath ?? ""),
    })),
  };
}

export default function DeveloperNocSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<ReturnType<typeof parse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("all");
  const [docType, setDocType] = useState("NOC");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        projectId !== "all" ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const res = await authFetch(`/api/projects/developer/noc${qs}`);
      if (!res.ok) throw new Error(`Could not load NOC docs (${res.status})`);
      const parsed = parse((await res.json()) as Record<string, unknown>);
      setData(parsed);
      if (projectId === "all" && parsed.projects[0]) {
        // keep filter
      }
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load NOC center");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const upload = async (file: File) => {
    const pid = projectId === "all" ? data?.projects[0]?.id : projectId;
    if (!pid) {
      setMsg("Select a project first.");
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentType", docType);
      if (title.trim()) form.append("title", title.trim());
      const res = await authFetch(`/api/projects/${pid}/noc`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Upload failed");
      }
      setMsg(`Uploaded ${file.name}`);
      setTitle("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const viewDoc = async (doc: NocDocument) => {
    setBusyId(doc.id);
    try {
      const res = await authFetch(doc.downloadPath);
      if (!res.ok) throw new Error(`Open failed (${res.status})`);
      const blob = await res.blob();
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(URL.createObjectURL(blob));
      setViewerTitle(doc.fileName);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setBusyId(null);
    }
  };

  const removeDoc = async (doc: NocDocument) => {
    if (!window.confirm(`Remove ${doc.fileName}?`)) return;
    setBusyId(doc.id);
    try {
      const res = await authFetch(`/api/projects/${doc.projectId}/noc/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setMsg("Document removed.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    };
  }, [viewerUrl]);

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading NOC documentation…
      </div>
    );
  }

  const projects = data?.projects ?? [];
  const documents = data?.documents ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            NOC documentation center
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name} · {data?.summary.documentCount ?? 0} files ·{" "}
            {data?.summary.approvedProjects ?? 0}/{data?.summary.projectCount ?? 0} schemes
            approved
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/developer/projects"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Edit project approval →
          </Link>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl"
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
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Upload NOC / approval file</h4>
        <div className="grid sm:grid-cols-3 gap-2">
          <select
            value={projectId === "all" ? projects[0]?.id || "" : projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.approvalStatus}
              </option>
            ))}
          </select>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          disabled={uploading || projects.length === 0}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2.5 rounded-xl"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Choose PDF or image
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No NOC documents uploaded yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">
                  {d.title || d.fileName}{" "}
                  <span className="text-slate-400 font-semibold">· {d.documentType}</span>
                </p>
                <p className="text-slate-500">
                  {d.projectName} · {formatBytes(d.sizeBytes)} · {formatDate(d.uploadedAtUtc)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void viewDoc(d)}
                  className="inline-flex items-center gap-1 font-bold text-white bg-teal-600 px-2.5 py-1.5 rounded-lg"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void removeDoc(d)}
                  className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          onClick={() => {
            URL.revokeObjectURL(viewerUrl);
            setViewerUrl(null);
          }}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-bold truncate">{viewerTitle}</p>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(viewerUrl);
                  setViewerUrl(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {viewerTitle.toLowerCase().endsWith(".pdf") ||
            viewerTitle.toLowerCase().includes("pdf") ? (
              <iframe title={viewerTitle} src={viewerUrl} className="w-full h-[70vh]" />
            ) : (
              <div className="p-4 flex justify-center bg-slate-100 h-[70vh] overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewerUrl} alt={viewerTitle} className="max-h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-1">
          <p className="font-bold text-slate-800 inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Scheme approval snapshot
          </p>
          {projects.map((p) => (
            <p key={p.id} className="text-slate-600">
              {p.name}: {p.approvalStatus}
              {p.approvalReferenceNumber ? ` · ${p.approvalReferenceNumber}` : ""}
              {p.regulatoryAuthority ? ` · ${p.regulatoryAuthority}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
