// Servicios de la demo que no pueden vivir en el navegador. En desarrollo corren dentro del
// servidor de Vite (pnpm dev); en Vercel, en la función api/servicios.mjs. Es el mismo código.
//
//   POST /api/evidencias            sube una factura, foto o acta → { cid, uri, keccak256 }
//   GET  /ipfs/<cid>                 sirve la evidencia (si no está aquí, redirige a un gateway IPFS)
//   POST /api/pasarela/pago          pago simulado con Nequi / PSE → acuña MockCOP a la billetera invisible
//   POST /api/reenviar               gas patrocinado: entrega una solicitud firmada (ERC-2771) al ReenviadorGas
//   GET  /api/estado                 qué servicios están activos
//
// Llaves (solo las dos que operan la demo; el deployer y el mnemónico no hacen falta en Vercel):
//   PASARELA_PRIVATE_KEY      dueña de MockCOP (acuña). Si falta: SIM_MNEMONIC índice 10 o el deployer,
//                             la que sea dueña en la cadena.
//   PATROCINADOR_PRIVATE_KEY  paga el gas de las acciones sin cripto. Si falta: SIM_MNEMONIC índice 9.
//
// En producción: la pasarela sería un proveedor regulado (on-ramp de pesos a stablecoin), el
// reenvío un servicio de patrocinio de gas (relayer / paymaster ERC-4337) y las evidencias se
// fijarían en IPFS (PINATA_JWT ya lo hace).
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  isAddress,
  isAddressEqual,
  parseEther,
  toFunctionSelector,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { INDICE_PASARELA, INDICE_PATROCINADOR, MNEMONIC_ANVIL, PK_ANVIL_0, RAIZ, redPorNombre, transporteRed } from "./lib/entorno.mjs";
import { MAX_BYTES, gatewayPublico, guardar, leer, puedeGuardar } from "./lib/evidencias.mjs";

const ABI_FORWARDER = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ type: "bool" }],
  },
];
const ABI_FACTORY = [{ type: "function", name: "esCampana", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] }];
const ABI_COP = [
  { type: "function", name: "mintLote", stateMutability: "nonpayable", inputs: [{ type: "address[]" }, { type: "uint256[]" }], outputs: [] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

/** Solo se patrocina gas para estas acciones (las que hace alguien sin cripto). */
const PERMITIDAS = {
  [toFunctionSelector("donarConPermit(uint256,uint256,uint8,bytes32,bytes32)")]: "donar",
  [toFunctionSelector("confirmarRecepcion(uint256)")]: "confirmar recepción",
  [toFunctionSelector("reclamarReembolso()")]: "reclamar reembolso",
};
/** En el contrato NombresDonantes: el donante decide si aparece con su nombre o anónimo. */
const PERMITIDAS_NOMBRES = {
  [toFunctionSelector("mostrarNombre(address,string)")]: "mostrar nombre",
  [toFunctionSelector("ocultarNombre(address)")]: "volver a anónimo",
};
const GAS_MAXIMO = 1_500_000n;

/** En Monad se cobra el gas LIMIT: falla con un mensaje claro si la cuenta no alcanza a pagarlo. */
async function exigirSaldo(ctx, cuenta, gas, quien) {
  const [saldo, precio] = await Promise.all([ctx.publico.getBalance({ address: cuenta }), ctx.publico.getGasPrice()]);
  const necesario = (gas * precio * 12n) / 10n;
  if (saldo < necesario) {
    const sym = ctx.red.nativeCurrency.symbol;
    throw Object.assign(
      new Error(`${quien} se quedó sin ${sym} (tiene ${formatEther(saldo)}, necesita ≈ ${formatEther(necesario)}). Recárgalo con: pnpm recargar:monad`),
      { estado: 503 },
    );
  }
}
const MAX_PAGO_PESOS = 5_000_000;

/** Cuánto se espera a que una transacción entre a un bloque antes de rendirse. */
const ESPERA_RECIBO_MS = 60_000;

const deLlave = (pk) => privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);

// Los clientes se crean una vez por despliegue (se recrean si cambia reports/deploy-<id>.json).
let ctxCache = null;
function contexto(chainId) {
  const red = redPorNombre(String(chainId));
  const ruta = path.join(RAIZ, "reports", `deploy-${chainId}.json`);
  if (!fs.existsSync(ruta)) return null;
  const version = fs.statSync(ruta).mtimeMs;
  if (ctxCache?.ruta === ruta && ctxCache.version === version) return ctxCache.ctx;
  const reporte = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const esLocal = red.id === 31337;
  const env = process.env;
  const mnemonic = esLocal ? MNEMONIC_ANVIL : env.SIM_MNEMONIC;

  // Quien puede acuñar MockCOP es su dueño en la cadena: se prueba con cada llave disponible.
  const candidatasPasarela = [
    env.PASARELA_PRIVATE_KEY && deLlave(env.PASARELA_PRIVATE_KEY),
    mnemonic && mnemonicToAccount(mnemonic, { addressIndex: INDICE_PASARELA }),
    esLocal ? deLlave(PK_ANVIL_0) : env.DEPLOYER_PRIVATE_KEY && deLlave(env.DEPLOYER_PRIVATE_KEY),
  ].filter(Boolean);
  const cuentaPatrocinador = env.PATROCINADOR_PRIVATE_KEY
    ? deLlave(env.PATROCINADOR_PRIVATE_KEY)
    : mnemonic && mnemonicToAccount(mnemonic, { addressIndex: INDICE_PATROCINADOR });

  const transporte = transporteRed(red, { ranking: true });
  // Monad produce un bloque cada ~400 ms: consultar recibos cada 500 ms en vez de cada 4 s.
  const pollingInterval = esLocal ? 1000 : 500;
  const billetera = (account) => createWalletClient({ chain: red, transport: transporte, pollingInterval, account });
  const publico = createPublicClient({ chain: red, transport: transporte, pollingInterval });
  let emisor;
  const ctx = {
    red,
    reporte,
    publico,
    patrocinador: cuentaPatrocinador ? billetera(cuentaPatrocinador) : null,
    /** Billetera dueña de MockCOP (null si ninguna llave disponible lo es). */
    async emisor() {
      if (emisor !== undefined) return emisor;
      if (candidatasPasarela.length === 0) return (emisor = null);
      const dueno = await publico.readContract({ address: reporte.MockCOP, abi: ABI_COP, functionName: "owner" });
      const cuenta = candidatasPasarela.find((c) => isAddressEqual(c.address, dueno));
      return (emisor = cuenta ? billetera(cuenta) : null);
    },
  };
  ctxCache = { ruta, version, ctx };
  return ctx;
}

/**
 * Envía una transacción reintentando si el nonce chocó: en Vercel puede haber varias instancias
 * enviando con la misma cuenta a la vez, y la cola en memoria solo ordena las de una instancia.
 */
async function enviarConReintento(fn) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const m = String(e?.details || e?.shortMessage || e?.message || e).toLowerCase();
      const choque = m.includes("nonce") || m.includes("already known") || m.includes("replacement transaction underpriced");
      if (!choque || i >= 3) throw e;
      await dormir(400 + Math.random() * 600);
    }
  }
}

