import { createPublicClient, type PublicClient } from "viem";
import { ES_MONAD, appChain, transporteApp } from "../config";

let cliente: PublicClient | null = null;

/** Cliente de lectura fuera de React (billetera invisible, página de las familias). */
export function clientePublico(): PublicClient {
  if (!cliente) cliente = createPublicClient({ chain: appChain, transport: transporteApp(), pollingInterval: ES_MONAD ? 500 : 1000 }) as PublicClient;
  return cliente;
}
