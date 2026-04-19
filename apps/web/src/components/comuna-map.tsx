"use client";

import { useMemo, type ReactNode } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type LeafletComponent = (
  props: Record<string, unknown> & { children?: ReactNode },
) => JSX.Element;

const LeafletMapContainer = MapContainer as unknown as LeafletComponent;
const LeafletTileLayer = TileLayer as unknown as LeafletComponent;
const LeafletCircleMarker = CircleMarker as unknown as LeafletComponent;
const Tooltip = LeafletTooltip as unknown as LeafletComponent;

export type ComunaMapPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  pqrCount: number;
  suppressed: boolean;
};

/**
 * Choropleth-lite: one circle marker per comuna, radius proportional to PQR
 * volume. Renders OpenStreetMap tiles. Accompanied by a keyboard-navigable
 * `<table>` (rendered by the parent page) for non-visual users.
 *
 * NOTE: must be imported with `dynamic(..., { ssr: false })` — Leaflet relies
 * on `window`.
 */
export function ComunaMap({
  points,
  ariaLabel,
}: {
  points: ComunaMapPoint[];
  ariaLabel: string;
}) {
  const maxCount = useMemo(
    () => Math.max(1, ...points.map((p) => p.pqrCount)),
    [points],
  );

  // Medellín centroid.
  const center: [number, number] = [6.2442, -75.5812];

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="relative h-[420px] w-full overflow-hidden rounded border border-stone-200"
    >
      <LeafletMapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <LeafletTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {points.map((p) => {
          const radius = scale(p.pqrCount, maxCount);
          const color = p.suppressed
            ? "rgb(120 113 108)"
            : tone(p.pqrCount / maxCount);
          return (
            <LeafletCircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.55,
                weight: 1.5,
              }}
            >
              <Tooltip direction="top" opacity={1}>
                <div className="text-xs">
                  <div className="font-semibold">{p.label}</div>
                  <div>
                    {p.suppressed
                      ? "Dato suprimido por privacidad (k-anon)"
                      : `${p.pqrCount.toLocaleString("es-CO")} PQR`}
                  </div>
                </div>
              </Tooltip>
            </LeafletCircleMarker>
          );
        })}
      </LeafletMapContainer>
    </div>
  );
}

function scale(v: number, max: number): number {
  if (max <= 0) return 4;
  const t = Math.max(0, Math.min(1, v / max));
  return 5 + t * 18; // 5 .. 23 px radius
}

function tone(t: number): string {
  // emerald-700 → rose-700 linear mix for contrast AA+.
  const mix = Math.max(0, Math.min(1, t));
  // emerald-700: 4 120 87 ; rose-700: 190 18 60
  const r = Math.round(4 + (190 - 4) * mix);
  const g = Math.round(120 + (18 - 120) * mix);
  const b = Math.round(87 + (60 - 87) * mix);
  return `rgb(${r} ${g} ${b})`;
}
