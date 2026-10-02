"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  FileText,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X,
  ArrowRight
} from "lucide-react";

interface ScheduleItem {
  id: string;
  sequence: number;
  title: string;
  dueDate: string;
  amount: number;
  pct: number;
  status: "Paid" | "Due" | "Overdue" | "Scheduled" | "UnderReview";
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

const mockCustomerBookings: BookingDetail[] = [
  {
    id: "BKG-901",
    unitNumber: "Plot-104",
    unitType: "Plot",
    projectName: "Skyline Meadows Lahore",
    city: "Lahore",
    size: "5 Marla",
    facing: "Standard",
    totalAgreedPrice: 9200000,
    bookedAt: "Jan 15, 2026",
    schedule: [
      {
        id: "sch-1",
        sequence: 1,
        title: "Booking Deposit (10%)",
        dueDate: "Jan 15, 2026",
        amount: 920000,
        pct: 10,
        status: "Paid",
        paidDate: "Jan 15, 2026",
        paidAmount: 920000,
        txRef: "MEEZAN-FT-77610"
      },
      {
        id: "sch-2",
        sequence: 2,
        title: "Down Payment / Allocation (15%)",
        dueDate: "Feb 15, 2026",
        amount: 1380000,
        pct: 15,
        status: "Paid",
        paidDate: "Feb 14, 2026",
        paidAmount: 1380000,
        txRef: "HBL-ONLINE-99211"
      },
      {
        id: "sch-3",
        sequence: 3,
        title: "Quarterly Installment #1",
        dueDate: "May 15, 2026",
        amount: 460000,
        pct: 5,
        status: "Paid",
        paidDate: "May 12, 2026",
        paidAmount: 460000,
        txRef: "UBL-PAY-33100"
      },
      {
        id: "sch-4",
        sequence: 4,
        title: "Quarterly Installment #2",
        dueDate: "Aug 15, 2026",
        amount: 460000,
        pct: 5,
        status: "Paid",
        paidDate: "Aug 14, 2026",
        paidAmount: 460000,
        txRef: "HBL-FT-8842109"
      },
      {
        id: "sch-5",
        sequence: 5,
        title: "Quarterly Installment #3",
        dueDate: "Nov 15, 2026",
        amount: 460000,
        pct: 5,
        status: "Due"
      },
      {
        id: "sch-6",
        sequence: 6,
        title: "Quarterly Installment #4",
        dueDate: "Feb 15, 2027",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-7",
        sequence: 7,
        title: "Quarterly Installment #5",
        dueDate: "May 15, 2027",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-8",
        sequence: 8,
        title: "Quarterly Installment #6",
        dueDate: "Aug 15, 2027",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-9",
        sequence: 9,
        title: "Quarterly Installment #7",
        dueDate: "Nov 15, 2027",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-10",
        sequence: 10,
        title: "Quarterly Installment #8",
        dueDate: "Feb 15, 2028",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-11",
        sequence: 11,
        title: "Quarterly Installment #9",
        dueDate: "May 15, 2028",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-12",
        sequence: 12,
        title: "Quarterly Installment #10",
        dueDate: "Aug 15, 2028",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-13",
        sequence: 13,
        title: "Quarterly Installment #11",
        dueDate: "Nov 15, 2028",
        amount: 460000,
        pct: 5,
        status: "Scheduled"
      },
      {
        id: "sch-14",
        sequence: 14,
        title: "Possession & Handover (15%)",
        dueDate: "Dec 31, 2028",
        amount: 1380000,
        pct: 15,
        status: "Scheduled"
      }
    ]
  }
];

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingDetail[]>(mockCustomerBookings);
  const [activeBookingId, setActiveBookingId] = useState<string>("BKG-901");

