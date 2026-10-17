// Despliega los contratos y registra los actores de la demo.
//   pnpm deploy:local    (Anvil: pnpm anvil en otra terminal)
//   pnpm deploy:monad    (requiere DEPLOYER_PRIVATE_KEY y SIM_MNEMONIC en .env)
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { RAIZ, redPorNombre } from "./lib/entorno.mjs";
import { correr } from "./lib/foundry.mjs";

const nombreRed = process.argv[2] ?? "local";
const red = redPorNombre(nombreRed);
const rpc = red.rpcUrls.default.http[0];

if (red.id === 10143) {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error("✗ Falta DEPLOYER_PRIVATE_KEY en .env (wallet con MON de testnet: https://faucet.monad.xyz)");
    process.exit(1);
  }
  if (!process.env.SIM_MNEMONIC) {
    console.error("✗ Falta SIM_MNEMONIC en .env. Ejecuta primero:  pnpm wallets:nuevo");
    process.exit(1);
  }
}

console.log(`━━━ Despliegue (${red.name}) ━━━  RPC: ${rpc}`);
try {
  const id = await createPublicClient({ transport: http(rpc, { timeout: 5000, retryCount: 0 }) }).getChainId();
  console.log(`Chain id: ${id}`);
} catch {
  console.error(`✗ El RPC no responde en ${rpc}`);
  if (red.id === 31337) console.error("  Inicia Anvil en otra terminal:  pnpm anvil");
  process.exit(1);
}

fs.mkdirSync(path.join(RAIZ, "reports"), { recursive: true });
// La factory pesa más de 24 KB (lleva el código de cada campaña). Monad permite hasta 128 KB.
const codigo = await correr("forge", ["script", "contracts/script/Deploy.s.sol:Deploy", "--rpc-url", rpc, "--broadcast", "--non-interactive", "--disable-code-size-limit", "-vv"]);
if (codigo !== 0) process.exit(codigo);
console.log("\n✓ Contratos desplegados. Direcciones en reports/deploy-<chainId>.json");
