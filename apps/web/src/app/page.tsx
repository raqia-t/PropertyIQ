"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Search,
  Sparkles,
  ShieldCheck,
  Building2,
  MapPin,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Loader2,
  Heart,
  MessageSquare,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { buildSearchHref, parseAiSearchOrHeuristic } from "@/lib/aiSearch";

interface ProjectCard {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
  regulatoryAuthority: string;
  approvalStatus: string;
  developerName: string;
  availableUnits: number;
  startingPrice: number;
}

interface SavedItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  area: string;
}

interface InquiryItem {
  id: string;
  propertyTitle: string | null;
  projectName: string | null;
  status: string;
  createdAtUtc: string;
}

interface BookingItem {
  id: string;
  unitNumber: string;
  projectName: string;
  status: string;
  nextPaymentDue: {
    title: string;
    dueDate: string;
    amount: number;
    status: string;
  } | null;
}

interface VerificationItem {
  id: string;
  targetName: string;
  status: string;
}

function formatPkr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  if (amount >= 10_000_000) return `PKR ${(amount / 10_000_000).toFixed(2)} Crore`;
  if (amount >= 100_000) return `PKR ${(amount / 100_000).toFixed(2)} Lakh`;
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key] as T;
  }
  return undefined;
}

export default function HomePage() {
  const router = useRouter();
  const { startLoading } = useLoading();
  const { isAuthenticated, isHydrated, authFetch } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("Lahore");
  const [isSearching, setIsSearching] = useState(false);

  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const isCustomerHome = isHydrated && isAuthenticated && activeWorkspace === "customer";

  const sampleSuggestions = [
    "5 marla house in Lahore under PKR 3 crore near good schools",
    "1 kanal modern house in DHA Phase 6 Lahore",
    "Plot with 3-year installment plan near Raiwind Road",
    "Apartment in Islamabad with high rental yield",
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const res = await fetch("/api/projects?page=1&pageSize=4");
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
        const data = await res.json();
        const items = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
        if (cancelled) return;
        setProjects(
          items.map((p) => ({
            id: String(pick(p, "id", "Id") ?? ""),
            name: String(pick(p, "name", "Name") ?? "Untitled project"),
            slug: String(pick(p, "slug", "Slug") ?? ""),
            city: String(pick(p, "city", "City") ?? ""),
            area: String(pick(p, "area", "Area") ?? ""),
            regulatoryAuthority: String(pick(p, "regulatoryAuthority", "RegulatoryAuthority") ?? ""),
            approvalStatus: String(pick(p, "approvalStatus", "ApprovalStatus") ?? ""),
            developerName: String(pick(p, "developerName", "DeveloperName") ?? "Developer"),
            availableUnits: Number(pick(p, "availableUnits", "AvailableUnits") ?? 0),
            startingPrice: Number(pick(p, "startingPrice", "StartingPrice") ?? 0),
          }))
        );
      } catch (e) {
        if (!cancelled) {
          setProjectsError(e instanceof Error ? e.message : "Could not load projects");
          setProjects([]);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCustomerHome) {
      setSaved([]);
      setInquiries([]);
      setBookings([]);
      setVerifications([]);
      return;
    }

    let cancelled = false;

    async function loadSnapshot() {
      setSnapshotLoading(true);
      try {
        const [savedRes, inquiriesRes, bookingsRes, casesRes] = await Promise.all([
          authFetch("/api/properties/saved"),
          authFetch("/api/inquiries/my"),
          authFetch("/api/bookings"),
          authFetch("/api/verification/cases"),
        ]);

        if (cancelled) return;

        if (savedRes.ok) {
          const rows = (await savedRes.json()) as Record<string, unknown>[];
          setSaved(
            (Array.isArray(rows) ? rows : []).slice(0, 3).map((r) => ({
              id: String(pick(r, "id", "Id") ?? ""),
              title: String(pick(r, "title", "Title") ?? "Property"),
              price: Number(pick(r, "price", "Price") ?? 0),
              currency: String(pick(r, "currency", "Currency") ?? "PKR"),
              city: String(pick(r, "city", "City") ?? ""),
              area: String(pick(r, "area", "Area") ?? ""),
            }))
          );
        }

        if (inquiriesRes.ok) {
          const rows = (await inquiriesRes.json()) as Record<string, unknown>[];
          setInquiries(
            (Array.isArray(rows) ? rows : []).slice(0, 3).map((r) => ({
              id: String(pick(r, "id", "Id") ?? ""),
              propertyTitle: (pick<string | null>(r, "propertyTitle", "PropertyTitle") ?? null),
              projectName: (pick<string | null>(r, "projectName", "ProjectName") ?? null),
              status: String(pick(r, "status", "Status") ?? "New"),
              createdAtUtc: String(pick(r, "createdAtUtc", "CreatedAtUtc") ?? ""),
            }))
          );
        }

        if (bookingsRes.ok) {
          const rows = (await bookingsRes.json()) as Record<string, unknown>[];
          setBookings(
            (Array.isArray(rows) ? rows : []).slice(0, 3).map((r) => {
              const next = pick<Record<string, unknown> | null>(r, "nextPaymentDue", "NextPaymentDue");
              return {
                id: String(pick(r, "id", "Id") ?? ""),
                unitNumber: String(pick(r, "unitNumber", "UnitNumber") ?? "—"),
                projectName: String(pick(r, "projectName", "ProjectName") ?? "Project"),
                status: String(pick(r, "status", "Status") ?? ""),
                nextPaymentDue: next
                  ? {
                      title: String(pick(next, "title", "Title") ?? "Payment"),
                      dueDate: String(pick(next, "dueDate", "DueDate") ?? ""),
                      amount: Number(pick(next, "amount", "Amount") ?? 0),
                      status: String(pick(next, "status", "Status") ?? ""),
                    }
                  : null,
              };
            })
          );
        }

        if (casesRes.ok) {
          const rows = (await casesRes.json()) as Record<string, unknown>[];
          setVerifications(
            (Array.isArray(rows) ? rows : []).slice(0, 3).map((r) => ({
              id: String(pick(r, "id", "Id") ?? ""),
              targetName: String(pick(r, "targetName", "TargetName") ?? "Property"),
              status: String(pick(r, "status", "Status") ?? ""),
            }))
          );
        }
      } catch {
        // Snapshot is best-effort; hero + projects still work
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [isCustomerHome, authFetch]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : searchQuery).trim();
    setIsSearching(true);

    // Phase 6: parse on home, then land on /search with structured filters (ai=1).
    // Always markParsed for long NL so listings never use Title.Contains(full sentence).
    if (query.length > 8) {
      startLoading("Understanding query…");
      const intent = await parseAiSearchOrHeuristic(query, selectedCity);
      startLoading(`Finding properties in ${intent.city || selectedCity}…`);
      router.push(
        buildSearchHref({
          intent,
          query,
          preferredCity: selectedCity,
          markParsed: true,
        })
      );
      return;
    }

    startLoading(`AI Search: Finding properties in ${selectedCity}...`);
    router.push(
      buildSearchHref({
        query,
        preferredCity: selectedCity,
        markParsed: false,
      })
    );
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-950 text-white pt-20 pb-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next-Gen Real Estate Intelligence for Pakistan</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Find. Analyze. <span className="text-emerald-400">Verify.</span> <br />
            Make Confident Property Decisions.
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Not just property listings. PropertyIQ AI delivers fair-value context, rental yields, live
            project installment inventory, and verifiable due diligence across Pakistan.
          </p>

          <div className="max-w-3xl mx-auto pt-4">
            <form
              onSubmit={(e) => handleSearch(e)}
              className="bg-white rounded-2xl p-2 shadow-2xl flex flex-col md:flex-row items-center gap-2 border border-slate-200 text-slate-900"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-auto">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={isSearching}
                  className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer"
                >
                  <option value="Lahore">Lahore</option>
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Karachi">Karachi</option>
                </select>
              </div>

              <div className="flex-1 flex items-center px-3 py-2 w-full">
                <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  disabled={isSearching}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Describe in plain English: '5 marla house under 3 crore near hospital and schools...'"
                  className="w-full text-sm font-normal focus:outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow-md disabled:opacity-70 shrink-0"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>AI Search</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-slate-400">Try asking:</span>
              {sampleSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  disabled={isSearching}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    handleSearch(undefined, suggestion);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-slate-200 px-3 py-1 rounded-full border border-white/10 transition text-left disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customer live snapshot */}
      {isCustomerHome && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your activity</h2>
                <p className="text-xs text-slate-500">Live from your account — not demo content</p>
              </div>
              {snapshotLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SnapshotCard
                icon={<Heart className="w-4 h-4" />}
                label="Saved"
                count={saved.length}
                href="/customer/saved"
                empty="No saved properties yet"
                items={saved.map((s) => s.title)}
              />
              <SnapshotCard
                icon={<MessageSquare className="w-4 h-4" />}
                label="Inquiries"
                count={inquiries.length}
                href="/customer/activity"
                empty="No inquiries yet"
                items={inquiries.map(
                  (i) => `${i.propertyTitle || i.projectName || "Inquiry"} · ${i.status}`
                )}
              />
              <SnapshotCard
                icon={<CreditCard className="w-4 h-4" />}
                label="Bookings"
                count={bookings.length}
                href="/my-bookings"
                empty="No bookings yet"
                items={bookings.map((b) => {
                  if (b.nextPaymentDue) {
                    return `${b.projectName} · next ${formatPkr(b.nextPaymentDue.amount)}`;
                  }
                  return `${b.projectName} · ${b.unitNumber}`;
                })}
              />
              <SnapshotCard
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Verification"
                count={verifications.length}
                href="/verification"
                empty="No verification cases"
                items={verifications.map((v) => `${v.targetName} · ${v.status}`)}
              />
            </div>
          </div>
        </section>
      )}

      {/* 4 Core Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Built Specifically for Pakistan Real Estate
          </h2>
          <p className="mt-3 text-slate-600 text-sm">
            Solving the biggest issues of transparency, fake listings, complex payment schedules, and
            title uncertainty.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">AI Property Intelligence</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Every property includes fair price context, expected rental yields, 3/5/10-year
              appreciation scenarios, and neighborhood POIs.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Project Inventory Engine</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Direct access to developer projects, phase/block availability, live unit inventory
              statuses, and milestone installment schedules.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Verification Marketplace</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Paid on-demand due diligence: physical site inspection, document checklists, and checks
              against accessible authorities (PLRA, RDA, SBCA).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Demand Intelligence</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Aggregated, privacy-preserving search signals showing high-demand / low-supply corridors
              for agents and developers.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Projects — live API */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Featured Housing Projects</h2>
            <p className="text-sm text-slate-500">Loaded live from project inventory</p>
          </div>
          <Link
            href="/projects"
            className="text-sm font-semibold text-emerald-600 flex items-center gap-1 hover:text-emerald-700"
          >
            <span>View All Projects</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {projectsLoading && (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            Loading projects…
          </div>
        )}

        {!projectsLoading && projectsError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-3 text-sm text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Could not load live projects</p>
              <p className="mt-1 text-rose-700">{projectsError}. Is the API running on :5000?</p>
            </div>
          </div>
        )}

        {!projectsLoading && !projectsError && projects.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No projects in the database yet.
          </div>
        )}

        {!projectsLoading && !projectsError && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <div className="h-48 bg-gradient-to-r from-emerald-800 to-slate-800 p-6 flex flex-col justify-between text-white">
                  <div className="flex justify-between items-start gap-2">
                    <span className="px-3 py-1 bg-emerald-500/80 rounded-full text-xs font-semibold backdrop-blur">
                      {project.regulatoryAuthority
                        ? `${project.regulatoryAuthority} · ${project.approvalStatus || "Listed"}`
                        : project.approvalStatus || "Listed"}
                    </span>
                    <span className="text-xs bg-black/40 px-2 py-1 rounded shrink-0">
                      {[project.area, project.city].filter(Boolean).join(", ") || "Pakistan"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold">{project.name}</h3>
                    <p className="text-xs text-slate-300 mt-1">By {project.developerName}</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs text-slate-500">Starting Price</p>
                      <p className="text-base font-bold text-slate-900">
                        {formatPkr(project.startingPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Available Units</p>
                      <p className="text-base font-bold text-emerald-600">
                        {project.availableUnits}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Live inventory from API</span>
                    </span>
                  </div>

                  <Link
                    href={project.slug ? `/projects/${project.slug}` : `/projects`}
                    className="w-full block text-center bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm py-2.5 rounded-xl transition"
                  >
                    View Live Inventory & Schedule
                  </Link>
                </div>
              </div>
            ))}

            {/* Verification CTA — kept as product entry, not fake listing data */}
            <div className="bg-gradient-to-br from-emerald-50 via-slate-50 to-white rounded-2xl border border-emerald-200 p-8 flex flex-col justify-between shadow-sm md:col-span-2 lg:col-span-1">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Independent Property Verification
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Found a property you like? Order a verified due diligence report before paying token
                  money or committing to a purchase.
                </p>
              </div>

              <Link
                href="/verification"
                className="mt-6 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition shadow"
              >
                <span>Explore Verification Tiers</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SnapshotCard({
  icon,
  label,
  count,
  href,
  empty,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
  empty: string;
  items: string[];
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-100 bg-slate-50/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition p-4 block"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
          <span className="text-emerald-600">{icon}</span>
          {label}
        </span>
        <span className="text-sm font-black text-slate-900">{count}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 2).map((item, i) => (
            <li key={i} className="text-xs text-slate-600 truncate">
              {item}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
