declare namespace L {
  class Map {
    constructor(el: HTMLElement, options?: { scrollWheelZoom?: boolean });
    setView(latlng: [number, number], zoom: number): this;
    panTo(latlng: [number, number]): this;
    on(event: string, handler: (e: LeafletMouseEvent) => void): this;
    invalidateSize(): this;
    remove(): this;
  }
  class Marker {
    constructor(latlng: [number, number], options?: { draggable?: boolean });
    addTo(map: Map): this;
    setLatLng(latlng: LatLng | [number, number]): this;
    getLatLng(): LatLng;
    on(event: string, handler: () => void): this;
  }
  interface LatLng {
    lat: number;
    lng: number;
  }
  interface LeafletMouseEvent {
    latlng: LatLng;
  }
  function map(el: HTMLElement, options?: { scrollWheelZoom?: boolean }): Map;
  function marker(latlng: [number, number], options?: { draggable?: boolean }): Marker;
  function tileLayer(url: string, options: Record<string, unknown>): { addTo(map: Map): void };
}

interface Window {
  L?: typeof L;
}
