import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PuntoMapa {
  lat: number;
  lng: number;
  titulo: string;
  detalle?: string;
  imagen?: string;
  tipo: "factura" | "acta" | "rechazo";
}

const COLORES = { factura: "#0f766e", acta: "#16a34a", rechazo: "#e11d48" };

/** Mapa de entregas (OpenStreetMap). Cada punto es una evidencia con ubicación GPS. */
export function Mapa({ puntos, alto = 320 }: { puntos: PuntoMapa[]; alto?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    mapa.current = L.map(caja.current, { scrollWheelZoom: false, attributionControl: true }).setView([4.6, -74.1], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    const limites: L.LatLngExpression[] = [];
    for (const p of puntos) {
      const m = L.circleMarker([p.lat, p.lng], { radius: 9, color: "#fff", weight: 2, fillColor: COLORES[p.tipo], fillOpacity: 0.95 });
      const cont = document.createElement("div");
      cont.style.maxWidth = "220px";
      const t = document.createElement("strong");
      t.textContent = p.titulo;
      cont.appendChild(t);
      if (p.detalle) {
        const d = document.createElement("div");
        d.textContent = p.detalle;
        d.style.fontSize = "12px";
        cont.appendChild(d);
      }
      if (p.imagen) {
        const img = document.createElement("img");
        img.src = p.imagen;
        img.style.cssText = "margin-top:6px;width:100%;border-radius:8px";
        cont.appendChild(img);
      }
      m.bindPopup(cont);
      m.addTo(capa.current);
      limites.push([p.lat, p.lng]);
    }
    if (limites.length === 1) mapa.current.setView(limites[0], 15);
    else if (limites.length > 1) mapa.current.fitBounds(L.latLngBounds(limites), { padding: [30, 30], maxZoom: 16 });
  }, [puntos]);

  return <div ref={caja} style={{ height: alto }} className="z-0 w-full overflow-hidden rounded-xl border border-neutro-200" />;
}
