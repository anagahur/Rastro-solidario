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
    exito: "border-emerald-300 bg-emerald-50 text-emerald-900",
    error: "border-rose-300 bg-rose-50 text-rose-900",
    info: "border-sky-300 bg-sky-50 text-sky-900",
  };

  return (
    <Ctx.Provider value={avisar}>
      <CtxQuitar.Provider value={quitar}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
          {avisos.map((a) => (
            <div key={a.id} className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg ${estilos[a.tipo]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{a.titulo}</p>
                  {a.detalle && <p className="mt-0.5 break-words text-sm opacity-90">{a.detalle}</p>}
                  {a.enlace && (
                    <a href={a.enlace} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium underline">
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
