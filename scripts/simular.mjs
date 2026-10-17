// Simulación completa de campañas con wallets simuladas.
//
//   pnpm simular:local                         Anvil (pnpm anvil + pnpm deploy:local antes)
//   pnpm simular:monad                         Monad testnet
//   pnpm simular:monad -- --donantes 30        menos donantes (gasta menos MON)
//   pnpm simular:monad -- --estimar            solo calcula cuánto MON se necesita
//   pnpm simular:monad -- --escenario completo|falla|abierta|vencimiento|todos
//   pnpm simular:monad -- --recuperar          devuelve al deployer el MON sobrante de las wallets simuladas
//
// Escenarios:
//   completo     Una empresa aliada duplica donaciones; N donantes donan en paralelo; la Junta de
//                Acción Comunal carga el censo de 20 familias; 3 etapas con factura y fotos en el
//                almacén de evidencias; las familias confirman con su QR (gas patrocinado, 1 tx por
//                lote); la etapa de materiales llega con SOBRECOSTO y exige 3 de 3 verificadores.
//   falla        la etapa 2 se rechaza (2 de 3, con foto de la bodega vacía) → reembolsos
//   abierta      campaña que queda RECAUDANDO para la demo en vivo: censo cargado, matching activo
//                y algunas donaciones. Las tarjetas QR de sus familias quedan en
//                frontend/public/familias-demo.json (solo en local).
//   vencimiento  la etapa 1 vence sin aprobarse → cualquiera activa el reembolso (tarda ~40 s)
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  http,
  parseEther,
  parseEventLogs,
  parseSignature,
  zeroAddress,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { bytesToHex } from "viem";
import {
  MNEMONIC_ANVIL,
  PK_ANVIL_0,
  RAIZ,
  abi,
  dormir,
  leerReporte,
  redPorNombre,
} from "./lib/entorno.mjs";
import { guardar, guardarJson } from "./lib/evidencias.mjs";
import { svgEntrega, svgFactura, svgRechazo } from "./lib/ilustraciones.mjs";
import { firmarSolicitud } from "./lib/reenvio.mjs";
import {
  RastreadorBloques,
  Remitente,
  conReintentos,
  estadisticas,
  explicarError,
  limitador,
} from "./lib/tx.mjs";

// ─────────────────────────── Argumentos ───────────────────────────
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);

const red = redPorNombre(valor("--red", "local"));
const esMonad = red.id === 10143;
const N_DONANTES = Math.max(2, Math.min(1000, Number(valor("--donantes", 50))));
const N_FALLA = 10;
const N_VENCE = 5;
const N_ABIERTA = 12;
const N_FAMILIAS = Math.max(5, Math.min(200, Number(valor("--familias", 20))));
const ESCENARIO = valor("--escenario", "todos"); // completo | falla | abierta | vencimiento | todos
const CONCURRENCIA = Number(valor("--concurrencia", esMonad ? 16 : 50));
const SEMILLA = Number(valor("--semilla", 2026));
const explorador = esMonad ? red.blockExplorers.default.url : null;

const correr = {
  completo: ESCENARIO === "completo" || ESCENARIO === "todos",
  falla: ESCENARIO === "falla" || ESCENARIO === "todos",
  abierta: ESCENARIO === "abierta" || ESCENARIO === "todos",
  vencimiento: ESCENARIO === "vencimiento",
};

// Matching de la empresa aliada (escenarios completo y abierta)
const MATCHING_COMPLETO = 2_000_000; // duplica las primeras donaciones hasta 2.000.000
const MATCHING_ABIERTA = 3_000_000;

// Precios de referencia por unidad (en la vida real: SIPSA-DANE, listas de la UNGRD o del municipio)
const PRECIOS_REFERENCIA = [150_000, 400_000, 0];
const UNIDADES_REFERENCIA = ["mercado familiar", "kit de techo", ""];

const ZONAS = {
  completo: { lugar: "Barrio La Esperanza, Bello (Antioquia)", lat: 6.3373, lng: -75.5579 },
  falla: { lugar: "Vereda El Carmen, Salgar (Antioquia)", lat: 5.9636, lng: -75.9769 },
  abierta: { lugar: "Sector La Playita, Mocoa (Putumayo)", lat: 1.1475, lng: -76.647 },
  vencimiento: { lugar: "Barrio Nuevo, Riohacha (La Guajira)", lat: 11.5444, lng: -72.9072 },
};

// ─────────────────────────── Cuentas y contratos ───────────────────────────
// En Anvil siempre se usan las cuentas de prueba públicas; el .env solo aplica a Monad.
const pk = esMonad ? process.env.DEPLOYER_PRIVATE_KEY : PK_ANVIL_0;
const mnemonic = esMonad ? process.env.SIM_MNEMONIC : MNEMONIC_ANVIL;
if (!pk || !mnemonic) {
  console.error("✗ Faltan DEPLOYER_PRIVATE_KEY y/o SIM_MNEMONIC en .env (ver .env.example)");
  process.exit(1);
}
const deployer = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const cuenta = (i) => mnemonicToAccount(mnemonic, { addressIndex: i });
const fundacion = cuenta(1);
const verificadores = [cuenta(2), cuenta(3), cuenta(4)];
const empresa = cuenta(8);
const patrocinador = cuenta(9);

const reporte = leerReporte(red.id);
if (reporte.actores.fundacion.toLowerCase() !== fundacion.address.toLowerCase()) {
  console.error(
    "✗ SIM_MNEMONIC no coincide con el usado al desplegar (la fundación registrada es otra).\n" +
      "  Vuelve a desplegar o restaura el SIM_MNEMONIC original.",
  );
  process.exit(1);
}
if (!reporte.ReenviadorGas || !reporte.HistorialReputacion) {
  console.error("✗ El despliegue es de una versión anterior (sin ReenviadorGas / HistorialReputacion). Vuelve a desplegar.");
  process.exit(1);
}
const proveedores = reporte.actores.proveedores;
const NOMBRES_PROVEEDORES = ["Supermercado La Cosecha", "Ferretería El Constructor", "Constructora Comunitaria"];
const NITS = ["900.123.456-1", "901.765.432-7", "900.555.010-3"];

const ABI = {
  cop: abi("MockCOP"),
  factory: abi("CampanaFactory"),
  campana: abi("CampanaEmergencia"),
  dispersor: abi("Dispersor"),
  reenviador: abi("ReenviadorGas"),
  reputacion: abi("HistorialReputacion"),
};

