// Cambia la URL a la que apunta el NFT de recibo de donación (ReciboDonacion.urlBase), por
// ejemplo cuando la app se publica en Vercel. Lo firma el deployer (dueño de ReciboDonacion).
//
//   pnpm url:monad -- https://rastro-solidario.vercel.app/
import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abi, leerReporte, redPorNombre, transporteRed } from "./lib/entorno.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "monad"));
let url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
  console.error("Uso: pnpm url:monad -- https://tu-app.vercel.app/");
  process.exit(1);
}
if (!url.endsWith("/")) url += "/";
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) {
  console.error("✗ Falta DEPLOYER_PRIVATE_KEY en .env");
  process.exit(1);
}

const reporte = leerReporte(red.id);
const transport = transporteRed(red);
const publico = createPublicClient({ chain: red, transport, pollingInterval: 500 });
const billetera = createWalletClient({ chain: red, transport, account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`) });
const ABI = abi("ReciboDonacion");

const actual = await publico.readContract({ address: reporte.ReciboDonacion, abi: ABI, functionName: "urlBase" });
if (actual === url) {
  console.log(`✓ El recibo ya apunta a ${url}`);
  process.exit(0);
}
const hash = await billetera.writeContract({ address: reporte.ReciboDonacion, abi: ABI, functionName: "configurarUrlBase", args: [url] });
const r = await publico.waitForTransactionReceipt({ hash, timeout: 120_000 });
if (r.status !== "success") throw new Error(`configurarUrlBase revirtió: ${hash}`);
console.log(`✓ Recibos: ${actual} → ${url}`);
console.log(`  ${red.blockExplorers?.default?.url ? `${red.blockExplorers.default.url}/tx/${hash}` : hash}`);
