// Modelo de sostenibilidad (diseño para la próxima versión del contrato): "tasa de éxito".
// Al cerrar el recaudo se aparta una reserva pequeña; sale al Fondo de Sostenibilidad solo en
// proporción a las etapas PAGADAS. Si una etapa se rechaza, esa parte vuelve a los donantes.
// La tasa baja cuanto mejor es la reputación on-chain de la fundación.
import type { Reputacion } from "./datos";

export const TRAMOS: { desde: number | null; texto: string; bps: number }[] = [
  { desde: 90, texto: "90 % o más", bps: 100 },
  { desde: 70, texto: "70 % a 89 %", bps: 150 },
  { desde: 0, texto: "Menos de 70 %", bps: 200 },
  { desde: null, texto: "Nueva, sin historial (periodo de prueba)", bps: 150 },
];

/** Tasa en puntos básicos (100 = 1 %) según el índice de confianza de la fundación. */
export function tasaBps(rep?: Reputacion): number {
  const i = rep?.indice ?? null;
  if (i === null) return 150;
  if (i >= 90) return 100;
  if (i >= 70) return 150;
  return 200;
}

export const textoTasa = (bps: number) => `${(bps / 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
