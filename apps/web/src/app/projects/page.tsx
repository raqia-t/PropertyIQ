"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ShieldCheck, MapPin, Calendar, CheckCircle2, ArrowRight, Layers, CreditCard, Sparkles, Filter } from "lucide-react";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  developerName: string;
  developerVerified: boolean;
  projectType: string;
  city: string;
  area: string;
  regulatoryAuthority: string;
  approvalReference: string;
  approvalStatus: string;
  totalUnits: number;
  availableUnits: number;
  startingPrice: number;
  durationMonths: number;
  frequency: string;
  bookingPercentage: number;
  possessionPercentage: number;
  completionDate: string;
  description: string;
  tags: string[];
}

const mockProjects: ProjectItem[] = [
  {
    id: "proj-1",
    name: "Skyline Meadows Lahore",
    slug: "skyline-meadows-lahore",
    developerName: "Skyline Developers Lahore",
    developerVerified: true,
    projectType: "HousingScheme",
    city: "Lahore",
    area: "Raiwind Road",
    regulatoryAuthority: "LDA",
    approvalReference: "LDA/CMP/2025/1104",
    approvalStatus: "Approved",
    totalUnits: 120,
    availableUnits: 68,
    startingPrice: 9500000,
    durationMonths: 36,
    frequency: "Quarterly",
    bookingPercentage: 10,
    possessionPercentage: 15,
    completionDate: "Dec 2028",
    description: "Premium master-planned residential housing scheme along Raiwind Road featuring underground electrification, central park, and dedicated commercial boulevard.",
    tags: ["LDA Approved NOC", "5 & 10 Marla Plots", "3-Year Quarterly Plan", "Possession on 85% Payment"]
  },
  {
    id: "proj-2",
    name: "Gulberg Marina Luxury Heights",
    slug: "gulberg-marina-heights",
    developerName: "Marina Skyline Group",
    developerVerified: true,
    projectType: "ApartmentComplex",
    city: "Lahore",
    area: "Gulberg III",
    regulatoryAuthority: "LDA",
    approvalReference: "LDA/COM/2024/782",
    approvalStatus: "Approved",
    totalUnits: 80,
    availableUnits: 34,
    startingPrice: 18500000,
    durationMonths: 30,
    frequency: "Monthly",
    bookingPercentage: 15,
    possessionPercentage: 20,
    completionDate: "June 2027",
    description: "Executive high-rise residences with panoramic views of Lahore Gymkhana and Gaddafi Stadium. Fully equipped with smart home automation.",
    tags: ["Prime Gulberg III", "1, 2 & 3 Bed Apartments", "LDA High-Rise Clearance", "Rooftop Infinity Pool"]
  },
  {
    id: "proj-3",
    name: "Margalla Enclave Executive Sector",
    slug: "margalla-enclave-islamabad",
    developerName: "Capital Crest Builders",
    developerVerified: true,
    projectType: "HousingScheme",
    city: "Islamabad",
    area: "Park Road / Zone 4",
    regulatoryAuthority: "CDA",
    approvalReference: "CDA/PLG/2025/339",
    approvalStatus: "Approved",
    totalUnits: 95,
    availableUnits: 42,
    startingPrice: 22000000,
    durationMonths: 24,
    frequency: "Quarterly",
    bookingPercentage: 15,
    possessionPercentage: 20,
    completionDate: "Oct 2027",
    description: "Serene mountain-view gated enclave in Islamabad Zone 4 with direct access to Park Road and Rawal Dam bypass.",
    tags: ["CDA Layout Approved", "10 Marla & 1 Kanal Plots", "2-Year Quarterly Plan", "Margalla Backdrop"]
  },
  {
    id: "proj-4",
    name: "Creek Crest Towers",
    slug: "creek-crest-karachi",
    developerName: "Indus Haven Enterprises",
    developerVerified: true,
    projectType: "ApartmentComplex",
    city: "Karachi",
    area: "Clifton Block 2",
    regulatoryAuthority: "SBCA",
    approvalReference: "SBCA/DD/2024/9012",
    approvalStatus: "Approved",
    totalUnits: 140,
    availableUnits: 55,
    startingPrice: 26000000,
    durationMonths: 36,
    frequency: "Quarterly",
    bookingPercentage: 10,
    possessionPercentage: 20,
    completionDate: "March 2028",
    description: "Ultra-luxury waterfront apartment tower facing the Arabian Sea with dual power backup and world-class building management.",
    tags: ["SBCA Approved", "Sea View Residences", "3-Year Installment Plan", "Clifton Prime"]
  }
];

