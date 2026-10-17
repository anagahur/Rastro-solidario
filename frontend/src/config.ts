import { defineChain, fallback, http, type Address, type Transport } from "viem";
import { monadTestnet } from "viem/chains";

const env = import.meta.env;
const CERO = "0x0000000000000000000000000000000000000000" as Address;

export const CHAIN_ID = Number(env.VITE_CHAIN_ID || 31337);
const RPC_CONFIGURADO: string =
  env.VITE_RPC_URL || (CHAIN_ID === 10143 ? "https://testnet-rpc.monad.xyz" : "http://127.0.0.1:8545");

/**
 * Si el nodo es local pero la app se abrió desde otro equipo (p. ej. el celular de una familia
 * que escaneó su QR), el 127.0.0.1 no le sirve: se usa el proxy /rpc del servidor de Vite.
 */
const esLocal = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]";
export const RPC_URL: string = (() => {
  try {
    const rpc = new URL(RPC_CONFIGURADO);
    if (typeof window !== "undefined" && esLocal(rpc.hostname) && !esLocal(window.location.hostname)) {
      return `${window.location.origin}/rpc`;
    }
  } catch {}
  return RPC_CONFIGURADO;
})();
/**
 * RPCs de respaldo en Monad (el público oficial se pone lento o limita a 15 peticiones/s en
 * momentos de carga). VITE_RPC_RESPALDO acepta una lista separada por comas; vacío lo desactiva.
 */
const RPCS_RESPALDO: string[] =
  CHAIN_ID === 10143
    ? (env.VITE_RPC_RESPALDO ?? "https://rpc.ankr.com/monad_testnet,https://monad-testnet.drpc.org")
        .split(",")
        .map((s: string) => s.trim())
        .filter((u: string) => u && u !== RPC_URL)
    : [];

/** Transporte de la app: el RPC configurado y, si falla, los de respaldo en orden. */
export function transporteApp(): Transport {
  if (!RPCS_RESPALDO.length) return http(RPC_URL, { timeout: 15_000, retryCount: 2, retryDelay: 300 });
  // Sin reintentos por nodo: ante un error se pasa enseguida al siguiente; se reintenta la cadena.
  // rank: cada 15 s mide latencia y estabilidad de cada nodo y usa primero el mejor, así un nodo
  // lento (no solo uno caído) deja de frenar la app. net_listening (el ping por defecto) no existe en Monad.
  const uno = (url: string) => http(url, { timeout: 8_000, retryCount: 0 });
  return fallback([RPC_URL, ...RPCS_RESPALDO].map(uno), {
    retryCount: 2,
    retryDelay: 300,
    rank: { interval: 15_000, sampleCount: 4, timeout: 3_000, ping: ({ transport }) => transport.request({ method: "eth_blockNumber" }) },
  });
}

export const EXPLORER_URL: string =
  env.VITE_EXPLORER_URL || (CHAIN_ID === 10143 ? "https://testnet.monadvision.com" : "");
export const ES_MONAD = CHAIN_ID === 10143;
/**
 * Gateway IPFS para leer las evidencias directo de IPFS (p. ej. el dedicado de Pinata,
 * https://<tu-gateway>.mypinata.cloud/ipfs/). Vacío = las sirve el servidor de la app en /ipfs/.
 */
const GATEWAY: string = env.VITE_IPFS_GATEWAY || "";
export const IPFS_GATEWAY = GATEWAY && !GATEWAY.endsWith("/") ? `${GATEWAY}/` : GATEWAY;
/** Usuario del bot de Telegram para avisos (opcional; ver scripts/notificador.mjs). */
export const BOT_TELEGRAM: string = env.VITE_TELEGRAM_BOT || "";

export const DIRECCIONES = {
  cop: (env.VITE_MOCKCOP_ADDRESS || CERO) as Address,
  registro: (env.VITE_REGISTRO_ADDRESS || CERO) as Address,
  recibo: (env.VITE_RECIBO_ADDRESS || CERO) as Address,
  factory: (env.VITE_FACTORY_ADDRESS || CERO) as Address,
  reputacion: (env.VITE_REPUTACION_ADDRESS || CERO) as Address,
  reenviador: (env.VITE_REENVIADOR_ADDRESS || CERO) as Address,
};
export const CONFIGURADO = Object.values(DIRECCIONES).every((d) => d !== CERO);

/**
 * Monad testnet parte de la definición oficial de viem (incluye Multicall3, así las lecturas
 * se agrupan en una sola llamada) con el RPC y el explorador configurados.
 * En local se usa Anvil.
 */
export const appChain = ES_MONAD
  ? defineChain({
      ...monadTestnet,
      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
      blockExplorers: { default: { name: "MonadVision", url: EXPLORER_URL } },
    })
  : defineChain({
      id: CHAIN_ID,
      name: CHAIN_ID === 31337 ? "Anvil Local" : `Chain ${CHAIN_ID}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
      testnet: true,
    });

/** Intervalo de refresco de lecturas: Monad produce un bloque cada ~400 ms. */
export const REFRESCO_MS = ES_MONAD ? 2500 : 2000;
