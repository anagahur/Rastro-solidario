// Utilidades compartidas por los scripts de Node: redes, .env, reporte de despliegue y ABIs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineChain } from "viem";

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

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: process.env.MONAD_EXPLORER_URL || "https://testnet.monadvision.com",
    },
  },
  testnet: true,
});

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
