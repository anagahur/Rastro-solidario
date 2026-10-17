// Lee reports/deploy-<chainId>.json y escribe frontend/.env con las direcciones.
// Uso: node scripts/configurar-env.mjs [31337|10143]
import path from "node:path";
import { RAIZ, leerReporte, parcharEnv, redPorNombre } from "./lib/entorno.mjs";
import { exportarAbis } from "./exportar-abis.mjs";

const chainId = process.argv[2] ?? "10143";
const red = redPorNombre(chainId);
const r = leerReporte(chainId);
const esMonad = red.id === 10143;

const valores = {
  VITE_CHAIN_ID: String(red.id),
  VITE_RPC_URL: red.rpcUrls.default.http[0],
  VITE_EXPLORER_URL: esMonad ? red.blockExplorers.default.url : "",
  VITE_MOCKCOP_ADDRESS: r.MockCOP,
  VITE_REGISTRO_ADDRESS: r.RegistroActores,
  VITE_RECIBO_ADDRESS: r.ReciboDonacion,
  VITE_FACTORY_ADDRESS: r.CampanaFactory,
  VITE_REPUTACION_ADDRESS: r.HistorialReputacion,
  VITE_REENVIADOR_ADDRESS: r.ReenviadorGas,
  VITE_BLOQUE_DESPLIEGUE: String(r.bloqueDespliegue ?? 0),
};
parcharEnv(path.join(RAIZ, "frontend", ".env"), valores);
// El build de producción (Vercel) usa frontend/.env.production, que sí va en git: solo tiene
// direcciones públicas de Monad, nada secreto.
if (esMonad) parcharEnv(path.join(RAIZ, "frontend", ".env.production"), valores);

exportarAbis();

console.log(`
✓ frontend/.env${esMonad ? " y frontend/.env.production" : ""} actualizados para ${red.name} (chainId ${red.id})
   MockCOP         ${r.MockCOP}
   RegistroActores ${r.RegistroActores}
   CampanaFactory  ${r.CampanaFactory}
   ReciboDonacion  ${r.ReciboDonacion}
   Reputación      ${r.HistorialReputacion}
   ReenviadorGas   ${r.ReenviadorGas}

Siguiente paso:
   pnpm simular${esMonad ? ":monad" : ":local"}   # campañas completas con wallets simuladas (censo, matching, sobrecosto, falla)
   pnpm dev                 # frontend en http://localhost:5173
`);
