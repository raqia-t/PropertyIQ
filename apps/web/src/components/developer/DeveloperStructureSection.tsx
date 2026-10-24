"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Layers, Loader2, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface BlockRow {
  id: string;
  name: string;
  blockType?: string | null;
  unitCount: number;
}

interface PhaseRow {
  id: string;
  name: string;
  description?: string | null;
  unitCount: number;
  blocks: BlockRow[];
}

interface ProjectStructure {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
  phases: PhaseRow[];
}

function parse(json: Record<string, unknown>): {
  organization: { name: string };
  projects: ProjectStructure[];
} {
  const org = (json.organization ?? json.Organization ?? {}) as Record<string, unknown>;
  const projects = (json.projects ?? json.Projects ?? []) as Record<string, unknown>[];
  return {
    organization: { name: String(org.name ?? org.Name ?? "Developer") },
    projects: projects.map((p) => {
      const phases = (p.phases ?? p.Phases ?? []) as Record<string, unknown>[];
      return {
        id: String(p.id ?? p.Id ?? ""),
        name: String(p.name ?? p.Name ?? ""),
        slug: String(p.slug ?? p.Slug ?? ""),
        city: String(p.city ?? p.City ?? ""),
        area: String(p.area ?? p.Area ?? ""),
        phases: phases.map((ph) => {
          const blocks = (ph.blocks ?? ph.Blocks ?? []) as Record<string, unknown>[];
          return {
            id: String(ph.id ?? ph.Id ?? ""),
            name: String(ph.name ?? ph.Name ?? ""),
            description: (ph.description ?? ph.Description) as string | null | undefined,
            unitCount: Number(ph.unitCount ?? ph.UnitCount ?? 0),
            blocks: blocks.map((b) => ({
              id: String(b.id ?? b.Id ?? ""),
              name: String(b.name ?? b.Name ?? ""),
              blockType: (b.blockType ?? b.BlockType) as string | null | undefined,
              unitCount: Number(b.unitCount ?? b.UnitCount ?? 0),
            })),
          };
        }),
      };
    }),
  };
}

export default function DeveloperStructureSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [projects, setProjects] = useState<ProjectStructure[]>([]);
  const [orgName, setOrgName] = useState("Developer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [phaseName, setPhaseName] = useState("");
  const [phaseDesc, setPhaseDesc] = useState("");
  const [blockPhaseId, setBlockPhaseId] = useState("");
  const [blockName, setBlockName] = useState("");
  const [blockType, setBlockType] = useState("Residential");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/projects/developer/structure");
      if (!res.ok) throw new Error(`Could not load structure (${res.status})`);
      const parsed = parse((await res.json()) as Record<string, unknown>);
      setProjects(parsed.projects);
      setOrgName(parsed.organization.name);
      setSelectedProjectId((prev) => prev || parsed.projects[0]?.id || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load structure");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const selected = projects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selected?.phases[0] && !blockPhaseId) {
      setBlockPhaseId(selected.phases[0].id);
    }
  }, [selected, blockPhaseId]);

  const addPhase = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !phaseName.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await authFetch(`/api/projects/${selectedProjectId}/phases`, {
        method: "POST",
        body: JSON.stringify({
          name: phaseName.trim(),
          description: phaseDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Failed");
      }
      setPhaseName("");
      setPhaseDesc("");
      setMsg("Phase created.");
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not add phase");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!blockPhaseId || !blockName.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await authFetch(`/api/projects/phases/${blockPhaseId}/blocks`, {
        method: "POST",
        body: JSON.stringify({
          name: blockName.trim(),
          blockType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Failed");
      }
      setBlockName("");
      setMsg("Block created.");
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not add block");
    } finally {
      setSaving(false);
    }
  };

  const removePhase = async (ph: PhaseRow) => {
    if (ph.unitCount > 0) {
      setMsg(`Cannot delete “${ph.name}” — ${ph.unitCount} unit(s) still assigned.`);
      return;
    }
    if (
      !window.confirm(
        `Remove phase “${ph.name}” and its empty blocks? Only allowed when it has zero units.`
      )
    ) {
      return;
    }
    setBusyId(ph.id);
    setMsg(null);
    try {
      const res = await authFetch(`/api/projects/phases/${ph.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Delete failed");
      }
      if (blockPhaseId === ph.id) setBlockPhaseId("");
      setMsg("Phase removed.");
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not delete phase");
    } finally {
      setBusyId(null);
    }
  };

  const removeBlock = async (b: BlockRow) => {
    if (b.unitCount > 0) {
      setMsg(`Cannot delete “${b.name}” — ${b.unitCount} unit(s) still assigned.`);
      return;
    }
    if (!window.confirm(`Remove block “${b.name}”? Only allowed when it has zero units.`)) {
      return;
    }
    setBusyId(b.id);
    setMsg(null);
    try {
      const res = await authFetch(`/api/projects/blocks/${b.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Delete failed");
      }
      setMsg("Block removed.");
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not delete block");
    } finally {
      setBusyId(null);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading phases &amp; blocks…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Phases &amp; blocks
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {orgName} · structure inventory sits under · live from Postgres
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/developer/inventory"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Inventory →
          </Link>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setBlockPhaseId("");
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
          >
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

      {!selected ? (
        <p className="text-xs text-slate-500">Create a project first.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <form
              onSubmit={addPhase}
              className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-2"
            >
              <h4 className="text-sm font-bold text-slate-900">Add phase</h4>
              <input
                required
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                placeholder="Phase name"
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                value={phaseDesc}
                onChange={(e) => setPhaseDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-3 py-2 rounded-xl disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add phase
              </button>
            </form>

            <form
              onSubmit={addBlock}
              className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-2"
            >
              <h4 className="text-sm font-bold text-slate-900">Add block</h4>
              <select
                required
                value={blockPhaseId}
                onChange={(e) => setBlockPhaseId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="">Select phase…</option>
                {selected.phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="Block name"
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
              </select>
              <button
                type="submit"
                disabled={saving || !blockPhaseId}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-3 py-2 rounded-xl disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add block
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">
              {selected.name} structure
            </h4>
            {selected.phases.length === 0 ? (
              <p className="text-xs text-slate-500">No phases yet.</p>
            ) : (
              selected.phases.map((ph) => (
                <div
                  key={ph.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-sm text-slate-900">{ph.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {ph.unitCount} units · {ph.blocks.length} blocks
                      </span>
                      {ph.unitCount === 0 && (
                        <button
                          type="button"
                          disabled={busyId === ph.id}
                          onClick={() => void removePhase(ph)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:underline disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete phase
                        </button>
                      )}
                    </div>
                  </div>
                  {ph.description && (
                    <p className="text-xs text-slate-500">{ph.description}</p>
                  )}
                  <ul className="grid sm:grid-cols-2 gap-2 text-xs">
                    {ph.blocks.map((b) => (
                      <li
                        key={b.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <span>
                          <span className="font-semibold text-slate-800">{b.name}</span>
                          <span className="text-slate-400">
                            {" "}
                            · {b.blockType || "Block"} · {b.unitCount} units
                          </span>
                        </span>
                        {b.unitCount === 0 && (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => void removeBlock(b)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 hover:underline disabled:opacity-50 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
