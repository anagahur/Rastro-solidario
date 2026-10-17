import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tipo = "exito" | "error" | "info";
interface Aviso {
  id: number;
  tipo: Tipo;
  titulo: string;
  detalle?: string;
  enlace?: string;
}

const Ctx = createContext<(tipo: Tipo, titulo: string, detalle?: string, enlace?: string) => number>(() => 0);
const CtxQuitar = createContext<(id: number) => void>(() => {});

let siguienteId = 1;

export function ProveedorNotificaciones({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const quitar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback(
    (tipo: Tipo, titulo: string, detalle?: string, enlace?: string) => {
      const id = siguienteId++;
      setAvisos((a) => [...a.slice(-3), { id, tipo, titulo, detalle, enlace }]);
      if (tipo !== "info") setTimeout(() => quitar(id), tipo === "error" ? 9000 : 6000);
      return id;
    },
    [quitar],
  );

  const estilos: Record<Tipo, string> = {
    exito: "bg-exito-600",
    error: "bg-peligro-600",
    info: "bg-info-600",
  };
  const iconos: Record<Tipo, string> = { exito: "✓", error: "!", info: "i" };

  return (
    <Ctx.Provider value={avisar}>
      <CtxQuitar.Provider value={quitar}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
          {avisos.map((a) => (
            <div key={a.id} className="pointer-events-auto w-full max-w-sm rounded-2xl border border-neutro-200/80 bg-white px-4 py-3.5 text-neutro-800 shadow-elevada">
              <div className="flex items-start justify-between gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${estilos[a.tipo]}`} aria-hidden>
                  {iconos[a.tipo]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutro-900">{a.titulo}</p>
                  {a.detalle && <p className="mt-0.5 break-words text-sm text-neutro-600">{a.detalle}</p>}
                  {a.enlace && (
                    <a href={a.enlace} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-marca-700 hover:underline">
                      Ver en el explorador ↗
                    </a>
                  )}
                </div>
                <button onClick={() => quitar(a.id)} className="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Cerrar">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </CtxQuitar.Provider>
    </Ctx.Provider>
  );
}

export const useAvisar = () => useContext(Ctx);
export const useQuitarAviso = () => useContext(CtxQuitar);
