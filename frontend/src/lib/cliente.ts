import type { PublicClient } from "viem";
import { createConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { injected } from "wagmi/connectors";
import { ES_MONAD, appChain, transporteApp } from "../config";

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected()],
  transports: { [appChain.id]: transporteApp() },
  // Monad confirma en ~400 ms: consultar recibos seguido hace que la UI se sienta instantánea.
  pollingInterval: ES_MONAD ? 500 : 1000,
});

/**
 * Cliente de lectura fuera de React (billetera invisible, página de las familias). Es el mismo de
 * wagmi: así comparte la medición de los RPC de respaldo que empezó al abrir la app.
 */
export function clientePublico(): PublicClient {
  return getPublicClient(wagmiConfig, { chainId: appChain.id }) as PublicClient;
}
