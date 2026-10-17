// Wallets simuladas derivadas de SIM_MNEMONIC.
//   pnpm wallets:nuevo                  genera SIM_MNEMONIC en .env (no lo imprime)
//   pnpm wallets                        lista direcciones y saldos de los actores
//   pnpm wallets -- --llaves            además imprime las llaves privadas (para importarlas en MetaMask)
//   pnpm wallets -- --red local         usa Anvil en vez de Monad
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, formatEther, http } from "viem";
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { bytesToHex } from "viem";
import { MNEMONIC_ANVIL, RAIZ, parcharEnv, redPorNombre } from "./lib/entorno.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);

if (flag("--nuevo")) {
  if (process.env.SIM_MNEMONIC && !flag("--forzar")) {
    console.log("SIM_MNEMONIC ya existe en .env. Usa --forzar para reemplazarlo (perderás esas wallets).");
    process.exit(0);
  }
  const rutaEnv = path.join(RAIZ, ".env");
  if (!fs.existsSync(rutaEnv)) fs.copyFileSync(path.join(RAIZ, ".env.example"), rutaEnv);
  parcharEnv(rutaEnv, { SIM_MNEMONIC: `"${generateMnemonic(english)}"` });
  console.log("✓ SIM_MNEMONIC nuevo guardado en .env (no se imprime por seguridad).");
  process.exit(0);
}

const red = redPorNombre(valor("--red", "monad"));
const mnemonic = red.id === 31337 ? MNEMONIC_ANVIL : process.env.SIM_MNEMONIC;
if (!mnemonic) {
  console.log("Falta SIM_MNEMONIC en .env. Ejecuta: pnpm wallets:nuevo");
  process.exit(1);
}

const ROLES = [
  [1, "Fundación"],
  [2, "Verificador 1 (Defensa Civil)"],
  [3, "Verificador 2 (Junta de Acción Comunal)"],
  [4, "Verificador 3 (Personería)"],
  [5, "Proveedor 1 (Supermercado)"],
  [6, "Proveedor 2 (Ferretería)"],
  [7, "Proveedor 3 (Constructora)"],
  [8, "Empresa aliada (matching)"],
  [9, "Patrocinador de gas (relayer)"],
];

const cliente = createPublicClient({ chain: red, transport: http() });
console.log(`\nWallets de los actores en ${red.name}:\n`);
for (const [i, rol] of ROLES) {
  const cuenta = mnemonicToAccount(mnemonic, { addressIndex: i });
  let saldo = "?";
  try {
    saldo = formatEther(await cliente.getBalance({ address: cuenta.address }));
  } catch {}
  console.log(`  ${rol.padEnd(42)} ${cuenta.address}  ${saldo} ${red.nativeCurrency.symbol}`);
  if (flag("--llaves")) {
    console.log(`  ${"".padEnd(42)} llave: ${bytesToHex(cuenta.getHdKey().privateKey)}`);
  }
}
console.log(
  "\nLos donantes simulados usan los índices 100 en adelante y las familias del censo, 5000 en adelante." +
    (flag("--llaves") ? "" : "\nPara importar un actor en MetaMask: pnpm wallets -- --llaves"),
);
