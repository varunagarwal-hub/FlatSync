"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { overlapZone } from "@/lib/geo";

export interface MapCircle {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  color: string;
}

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

/**
 * Leaflet map with members' radius circles, the zone inside all of them,
 * and optional pins. Leaflet touches `window`, so it loads in an effect.
 */
export function MapView({
  circles,
  pins = [],
  showOverlap = true,
  height = 360,
}: {
  circles: MapCircle[];
  pins?: MapPin[];
  showOverlap?: boolean;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({ circles, pins, showOverlap });

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const c of circles) {
        L.circle([c.lat, c.lng], {
          radius: c.radiusKm * 1000,
          color: c.color,
          weight: 2,
          fillColor: c.color,
          fillOpacity: 0.06,
        })
          .bindTooltip(`${c.name}: ${c.radiusKm} km`)
          .addTo(map);
        L.circleMarker([c.lat, c.lng], { radius: 5, color: "#fff", weight: 2, fillColor: c.color, fillOpacity: 1 })
          .bindTooltip(`${c.name}'s anchor`)
          .addTo(map);
        // circle.getBounds() needs the map to have a view already; this doesn't
        bounds.extend(L.latLng(c.lat, c.lng).toBounds(c.radiusKm * 2000));
      }

      if (showOverlap && circles.length > 1) {
        const zone = overlapZone(circles);
        for (const poly of zone) {
          L.polygon(
            poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
            { color: "#0f766e", weight: 2.5, fillColor: "#14b8a6", fillOpacity: 0.32 },
          )
            .bindTooltip("Inside everyone's radius")
            .addTo(map);
        }
      }

      for (const p of pins) {
        L.circleMarker([p.lat, p.lng], { radius: 6, color: "#1c1917", weight: 1.5, fillColor: p.color, fillOpacity: 0.95 })
          .bindTooltip(p.label)
          .addTo(map);
        bounds.extend([p.lat, p.lng]);
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] });
      else map.setView([20.59, 78.96], 4); // India
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // `key` captures every prop that affects the drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={ref} style={{ height }} className="z-0 w-full overflow-hidden rounded-lg border border-stone-200" />;
}
