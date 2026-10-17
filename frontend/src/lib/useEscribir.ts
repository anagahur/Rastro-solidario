import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, TransactionReceipt } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { CHAIN_ID } from "../config";
import { mensajeError } from "./errores";
import { urlTx } from "./formato";
import { useAvisar, useQuitarAviso } from "./notificaciones";

export interface LlamadaContrato {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** Texto corto de la acción, p. ej. "Donar" */
  etiqueta: string;
  /** Mensaje al confirmarse */
  exito?: string;
}

/**
 * Envía una transacción con las precauciones que pide Monad:
 *  1. Verifica la red y la cambia si hace falta (wagmi agrega Monad a MetaMask si no la tiene).
 *  2. Simula primero: si va a revertir, muestra el motivo en español sin abrir MetaMask.
 *  3. Fija el gas limit = estimación + 10 %. En Monad se cobra el gas LIMIT completo, y si
 *     MetaMask estimara por su cuenta podría poner un límite inflado.
 *  4. Espera el recibo y refresca todas las lecturas.
 */
export function useEscribir() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const cliente = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const qc = useQueryClient();
  const avisar = useAvisar();
  const quitar = useQuitarAviso();
  const [pendiente, setPendiente] = useState<string | null>(null);

  const ejecutar = useCallback(
    async (llamada: LlamadaContrato): Promise<TransactionReceipt | null> => {
      if (!address || !cliente) {
        avisar("error", "Conecta tu wallet primero");
        return null;
      }
      const { etiqueta, exito, ...params } = llamada;
      setPendiente(etiqueta);
      let aviso: number | undefined;
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = { ...params, account: address } as any;
        await cliente.simulateContract(p);
        const estimado = await cliente.estimateContractGas(p);
        const gas = estimado + estimado / 10n;

        aviso = avisar("info", `${etiqueta}…`, "Confirma la transacción en tu wallet.");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hash = await writeContractAsync({ ...(params as any), gas, chainId: CHAIN_ID });
        quitar(aviso);
        aviso = avisar("info", "Esperando confirmación…", `Tx ${hash.slice(0, 10)}…`, urlTx(hash));
        const recibo = await cliente.waitForTransactionReceipt({ hash });
        quitar(aviso);
        aviso = undefined;
        if (recibo.status !== "success") throw new Error("La transacción revirtió.");
        avisar("exito", exito ?? `${etiqueta}: listo`, undefined, urlTx(hash));
        await qc.invalidateQueries();
        return recibo;
      } catch (e) {
        if (aviso) quitar(aviso);
        avisar("error", `No se pudo completar: ${etiqueta}`, mensajeError(e));
        return null;
      } finally {
        setPendiente(null);
      }
    },
    [address, chainId, cliente, switchChainAsync, writeContractAsync, qc, avisar, quitar],
  );

  return { ejecutar, pendiente };
}
