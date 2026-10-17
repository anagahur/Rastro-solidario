// Servicios de la demo que no pueden vivir en el navegador. Corren dentro del servidor de Vite
// (pnpm dev), así que no hay que levantar nada aparte.
//
//   POST /api/evidencias            sube una factura, foto o acta → { cid, uri, keccak256 }
//   GET  /ipfs/<cid>                 sirve la evidencia (si no está aquí, redirige a un gateway IPFS)
//   POST /api/pasarela/pago          pago simulado con Nequi / PSE → acuña MockCOP a la billetera invisible
//   POST /api/reenviar               gas patrocinado: entrega una solicitud firmada (ERC-2771) al ReenviadorGas
//   GET  /api/estado                 qué servicios están activos
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
  parseEther,
  toFunctionSelector,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { MNEMONIC_ANVIL, PK_ANVIL_0, RAIZ, redPorNombre, transporteRed } from "./lib/entorno.mjs";
import { MAX_BYTES, gatewayPublico, guardar, leer } from "./lib/evidencias.mjs";

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
];

/** Solo se patrocina gas para estas acciones (las que hace alguien sin cripto). */
const PERMITIDAS = {
  [toFunctionSelector("donarConPermit(uint256,uint256,uint8,bytes32,bytes32)")]: "donar",
  [toFunctionSelector("confirmarRecepcion(uint256)")]: "confirmar recepción",
  [toFunctionSelector("reclamarReembolso()")]: "reclamar reembolso",
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
  const pk = esLocal ? PK_ANVIL_0 : process.env.DEPLOYER_PRIVATE_KEY;
  const mnemonic = esLocal ? MNEMONIC_ANVIL : process.env.SIM_MNEMONIC;
  const transporte = transporteRed(red);
  // Monad produce un bloque cada ~400 ms: consultar recibos cada 500 ms en vez de cada 4 s.
  const pollingInterval = esLocal ? 1000 : 500;
  const ctx = {
    red,
    reporte,
    publico: createPublicClient({ chain: red, transport: transporte, pollingInterval }),
    emisor: pk ? createWalletClient({ chain: red, transport: transporte, pollingInterval, account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`) }) : null,
    patrocinador: mnemonic ? createWalletClient({ chain: red, transport: transporte, pollingInterval, account: mnemonicToAccount(mnemonic, { addressIndex: 9 }) }) : null,
  };
  ctxCache = { ruta, version, ctx };
  return ctx;
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
  if (!ctx.patrocinador) throw Object.assign(new Error("No hay patrocinador de gas configurado (SIM_MNEMONIC)"), { estado: 503 });
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
  const accion = PERMITIDAS[req.data.slice(0, 10).toLowerCase()];
  if (!accion) throw Object.assign(new Error("Esa acción no tiene gas patrocinado"), { estado: 403 });

  const { publico, reporte } = ctx;
  const oficial = await publico.readContract({ address: reporte.CampanaFactory, abi: ABI_FACTORY, functionName: "esCampana", args: [req.to] });
  if (!oficial) throw Object.assign(new Error("Solo se patrocinan campañas oficiales"), { estado: 403 });
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
    const hash = await ctx.patrocinador.writeContract({
      address: reporte.ReenviadorGas,
      abi: ABI_FORWARDER,
      functionName: "execute",
      args: [req],
      gas: estimado + estimado / 5n,
    });
    const recibo = await publico.waitForTransactionReceipt({ hash, timeout: ESPERA_RECIBO_MS });
    if (recibo.status !== "success") throw Object.assign(new Error("La transacción revirtió"), { estado: 500, hash });
    return { hash, bloque: recibo.blockNumber, accion, patrocinador: ctx.patrocinador.account.address, gasPagado: recibo.gasUsed * recibo.effectiveGasPrice };
  });
}

async function pago(ctx, cuerpo) {
  if (!ctx.emisor) throw Object.assign(new Error("La pasarela simulada necesita la llave del administrador"), { estado: 503 });
  const cuenta = cuerpo?.cuenta;
  const monto = Math.floor(Number(cuerpo?.montoPesos));
  const metodo = cuerpo?.metodo === "pse" ? "pse" : "nequi";
  if (!isAddress(cuenta)) throw Object.assign(new Error("Cuenta inválida"), { estado: 400 });
  if (!(monto >= 1000 && monto <= MAX_PAGO_PESOS)) {
    throw Object.assign(new Error(`El monto debe estar entre 1.000 y ${MAX_PAGO_PESOS.toLocaleString("es-CO")}`), { estado: 400 });
  }
  await exigirSaldo(ctx, ctx.emisor.account.address, 150_000n, "La cuenta administradora (pasarela)");
  await dormir(900); // la pasarela "procesa" el pago
  const hash = await enCola(ctx.emisor.account.address, () =>
    ctx.emisor.writeContract({ address: ctx.reporte.MockCOP, abi: ABI_COP, functionName: "mintLote", args: [[cuenta], [parseEther(String(monto))]] }),
  );
  const recibo = await ctx.publico.waitForTransactionReceipt({ hash, timeout: ESPERA_RECIBO_MS });
  if (recibo.status !== "success") throw Object.assign(new Error("La acreditación de MockCOP revirtió"), { estado: 500, hash });
  const referencia = `${metodo === "pse" ? "PSE" : "NEQ"}-${Date.now().toString(36).toUpperCase()}`;
  return { aprobado: true, metodo, referencia, montoPesos: monto, txAcunacion: hash };
}

/** Plugin de Vite: monta los servicios en el servidor de desarrollo y en `vite preview`. */
export function serviciosRastro({ chainId }) {
  const montar = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, "http://x");
      try {
        if (req.method === "GET" && url.pathname.startsWith("/ipfs/")) {
          const cid = url.pathname.slice(6).split("/")[0];
          const archivo = leer(cid);
          if (!archivo) {
            res.statusCode = 302;
            res.setHeader("location", gatewayPublico() + cid);
            return res.end();
          }
          res.setHeader("content-type", archivo.tipo);
          res.setHeader("cache-control", "public, max-age=31536000, immutable");
          res.setHeader("x-content-type-options", "nosniff");
          // Un SVG subido no debe poder ejecutar scripts en el origen de la app.
          res.setHeader("content-security-policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
          return res.end(archivo.bytes);
        }
        if (!url.pathname.startsWith("/api/")) return next();

        const ctx = contexto(chainId);
        if (url.pathname === "/api/estado" && req.method === "GET") {
          let saldo = null;
          if (ctx?.patrocinador) saldo = await ctx.publico.getBalance({ address: ctx.patrocinador.account.address }).catch(() => null);
          return responder(res, 200, {
            desplegado: !!ctx,
            pasarela: !!ctx?.emisor,
            patrocinador: ctx?.patrocinador?.account.address ?? null,
            saldoPatrocinador: saldo,
            ipfs: process.env.PINATA_JWT ? "pinata" : "local",
            gateway: gatewayPublico(),
          });
        }
        if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido" });

        if (url.pathname === "/api/evidencias") {
          const bytes = await leerCuerpo(req, MAX_BYTES);
          const tipo = String(req.headers["content-type"] || "").split(";")[0].trim();
          return responder(res, 200, await guardar(bytes, tipo));
        }
        if (!ctx) return responder(res, 503, { error: "Aún no hay contratos desplegados en esta red (pnpm deploy:local)" });
        const cuerpo = JSON.parse((await leerCuerpo(req, 64 * 1024)).toString("utf8") || "{}");
        if (url.pathname === "/api/reenviar") return responder(res, 200, await reenviar(ctx, cuerpo));
        if (url.pathname === "/api/pasarela/pago") return responder(res, 200, await pago(ctx, cuerpo));
        return responder(res, 404, { error: "No existe" });
      } catch (e) {
        responder(res, e.estado ?? 500, { error: e.shortMessage || e.message || String(e), revert: e.revert, hash: e.hash });
      }
    });
  };
  return { name: "rastro-servicios", configureServer: montar, configurePreviewServer: montar };
}
