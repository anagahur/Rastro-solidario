// Copia a evidencias-publicas/ (que sí va en git) las evidencias que usan las campañas de una red,
// para que la app desplegada en Vercel las pueda mostrar: allí el disco no persiste y la carpeta
// evidencias/ (local, ignorada por git) no existe.
//
//   pnpm evidencias:publicar            recorre las campañas de Monad testnet
//   node scripts/publicar-evidencias.mjs --red local
//
// Recorre info(), etapas() y votos() de cada campaña, toma todo ipfs://<cid> y, dentro de los
// documentos JSON, los CIDs que estos citan (fotos, facturas). Verifica que cada archivo
// corresponda a su CID antes de copiarlo.
import fs from "node:fs";
import path from "node:path";
import { createPublicClient } from "viem";
import { abi, leerReporte, redPorNombre, transporteRed } from "./lib/entorno.mjs";
import { DIR_EVIDENCIAS, DIR_PUBLICAS, cidDe } from "./lib/evidencias.mjs";
import { conReintentos } from "./lib/tx.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "monad"));
const reporte = leerReporte(red.id);
const cliente = createPublicClient({ chain: red, transport: transporteRed(red) });
const ABI = { factory: abi("CampanaFactory"), campana: abi("CampanaEmergencia") };

const RE_CID = /\b(baf[a-z2-7]{50,})\b/g;
const cidsEn = (valor) => [...JSON.stringify(valor, (_, v) => (typeof v === "bigint" ? v.toString() : v)).matchAll(RE_CID)].map((m) => m[1]);

const pendientes = new Set();
const campanas = await conReintentos(() => cliente.readContract({ address: reporte.CampanaFactory, abi: ABI.factory, functionName: "campanas" }));
for (const campana of campanas) {
  const leerC = (functionName, args = []) => conReintentos(() => cliente.readContract({ address: campana, abi: ABI.campana, functionName, args }));
  const [info, etapas] = await Promise.all([leerC("info"), leerC("etapas")]);
  cidsEn(info).forEach((c) => pendientes.add(c));
  cidsEn(etapas).forEach((c) => pendientes.add(c));
  for (let i = 0; i < etapas.length; i++) cidsEn(await leerC("votos", [BigInt(i)])).forEach((c) => pendientes.add(c));
}

fs.mkdirSync(DIR_PUBLICAS, { recursive: true });
const copiados = [];
const faltan = [];
const vistos = new Set();
while (pendientes.size) {
  const cid = pendientes.values().next().value;
  pendientes.delete(cid);
  if (vistos.has(cid)) continue;
  vistos.add(cid);
  const origen = [DIR_EVIDENCIAS, DIR_PUBLICAS].map((d) => path.join(d, cid)).find((r) => fs.existsSync(r));
  if (!origen) {
    faltan.push(cid);
    continue;
  }
  const bytes = fs.readFileSync(origen);
  if ((await cidDe(bytes)) !== cid) {
    faltan.push(`${cid} (el archivo local no coincide con su CID)`);
    continue;
  }
  const tipo = fs.existsSync(`${origen}.tipo`) ? fs.readFileSync(`${origen}.tipo`, "utf8") : "application/octet-stream";
  if (path.dirname(origen) !== DIR_PUBLICAS) {
    fs.writeFileSync(path.join(DIR_PUBLICAS, cid), bytes);
    fs.writeFileSync(path.join(DIR_PUBLICAS, `${cid}.tipo`), tipo);
  }
  copiados.push(cid);
  if (tipo === "application/json") {
    try {
      cidsEn(JSON.parse(bytes.toString("utf8"))).forEach((c) => pendientes.add(c));
    } catch {}
  }
}

const kb = copiados.reduce((t, c) => t + fs.statSync(path.join(DIR_PUBLICAS, c)).size, 0) / 1024;
console.log(`✓ ${copiados.length} evidencias de ${campanas.length} campañas en ${path.relative(process.cwd(), DIR_PUBLICAS) || DIR_PUBLICAS}/ (${kb.toFixed(0)} KB)`);
if (faltan.length) {
  console.log(`⚠ ${faltan.length} no están en este computador (se servirán desde el gateway IPFS si están fijadas):`);
  for (const f of faltan) console.log(`   ${f}`);
}
