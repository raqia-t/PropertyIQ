"use client";

import {
  User,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Bell,
  CheckCircle2,
  Lock,
  Edit3
} from "lucide-react";

export default function CustomerProfilePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-sm">
            UF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">Usman Farooq</h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3 h-3" /> NADRA Verified Buyer
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Member since January 2026 • Lahore, Pakistan</p>
          </div>
        </div>

        <button className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition border border-emerald-200">
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Profile</span>
        </button>
      </div>

      {/* Profile Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal & Contact Details */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
            Contact & Identity Details
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Full Legal Name</span>
              <span className="font-bold text-slate-800">Usman Farooq</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Phone Number</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> +92 312 1234567
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Email Address</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> usman.farooq@example.com
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Primary City</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Lahore, Punjab
              </span>
            </div>
          </div>
        </div>

        {/* Investment & Search Preferences */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
            Investment & Search Criteria
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Target Property Types</span>
              <span className="font-bold text-slate-800">Residential Houses, Plots (5 - 10 Marla)</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Preferred Budget Range</span>
              <span className="font-bold text-slate-800">PKR 2.0 Crore — PKR 10.0 Crore</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Target Localities</span>
              <span className="font-bold text-slate-800">DHA Lahore (Phase 5/6), Bahria Town, Raiwind Rd</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Installment Appetite</span>
              <span className="font-bold text-emerald-700">Open to 2 to 3-year LDA approved payment plans</span>
            </div>
          </div>
        </div>
      </div>

      {/* Due-Diligence & Verification Trust Card */}
      <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-6 text-xs text-emerald-950 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h4 className="font-extrabold text-sm text-emerald-900">Verified Buyer Status Active</h4>
        </div>
        <p className="text-emerald-800 leading-relaxed">
          Your account has passed NADRA phone-CNIC consistency check. You can submit binding token offers, reserve developer inventory directly, and request official on-ground specialist property verification.
        </p>
      </div>
    </div>
  );
}