const publico = createPublicClient({
  chain: red,
  transport: http(red.rpcUrls.default.http[0], { timeout: 30_000, retryCount: 2 }),
  pollingInterval: esMonad ? 300 : 200,
});
const rastreador = new RastreadorBloques(publico, esMonad ? 250 : 150);
const remitente = new Remitente({ publico, red, esMonad, rastreador });

// ─────────────────────────── Utilidades ───────────────────────────
const t0Global = Date.now();
const reloj = () => `${((Date.now() - t0Global) / 1000).toFixed(1).padStart(6)}s`;
const log = (...m) => console.log(`[${reloj()}]`, ...m);
const pesos = (wei) => Number(formatEther(wei)).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const enlaceTx = (h) => (explorador ? `${explorador}/tx/${h}` : h);
const sym = red.nativeCurrency.symbol;
const hoy = () => new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function prng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngLugares = prng(SEMILLA + 7);

/** Montos variados (múltiplos de 1.000, mínimo 5.000) que suman exactamente `totalPesos`. */
function generarMontos(n, totalPesos, rng) {
  const base = totalPesos / n;
  const montos = [];
  let acumulado = 0;
  for (let i = 0; i < n - 1; i++) {
    let p = Math.round((base * (0.2 + rng() * 1.4)) / 1000) * 1000;
    p = Math.max(5000, p);
    p = Math.min(p, totalPesos - acumulado - 5000 * (n - 1 - i));
    montos.push(p);
    acumulado += p;
  }
  montos.push(totalPesos - acumulado);
  return montos.map((p) => parseEther(String(p)));
}

// Presupuestos de gas (cotas superiores; el gas real se estima en cada tx).
const GAS = {
  crear: 9_000_000n,
  proponer: 400_000n,
  confirmar: 450_000n,
  rechazar: 300_000n,
  cerrar: 400_000n,
  donar: 700_000n,
  reclamar: 200_000n,
  vencer: 200_000n,
  censo: 4_000_000n,
  matching: 400_000n,
  loteFamilias: 2_500_000n,
  mintPorDestino: 60_000n,
  dispersarPorDestino: 60_000n,
  base: 100_000n,
};

// ─────────────────────────── Planeación de wallets ───────────────────────────
const indiceInicial = {
  completo: 100,
  falla: 100 + N_DONANTES,
  vencimiento: 100 + N_DONANTES + N_FALLA,
  abierta: 100 + N_DONANTES + N_FALLA + N_VENCE,
};
const indiceFamilias = { completo: 5000, abierta: 5000 + N_FAMILIAS };
const plan = [];
if (correr.completo) plan.push({ esc: "completo", n: N_DONANTES, matching: MATCHING_COMPLETO, censo: true });
if (correr.falla) plan.push({ esc: "falla", n: N_FALLA });
if (correr.abierta) plan.push({ esc: "abierta", n: N_ABIERTA, matching: MATCHING_ABIERTA, censo: true });
if (correr.vencimiento) plan.push({ esc: "vencimiento", n: N_VENCE });
const donantesDe = (esc, n) => Array.from({ length: n }, (_, i) => cuenta(indiceInicial[esc] + i));
const familiasDe = (esc) => Array.from({ length: N_FAMILIAS }, (_, i) => cuenta(indiceFamilias[esc] + i));

function necesidades(maxFee) {
  const campanas = BigInt(plan.length);
  const conCenso = BigInt(plan.filter((p) => p.censo).length);
  const conMatching = BigInt(plan.filter((p) => p.matching).length);
  const reqMon = new Map(); // address -> wei necesario
  reqMon.set(fundacion.address, (GAS.crear + GAS.cerrar + 3n * GAS.proponer) * campanas * maxFee);
  reqMon.set(verificadores[0].address, 3n * GAS.confirmar * campanas * maxFee);
  reqMon.set(verificadores[1].address, (3n * GAS.confirmar * campanas + GAS.censo * conCenso) * maxFee);
  reqMon.set(verificadores[2].address, 3n * GAS.confirmar * campanas * maxFee);
  if (conMatching > 0n) reqMon.set(empresa.address, 2n * GAS.matching * conMatching * maxFee);
  if (conCenso > 0n) reqMon.set(patrocinador.address, 3n * GAS.loteFamilias * conCenso * maxFee);
  for (const { esc, n } of plan) {
    for (const d of donantesDe(esc, n)) reqMon.set(d.address, (GAS.donar + GAS.reclamar) * maxFee);
  }
  return reqMon;
}

// ─────────────────────────── Recuperar MON sobrante ───────────────────────────
async function recuperar() {
  await rastreador.iniciar();
  const fees = await remitente.actualizarFees();
  const costo = 21_000n * fees.maxFeePerGas;
  const todas = [fundacion, ...verificadores, empresa, patrocinador];
  for (const [esc, n] of Object.entries({ completo: N_DONANTES, falla: N_FALLA, vencimiento: N_VENCE, abierta: N_ABIERTA })) {
    todas.push(...donantesDe(esc, n));
  }
  let total = 0n;
  const lim = limitador(CONCURRENCIA);
  await Promise.all(
    todas.map((c) =>
      lim(async () => {
        const saldo = await conReintentos(() => publico.getBalance({ address: c.address }));
        if (saldo <= costo * 2n) return;
        const valorEnviar = saldo - costo;
        const nonce = await conReintentos(() => publico.getTransactionCount({ address: c.address, blockTag: "pending" }));
        const raw = await c.signTransaction({
          chainId: red.id, type: "eip1559", to: deployer.address, value: valorEnviar, gas: 21_000n, nonce, ...fees,
        });
        try {
          await conReintentos(() => publico.sendRawTransaction({ serializedTransaction: raw }));
          total += valorEnviar;
        } catch (e) {
          log(`  no se pudo recuperar de ${c.address}: ${explicarError(e)}`);
        }
      }),
    ),
  );
  rastreador.detener();
  log(`✓ Enviados ${formatEther(total)} ${sym} de vuelta al deployer ${deployer.address}`);
}

