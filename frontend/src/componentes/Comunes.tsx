import type { ReactNode } from "react";
import { corta, urlDireccion, urlTx } from "../lib/formato";

export function Direccion({ valor, nombre }: { valor?: string; nombre?: string }) {
  if (!valor) return <span className="text-stone-400">—</span>;
  const url = urlDireccion(valor);
  const contenido = (
    <>
      {nombre && <span className="font-medium text-stone-800">{nombre} </span>}
      <span className="font-mono text-xs text-stone-500">{corta(valor)}</span>
    </>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="hover:underline" title={valor}>
      {contenido}
    </a>
  ) : (
    <span title={valor}>{contenido}</span>
  );
}

export function EnlaceTx({ hash, texto = "ver tx" }: { hash?: string; texto?: string }) {
  if (!hash) return null;
  const url = urlTx(hash);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal-700 hover:underline">
      {texto} ↗
    </a>
  ) : (
    <span className="font-mono text-xs text-stone-400" title={hash}>
      {corta(hash, 6)}
    </span>
  );
}

const COLORES: Record<string, string> = {
  Recaudando: "bg-sky-100 text-sky-800",
  "En ejecución": "bg-amber-100 text-amber-800",
  Finalizada: "bg-emerald-100 text-emerald-800",
  Reembolso: "bg-rose-100 text-rose-800",
  Pendiente: "bg-stone-100 text-stone-600",
  Propuesta: "bg-amber-100 text-amber-800",
  Aprobada: "bg-teal-100 text-teal-800",
  Pagada: "bg-emerald-100 text-emerald-800",
  Rechazada: "bg-rose-100 text-rose-800",
  "No se pagará": "bg-sky-100 text-sky-800",
  "Esperando a la comunidad": "bg-violet-100 text-violet-800",
  Sobrecosto: "bg-rose-600 text-white",
};

export function Insignia({ texto }: { texto: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORES[texto] ?? "bg-stone-100 text-stone-700"}`}>
      {texto}
    </span>
  );
}

export function Seccion({ titulo, descripcion, children, accion }: { titulo: string; descripcion?: ReactNode; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="tarjeta">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">{titulo}</h2>
          {descripcion && <p className="mt-1 text-sm text-stone-500">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</div>;
}

export function Barra({ valor, className = "bg-teal-600" }: { valor: number; className?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${Math.min(100, valor)}%` }} />
    </div>
  );
}
