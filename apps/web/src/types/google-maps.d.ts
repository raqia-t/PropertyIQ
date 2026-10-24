declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts: MapOptions);
    setCenter(latLng: LatLngLiteral): void;
    panTo(latLng: LatLngLiteral): void;
    setZoom(z: number): void;
    addListener(event: string, handler: (e: MapMouseEvent) => void): void;
  }
  class Marker {
    constructor(opts: { map: Map; position: LatLngLiteral; draggable?: boolean });
    setPosition(pos: LatLngLiteral): void;
    getPosition(): { lat(): number; lng(): number } | null;
    addListener(event: string, handler: () => void): void;
  }
  class Geocoder {
    geocode(
      request: GeocoderRequest,
      callback: (results: GeocoderResult[] | null, status: string) => void
    ): void;
  }
  interface GeocoderRequest {
    address?: string;
    location?: LatLngLiteral;
  }
  interface GeocoderResult {
    formatted_address: string;
    geometry: { location: { lat(): number; lng(): number } };
  }
  interface MapOptions {
    center: LatLngLiteral;
    zoom: number;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  }
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }
  interface MapMouseEvent {
    latLng: { lat(): number; lng(): number } | null;
  }
}

interface Window {
  google?: { maps: typeof google.maps };
  /** Set by Google Maps JS when the API key is rejected. */
  gm_authFailure?: () => void;
}
