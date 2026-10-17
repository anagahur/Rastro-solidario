// Recarga con MON a los actores que operan la demo en vivo, en UNA transacción (Dispersor).
//
//   pnpm recargar:monad                 sube a cada actor hasta su saldo objetivo
//   pnpm recargar:monad -- --estimar    solo muestra saldos y cuánto enviaría
//
// El patrocinador de gas paga las donaciones con Nequi/PSE, las confirmaciones de las familias y
// los reembolsos sin gas; la fundación, los verificadores y la empresa usan su saldo cuando se
// importan en MetaMask para el Panel de actores. Paga el deployer (DEPLOYER_PRIVATE_KEY).
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { abi, dormir, leerReporte, redPorNombre } from "./lib/entorno.mjs";
import { conReintentos } from "./lib/tx.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "monad"));
const sym = red.nativeCurrency.symbol;
const reporte = leerReporte(red.id);

const pk = process.env.DEPLOYER_PRIVATE_KEY;
const mnemonic = process.env.SIM_MNEMONIC;
if (!pk || !mnemonic) {
  console.error("✗ Faltan DEPLOYER_PRIVATE_KEY y/o SIM_MNEMONIC en .env");
  process.exit(1);
}

// [índice en SIM_MNEMONIC, rol, saldo objetivo]
const OBJETIVOS = [
  [9, "Patrocinador de gas", "3"],
  [1, "Fundación", "1"],
  [2, "Verificador 1", "0.5"],
  [3, "Verificador 2", "0.5"],
  [4, "Verificador 3", "0.5"],
  [8, "Empresa aliada", "0.5"],
];

const transporte = http(red.rpcUrls.default.http[0], { timeout: 30_000 });
const publico = createPublicClient({ chain: red, transport: transporte });
const deployer = createWalletClient({
  chain: red,
  transport: transporte,
  account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`),
});

const destinos = [];
const montos = [];
for (const [i, rol, objetivo] of OBJETIVOS) {
  const direccion = mnemonicToAccount(mnemonic, { addressIndex: i }).address;
  const saldo = await conReintentos(() => publico.getBalance({ address: direccion }));
  const falta = parseEther(objetivo) - saldo;
  console.log(`  ${rol.padEnd(20)} ${direccion}  ${formatEther(saldo)} ${sym}${falta > 0n ? `  → +${formatEther(falta)}` : "  ✓"}`);
  if (falta > 0n) {
    destinos.push(direccion);
    montos.push(falta);
  }
  await dormir(150); // el RPC público admite ~15 peticiones por segundo
}

const total = montos.reduce((a, b) => a + b, 0n);
const saldoDeployer = await conReintentos(() => publico.getBalance({ address: deployer.account.address }));
console.log(`\nDeployer ${deployer.account.address}: ${formatEther(saldoDeployer)} ${sym} · enviaría ${formatEther(total)} ${sym}`);
if (total === 0n) {
  console.log("✓ Todos los actores tienen saldo suficiente.");
  process.exit(0);
}
if (args.includes("--estimar")) process.exit(0);
if (saldoDeployer < total + parseEther("0.2")) {
  console.error(`✗ Al deployer no le alcanza. Pide ${sym} en https://faucet.monad.xyz`);
  process.exit(1);
}

const hash = await conReintentos(() =>
  deployer.writeContract({
    address: reporte.Dispersor,
    abi: abi("Dispersor"),
    functionName: "dispersar",
    args: [destinos, montos],
    value: total,
  }),
);
const recibo = await publico.waitForTransactionReceipt({ hash, timeout: 120_000 });
if (recibo.status !== "success") {
  console.error(`✗ La transacción revirtió: ${hash}`);
  process.exit(1);
}
const enlace = red.blockExplorers?.default?.url ? `${red.blockExplorers.default.url}/tx/${hash}` : hash;
console.log(`✓ ${formatEther(total)} ${sym} repartidos a ${destinos.length} actores en 1 transacción: ${enlace}`);