// ─────────────────────────── Fondeo ───────────────────────────
async function fondear() {
  const fees = await remitente.actualizarFees();
  const maxFee = (fees.maxFeePerGas * 11n) / 10n;
  const req = necesidades(maxFee);

  const direcciones = [...req.keys()];
  const saldos = new Map();
  const lim = limitador(CONCURRENCIA);
  await Promise.all(
    direcciones.map((a) => lim(async () => saldos.set(a, await conReintentos(() => publico.getBalance({ address: a }))))),
  );
  const faltantes = direcciones.filter((a) => saldos.get(a) < req.get(a));
  const montosMon = faltantes.map((a) => req.get(a) - saldos.get(a));
  const totalMon = montosMon.reduce((x, y) => x + y, 0n);

  // Tokens: cada donante necesita su monto y la empresa el tope de sus matchings
  const necesitaCop = new Map();
  const sumar = (a, m) => necesitaCop.set(a, (necesitaCop.get(a) ?? 0n) + m);
  for (const { esc, montos, matching } of plan) {
    const ds = donantesDe(esc, montos.length);
    ds.forEach((d, i) => sumar(d.address, montos[i]));
    if (matching) sumar(empresa.address, parseEther(String(matching)));
  }
  const tokenDest = [...necesitaCop.keys()];
  const saldosCop = await Promise.all(
    tokenDest.map((a) =>
      lim(() => conReintentos(() => publico.readContract({ address: reporte.MockCOP, abi: ABI.cop, functionName: "balanceOf", args: [a] }))),
    ),
  );
  const mintDest = [];
  const mintMontos = [];
  tokenDest.forEach((a, i) => {
    const falta = necesitaCop.get(a) - saldosCop[i];
    if (falta > 0n) {
      mintDest.push(a);
      mintMontos.push(falta);
    }
  });

  const gasDeployer =
    GAS.base * 4n + GAS.mintPorDestino * BigInt(mintDest.length) + GAS.dispersarPorDestino * BigInt(faltantes.length);
  const necesarioDeployer = totalMon + gasDeployer * maxFee;
  const saldoDeployer = await publico.getBalance({ address: deployer.address });

  log(`Precio del gas: ${Number(fees.maxFeePerGas) / 1e9} gwei (máx)`);
  log(`Wallets a fondear con ${sym}: ${faltantes.length}  →  ${formatEther(totalMon)} ${sym}`);
  log(`Cuentas a las que acuñar MockCOP: ${mintDest.length}`);
  log(`Deployer ${deployer.address}: saldo ${formatEther(saldoDeployer)} ${sym}, necesita ≈ ${formatEther(necesarioDeployer)} ${sym}`);

  if (flag("--estimar")) {
    const costoReal = (necesarioDeployer * 70n) / 100n;
    log(`(estimación) Costo real aproximado de la corrida: ${formatEther(costoReal)} ${sym}. El sobrante queda en las wallets simuladas y se recupera con --recuperar.`);
    return false;
  }
  if (saldoDeployer < necesarioDeployer) {
    throw new Error(
      `Saldo insuficiente en el deployer. Consigue ${sym} en https://faucet.monad.xyz o usa menos donantes (--donantes 20).`,
    );
  }

  // Un solo tx para acuñar tokens y uno para repartir MON (por lotes de 100)
  for (let i = 0; i < mintDest.length; i += 100) {
    const r = await remitente.enviar(deployer, {
      address: reporte.MockCOP, abi: ABI.cop, functionName: "mintLote",
      args: [mintDest.slice(i, i + 100), mintMontos.slice(i, i + 100)], etiqueta: "mintLote",
    });
    log(`✓ MockCOP acuñados a ${Math.min(100, mintDest.length - i)} cuentas en 1 tx (${r.ms} ms)`);
  }
  for (let i = 0; i < faltantes.length; i += 100) {
    const dest = faltantes.slice(i, i + 100);
    const montos = montosMon.slice(i, i + 100);
    const total = montos.reduce((x, y) => x + y, 0n);
    if (esMonad) await dormir(1500); // excepción de "emptying" de Monad: sin tx en los últimos 3 bloques
    const r = await remitente.enviar(deployer, {
      address: reporte.Dispersor, abi: ABI.dispersor, functionName: "dispersar",
      args: [dest, montos], value: total, etiqueta: "dispersar",
    });
    log(`✓ ${formatEther(total)} ${sym} repartidos a ${dest.length} wallets en 1 tx (${r.ms} ms)`);
  }
  return true;
}

// ─────────────────────────── Evidencias ───────────────────────────
function cercaDe(zona) {
  const j = () => (rngLugares() - 0.5) * 0.008;
  return { lat: Number((zona.lat + j()).toFixed(6)), lng: Number((zona.lng + j()).toFixed(6)), precisionM: 25, lugar: zona.lugar };
}

/**
 * Sube la imagen al almacén de evidencias y un documento JSON que la describe (fecha, lugar,
 * hash de la imagen). En la cadena quedan el keccak256 y el ipfs:// del documento.
 */
async function evidencia({ clase, campana, etapa, titulo, nota, zona, svg, nombreArchivo, autor }) {
  const img = await guardar(new TextEncoder().encode(svg), "image/svg+xml");
  const doc = {
    tipo: "rastro-solidario/evidencia",
    version: 1,
    clase,
    campana,
    etapa,
    titulo,
    nota,
    fecha: new Date().toISOString(),
    ubicacion: zona ? cercaDe(zona) : null,
    archivos: [{ uri: img.uri, nombre: nombreArchivo, tipo: "image/svg+xml", keccak256: img.keccak256 }],
    autor,
  };
  const j = await guardarJson(doc);
  return { hash: j.keccak256, uri: j.uri };
}

const ITEMS = [
  (unidades, monto) => [{ descripcion: "Mercado familiar (arroz, granos, aceite, panela, enlatados)", cantidad: unidades, unitario: Number(formatEther(monto)) / unidades }],
  (unidades, monto) => [{ descripcion: "Kit de techo (6 tejas de zinc, amarres, puntillas)", cantidad: unidades, unitario: Number(formatEther(monto)) / unidades }],
  (unidades, monto) => [{ descripcion: "Mano de obra: reparación de viviendas afectadas", cantidad: unidades, unitario: Number(formatEther(monto)) / unidades }],
];
const TITULOS_ENTREGA = ["Entrega de mercados", "Entrega de kits de techo", "Reparación de viviendas"];

// ─────────────────────────── Campañas ───────────────────────────
function configCampana({ nombre, descripcion, meta, duracionRecaudo, plazos, quorum = 0 }) {
  return {
    nombre,
    descripcion,
    meta,
    duracionRecaudo: BigInt(duracionRecaudo),
    verificadores: verificadores.map((v) => v.address),
    umbral: 2,
    descripcionesEtapas: ["Mercados", "Materiales", "Reconstrucción"],
    porcentajesBps: [3000, 4000, 3000],
    plazosEtapas: plazos.map(BigInt),
    preciosReferencia: PRECIOS_REFERENCIA.map((p) => parseEther(String(p))),
    unidadesReferencia: UNIDADES_REFERENCIA,
    quorumBeneficiariosBps: quorum,
  };
}

