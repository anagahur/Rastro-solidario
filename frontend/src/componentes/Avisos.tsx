import { useEffect, useRef, useState } from "react";
import { BOT_TELEGRAM } from "../config";
import { useAvisosDonante } from "../lib/avisos";

const ICONOS = { pago: "✓", reembolso: "↺", sobrecosto: "⚠", rechazo: "✕" };
const COLORES = {
  pago: "bg-exito-100 text-exito-800",
  reembolso: "bg-info-100 text-info-800",
  sobrecosto: "bg-peligro-600 text-white",
  rechazo: "bg-peligro-100 text-peligro-800",
};

/** Campanita de la cabecera: en qué se gastó tu plata, sin tener que entrar a buscarlo. */
export function CampanaAvisos() {
  const { avisos, noLeidos, marcarLeidos, cuentas } = useAvisosDonante();
  const [abierto, setAbierto] = useState(false);
  const [permiso, setPermiso] = useState(() => (typeof Notification === "undefined" ? "denied" : Notification.permission));
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  if (cuentas.length === 0) return null;

  return (
    <div className="relative" ref={caja}>
      <button
        className="relative rounded-full border border-neutro-200 bg-white p-2 text-neutro-600 hover:bg-neutro-50"
        aria-label={`Avisos${noLeidos ? `: ${noLeidos} nuevos` : ""}`}
        onClick={() => {
          setAbierto((x) => !x);
          if (!abierto) setTimeout(marcarLeidos, 1500);
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidos > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-peligro-600 px-1 text-[11px] font-bold text-white">{noLeidos}</span>}
      </button>
      {abierto && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-neutro-200 bg-white shadow-xl">
          <div className="border-b border-neutro-100 px-4 py-3">
            <p className="font-bold text-neutro-900">En qué se usó tu plata</p>
            <p className="text-xs text-neutro-500">
              Siguiendo {cuentas.length} {cuentas.length === 1 ? "cuenta" : "cuentas"} desde la cadena, sin servidor.
            </p>
          </div>
          <ul className="max-h-96 divide-y divide-neutro-100 overflow-y-auto">
            {avisos.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutro-500">Todavía no hay movimientos de tus donaciones.</li>}
            {avisos.map((a) => (
              <li key={a.id}>
                <a href={a.enlace} className="flex gap-3 px-4 py-3 hover:bg-neutro-50" onClick={() => setAbierto(false)}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${COLORES[a.tipo]}`}>{ICONOS[a.tipo]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutro-900">{a.titulo}</span>
                    <span className="block text-xs text-neutro-500">{a.detalle}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-neutro-100 bg-neutro-50 px-4 py-3 text-xs">
            {permiso !== "granted" && typeof Notification !== "undefined" && (
              <button className="btn-secundario w-full py-1.5 text-xs" onClick={() => Notification.requestPermission().then(setPermiso)}>
                🔔 Avisarme en este navegador
              </button>
            )}
            {BOT_TELEGRAM && cuentas[0] && (
              <a className="btn-secundario w-full py-1.5 text-xs" href={`https://t.me/${BOT_TELEGRAM}?start=${cuentas[0]}`} target="_blank" rel="noreferrer">
                ✈ Recibir avisos por Telegram
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
