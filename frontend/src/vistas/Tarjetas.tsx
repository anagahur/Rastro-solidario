import { useState } from "react";
import type { Address } from "viem";
import { Qr } from "../componentes/Qr";
import { Vacio } from "../componentes/Comunes";
import { useCampana } from "../lib/datos";
import { enlaceRecibir, useTarjetas } from "../lib/tarjetas";

/** Hoja imprimible con las tarjetas QR de las familias del censo. */
export function VistaTarjetas({ campana }: { campana?: Address }) {
  const { info } = useCampana(campana);
  const { data: tarjetas, isLoading } = useTarjetas(campana);
  const [base, setBase] = useState(() => window.location.origin);
  const esLocal = /localhost|127\.0\.0\.1/.test(base);

  if (!campana) return <Vacio>Elige una campaña.</Vacio>;
  if (isLoading) return <div className="tarjeta h-40 animate-pulse" />;
  if (!tarjetas?.length) {
    return <Vacio>No hay tarjetas generadas en este navegador para esta campaña. Un verificador las genera desde el Panel → Censo de familias.</Vacio>;
  }

  return (
    <div className="space-y-4">
      <section className="tarjeta space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-neutro-900">Tarjetas de las familias · {info?.nombre}</h1>
            <p className="text-sm text-neutro-500">
              {tarjetas.length} tarjetas. Cada QR abre la confirmación de entrega en el celular de la familia. Guárdalas como un documento: quien tenga la tarjeta puede confirmar por esa
              familia.
            </p>
          </div>
          <button className="btn-primario" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
        </div>
        <label className="block text-sm">
          <span className="etiqueta">Dirección de la app dentro del QR</span>
          <input className="campo font-mono" value={base} onChange={(e) => setBase(e.target.value.trim())} />
          {esLocal && (
            <span className="mt-1 block text-xs text-alerta-700">
              Para escanear con un celular en la misma red Wi-Fi usa la IP del computador (la muestra <code>pnpm dev</code> como «Network»), p. ej. http://192.168.1.20:5173
            </span>
          )}
        </label>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
        {tarjetas.map((t) => (
          <article key={t.cuenta} className="flex break-inside-avoid flex-col items-center rounded-2xl border-2 border-dashed border-marca-700 bg-white p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-marca-700">Rastro Solidario · Tarjeta de familia</p>
            <p className="mt-1 text-lg font-bold text-neutro-900">{t.nombre}</p>
            <p className="text-xs text-neutro-500">{info?.nombre}</p>
            <Qr texto={enlaceRecibir(base, campana, t.llave)} tamano={170} className="my-3" />
            <p className="text-sm text-neutro-700">Cuando recibas la ayuda, escanea este código con la cámara de tu celular y toca «Sí, la recibí».</p>
            <p className="mt-2 font-mono text-[10px] text-neutro-400">{t.cuenta}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