async function crearCampana(cfg) {
  const r = await remitente.enviar(fundacion, {
    address: reporte.CampanaFactory, abi: ABI.factory, functionName: "crearCampana", args: [cfg], etiqueta: "crearCampana",
  });
  const recibo = await publico.getTransactionReceipt({ hash: r.hash });
  const [ev] = parseEventLogs({ abi: ABI.factory, logs: recibo.logs, eventName: "CampanaCreada" });
  log(`✓ Campaña creada por la fundación: ${ev.args.campana}  "${cfg.nombre}"`);
  return { direccion: ev.args.campana, tx: r.hash };
}

async function registrarCenso(campana, familias) {
  const r = await remitente.enviar(verificadores[1], {
    address: campana, abi: ABI.campana, functionName: "registrarBeneficiarios",
    args: [familias.map((f) => f.address)], etiqueta: "registrarBeneficiarios",
  });
  log(`✓ La Junta de Acción Comunal registró el censo: ${familias.length} familias (1 tx, ${r.ms} ms). Cada una recibe una tarjeta con QR.`);
  return r.hash;
}

async function comprometerMatching(campana, topePesos) {
  const tope = parseEther(String(topePesos));
  await remitente.enviar(empresa, { address: reporte.MockCOP, abi: ABI.cop, functionName: "approve", args: [campana, tope], etiqueta: "approve matching" });
  const r = await remitente.enviar(empresa, {
    address: campana, abi: ABI.campana, functionName: "comprometerMatching", args: [10_000, tope], etiqueta: "comprometerMatching",
  });
  log(`✓ Empresa aliada bloqueó ${pesos(tope)} MockCOP en el contrato: duplicará cada donación hasta agotarlos`);
  return r.hash;
}

async function firmarPermit(donante, spender, monto, deadline) {
  const nonce = await conReintentos(() =>
    publico.readContract({ address: reporte.MockCOP, abi: ABI.cop, functionName: "nonces", args: [donante.address] }),
  );
  const firma = await donante.signTypedData({
    domain: { name: "MockCOP", version: "1", chainId: red.id, verifyingContract: reporte.MockCOP },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: donante.address, spender, value: monto, nonce, deadline },
  });
  const { r, s, v, yParity } = parseSignature(firma);
  return { r, s, v: v !== undefined ? Number(v) : yParity + 27 };
}

async function donar(campana, donante, monto, gasExtra = 0n) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const { v, r, s } = await firmarPermit(donante, campana, monto, deadline);
  return remitente.enviar(donante, {
    address: campana, abi: ABI.campana, functionName: "donarConPermit",
    args: [monto, deadline, v, r, s], gasExtra, etiqueta: "donarConPermit",
  });
}

/**
 * Donaciones en paralelo. Si `cierraAlFinal`, la última (la que completa la meta y cierra el
 * recaudo) va sola al final.
 */
async function donaciones(campana, donantes, montos, { cierraAlFinal = true } = {}) {
  const lim = limitador(CONCURRENCIA);
  const resultados = [];
  const fallas = [];
  const inicio = Date.now();
  const enParalelo = cierraAlFinal ? donantes.slice(0, -1) : donantes;
  log(`→ Enviando ${enParalelo.length} donaciones en paralelo (concurrencia ${CONCURRENCIA})...`);
  await Promise.all(
    enParalelo.map((d, i) =>
      lim(async () => {
        try {
          resultados.push({ i, ...(await donar(campana, d, montos[i])) });
          if (resultados.length % 10 === 0) log(`  ${resultados.length} confirmadas`);
        } catch (e) {
          fallas.push({ i, error: explicarError(e) });
        }
      }),
    ),
  );
  const finParalelo = Date.now();
  const ultima = donantes.length - 1;
  if (cierraAlFinal) {
    const rUlt = await donar(campana, donantes[ultima], montos[ultima]);
    resultados.push({ i: ultima, ...rUlt });
    log(`✓ Última donación completa la meta y cierra el recaudo automáticamente (bloque ${rUlt.bloque})`);
  }
  if (fallas.length) log(`⚠ ${fallas.length} donaciones fallaron: ${[...new Set(fallas.map((f) => f.error))].join(" | ")}`);

  const paralelas = resultados.filter((r) => !cierraAlFinal || r.i !== ultima);
  const t0 = Math.min(...paralelas.map((r) => r.t0));
  const t1 = Math.max(...paralelas.map((r) => r.t1));
  const bloques = new Set(paralelas.map((r) => r.bloque));
  const porBloque = {};
  for (const r of paralelas) porBloque[r.bloque] = (porBloque[r.bloque] || 0) + 1;
  return {
    enviadas: donantes.length,
    exitosas: resultados.length,
    fallidas: fallas.length,
    errores: fallas,
    paralelo: {
      cantidad: paralelas.length,
      ventanaMs: t1 - t0,
      tps: Number((paralelas.length / (Math.max(1, t1 - t0) / 1000)).toFixed(1)),
      latenciaMs: estadisticas(paralelas.map((r) => r.ms)),
      bloquesUsados: bloques.size,
      maxDonacionesEnUnBloque: Math.max(...Object.values(porBloque)),
      duracionTotalMs: finParalelo - inicio,
    },
    gasLimitPromedio: Number(resultados.reduce((a, r) => a + r.gasLimit, 0n) / BigInt(resultados.length)),
    gasUsadoPromedio: Number(resultados.reduce((a, r) => a + r.gasUsed, 0n) / BigInt(resultados.length)),
    costoPromedio: formatEther(resultados.reduce((a, r) => a + r.costo, 0n) / BigInt(resultados.length)),
    txEjemplo: resultados[0]?.hash,
  };
}

const leer = (campana, functionName, a = []) =>
  conReintentos(() => publico.readContract({ address: campana, abi: ABI.campana, functionName, args: a }));

async function proponer(campana, etapa, proveedor, unidades, monto, zona) {
  const numero = `FE-${1040 + etapa}${Math.floor(rngLugares() * 90 + 10)}`;
  const items = ITEMS[etapa](unidades, monto);
  const ev = await evidencia({
    clase: "factura", campana, etapa, zona,
    titulo: `Factura ${numero} · ${NOMBRES_PROVEEDORES[etapa]}`,
    nota: `${unidades} × ${items[0].descripcion}`,
    svg: svgFactura({ proveedor: NOMBRES_PROVEEDORES[etapa], nit: NITS[etapa], numero, fecha: hoy(), items, total: Number(formatEther(monto)) }),
    nombreArchivo: `factura-${numero}.svg`,
    autor: fundacion.address,
  });
  const r = await remitente.enviar(fundacion, {
    address: campana, abi: ABI.campana, functionName: "proponerDesembolso",
    args: [BigInt(etapa), proveedor, ev.hash, ev.uri, unidades], etiqueta: "proponerDesembolso",
  });
  return { ...r, hashEvidencia: ev.hash, uriEvidencia: ev.uri };
}