// ─── Límites de uso por IP (en memoria, por instancia) ───
// Evitan que alguien vacíe el saldo del patrocinador llamando la API en bucle. Las peticiones
// desde el mismo computador (pnpm dev, pruebas) no se limitan.
const LIMITES = {
  pago: { max: Number(process.env.LIMITE_PAGOS_IP || 10), ventanaMs: 10 * 60_000, texto: "pagos" },
  reenviar: { max: Number(process.env.LIMITE_REENVIOS_IP || 30), ventanaMs: 10 * 60_000, texto: "operaciones sin gas" },
  evidencias: { max: Number(process.env.LIMITE_EVIDENCIAS_IP || 30), ventanaMs: 10 * 60_000, texto: "archivos" },
};
const usos = new Map(); // "accion|ip" -> [marcas de tiempo]

function ipDe(req) {
  const reenviada = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return reenviada || req.headers["x-real-ip"] || req.socket?.remoteAddress || "?";
}
const esLoopback = (ip) => ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

function limitar(accion, req) {
  const ip = ipDe(req);
  if (esLoopback(ip) && !process.env.VERCEL) return;
  const { max, ventanaMs, texto } = LIMITES[accion];
  const ahora = Date.now();
  const clave = `${accion}|${ip}`;
  const recientes = (usos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= max) {
    throw Object.assign(new Error(`Demasiados ${texto} desde tu conexión. Espera unos minutos e inténtalo de nuevo.`), { estado: 429 });
  }
  recientes.push(ahora);
  usos.set(clave, recientes);
  if (usos.size > 10_000) usos.clear(); // memoria acotada
}

// Cada cuenta envía de a una transacción (evita choques de nonce entre peticiones simultáneas).
const colas = new Map();
function enCola(clave, fn) {
  const previa = colas.get(clave) ?? Promise.resolve();
  const actual = previa.catch(() => {}).then(fn);
  colas.set(clave, actual);
  return actual;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function leerCuerpo(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > limite) {
        reject(new Error("El archivo es demasiado grande"));
        req.destroy();
      } else partes.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}

