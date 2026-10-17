// Tarjetas de las familias damnificadas. Cada tarjeta tiene un QR con una llave: con ella la
// familia firma "recibí la ayuda" sin tener cripto ni pagar gas. Las llaves solo existen en las
// tarjetas impresas (y en este navegador, para reimprimirlas): la cadena guarda únicamente la
// dirección pública de cada familia.
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID } from "../config";

export interface Tarjeta {
  nombre: string;
  cuenta: Address;
  llave: Hex;
}

const clave = (campana: string) => `rastro:tarjetas:${CHAIN_ID}:${campana.toLowerCase()}`;

export function generarTarjetas(cantidad: number, prefijo: string, desde = 1): Tarjeta[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const llave = generatePrivateKey();
    return { nombre: `${prefijo} ${String(desde + i).padStart(2, "0")}`, cuenta: privateKeyToAccount(llave).address, llave };
  });
}

export function guardarTarjetas(campana: string, nuevas: Tarjeta[]) {
  try {
    const previas = leerLocales(campana);
    localStorage.setItem(clave(campana), JSON.stringify([...previas, ...nuevas]));
  } catch {}
}

function leerLocales(campana: string): Tarjeta[] {
  try {
    return JSON.parse(localStorage.getItem(clave(campana)) || "[]");
  } catch {
    return [];
  }
}

/** Tarjetas generadas en este navegador + las de la simulación (familias-demo.json, solo local). */
export function useTarjetas(campana?: string) {
  return useQuery({
    queryKey: ["tarjetas", campana],
    enabled: !!campana,
    queryFn: async () => {
      const locales = leerLocales(campana!);
      let demo: Tarjeta[] = [];
      try {
        const r = await fetch("/familias-demo.json", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j.chainId === CHAIN_ID && String(j.campana).toLowerCase() === campana!.toLowerCase()) demo = j.familias;
        }
      } catch {}
      const vistas = new Set(locales.map((t) => t.cuenta.toLowerCase()));
      return [...demo.filter((t) => !vistas.has(t.cuenta.toLowerCase())), ...locales];
    },
  });
}

/** Enlace del QR. `base` permite usar la IP del computador para que el celular lo abra. */
export const enlaceRecibir = (base: string, campana: string, llave: string) => `${base.replace(/\/$/, "")}/#/recibir/${campana}/${llave}`;
