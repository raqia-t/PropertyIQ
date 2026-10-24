"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import {
  defaultCenterForCity,
  geocodeAddressLine,
  isGoogleMapsUnavailable,
  loadGoogleMapsScript,
  loadLeaflet,
  markGoogleMapsUnavailable,
} from "@/lib/maps";

interface PropertyLocationPickerProps {
  city: string;
  area?: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  showPinToCustomers: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  onShowPinChange: (show: boolean) => void;
}

export default function PropertyLocationPicker({
  city,
  area = "",
  address = "",
  latitude,
  longitude,
  showPinToCustomers,
  onLocationChange,
  onShowPinChange,
}: PropertyLocationPickerProps) {
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const osmContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [forceOsm, setForceOsm] = useState(false);
  const seededRef = useRef(false);
  /** After user drags/clicks the map, skip auto-geocode until city/area change or "Pin from address". */
  const manualPinRef = useRef(false);
  const lastAutoQueryRef = useRef("");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const useGoogle = Boolean(apiKey) && !forceOsm && !isGoogleMapsUnavailable();

  const effectiveLat = latitude ?? defaultCenterForCity(city).lat;
  const effectiveLng = longitude ?? defaultCenterForCity(city).lng;

  const fallbackToOsm = useCallback((reason: string) => {
    markGoogleMapsUnavailable(reason);
    setForceOsm(true);
    setMapReady(false);
    setMapError(
      "Google Maps key was rejected — using OpenStreetMap. Ask your team lead to enable Maps JavaScript API + billing and allow http://localhost:3000/* on this key."
    );
  }, []);

  const setPin = useCallback(
    (lat: number, lng: number) => {
      onLocationChange(lat, lng);
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([lat, lng]);
        leafletMapRef.current?.panTo([lat, lng]);
      }
      if (markerRef.current) {
        const pos = { lat, lng };
        markerRef.current.setPosition(pos);
        mapRef.current?.panTo(pos);
      }
    },
    [onLocationChange]
  );

  const applyGeocode = useCallback(
    async (opts?: { force?: boolean; source?: "auto" | "button" }) => {
      const force = opts?.force ?? false;
      const source = opts?.source ?? "button";
      const areaTrim = area.trim();
      const addressTrim = address.trim();
      const cityTrim = city.trim();
      if (!cityTrim) return false;

      // Need at least city+area for a useful pin (city-only stays on city center).
      if (!areaTrim && !force) return false;

      const queryKey = `${cityTrim}|${areaTrim}|${addressTrim}`.toLowerCase();
      if (!force && queryKey === lastAutoQueryRef.current) return false;

      setGeocoding(true);
      setGeocodeHint(null);
      try {
        const keyForGeocode = useGoogle ? apiKey : undefined;
        // Prefer society/area first — street text alone often mis-resolves in PK.
        let result = await geocodeAddressLine(
          cityTrim,
          areaTrim,
          addressTrim || undefined,
          keyForGeocode
        );
        if (!result && addressTrim && areaTrim) {
          result = await geocodeAddressLine(cityTrim, areaTrim, undefined, keyForGeocode);
        }
        if (!result) {
          if (source === "button") {
            setGeocodeHint("Could not find that address — drag the pin or enter coordinates.");
          }
          return false;
        }
        lastAutoQueryRef.current = queryKey;
        if (source === "auto") manualPinRef.current = false;
        setPin(result.lat, result.lng);
        setGeocodeHint(
          source === "auto"
            ? `Map moved to: ${result.label} (auto from city / society). Drag to fine-tune.`
            : `Pinned: ${result.label}`
        );
        seededRef.current = true;
        return true;
      } catch {
        if (source === "button") {
          setGeocodeHint("Geocoding failed. Try again or set the pin manually.");
        }
        return false;
      } finally {
        setGeocoding(false);
      }
    },
    [address, apiKey, area, city, setPin, useGoogle]
  );

  // Seed city center once if no coords yet (before area geocode lands).
  useEffect(() => {
    if (seededRef.current) return;
    if (latitude != null && longitude != null) {
      seededRef.current = true;
      return;
    }
    const center = defaultCenterForCity(city);
    onLocationChange(center.lat, center.lng);
    seededRef.current = true;
  }, [city, latitude, longitude, onLocationChange]);

  // When city or society/area (or street) changes, auto-move pin to that place.
  useEffect(() => {
    if (!area.trim()) return;
    // Don't fight the user after they dragged the pin — unless city/area text changed.
    const queryKey = `${city.trim()}|${area.trim()}|${address.trim()}`.toLowerCase();
    const areaOrCityChanged =
      lastAutoQueryRef.current === "" ||
      lastAutoQueryRef.current.split("|").slice(0, 2).join("|") !==
        queryKey.split("|").slice(0, 2).join("|");
    if (manualPinRef.current && !areaOrCityChanged) return;

    const timer = setTimeout(() => {
      void applyGeocode({ source: "auto" });
    }, 700);
    return () => clearTimeout(timer);
  }, [city, area, address, applyGeocode]);

  useEffect(() => {
    if (!useGoogle || !googleContainerRef.current) return;

    let cancelled = false;
    let authCheckTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        await loadGoogleMapsScript(apiKey!);
        if (cancelled || !googleContainerRef.current) return;
        if (isGoogleMapsUnavailable()) {
          fallbackToOsm("auth flagged before map init");
          return;
        }

        const initial = { lat: effectiveLat, lng: effectiveLng };

        const map = new google.maps.Map(googleContainerRef.current, {
          center: initial,
          zoom: latitude != null ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const marker = new google.maps.Marker({
          map,
          position: initial,
          draggable: true,
        });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          manualPinRef.current = true;
          onLocationChange(pos.lat(), pos.lng());
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          manualPinRef.current = true;
          marker.setPosition(pos);
          onLocationChange(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);

        // Auth failures often fire shortly after Map construction.
        authCheckTimer = setTimeout(() => {
          if (cancelled) return;
          if (isGoogleMapsUnavailable()) {
            fallbackToOsm("gm_authFailure after map init");
          }
        }, 1500);
      } catch (e) {
        if (!cancelled) {
          fallbackToOsm(e instanceof Error ? e.message : "Google Maps load failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (authCheckTimer) clearTimeout(authCheckTimer);
    };
  }, [
    useGoogle,
    apiKey,
    effectiveLat,
    effectiveLng,
    latitude,
    onLocationChange,
    fallbackToOsm,
  ]);

  useEffect(() => {
    if (useGoogle || !osmContainerRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !osmContainerRef.current) return;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
          leafletMarkerRef.current = null;
        }

        const map = L.map(osmContainerRef.current, { scrollWheelZoom: true }).setView(
          [effectiveLat, effectiveLng],
          latitude != null ? 16 : 12
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([effectiveLat, effectiveLng], { draggable: true }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          manualPinRef.current = true;
          onLocationChange(pos.lat, pos.lng);
        });

        map.on("click", (e: L.LeafletMouseEvent) => {
          manualPinRef.current = true;
          marker.setLatLng(e.latlng);
          onLocationChange(e.latlng.lat, e.latlng.lng);
        });

        leafletMapRef.current = map;
        leafletMarkerRef.current = marker;
        setMapReady(true);

        requestAnimationFrame(() => map.invalidateSize());
      } catch {
        if (!cancelled) setMapError("Could not load the map.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useGoogle, effectiveLat, effectiveLng, latitude, onLocationChange]);

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    setPin(latitude, longitude);
  }, [latitude, longitude, setPin]);

  const pinFromAddress = async () => {
    manualPinRef.current = false;
    lastAutoQueryRef.current = "";
    await applyGeocode({ force: true, source: "button" });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        Enter society / area — the map jumps there automatically. Drag the pin for the exact house.
        Or tap <span className="font-semibold text-slate-700">Pin from address</span>. Verifiers
        always see this pin; customers only when the checkbox below is on.
      </p>

      {!apiKey && (
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Using OpenStreetMap (no Google API key). Add{" "}
          <code className="text-[10px] bg-white px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          in <code className="text-[10px] bg-white px-1 rounded">apps/web/.env.local</code> for Google
          Maps.
        </p>
      )}

      {mapError && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {mapError}
        </p>
      )}

      <div className="relative rounded-xl overflow-hidden border border-slate-200 h-64 bg-slate-100">
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          </div>
        )}
        {useGoogle ? (
          <div ref={googleContainerRef} className="w-full h-full" />
        ) : (
          <div ref={osmContainerRef} className="w-full h-full z-0" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void pinFromAddress()}
          disabled={geocoding || !area.trim()}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-3 py-2 rounded-xl transition"
        >
          {geocoding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          Pin from address
        </button>
        <button
          type="button"
          onClick={() => {
            const c = defaultCenterForCity(city);
            setPin(c.lat, c.lng);
            setGeocodeHint(`Reset to ${city} city center — refine by dragging the pin.`);
          }}
          className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
        >
          Use city center
        </button>
      </div>
      {geocodeHint && <p className="text-[11px] text-slate-600">{geocodeHint}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700">Latitude</label>
          <input
            type="number"
            step="any"
            value={latitude ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              onLocationChange(v, longitude ?? defaultCenterForCity(city).lng);
            }}
            className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700">Longitude</label>
          <input
            type="number"
            step="any"
            value={longitude ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              onLocationChange(latitude ?? defaultCenterForCity(city).lat, v);
            }}
            className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono"
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
        <input
          type="checkbox"
          checked={showPinToCustomers}
          onChange={(e) => onShowPinChange(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
        />
        <span className="text-xs text-slate-700">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            Show pin location to customers
          </span>
          <span className="block text-slate-500 mt-0.5">
            When off, buyers see area and city only on the public listing. Your verifier and visit
            calendar always use the exact pin.
          </span>
        </span>
      </label>
    </div>
  );
}
