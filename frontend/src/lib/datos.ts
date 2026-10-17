// Lecturas de contratos. Todo sale de funciones view (sin eventos), porque el RPC público de
// Monad testnet limita eth_getLogs a 100 bloques.
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { campanaEmergenciaAbi, campanaFactoryAbi, historialReputacionAbi, mockCOPAbi, registroActoresAbi } from "../abis";
import { CONFIGURADO, DIRECCIONES, REFRESCO_MS } from "../config";

const q = { refetchInterval: REFRESCO_MS };

export function useCampanas() {
  const lista = useReadContract({
    address: DIRECCIONES.factory,
    abi: campanaFactoryAbi,
    functionName: "campanas",
    query: { ...q, enabled: CONFIGURADO },
  });
  const direcciones = (lista.data ?? []) as readonly Address[];
  const infos = useReadContracts({
    contracts: direcciones.map((address) => ({ address, abi: campanaEmergenciaAbi, functionName: "info" }) as const),
    query: { ...q, enabled: direcciones.length > 0 },
  });
  const campanas = useMemo(
    () =>
      (infos.data ?? [])
        .map((r) => r.result)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .reverse(), // la más reciente primero
    [infos.data],
  );
  return { campanas, cargando: lista.isLoading || infos.isLoading, error: lista.error ?? infos.error };
}

export type InfoCampana = ReturnType<typeof useCampanas>["campanas"][number];

export function useCampana(direccion?: Address) {
  const habilitado = !!direccion;
  const base = { address: direccion, abi: campanaEmergenciaAbi } as const;
  const lecturas = useReadContracts({
    contracts: [
      { ...base, functionName: "info" },
      { ...base, functionName: "etapas" },
      { ...base, functionName: "matchings" },
    ],
    query: { ...q, enabled: habilitado },
  });
  const info = lecturas.data?.[0]?.result;
  const etapas = lecturas.data?.[1]?.result;
  const matchings = lecturas.data?.[2]?.result;
  const etapaActual = info?.etapaActual;

  const votos = useReadContract({
    ...base,
    functionName: "votos",
    args: [etapaActual ?? 0n],
    query: { ...q, enabled: habilitado && etapaActual !== undefined && etapas !== undefined && etapaActual < BigInt(etapas.length) },
  });

  const n = info?.numeroDonaciones ?? 0n;
  const desde = n > 8n ? n - 8n : 0n;
  const recientes = useReadContract({
    ...base,
    functionName: "donaciones",
    args: [desde, 8n],
    query: { ...q, enabled: habilitado && n > 0n },
  });

  return {
    info,
    etapas,
    matchings: matchings ?? [],
    votos: votos.data,
    recientes: [...(recientes.data ?? [])].reverse(),
    cargando: lecturas.isLoading,
    error: lecturas.error,
  };
}

