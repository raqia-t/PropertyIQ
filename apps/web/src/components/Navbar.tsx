import Link from "next/link";
import { Building2, ShieldCheck, Sparkles, PlusCircle } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:bg-emerald-700 transition">
              PQ
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">PropertyIQ</span>
              <span className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">AI Pakistan</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/search?purpose=1" className="hover:text-emerald-600 transition">Buy</Link>
            <Link href="/search?purpose=2" className="hover:text-emerald-600 transition">Rent</Link>
            <Link href="/projects" className="flex items-center gap-1 hover:text-emerald-600 transition">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Projects & Installments</span>
            </Link>
            <Link href="/verification" className="flex items-center gap-1 hover:text-emerald-600 transition">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Property Verification</span>
            </Link>
            <Link href="/ai-intelligence" className="flex items-center gap-1 text-purple-600 hover:text-purple-700 transition">
              <Sparkles className="w-4 h-4" />
              <span>AI Market Scenarios</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/properties/new"
            className="hidden sm:flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>List Property</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