export default function ProjectsDirectoryPage() {
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [authorityFilter, setAuthorityFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredProjects = mockProjects.filter((p) => {
    if (cityFilter !== "All" && p.city.toLowerCase() !== cityFilter.toLowerCase()) return false;
    if (authorityFilter !== "All" && p.regulatoryAuthority.toLowerCase() !== authorityFilter.toLowerCase()) return false;
    if (typeFilter !== "All" && p.projectType.toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const match =
        p.name.toLowerCase().includes(term) ||
        p.area.toLowerCase().includes(term) ||
        p.developerName.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  const formatPkr = (val: number) => {
    if (val >= 10000000) return `PKR ${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `PKR ${(val / 100000).toFixed(1)} Lakh`;
    return `PKR ${val.toLocaleString()}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>NOC Verified & Regulatory Transparent</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Off-Plan Projects & Housing Schemes
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Browse verified real estate projects across Pakistan with transparent NOC status, live unit inventory grids, and flexible 1 to 3-year installment payment plans.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> LDA / RDA / CDA Approved Only
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Layers className="w-4 h-4 text-emerald-400" /> Real-time Unit Availability
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Automated Schedule Calculators
            </span>
          </div>
        </div>

        {/* Ambient Decorative element */}
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Search Project or Location
            </label>
            <input
              type="text"
              placeholder="e.g. Skyline Meadows, Raiwind Road..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Major Cities</option>
              <option value="Lahore">Lahore</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Karachi">Karachi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Regulatory Authority
            </label>
            <select
              value={authorityFilter}
              onChange={(e) => setAuthorityFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Authorities</option>
              <option value="LDA">LDA (Lahore)</option>
              <option value="CDA">CDA (Islamabad)</option>
              <option value="SBCA">SBCA (Karachi)</option>
              <option value="RDA">RDA (Rawalpindi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Project Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Project Types</option>
              <option value="HousingScheme">Residential Housing Schemes</option>
              <option value="ApartmentComplex">Apartment Complexes & Towers</option>
              <option value="CommercialMall">Commercial Malls & Hubs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Card Header & Status Badges */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {project.projectType === "HousingScheme" ? "Master Housing Scheme" : "Apartment Complex"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {project.regulatoryAuthority} {project.approvalStatus}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      <Link href={`/projects/${project.slug}`} className="hover:text-emerald-600 transition">
                        {project.name}
                      </Link>
                    </h2>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {project.area}, {project.city}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Starting From</span>
                    <span className="text-lg font-black text-emerald-700">
                      {formatPkr(project.startingPrice)}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {project.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Inventory & Plan Highlights */}
              <div className="p-6 bg-slate-50/50 space-y-4 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] font-medium">Live Inventory</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {project.availableUnits} Available
                    </span>
                    <span className="text-slate-400 text-[11px]"> of {project.totalUnits} total</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] font-medium">Installment Terms</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {project.durationMonths} Mos. ({project.frequency})
                    </span>
                    <span className="text-emerald-600 text-[11px] block font-medium">
                      {project.bookingPercentage}% Booking • {project.possessionPercentage}% Possession
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Developer: <strong>{project.developerName}</strong></span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Handover: {project.completionDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                NOC Ref: <span className="font-mono text-slate-700">{project.approvalReference}</span>
              </div>
              <Link
                href={`/projects/${project.slug}`}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition"
              >
                <span>Explore Inventory & Plans</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
