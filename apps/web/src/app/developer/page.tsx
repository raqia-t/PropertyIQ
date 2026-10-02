"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  Layers,
  CreditCard,
  DollarSign,
  Users,
  Search,
  Filter,
  Check,
  X,
  FileText,
  ExternalLink,
  RefreshCw,
  Eye
} from "lucide-react";

interface UnitRow {
  id: string;
  unitNumber: string;
  project: string;
  block: string;
  size: string;
  facing: string;
  price: number;
  status: "Available" | "Reserved" | "Booked" | "Sold" | "Blocked";
}

interface BookingRow {
  id: string;
  unitNumber: string;
  project: string;
  customerName: string;
  customerPhone: string;
  agreedPrice: number;
  paidAmount: number;
  nextDueDate: string;
  status: "Pending" | "Confirmed" | "Completed";
}

interface PaymentProofItem {
  id: string;
  bookingId: string;
  unitNumber: string;
  customerName: string;
  installmentTitle: string;
  amount: number;
  txRef: string;
  paymentDate: string;
  proofUrl: string;
  status: "PendingVerification" | "Approved" | "Rejected";
}

const mockUnits: UnitRow[] = [
  { id: "u-101", unitNumber: "Plot-101", project: "Skyline Meadows", block: "Block A", size: "5 Marla", facing: "Corner", price: 9500000, status: "Available" },
  { id: "u-102", unitNumber: "Plot-102", project: "Skyline Meadows", block: "Block A", size: "5 Marla", facing: "Park Facing", price: 9800000, status: "Available" },
  { id: "u-103", unitNumber: "Plot-103", project: "Skyline Meadows", block: "Block A", size: "10 Marla", facing: "Main Boulevard", price: 18500000, status: "Reserved" },
  { id: "u-104", unitNumber: "Plot-104", project: "Skyline Meadows", block: "Block A", size: "5 Marla", facing: "Standard", price: 9200000, status: "Booked" },
  { id: "u-105", unitNumber: "Plot-105", project: "Skyline Meadows", block: "Block A", size: "10 Marla", facing: "Park Facing", price: 18800000, status: "Available" },
  { id: "u-106", unitNumber: "Plot-106", project: "Skyline Meadows", block: "Block A", size: "1 Kanal", facing: "Corner", price: 35000000, status: "Sold" },
  { id: "u-201", unitNumber: "Plot-201", project: "Skyline Meadows", block: "Block B", size: "5 Marla", facing: "Road Facing", price: 9300000, status: "Available" },
  { id: "u-204", unitNumber: "Plot-204", project: "Skyline Meadows", block: "Block B", size: "5 Marla", facing: "Standard", price: 9200000, status: "Blocked" }
];

const mockBookings: BookingRow[] = [
  { id: "BKG-901", unitNumber: "Plot-104", project: "Skyline Meadows", customerName: "Usman Farooq", customerPhone: "+92 312 1234567", agreedPrice: 9200000, paidAmount: 2300000, nextDueDate: "Nov 15, 2026", status: "Confirmed" },
  { id: "BKG-902", unitNumber: "Plot-106", project: "Skyline Meadows", customerName: "Malik Shahzad", customerPhone: "+92 300 8765432", agreedPrice: 35000000, paidAmount: 35000000, nextDueDate: "Completed", status: "Completed" },
  { id: "BKG-903", unitNumber: "Plot-103", project: "Skyline Meadows", customerName: "Ahmed Raza", customerPhone: "+92 321 9988776", agreedPrice: 18500000, paidAmount: 1850000, nextDueDate: "Oct 25, 2026", status: "Confirmed" }
];

const initialProofs: PaymentProofItem[] = [
  {
    id: "prf-1",
    bookingId: "BKG-901",
    unitNumber: "Plot-104",
    customerName: "Usman Farooq",
    installmentTitle: "Quarterly Installment #2",
    amount: 475000,
    txRef: "HBL-FT-8842109",
    paymentDate: "Oct 01, 2026",
    proofUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80",
    status: "PendingVerification"
  },
  {
    id: "prf-2",
    bookingId: "BKG-903",
    unitNumber: "Plot-103",
    customerName: "Ahmed Raza",
    installmentTitle: "Booking Deposit (10%)",
    amount: 1850000,
    txRef: "MEEZAN-RAAST-0091",
    paymentDate: "Oct 02, 2026",
    proofUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80",
    status: "PendingVerification"
  }
];