/**
 * Un verificador confirma o rechaza. Al confirmar reporta cuántas unidades contó en campo
 * (por defecto, las que dice la factura); si contó menos, el contrato lo registra como rechazo.
 */
async function votar(campana, etapa, idx, confirma, zona, nota, contadas) {
  const v = verificadores[idx];
  const nombres = ["Defensa Civil", "Junta de Acción Comunal", "Personería Municipal"];
  if (confirma && contadas === undefined) contadas = Number((await leer(campana, "etapa", [BigInt(etapa)])).unidades);
  const conteo = confirma && contadas > 0 ? ` Unidades contadas en campo: ${contadas}.` : "";
  const ev = await evidencia({
    clase: confirma ? "acta" : "rechazo", campana, etapa, zona,
    titulo: confirma ? `Acta de entrega · ${nombres[idx]}` : `Rechazo · ${nombres[idx]}`,
    nota: (nota ?? (confirma ? "Se verificó la entrega en el sitio." : "La entrega no ocurrió: la bodega del proveedor estaba vacía.")) + conteo,
    svg: confirma
      ? svgEntrega({ titulo: `${TITULOS_ENTREGA[etapa]} · verificado por ${nombres[idx]}`, lugar: zona.lugar, fecha: hoy(), tipo: etapa === 1 ? "techo" : "mercados" })
      : svgRechazo({ titulo: `Visita de verificación · ${nombres[idx]}`, lugar: zona.lugar, fecha: hoy() }),
    nombreArchivo: `${confirma ? "acta" : "rechazo"}-etapa${etapa + 1}-${idx + 1}.svg`,
    autor: v.address,
  });
  return remitente.enviar(v, {
    address: campana, abi: ABI.campana,
    functionName: confirma ? "confirmarEntrega" : "rechazarEtapa",
    args: confirma ? [BigInt(etapa), ev.hash, ev.uri, contadas] : [BigInt(etapa), ev.hash, ev.uri],
    etiqueta: confirma ? "confirmarEntrega" : "rechazarEtapa",
  });
}

/** Las familias firman "recibí" con la llave de su QR; el patrocinador lo entrega en UNA tx. */
async function confirmanFamilias(campana, etapa, familias) {
  const data = encodeFunctionData({ abi: ABI.campana, functionName: "confirmarRecepcion", args: [BigInt(etapa)] });
  const solicitudes = await Promise.all(
    familias.map(async (f) => {
      const nonce = await conReintentos(() =>
        publico.readContract({ address: reporte.ReenviadorGas, abi: ABI.reenviador, functionName: "nonces", args: [f.address] }),
      );
      return firmarSolicitud(f, { reenviador: reporte.ReenviadorGas, chainId: red.id, to: campana, data, gas: 250_000n, nonce });
    }),
  );
  // refundReceiver = 0: el lote es atómico (si una firma falla, no pasa ninguna)
  const r = await remitente.enviar(patrocinador, {
    address: reporte.ReenviadorGas, abi: ABI.reenviador, functionName: "executeBatch",
    args: [solicitudes, zeroAddress], etiqueta: "executeBatch (familias)",
  });
  return { ...r, familias: familias.length };
}

async function ejecutarEtapa(campana, i, monto, { unidades, familias, zona, notaSobrecosto }) {
  const prov = proveedores[i];
  const p = await proponer(campana, i, prov, unidades, monto, zona);
  const e = await leer(campana, "etapa", [BigInt(i)]);
  const unitario = monto / BigInt(unidades);
  log(`  Etapa ${i + 1}: la fundación propone pagar ${pesos(monto)} a ${NOMBRES_PROVEEDORES[i]} por ${unidades} unidades ($${pesos(unitario)} c/u) · factura ${p.uriEvidencia.slice(0, 22)}…`);
  if (e.sobrecosto) {
    log(`    ⚠ SOBRECOSTO: $${pesos(unitario)} por ${e.unidad} contra $${pesos(e.precioReferencia)} de referencia (+${Math.round((Number(unitario) / Number(e.precioReferencia) - 1) * 100)} %) → exige ${e.confirmacionesRequeridas} de 3 verificadores`);
  }
  const v1 = await votar(campana, i, 0, true, zona);
  log(`    Verificador 1 confirma con foto del acta (1 de ${e.confirmacionesRequeridas})`);

  let lote = null;
  if (familias?.length && e.beneficiariosRequeridos > 0) {
    const cuantas = Math.min(familias.length, e.beneficiariosRequeridos + 1);
    lote = await confirmanFamilias(campana, i, familias.slice(i, i + cuantas));
    log(`    ${cuantas} familias confirman con su QR (se necesitan ${e.beneficiariosRequeridos}) → 1 sola tx con gas patrocinado (${lote.ms} ms)`);
  }

  let ultima = null;
  for (let idx = 1; idx < e.confirmacionesRequeridas; idx++) {
    const esUltima = idx === e.confirmacionesRequeridas - 1;
    ultima = await votar(campana, i, idx, true, zona, esUltima && e.sobrecosto ? notaSobrecosto : undefined);
    log(`    Verificador ${idx + 1} confirma (${idx + 1} de ${e.confirmacionesRequeridas})${esUltima ? ` → pago automático al proveedor en ${ultima.ms} ms` : ""}`);
  }
  const final = await leer(campana, "etapa", [BigInt(i)]);
  if (Number(final.estado) !== 3) throw new Error(`La etapa ${i + 1} no quedó pagada (estado ${final.estado})`);
  return {
    etapa: i + 1, proveedor: prov, nombreProveedor: NOMBRES_PROVEEDORES[i], monto: monto.toString(), unidades,
    sobrecosto: final.sobrecosto, confirmacionesRequeridas: final.confirmacionesRequeridas,
    familiasConfirmaron: Number(final.confirmacionesBeneficiarios), familiasRequeridas: Number(final.beneficiariosRequeridos),
    txPropuesta: p.hash, uriFactura: p.uriEvidencia, txConfirmacion1: v1.hash, txFamilias: lote?.hash, txPago: ultima.hash, latenciaPagoMs: ultima.ms,
  };
}

