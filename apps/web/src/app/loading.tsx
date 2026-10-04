import { Sparkles, ShieldCheck } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      {/* Brand Pulsing Ring Animation */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulse ring */}
        <div className="absolute w-20 h-20 rounded-3xl bg-emerald-500/20 animate-ping opacity-75" />
        
        {/* Spinning gradient ring */}
        <div className="w-16 h-16 rounded-2xl border-2 border-emerald-600 border-t-transparent animate-spin" />
        
        {/* Inner Logo Badge */}
        <div className="absolute w-11 h-11 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-md">
          PQ
        </div>
      </div>

      {/* Reassuring Loading Messaging */}
      <div className="space-y-2 max-w-sm mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>PropertyIQ Engine Active</span>
        </div>
        
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
          Processing Request...
        </h3>
        
        <p className="text-xs text-slate-500 leading-relaxed">
          Loading verified property data, project installment inventory, and AI market intelligence.
        </p>
      </div>

      {/* Shimmering Skeleton Bar Placeholders */}
      <div className="w-full max-w-md space-y-2.5 pt-2">
        <div className="h-3 bg-slate-200/80 rounded-full animate-pulse w-3/4 mx-auto" />
        <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-1/2 mx-auto" />
      </div>
    </div>
  );
}
