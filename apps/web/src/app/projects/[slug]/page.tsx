"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ArrowRight,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatPkr, pick } from "@/lib/apiHelpers";

type UnitStatus = "Available" | "Reserved" | "Booked" | "Sold" | "Blocked" | string;

interface Unit {
  id: string;
  unitNumber: string;
  unitType: string;
  size: number;
  sizeUnit: string;
  facing: string;
  basePrice: number;
  status: UnitStatus;
  block: string;
}

interface PaymentPlan {
  id: string;
  name: string;
  durationMonths: number;
  frequency: string;
  bookingPercentage: number;
  downPaymentPercentage: number;
  possessionPercentage: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  area: string;
  address: string;
  regulatoryAuthority: string;
  approvalReference: string;
  approvalStatus: string;
  launchDate: string;
  expectedCompletionDate: string;
  developerName: string;
  licenseNumber: string;
  developerVerified: boolean;
  inventorySummary: {
    total: number;
    available: number;
    reserved: number;
    booked: number;
    sold: number;
  };
  blockNames: string[];
  paymentPlans: PaymentPlan[];
}

interface BookingConfirmed {
  id: string;
  unitNumber: string;
  projectName: string;
  totalAgreedPrice: number;
  bookingAmountDue: number;
  status: string;
}

function getStatusBadge(status: UnitStatus) {
  switch (status) {
    case "Available":
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          Available
        </span>
      );
    case "Reserved":
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
          Reserved
        </span>
      );
    case "Booked":
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
          Booked
        </span>
      );
    case "Sold":
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
          Sold
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
          {status}
        </span>
      );
  }
}

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const router = useRouter();
  const { isAuthenticated, authFetch } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBlock, setSelectedBlock] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);

  const [planDuration, setPlanDuration] = useState(36);
  const [planFrequency, setPlanFrequency] = useState<"Quarterly" | "Monthly">("Quarterly");
  const [bookingPct, setBookingPct] = useState(10);
  const [downPaymentPct, setDownPaymentPct] = useState(15);
  const [possessionPct, setPossessionPct] = useState(15);
  const [paymentPlanId, setPaymentPlanId] = useState<string | null>(null);

  const [scheduleItems, setScheduleItems] = useState<
    Array<{ sequence: number; title: string; due: string; amount: number; pct: number }>
  >([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<BookingConfirmed | null>(null);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/by-slug/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        setError(`Project “${slug}” was not found in the API.`);
        setProject(null);
        setUnits([]);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
      const data = (await res.json()) as Record<string, unknown>;
      const developer = pick<Record<string, unknown> | null>(data, "developer", "Developer");
      const summary = pick<Record<string, unknown> | null>(
        data,
        "inventorySummary",
        "InventorySummary"
      );
      const phases =
        (pick<Record<string, unknown>[]>(data, "phases", "Phases") as
          | Record<string, unknown>[]
          | undefined) ?? [];
      const plans =
        (pick<Record<string, unknown>[]>(data, "paymentPlans", "PaymentPlans") as
          | Record<string, unknown>[]
          | undefined) ?? [];

      const blockNames = Array.from(
        new Set(
          phases.flatMap((ph) => {
            const blocks =
              (pick<Record<string, unknown>[]>(ph, "blocks", "Blocks") as
                | Record<string, unknown>[]
                | undefined) ?? [];
            return blocks.map((b) => String(pick(b, "name", "Name") ?? "")).filter(Boolean);
          })
        )
      );

      const mappedPlans: PaymentPlan[] = plans.map((pl) => ({
        id: String(pick(pl, "id", "Id") ?? ""),
        name: String(pick(pl, "name", "Name") ?? "Plan"),
        durationMonths: Number(pick(pl, "durationMonths", "DurationMonths") ?? 36),
        frequency: String(pick(pl, "frequency", "Frequency") ?? "Quarterly"),
        bookingPercentage: Number(pick(pl, "bookingPercentage", "BookingPercentage") ?? 10),
        downPaymentPercentage: Number(
          pick(pl, "downPaymentPercentage", "DownPaymentPercentage") ?? 15
        ),
        possessionPercentage: Number(
          pick(pl, "possessionPercentage", "PossessionPercentage") ?? 15
        ),
      }));

      const detail: ProjectDetail = {
        id: String(pick(data, "id", "Id") ?? ""),
        name: String(pick(data, "name", "Name") ?? "Project"),
        slug: String(pick(data, "slug", "Slug") ?? slug),
        description: String(pick(data, "description", "Description") ?? ""),
        city: String(pick(data, "city", "City") ?? ""),
        area: String(pick(data, "area", "Area") ?? ""),
        address: String(pick(data, "address", "Address") ?? ""),
        regulatoryAuthority: String(
          pick(data, "regulatoryAuthority", "RegulatoryAuthority") ?? ""
        ),
        approvalReference: String(
          pick(data, "approvalReferenceNumber", "ApprovalReferenceNumber") ?? ""
        ),
        approvalStatus: String(pick(data, "approvalStatus", "ApprovalStatus") ?? ""),
        launchDate: formatDate(String(pick(data, "launchDate", "LaunchDate") ?? "")),
        expectedCompletionDate: formatDate(
          String(pick(data, "expectedCompletionDate", "ExpectedCompletionDate") ?? "")
        ),
        developerName: developer
          ? String(pick(developer, "name", "Name") ?? "Developer")
          : "Developer",
        licenseNumber: developer
          ? String(pick(developer, "licenseNumber", "LicenseNumber") ?? "—")
          : "—",
        developerVerified: developer
          ? Boolean(pick(developer, "isVerified", "IsVerified"))
          : false,
        inventorySummary: {
          total: Number(pick(summary ?? {}, "total", "Total") ?? 0),
          available: Number(pick(summary ?? {}, "available", "Available") ?? 0),
          reserved: Number(pick(summary ?? {}, "reserved", "Reserved") ?? 0),
          booked: Number(pick(summary ?? {}, "booked", "Booked") ?? 0),
          sold: Number(pick(summary ?? {}, "sold", "Sold") ?? 0),
        },
        blockNames,
        paymentPlans: mappedPlans,
      };

      setProject(detail);

      if (mappedPlans[0]) {
        const p0 = mappedPlans[0];
        setPaymentPlanId(p0.id);
        setPlanDuration(p0.durationMonths);
        setPlanFrequency(p0.frequency === "Monthly" ? "Monthly" : "Quarterly");
        setBookingPct(p0.bookingPercentage);
        setDownPaymentPct(p0.downPaymentPercentage);
        setPossessionPct(p0.possessionPercentage);
      }

      const invRes = await fetch(`/api/projects/${detail.id}/inventory`);
      if (invRes.ok) {
        const invRows = (await invRes.json()) as Record<string, unknown>[];
        setUnits(
          (Array.isArray(invRows) ? invRows : []).map((u) => ({
            id: String(pick(u, "id", "Id") ?? ""),
            unitNumber: String(pick(u, "unitNumber", "UnitNumber") ?? "—"),
            unitType: String(pick(u, "unitType", "UnitType") ?? "Unit"),
            size: Number(pick(u, "size", "Size") ?? 0),
            sizeUnit: String(pick(u, "sizeUnit", "SizeUnit") ?? ""),
            facing: String(pick(u, "facing", "Facing") ?? "—"),
            basePrice: Number(pick(u, "basePrice", "BasePrice") ?? 0),
            status: String(pick(u, "status", "Status") ?? "Available"),
            block: String(pick(u, "blockName", "BlockName") ?? "—"),
          }))
        );
      } else {
        setUnits([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load project");
      setProject(null);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const blockOptions = useMemo(() => {
    const fromUnits = Array.from(new Set(units.map((u) => u.block).filter(Boolean)));
    const merged = Array.from(new Set([...(project?.blockNames ?? []), ...fromUnits]));
    return ["All", ...merged];
  }, [project?.blockNames, units]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (selectedBlock !== "All" && u.block !== selectedBlock) return false;
      if (selectedStatus !== "All" && u.status !== selectedStatus) return false;
      return true;
    });
  }, [selectedBlock, selectedStatus, units]);

  const loadSchedule = useCallback(
    async (price: number) => {
      setScheduleLoading(true);
      try {
        const res = await fetch("/api/bookings/calculate-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalPrice: price,
            durationMonths: planDuration,
            frequency: planFrequency,
            bookingPercentage: bookingPct,
            downPaymentPercentage: downPaymentPct,
            possessionPercentage: possessionPct,
            startDate: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error("schedule failed");
        const data = await res.json();
        const schedule =
          (pick<Record<string, unknown>[]>(data, "schedule", "Schedule") as
            | Record<string, unknown>[]
            | undefined) ?? [];
        setScheduleItems(
          schedule.map((s) => {
            const amount = Number(pick(s, "amount", "Amount") ?? 0);
            return {
              sequence: Number(pick(s, "sequenceNumber", "SequenceNumber") ?? 0),
              title: String(pick(s, "title", "Title") ?? "Installment"),
              due: formatDate(String(pick(s, "dueDate", "DueDate") ?? "")),
              amount,
              pct: price > 0 ? Math.round((amount / price) * 1000) / 10 : 0,
            };
          })
        );
      } catch {
        // Local fallback math if calculator endpoint fails
        const bookingAmount = (price * bookingPct) / 100;
        const downPaymentAmount = (price * downPaymentPct) / 100;
        const possessionAmount = (price * possessionPct) / 100;
        const remaining = price - bookingAmount - downPaymentAmount - possessionAmount;
        const interval = planFrequency === "Monthly" ? 1 : 3;
        const count = Math.max(1, Math.floor(planDuration / interval));
        const per = remaining / count;
        const items = [
          {
            sequence: 1,
            title: "Booking Deposit",
            due: "Due now",
            amount: bookingAmount,
            pct: bookingPct,
          },
          {
            sequence: 2,
            title: "Down Payment",
            due: "In 30 days",
            amount: downPaymentAmount,
            pct: downPaymentPct,
          },
        ];
        for (let i = 0; i < count; i++) {
          items.push({
            sequence: items.length + 1,
            title: `${planFrequency} Installment #${i + 1}`,
            due: `Month ${(i + 1) * interval}`,
            amount: per,
            pct: price > 0 ? Math.round((per / price) * 1000) / 10 : 0,
          });
        }
        items.push({
          sequence: items.length + 1,
          title: "Possession & Title Handover",
          due: "On completion",
          amount: possessionAmount,
          pct: possessionPct,
        });
        setScheduleItems(items);
      } finally {
        setScheduleLoading(false);
      }
    },
    [bookingPct, downPaymentPct, planDuration, planFrequency, possessionPct]
  );

  useEffect(() => {
    if (activeUnit) void loadSchedule(activeUnit.basePrice);
  }, [activeUnit, loadSchedule]);

  const bookingAmount =
    activeUnit && scheduleItems[0] ? scheduleItems[0].amount : 0;

  const handleConfirmReservation = async () => {
    if (!activeUnit || !project) return;

    if (!isAuthenticated) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/projects/${project.slug}`)}`
      );
      return;
    }

    setIsBookingSubmitting(true);
    setConcurrencyError(null);

    try {
      const res = await authFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          unitId: activeUnit.id,
          paymentPlanId: paymentPlanId || null,
          totalAgreedPrice: activeUnit.basePrice,
          durationMonths: planDuration,
          frequency: planFrequency,
          bookingPercentage: bookingPct,
          downPaymentPercentage: downPaymentPct,
          possessionPercentage: possessionPct,
        }),
      });

      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        setConcurrencyError(
          (errorData as { message?: string }).message ||
            "This unit was just reserved or booked by another buyer."
        );
        await loadProject();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message || `Booking failed (${res.status})`
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      setBookingConfirmed({
        id: String(pick(data, "id", "Id") ?? ""),
        unitNumber: String(
          pick(data, "unitNumber", "UnitNumber") ?? activeUnit.unitNumber
        ),
        projectName: String(
          pick(data, "projectName", "ProjectName") ?? project.name
        ),
        totalAgreedPrice: Number(
          pick(data, "totalAgreedPrice", "TotalAgreedPrice") ?? activeUnit.basePrice
        ),
        bookingAmountDue: Number(
          pick(data, "bookingAmountDue", "BookingAmountDue") ?? bookingAmount
        ),
        status: String(pick(data, "status", "Status") ?? "Confirmed"),
      });
      await loadProject();
    } catch (e) {
      setConcurrencyError(
        e instanceof Error ? e.message : "Could not create booking. Try again."
      );
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        Loading project from API…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 space-y-4 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 flex items-start gap-3 text-left">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error || "Project not found."}</p>
        </div>
        <Link href="/projects" className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/" className="hover:text-emerald-600">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/projects" className="hover:text-emerald-600">
          Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-medium">{project.name}</span>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {[project.regulatoryAuthority, project.approvalStatus, project.approvalReference]
                  .filter(Boolean)
                  .join(" · ") || "Listed project"}
              </span>
              {project.developerVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Developer
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {project.name}
            </h1>
            <p className="flex items-center gap-2 text-sm text-slate-500 mt-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              {project.address ||
                [project.area, project.city].filter(Boolean).join(", ") ||
                "Pakistan"}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Units
              </span>
              <span className="text-xl font-black text-slate-900">
                {project.inventorySummary.total || units.length}
              </span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 block">
                Available
              </span>
              <span className="text-xl font-black text-emerald-800">
                {project.inventorySummary.available ||
                  units.filter((u) => u.status === "Available").length}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Handover
              </span>
              <span className="text-base font-bold text-slate-900">
                {project.expectedCompletionDate}
              </span>
            </div>
          </div>
        </div>

        {project.description && (
          <p className="mt-6 text-sm text-slate-600 leading-relaxed max-w-4xl border-t border-slate-100 pt-5">
            {project.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-slate-500 pt-2">
          <span>
            Developer: <strong className="text-slate-800">{project.developerName}</strong> (
            {project.licenseNumber})
          </span>
          <span>
            Launch: <strong className="text-slate-800">{project.launchDate}</strong>
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
              Block:
            </span>
            {blockOptions.map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => setSelectedBlock(block)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                  selectedBlock === block
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {block}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Status:
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available Only</option>
              <option value="Reserved">Reserved</option>
              <option value="Booked">Booked</option>
              <option value="Sold">Sold</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
            No inventory units from the API for this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredUnits.map((unit) => {
              const isAvailable = unit.status === "Available";
              return (
                <div
                  key={unit.id}
                  onClick={() => {
                    if (!isAvailable) return;
                    setActiveUnit(unit);
                    setBookingConfirmed(null);
                    setConcurrencyError(null);
                  }}
                  className={`rounded-2xl border p-5 transition text-left flex flex-col justify-between ${
                    isAvailable
                      ? "bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-lg cursor-pointer"
                      : "bg-slate-50 border-slate-200 opacity-75"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {unit.unitNumber}
                      </span>
                      {getStatusBadge(unit.status)}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      {unit.size} {unit.sizeUnit} {unit.unitType}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{unit.block}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                        Facing: {unit.facing}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Base Price
                      </span>
                      <span className="text-sm font-black text-emerald-700">
                        {formatPkr(unit.basePrice)}
                      </span>
                    </div>
                    {isAvailable ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        Calculate & Book
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic font-medium">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                    {activeUnit.unitNumber}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    · {activeUnit.block}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  {activeUnit.size} {activeUnit.sizeUnit} — Installment Calculator & Booking
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveUnit(null);
                  setBookingConfirmed(null);
                  setConcurrencyError(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {concurrencyError && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Booking error</strong>
                  <p>{concurrencyError}</p>
                </div>
              </div>
            )}

            {!bookingConfirmed ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Total Price</span>
                    <span className="text-base font-black text-emerald-700">
                      {formatPkr(activeUnit.basePrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Facing</span>
                    <span className="text-slate-800 font-bold">{activeUnit.facing}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Authority</span>
                    <span className="text-emerald-700 font-bold">
                      {project.regulatoryAuthority || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Unit ID</span>
                    <span className="text-slate-800 font-mono text-[10px] font-bold truncate block">
                      {activeUnit.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                {project.paymentPlans.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Developer payment plan
                    </label>
                    <select
                      value={paymentPlanId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        setPaymentPlanId(id);
                        const plan = project.paymentPlans.find((p) => p.id === id);
                        if (!plan) return;
                        setPlanDuration(plan.durationMonths);
                        setPlanFrequency(
                          plan.frequency === "Monthly" ? "Monthly" : "Quarterly"
                        );
                        setBookingPct(plan.bookingPercentage);
                        setDownPaymentPct(plan.downPaymentPercentage);
                        setPossessionPct(plan.possessionPercentage);
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      {project.paymentPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.durationMonths} mo · {p.frequency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Configure Payment Schedule
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Plan Duration
                      </label>
                      <select
                        value={planDuration}
                        onChange={(e) => setPlanDuration(Number(e.target.value))}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value={12}>1 Year (12 Months)</option>
                        <option value={24}>2 Years (24 Months)</option>
                        <option value={36}>3 Years (36 Months)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Frequency
                      </label>
                      <select
                        value={planFrequency}
                        onChange={(e) =>
                          setPlanFrequency(e.target.value as "Quarterly" | "Monthly")
                        }
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value="Quarterly">Quarterly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Booking %
                      </label>
                      <select
                        value={bookingPct}
                        onChange={(e) => setBookingPct(Number(e.target.value))}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value={10}>10%</option>
                        <option value={15}>15%</option>
                        <option value={20}>20%</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      Payment schedule
                      {scheduleLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      )}
                    </span>
                    <span>Total: {formatPkr(activeUnit.basePrice)}</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {scheduleItems.map((item) => (
                      <div
                        key={item.sequence}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-slate-400 font-mono text-[11px]">
                            #{item.sequence}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-slate-400">{item.due}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 block">
                            {formatPkr(item.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.pct}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-slate-500">
                    {isAuthenticated
                      ? "Creates a live booking via POST /api/bookings"
                      : "Sign in as customer to confirm booking"}
                  </p>
                  <button
                    type="button"
                    disabled={isBookingSubmitting}
                    onClick={handleConfirmReservation}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition disabled:opacity-50"
                  >
                    {isBookingSubmitting
                      ? "Creating booking…"
                      : `Confirm Booking (${formatPkr(bookingAmount)} due)`}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Booking Confirmed</h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                    <strong>{bookingConfirmed.unitNumber}</strong> at {project.name} is booked
                    in the live ledger.
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-md mx-auto text-left text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking ID</span>
                    <span className="font-mono font-bold text-slate-800">
                      {bookingConfirmed.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agreed price</span>
                    <span className="font-bold text-slate-900">
                      {formatPkr(bookingConfirmed.totalAgreedPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-emerald-800">
                    <span>Booking deposit due</span>
                    <span>{formatPkr(bookingConfirmed.bookingAmountDue)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-3">
                  <Link
                    href="/my-bookings"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow transition"
                  >
                    <CreditCard className="w-4 h-4" />
                    View My Installment Calendar
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveUnit(null);
                      setBookingConfirmed(null);
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-3"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
