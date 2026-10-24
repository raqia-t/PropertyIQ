"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace, type WorkspaceRole } from "@/context/WorkspaceContext";
import {
  WORKSPACE_HOME,
  canAccessWorkspace,
  defaultWorkspaceForBackendRole,
} from "@/lib/roles";
import {
  ShieldCheck,
  Building,
  Building2,
  Home,
  Briefcase,
  AlertCircle,
  Loader2,
  LogIn,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

type LoginPersona = Exclude<WorkspaceRole, "guest">;

const personas: Array<{
  persona: LoginPersona;
  title: string;
  subtitle: string;
  icon: typeof Home;
  color: string;
  selected: string;
}> = [
  {
    persona: "customer",
    title: "Buyer / Customer",
    subtitle: "Browse, save listings, track bookings & verification",
    icon: Home,
    color: "border-slate-200 bg-white hover:border-emerald-300",
    selected: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200",
  },
  {
    persona: "agent",
    title: "Real Estate Agent",
    subtitle: "List properties, manage leads and site visits",
    icon: Briefcase,
    color: "border-slate-200 bg-white hover:border-blue-300",
    selected: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
  },
  {
    persona: "agency",
    title: "Agency Director",
    subtitle: "Firm roster & commission view (Agent account → Agency workspace)",
    icon: Building,
    color: "border-slate-200 bg-white hover:border-purple-300",
    selected: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
  },
  {
    persona: "developer",
    title: "Master Developer",
    subtitle: "Projects, inventory, bookings & payment plans",
    icon: Building2,
    color: "border-slate-200 bg-white hover:border-amber-300",
    selected: "border-amber-500 bg-amber-50 ring-2 ring-amber-200",
  },
  {
    persona: "verifier",
    title: "Field Verification Specialist",
    subtitle: "Cases, PLRA checklists, GPS evidence & reports",
    icon: ShieldCheck,
    color: "border-slate-200 bg-white hover:border-teal-300",
    selected: "border-teal-500 bg-teal-50 ring-2 ring-teal-200",
  },
];

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { login, isAuthenticated, user } = useAuth();
  const { setWorkspace } = useWorkspace();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [persona, setPersona] = useState<LoginPersona>("customer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishLogin = (workspace: WorkspaceRole) => {
    setWorkspace(workspace);
    const fallback = WORKSPACE_HOME[workspace];
    router.push(nextPath && nextPath.startsWith("/") ? nextPath : fallback);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result = await login(email.trim(), password);
    setBusy(false);

    if (!result.success || !result.user) {
      setError(result.error || "Invalid email or password.");
      return;
    }

    // Prefer the role the user selected when their account allows it
    // (e.g. Agent → Agency). Otherwise open their default workspace.
    const workspace = canAccessWorkspace(result.user.role, persona)
      ? persona
      : defaultWorkspaceForBackendRole(result.user.role);

    finishLogin(workspace);
  };

  if (isAuthenticated && user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-black text-slate-900">Already signed in</h1>
        <p className="text-sm text-slate-600">
          You are signed in as <strong>{user.fullName}</strong> ({user.role}).
        </p>
        <Link
          href={nextPath && nextPath.startsWith("/") ? nextPath : "/"}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
        >
          Continue to app
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm">
          PQ
        </div>
        <h1 className="text-2xl font-black text-slate-900">Sign in to PropertyIQ Pakistan</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Enter your email and password, then choose the workspace role you want to open.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Sign in as
          </span>
          <div className="space-y-2">
            {personas.map((p) => {
              const Icon = p.icon;
              const active = persona === p.persona;
              return (
                <button
                  key={p.persona}
                  type="button"
                  onClick={() => setPersona(p.persona)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between ${
                    active ? p.selected : p.color
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
                      <Icon className="w-4 h-4 text-slate-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{p.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{p.subtitle}</p>
                    </div>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      active
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-60 inline-flex items-center justify-center gap-2 text-sm"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Sign in
        </button>
      </form>

      <p className="text-center text-[11px] text-slate-500">
        New to PropertyIQ?{" "}
        <Link href="/auth/signup" className="font-bold text-emerald-700 hover:underline">
          Create an account
        </Link>
        {" · "}
        <Link href="/" className="underline hover:text-slate-600">
          Continue as guest
        </Link>
      </p>
    </div>
  );
}
