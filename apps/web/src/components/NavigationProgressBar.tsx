"use client";

import { useLoading } from "@/context/LoadingContext";
import { Loader2 } from "lucide-react";

export default function NavigationProgressBar() {
  const { isLoading, progress, loadingMessage } = useLoading();

  if (!isLoading && progress === 0) return null;

  return (
    <>
      {/* Sleek Top Loading Progress Bar with Emerald Glow */}
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-emerald-950/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,0.9)] transition-all duration-200 ease-out relative"
          style={{
            width: `${progress}%`,
            opacity: isLoading || progress > 0 ? 1 : 0,
          }}
        >
          {/* Glowing trailing head of the progress bar */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent to-white/70 shadow-[0_0_8px_#ffffff]" />
        </div>
      </div>

      {/* Floating Processing Status Pill */}
      {isLoading && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-slate-900/92 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 border border-slate-700/80 text-center">
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            <span className="text-slate-100 font-medium tracking-wide">
              {loadingMessage}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-0.5" />
          </div>
        </div>
      )}
    </>
  );
}
