"use client";

import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { googleMapsEmbedUrl, googleMapsPlaceUrl, isGoogleMapsUnavailable } from "@/lib/maps";

interface PropertyMapDisplayProps {
  latitude: number;
  longitude: number;
  title?: string;
  heightClass?: string;
  showOpenLink?: boolean;
}

export default function PropertyMapDisplay({
  latitude,
  longitude,
  title = "Property location",
  heightClass = "h-56",
  showOpenLink = true,
}: PropertyMapDisplayProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // Skip broken Google embed (billing/API/referrer) — use OSM tiles instead.
  const embedKey = apiKey && !isGoogleMapsUnavailable() ? apiKey : undefined;
  const embedSrc = googleMapsEmbedUrl(latitude, longitude, embedKey);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          {title}
        </p>
        {showOpenLink && (
          <Link
            href={googleMapsPlaceUrl(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
          >
            Open in Google Maps
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className={`rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${heightClass}`}>
        <iframe
          title={title}
          src={embedSrc}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="text-[10px] text-slate-400 font-mono">
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>
    </div>
  );
}
