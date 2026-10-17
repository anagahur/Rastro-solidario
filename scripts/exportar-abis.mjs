// Copia los ABIs compilados por Foundry a frontend/src/abis.ts (con `as const` para que
// wagmi/viem infieran tipos). Uso: pnpm abis   (requiere pnpm build:contracts antes)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RAIZ, abi } from "./lib/entorno.mjs";

const CONTRATOS = ["MockCOP", "RegistroActores", "CampanaFactory", "CampanaEmergencia", "ReciboDonacion", "HistorialReputacion", "ReenviadorGas", "NombresDonantes"];

export function exportarAbis() {
  let ts = "// Archivo generado por scripts/exportar-abis.mjs. No editar a mano.\n\n";
  for (const nombre of CONTRATOS) {
    ts += `export const ${nombre[0].toLowerCase()}${nombre.slice(1)}Abi = ${JSON.stringify(abi(nombre), null, 2)} as const;\n\n`;
  }
  const destino = path.join(RAIZ, "frontend", "src", "abis.ts");
  fs.writeFileSync(destino, ts, "utf8");
  console.log(`✓ ABIs exportados a ${path.relative(RAIZ, destino)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) exportarAbis();
