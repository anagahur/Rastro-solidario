import { createPublicClient, http, type PublicClient } from "viem";
import { RPC_URL, appChain } from "../config";

let cliente: PublicClient | null = null;

/** Cliente de lectura fuera de React (billetera invisible, página de las familias). */
export function clientePublico(): PublicClient {
  if (!cliente) cliente = createPublicClient({ chain: appChain, transport: http(RPC_URL) }) as PublicClient;
  return cliente;
}
