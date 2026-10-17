// Separa la llave que acuña MockCOP de la del deployer: le pasa la propiedad de MockCOP a la
// cuenta de la pasarela (SIM_MNEMONIC índice 10) y le deja MON para el gas.
//
//   pnpm pasarela:monad
//
// Así en el servidor público (Vercel) solo viven dos llaves con poco saldo (pasarela y
// patrocinador) y no la del deployer, que administra el registro de actores y guarda el MON.
// Es reversible: la llave de la pasarela sale del mnemónico (transferOwnership de vuelta).
import { createPublicClient, createWalletClient, formatEther, isAddressEqual, parseEther } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { INDICE_PASARELA, abi, leerReporte, redPorNombre, transporteRed } from "./lib/entorno.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "monad"));
const reporte = leerReporte(red.id);
const sym = red.nativeCurrency.symbol;
const SALDO_OBJETIVO = parseEther(valor("--saldo", "1"));

const pk = process.env.DEPLOYER_PRIVATE_KEY;
const mnemonic = process.env.SIM_MNEMONIC;
if (!pk || !mnemonic) {
  console.error("✗ Faltan DEPLOYER_PRIVATE_KEY y/o SIM_MNEMONIC en .env");
  process.exit(1);
}
const deployer = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const pasarela = mnemonicToAccount(mnemonic, { addressIndex: INDICE_PASARELA });

const transport = transporteRed(red);
const publico = createPublicClient({ chain: red, transport, pollingInterval: 500 });
const billetera = createWalletClient({ chain: red, transport, account: deployer, pollingInterval: 500 });
const esperar = async (hash, que) => {
  const r = await publico.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`${que} revirtió: ${hash}`);
  console.log(`  ✓ ${que}: ${red.blockExplorers?.default?.url ? `${red.blockExplorers.default.url}/tx/${hash}` : hash}`);
};

console.log(`Pasarela (índice ${INDICE_PASARELA}): ${pasarela.address}`);
const saldo = await publico.getBalance({ address: pasarela.address });
if (saldo < SALDO_OBJETIVO) {
  const falta = SALDO_OBJETIVO - saldo;
  console.log(`  saldo ${formatEther(saldo)} ${sym} → se envían ${formatEther(falta)} ${sym}`);
  await esperar(await billetera.sendTransaction({ to: pasarela.address, value: falta }), "MON para el gas de la pasarela");
} else {
  console.log(`  saldo ${formatEther(saldo)} ${sym} ✓`);
}

const ABI_COP = abi("MockCOP");
const dueno = await publico.readContract({ address: reporte.MockCOP, abi: ABI_COP, functionName: "owner" });
if (isAddressEqual(dueno, pasarela.address)) {
  console.log("  MockCOP ya pertenece a la pasarela ✓");
} else if (isAddressEqual(dueno, deployer.address)) {
  await esperar(
    await billetera.writeContract({ address: reporte.MockCOP, abi: ABI_COP, functionName: "transferOwnership", args: [pasarela.address] }),
    "MockCOP ahora pertenece a la pasarela",
  );
} else {
  console.error(`✗ MockCOP pertenece a ${dueno}, que no es ni el deployer ni la pasarela.`);
  process.exit(1);
}
