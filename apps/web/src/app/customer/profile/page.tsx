"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { pick } from "@/lib/apiHelpers";

interface ProfileData {
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  identityVerified: boolean;
  orgCity: string | null;
}

export default function CustomerProfilePage() {
  const { user, isHydrated, isAuthenticated, authFetch } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in to view your profile.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch("/api/auth/me");
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const data = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        const org = pick<Record<string, unknown> | null>(data, "organization", "Organization");
        setProfile({
          fullName: String(pick(data, "fullName", "FullName") ?? user?.fullName ?? "Customer"),
          email: String(pick(data, "email", "Email") ?? user?.email ?? ""),
          phoneNumber: pick<string | null>(data, "phoneNumber", "PhoneNumber") ?? null,
          role: String(pick(data, "role", "Role") ?? user?.role ?? "Customer"),
          identityVerified: Boolean(pick(data, "identityVerified", "IdentityVerified")),
          orgCity: org ? String(pick(org, "city", "City") ?? "") || null : null,
        });
      } catch (e) {
        if (!cancelled) {
          // Fallback to JWT user if /me fails
          if (user) {
            setProfile({
              fullName: user.fullName,
              email: user.email,
              phoneNumber: null,
              role: user.role,
              identityVerified: false,
              orgCity: null,
            });
            setError(null);
          } else {
            setError(e instanceof Error ? e.message : "Could not load profile");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, isHydrated, user]);

  const initials = (profile?.fullName || "C")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        Loading profile…
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-sm">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {profile.fullName}
              </h1>
              {profile.identityVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3" /> Identity Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.role}
              {profile.orgCity ? ` · ${profile.orgCity}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
          Contact & Identity Details
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Full Name</span>
            <span className="font-bold text-slate-800">{profile.fullName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Phone Number</span>
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {profile.phoneNumber || "Not on file"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Email Address</span>
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {profile.email}
            </span>
          </div>
          {profile.orgCity && (
            <div>
              <span className="text-slate-400 block font-medium">City</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {profile.orgCity}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className={`rounded-3xl border p-6 text-xs space-y-2 ${
          profile.identityVerified
            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck
            className={`w-5 h-5 ${profile.identityVerified ? "text-emerald-600" : "text-slate-400"}`}
          />
          <h4 className="font-extrabold text-sm">
            {profile.identityVerified
              ? "Verified Buyer Status Active"
              : "Identity verification pending"}
          </h4>
        </div>
        <p className="leading-relaxed opacity-90">
          {profile.identityVerified
            ? "Your account passed identity checks. You can reserve developer inventory and request specialist verification."
            : "Complete phone/CNIC verification when available to unlock binding token offers and faster booking flows."}
        </p>
      </div>
    </div>
  );
}