async function ejemplosDonantes(campana, donantes, n = 3) {
  const etapas = await leer(campana, "etapas");
  const out = [];
  for (const d of donantes.slice(0, n)) {
    const r = await leer(campana, "resumenDonante", [d.address]);
    const partes = r.partePorEtapa.map((p, i) => `${pesos(p)} en ${etapas[i].descripcion.toLowerCase()}${etapas[i].estado === 3 ? "" : " (no pagado)"}`);
    const texto = `De tus ${pesos(r.aporte)}: ${partes.join(", ")}` +
      (r.matchingGenerado > 0n ? `; además la empresa aliada sumó ${pesos(r.matchingGenerado)} gracias a ti` : "") +
      (r.reembolsado > 0n ? `; reembolsados ${pesos(r.reembolsado)}` : "") +
      (r.pendiente > 0n ? `; pendientes ${pesos(r.pendiente)}` : "");
    out.push({ donante: d.address, texto });
    log(`  ${d.address.slice(0, 8)}… ${texto}`);
  }
  return out;
}

// ─────────────────────────── Escenarios ───────────────────────────
async function escenarioCompleto(montos) {
  log(`\n══ Escenario COMPLETO: ${N_DONANTES} donantes + matching, censo de ${N_FAMILIAS} familias, 3 etapas ══`);
  const metaDonantes = montos.reduce((a, b) => a + b, 0n);
  const meta = metaDonantes + parseEther(String(MATCHING_COMPLETO));
  const { direccion: campana, tx } = await crearCampana(
    configCampana({
      nombre: "Inundación en Antioquia (simulación)",
      descripcion: "Mercados, materiales y reconstrucción para familias damnificadas por la inundación en Bello. Datos simulados para la demo.",
      meta, duracionRecaudo: 3 * 86400, plazos: [86400, 2 * 86400, 7 * 86400], quorum: 3000,
    }),
  );
  const familias = familiasDe("completo");
  const txCenso = await registrarCenso(campana, familias);
  const txMatching = await comprometerMatching(campana, MATCHING_COMPLETO);

  const donantes = donantesDe("completo", N_DONANTES);
  const stats = await donaciones(campana, donantes, montos);
  const infoTrasRecaudo = await leer(campana, "info");
  log(`✓ ${stats.paralelo.cantidad} donaciones paralelas en ${stats.paralelo.ventanaMs} ms → ${stats.paralelo.tps} tx/s; ` +
    `latencia p50 ${stats.paralelo.latenciaMs.p50} ms, p95 ${stats.paralelo.latenciaMs.p95} ms; ${stats.paralelo.bloquesUsados} bloques`);
  log(`✓ Matching usado: ${pesos(infoTrasRecaudo.matchingUsado)} MockCOP (la empresa duplicó las primeras donaciones)`);

  const etapasCfg = await leer(campana, "etapas");
  const zona = ZONAS.completo;
  const etapas = [];
  etapas.push(await ejecutarEtapa(campana, 0, etapasCfg[0].monto, { unidades: 20, familias, zona }));
  etapas.push(await ejecutarEtapa(campana, 1, etapasCfg[1].monto, {
    unidades: 8, familias, zona,
    notaSobrecosto: "Entrega verificada. El precio supera la referencia por el transporte a la zona inundada (vía cerrada); queda constancia en esta acta.",
  }));
  etapas.push(await ejecutarEtapa(campana, 2, etapasCfg[2].monto, { unidades: 4, familias, zona }));
  const info = await leer(campana, "info");
  log(`✓ Campaña finalizada: ${pesos(info.totalPagado)} MockCOP pagados directo a proveedores; la fundación no tocó un peso.`);
  const ejemplos = await ejemplosDonantes(campana, donantes);
  return {
    campana, txCreacion: tx, txCenso, txMatching, meta: meta.toString(), donantes: N_DONANTES, familias: N_FAMILIAS,
    matchingUsado: info.matchingUsado.toString(), donaciones: stats, etapas, ejemplos, estadoFinal: Number(info.estado),
  };
}

async function escenarioFalla(montos) {
  log(`\n══ Escenario FALLA: la etapa 2 se rechaza → reembolsos ══`);
  const meta = montos.reduce((a, b) => a + b, 0n);
  const { direccion: campana, tx } = await crearCampana(
    configCampana({
      nombre: "Deslizamiento en zona rural (simulación de falla)",
      descripcion: "Caso de falla para la demo: la entrega de materiales no ocurre, los verificadores la rechazan y los donantes recuperan lo no gastado.",
      meta, duracionRecaudo: 86400, plazos: [86400, 86400, 86400],
    }),
  );
  const donantes = donantesDe("falla", N_FALLA);
  const stats = await donaciones(campana, donantes, montos);
  const etapasCfg = await leer(campana, "etapas");
  const zona = ZONAS.falla;
  const etapa1 = await ejecutarEtapa(campana, 0, etapasCfg[0].monto, { unidades: 4, zona });

  const p = await proponer(campana, 1, proveedores[1], 2, etapasCfg[1].monto, zona);
  log(`  Etapa 2: la fundación propone pagar ${pesos(etapasCfg[1].monto)} a ${NOMBRES_PROVEEDORES[1]}`);
  const r1 = await votar(campana, 1, 0, false, zona);
  log(`    Verificador 1 RECHAZA con foto de la bodega vacía (la entrega no ocurrió)`);
  const r2 = await votar(campana, 1, 2, true, zona, "En el sitio solo había 1 kit de los 2 facturados.", 1);
  const e2 = await leer(campana, "etapa", [1n]);
  if (!e2.unidadesNoCuadran || Number(e2.estado) !== 4) throw new Error("El conteo en campo debió rechazar la etapa 2");
  log(`    Verificador 3 cuenta 1 de 2 kits facturados → su confirmación cuenta como RECHAZO (2 de 3) → etapa rechazada, campaña en modo reembolso`);

  const reembolsos = [];
  const lim = limitador(CONCURRENCIA);
  await Promise.all(
    donantes.map((d) =>
      lim(async () => {
        const disponible = await leer(campana, "reembolsoDisponible", [d.address]);
        const r = await remitente.enviar(d, { address: campana, abi: ABI.campana, functionName: "reclamarReembolso", etiqueta: "reclamarReembolso" });
        reembolsos.push({ donante: d.address, monto: disponible.toString(), tx: r.hash, ms: r.ms });
      }),
    ),
  );
  const info = await leer(campana, "info");
  log(`✓ ${reembolsos.length} donantes reclamaron ${pesos(info.totalReembolsado)} MockCOP (el 70 % no pagado). Pagado a proveedores: ${pesos(info.totalPagado)}`);
  const ejemplos = await ejemplosDonantes(campana, donantes);
  return {
    campana, txCreacion: tx, meta: meta.toString(), donantes: N_FALLA, donaciones: stats,
    etapas: [etapa1, { etapa: 2, proveedor: proveedores[1], txPropuesta: p.hash, txRechazo1: r1.hash, txRechazo2: r2.hash, estado: "Rechazada" }],
    reembolsos, totalReembolsado: info.totalReembolsado.toString(), ejemplos,
  };
}

