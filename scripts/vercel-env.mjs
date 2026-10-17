// Escribe .env.vercel (ignorado por git) con las variables que el proyecto de Vercel necesita,
// listas para pegarlas en Settings → Environment Variables (el panel acepta pegar un .env entero).
//
//   pnpm vercel:env
//
// Solo incluye las dos llaves que operan la demo en vivo (pasarela y patrocinador de gas), nunca
// la del deployer ni el mnemónico.
import fs from "node:fs";
import path from "node:path";
import { bytesToHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { INDICE_PASARELA, INDICE_PATROCINADOR, RAIZ } from "./lib/entorno.mjs";

const mnemonic = process.env.SIM_MNEMONIC;
if (!mnemonic) {
  console.error("✗ Falta SIM_MNEMONIC en .env");
  process.exit(1);
}
const llave = (i) => bytesToHex(mnemonicToAccount(mnemonic, { addressIndex: i }).getHdKey().privateKey);

const lineas = [
  "# Variables para Vercel (Settings → Environment Variables). NO subir a git.",
  "CHAIN_ID=10143",
  `MONAD_RPC_URL=${process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"}`,
  `PASARELA_PRIVATE_KEY=${llave(INDICE_PASARELA)}`,
  `PATROCINADOR_PRIVATE_KEY=${llave(INDICE_PATROCINADOR)}`,
  // Topes por IP cada 10 min, holgados para una presentación donde mucha gente dona desde la
  // misma red wifi (comparten IP). El saldo del patrocinador es el límite real: pnpm recargar:monad.
  "LIMITE_PAGOS_IP=60",
  "LIMITE_REENVIOS_IP=150",
  "LIMITE_EVIDENCIAS_IP=60",
  // Vercel no acepta variables vacías: solo se incluyen si existen.
  ...(process.env.PINATA_JWT ? [`PINATA_JWT=${process.env.PINATA_JWT}`] : []),
  ...(process.env.IPFS_GATEWAY ? [`IPFS_GATEWAY=${process.env.IPFS_GATEWAY}`] : []),
];
const ruta = path.join(RAIZ, ".env.vercel");
fs.writeFileSync(ruta, lineas.join("\n") + "\n", "utf8");
console.log(`✓ ${path.relative(process.cwd(), ruta) || ruta} escrito (no se imprimen las llaves).`);
if (!process.env.PINATA_JWT) {
  console.log("⚠ Sin PINATA_JWT: en Vercel todo funciona menos subir evidencias nuevas desde el Panel de actores.");
  console.log("  Crea uno gratis en https://app.pinata.cloud (API Keys → New Key, permiso pinFileToIPFS),");
  console.log("  agrégalo a .env y vuelve a correr pnpm vercel:env.");
}