export default function DeveloperDashboardPage() {
  const [activeTab, setActiveTab] = useState<"inventory" | "bookings" | "proofs">("inventory");
  const [units, setUnits] = useState<UnitRow[]>(mockUnits);
  const [proofs, setProofs] = useState<PaymentProofItem[]>(initialProofs);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Status Change Modal State
  const [selectedUnit, setSelectedUnit] = useState<UnitRow | null>(null);
  const [newStatus, setNewStatus] = useState<UnitRow["status"]>("Available");
  const [statusReason, setStatusReason] = useState<string>("");

  // Add Unit Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addUnitNumber, setAddUnitNumber] = useState<string>("");
  const [addSize, setAddSize] = useState<string>("5 Marla");
  const [addFacing, setAddFacing] = useState<string>("Corner");
  const [addPrice, setAddPrice] = useState<number>(9500000);

  const formatPkr = (val: number) => {
    if (val >= 10000000) return `PKR ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  const handleUpdateUnitStatus = () => {
    if (!selectedUnit) return;
    setUnits((prev) =>
      prev.map((u) => (u.id === selectedUnit.id ? { ...u, status: newStatus } : u))
    );
    setSelectedUnit(null);
    setStatusReason("");
  };

  const handleAddNewUnit = () => {
    if (!addUnitNumber) return;
    const newUnit: UnitRow = {
      id: "u-" + Date.now(),
      unitNumber: addUnitNumber,
      project: "Skyline Meadows",
      block: "Block A",
      size: addSize,
      facing: addFacing,
      price: addPrice,
      status: "Available"
    };
    setUnits([newUnit, ...units]);
    setShowAddModal(false);
    setAddUnitNumber("");
  };

  const handleVerifyProof = (proofId: string, approve: boolean) => {
    setProofs((prev) =>
      prev.map((p) =>
        p.id === proofId ? { ...p, status: approve ? "Approved" : "Rejected" } : p
      )
    );
  };

  const filteredUnits = units.filter((u) => {
    if (statusFilter !== "All" && u.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Organization Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Developer Operations Hub
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> LDA Licensed • LDA-REG-2024-889
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Skyline Developers Lahore
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active Master Scheme: <strong>Skyline Meadows Lahore</strong> (Raiwind Road) • 120 Total Units
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Inventory Unit</span>
          </button>
          <Link
            href="/projects/skyline-meadows-lahore"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Public View</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Inventory</span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">{units.length}</span>
          <span className="text-[11px] text-slate-500">Units in Scheme</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm text-center bg-emerald-50/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Available</span>
          <span className="text-2xl font-black text-emerald-800 mt-0.5 block">
            {units.filter((u) => u.status === "Available").length}
          </span>
          <span className="text-[11px] text-emerald-600">Ready for booking</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm text-center bg-amber-50/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Reserved</span>
          <span className="text-2xl font-black text-amber-800 mt-0.5 block">
            {units.filter((u) => u.status === "Reserved").length}
          </span>
          <span className="text-[11px] text-amber-600">Locked pending deposit</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm text-center bg-blue-50/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Booked</span>
          <span className="text-2xl font-black text-blue-800 mt-0.5 block">
            {units.filter((u) => u.status === "Booked").length}
          </span>
          <span className="text-[11px] text-blue-600">On installment plan</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Collections</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">PKR 3.9 Cr</span>
          <span className="text-[11px] text-emerald-600 font-semibold">82% On-Time</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pending Proofs</span>
          <span className="text-2xl font-black text-rose-700 mt-0.5 block">
            {proofs.filter((p) => p.status === "PendingVerification").length}
          </span>
          <span className="text-[11px] text-slate-500">Require review</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "inventory"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Inventory Matrix ({units.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("bookings")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "bookings"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Bookings ({mockBookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("proofs")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "proofs"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Proof Verification Queue ({proofs.filter((p) => p.status === "PendingVerification").length})</span>
        </button>
      </div>

      {/* TAB 1: INVENTORY MANAGEMENT */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Booked">Booked</option>
                <option value="Sold">Sold</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>

            <span className="text-xs text-slate-500">
              Showing <strong>{filteredUnits.length}</strong> inventory units
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Unit #</th>
                    <th className="py-3.5 px-4">Block</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Orientation / Facing</th>
                    <th className="py-3.5 px-4">Base Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnits.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{u.unitNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u.block}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{u.size}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u.facing}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-800">{formatPkr(u.price)}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            u.status === "Available"
                              ? "bg-emerald-100 text-emerald-800"
                              : u.status === "Reserved"
                              ? "bg-amber-100 text-amber-800"
                              : u.status === "Booked"
                              ? "bg-blue-100 text-blue-800"
                              : u.status === "Sold"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedUnit(u);
                            setNewStatus(u.status);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Booking ID</th>
                  <th className="py-3.5 px-4">Unit #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Agreed Price</th>
                  <th className="py-3.5 px-4">Paid to Date</th>
                  <th className="py-3.5 px-4">Next Installment</th>
                  <th className="py-3.5 px-4">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{b.id}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">{b.unitNumber}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{b.customerName}</span>
                      <span className="text-[11px] text-slate-400">{b.customerPhone}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{formatPkr(b.agreedPrice)}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">{formatPkr(b.paidAmount)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{b.nextDueDate}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          b.status === "Completed"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT VERIFICATION QUEUE */}
      {activeTab === "proofs" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Audit-Backed Payment Verification</strong>
              <p className="mt-0.5 text-amber-800">
                When you approve a customer payment proof, the corresponding schedule item will be marked as <strong>Paid</strong>, the customer ledger updated, and an immutable entry added to the audit log.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      Unit: {proof.unitNumber}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">{proof.installmentTitle}</h3>
                    <p className="text-xs text-slate-500">Submitted by: <strong>{proof.customerName}</strong> ({proof.paymentDate})</p>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      proof.status === "Approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : proof.status === "Rejected"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {proof.status === "PendingVerification" ? "Pending Review" : proof.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Declared Amount</span>
                    <span className="text-sm font-black text-emerald-800">{formatPkr(proof.amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Transaction Reference</span>
                    <span className="font-mono font-bold text-slate-800">{proof.txRef}</span>
                  </div>
                </div>

                {/* Receipt Preview */}
                <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700">Bank Transfer Deposit Slip</span>
                  </div>
                  <a
                    href={proof.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    <span>View Slip</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {proof.status === "PendingVerification" && (
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleVerifyProof(proof.id, true)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve & Credit Balance</span>
                    </button>
                    <button
                      onClick={() => handleVerifyProof(proof.id, false)}
                      className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {selectedUnit.unitNumber}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">Update Inventory Status</h3>
              </div>
              <button
                onClick={() => setSelectedUnit(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UnitRow["status"])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                >
                  <option value="Available">Available (Open for Booking)</option>
                  <option value="Reserved">Reserved (Temporarily Held)</option>
                  <option value="Blocked">Blocked (Developer Reserve)</option>
                  <option value="Sold">Sold (Fully Transferred)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Audit Reason / Justification</label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Blocked for commercial corner redesign per master plan amendment..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUnitStatus}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
              >
                Confirm Status Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD UNIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-black text-slate-900">Add New Inventory Unit</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Unit Number</label>
                <input
                  type="text"
                  placeholder="e.g. Plot-305"
                  value={addUnitNumber}
                  onChange={(e) => setAddUnitNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Size</label>
                  <select
                    value={addSize}
                    onChange={(e) => setAddSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  >
                    <option value="5 Marla">5 Marla</option>
                    <option value="10 Marla">10 Marla</option>
                    <option value="1 Kanal">1 Kanal</option>
                    <option value="2 Kanal">2 Kanal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Facing</label>
                  <select
                    value={addFacing}
                    onChange={(e) => setAddFacing(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  >
                    <option value="Corner">Corner</option>
                    <option value="Park Facing">Park Facing</option>
                    <option value="Main Boulevard">Main Boulevard</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Base Price (PKR)</label>
                <input
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewUnit}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
              >
                Save Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
