// Verifica los contratos en los exploradores de Monad (MonadVision, Socialscan y Monadscan) con
// una sola llamada por contrato a la API unificada de verificación. Incluye las campañas creadas
// por la factory (sus argumentos de constructor se reconstruyen leyendo la cadena).
//
//   pnpm verify:monad            (requiere haber desplegado con pnpm deploy:monad)
//   node scripts/verificar.mjs --seco   arma los payloads sin enviarlos
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, encodeAbiParameters } from "viem";
import { RAIZ, leerReporte, redPorNombre, transporteRed } from "./lib/entorno.mjs";
import { salida } from "./lib/foundry.mjs";

const API = "https://agents.devnads.com/v1/verify";
const seco = process.argv.includes("--seco");
const chainId = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 10143);
const r = leerReporte(chainId);
const red = redPorNombre(String(chainId));
const cliente = createPublicClient({ chain: red, transport: transporteRed(red) });
const raizWsl = "/mnt/" + RAIZ.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase());

const artefacto = (n) => JSON.parse(fs.readFileSync(path.join(RAIZ, "contracts", "out", `${n}.sol`, `${n}.json`), "utf8"));

const cacheJson = new Map(); // el standard JSON es el mismo para todas las instancias de un contrato
function standardJson(direccion, nombre) {
  if (cacheJson.has(nombre)) return cacheJson.get(nombre);
  const texto = salida("forge", ["verify-contract", direccion, `contracts/src/${nombre}.sol:${nombre}`, "--chain", String(chainId), "--show-standard-json-input"]);
  const json = JSON.parse(texto.slice(texto.indexOf("{")));
  cacheJson.set(nombre, json);
  return json;
}

function argsConstructor(nombre, valores) {
  const ctor = artefacto(nombre).abi.find((x) => x.type === "constructor");
  if (!ctor || ctor.inputs.length === 0) return undefined;
  return encodeAbiParameters(ctor.inputs, valores).slice(2); // sin 0x
}

async function verificar(nombre, direccion, valoresCtor = []) {
  const art = artefacto(nombre);
  const payload = {
    chainId,
    contractAddress: direccion,
    contractName: `contracts/src/${nombre}.sol:${nombre}`,
    compilerVersion: `v${art.metadata.compiler.version}`,
    standardJsonInput: standardJson(direccion, nombre),
    foundryMetadata: art.metadata,
  };
  const args = argsConstructor(nombre, valoresCtor);
  if (args) payload.constructorArgs = args;

  if (seco) {
    console.log(`  (seco) ${nombre} ${direccion}: payload de ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB${args ? `, args ${args.length / 2} bytes` : ""}`);
    return;
  }
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const texto = await res.text();
  let ok = false;
  try {
    ok = JSON.parse(texto).success === true;
  } catch {}
  console.log(`  ${ok ? "✅" : "⚠️ "} ${nombre} ${direccion}${ok ? "" : `\n     respuesta: ${texto.slice(0, 400)}`}`);
}

const leer = (address, abi, functionName, args = []) => cliente.readContract({ address, abi, functionName, args });

console.log(`Verificando contratos en chain ${chainId}...`);
await verificar("MockCOP", r.MockCOP);
await verificar("RegistroActores", r.RegistroActores, [r.deployer]);
await verificar("ReciboDonacion", r.ReciboDonacion, [r.deployer]);
await verificar("HistorialReputacion", r.HistorialReputacion, [r.deployer]);
await verificar("ReenviadorGas", r.ReenviadorGas);
await verificar("CampanaFactory", r.CampanaFactory, [r.MockCOP, r.RegistroActores, r.ReciboDonacion, r.HistorialReputacion, r.ReenviadorGas]);
await verificar("Dispersor", r.Dispersor);
if (r.NombresDonantes) await verificar("NombresDonantes", r.NombresDonantes, [r.CampanaFactory, r.ReenviadorGas, r.deployer]);

// Campañas: se reconstruye la ConfigCampana original desde las funciones view.
const abiF = artefacto("CampanaFactory").abi;
const abiC = artefacto("CampanaEmergencia").abi;
const campanas = await leer(r.CampanaFactory, abiF, "campanas");
for (const c of campanas) {
  const info = await leer(c, abiC, "info");
  const etapas = await leer(c, abiC, "etapas");
  const bloque = await cliente.getBlock({ blockNumber: info.bloqueCreacion });
  const cfg = {
    nombre: info.nombre,
    descripcion: info.descripcion,
    meta: info.meta,
    duracionRecaudo: info.fechaCierreRecaudo - bloque.timestamp,
    verificadores: info.verificadores,
    umbral: info.umbral,
    descripcionesEtapas: etapas.map((e) => e.descripcion),
    porcentajesBps: etapas.map((e) => e.porcentajeBps),
    plazosEtapas: etapas.map((e) => e.plazo),
    preciosReferencia: etapas.some((e) => e.precioReferencia > 0n) ? etapas.map((e) => e.precioReferencia) : [],
    unidadesReferencia: etapas.some((e) => e.precioReferencia > 0n) ? etapas.map((e) => e.unidad) : [],
    quorumBeneficiariosBps: info.quorumBeneficiariosBps,
  };
  const dep = { token: r.MockCOP, registro: r.RegistroActores, recibo: r.ReciboDonacion, reputacion: r.HistorialReputacion, reenviador: r.ReenviadorGas };
  await verificar("CampanaEmergencia", c, [dep, info.fundacion, cfg]);
}

console.log(`\nExploradores:
  MonadVision : https://testnet.monadvision.com/address/${r.CampanaFactory}
  Socialscan  : https://monad-testnet.socialscan.io/address/${r.CampanaFactory}
  Monadscan   : https://testnet.monadscan.com/address/${r.CampanaFactory}`);
