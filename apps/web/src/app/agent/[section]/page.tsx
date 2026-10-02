"use client";

import { use } from "react";
import Link from "next/link";
import {
  Building,
  Users,
  Calendar,
  ShieldCheck,
  TrendingUp,
  ArrowLeft,
  PlusCircle,
  Eye,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Mail
} from "lucide-react";

interface PageProps {
  params: Promise<{ section: string }>;
}

export default function AgentSectionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const section = resolvedParams.section;

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    properties: { title: "Agent Property Listings", subtitle: "Active, pending and sold properties represented by Kamran Ali" },
    leads: { title: "Lead Inquiries & Negotiation", subtitle: "Direct customer inquiries submitted from property details" },
    clients: { title: "Client Directory & CRM", subtitle: "Active investors, buyers, and sellers in Lahore" },
    visits: { title: "Scheduled Site Visits", subtitle: "Confirmed in-person viewings with prospective buyers" },
    verification: { title: "Listing Verification Status", subtitle: "Due-diligence badges and field audit progress" },
    analytics: { title: "Performance & Conversion Analytics", subtitle: "View-to-inquiry rates and listing completeness scores" }
  };

  const current = sectionTitles[section] || {
    title: `Agent ${section.charAt(0).toUpperCase() + section.slice(1)}`,
    subtitle: "Lahore Premier Properties Agent Workspace"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/agent"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Agent Workspace</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
              {section}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{current.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Listing</span>
          </Link>
          <Link
            href="/agent"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <span>Overview Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {section === "properties" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Active Listings (12)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">ID: PROP-01</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Verified</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">1 Kanal Modern Designer House in DHA Phase 6</h4>
                <p className="text-xs font-black text-emerald-700">PKR 9.80 Crore</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <span>640 Views</span>
                  <span>•</span>
                  <span>14 Inquiries</span>
                  <span>•</span>
                  <span>Quality Score: 95%</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">ID: PROP-02</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">In Review</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">5 Marla Luxury Spanish Villa near Commercial Hub</h4>
                <p className="text-xs font-black text-emerald-700">PKR 2.65 Crore</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <span>420 Views</span>
                  <span>•</span>
                  <span>9 Inquiries</span>
                  <span>•</span>
                  <span>Quality Score: 88%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === "leads" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Inquiry Pipeline (4 Pending)</h3>
            <div className="space-y-3">
              {[
                { name: "Tariq Mahmood", phone: "+92 301 9876543", prop: "1 Kanal DHA Phase 6", msg: "Please arrange viewing for Saturday afternoon.", status: "New" },
                { name: "Zainab Bibi", phone: "+92 321 4455667", prop: "5 Marla Spanish Villa", msg: "Looking for family home. Need school distance confirmation.", status: "Contacted" },
                { name: "Fawad Chaudhry", phone: "+92 333 1122334", prop: "Skyline Meadows Plot-104", msg: "Interested in 3-year installment schedule.", status: "Qualified" }
              ].map((lead, i) => (
                <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{lead.name}</span>
                      <span className="text-slate-500">({lead.phone})</span>
                    </div>
                    <p className="text-slate-600 mt-1 font-medium">{lead.prop}</p>
                    <p className="text-slate-500 mt-0.5 italic">&quot;{lead.msg}&quot;</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{lead.status}</span>
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition">Reply</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "clients" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Active High-Net-Worth Buyers & Sellers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="font-bold text-slate-900 text-sm">Usman Farooq</span>
                <p className="text-slate-600">Investor / Buyer • Budget PKR 2 - 10 Cr</p>
                <p className="text-slate-500">Target: DHA Phase 6 & Raiwind Road Master Schemes</p>
                <p className="text-emerald-700 font-semibold">Active Booking: Skyline Meadows Plot-104</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="font-bold text-slate-900 text-sm">Malik Shahzad</span>
                <p className="text-slate-600">Seller / DHA Landowner</p>
                <p className="text-slate-500">Target: Disposing 1 Kanal plot in DHA Phase 7</p>
                <p className="text-purple-700 font-semibold">Status: Listing Mandate Signed</p>
              </div>
            </div>
          </div>
        )}

        {section === "visits" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Upcoming Property Visits</h3>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">1 Kanal DHA Phase 6 Modern Designer House</h4>
                  <p className="text-slate-600">Client: Tariq Mahmood • Saturday, Oct 04, 2026 at 3:00 PM</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Confirmed</span>
              </div>
            </div>
          </div>
        )}

        {section === "verification" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Verification & Due-Diligence Status</h3>
            <p className="text-xs text-slate-500">
              Listings with verified status receive 4x more view-to-inquiry conversions. Request verified inspections through our field team.
            </p>
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
              <div>
                <h4 className="font-bold text-slate-900">5 Marla Spanish Villa (Bahria Town Sector C)</h4>
                <p className="text-slate-500">Inspection scheduled with Specialist Zahid Hussain</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">In Review</span>
            </div>
          </div>
        )}

        {section === "analytics" && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Listing Performance & Traffic Analytics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Views</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">1,840</span>
                <span className="text-emerald-600 text-[11px]">+18% this month</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Inquiries</span>
                <span className="text-2xl font-black text-purple-700 mt-1 block">42</span>
                <span className="text-emerald-600 text-[11px]">2.3% Conversion</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Wishlist Saves</span>
                <span className="text-2xl font-black text-rose-700 mt-1 block">245</span>
                <span className="text-slate-500 text-[11px]">Qualified buyers</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Completeness</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">91%</span>
                <span className="text-emerald-600 text-[11px]">Above average</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
