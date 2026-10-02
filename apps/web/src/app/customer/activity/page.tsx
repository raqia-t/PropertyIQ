"use client";

import Link from "next/link";
import {
  Activity,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  Eye,
  FileCheck,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function CustomerActivityPage() {
  const recentInquiries = [
    {
      id: "inq-1",
      property: "1 Kanal Modern Designer House in DHA Phase 6",
      recipient: "Kamran Ali (Agent • Lahore Premier)",
      date: "Today, 10:24 AM",
      status: "Responded",
      statusColor: "bg-emerald-100 text-emerald-800",
      message: "Please arrange viewing for Saturday afternoon. Is price negotiable?",
      reply: "Kamran Ali replied: Saturday at 3:00 PM works perfectly. Sending location pin shortly."
    },
    {
      id: "inq-2",
      property: "5 Marla Prime Residential Plot in Skyline Meadows",
      recipient: "Skyline Developers Sales Team",
      date: "2 days ago",
      status: "Offer Accepted",
      statusColor: "bg-blue-100 text-blue-800",
      message: "Interested in 3-year installment schedule for Plot-104.",
      reply: "Official booking voucher generated. Initial token confirmed."
    }
  ];

  const siteVisits = [
    {
      id: "visit-1",
      property: "1 Kanal Designer House — DHA Phase 6 Sector J",
      dateTime: "Saturday, Oct 04, 2026 at 3:00 PM",
      host: "Kamran Ali (+92 301 9876543)",
      status: "Confirmed",
      type: "In-Person Inspection"
    },
    {
      id: "visit-2",
      property: "Skyline Meadows On-Site Model Villa — Raiwind Road",
      dateTime: "Sunday, Oct 05, 2026 at 11:30 AM",
      host: "Skyline Project Rep",
      status: "Scheduled",
      type: "Developer Site Tour"
    }
  ];

  const activeBookings = [
    {
      id: "BKG-901",
      project: "Skyline Meadows Lahore",
      unit: "Plot-104 (5 Marla Standard)",
      totalPrice: "PKR 92.0 Lakh",
      paid: "PKR 23.0 Lakh (25%)",
      nextDue: "PKR 4.75 Lakh due Nov 15, 2026",
      status: "Active & In Good Standing"
    }
  ];

  const verifications = [
    {
      id: "VER-2026-0089",
      property: "Plot-102 (5 Marla) • Skyline Meadows",
      status: "Under Inspection",
      specialist: "Zahid Hussain (Field Inspector)",
      stage: "On-ground site visit complete; title deed verification in progress"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Customer Hub
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Usman Farooq • Verified Buyer
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Real Estate Activity
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track inquiries, booked site inspections, payment installments, and verification audits in one place.
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

      {/* KPI Activity Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Inquiries</span>
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">2</p>
          <p className="text-[11px] text-emerald-600 font-medium">1 new reply received</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Scheduled Visits</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">2</p>
          <p className="text-[11px] text-slate-500 font-medium">Next: Saturday 3 PM</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Bookings</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">1</p>
          <p className="text-[11px] text-emerald-600 font-medium">Skyline Meadows Plot-104</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Verification Audits</span>
            <ShieldCheck className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">1</p>
          <p className="text-[11px] text-teal-700 font-medium">Report due tomorrow</p>
        </div>
      </div>

      {/* Grid: Inquiries & Site Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inquiries */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Agent & Developer Inquiries</h3>
              <p className="text-xs text-slate-500">Direct conversations and negotiation threads</p>
            </div>
          </div>

          <div className="space-y-4">
            {recentInquiries.map((inq) => (
              <div
                key={inq.id}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{inq.property}</h4>
                    <p className="text-[11px] text-slate-500">Contact: {inq.recipient}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${inq.statusColor}`}>
                    {inq.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700">
                  <p className="font-medium text-slate-800">You: &quot;{inq.message}&quot;</p>
                  <p className="mt-1 text-emerald-800 font-semibold bg-emerald-50/60 p-2 rounded-lg">
                    💬 {inq.reply}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Site Visits */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Upcoming Site Inspections</h3>
              <p className="text-xs text-slate-500">Scheduled on-ground property viewings</p>
            </div>
          </div>

          <div className="space-y-4">
            {siteVisits.map((visit) => (
              <div
                key={visit.id}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{visit.property}</h4>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      {visit.type}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {visit.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80">
                  <p className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{visit.dateTime}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">Assigned Guide: {visit.host}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Installment Bookings Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">Active Installment Bookings</h3>
            <p className="text-xs text-slate-500">Live installment plans, payments, and payment slip upload</p>
          </div>
          <Link
            href="/my-bookings"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            <span>View Full Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-4">
          {activeBookings.map((bkg) => (
            <div
              key={bkg.id}
              className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">
                    {bkg.id}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{bkg.project}</h4>
                </div>
                <p className="text-xs text-slate-600 mt-1">Assigned Unit: <strong>{bkg.unit}</strong></p>
                <p className="text-xs text-emerald-700 font-semibold mt-1">Next Payment: {bkg.nextDue}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] text-slate-500 block">Total Agreed Price</span>
                  <span className="text-sm font-black text-slate-900">{bkg.totalPrice}</span>
                </div>
                <Link
                  href="/my-bookings"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
                >
                  Manage Installments
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