async function escenarioAbierta(montos) {
  log(`\n══ Escenario ABIERTA: campaña recaudando para la demo en vivo ══`);
  const meta = parseEther("20000000");
  const { direccion: campana, tx } = await crearCampana(
    configCampana({
      nombre: "Avenida torrencial en Mocoa",
      descripcion: "El río Mulato se desbordó y 20 familias del sector La Playita perdieron sus enseres y parte de sus techos. Mercados, kits de techo y reparación de viviendas.",
      meta, duracionRecaudo: 7 * 86400, plazos: [3 * 86400, 10 * 86400, 30 * 86400], quorum: 3000,
    }),
  );
  const familias = familiasDe("abierta");
  await registrarCenso(campana, familias);
  await comprometerMatching(campana, MATCHING_ABIERTA);
  const donantes = donantesDe("abierta", N_ABIERTA);
  const stats = await donaciones(campana, donantes, montos, { cierraAlFinal: false });
  const info = await leer(campana, "info");
  log(`✓ Recaudado ${pesos(info.totalRecaudado)} de ${pesos(info.meta)} (incluye ${pesos(info.matchingUsado)} de matching). Queda abierta para donar en vivo.`);

  const tarjetas = familias.map((f, i) => ({
    nombre: `Familia ${String(i + 1).padStart(2, "0")} · ${["Sector A", "Sector B", "Sector C", "Sector D"][i % 4]}`,
    cuenta: f.address,
    llave: bytesToHex(f.getHdKey().privateKey),
  }));
  const datos = { chainId: red.id, campana, nota: "SOLO DEMO: llaves de las tarjetas QR de las familias simuladas.", familias: tarjetas };
  const destino = esMonad ? path.join(RAIZ, "reports", `familias-${red.id}.json`) : path.join(RAIZ, "frontend", "public", "familias-demo.json");
  fs.writeFileSync(destino, JSON.stringify(datos, null, 2));
  log(`✓ Tarjetas QR de las ${tarjetas.length} familias en ${path.relative(RAIZ, destino)} (Panel → Censo de beneficiarios)`);
  return { campana, txCreacion: tx, meta: meta.toString(), donaciones: stats, recaudado: info.totalRecaudado.toString(), familias: tarjetas.length };
}

async function escenarioVencimiento(montos) {
  log(`\n══ Escenario VENCIMIENTO: la etapa 1 vence sin aprobarse ══`);
  const meta = montos.reduce((a, b) => a + b, 0n);
  const PLAZO = 40;
  const { direccion: campana, tx } = await crearCampana(
    configCampana({
      nombre: "Vendaval (simulación de plazo vencido)",
      descripcion: "Caso de falla para la demo: la etapa no se aprueba a tiempo y se activa el reembolso.",
      meta, duracionRecaudo: 86400, plazos: [PLAZO, 86400, 86400],
    }),
  );
  const donantes = donantesDe("vencimiento", N_VENCE);
  const stats = await donaciones(campana, donantes, montos);
  const etapasCfg = await leer(campana, "etapas");
  const p = await proponer(campana, 0, proveedores[0], 4, etapasCfg[0].monto, ZONAS.vencimiento);
  await votar(campana, 0, 0, true, ZONAS.vencimiento);
  log(`  Etapa 1 propuesta y con 1 de 3 confirmaciones. Esperando que venza el plazo (${PLAZO} s)...`);
  const limite = Number(etapasCfg[0].fechaLimite);
  while (true) {
    const bloque = await publico.getBlock();
    if (Number(bloque.timestamp) > limite) break;
    await dormir(2000);
  }
  const v = await remitente.enviar(deployer, { address: campana, abi: ABI.campana, functionName: "activarReembolsoPorVencimiento", etiqueta: "activarReembolsoPorVencimiento" });
  log(`  Plazo vencido → un tercero activa el reembolso (${v.hash.slice(0, 10)}…)`);
  const reembolsos = [];
  for (const d of donantes) {
    const r = await remitente.enviar(d, { address: campana, abi: ABI.campana, functionName: "reclamarReembolso", etiqueta: "reclamarReembolso" });
    reembolsos.push({ donante: d.address, tx: r.hash });
  }
  const info = await leer(campana, "info");
  log(`✓ Reembolsado el 100 %: ${pesos(info.totalReembolsado)} MockCOP`);
  return { campana, txCreacion: tx, meta: meta.toString(), donaciones: stats, txPropuesta: p.hash, txVencimiento: v.hash, reembolsos };
}

async function fotoReputacion() {
  const actores = [
    { rol: "Fundación", nombre: "Fundación Antioquia Solidaria", cuenta: fundacion.address },
    ...proveedores.map((c, i) => ({ rol: "Proveedor", nombre: NOMBRES_PROVEEDORES[i], cuenta: c })),
  ];
  const out = [];
  for (const a of actores) {
    const h = await publico.readContract({ address: reporte.HistorialReputacion, abi: ABI.reputacion, functionName: "historial", args: [a.cuenta] });
    const [bps, evaluadas] = await publico.readContract({ address: reporte.HistorialReputacion, abi: ABI.reputacion, functionName: "indiceConfianza", args: [a.cuenta] });
    out.push({ ...a, indice: evaluadas > 0 ? Number(bps) / 100 : null, pagadas: h.etapasPagadas, rechazadas: h.etapasRechazadas, vencidas: h.etapasVencidas, sobrecostos: h.sobrecostos, monto: h.monto.toString() });
  }
  log(`\nReputación on-chain después de la simulación:`);
  for (const a of out) {
    log(`  ${a.nombre.padEnd(30)} índice ${a.indice === null ? "sin historial" : `${a.indice} %`} · ${a.pagadas} pagadas · ${a.rechazadas} rechazadas · ${a.sobrecostos} sobrecostos`);
  }
  return out;
}

