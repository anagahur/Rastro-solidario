import type { ReactNode } from "react";
import { corta, urlDireccion, urlTx } from "../lib/formato";

export function Direccion({ valor, nombre }: { valor?: string; nombre?: string }) {
  if (!valor) return <span className="text-neutro-400">—</span>;
  const url = urlDireccion(valor);
  const contenido = (
    <>
      {nombre && <span className="font-medium text-neutro-800">{nombre} </span>}
      <span className="font-mono text-xs text-neutro-500">{corta(valor)}</span>
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
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-marca-700 hover:underline">
      {texto} ↗
    </a>
  ) : (
    <span className="font-mono text-xs text-neutro-400" title={hash}>
      {corta(hash, 6)}
    </span>
  );
}

// [fondo y texto, color del punto]
const COLORES: Record<string, [string, string]> = {
  Recaudando: ["bg-info-50 text-info-800 ring-info-200", "bg-info-500"],
  "En ejecución": ["bg-alerta-50 text-alerta-800 ring-alerta-200", "bg-alerta-500"],
  Finalizada: ["bg-exito-50 text-exito-800 ring-exito-200", "bg-exito-500"],
  Reembolso: ["bg-peligro-50 text-peligro-800 ring-peligro-200", "bg-peligro-500"],
  Pendiente: ["bg-neutro-100 text-neutro-600 ring-neutro-200", "bg-neutro-400"],
  Propuesta: ["bg-alerta-50 text-alerta-800 ring-alerta-200", "bg-alerta-500"],
  Aprobada: ["bg-marca-50 text-marca-800 ring-marca-200", "bg-marca-500"],
  Pagada: ["bg-exito-50 text-exito-800 ring-exito-200", "bg-exito-500"],
  Rechazada: ["bg-peligro-50 text-peligro-800 ring-peligro-200", "bg-peligro-500"],
  "No se pagará": ["bg-info-50 text-info-800 ring-info-200", "bg-info-500"],
  "Esperando a la comunidad": ["bg-comunidad-50 text-comunidad-800 ring-comunidad-200", "bg-comunidad-500"],
  Sobrecosto: ["bg-peligro-600 text-white ring-peligro-700", "bg-white"],
};

export function Insignia({ texto }: { texto: string }) {
  const [tono, punto] = COLORES[texto] ?? ["bg-neutro-100 text-neutro-700 ring-neutro-200", "bg-neutro-400"];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tono}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${punto}`} aria-hidden />
      {texto}
    </span>
  );
}

export function Seccion({ titulo, descripcion, children, accion }: { titulo: string; descripcion?: ReactNode; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="tarjeta">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-neutro-900">{titulo}</h2>
          {descripcion && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutro-500">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutro-300 bg-neutro-50/70 px-6 py-8 text-center text-sm leading-relaxed text-neutro-500">{children}</div>;
}

export function Barra({ valor, className = "bg-gradient-to-r from-marca-500 to-marca-700" }: { valor: number; className?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutro-200/80" role="progressbar" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${className}`} style={{ width: `${Math.min(100, valor)}%` }} />
    </div>
  );
}
