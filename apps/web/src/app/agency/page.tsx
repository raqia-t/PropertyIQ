"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building,
  Users,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Shield,
  Briefcase,
  Phone,
  Mail,
  Award,
  BarChart3,
  FileText,
  CheckCircle2,
  Building2
} from "lucide-react";

export default function AgencyDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "team" | "listings" | "leads">("overview");

  const kpis = {
    totalListings: 48,
    activeBrokers: 14,
    monthlyLeads: 142,
    closedVolume: "PKR 38.4 Crore"
  };

  const teamBrokers = [
    {
      id: "brk-1",
      name: "Kamran Ali",
      role: "Senior Real Estate Consultant",
      listings: 12,
      leads: 34,
      closedVolume: "PKR 14.8 Cr",
      commissionSplit: "70 / 30",
      rating: "4.9 / 5.0"
    },
    {
      id: "brk-2",
      name: "Sajjad Qureshi",
      role: "DHA Phase 7/8 Specialist",
      listings: 15,
      leads: 41,
      closedVolume: "PKR 12.2 Cr",
      commissionSplit: "65 / 35",
      rating: "4.8 / 5.0"
    },
    {
      id: "brk-3",
      name: "Fatima Noor",
      role: "Luxury Residential Advisor",
      listings: 9,
      leads: 28,
      closedVolume: "PKR 6.5 Cr",
      commissionSplit: "60 / 40",
      rating: "4.9 / 5.0"
    },
    {
      id: "brk-4",
      name: "Hamza Tariq",
      role: "Commercial Schemes Associate",
      listings: 12,
      leads: 39,
      closedVolume: "PKR 4.9 Cr",
      commissionSplit: "60 / 40",
      rating: "4.7 / 5.0"
    }
  ];

  const agencyListings = [
    {
      id: "1",
      title: "1 Kanal Modern Designer House in DHA Phase 6",
      agent: "Kamran Ali",
      price: "PKR 9.80 Crore",
      status: "Published",
      leads: 14,
      verification: "Verified"
    },
    {
      id: "2",
      title: "5 Marla Luxury Spanish Villa near Commercial Hub",
      agent: "Fatima Noor",
      price: "PKR 2.65 Crore",
      status: "Published",
      leads: 9,
      verification: "InReview"
    },
    {
      id: "3",
      title: "10 Marla Corner Residential Plot in DHA Phase 7",
      agent: "Sajjad Qureshi",
      price: "PKR 4.20 Crore",
      status: "Offer Stage",
      leads: 22,
      verification: "Verified"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Organization Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800">
              Agency Enterprise Workspace
            </span>
            <span className="text-xs font-semibold text-slate-500">
              LDA Licensed Brokerage Firm
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Premier Realty Group (Brokerage)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise Management • 14 Certified Agents • Coverage: DHA Lahore, Gulberg, Bahria Town & Scheme 33
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Agency Listing</span>
          </Link>
          <Link
            href="/demand-intelligence"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
          >
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span>Market Intelligence</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Firm Listings</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{kpis.totalListings}</p>
          <p className="text-[11px] text-purple-700 font-medium">+6 listings this month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Agents / Team</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{kpis.activeBrokers}</p>
          <p className="text-[11px] text-emerald-600 font-medium">All certified & licensed</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Monthly Lead Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{kpis.monthlyLeads}</p>
          <p className="text-[11px] text-emerald-600 font-medium">Qualified buyer inquiries</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Q3 Closed Volume</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2">{kpis.closedVolume}</p>
          <p className="text-[11px] text-purple-700 font-medium">Top brokerage in DHA Lahore</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "overview"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Agency Operations</span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "team"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Broker Team Roster ({teamBrokers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("listings")}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "listings"
              ? "border-purple-600 text-purple-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Firm Listings ({agencyListings.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TEAM */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Team Performance Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">Broker Team Performance</h3>
                <p className="text-xs text-slate-500">Track agent deal flow, commission splits, and active buyer leads</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Broker</th>
                    <th className="pb-3">Specialization</th>
                    <th className="pb-3">Active Listings</th>
                    <th className="pb-3">Assigned Leads</th>
                    <th className="pb-3">Closed Volume</th>
                    <th className="pb-3">Split (Agent/Firm)</th>
                    <th className="pb-3">Customer Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamBrokers.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 font-bold text-slate-900">{b.name}</td>
                      <td className="py-3.5 text-slate-600">{b.role}</td>
                      <td className="py-3.5 font-semibold text-slate-800">{b.listings}</td>
                      <td className="py-3.5 font-semibold text-purple-700">{b.leads}</td>
                      <td className="py-3.5 font-extrabold text-emerald-700">{b.closedVolume}</td>
                      <td className="py-3.5 text-slate-600 font-mono">{b.commissionSplit}</td>
                      <td className="py-3.5 text-amber-600 font-semibold">{b.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL TEAM */}
      {activeTab === "team" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teamBrokers.map((b) => (
            <div key={b.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">{b.name}</h4>
                  <p className="text-xs text-slate-500">{b.role}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  Split: {b.commissionSplit}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Listings</span>
                  <span className="font-black text-slate-900 text-sm">{b.listings}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Leads</span>
                  <span className="font-black text-purple-700 text-sm">{b.leads}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Closed</span>
                  <span className="font-black text-emerald-700 text-sm">{b.closedVolume}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>Client Rating: <strong className="text-slate-800">{b.rating}</strong></span>
                <button className="text-purple-600 hover:text-purple-700 font-bold">
                  View Full Broker Profile →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: FIRM LISTINGS */}
      {activeTab === "listings" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="pb-3">Property Title</th>
                  <th className="pb-3">Assigned Broker</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Leads</th>
                  <th className="pb-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agencyListings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 font-bold text-slate-900">{l.title}</td>
                    <td className="py-3.5 text-slate-600">{l.agent}</td>
                    <td className="py-3.5 font-extrabold text-emerald-700">{l.price}</td>
                    <td className="py-3.5 text-slate-600">{l.status}</td>
                    <td className="py-3.5 font-semibold text-purple-700">{l.leads}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {l.verification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
