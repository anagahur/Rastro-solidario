// Avisos al donante: "Hoy se usaron $60.000 de tu donación en mercados para «Inundación…»".
// Se calculan leyendo la cadena (sin servidor) para las cuentas que sigue este navegador:
// la wallet conectada, la billetera invisible y las que la persona decidió seguir.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { campanaEmergenciaAbi } from "../abis";
import { REFRESCO_MS } from "../config";
import { useBilleteraInvisible } from "./billeteraInvisible";
import { useCampanas, useNombres } from "./datos";
import { fechaCorta, pesos } from "./formato";

export interface AvisoDonante {
  id: string;
  fecha: number;
  tipo: "pago" | "matching" | "reembolso" | "sobrecosto" | "rechazo";
  titulo: string;
  detalle: string;
  enlace: string;
}

const VISTOS = "rastro:avisos-vistos";
const NOTIFICADOS = "rastro:avisos-notificados";
const SEGUIDAS = "rastro:cuentas-seguidas";

const leerSet = (k: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(k) || "[]"));
  } catch {
    return new Set<string>();
  }
};
const guardarSet = (k: string, s: Set<string>) => {
  try {
    localStorage.setItem(k, JSON.stringify([...s].slice(-500)));
  } catch {}
};

export function seguirCuenta(a: Address) {
  const s = leerSet(SEGUIDAS);
  s.add(a.toLowerCase());
  guardarSet(SEGUIDAS, s);
  window.dispatchEvent(new Event("rastro:seguidas"));
}

export function useCuentasSeguidas(): Address[] {
  const { address } = useAccount();
  const { direccion } = useBilleteraInvisible();
  const [seguidas, setSeguidas] = useState(() => leerSet(SEGUIDAS));
  useEffect(() => {
    const f = () => setSeguidas(leerSet(SEGUIDAS));
    window.addEventListener("rastro:seguidas", f);
    return () => window.removeEventListener("rastro:seguidas", f);
  }, []);
  return useMemo(() => {
    const todas = new Set([...(address ? [address.toLowerCase()] : []), ...(direccion ? [direccion.toLowerCase()] : []), ...seguidas]);
    return [...todas] as Address[];
  }, [address, direccion, seguidas]);
}

export function useAvisosDonante() {
  const cuentas = useCuentasSeguidas();
  const { campanas } = useCampanas();
  const etapasR = useReadContracts({
    contracts: campanas.map((c) => ({ address: c.direccion, abi: campanaEmergenciaAbi, functionName: "etapas" }) as const),
    query: { refetchInterval: REFRESCO_MS * 2, enabled: campanas.length > 0 && cuentas.length > 0 },
  });
  const pares = campanas.flatMap((c) => cuentas.map((cuenta) => ({ campana: c, cuenta })));
  const resumenes = useReadContracts({
    contracts: pares.map((p) => ({ address: p.campana.direccion, abi: campanaEmergenciaAbi, functionName: "resumenDonante", args: [p.cuenta] }) as const),
    query: { refetchInterval: REFRESCO_MS * 2, enabled: pares.length > 0 },
  });
  const proveedores = (etapasR.data ?? []).flatMap((r) => (r.result ?? []).map((e) => e.proveedor));
  const nombre = useNombres(proveedores);

  const avisos = useMemo(() => {
    const out: AvisoDonante[] = [];
    pares.forEach((p, k) => {
      const r = resumenes.data?.[k]?.result;
      const ci = campanas.indexOf(p.campana);
      const etapas = etapasR.data?.[ci]?.result;
      if (!r || !etapas || r.aporte === 0n) return;
      const c = p.campana;
      const enlace = `#/rastreo/${c.direccion}/${p.cuenta}`;
      const base = `${c.direccion}-${p.cuenta}`.toLowerCase();
      etapas.forEach((e, i) => {
        const parte = r.partePorEtapa[i];
        if (e.estado === 3 && parte > 0n) {
          const cuando = fechaCorta(e.fechaPago);
          out.push({
            id: `${base}-pago-${i}`,
            fecha: Number(e.fechaPago),
            tipo: "pago",
            titulo: `${cuando === "hoy" ? "Hoy" : `El ${cuando}`} se usaron $${pesos(parte)} de tu donación en ${e.descripcion.toLowerCase()}`,
            detalle: `Para «${c.nombre}» · pagado directo a ${nombre(e.proveedor) ?? "el proveedor"} tras verificar la entrega`,
            enlace,
          });
        }
        if (e.sobrecosto && e.fechaPropuesta > 0n) {
          out.push({
            id: `${base}-sobrecosto-${i}`,
            fecha: Number(e.fechaPropuesta),
            tipo: "sobrecosto",
            titulo: `⚠ Alerta de sobrecosto en ${e.descripcion.toLowerCase()}`,
            detalle: `«${c.nombre}»: la factura supera el precio de referencia; el contrato exige un verificador más.`,
            enlace: `#/campana/${c.direccion}`,
          });
        }
        if (e.estado === 4) {
          out.push({ id: `${base}-rechazo-${i}`, fecha: Number(c.fechaReembolso), tipo: "rechazo", titulo: `La etapa ${e.descripcion.toLowerCase()} fue rechazada`, detalle: `«${c.nombre}»: los verificadores dijeron que la entrega no ocurrió.`, enlace });
        }
      });
      if (r.matchingGenerado > 0n) {
        out.push({
          id: `${base}-matching`,
          fecha: Number(c.fechaRecaudoCerrado || c.fechaCreacion),
          tipo: "matching",
          titulo: `🎁 Tu donación se multiplicó: las empresas aliadas sumaron $${pesos(r.matchingGenerado)}`,
          detalle: `Para «${c.nombre}»`,
          enlace,
        });
      }
      if (r.reembolsable > 0n) {
        out.push({
          id: `${base}-reembolso`,
          fecha: Number(c.fechaReembolso),
          tipo: "reembolso",
          titulo: `Tienes $${pesos(r.reembolsable)} para reclamar`,
          detalle: `«${c.nombre}» pasó a reembolso: recupera tu parte de lo que no se gastó.`,
          enlace,
        });
      }
    });
    return out.sort((a, b) => b.fecha - a.fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumenes.data, etapasR.data, campanas, nombre, cuentas.join()]);

  const [vistos, setVistos] = useState(() => leerSet(VISTOS));
  const noLeidos = avisos.filter((a) => !vistos.has(a.id)).length;
  const marcarLeidos = useCallback(() => {
    const s = new Set([...vistos, ...avisos.map((a) => a.id)]);
    guardarSet(VISTOS, s);
    setVistos(s);
  }, [vistos, avisos]);

  // Notificación del navegador para avisos nuevos (si la persona dio permiso).
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notificados = leerSet(NOTIFICADOS);
    let cambio = false;
    for (const a of avisos) {
      if (notificados.has(a.id) || vistos.has(a.id)) continue;
      notificados.add(a.id);
      cambio = true;
      try {
        new Notification(a.titulo, { body: a.detalle, icon: "/favicon.svg", tag: a.id });
      } catch {}
    }
    if (cambio) guardarSet(NOTIFICADOS, notificados);
  }, [avisos, vistos]);

  return { avisos, noLeidos, marcarLeidos, cuentas };
}
