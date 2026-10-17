import { useState } from "react";
import type { Address } from "viem";
import { Direccion, Seccion, Vacio } from "../componentes/Comunes";
import { tonoIndice } from "../componentes/Reputacion";
import { useActores, useAportesEnCampanas, useReputacion, type Reputacion } from "../lib/datos";
import { fecha, pesos } from "../lib/formato";

const PESTANAS = [
  { id: "fundaciones", texto: "Fundaciones" },
  { id: "proveedores", texto: "Proveedores" },
  { id: "verificadores", texto: "Verificadores" },
  { id: "empresas", texto: "Empresas aliadas" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

/**
 * Historial público de cada actor acumulado entre todas las campañas. Lo escriben solo los
 * contratos de las campañas oficiales: nadie puede inflarlo ni borrar un rechazo.
 */
export function VistaReputacion() {
  const actores = useActores();
  const [pestana, setPestana] = useState<Pestana>("proveedores");
  const lista = actores[pestana];
  const rep = useReputacion([...actores.fundaciones, ...actores.proveedores, ...actores.verificadores, ...actores.empresas].map((a) => a.cuenta));
  const aportes = useAportesEnCampanas(actores.empresas.map((e) => e.cuenta));
  const ordenada = [...lista].sort((a, b) => {
    if (pestana === "empresas") {
      const d = aportes(b.cuenta).total - aportes(a.cuenta).total;
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    }
    return (rep(b.cuenta)?.indice ?? -1) - (rep(a.cuenta)?.indice ?? -1);
  });

  return (
    <div className="space-y-6">
      <Seccion
        titulo="Reputación on-chain"
        descripcion={
          <>
            Antes de donar en la próxima emergencia, mira quién cumplió. El índice de confianza es <em>etapas pagadas ÷ (pagadas + rechazadas + vencidas + sobrecostos)</em>: un
            sobrecosto cuenta en contra aunque después se haya aprobado. Lo reportan los contratos de las campañas, no las personas.
          </>
        }
      >
        <div className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
          {PESTANAS.map((p) => (
            <button key={p.id} className={`rounded-lg px-3 py-2 ${pestana === p.id ? "bg-white text-teal-800 shadow-sm" : "text-stone-500"}`} onClick={() => setPestana(p.id)}>
              {p.texto} ({actores[p.id].length})
            </button>
          ))}
        </div>
      </Seccion>

      {ordenada.length === 0 ? (
        <Vacio>No hay actores registrados con este rol.</Vacio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordenada.map((a) => (
            <TarjetaActor key={a.cuenta} cuenta={a.cuenta} nombre={a.nombre} rep={rep(a.cuenta)} tipo={pestana} aporte={pestana === "empresas" ? aportes(a.cuenta) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaActor({ cuenta, nombre, rep, tipo, aporte }: { cuenta: Address; nombre: string; rep?: Reputacion; tipo: Pestana; aporte?: { total: bigint; campanas: number } }) {
  const indice = rep?.indice ?? null;
  const datos: [string, string | number][] =
    tipo === "fundaciones"
      ? [
          ["Campañas", rep?.campanas ?? 0],
          ["Finalizadas", rep?.finalizadas ?? 0],
          ["Con reembolso", rep?.enReembolso ?? 0],
          ["Etapas pagadas", rep?.etapasPagadas ?? 0],
          ["Rechazadas", rep?.etapasRechazadas ?? 0],
          ["Vencidas", rep?.etapasVencidas ?? 0],
          ["Sobrecostos", rep?.sobrecostos ?? 0],
          ["Ejecutado", pesos(rep?.monto ?? 0n)],
        ]
      : tipo === "proveedores"
        ? [
            ["Etapas pagadas", rep?.etapasPagadas ?? 0],
            ["Rechazadas", rep?.etapasRechazadas ?? 0],
            ["Vencidas", rep?.etapasVencidas ?? 0],
            ["Sobrecostos", rep?.sobrecostos ?? 0],
            ["Recibido", pesos(rep?.monto ?? 0n)],
          ]
        : tipo === "verificadores"
          ? [["Votos emitidos", rep?.votos ?? 0]]
          : [
              ["Campañas apoyadas", aporte?.campanas ?? 0],
              ["Aportado", `${pesos(aporte?.total ?? 0n)} MockCOP`],
            ];
  const mostrarIndice = tipo === "fundaciones" || tipo === "proveedores";

  return (
    <article className="tarjeta">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-stone-900">{nombre}</p>
          <Direccion valor={cuenta} />
        </div>
        {mostrarIndice && (
          <div className={`shrink-0 rounded-2xl px-3 py-2 text-center ${tonoIndice(indice)}`}>
            <p className="text-2xl font-bold leading-none">{indice === null ? "—" : `${Math.round(indice)}%`}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">confianza</p>
          </div>
        )}
      </div>
      {mostrarIndice && indice !== null && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-stone-200" aria-hidden>
          <div className="bg-emerald-500" style={{ flex: rep!.etapasPagadas }} />
          <div className="bg-rose-500" style={{ flex: rep!.etapasRechazadas }} />
          <div className="bg-amber-500" style={{ flex: rep!.etapasVencidas }} />
          <div className="bg-rose-800" style={{ flex: rep!.sobrecostos }} />
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {datos.map(([t, v]) => (
          <div key={t}>
            <dt className="text-xs text-stone-500">{t}</dt>
            <dd className={`font-semibold ${t === "Sobrecostos" && Number(v) > 0 ? "text-rose-700" : t === "Rechazadas" && Number(v) > 0 ? "text-rose-700" : "text-stone-900"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {tipo === "empresas" ? (
        <p className="mt-3 text-[11px] text-stone-400">{aporte && aporte.total > 0n ? "Donaciones a su nombre en las campañas oficiales." : "Sin aportes todavía"}</p>
      ) : (
        <p className="mt-3 text-[11px] text-stone-400">{rep && rep.ultimaActividad > 0n ? `Última actividad: ${fecha(rep.ultimaActividad)}` : "Sin actividad todavía"}</p>
      )}
    </article>
  );
}
