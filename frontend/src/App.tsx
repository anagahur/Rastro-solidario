import { useEffect, useState } from "react";
import type { Address } from "viem";
import { CampanaAvisos } from "./componentes/Avisos";
import { Billetera, SaldoYFaucet } from "./componentes/Billetera";
import { SelectorCampana } from "./componentes/Campana";
import { CONFIGURADO, ES_MONAD, appChain } from "./config";
import { useCampanas } from "./lib/datos";
import { esDireccion, mismaDireccion } from "./lib/formato";
import { navegar, useRuta } from "./lib/ruta";
import { VistaDonar } from "./vistas/Donar";
import { VistaPanel } from "./vistas/Panel";
import { VistaPublica } from "./vistas/Publica";
import { VistaRastreo } from "./vistas/Rastreo";
import { VistaRecibir } from "./vistas/Recibir";
import { VistaReputacion } from "./vistas/Reputacion";
import { VistaTarjetas } from "./vistas/Tarjetas";

const PESTANAS = [
  { ruta: "donar", texto: "Donar" },
  { ruta: "campana", texto: "Campaña pública" },
  { ruta: "rastreo", texto: "Rastrear mi donación" },
  { ruta: "reputacion", texto: "Reputación" },
  { ruta: "panel", texto: "Panel de actores" },
] as const;
type Vista = (typeof PESTANAS)[number]["ruta"] | "tarjetas";

/** Rutas que llevan la campaña en la URL: #/campana/<dir>, #/rastreo/<dir>/<donante>, #/tarjetas/<dir> */
const CON_CAMPANA = new Set(["campana", "rastreo", "tarjetas"]);
const CLAVE_CAMPANA = "rastro:campana";

export default function App() {
  const ruta = useRuta();
  // La página de las familias (QR) es independiente: sin cabecera, sin wallet, pensada para el celular.
  if (ruta[0] === "recibir") return <VistaRecibir campana={ruta[1]} llave={ruta[2]} />;
  return <Principal ruta={ruta} />;
}

function Principal({ ruta }: { ruta: string[] }) {
  const vista = (ruta[0] ?? "donar") as Vista;
  const { campanas, cargando, error } = useCampanas();

  // Campaña seleccionada: la de la URL, la recordada, o la más reciente.
  const [elegida, setElegida] = useState<Address | undefined>(() => {
    try {
      return (localStorage.getItem(CLAVE_CAMPANA) as Address) || undefined;
    } catch {
      return undefined;
    }
  });
  const deRuta = CON_CAMPANA.has(vista) && ruta[1] && esDireccion(ruta[1]) ? (ruta[1] as Address) : undefined;
  const existe = (a?: string) => campanas.some((c) => mismaDireccion(c.direccion, a));
  const campana = (existe(deRuta) && deRuta) || (existe(elegida) && elegida) || campanas[0]?.direccion;

  const elegir = (a: Address) => {
    setElegida(a);
    try {
      localStorage.setItem(CLAVE_CAMPANA, a);
    } catch {}
    if (CON_CAMPANA.has(vista)) navegar(`/${vista}/${a}${vista === "rastreo" && ruta[2] ? `/${ruta[2]}` : ""}`);
  };
  useEffect(() => {
    if (!ruta[0]) navegar("/donar");
  }, [ruta]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="#/donar" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-9 w-9" />
            <div>
              <p className="text-lg font-bold leading-tight text-stone-900">Rastro Solidario</p>
              <p className="text-xs text-stone-500">Cada peso, verificado por la comunidad · {appChain.name}</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <CampanaAvisos />
            <Billetera />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Secciones">
          {PESTANAS.map((p) => (
            <a
              key={p.ruta}
              href={`#/${p.ruta}${CON_CAMPANA.has(p.ruta) && campana ? `/${campana}` : ""}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${vista === p.ruta ? "border-teal-700 text-teal-800" : "border-transparent text-stone-500 hover:text-stone-800"}`}
            >
              {p.texto}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 print:max-w-none print:p-0">
        {!CONFIGURADO ? (
          <Aviso>
            Faltan las direcciones de los contratos en <code>frontend/.env</code>. Despliega con <code>pnpm deploy:local</code> o <code>pnpm deploy:monad</code>.
          </Aviso>
        ) : error ? (
          <Aviso>
            No se pudo leer la cadena ({appChain.name}). {ES_MONAD ? "Revisa tu conexión al RPC de Monad." : "¿Está corriendo Anvil (pnpm anvil) y desplegaste los contratos?"}
          </Aviso>
        ) : null}

        {vista !== "reputacion" && vista !== "tarjetas" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-lg">
              {cargando ? <div className="h-16 animate-pulse rounded-xl bg-stone-200" /> : <SelectorCampana campanas={campanas} seleccionada={campana} onCambiar={elegir} />}
            </div>
            <SaldoYFaucet />
          </div>
        )}

        {vista === "panel" ? (
          <VistaPanel campana={campana} onCampanaCreada={elegir} />
        ) : vista === "rastreo" ? (
          <VistaRastreo campana={campana} donanteRuta={ruta[2]} />
        ) : vista === "campana" ? (
          <VistaPublica campana={campana} />
        ) : vista === "reputacion" ? (
          <VistaReputacion />
        ) : vista === "tarjetas" ? (
          <VistaTarjetas campana={campana} />
        ) : (
          <VistaDonar campana={campana} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-stone-400 print:hidden">
        Proyecto académico. MockCOP no tiene valor real y la pasarela Nequi/PSE es simulada. La cadena garantiza que el dinero se mueve según las reglas; que la entrega ocurrió lo
        atestiguan verificadores independientes con evidencia pública y las propias familias damnificadas.
      </footer>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{children}</div>;
}
