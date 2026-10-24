"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  PlusCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface PlanProject {
  id: string;
  name: string;
  slug: string;
  city: string;
}

interface PaymentPlanRow {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  name: string;
  totalPrice: number;
  currency: string;
  durationMonths: number;
  frequency: string;
  bookingPercentage: number;
  downPaymentPercentage: number;
  possessionPercentage: number;
  installmentPercentage: number;
  bookingsUsingPlan: number;
  createdAtUtc: string;
}

interface PlansResponse {
  organization: { id?: string | null; name: string };
  summary: { totalPlans: number; projectCount: number; plansWithBookings: number };
  projects: PlanProject[];
  plans: PaymentPlanRow[];
}

interface PreviewItem {
  sequence: number;
  title: string;
  dueDate: string;
  amount: number;
}

const FREQUENCIES = [
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Biannual", label: "Biannual" },
] as const;

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

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

function parsePlans(json: Record<string, unknown>): PlansResponse {
  const org = (json.organization ?? json.Organization ?? {}) as Record<string, unknown>;
  const summary = (json.summary ?? json.Summary ?? {}) as Record<string, unknown>;
  const projects = (json.projects ?? json.Projects ?? []) as Record<string, unknown>[];
  const plans = (json.plans ?? json.Plans ?? []) as Record<string, unknown>[];

  return {
    organization: {
      id: (org.id ?? org.Id) as string | null | undefined,
      name: String(org.name ?? org.Name ?? "Developer Firm"),
    },
    summary: {
      totalPlans: Number(summary.totalPlans ?? summary.TotalPlans ?? 0),
      projectCount: Number(summary.projectCount ?? summary.ProjectCount ?? 0),
      plansWithBookings: Number(summary.plansWithBookings ?? summary.PlansWithBookings ?? 0),
    },
    projects: projects.map((p) => ({
      id: String(p.id ?? p.Id ?? ""),
      name: String(p.name ?? p.Name ?? ""),
      slug: String(p.slug ?? p.Slug ?? ""),
      city: String(p.city ?? p.City ?? ""),
    })),
    plans: plans.map((pl) => ({
      id: String(pl.id ?? pl.Id ?? ""),
      projectId: String(pl.projectId ?? pl.ProjectId ?? ""),
      projectName: String(pl.projectName ?? pl.ProjectName ?? "Project"),
      projectSlug: String(pl.projectSlug ?? pl.ProjectSlug ?? ""),
      name: String(pl.name ?? pl.Name ?? ""),
      totalPrice: Number(pl.totalPrice ?? pl.TotalPrice ?? 0),
      currency: String(pl.currency ?? pl.Currency ?? "PKR"),
      durationMonths: Number(pl.durationMonths ?? pl.DurationMonths ?? 0),
      frequency: String(pl.frequency ?? pl.Frequency ?? "Quarterly"),
      bookingPercentage: Number(pl.bookingPercentage ?? pl.BookingPercentage ?? 0),
      downPaymentPercentage: Number(
        pl.downPaymentPercentage ?? pl.DownPaymentPercentage ?? 0
      ),
      possessionPercentage: Number(pl.possessionPercentage ?? pl.PossessionPercentage ?? 0),
      installmentPercentage: Number(pl.installmentPercentage ?? pl.InstallmentPercentage ?? 0),
      bookingsUsingPlan: Number(pl.bookingsUsingPlan ?? pl.BookingsUsingPlan ?? 0),
      createdAtUtc: String(pl.createdAtUtc ?? pl.CreatedAtUtc ?? ""),
    })),
  };
}

const emptyForm = {
  projectId: "",
  name: "3-Year Quarterly Plan",
  totalPrice: "9500000",
  durationMonths: "36",
  frequency: "Quarterly",
  bookingPercentage: "10",
  downPaymentPercentage: "15",
  possessionPercentage: "15",
};

export default function DeveloperPaymentPlansSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (projectFilter !== "all") qs.set("projectId", projectFilter);
      const res = await authFetch(
        `/api/projects/developer/payment-plans${qs.toString() ? `?${qs}` : ""}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ||
            (res.status === 401
              ? "Sign in as a developer."
              : `Could not load payment plans (${res.status}).`)
        );
      }
      setData(parsePlans((await res.json()) as Record<string, unknown>));
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load payment plans.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectFilter]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a developer to manage payment plans.");
      return;
    }
    void load();
  }, [isHydrated, isAuthenticated, load]);

  const milestoneSum = useMemo(() => {
    return (
      Number(form.bookingPercentage || 0) +
      Number(form.downPaymentPercentage || 0) +
      Number(form.possessionPercentage || 0)
    );
  }, [form.bookingPercentage, form.downPaymentPercentage, form.possessionPercentage]);

  const installmentPct = Math.max(0, 100 - milestoneSum);

  const openCreate = () => {
    setEditingId(null);
    setFormError(null);
    setPreview([]);
    setForm({
      ...emptyForm,
      projectId: data?.projects[0]?.id || "",
    });
    setShowForm(true);
  };

  const openEdit = (plan: PaymentPlanRow) => {
    setEditingId(plan.id);
    setFormError(null);
    setPreview([]);
    setForm({
      projectId: plan.projectId,
      name: plan.name,
      totalPrice: String(plan.totalPrice),
      durationMonths: String(plan.durationMonths),
      frequency: plan.frequency,
      bookingPercentage: String(plan.bookingPercentage),
      downPaymentPercentage: String(plan.downPaymentPercentage),
      possessionPercentage: String(plan.possessionPercentage),
    });
    setShowForm(true);
  };

  const loadPreview = async () => {
    const total = Number(form.totalPrice);
    if (!total || total <= 0) {
      setFormError("Enter a reference total price to preview the schedule.");
      return;
    }
    if (milestoneSum <= 0 || milestoneSum > 100) {
      setFormError("Milestone percentages must total between 0 and 100.");
      return;
    }
    setPreviewLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/bookings/calculate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: total,
          durationMonths: Number(form.durationMonths) || 36,
          frequency: form.frequency,
          bookingPercentage: Number(form.bookingPercentage) || 0,
          downPaymentPercentage: Number(form.downPaymentPercentage) || 0,
          possessionPercentage: Number(form.possessionPercentage) || 0,
          startDate: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Preview failed"
        );
      }
      const json = (await res.json()) as Record<string, unknown>;
      const schedule =
        (pick<Record<string, unknown>[]>(json, "schedule", "Schedule") as
          | Record<string, unknown>[]
          | undefined) ?? [];
      setPreview(
        schedule.map((s) => ({
          sequence: Number(pick(s, "sequenceNumber", "SequenceNumber") ?? 0),
          title: String(pick(s, "title", "Title") ?? "Installment"),
          dueDate: String(pick(s, "dueDate", "DueDate") ?? ""),
          amount: Number(pick(s, "amount", "Amount") ?? 0),
        }))
      );
    } catch (e: unknown) {
      setPreview([]);
      setFormError(e instanceof Error ? e.message : "Could not preview schedule");
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.projectId) {
      setFormError("Select a project.");
      return;
    }
    if (milestoneSum <= 0 || milestoneSum > 100) {
      setFormError("Booking + Down Payment + Possession must be between 0 and 100%.");
      return;
    }
    setSaving(true);
    setFormError(null);
    setActionMsg(null);
    try {
      const body = {
        projectId: form.projectId,
        name: form.name.trim(),
        totalPrice: Number(form.totalPrice),
        currency: "PKR",
        durationMonths: Number(form.durationMonths),
        frequency: form.frequency,
        bookingPercentage: Number(form.bookingPercentage),
        downPaymentPercentage: Number(form.downPaymentPercentage),
        possessionPercentage: Number(form.possessionPercentage),
      };
      const res = await authFetch(
        editingId
          ? `/api/projects/developer/payment-plans/${editingId}`
          : "/api/projects/developer/payment-plans",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Save failed (${res.status})`
        );
      }
      setActionMsg(
        editingId
          ? "Payment plan updated. New bookings will use the new template."
          : "Payment plan created — customers can select it on the public scheme page."
      );
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (plan: PaymentPlanRow) => {
    if (plan.bookingsUsingPlan > 0) {
      setActionMsg("Cannot remove a plan that already has bookings. Create a new plan instead.");
      return;
    }
    if (!window.confirm(`Remove payment plan “${plan.name}”?`)) return;
    setBusyId(plan.id);
    setActionMsg(null);
    try {
      const res = await authFetch(`/api/projects/developer/payment-plans/${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Delete failed (${res.status})`
        );
      }
      setActionMsg("Payment plan removed.");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Could not remove plan");
    } finally {
      setBusyId(null);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        Loading payment plans…
      </div>
    );
  }

  const plans = data?.plans ?? [];
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Project payment plans
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.organization.name || "Developer"} · templates customers pick when booking ·{" "}
            {data?.summary.totalPlans ?? 0} plan
            {(data?.summary.totalPlans ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/developer/installments"
            className="text-xs font-bold text-emerald-700 hover:underline px-2"
          >
            Installments queue →
          </Link>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
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
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={projects.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-2 rounded-xl"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create plan
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-xs text-amber-950">
        A <span className="font-bold">payment plan</span> is the template (booking / down payment /
        installments / possession %). When a buyer books a unit on the public scheme page and
        selects this plan, the system generates their personal installment schedule.
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

      {projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No projects yet</p>
          <p className="text-xs text-slate-500">Create a project first, then add a payment plan.</p>
          <Link
            href="/developer/projects"
            className="inline-block text-xs font-bold text-emerald-700 hover:underline"
          >
            Go to Projects →
          </Link>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">
              {editingId ? "Edit payment plan" : "Create payment plan"}
            </h4>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="p-1.5 rounded-lg hover:bg-white text-slate-500"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Project</label>
                <select
                  required
                  disabled={!!editingId}
                  value={form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                  className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 disabled:opacity-60"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Plan name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
                  placeholder="e.g. 3-Year Quarterly Plan"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Reference total price (PKR)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.totalPrice}
                  onChange={(e) => setForm((f) => ({ ...f, totalPrice: e.target.value }))}
                  className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Duration (months)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.durationMonths}
                  onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))}
                  className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Booking %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={form.bookingPercentage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, bookingPercentage: e.target.value }))
                    }
                    className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Down %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={form.downPaymentPercentage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, downPaymentPercentage: e.target.value }))
                    }
                    className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Possession %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={form.possessionPercentage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, possessionPercentage: e.target.value }))
                    }
                    className="w-full mt-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2 py-2.5"
                  />
                </div>
              </div>
            </div>

            <p
              className={`text-xs font-semibold ${
                milestoneSum > 100 ? "text-rose-700" : "text-slate-600"
              }`}
            >
              Installments share: {installmentPct.toFixed(1)}% · Milestones: {milestoneSum.toFixed(1)}
              %
            </p>

            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={previewLoading}
                onClick={() => void loadPreview()}
                className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2.5 rounded-xl disabled:opacity-50"
              >
                {previewLoading ? "Previewing…" : "Preview schedule"}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2.5 rounded-xl"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create plan"}
              </button>
            </div>
          </form>

          {preview.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-700">
                Schedule preview ({preview.length} items) — sample for reference price
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Title</th>
                      <th className="text-left px-3 py-2">Due</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.sequence} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-500">{row.sequence}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-800">{row.title}</td>
                        <td className="px-3 py-1.5 text-slate-600">{formatDate(row.dueDate)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {formatPkr(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {plans.length === 0 && projects.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No payment plans yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create a plan so buyers can choose installment terms on the public project page.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{plan.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {plan.frequency}
                    </span>
                    {plan.bookingsUsingPlan > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {plan.bookingsUsingPlan} booking
                        {plan.bookingsUsingPlan === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {plan.projectName} · {plan.durationMonths} months · Ref{" "}
                    {formatPkr(plan.totalPrice, plan.currency)}
                  </p>
                  <p className="text-xs text-slate-600">
                    Booking {plan.bookingPercentage}% · Down {plan.downPaymentPercentage}% ·
                    Installments {plan.installmentPercentage.toFixed(1)}% · Possession{" "}
                    {plan.possessionPercentage}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {plan.projectSlug && (
                    <Link
                      href={`/projects/${plan.projectSlug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl"
                    >
                      Public page
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === plan.id || plan.bookingsUsingPlan > 0}
                    title={
                      plan.bookingsUsingPlan > 0
                        ? "Linked to bookings — cannot delete"
                        : "Remove plan"
                    }
                    onClick={() => void removePlan(plan)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 disabled:opacity-40 px-3 py-2 rounded-xl"
                  >
                    {busyId === plan.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
