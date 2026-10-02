"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  PlusCircle,
  AlertTriangle,
  Sparkles,
  Phone,
  Mail,
  CheckCircle,
  Building,
  ArrowRight
} from "lucide-react";

export default function AgentDashboardPage() {
  const [filterStatus, setFilterStatus] = useState("All");

  const kpis = {
    activeListings: 12,
    totalViews: 1840,
    totalSaves: 245,
    pendingLeads: 4
  };

  const weakListingAlerts = [
    {
      id: "prop-1",
      title: "5 Marla Luxury Spanish Villa near Sector C",
      issue: "Only 2 photos uploaded (minimum 5 recommended)",
      action: "Upload elevation and master washroom photos to boost completeness score to 95%"
    },
    {
      id: "prop-2",
      title: "1 Kanal Plot in DHA Phase 7",
      issue: "Missing AI expected rental yield estimate",
      action: "Generate AI valuation scenario to increase investor buyer inquiries"
    }
  ];

  const leads = [
    {
      id: "lead-1",
      name: "Tariq Mahmood",
      phone: "+92 301 9876543",
      email: "tariq.m@example.com",
      property: "1 Kanal Modern Designer House in DHA Phase 6",
      date: "Today, 10:24 AM",
      status: "New",
      message: "Please arrange viewing for Saturday afternoon. Is price negotiable?"
    },
    {
      id: "lead-2",
      name: "Zainab Bibi",
      phone: "+92 321 4455667",
      email: "zainab.b@example.com",
      property: "5 Marla Luxury Spanish Villa near Commercial Hub",
      date: "Yesterday, 4:15 PM",
      status: "Contacted",
      message: "Looking for family home. Need school distance confirmation."
    },
    {
      id: "lead-3",
      name: "Fawad Chaudhry",
      phone: "+92 333 1122334",
      email: "fawad.c@example.com",
      property: "5 Marla Prime Plot in Skyline Meadows",
      date: "2 days ago",
      status: "Qualified",
      message: "Interested in 3-year installment schedule."
    }
  ];

  const listings = [
    {
      id: "1",
      title: "Brand New 1 Kanal Modern Designer House in DHA Phase 6",
      price: "PKR 9.80 Crore",
      area: "DHA Phase 6, Lahore",
      views: 640,
      saves: 82,
      inquiries: 14,
      verification: "Verified",
      score: 95,
      status: "Published"
    },
    {
      id: "2",
      title: "5 Marla Luxury Spanish Villa near Commercial Hub",
      price: "PKR 2.65 Crore",
      area: "Bahria Town, Lahore",
      views: 420,
      saves: 56,
      inquiries: 9,
      verification: "InReview",
      score: 88,
      status: "Published"
    },
    {
      id: "3",
      title: "1 Kanal Plot in DHA Phase 7 Sector T",
      price: "PKR 3.40 Crore",
      area: "DHA Phase 7, Lahore",
      views: 310,
      saves: 38,
      inquiries: 5,
      verification: "Unverified",
      score: 72,
      status: "Published"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Agent Performance Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">Welcome back, Kamran Ali • Lahore Premier Properties</p>
        </div>

        <Link
          href="/properties/new"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add New Listing</span>
        </Link>
      </div>

      {/* AI Daily Briefing Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-300" />
          <h2 className="font-bold text-sm text-purple-200">AI Daily Intelligence Brief — Lahore Market</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-4xl">
          Good morning, Kamran! You have <span className="font-bold text-emerald-400">4 new buyer leads</span> requiring attention. Lahore market demand for 1 Kanal residential homes in DHA Phase 6 is trending up <span className="font-bold text-emerald-400">14% this week</span>. 2 of your listings have completeness gaps that could increase view-to-inquiry conversions by up to 28%.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Listings</span>
            <Building className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{kpis.activeListings}</p>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">All active in Lahore</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Views</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{kpis.totalViews}</p>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">+18% this month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Buyer Saves</span>
            <Heart className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{kpis.totalSaves}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Qualified wishlist saves</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Pending Leads</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">{kpis.pendingLeads}</p>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">Requires follow-up</p>
        </div>
      </div>

      {/* Weak Listings Diagnostics */}
      <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">AI Listing Optimization Suggestions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weakListingAlerts.map((alert) => (
            <div key={alert.id} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <h4 className="font-bold text-xs text-slate-900">{alert.title}</h4>
              <p className="text-xs text-red-600 font-medium">⚠️ {alert.issue}</p>
              <p className="text-xs text-slate-600">💡 {alert.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Leads / Inquiries Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Customer Leads</h3>
            <p className="text-xs text-slate-500">Inquiries submitted by buyers & investors</p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            {leads.length} Leads
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Target Property</th>
                <th className="pb-3 font-semibold">Message</th>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition">
                  <td className="py-3">
                    <p className="font-bold text-slate-900">{lead.name}</p>
                    <p className="text-slate-500 text-[11px]">{lead.phone}</p>
                  </td>
                  <td className="py-3 max-w-xs truncate text-slate-700 font-medium">
                    {lead.property}
                  </td>
                  <td className="py-3 max-w-xs truncate text-slate-500">
                    {lead.message}
                  </td>
                  <td className="py-3 text-slate-400">
                    {lead.date}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      lead.status === "New" ? "bg-amber-100 text-amber-800" :
                      lead.status === "Contacted" ? "bg-blue-100 text-blue-800" :
                      "bg-emerald-100 text-emerald-800"
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <button className="text-emerald-600 hover:text-emerald-700 font-bold">
                      Contact
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Listings Management Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Your Property Listings</h3>
            <p className="text-xs text-slate-500">Manage pricing, media, and verification status</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 font-semibold">Property Title</th>
                <th className="pb-3 font-semibold">Price</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Views / Saves</th>
                <th className="pb-3 font-semibold">Verification</th>
                <th className="pb-3 font-semibold">Quality</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 font-bold text-slate-900 max-w-sm truncate">
                    {l.title}
                  </td>
                  <td className="py-3 font-extrabold text-emerald-600">
                    {l.price}
                  </td>
                  <td className="py-3 text-slate-600">
                    {l.area}
                  </td>
                  <td className="py-3 text-slate-600">
                    {l.views} views • {l.saves} saves
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      l.verification === "Verified" ? "bg-emerald-100 text-emerald-800" :
                      l.verification === "InReview" ? "bg-blue-100 text-blue-800" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {l.verification}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-slate-700">
                    {l.score}%
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/properties/${l.id}`}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
