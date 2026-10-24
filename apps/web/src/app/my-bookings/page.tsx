"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatPkr, pick } from "@/lib/apiHelpers";

type ScheduleStatus = "Paid" | "Due" | "Overdue" | "Scheduled" | "UnderReview";

interface ScheduleItem {
  id: string;
  sequence: number;
  title: string;
  dueDate: string;
  amount: number;
  pct: number;
  status: ScheduleStatus;
  paidDate?: string;
  paidAmount?: number;
  txRef?: string;
  proofKey?: string;
}

interface BookingDetail {
  id: string;
  unitNumber: string;
  unitType: string;
  projectName: string;
  city: string;
  size: string;
  facing: string;
  totalAgreedPrice: number;
  bookedAt: string;
  schedule: ScheduleItem[];
}

interface BookingSummary {
  id: string;
  unitNumber: string;
  projectName: string;
}

function normalizeScheduleStatus(
  status: string,
  proofKey?: string | null
): ScheduleStatus {
  const s = status.toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "overdue") return "Overdue";
  if (s === "scheduled") return "Scheduled";
  if (proofKey && (s === "due" || s === "underreview")) return "UnderReview";
  if (s === "due") return "Due";
  return "Scheduled";
}

export default function MyBookingsPage() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [summaries, setSummaries] = useState<BookingSummary[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string>("");
  const [activeBooking, setActiveBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
  const [txReference, setTxReference] = useState("");
  const [depositSlipKey, setDepositSlipKey] = useState("");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const resetProofForm = () => {
    setTxReference("");
    setDepositSlipKey("");
    setReceiptPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setReceiptFileName(null);
    setPaymentNotes("");
    setProofSuccess(false);
    setProofError(null);
    setIsUploadingReceipt(false);
  };

  const loadList = useCallback(async () => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as a customer to view bookings.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/bookings");
      if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
      const rows = (await res.json()) as Record<string, unknown>[];
      const list = (Array.isArray(rows) ? rows : []).map((r) => ({
        id: String(pick(r, "id", "Id") ?? ""),
        unitNumber: String(pick(r, "unitNumber", "UnitNumber") ?? "—"),
        projectName: String(pick(r, "projectName", "ProjectName") ?? "Project"),
      }));
      setSummaries(list);
      if (list.length > 0) {
        setActiveBookingId((prev) => prev || list[0].id);
      } else {
        setActiveBooking(null);
        setActiveBookingId("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings");
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated, isHydrated]);

  const loadDetail = useCallback(
    async (bookingId: string) => {
      if (!bookingId) return;
      setDetailLoading(true);
      try {
        const res = await authFetch(`/api/bookings/${bookingId}`);
        if (!res.ok) throw new Error(`Failed to load booking (${res.status})`);
        const data = (await res.json()) as Record<string, unknown>;
        const unit = pick<Record<string, unknown> | null>(data, "unit", "Unit");
        const scheduleRaw =
          (pick<Record<string, unknown>[]>(data, "scheduleItems", "ScheduleItems") as
            | Record<string, unknown>[]
            | undefined) ?? [];
        const total = Number(pick(data, "totalAgreedPrice", "TotalAgreedPrice") ?? 0);

        const schedule: ScheduleItem[] = scheduleRaw.map((s) => {
          const amount = Number(pick(s, "amount", "Amount") ?? 0);
          const proofKey = pick<string | null>(s, "paymentProofStorageKey", "PaymentProofStorageKey");
          const status = normalizeScheduleStatus(
            String(pick(s, "status", "Status") ?? "Scheduled"),
            proofKey
          );
          const paidAt = pick<string | null>(s, "paidAtUtc", "PaidAtUtc");
          const reason = pick<string | null>(s, "adjustmentReason", "AdjustmentReason");
          const txMatch = reason?.match(/TxRef=([^.;]+)/);

          return {
            id: String(pick(s, "id", "Id") ?? ""),
            sequence: Number(pick(s, "sequenceNumber", "SequenceNumber") ?? 0),
            title: String(pick(s, "title", "Title") ?? "Installment"),
            dueDate: String(pick(s, "dueDate", "DueDate") ?? ""),
            amount,
            pct: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
            status,
            paidDate: paidAt ? formatDate(paidAt) : undefined,
            paidAmount: Number(pick(s, "paidAmount", "PaidAmount") ?? 0) || undefined,
            txRef: txMatch?.[1]?.trim(),
            proofKey: proofKey || undefined,
          };
        });

        setActiveBooking({
          id: String(pick(data, "id", "Id") ?? bookingId),
          unitNumber: unit
            ? String(pick(unit, "unitNumber", "UnitNumber") ?? "—")
            : "—",
          unitType: unit ? String(pick(unit, "unitType", "UnitType") ?? "") : "",
          projectName: unit
            ? String(pick(unit, "projectName", "ProjectName") ?? "Project")
            : "Project",
          city: unit ? String(pick(unit, "projectCity", "ProjectCity") ?? "") : "",
          size: unit
            ? `${pick(unit, "size", "Size") ?? ""} ${pick(unit, "sizeUnit", "SizeUnit") ?? ""}`.trim()
            : "",
          facing: unit ? String(pick(unit, "facing", "Facing") ?? "") : "",
          totalAgreedPrice: total,
          bookedAt: formatDate(String(pick(data, "bookedAtUtc", "BookedAtUtc") ?? "")),
          schedule,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load booking detail");
        setActiveBooking(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeBookingId) void loadDetail(activeBookingId);
  }, [activeBookingId, loadDetail]);

  const handleReceiptFileChange = async (file: File | null) => {
    if (!file || !selectedScheduleItem || !activeBooking) return;

    if (!file.type.startsWith("image/")) {
      setProofError("Please choose an image file (JPG, PNG, or WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProofError("Receipt image must be under 10 MB.");
      return;
    }

    setProofError(null);
    setIsUploadingReceipt(true);

    const localPreview = URL.createObjectURL(file);
    setReceiptPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return localPreview;
    });
    setReceiptFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch(
        `/api/bookings/${activeBooking.id}/schedule/${selectedScheduleItem.id}/proof/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Upload failed (${res.status})`
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      const url = String(pick(data, "url", "Url") ?? "");
      const storageKey = String(pick(data, "storageKey", "StorageKey") ?? "");
      // Prefer public URL so developers can open the slip; fall back to storage key
      setDepositSlipKey(url || storageKey);
      if (url) {
        setReceiptPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (e) {
      setDepositSlipKey("");
      setProofError(e instanceof Error ? e.message : "Failed to upload receipt image");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!selectedScheduleItem || !txReference || !activeBooking) return;
    if (!depositSlipKey) {
      setProofError("Upload a receipt image before submitting.");
      return;
    }

    setIsSubmittingProof(true);
    setProofError(null);

    try {
      const res = await authFetch(
        `/api/bookings/${activeBooking.id}/schedule/${selectedScheduleItem.id}/proof`,
        {
          method: "POST",
          body: JSON.stringify({
            paymentProofStorageKey: depositSlipKey,
            transactionReference: txReference,
            notes: paymentNotes,
            amountPaid: selectedScheduleItem.amount,
            paymentDate: new Date().toISOString(),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Submit failed (${res.status})`
        );
      }
      setProofSuccess(true);
      await loadDetail(activeBooking.id);
    } catch (e) {
      setProofError(e instanceof Error ? e.message : "Failed to submit proof");
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case "Paid":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid
          </span>
        );
      case "Due":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Due Now
          </span>
        );
      case "Overdue":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Overdue
          </span>
        );
      case "UnderReview":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Under Review
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            Scheduled
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        Loading bookings…
      </div>
    );
  }

  if (error && summaries.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-3">
        <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
        <h1 className="text-xl font-black text-slate-900">No bookings yet</h1>
        <p className="text-xs text-slate-500">
          Reserve a unit from a developer project to see your installment schedule here.
        </p>
      </div>
    );
  }

  const totalPaid =
    activeBooking?.schedule
      .filter((s) => s.status === "Paid")
      .reduce((sum, s) => sum + (s.paidAmount || s.amount), 0) ?? 0;
  const remainingBalance = (activeBooking?.totalAgreedPrice ?? 0) - totalPaid;
  const nextDue = activeBooking?.schedule.find(
    (s) => s.status === "Due" || s.status === "Overdue"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2 border border-emerald-200">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            <span>Customer Installment Portal</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            My Unit Bookings & Installment Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live schedule from API — upload bank transfer receipts for developer verification.
          </p>
        </div>

        {summaries.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Switch Booking:</span>
            <select
              value={activeBookingId}
              onChange={(e) => setActiveBookingId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {summaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.unitNumber} — {b.projectName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {detailLoading || !activeBooking ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          Loading schedule…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Agreed Unit Price
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {formatPkr(activeBooking.totalAgreedPrice)}
              </span>
              <span className="text-xs text-slate-500 mt-1 block">
                {activeBooking.unitNumber}
                {activeBooking.size ? ` (${activeBooking.size})` : ""}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm bg-emerald-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                Total Paid to Date
              </span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">
                {formatPkr(totalPaid)}
              </span>
              <span className="text-xs text-emerald-600 mt-1 font-semibold block">
                {activeBooking.totalAgreedPrice > 0
                  ? `${Math.round((totalPaid / activeBooking.totalAgreedPrice) * 100)}% settled`
                  : "—"}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Remaining Balance
              </span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">
                {formatPkr(remainingBalance)}
              </span>
              <span className="text-xs text-slate-500 mt-1 block">
                Across{" "}
                {activeBooking.schedule.filter((s) => s.status !== "Paid").length} remaining
                installments
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm bg-amber-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                Next Installment Due
              </span>
              <span className="text-xl font-black text-amber-900 mt-1 block">
                {nextDue ? formatPkr(nextDue.amount) : "All Clear"}
              </span>
              <span className="text-xs text-amber-700 font-medium mt-1 block">
                {nextDue ? `Due: ${formatDate(nextDue.dueDate)}` : "No outstanding dues"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-10">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-black text-slate-900">
                Installment Schedule — {activeBooking.projectName}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Booked {activeBooking.bookedAt}
                {activeBooking.city ? ` · ${activeBooking.city}` : ""}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-6">Seq #</th>
                    <th className="py-3.5 px-6">Installment Milestone</th>
                    <th className="py-3.5 px-6">Due Date</th>
                    <th className="py-3.5 px-6">Amount</th>
                    <th className="py-3.5 px-6">Share</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Receipt / Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeBooking.schedule.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-mono font-bold text-slate-400">
                        #{item.sequence}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 block">{item.title}</span>
                        {item.paidDate && (
                          <span className="text-[11px] text-emerald-700">
                            Settled on {item.paidDate}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-medium">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {formatPkr(item.amount)}
                      </td>
                      <td className="py-4 px-6 text-slate-500">{item.pct}%</td>
                      <td className="py-4 px-6">{getStatusBadge(item.status)}</td>
                      <td className="py-4 px-6 text-right">
                        {item.status === "Paid" && item.txRef && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {item.txRef}
                          </span>
                        )}
                        {item.status === "UnderReview" && (
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                            Proof Awaiting Approval
                          </span>
                        )}
                        {(item.status === "Due" || item.status === "Overdue") && (
                          <button
                            type="button"
                            onClick={() => {
                              resetProofForm();
                              setSelectedScheduleItem(item);
                            }}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Submit Receipt</span>
                          </button>
                        )}
                        {item.status === "Scheduled" && (
                          <span className="text-slate-400 text-[11px] italic">Not yet due</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedScheduleItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-0.5 rounded text-slate-700">
                  {selectedScheduleItem.title}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Submit Payment Proof</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetProofForm();
                  setSelectedScheduleItem(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!proofSuccess ? (
              <div className="mt-6 space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 block font-medium">Payable Amount</span>
                    <span className="text-lg font-black text-emerald-800">
                      {formatPkr(selectedScheduleItem.amount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block font-medium">Due Date</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(selectedScheduleItem.dueDate)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank / Raast Transaction Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HBL-FT-9923841"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Receipt image *
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 w-full min-h-[140px] px-4 py-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      disabled={isUploadingReceipt || isSubmittingProof}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        void handleReceiptFileChange(file);
                        e.target.value = "";
                      }}
                    />
                    {isUploadingReceipt ? (
                      <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading receipt…
                      </span>
                    ) : receiptPreviewUrl ? (
                      <div className="w-full space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={receiptPreviewUrl}
                          alt="Receipt preview"
                          className="max-h-40 mx-auto rounded-lg border border-slate-200 object-contain bg-white"
                        />
                        <p className="text-center text-[11px] text-emerald-700 font-semibold">
                          {receiptFileName || "Receipt uploaded"} · click to replace
                        </p>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-6 h-6 text-emerald-600" />
                        <span className="font-bold text-slate-700">
                          Click to upload deposit slip / transfer screenshot
                        </span>
                        <span className="text-[11px] text-slate-500">
                          JPG, PNG or WEBP · max 10 MB
                        </span>
                      </>
                    )}
                  </label>
                  {depositSlipKey && (
                    <p className="mt-1.5 text-[11px] text-slate-500 font-mono truncate">
                      Stored as: {depositSlipKey}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional note for developer accounts…"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {proofError && (
                  <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {proofError}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetProofForm();
                      setSelectedScheduleItem(null);
                    }}
                    className="px-4 py-2 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      !txReference ||
                      !depositSlipKey ||
                      isSubmittingProof ||
                      isUploadingReceipt
                    }
                    onClick={handleSubmitProof}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {isSubmittingProof ? "Submitting..." : "Submit Receipt Proof"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">Receipt Submitted!</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Reference <strong>{txReference}</strong> is pending developer verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetProofForm();
                    setSelectedScheduleItem(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
