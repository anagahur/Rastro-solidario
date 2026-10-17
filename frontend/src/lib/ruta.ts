import { useEffect, useState } from "react";

/** Router mínimo por hash: #/donar, #/panel, #/rastreo/<campaña>/<donante>. Permite compartir enlaces. */
export function useRuta() {
  const leer = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [partes, setPartes] = useState<string[]>(leer);
  useEffect(() => {
    const f = () => setPartes(leer());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return partes;
}

export const navegar = (ruta: string) => {
  window.location.hash = ruta.startsWith("/") ? ruta : `/${ruta}`;
};
