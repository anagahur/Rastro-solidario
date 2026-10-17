// Ejecuta forge / anvil / cast estén donde estén (Windows, Linux, macOS o WSL).
//   node scripts/foundry.mjs forge test
//   node scripts/foundry.mjs anvil            (con la configuración de la demo)
import { correr } from "./lib/foundry.mjs";

const [nombre, ...args] = process.argv.slice(2);
if (!["forge", "anvil", "cast"].includes(nombre)) {
  console.error("Uso: node scripts/foundry.mjs <forge|anvil|cast> [argumentos]");
  process.exit(1);
}

// Anvil para la demo: bloques de 1 s (Monad: ~400 ms), límite de contratos de 128 KB como Monad
// y escuchando en 0.0.0.0 para que un celular en la misma red abra la app (QR de las familias).
const argsAnvil = ["--block-time", "1", "--code-size-limit", "131072", "--host", "0.0.0.0", "--accounts", "10"];

process.exit(await correr(nombre, nombre === "anvil" && args.length === 0 ? argsAnvil : args));
