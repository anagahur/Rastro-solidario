import type { Reputacion } from "../lib/datos";

/** Color del índice: verde ≥ 90, ámbar ≥ 60, rojo por debajo. */
export const tonoIndice = (i: number | null) =>
  i === null ? "bg-stone-100 text-stone-600" : i >= 90 ? "bg-emerald-100 text-emerald-800" : i >= 60 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

/** Insignia compacta: "Confianza 92 % · 12 etapas". */
export function InsigniaConfianza({ rep, rol = "actor" }: { rep?: Reputacion; rol?: "fundacion" | "proveedor" | "actor" }) {
  if (!rep) return null;
  if (rep.indice === null) {
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tonoIndice(null)}`}>Sin historial</span>;
  }
  const extra = rol === "fundacion" && rep.campanas > 0 ? ` · ${rep.campanas} campañas` : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tonoIndice(rep.indice)}`}
      title={`${rep.etapasPagadas} etapas pagadas, ${rep.etapasRechazadas} rechazadas, ${rep.etapasVencidas} vencidas, ${rep.sobrecostos} con sobrecosto (historial on-chain)`}
    >
      Confianza {Math.round(rep.indice)} %<span className="font-normal opacity-80">· {rep.evaluadas} hechos{extra}</span>
      {rep.sobrecostos > 0 && <span className="ml-0.5 rounded bg-rose-600 px-1 text-white">{rep.sobrecostos} sobrecosto{rep.sobrecostos > 1 ? "s" : ""}</span>}
    </span>
  );
}
