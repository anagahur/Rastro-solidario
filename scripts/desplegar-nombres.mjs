// Agrega NombresDonantes a un despliegue existente (sin tocar los demás contratos): cada donante
// elige si aparece anónimo o con su nombre en la página pública. Lo firma el deployer.
//
//   pnpm nombres:monad                 despliega en Monad testnet y actualiza los .env del frontend
//   node scripts/desplegar-nombres.mjs --red local
//
// Los despliegues nuevos (pnpm deploy:*) ya lo incluyen; esto es para el que ya está en Monad.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PK_ANVIL_0, RAIZ, leerReporte, redPorNombre, transporteRed } from "./lib/entorno.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "monad"));
const reporte = leerReporte(red.id);
const pk = red.id === 31337 ? PK_ANVIL_0 : process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) {
  console.error("✗ Falta DEPLOYER_PRIVATE_KEY en .env");
  process.exit(1);
}
if (reporte.NombresDonantes && !args.includes("--forzar")) {
  console.log(`✓ NombresDonantes ya está desplegado en ${reporte.NombresDonantes} (usa --forzar para otro)`);
  process.exit(0);
}

const artefacto = JSON.parse(fs.readFileSync(path.join(RAIZ, "contracts", "out", "NombresDonantes.sol", "NombresDonantes.json"), "utf8"));
const cuenta = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const transport = transporteRed(red);
const publico = createPublicClient({ chain: red, transport, pollingInterval: 500 });
const billetera = createWalletClient({ chain: red, transport, account: cuenta, pollingInterval: 500 });

const hash = await billetera.deployContract({
  abi: artefacto.abi,
  bytecode: artefacto.bytecode.object,
  args: [reporte.CampanaFactory, reporte.ReenviadorGas, cuenta.address],
});
const recibo = await publico.waitForTransactionReceipt({ hash, timeout: 120_000 });
if (recibo.status !== "success" || !recibo.contractAddress) throw new Error(`El despliegue falló: ${hash}`);
console.log(`✓ NombresDonantes en ${recibo.contractAddress}`);
console.log(`  ${red.blockExplorers?.default?.url ? `${red.blockExplorers.default.url}/tx/${hash}` : hash}`);

// Se agrega al reporte sin reordenar lo demás
const ruta = path.join(RAIZ, "reports", `deploy-${red.id}.json`);
const actualizado = { ...reporte, NombresDonantes: recibo.contractAddress };
fs.writeFileSync(ruta, JSON.stringify(actualizado, null, 2) + "\n");
console.log(`✓ ${path.relative(RAIZ, ruta)} actualizado`);
execFileSync(process.execPath, [path.join(RAIZ, "scripts", "configurar-env.mjs"), String(red.id)], { stdio: "inherit" });
