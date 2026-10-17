// Evidencia visible: la factura, la foto de la entrega o el acta se suben al almacén IPFS y en la
// cadena queda `ipfs://<cid>` del documento + su keccak256. Cualquiera puede ver la foto y
// comprobar que el documento es exactamente el que se registró.
import { useQuery } from "@tanstack/react-query";
import { keccak256, type Hex } from "viem";
import { IPFS_GATEWAY } from "../config";

export interface Ubicacion {
  lat: number;
  lng: number;
  precisionM?: number;
  lugar?: string;
}

export interface ArchivoEvidencia {
  uri: string;
  nombre: string;
  tipo: string;
  keccak256: Hex;
}

export interface DocumentoEvidencia {
  tipo: "rastro-solidario/evidencia";
  version: 1;
  clase: "factura" | "acta" | "rechazo";
  campana: string;
  etapa: number;
  titulo: string;
  nota?: string;
  fecha: string;
  ubicacion: Ubicacion | null;
  archivos: ArchivoEvidencia[];
  autor?: string;
}

export interface Subida {
  cid: string;
  uri: string;
  keccak256: Hex;
  tipo: string;
  bytes: number;
  fijado: "local" | "pinata";
}

const CERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const hayHash = (h?: string) => !!h && h !== CERO32;

/**
 * ipfs://bafy... → URL para leerlo.
 * Con VITE_IPFS_GATEWAY (producción, evidencias fijadas en Pinata) se lee directo de IPFS y no
 * depende del servidor de la app; sin él, /ipfs/bafy... (el servidor lo sirve o redirige a un gateway).
 */
export function urlIpfs(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY || "/ipfs/"}${uri.slice(7)}`;
  if (uri.startsWith("http")) return uri;
  return undefined;
}

export async function subir(datos: Blob, tipo = datos.type || "application/octet-stream"): Promise<Subida> {
  const r = await fetch("/api/evidencias", { method: "POST", headers: { "content-type": tipo }, body: datos });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `No se pudo subir la evidencia (${r.status})`);
  return j as Subida;
}

/**
 * Sube los archivos y el documento que los describe. Devuelve lo que va a la cadena.
 */
export async function crearEvidencia(
  doc: Omit<DocumentoEvidencia, "tipo" | "version" | "archivos" | "fecha">,
  archivos: File[],
): Promise<{ hash: Hex; uri: string; documento: DocumentoEvidencia }> {
  const subidos: ArchivoEvidencia[] = [];
  for (const a of archivos) {
    const s = await subir(a, a.type || "application/octet-stream");
    subidos.push({ uri: s.uri, nombre: a.name, tipo: s.tipo, keccak256: s.keccak256 });
  }
  const documento: DocumentoEvidencia = { tipo: "rastro-solidario/evidencia", version: 1, ...doc, fecha: new Date().toISOString(), archivos: subidos };
  const s = await subir(new Blob([JSON.stringify(documento)], { type: "application/json" }), "application/json");
  return { hash: s.keccak256, uri: s.uri, documento };
}

export type EstadoIntegridad = "verificada" | "alterada" | "sin-documento";

export interface EvidenciaCargada {
  documento: DocumentoEvidencia | null;
  integridad: EstadoIntegridad;
}

/** Descarga el documento de evidencia y comprueba que su keccak256 coincide con la cadena. */
export async function cargarDocumento(uri: string, hashCadena?: string): Promise<EvidenciaCargada> {
  const r = await fetch(urlIpfs(uri)!);
  if (!r.ok) return { documento: null, integridad: "sin-documento" };
  const bytes = new Uint8Array(await r.arrayBuffer());
  const coincide = !hashCadena || keccak256(bytes).toLowerCase() === hashCadena.toLowerCase();
  try {
    const documento = JSON.parse(new TextDecoder().decode(bytes)) as DocumentoEvidencia;
    return { documento: documento?.tipo === "rastro-solidario/evidencia" ? documento : null, integridad: coincide ? "verificada" : "alterada" };
  } catch {
    return { documento: null, integridad: coincide ? "verificada" : "alterada" };
  }
}

export const consultaEvidencia = (uri?: string, hashCadena?: string) => ({
  queryKey: ["evidencia", uri, hashCadena],
  enabled: !!uri && uri.startsWith("ipfs://"),
  staleTime: Infinity,
  retry: 1,
  queryFn: () => cargarDocumento(uri!, hashCadena),
});

export function useDocumentoEvidencia(uri?: string, hashCadena?: string) {
  return useQuery(consultaEvidencia(uri, hashCadena));
}

/** Ubicación actual del dispositivo (con permiso). */
export function obtenerUbicacion(): Promise<Ubicacion> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Este navegador no permite obtener la ubicación"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)), precisionM: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? "No diste permiso de ubicación" : "No se pudo obtener la ubicación")),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  });
}

export const enlaceMapa = (u: Ubicacion) => `https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lng}#map=17/${u.lat}/${u.lng}`;
