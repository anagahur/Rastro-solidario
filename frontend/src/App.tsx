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
import { VistaSostenibilidad } from "./vistas/Sostenibilidad";
import { VistaTarjetas } from "./vistas/Tarjetas";

const PESTANAS = [
  { ruta: "donar", texto: "Donar" },
  { ruta: "campana", texto: "Campaña pública" },
  { ruta: "rastreo", texto: "Rastrear mi donación" },
  { ruta: "reputacion", texto: "Reputación" },
  { ruta: "panel", texto: "Panel de actores" },
  { ruta: "sostenibilidad", texto: "Cómo nos sostenemos" },
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
    <div className="relative isolate min-h-screen">
      {/* Halo de marca detrás de la parte alta de la página */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-gradient-to-b from-marca-100/70 via-marca-50/40 to-transparent print:hidden" />

      <header className="sticky top-0 z-30 border-b border-neutro-200/70 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/donar" className="flex min-w-0 items-center gap-3">
            <img src="/favicon.svg" alt="" className="h-10 w-10 shrink-0 rounded-xl shadow-boton" />
            <div className="min-w-0">
              <p className="font-display text-[17px] font-extrabold leading-tight tracking-tight text-neutro-900">Rastro Solidario</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-neutro-500">
                <span className="hidden sm:inline">Cada peso, verificado por la comunidad</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutro-100 px-2 py-0.5 font-medium text-neutro-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-exito-500" />
                  {appChain.name}
                </span>
              </p>
            </div>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <CampanaAvisos />
            <Billetera />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]" aria-label="Secciones">
          {PESTANAS.map((p) => (
            <a
              key={p.ruta}
              href={`#/${p.ruta}${CON_CAMPANA.has(p.ruta) && campana ? `/${campana}` : ""}`}
              aria-current={vista === p.ruta ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${vista === p.ruta ? "bg-marca-700 text-white shadow-boton" : "text-neutro-500 hover:bg-neutro-100 hover:text-neutro-800"}`}
            >
              {p.texto}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8 print:max-w-none print:p-0">
        {!CONFIGURADO ? (
          <Aviso>
            Faltan las direcciones de los contratos en <code>frontend/.env</code>. Despliega con <code>pnpm deploy:local</code> o <code>pnpm deploy:monad</code>.
          </Aviso>
        ) : error ? (
          <Aviso>
            No se pudo leer la cadena ({appChain.name}). {ES_MONAD ? "Revisa tu conexión al RPC de Monad." : "¿Está corriendo Anvil (pnpm anvil) y desplegaste los contratos?"}
          </Aviso>
        ) : null}

        {vista !== "reputacion" && vista !== "tarjetas" && vista !== "sostenibilidad" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xl">
              {cargando ? <div className="h-[68px] animate-pulse rounded-xl bg-neutro-200/70" /> : <SelectorCampana campanas={campanas} seleccionada={campana} onCambiar={elegir} />}
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
        ) : vista === "sostenibilidad" ? (
          <VistaSostenibilidad />
        ) : vista === "reputacion" ? (
          <VistaReputacion />
        ) : vista === "tarjetas" ? (
          <VistaTarjetas campana={campana} />
        ) : (
          <VistaDonar campana={campana} />
        )}
      </main>

      <footer className="mt-6 border-t border-neutro-200/80 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs leading-relaxed text-neutro-500 sm:flex-row sm:items-start sm:gap-6">
          <p className="flex shrink-0 items-center gap-2 font-display text-sm font-bold text-neutro-700">
            <img src="/favicon.svg" alt="" className="h-6 w-6 rounded-md" />
            Rastro Solidario
          </p>
          <p className="max-w-3xl">
            Proyecto académico. MockCOP no tiene valor real y la pasarela Nequi/PSE es simulada. La cadena garantiza que el dinero se mueve según las reglas; que la entrega ocurrió lo
            atestiguan verificadores independientes con evidencia pública y las propias familias damnificadas.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="nota-alerta p-4">{children}</div>;
}
