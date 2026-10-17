// Comprueba que PINATA_JWT (en .env) sirve para fijar evidencias en IPFS y que el gateway las entrega.
// Uso: pnpm pinata
import { guardarJson, gatewayPublico } from "./lib/evidencias.mjs";

const ok = (t) => console.log(`  ✓ ${t}`);
const falla = (t) => {
  console.error(`  ✕ ${t}`);
  process.exit(1);
};

console.log("\n━━━ Pinata ━━━");
if (!process.env.PINATA_JWT) {
  falla(
    "No hay PINATA_JWT en .env.\n" +
      "    1. Crea una cuenta gratis en https://app.pinata.cloud\n" +
      "    2. API Keys → New Key → marca «pinFileToIPFS» (o Admin) → copia el JWT\n" +
      "    3. Pégalo en .env:  PINATA_JWT=eyJ...\n" +
      "    4. Gateways → copia tu gateway dedicado y ponlo en .env:  IPFS_GATEWAY=https://<tu-gateway>.mypinata.cloud/ipfs/",
  );
}

// 1. La llave es válida
const auth = await fetch("https://api.pinata.cloud/data/testAuthentication", {
  headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
});
if (!auth.ok) falla(`Pinata rechazó la llave (${auth.status}). Revisa que copiaste el JWT completo.`);
ok("La llave (JWT) es válida");

// 2. Se puede fijar un archivo (el mismo camino que usan las facturas y actas)
const prueba = await guardarJson({ tipo: "prueba-rastro-solidario", fecha: new Date().toISOString() });
if (prueba.fijado !== "pinata") falla("El archivo no se fijó en Pinata");
ok(`Archivo de prueba fijado: ${prueba.uri}`);

// 3. El gateway lo entrega (lo que verá el navegador de los jurados)
const gateway = gatewayPublico();
const r = await fetch(gateway + prueba.cid);
if (!r.ok) falla(`El gateway ${gateway} respondió ${r.status}. Puede tardar unos segundos en propagarse: vuelve a intentar.`);
ok(`El gateway lo entrega: ${gateway}${prueba.cid}`);

if (!process.env.IPFS_GATEWAY) {
  console.log("\n  ⚠ Estás usando el gateway público de Pinata (lento y con límite de peticiones).");
  console.log("    Para la demo usa tu gateway dedicado: IPFS_GATEWAY=https://<tu-gateway>.mypinata.cloud/ipfs/ en .env");
}
console.log("\nSiguiente paso (sin volver a desplegar): pnpm env:monad  (o pnpm env:local) para que el frontend lea las evidencias desde IPFS.\n");