function responder(res, estado, cuerpo) {
  res.statusCode = estado;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(cuerpo, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/** Datos del revert (para que el navegador lo traduzca con el ABI de la campaña). */
function datosRevert(e) {
  let x = e;
  while (x) {
    if (typeof x.data === "string" && x.data.startsWith("0x")) return x.data;
    if (x.data?.data && typeof x.data.data === "string") return x.data.data;
    x = x.cause;
  }
  return undefined;
}

async function reenviar(ctx, cuerpo) {
  if (!ctx.patrocinador) throw Object.assign(new Error("No hay patrocinador de gas configurado (PATROCINADOR_PRIVATE_KEY o SIM_MNEMONIC)"), { estado: 503 });
  const r = cuerpo?.request;
  if (!r || !isAddress(r.from) || !isAddress(r.to) || typeof r.data !== "string" || typeof r.signature !== "string") {
    throw Object.assign(new Error("Solicitud inválida"), { estado: 400 });
  }
  const req = {
    from: r.from,
    to: r.to,
    value: BigInt(r.value ?? 0),
    gas: BigInt(r.gas),
    deadline: Number(r.deadline),
    data: r.data,
    signature: r.signature,
  };
  if (req.value !== 0n) throw Object.assign(new Error("No se patrocinan envíos de valor"), { estado: 400 });
  if (req.gas > GAS_MAXIMO) throw Object.assign(new Error("Gas solicitado demasiado alto"), { estado: 400 });
  const { publico, reporte } = ctx;
  // El contrato de nombres valida él mismo la campaña y que quien firma haya donado.
  const aNombres = !!reporte.NombresDonantes && isAddressEqual(req.to, reporte.NombresDonantes);
  const accion = (aNombres ? PERMITIDAS_NOMBRES : PERMITIDAS)[req.data.slice(0, 10).toLowerCase()];
  if (!accion) throw Object.assign(new Error("Esa acción no tiene gas patrocinado"), { estado: 403 });
  if (!aNombres) {
    const oficial = await publico.readContract({ address: reporte.CampanaFactory, abi: ABI_FACTORY, functionName: "esCampana", args: [req.to] });
    if (!oficial) throw Object.assign(new Error("Solo se patrocinan campañas oficiales"), { estado: 403 });
  }
  const firmaValida = await publico.readContract({ address: reporte.ReenviadorGas, abi: ABI_FORWARDER, functionName: "verify", args: [req] });
  if (!firmaValida) throw Object.assign(new Error("La firma no es válida o ya se usó"), { estado: 400 });

  // Se ensaya la llamada como si la hiciera el firmante: si va a fallar, el navegador recibe
  // el motivo exacto (p. ej. "YaConfirmo") sin gastar gas del patrocinador.
  try {
    await publico.call({ account: req.from, to: req.to, data: req.data });
  } catch (e) {
    throw Object.assign(new Error(e.shortMessage || "La acción revertiría"), { estado: 422, revert: datosRevert(e) });
  }

  await exigirSaldo(ctx, ctx.patrocinador.account.address, req.gas + 100_000n, "El patrocinador de gas");
  return enCola(ctx.patrocinador.account.address, async () => {
    const estimado = await publico.estimateContractGas({
      account: ctx.patrocinador.account,
      address: reporte.ReenviadorGas,
      abi: ABI_FORWARDER,
      functionName: "execute",
      args: [req],
    });
    const hash = await enviarConReintento(() =>
      ctx.patrocinador.writeContract({
        address: reporte.ReenviadorGas,
        abi: ABI_FORWARDER,
        functionName: "execute",
        args: [req],
        gas: estimado + estimado / 5n,
      }),
    );
    const recibo = await publico.waitForTransactionReceipt({ hash, timeout: ESPERA_RECIBO_MS });
    if (recibo.status !== "success") throw Object.assign(new Error("La transacción revirtió"), { estado: 500, hash });
    return { hash, bloque: recibo.blockNumber, accion, patrocinador: ctx.patrocinador.account.address, gasPagado: recibo.gasUsed * recibo.effectiveGasPrice };
  });
}

async function pago(ctx, cuerpo) {
  const emisor = await ctx.emisor();
  if (!emisor) throw Object.assign(new Error("La pasarela simulada no tiene la llave de la dueña de MockCOP (PASARELA_PRIVATE_KEY)"), { estado: 503 });
  const cuenta = cuerpo?.cuenta;
  const monto = Math.floor(Number(cuerpo?.montoPesos));
  const metodo = cuerpo?.metodo === "pse" ? "pse" : "nequi";
  if (!isAddress(cuenta)) throw Object.assign(new Error("Cuenta inválida"), { estado: 400 });
  if (!(monto >= 1000 && monto <= MAX_PAGO_PESOS)) {
    throw Object.assign(new Error(`El monto debe estar entre 1.000 y ${MAX_PAGO_PESOS.toLocaleString("es-CO")}`), { estado: 400 });
  }
  await exigirSaldo(ctx, emisor.account.address, 150_000n, "La cuenta de la pasarela");
  await dormir(900); // la pasarela "procesa" el pago
  const hash = await enCola(emisor.account.address, () =>
    enviarConReintento(() =>
      emisor.writeContract({ address: ctx.reporte.MockCOP, abi: ABI_COP, functionName: "mintLote", args: [[cuenta], [parseEther(String(monto))]] }),
    ),
  );
  const recibo = await ctx.publico.waitForTransactionReceipt({ hash, timeout: ESPERA_RECIBO_MS });
  if (recibo.status !== "success") throw Object.assign(new Error("La acreditación de MockCOP revirtió"), { estado: 500, hash });
  const referencia = `${metodo === "pse" ? "PSE" : "NEQ"}-${Date.now().toString(36).toUpperCase()}`;
  return { aprobado: true, metodo, referencia, montoPesos: monto, txAcunacion: hash };
}

/**
 * Atiende /api/* y /ipfs/*. Devuelve false si la ruta no es de los servicios.
 * @param {string} [ruta] ruta pedida, si no es la de req.url (en Vercel llega por un rewrite)
 */
export async function manejar(req, res, { chainId, ruta }) {
  const pathname = ruta ?? new URL(req.url, "http://x").pathname;
  try {
    if (req.method === "GET" && pathname.startsWith("/ipfs/")) {
      const cid = pathname.slice(6).split("/")[0];
      const archivo = leer(cid);
      if (!archivo) {
        res.statusCode = 302;
        res.setHeader("location", gatewayPublico() + cid);
        res.end();
        return true;
      }
      res.setHeader("content-type", archivo.tipo);
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
      res.setHeader("x-content-type-options", "nosniff");
      // Un SVG subido no debe poder ejecutar scripts en el origen de la app.
      res.setHeader("content-security-policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
      res.end(archivo.bytes);
      return true;
    }
    if (!pathname.startsWith("/api/")) return false;

    const ctx = contexto(chainId);
    if (pathname === "/api/estado" && req.method === "GET") {
      const [saldo, emisor] = await Promise.all([
        ctx?.patrocinador ? ctx.publico.getBalance({ address: ctx.patrocinador.account.address }).catch(() => null) : null,
        ctx ? ctx.emisor().catch(() => null) : null,
      ]);
      responder(res, 200, {
        desplegado: !!ctx,
        pasarela: !!emisor,
        patrocinador: ctx?.patrocinador?.account.address ?? null,
        saldoPatrocinador: saldo,
        ipfs: process.env.PINATA_JWT ? "pinata" : "local",
        evidencias: puedeGuardar(),
        gateway: gatewayPublico(),
      });
      return true;
    }
    if (req.method !== "POST") {
      responder(res, 405, { error: "Método no permitido" });
      return true;
    }

    if (pathname === "/api/evidencias") {
      limitar("evidencias", req);
      const bytes = await leerCuerpo(req, MAX_BYTES);
      const tipo = String(req.headers["content-type"] || "").split(";")[0].trim();
      responder(res, 200, await guardar(bytes, tipo));
      return true;
    }
    if (!ctx) {
      responder(res, 503, { error: "Aún no hay contratos desplegados en esta red (pnpm deploy:local)" });
      return true;
    }
    if (pathname === "/api/reenviar" || pathname === "/api/pasarela/pago") {
      const esPago = pathname === "/api/pasarela/pago";
      limitar(esPago ? "pago" : "reenviar", req);
      const cuerpo = JSON.parse((await leerCuerpo(req, 64 * 1024)).toString("utf8") || "{}");
      responder(res, 200, esPago ? await pago(ctx, cuerpo) : await reenviar(ctx, cuerpo));
      return true;
    }
    responder(res, 404, { error: "No existe" });
  } catch (e) {
    responder(res, e.estado ?? 500, { error: e.shortMessage || e.message || String(e), revert: e.revert, hash: e.hash });
  }
  return true;
}

/** Plugin de Vite: monta los servicios en el servidor de desarrollo y en `vite preview`. */
export function serviciosRastro({ chainId }) {
  const montar = (server) => {
    server.middlewares.use(async (req, res, next) => {
      if (!(await manejar(req, res, { chainId }))) next();
    });
  };
  return { name: "rastro-servicios", configureServer: montar, configurePreviewServer: montar };
}
