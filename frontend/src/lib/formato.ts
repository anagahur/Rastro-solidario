import { formatEther, keccak256, toHex, type Address, type Hex } from "viem";
import { EXPLORER_URL } from "../config";

const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** 200000000000000000000000n → "200.000" */
export const pesos = (wei: bigint | undefined) => (wei === undefined ? "—" : fmt.format(Number(formatEther(wei))));

export const corta = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export const porcentaje = (parte: bigint, total: bigint) =>
  total === 0n ? 0 : Number((parte * 10_000n) / total) / 100;

export const urlTx = (hash?: string) => (hash && EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : undefined);
export const urlDireccion = (a?: string) => (a && EXPLORER_URL ? `${EXPLORER_URL}/address/${a}` : undefined);

/** Hash keccak256 de un archivo (factura, foto del acta). La evidencia queda pública y verificable. */
export async function hashArchivo(archivo: File): Promise<Hex> {
  return keccak256(new Uint8Array(await archivo.arrayBuffer()));
}
export const hashTexto = (t: string): Hex => keccak256(toHex(t));

export function tiempoRestante(fechaLimiteSeg: bigint | number, ahoraMs = Date.now()) {
  const s = Number(fechaLimiteSeg) - Math.floor(ahoraMs / 1000);
  if (s <= 0) return { vencido: true, texto: "vencido" };
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const texto = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min` : `${s} s`;
  return { vencido: false, texto };
}

export const fecha = (seg: bigint | number) =>
  new Date(Number(seg) * 1000).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

export const mismaDireccion = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const esDireccion = (a: string): a is Address => /^0x[0-9a-fA-F]{40}$/.test(a);

// Enums del contrato
export const ESTADO_CAMPANA = ["Recaudando", "En ejecución", "Finalizada", "Reembolso"] as const;
export const ESTADO_ETAPA = ["Pendiente", "Propuesta", "Esperando a la comunidad", "Pagada", "Rechazada"] as const;
export const MOTIVO_REEMBOLSO = ["", "una etapa fue rechazada", "venció el plazo de una etapa", "la fundación canceló la campaña"] as const;
/** Estado de etapa para mostrar: si la campaña está en reembolso, lo no pagado ya no se pagará. */
export const etiquetaEtapa = (estadoEtapa: number, estadoCampana: number) =>
  estadoCampana === 3 && estadoEtapa < 3 ? "No se pagará" : ESTADO_ETAPA[estadoEtapa];

export const VOTO = ["Sin votar", "Confirmó", "Rechazó"] as const;

/** Fecha corta: "16 oct" o "hoy". */
export function fechaCorta(seg: bigint | number) {
  const d = new Date(Number(seg) * 1000);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return "hoy";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/** Precio por unidad y si supera la referencia en más del 10 % (misma regla que el contrato). */
export function analizarPrecio(monto: bigint, unidades: number, referencia: bigint) {
  if (!unidades || referencia === 0n) return null;
  const unitario = monto / BigInt(unidades);
  const sobrecosto = unitario * 10_000n > referencia * 11_000n;
  const diferencia = Number(((unitario - referencia) * 10_000n) / referencia) / 100;
  return { unitario, sobrecosto, diferencia };
}
