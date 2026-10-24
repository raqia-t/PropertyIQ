"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatDateTime, formatPkr, pick } from "@/lib/apiHelpers";

interface InquiryRow {
  id: string;
  title: string;
  message: string;
  status: string;
  agentNotes: string | null;
  createdAtUtc: string;
  propertyId: string | null;
}

interface BookingRow {
  id: string;
  projectName: string;
  unitNumber: string;
  totalAgreedPrice: number;
  totalPaid: number;
  status: string;
  nextPaymentDue: {
    title: string;
    dueDate: string;
    amount: number;
    status: string;
  } | null;
}

interface CaseRow {
  id: string;
  targetName: string;
  status: string;
  specialistName: string;
  createdAtUtc: string;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("closed") || s.includes("spam")) return "bg-slate-100 text-slate-700";
  if (s.includes("viewing") || s.includes("qualified") || s.includes("completed"))
    return "bg-emerald-100 text-emerald-800";
  if (s.includes("contacted")) return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

export default function CustomerActivityPage() {
  const { user, isHydrated, isAuthenticated, authFetch } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in to view your activity.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [inqRes, bookRes, caseRes] = await Promise.all([
          authFetch("/api/inquiries/my"),
          authFetch("/api/bookings"),
          authFetch("/api/verification/cases"),
        ]);

        if (cancelled) return;

        if (inqRes.ok) {
          const rows = (await inqRes.json()) as Record<string, unknown>[];
          setInquiries(
            (Array.isArray(rows) ? rows : []).map((r) => ({
              id: String(pick(r, "id", "Id") ?? ""),
              title: String(
                pick(r, "propertyTitle", "PropertyTitle") ||
                  pick(r, "projectName", "ProjectName") ||
                  "Inquiry"
              ),
              message: String(pick(r, "message", "Message") ?? ""),
              status: String(pick(r, "status", "Status") ?? "New"),
              agentNotes: pick<string | null>(r, "agentNotes", "AgentNotes") ?? null,
              createdAtUtc: String(pick(r, "createdAtUtc", "CreatedAtUtc") ?? ""),
              propertyId: pick<string | null>(r, "propertyId", "PropertyId")
                ? String(pick(r, "propertyId", "PropertyId"))
                : null,
            }))
          );
        }

        if (bookRes.ok) {
          const rows = (await bookRes.json()) as Record<string, unknown>[];
          setBookings(
            (Array.isArray(rows) ? rows : []).map((r) => {
              const next = pick<Record<string, unknown> | null>(
                r,
                "nextPaymentDue",
                "NextPaymentDue"
              );
              return {
                id: String(pick(r, "id", "Id") ?? ""),
                projectName: String(pick(r, "projectName", "ProjectName") ?? "Project"),
                unitNumber: String(pick(r, "unitNumber", "UnitNumber") ?? "—"),
                totalAgreedPrice: Number(pick(r, "totalAgreedPrice", "TotalAgreedPrice") ?? 0),
                totalPaid: Number(pick(r, "totalPaid", "TotalPaid") ?? 0),
                status: String(pick(r, "status", "Status") ?? ""),
                nextPaymentDue: next
                  ? {
                      title: String(pick(next, "title", "Title") ?? "Payment"),
                      dueDate: String(pick(next, "dueDate", "DueDate") ?? ""),
                      amount: Number(pick(next, "amount", "Amount") ?? 0),
                      status: String(pick(next, "status", "Status") ?? ""),
                    }
                  : null,
              };
            })
          );
        }

        if (caseRes.ok) {
          const rows = (await caseRes.json()) as Record<string, unknown>[];
          setCases(
            (Array.isArray(rows) ? rows : []).map((r) => ({
              id: String(pick(r, "id", "Id") ?? ""),
              targetName: String(pick(r, "targetName", "TargetName") ?? "Property"),
              status: String(pick(r, "status", "Status") ?? ""),
              specialistName: String(
                pick(r, "specialistName", "SpecialistName") ?? "Unassigned"
              ),
              createdAtUtc: String(pick(r, "createdAtUtc", "CreatedAtUtc") ?? ""),
            }))
          );
        }

        if (!inqRes.ok && !bookRes.ok && !caseRes.ok) {
          throw new Error("Could not load activity data from API");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, isHydrated]);

  const viewingScheduled = inquiries.filter((i) =>
    i.status.toLowerCase().includes("viewing")
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Customer Hub
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {user?.fullName || "Buyer"} · Live activity
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Real Estate Activity
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inquiries, bookings, and verification cases from your account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/my-bookings"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <CreditCard className="w-4 h-4" />
            <span>Installment Portal</span>
          </Link>
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verification Orders</span>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          Loading live activity…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Kpi
              label="Active Inquiries"
              value={inquiries.length}
              hint={
                inquiries[0]
                  ? `Latest: ${inquiries[0].status}`
                  : "None yet"
              }
              icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
            />
            <Kpi
              label="Viewings Scheduled"
              value={viewingScheduled.length}
              hint={
                viewingScheduled[0]
                  ? viewingScheduled[0].title
                  : "From inquiry status"
              }
              icon={<Calendar className="w-4 h-4 text-emerald-600" />}
            />
            <Kpi
              label="Active Bookings"
              value={bookings.length}
              hint={
                bookings[0]
                  ? `${bookings[0].projectName} · ${bookings[0].unitNumber}`
                  : "None yet"
              }
              icon={<Building2 className="w-4 h-4 text-purple-600" />}
            />
            <Kpi
              label="Verification Audits"
              value={cases.length}
              hint={cases[0] ? cases[0].status : "None yet"}
              icon={<ShieldCheck className="w-4 h-4 text-teal-600" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900">
                  Agent & Developer Inquiries
                </h3>
                <p className="text-xs text-slate-500">Live from GET /api/inquiries/my</p>
              </div>

              {inquiries.length === 0 ? (
                <Empty text="No inquiries yet. Send one from a property detail page." />
              ) : (
                <div className="space-y-4">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{inq.title}</h4>
                          <p className="text-[11px] text-slate-500">
                            {formatDateTime(inq.createdAtUtc)}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor(inq.status)}`}
                        >
                          {inq.status}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700">
                        <p className="font-medium text-slate-800">You: &quot;{inq.message}&quot;</p>
                        {inq.agentNotes && (
                          <p className="mt-1 text-emerald-800 font-semibold bg-emerald-50/60 p-2 rounded-lg">
                            Agent: {inq.agentNotes}
                          </p>
                        )}
                      </div>
                      {inq.propertyId && (
                        <Link
                          href={`/properties/${inq.propertyId}`}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          Open listing →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900">
                  Viewings & Verification
                </h3>
                <p className="text-xs text-slate-500">
                  Viewings from inquiry status · cases from verification API
                </p>
              </div>

              {viewingScheduled.length === 0 && cases.length === 0 ? (
                <Empty text="No scheduled viewings or verification cases yet." />
              ) : (
                <div className="space-y-4">
                  {viewingScheduled.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{v.title}</h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {v.status}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Updated {formatDateTime(v.createdAtUtc)}
                      </p>
                      {v.agentNotes && (
                        <p className="text-[11px] text-slate-500">{v.agentNotes}</p>
                      )}
                    </div>
                  ))}

                  {cases.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-teal-100 bg-teal-50/40 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{c.targetName}</h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Specialist: {c.specialistName} · {formatDate(c.createdAtUtc)}
                      </p>
                      <Link
                        href="/verification"
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-800"
                      >
                        Open verification →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">
                  Active Installment Bookings
                </h3>
                <p className="text-xs text-slate-500">Live from GET /api/bookings</p>
              </div>
              <Link
                href="/my-bookings"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <span>View Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {bookings.length === 0 ? (
              <Empty text="No developer bookings yet. Reserve a unit from a project inventory page." />
            ) : (
              <div className="space-y-4">
                {bookings.map((bkg) => (
                  <div
                    key={bkg.id}
                    className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">
                          {bkg.id.slice(0, 8)}…
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">{bkg.projectName}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                          {bkg.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Unit: <strong>{bkg.unitNumber}</strong>
                      </p>
                      {bkg.nextPaymentDue && (
                        <p className="text-xs text-emerald-700 font-semibold mt-1">
                          Next: {formatPkr(bkg.nextPaymentDue.amount)} ·{" "}
                          {formatDate(bkg.nextPaymentDue.dueDate)} ({bkg.nextPaymentDue.status})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <span className="text-[11px] text-slate-500 block">Paid / Total</span>
                        <span className="text-sm font-black text-slate-900">
                          {formatPkr(bkg.totalPaid)} / {formatPkr(bkg.totalAgreedPrice)}
                        </span>
                      </div>
                      <Link
                        href="/my-bookings"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
                      >
                        Manage Installments
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
      <p className="text-[11px] text-slate-500 font-medium truncate">{hint}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-4">
      {text}
    </p>
  );
}