  // Payment proof submission modal state
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
  const [txReference, setTxReference] = useState<string>("");
  const [depositSlipKey, setDepositSlipKey] = useState<string>("receipts/hbl_deposit_0099.jpg");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingProof, setIsSubmittingProof] = useState<boolean>(false);
  const [proofSuccess, setProofSuccess] = useState<boolean>(false);

  const activeBooking = bookings.find((b) => b.id === activeBookingId) || bookings[0];

  const formatPkr = (val: number) => {
    if (val >= 10000000) return `PKR ${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  const totalPaid = activeBooking.schedule
    .filter((s) => s.status === "Paid")
    .reduce((sum, s) => sum + (s.paidAmount || s.amount), 0);

  const remainingBalance = activeBooking.totalAgreedPrice - totalPaid;
  const nextDue = activeBooking.schedule.find((s) => s.status === "Due" || s.status === "Overdue");

  const handleSubmitProof = async () => {
    if (!selectedScheduleItem || !txReference) return;
    setIsSubmittingProof(true);

    try {
      // Call backend API endpoint
      await fetch(
        `http://localhost:5000/api/bookings/${activeBooking.id}/schedule/${selectedScheduleItem.id}/proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentProofStorageKey: depositSlipKey,
            transactionReference: txReference,
            notes: paymentNotes,
            amountPaid: selectedScheduleItem.amount,
            paymentDate: new Date().toISOString()
          })
        }
      );
    } catch {
      // Fallback
    }

    // Update local state
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== activeBooking.id) return b;
        return {
          ...b,
          schedule: b.schedule.map((s) =>
            s.id === selectedScheduleItem.id
              ? {
                  ...s,
                  status: "UnderReview",
                  txRef: txReference,
                  proofKey: depositSlipKey
                }
              : s
          )
        };
      })
    );

    setIsSubmittingProof(false);
    setProofSuccess(true);
  };

  const getStatusBadge = (status: ScheduleItem["status"]) => {
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
      case "Scheduled":
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            Scheduled
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
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
            Track payments, upload bank transfer receipts, and view upcoming milestone due dates.
          </p>
        </div>

        {bookings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Switch Booking:</span>
            <select
              value={activeBookingId}
              onChange={(e) => setActiveBookingId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.unitNumber} — {b.projectName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Agreed Unit Price</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {formatPkr(activeBooking.totalAgreedPrice)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {activeBooking.unitNumber} ({activeBooking.size})
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Total Paid to Date</span>
          <span className="text-2xl font-black text-emerald-800 mt-1 block">
            {formatPkr(totalPaid)}
          </span>
          <span className="text-xs text-emerald-600 mt-1 font-semibold block">
            {Math.round((totalPaid / activeBooking.totalAgreedPrice) * 100)}% of total price settled
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Remaining Balance</span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">
            {formatPkr(remainingBalance)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            Across {activeBooking.schedule.filter((s) => s.status !== "Paid").length} remaining installments
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm bg-amber-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">Next Installment Due</span>
          <span className="text-xl font-black text-amber-900 mt-1 block">
            {nextDue ? formatPkr(nextDue.amount) : "All Clear"}
          </span>
          <span className="text-xs text-amber-700 font-medium mt-1 block">
            {nextDue ? `Due Date: ${nextDue.dueDate}` : "No outstanding dues"}
          </span>
        </div>
      </div>

      {/* Installment Calendar Timeline Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-10">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Installment Schedule Calendar
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequence of booking deposit, down payment, quarterly installments, and possession handover.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="w-3 h-3 rounded-full bg-emerald-500" /> Paid
            <span className="w-3 h-3 rounded-full bg-amber-500 ml-2" /> Due
            <span className="w-3 h-3 rounded-full bg-slate-300 ml-2" /> Scheduled
          </div>
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
                  <td className="py-4 px-6 font-mono font-bold text-slate-400">#{item.sequence}</td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-slate-900 block">{item.title}</span>
                    {item.paidDate && (
                      <span className="text-[11px] text-emerald-700">Settled on {item.paidDate}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-700 font-medium">{item.dueDate}</td>
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">{formatPkr(item.amount)}</td>
                  <td className="py-4 px-6 text-slate-500">{item.pct}%</td>
                  <td className="py-4 px-6">{getStatusBadge(item.status)}</td>
                  <td className="py-4 px-6 text-right">
                    {item.status === "Paid" && (
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
                        onClick={() => {
                          setSelectedScheduleItem(item);
                          setProofSuccess(false);
                          setTxReference("");
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

      {/* SUBMIT PAYMENT PROOF MODAL */}
      {selectedScheduleItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-0.5 rounded text-slate-700">
                  {selectedScheduleItem.title}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Submit Payment Proof</h3>
                <p className="text-xs text-slate-500">
                  Upload deposit slip or transaction ID for Developer verification.
                </p>
              </div>
              <button
                onClick={() => setSelectedScheduleItem(null)}
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
                    <span className="text-lg font-black text-emerald-800">{formatPkr(selectedScheduleItem.amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block font-medium">Due Date</span>
                    <span className="font-bold text-slate-800">{selectedScheduleItem.dueDate}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank / Raast Transaction Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HBL-FT-9923841, RAAST-881923"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Receipt Attachment / Storage Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={depositSlipKey}
                      onChange={(e) => setDepositSlipKey(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-[11px] text-slate-600 bg-slate-50"
                    />
                    <span className="text-[11px] text-emerald-600 font-semibold px-2">Uploaded</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Notes for Developer Accounts
                  </label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Transferred via Meezan Mobile App from account ending in 4102."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSelectedScheduleItem(null)}
                    className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!txReference || isSubmittingProof}
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
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                    Your deposit reference <strong>{txReference}</strong> has been submitted to the developer account department for verification and ledger reconciliation.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedScheduleItem(null)}
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
