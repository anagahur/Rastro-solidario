// Utilidades compartidas por los scripts de Node: redes, .env, reporte de despliegue y ABIs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineChain, fallback, http } from "viem";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(RAIZ, ".env") });

export const MNEMONIC_ANVIL = "test test test test test test test test test test test junk";
export const PK_ANVIL_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

/**
 * RPCs de Monad testnet: el configurado primero y luego los de respaldo (el público oficial se
 * pone lento o limita a 15 peticiones/s en momentos de carga). MONAD_RPC_RESPALDO acepta una
 * lista separada por comas; vacío ("MONAD_RPC_RESPALDO=") desactiva el respaldo.
 */
export const RPCS_MONAD = [
  process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  ...(process.env.MONAD_RPC_RESPALDO ?? "https://rpc.ankr.com/monad_testnet,https://monad-testnet.drpc.org")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
].filter((u, i, a) => a.indexOf(u) === i);

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  // Bloques de ~400 ms: viem usa esto para el intervalo con que espera recibos (si no, 4 s).
  blockTime: 400,
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: RPCS_MONAD } },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: process.env.MONAD_EXPLORER_URL || "https://testnet.monadvision.com",
    },
  },
  testnet: true,
});

/**
 * Transporte con respaldo: si un RPC falla (caído, lento o límite de tasa) se pasa al siguiente.
 * Las transacciones se firman localmente, así que cualquier nodo puede difundirlas.
 */
export function transporteRed(red, { timeout = 10_000 } = {}) {
  const urls = red.rpcUrls.default.http;
  if (urls.length === 1) return http(urls[0], { timeout, retryCount: 2, retryDelay: 300 });
  // Sin reintentos por nodo: ante un error se pasa enseguida al siguiente; se reintenta la cadena.
  // rank: cada 15 s mide latencia y estabilidad de cada nodo y usa primero el mejor, así un nodo
  // lento (no solo uno caído) deja de frenar las donaciones.
  return fallback(
    urls.map((url) => http(url, { timeout, retryCount: 0 })),
    { retryCount: 2, retryDelay: 300, rank: RANKING_RPC },
  );
}

/** Medición de los RPC para el respaldo (net_listening, el ping por defecto, no existe en Monad). */
export const RANKING_RPC = {
  interval: 15_000,
  sampleCount: 4,
  timeout: 3_000,
  ping: ({ transport }) => transport.request({ method: "eth_blockNumber" }),
};

export function redPorNombre(nombre) {
  if (nombre === "local" || nombre === "31337") return anvil;
  if (nombre === "monad" || nombre === "10143") return monadTestnet;
  throw new Error(`Red desconocida: ${nombre} (usa "local" o "monad")`);
}

export function leerReporte(chainId) {
  const ruta = path.join(RAIZ, "reports", `deploy-${chainId}.json`);
  if (!fs.existsSync(ruta)) {
    throw new Error(
      `No existe ${path.relative(RAIZ, ruta)}. Despliega primero (pnpm deploy:local / pnpm deploy:monad).`,
    );
  }
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

/** ABI compilado por Foundry (contracts/out/<Nombre>.sol/<Nombre>.json). */
export function abi(nombre) {
  const ruta = path.join(RAIZ, "contracts", "out", `${nombre}.sol`, `${nombre}.json`);
  if (!fs.existsSync(ruta)) {
    throw new Error(`No encuentro ${ruta}. Compila con: pnpm build:contracts`);
  }
  return JSON.parse(fs.readFileSync(ruta, "utf8")).abi;
}

/** Escribe/actualiza claves en un archivo .env sin tocar las demás. */
export function parcharEnv(ruta, valores) {
  let contenido = fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8").replace(/\r\n/g, "\n") : "";
  for (const [clave, valor] of Object.entries(valores)) {
    const linea = `${clave}=${valor}`;
    const re = new RegExp(`^${clave}=.*$`, "m");
    if (re.test(contenido)) contenido = contenido.replace(re, linea);
    else contenido += (contenido === "" || contenido.endsWith("\n") ? "" : "\n") + linea + "\n";
  }
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido, "utf8");
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