// ─────────────────────────── Reporte ───────────────────────────
function escribirReporte(resultado) {
  const base = path.join(RAIZ, "reports", `simulacion-${red.id}`);
  // Si esta corrida fue parcial, conserva los escenarios anteriores del mismo despliegue.
  if (fs.existsSync(`${base}.json`)) {
    try {
      const previo = JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
      if (previo.contratos?.CampanaFactory === reporte.CampanaFactory) {
        resultado.escenarios = { ...previo.escenarios, ...resultado.escenarios };
      }
    } catch {}
  }
  const json = JSON.stringify(resultado, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  fs.writeFileSync(`${base}.json`, json);
  fs.writeFileSync(path.join(RAIZ, "frontend", "public", "simulacion.json"), json);

  const c = resultado.escenarios.completo;
  const f = resultado.escenarios.falla;
  const a = resultado.escenarios.abierta;
  let md = `# Simulación en ${red.name}\n\nFecha: ${resultado.fecha}  \nChain ID: ${red.id}  \nDuración total: ${(resultado.duracionMs / 1000).toFixed(1)} s\n\n`;
  if (c) {
    const p = c.donaciones.paralelo;
    md += `## Escenario completo\n\n- Campaña: \`${c.campana}\`\n- Donantes: ${c.donantes} · matching de la empresa aliada: ${pesos(BigInt(c.matchingUsado))} MockCOP (meta ${pesos(BigInt(c.meta))})\n`;
    md += `- Censo: ${c.familias} familias registradas por la Junta de Acción Comunal; cada etapa exige que el 30 % confirme con su QR\n`;
    md += `- **${p.cantidad} donaciones en paralelo en ${(p.ventanaMs / 1000).toFixed(2)} s → ${p.tps} tx/s**\n`;
    md += `- Latencia de confirmación (envío → bloque): p50 ${p.latenciaMs.p50} ms · p95 ${p.latenciaMs.p95} ms · máx ${p.latenciaMs.max} ms\n`;
    md += `- Bloques usados: ${p.bloquesUsados} (hasta ${p.maxDonacionesEnUnBloque} donaciones en un mismo bloque)\n`;
    md += `- Gas por donación: límite ${c.donaciones.gasLimitPromedio.toLocaleString("es-CO")} · usado ${c.donaciones.gasUsadoPromedio.toLocaleString("es-CO")} · costo ≈ ${Number(c.donaciones.costoPromedio).toFixed(6)} ${sym}\n\n`;
    md += `| Etapa | Proveedor | Monto (MockCOP) | Unidades | Sobrecosto | Verificadores | Familias | Pago (ms) | Tx del pago |\n|---|---|---:|---:|:-:|:-:|:-:|---:|---|\n`;
    for (const e of c.etapas) {
      md += `| ${e.etapa} | ${e.nombreProveedor} | ${pesos(BigInt(e.monto))} | ${e.unidades} | ${e.sobrecosto ? "⚠ sí" : "no"} | ${e.confirmacionesRequeridas} de 3 | ${e.familiasConfirmaron} (mín. ${e.familiasRequeridas}) | ${e.latenciaPagoMs} | ${enlaceTx(e.txPago)} |\n`;
    }
    md += `\n**A dónde fue cada peso (ejemplos):**\n\n${c.ejemplos.map((e) => `- \`${e.donante}\`: ${e.texto}`).join("\n")}\n\n`;
  }
  if (f) {
    md += `## Escenario de falla (etapa rechazada)\n\n- Campaña: \`${f.campana}\`\n- Etapa 1 pagada, etapa 2 rechazada por 2 de 3 verificadores: uno con foto de la bodega vacía y otro que contó 1 de 2 kits facturados (el contrato convirtió su confirmación en rechazo)\n`;
    md += `- ${f.reembolsos.length} donantes reclamaron en total ${pesos(BigInt(f.totalReembolsado))} MockCOP\n\n`;
    md += `${f.ejemplos.map((e) => `- \`${e.donante}\`: ${e.texto}`).join("\n")}\n\n`;
  }
  if (a) {
    md += `## Campaña abierta para la demo en vivo\n\n- Campaña: \`${a.campana}\`\n- Recaudado: ${pesos(BigInt(a.recaudado))} de ${pesos(BigInt(a.meta))} MockCOP (incluye matching)\n- ${a.familias} tarjetas QR de familias listas en el Panel\n\n`;
  }
  if (resultado.reputacion) {
    md += `## Reputación on-chain\n\n| Actor | Rol | Índice | Pagadas | Rechazadas | Sobrecostos |\n|---|---|---:|---:|---:|---:|\n`;
    for (const r of resultado.reputacion) md += `| ${r.nombre} | ${r.rol} | ${r.indice === null ? "—" : `${r.indice} %`} | ${r.pagadas} | ${r.rechazadas} | ${r.sobrecostos} |\n`;
    md += "\n";
  }
  fs.writeFileSync(`${base}.md`, md);
  log(`\n✓ Reporte: reports/simulacion-${red.id}.json y .md (copiado a frontend/public/simulacion.json)`);
}

// ─────────────────────────── Main ───────────────────────────
async function main() {
  log(`Red: ${red.name} (${red.id})  ·  RPC ${red.rpcUrls.default.http[0]}`);
  if (flag("--recuperar")) return recuperar();

  const rng = prng(SEMILLA);
  const montosDe = (esc) => plan.find((p) => p.esc === esc).montos;
  if (correr.completo) plan.find((p) => p.esc === "completo").montos = generarMontos(N_DONANTES, 10_000_000 - MATCHING_COMPLETO, rng);
  if (correr.falla) plan.find((p) => p.esc === "falla").montos = generarMontos(N_FALLA, 2_000_000, rng);
  if (correr.abierta) plan.find((p) => p.esc === "abierta").montos = generarMontos(N_ABIERTA, 2_400_000, rng);
  if (correr.vencimiento) plan.find((p) => p.esc === "vencimiento").montos = generarMontos(N_VENCE, 1_000_000, rng);

  await rastreador.iniciar();
  try {
    if (!(await fondear())) return;
    await remitente.actualizarFees();
    const resultado = { red: red.name, chainId: red.id, fecha: new Date().toISOString(), semilla: SEMILLA, explorador, contratos: reporte, escenarios: {} };
    if (correr.completo) resultado.escenarios.completo = await escenarioCompleto(montosDe("completo"));
    if (correr.falla) resultado.escenarios.falla = await escenarioFalla(montosDe("falla"));
    if (correr.vencimiento) resultado.escenarios.vencimiento = await escenarioVencimiento(montosDe("vencimiento"));
    if (correr.abierta) resultado.escenarios.abierta = await escenarioAbierta(montosDe("abierta"));
    resultado.reputacion = await fotoReputacion();
    resultado.duracionMs = Date.now() - t0Global;
    escribirReporte(resultado);
    if (esMonad) log(`Tip: recupera el ${sym} sobrante de las wallets simuladas con  pnpm simular:monad -- --recuperar`);
  } finally {
    rastreador.detener();
  }
}

main().catch((e) => {
  rastreador.detener();
  console.error(`\n✗ ${e.message || e}`);
  process.exit(1);
});