/** Nombres públicos de actores desde el registro. */
export function useNombres(direcciones: readonly (Address | undefined)[]) {
  const unicas = [...new Set(direcciones.filter(Boolean).map((d) => d!.toLowerCase()))] as Address[];
  const r = useReadContracts({
    contracts: unicas.map((a) => ({ address: DIRECCIONES.registro, abi: registroActoresAbi, functionName: "nombre", args: [a] }) as const),
    query: { enabled: unicas.length > 0 && CONFIGURADO, staleTime: 30_000 },
  });
  return useMemo(() => {
    const m = new Map<string, string>();
    unicas.forEach((a, i) => {
      const nombre = r.data?.[i]?.result as string | undefined;
      if (nombre) m.set(a, nombre);
    });
    return (a?: string) => (a ? m.get(a.toLowerCase()) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.data, unicas.join()]);
}

export function useRoles(cuenta?: Address) {
  const reg = { address: DIRECCIONES.registro, abi: registroActoresAbi } as const;
  const r = useReadContracts({
    contracts: [
      { ...reg, functionName: "esFundacion", args: [cuenta!] },
      { ...reg, functionName: "esVerificador", args: [cuenta!] },
      { ...reg, functionName: "esProveedor", args: [cuenta!] },
      { ...reg, functionName: "hasRole", args: ["0x0000000000000000000000000000000000000000000000000000000000000000", cuenta!] },
      { ...reg, functionName: "esEmpresa", args: [cuenta!] },
    ],
    query: { ...q, enabled: !!cuenta && CONFIGURADO },
  });
  return {
    fundacion: r.data?.[0]?.result === true,
    verificador: r.data?.[1]?.result === true,
    proveedor: r.data?.[2]?.result === true,
    admin: r.data?.[3]?.result === true,
    empresa: r.data?.[4]?.result === true,
    cargando: r.isLoading,
  };
}

export function useActores() {
  const reg = { address: DIRECCIONES.registro, abi: registroActoresAbi } as const;
  const roles = useReadContracts({
    contracts: [
      { ...reg, functionName: "FUNDACION_ROLE" },
      { ...reg, functionName: "VERIFICADOR_ROLE" },
      { ...reg, functionName: "PROVEEDOR_ROLE" },
      { ...reg, functionName: "EMPRESA_ROLE" },
    ],
    query: { enabled: CONFIGURADO, staleTime: Infinity },
  });
  const [F, V, P, E] = (roles.data ?? []).map((x) => x.result as `0x${string}` | undefined);
  const listas = useReadContracts({
    contracts: [F, V, P, E].map((rol) => ({ ...reg, functionName: "actores", args: [rol!] }) as const),
    query: { ...q, enabled: !!F && !!V && !!P && !!E },
  });
  const aLista = (i: number) => {
    const res = listas.data?.[i]?.result as readonly [readonly Address[], readonly string[]] | undefined;
    return res ? res[0].map((cuenta, j) => ({ cuenta, nombre: res[1][j] })) : [];
  };
  return {
    roles: { fundacion: F, verificador: V, proveedor: P, empresa: E },
    fundaciones: aLista(0),
    verificadores: aLista(1),
    proveedores: aLista(2),
    empresas: aLista(3),
  };
}

export interface Reputacion {
  campanas: number;
  finalizadas: number;
  enReembolso: number;
  etapasPagadas: number;
  etapasRechazadas: number;
  etapasVencidas: number;
  sobrecostos: number;
  votos: number;
  ultimaActividad: bigint;
  monto: bigint;
  /** 0–100, o null si aún no tiene etapas evaluadas */
  indice: number | null;
  evaluadas: number;
}

/** Historial acumulado entre campañas (HistorialReputacion), leído en un solo multicall. */
export function useReputacion(direcciones: readonly (Address | undefined)[]) {
  const unicas = [...new Set(direcciones.filter(Boolean).map((d) => d!.toLowerCase()))] as Address[];
  const rep = { address: DIRECCIONES.reputacion, abi: historialReputacionAbi } as const;
  const r = useReadContracts({
    contracts: unicas.flatMap((a) => [
      { ...rep, functionName: "historial", args: [a] } as const,
      { ...rep, functionName: "indiceConfianza", args: [a] } as const,
    ]),
    query: { ...q, enabled: unicas.length > 0 && CONFIGURADO },
  });
  return useMemo(() => {
    const m = new Map<string, Reputacion>();
    unicas.forEach((a, i) => {
      const h = r.data?.[2 * i]?.result as Omit<Reputacion, "indice" | "evaluadas"> | undefined;
      const ind = r.data?.[2 * i + 1]?.result as readonly [number, number] | undefined;
      if (h && ind) m.set(a, { ...h, indice: ind[1] > 0 ? ind[0] / 100 : null, evaluadas: ind[1] });
    });
    return (a?: string) => (a ? m.get(a.toLowerCase()) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.data, unicas.join()]);
}

/** Todas las donaciones de una campaña (paginadas de a 300), incluidas las de matching. */
export function useTodasLasDonaciones(direccion?: Address, total?: bigint) {
  const cliente = usePublicClient();
  return useQuery({
    queryKey: ["donaciones", direccion, total?.toString()],
    enabled: !!cliente && !!direccion && total !== undefined && total > 0n,
    queryFn: async () => {
      const todas = [];
      for (let desde = 0n; desde < total!; desde += 300n) {
        todas.push(...(await cliente!.readContract({ address: direccion!, abi: campanaEmergenciaAbi, functionName: "donaciones", args: [desde, 300n] })));
      }
      return todas;
    },
  });
}

/** Votos (y evidencias) de todas las etapas de una campaña. */
export function useVotosTodas(direccion?: Address, numeroEtapas = 0) {
  const r = useReadContracts({
    contracts: Array.from({ length: numeroEtapas }, (_, i) => ({ address: direccion, abi: campanaEmergenciaAbi, functionName: "votos", args: [BigInt(i)] }) as const),
    query: { ...q, enabled: !!direccion && numeroEtapas > 0 },
  });
  return (r.data ?? []).map((x) => x.result as VotosEtapa | undefined);
}

/** [votos, hashes, uris, unidades contadas] de cada verificador, en el orden de info.verificadores */
export type VotosEtapa = readonly [readonly number[], readonly `0x${string}`[], readonly string[], readonly number[]];

export function useSaldoCop() {
  const { address } = useAccount();
  const r = useReadContract({
    address: DIRECCIONES.cop,
    abi: mockCOPAbi,
    functionName: "balanceOf",
    args: [address!],
    query: { ...q, enabled: !!address && CONFIGURADO },
  });
  return r.data as bigint | undefined;
}

/** Hora actual que se actualiza cada segundo (para contadores de plazo). */
export function useAhora(intervalo = 1000) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), intervalo);
    return () => clearInterval(t);
  }, [intervalo]);
  return ahora;
}
