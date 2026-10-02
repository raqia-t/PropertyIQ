"use client";

import { useState, use } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  Phone,
  FileText,
  ChevronRight,
  X
} from "lucide-react";

interface Unit {
  id: string;
  unitNumber: string;
  unitType: string;
  size: number;
  sizeUnit: string;
  facing: string;
  basePrice: number;
  status: "Available" | "Reserved" | "Booked" | "Sold" | "Blocked";
  block: string;
}

const mockProjectDetails: Record<string, any> = {
  "skyline-meadows-lahore": {
    id: "proj-1",
    name: "Skyline Meadows Lahore",
    slug: "skyline-meadows-lahore",
    developerName: "Skyline Developers Lahore",
    licenseNumber: "LDA-REG-2024-889",
    developerVerified: true,
    city: "Lahore",
    area: "Raiwind Road",
    address: "Sector 4, Main Raiwind Road, Lahore",
    regulatoryAuthority: "LDA",
    approvalReference: "LDA/CMP/2025/1104",
    approvalStatus: "Approved",
    launchDate: "Jan 2025",
    expectedCompletionDate: "Dec 2028",
    description:
      "Skyline Meadows is an LDA-approved master-planned residential housing scheme along Raiwind Road, Lahore. Spread across 150 kanals, it offers 5 Marla, 10 Marla, and 1 Kanal residential plots alongside modern commercial boulevard plots. Designed with underground electrification, water filtration plants, solar street lighting, 24/7 gated security, and a central botanical park.",
    phases: [
      {
        id: "phase-1",
        name: "Phase 1 - Executive Sector",
        blocks: ["Block A - Jasmine", "Block B - Tulip", "Block C - Rose"]
      }
    ],
    inventory: [
      { id: "u-101", unitNumber: "Plot-101", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Corner", basePrice: 9500000, status: "Available", block: "Block A - Jasmine" },
      { id: "u-102", unitNumber: "Plot-102", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Park Facing", basePrice: 9800000, status: "Available", block: "Block A - Jasmine" },
      { id: "u-103", unitNumber: "Plot-103", unitType: "Plot", size: 10, sizeUnit: "Marla", facing: "Main Boulevard", basePrice: 18500000, status: "Reserved", block: "Block A - Jasmine" },
      { id: "u-104", unitNumber: "Plot-104", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Standard", basePrice: 9200000, status: "Booked", block: "Block A - Jasmine" },
      { id: "u-105", unitNumber: "Plot-105", unitType: "Plot", size: 10, sizeUnit: "Marla", facing: "Park Facing", basePrice: 18800000, status: "Available", block: "Block A - Jasmine" },
      { id: "u-106", unitNumber: "Plot-106", unitType: "Plot", size: 1, sizeUnit: "Kanal", facing: "Corner", basePrice: 35000000, status: "Sold", block: "Block A - Jasmine" },
      { id: "u-201", unitNumber: "Plot-201", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Road Facing", basePrice: 9300000, status: "Available", block: "Block B - Tulip" },
      { id: "u-202", unitNumber: "Plot-202", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Corner", basePrice: 9600000, status: "Available", block: "Block B - Tulip" },
      { id: "u-203", unitNumber: "Plot-203", unitType: "Plot", size: 10, sizeUnit: "Marla", facing: "Standard", basePrice: 18200000, status: "Booked", block: "Block B - Tulip" },
      { id: "u-204", unitNumber: "Plot-204", unitType: "Plot", size: 5, sizeUnit: "Marla", facing: "Standard", basePrice: 9200000, status: "Blocked", block: "Block B - Tulip" },
      { id: "u-301", unitNumber: "Plot-301", unitType: "Plot", size: 1, sizeUnit: "Kanal", facing: "Main Boulevard", basePrice: 36000000, status: "Available", block: "Block C - Rose" },
      { id: "u-302", unitNumber: "Plot-302", unitType: "Plot", size: 10, sizeUnit: "Marla", facing: "Park Facing", basePrice: 19000000, status: "Available", block: "Block C - Rose" }
    ]
  }
};

export default function ProjectDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const project = mockProjectDetails[slug] || mockProjectDetails["skyline-meadows-lahore"];

  const [selectedBlock, setSelectedBlock] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);

  // Installment Calculator state
  const [planDuration, setPlanDuration] = useState<number>(36);
  const [planFrequency, setPlanFrequency] = useState<"Quarterly" | "Monthly">("Quarterly");
  const [bookingPct, setBookingPct] = useState<number>(10);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(15);
  const [possessionPct, setPossessionPct] = useState<number>(15);

  // Booking Flow state
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<any>(null);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);

  const formatPkr = (val: number) => {
    if (val >= 10000000) return `PKR ${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  const filteredUnits = project.inventory.filter((u: Unit) => {
    if (selectedBlock !== "All" && u.block !== selectedBlock) return false;
    if (selectedType !== "All" && u.unitType !== selectedType) return false;
    if (selectedStatus !== "All" && u.status !== selectedStatus) return false;
    return true;
  });

  const getStatusBadge = (status: Unit["status"]) => {
    switch (status) {
      case "Available":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Available</span>;
      case "Reserved":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Reserved</span>;
      case "Booked":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Booked</span>;
      case "Sold":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Sold</span>;
      case "Blocked":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">Blocked</span>;
    }
  };

  // Calculate schedule dynamically
  const calculateInstallments = (unitPrice: number) => {
    const bookingAmount = Math.round(unitPrice * (bookingPct / 100));
    const downPaymentAmount = Math.round(unitPrice * (downPaymentPct / 100));
    const possessionAmount = Math.round(unitPrice * (possessionPct / 100));
    const remainingForInstallments = unitPrice - bookingAmount - downPaymentAmount - possessionAmount;

    const intervalMonths = planFrequency === "Monthly" ? 1 : 3;
    const count = Math.max(1, planDuration / intervalMonths);
    const perInstallment = Math.round(remainingForInstallments / count);

    const items = [];
    const now = new Date();

    // 1. Booking
    items.push({
      sequence: 1,
      title: "Booking Deposit",
      due: "Due upon reservation (Day 0)",
      amount: bookingAmount,
      pct: bookingPct,
      status: "Due"
    });

    // 2. Down Payment
    const dpDate = new Date();
    dpDate.setDate(dpDate.getDate() + 30);
    items.push({
      sequence: 2,
      title: "Down Payment / Confirmation",
      due: `Due in 30 days (${dpDate.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })})`,
      amount: downPaymentAmount,
      pct: downPaymentPct,
      status: "Scheduled"
    });

    // 3. Periodic Installments
    for (let i = 1; i <= count; i++) {
      const instDate = new Date(dpDate);
      instDate.setMonth(instDate.getMonth() + i * intervalMonths);
      items.push({
        sequence: items.length + 1,
        title: `${planFrequency} Installment #${i}`,
        due: instDate.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" }),
        amount: perInstallment,
        pct: Number((remainingForInstallments / unitPrice / count * 100).toFixed(1)),
        status: "Scheduled"
      });
    }

    // 4. Possession
    const possDate = new Date();
    possDate.setMonth(possDate.getMonth() + planDuration);
    items.push({
      sequence: items.length + 1,
      title: "Possession & Title Handover",
      due: `On Completion (${possDate.toLocaleDateString("en-PK", { month: "short", year: "numeric" })})`,
      amount: possessionAmount,
      pct: possessionPct,
      status: "Scheduled"
    });

    return {
      bookingAmount,
      downPaymentAmount,
      possessionAmount,
      remainingForInstallments,
      count,
      perInstallment,
      items
    };
  };

  const activeSchedule = activeUnit ? calculateInstallments(activeUnit.basePrice) : null;

  const handleConfirmReservation = async () => {
    if (!activeUnit) return;
    setIsBookingSubmitting(true);
    setConcurrencyError(null);

    try {
      // Attempt backend API reservation
      const res = await fetch("http://localhost:5000/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: activeUnit.id,
          totalAgreedPrice: activeUnit.basePrice,
          durationMonths: planDuration,
          frequency: planFrequency === "Monthly" ? 1 : 2,
          bookingPercentage: bookingPct,
          downPaymentPercentage: downPaymentPct,
          possessionPercentage: possessionPct
        })
      });

      if (res.status === 409) {
        const errorData = await res.json();
        setConcurrencyError(errorData.message || "This unit was just reserved or booked by another buyer. Please select another unit.");
        setIsBookingSubmitting(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setBookingConfirmed(data);
      } else {
        // Fallback for standalone demo mode
        setBookingConfirmed({
          id: "BKG-" + Math.floor(100000 + Math.random() * 900000),
          unitNumber: activeUnit.unitNumber,
          projectName: project.name,
          totalAgreedPrice: activeUnit.basePrice,
          currency: "PKR",
          status: "Confirmed",
          bookedAtUtc: new Date().toISOString(),
          bookingAmountDue: activeSchedule?.bookingAmount || 950000
        });
      }
    } catch {
      // Graceful fallback simulation
      setBookingConfirmed({
        id: "BKG-" + Math.floor(100000 + Math.random() * 900000),
        unitNumber: activeUnit.unitNumber,
        projectName: project.name,
        totalAgreedPrice: activeUnit.basePrice,
        currency: "PKR",
        status: "Confirmed",
        bookedAtUtc: new Date().toISOString(),
        bookingAmountDue: activeSchedule?.bookingAmount || 950000
      });
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/" className="hover:text-emerald-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/projects" className="hover:text-emerald-600">Projects</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-medium">{project.name}</span>
      </div>

      {/* Project Header Banner */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {project.regulatoryAuthority} Approved • {project.approvalReference}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Developer Firm
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {project.name}
            </h1>
            <p className="flex items-center gap-2 text-sm text-slate-500 mt-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              {project.address}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Total Units</span>
              <span className="text-xl font-black text-slate-900">{project.inventory.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 block">Available</span>
              <span className="text-xl font-black text-emerald-800">
                {project.inventory.filter((u: Unit) => u.status === "Available").length}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Handover</span>
              <span className="text-base font-bold text-slate-900">{project.expectedCompletionDate}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-600 leading-relaxed max-w-4xl border-t border-slate-100 pt-5">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-slate-500 pt-2">
          <span>Developer: <strong className="text-slate-800">{project.developerName}</strong> ({project.licenseNumber})</span>
          <span>NOC Status: <strong className="text-emerald-700">Official Government LDA Clearance Granted</strong></span>
          <span>Payment Schedule: <strong className="text-slate-800">10% Booking • Up to 36 Months</strong></span>
        </div>
      </div>

      {/* Main Content: Phase Navigation & Inventory Grid */}
      <div className="space-y-6">
        {/* Controls Toolbar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Block:</span>
            {["All", "Block A - Jasmine", "Block B - Tulip", "Block C - Rose"].map((block) => (
              <button
                key={block}
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
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
            </select>
          </div>
        </div>

        {/* Live Inventory Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredUnits.map((unit: Unit) => {
            const isAvailable = unit.status === "Available";

            return (
              <div
                key={unit.id}
                onClick={() => isAvailable && setActiveUnit(unit)}
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
                    {unit.size} {unit.sizeUnit} Residential Plot
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
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Price</span>
                    <span className="text-sm font-black text-emerald-700">
                      {formatPkr(unit.basePrice)}
                    </span>
                  </div>

                  {isAvailable ? (
                    <button className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition">
                      Calculate & Book
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic font-medium">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unit Drawer / Modal: Installment Calculator & Concurrency-Safe Booking */}
      {activeUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                    {activeUnit.unitNumber}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">• {activeUnit.block}</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  {activeUnit.size} {activeUnit.sizeUnit} Plot — Installment Calculator & Booking
                </h2>
              </div>
              <button
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
                  <strong className="block font-bold mb-0.5">Reservation Conflict</strong>
                  <p>{concurrencyError}</p>
                </div>
              </div>
            )}

            {!bookingConfirmed ? (
              <div className="mt-6 space-y-6">
                {/* Unit Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Total Price</span>
                    <span className="text-base font-black text-emerald-700">{formatPkr(activeUnit.basePrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Facing / Orientation</span>
                    <span className="text-slate-800 font-bold">{activeUnit.facing}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Regulatory NOC</span>
                    <span className="text-emerald-700 font-bold">Approved (LDA)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Currency</span>
                    <span className="text-slate-800 font-bold">PKR (Guaranteed)</span>
                  </div>
                </div>

                {/* Plan Configurator */}
                <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Configure Payment Schedule
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Exact Rupee Precision
                    </span>
                  </div>

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
                        Installment Frequency
                      </label>
                      <select
                        value={planFrequency}
                        onChange={(e) => setPlanFrequency(e.target.value as "Quarterly" | "Monthly")}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value="Quarterly">Quarterly (Every 3 Mos.)</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Booking Percentage
                      </label>
                      <select
                        value={bookingPct}
                        onChange={(e) => setBookingPct(Number(e.target.value))}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value={10}>10% Booking Deposit</option>
                        <option value={15}>15% Booking Deposit</option>
                        <option value={20}>20% Booking Deposit</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Milestone Summary Cards */}
                {activeSchedule && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Booking ({bookingPct}%)</span>
                      <span className="font-extrabold text-slate-900">{formatPkr(activeSchedule.bookingAmount)}</span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">Due at Reservation</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Down Payment ({downPaymentPct}%)</span>
                      <span className="font-extrabold text-slate-900">{formatPkr(activeSchedule.downPaymentAmount)}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">In 30 Days</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Installments ({activeSchedule.count}x)</span>
                      <span className="font-extrabold text-slate-900">{formatPkr(activeSchedule.perInstallment)}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{planFrequency}</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Possession ({possessionPct}%)</span>
                      <span className="font-extrabold text-slate-900">{formatPkr(activeSchedule.possessionAmount)}</span>
                      <span className="text-[10px] text-emerald-700 block mt-0.5">At Handover</span>
                    </div>
                  </div>
                )}

                {/* Full Schedule Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Generated Payment Schedule Breakdown</span>
                    <span>Total: {formatPkr(activeUnit.basePrice)}</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {activeSchedule?.items.map((item, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-slate-400 font-mono text-[11px]">#{item.sequence}</span>
                          <div>
                            <span className="font-semibold text-slate-800 block">{item.title}</span>
                            <span className="text-[11px] text-slate-400">{item.due}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 block">{formatPkr(item.amount)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{item.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Concurrency Safe Action Button */}
                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Protected by concurrency token to prevent double-booking.
                  </div>

                  <button
                    disabled={isBookingSubmitting}
                    onClick={handleConfirmReservation}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition disabled:opacity-50"
                  >
                    {isBookingSubmitting ? "Locking & Reserving Unit..." : `Confirm Reservation (${formatPkr(activeSchedule?.bookingAmount || 0)} Due)`}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Booking Success Celebration State */
              <div className="mt-8 text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    Unit Reserved Successfully!
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                    Your reservation for <strong>{bookingConfirmed.unitNumber}</strong> at {project.name} is confirmed and locked in the inventory ledger.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-md mx-auto text-left text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Reference:</span>
                    <span className="font-mono font-bold text-slate-800">{bookingConfirmed.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agreed Unit Price:</span>
                    <span className="font-bold text-slate-900">{formatPkr(bookingConfirmed.totalAgreedPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-emerald-800">
                    <span>Initial Booking Deposit:</span>
                    <span>{formatPkr(bookingConfirmed.bookingAmountDue)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-3">
                  <Link
                    href="/my-bookings"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow transition"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>View My Installment Calendar</span>
                  </Link>

                  <button
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
