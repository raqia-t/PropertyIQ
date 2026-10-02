"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, WORKSPACE_CONFIGS, WorkspaceRole } from "@/context/WorkspaceContext";
import {
  Phone,
  ShieldCheck,
  Building,
  Building2,
  Home,
  Briefcase,
  ArrowRight,
  Lock,
  Sparkles
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setWorkspace } = useWorkspace();
  const [phoneNumber, setPhoneNumber] = useState("03121234567");

  const personas: Array<{ role: WorkspaceRole; redirect: string; title: string; subtitle: string; icon: any; color: string }> = [
    {
      role: "customer",
      redirect: "/",
      title: "Sign in as Verified Buyer / Customer",
      subtitle: "Usman Farooq • Explore, save properties, view installments & activity",
      icon: Home,
      color: "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900"
    },
    {
      role: "agent",
      redirect: "/agent",
      title: "Sign in as Real Estate Agent",
      subtitle: "Kamran Ali • Manage Lahore listings, leads, and client visits",
      icon: Briefcase,
      color: "border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900"
    },
    {
      role: "agency",
      redirect: "/agency",
      title: "Sign in as Agency Director",
      subtitle: "Premier Realty Group • Team roster, 14 brokers, commission splits",
      icon: Building,
      color: "border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900"
    },
    {
      role: "developer",
      redirect: "/developer",
      title: "Sign in as Master Developer",
      subtitle: "Skyline Developers • Skyline Meadows inventory, bookings & proofs",
      icon: Building2,
      color: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900"
    },
    {
      role: "verifier",
      redirect: "/specialist",
      title: "Sign in as Field Verification Specialist",
      subtitle: "Zahid Hussain • On-ground PLRA checklists, GPS evidence & reports",
      icon: ShieldCheck,
      color: "border-teal-200 bg-teal-50/50 hover:bg-teal-50 text-teal-900"
    }
  ];

  const handleSelectRole = (role: WorkspaceRole, redirect: string) => {
    setWorkspace(role);
    router.push(redirect);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm">
          PQ
        </div>
        <h1 className="text-2xl font-black text-slate-900">Sign in to PropertyIQ Pakistan</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Role-aware real estate ecosystem platform. Select your role or demo persona below.
        </p>
      </div>

      {/* Persona Quick-Switch Grid */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
          Demo Persona & Workspace Access
        </span>

        {personas.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.role}
              onClick={() => handleSelectRole(p.role, p.redirect)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-sm ${p.color}`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">{p.title}</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">{p.subtitle}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 opacity-50 shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Phone OTP Login fallback */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
          Or Mobile Number Authentication
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Pakistani Mobile (+92)</label>
            <div className="relative">
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0300 1234567"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            onClick={() => handleSelectRole("customer", "/")}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition"
          >
            Send OTP & Sign In as Customer
          </button>
        </div>
      </div>
    </div>
  );
}
