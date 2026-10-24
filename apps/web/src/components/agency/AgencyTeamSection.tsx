"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Phone, PlusCircle, RefreshCw, Search, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AgencyBroker {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  activeListingsCount: number;
  totalListingsCount: number;
  assignedLeadsCount: number;
  pendingLeadsCount: number;
  clientsCount: number;
  createdAtUtc: string;
}

interface AgencyBrokersResponse {
  organization: { id: string; name: string; city: string };
  activeBrokersCount: number;
  brokers: AgencyBroker[];
}

export default function AgencyTeamSection() {
  const { isHydrated, isAuthenticated, authFetch } = useAuth();
  const [data, setData] = useState<AgencyBrokersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadBrokers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      const res = await authFetch(`/api/agency/brokers${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status === 401
              ? "Session expired — sign in as Agency Director again."
              : `Could not load team (${res.status}).`)
        );
      }
      setData((await res.json()) as AgencyBrokersResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load broker team.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, debouncedSearch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError("Sign in as an Agency Director to manage the broker team.");
      return;
    }
    void loadBrokers();
  }, [isHydrated, isAuthenticated, loadBrokers]);

  const openForm = () => {
    setShowForm(true);
    setFormError(null);
    setFormOk(null);
    setFullName("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
  };

  const submitBroker = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password.trim()) {
      setFormError("All fields are required.");
      return;
    }
    if (password.trim().length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormOk(null);
    try {
      const res = await authFetch("/api/agency/brokers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          password: password.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Could not add broker (${res.status}).`);
      }
      setFormOk("Broker added to the firm. They can sign in with the email and password you set.");
      setShowForm(false);
      await loadBrokers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not add broker.");
    } finally {
      setSaving(false);
    }
  };

  const brokers = data?.brokers ?? [];

  if (!isHydrated || (loading && !data)) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading broker team…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">
            Broker Team ({brokers.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.activeBrokersCount ?? 0} active
            {data?.organization?.name ? ` · ${data.organization.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone"
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 w-52 focus:outline-none focus:border-purple-600"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadBrokers()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-xl transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Broker
          </button>
        </div>
      </div>

      {formOk && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {formOk}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void submitBroker(e)}
          className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Add broker to firm</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Creates an Agent account linked to your agency organization.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Full name</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
                placeholder="e.g. Sajjad Qureshi"
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Email (login)</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
                placeholder="broker@lahoreproperties.pk"
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Phone</span>
              <input
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
                placeholder="+92321..."
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-bold text-slate-600">Temporary password</span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-600"
                placeholder="Min 8 characters"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-4 py-2.5 rounded-xl transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
              Save broker
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!error && brokers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <Users className="w-8 h-8 text-purple-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No brokers on this firm yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add an Agent account linked to your agency. Their listings, leads, and clients will roll up
            into the firm workspace.
          </p>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl"
          >
            <PlusCircle className="w-4 h-4" />
            Add Broker
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brokers.map((b) => (
            <div
              key={b.userId}
              className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{b.fullName}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {b.email}
                  </p>
                  {b.phoneNumber && (
                    <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {b.phoneNumber}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    b.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-3 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Listings</span>
                  <span className="font-black text-slate-900">{b.activeListingsCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Leads</span>
                  <span className="font-black text-purple-700">{b.assignedLeadsCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pending</span>
                  <span className="font-black text-amber-700">{b.pendingLeadsCount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Clients</span>
                  <span className="font-black text-emerald-700">{b.clientsCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
