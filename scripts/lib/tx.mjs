// Envío de transacciones pensado para Monad:
//  - gas limit = estimación + 10 % (en Monad se cobra el gas LIMIT, no el usado)
//  - espera mínima entre transacciones de una misma cuenta (reserve balance: cuentas con
//    menos de 10 MON solo pueden enviar 1 tx cada 3 bloques ≈ 1,2 s)
//  - reintentos ante límites de tasa del RPC público
//  - un "rastreador de bloques" mide cuándo entra cada tx a un bloque sin hacer polling
//    de recibos tx por tx (un par de llamadas por bloque, sin importar cuántas tx haya)
import { BaseError, ContractFunctionRevertedError, encodeFunctionData } from "viem";
import { dormir } from "./entorno.mjs";

/** Limita cuántas promesas corren a la vez. */
export function limitador(max) {
  let activos = 0;
  const cola = [];
  const siguiente = () => {
    if (activos >= max || cola.length === 0) return;
    activos++;
    const { fn, resolve, reject } = cola.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        activos--;
        siguiente();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      cola.push({ fn, resolve, reject });
      siguiente();
    });
}

const esErrorTransitorio = (e) => {
  const m = String(e?.details || e?.shortMessage || e?.message || e).toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate") ||
    m.includes("too many") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("socket") ||
    m.includes("503") ||
    m.includes("502")
  );
};

export async function conReintentos(fn, intentos = 6) {
  let espera = 400;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= intentos - 1 || !esErrorTransitorio(e)) throw e;
      await dormir(espera + Math.random() * 200);
      espera *= 2;
    }
  }
}

/** Mensaje legible de un revert (decodifica errores custom del contrato). */
export function explicarError(e) {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert?.data?.errorName) {
      const args = revert.data.args?.length ? `(${revert.data.args.join(", ")})` : "";
      return `${revert.data.errorName}${args}`;
    }
    return e.shortMessage;
  }
  return String(e?.message || e);
}

/** Observa bloques nuevos y resuelve cuándo entra cada hash. */
export class RastreadorBloques {
  constructor(cliente, intervaloMs) {
    this.cliente = cliente;
    this.intervaloMs = intervaloMs;
    this.pendientes = new Map(); // hash -> resolve
    this.vistos = new Map(); // hash -> inclusión (por si la tx entra antes de llamar esperar)
    this.txPorBloque = new Map(); // bloque -> nº de tx nuestras
    this.ultimo = null;
    this.activo = false;
  }

  async iniciar() {
    this.ultimo = await conReintentos(() => this.cliente.getBlockNumber());
    this.activo = true;
    this._bucle();
  }

  detener() {
    this.activo = false;
  }

  esperar(hash, timeoutMs = 90_000) {
    const h = hash.toLowerCase();
    const visto = this.vistos.get(h);
    if (visto) {
      this.txPorBloque.set(visto.bloque, (this.txPorBloque.get(visto.bloque) || 0) + 1);
      return Promise.resolve(visto);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        // Respaldo: si el rastreador no la vio (p. ej. RPC caído), se consulta el recibo.
        this.pendientes.delete(h);
        try {
          const r = await this.cliente.waitForTransactionReceipt({ hash, timeout: 60_000 });
          resolve({ bloque: r.blockNumber, t: Date.now(), timestamp: 0 });
        } catch (e) {
          reject(e);
        }
      }, timeoutMs);
      this.pendientes.set(h, (inc) => {
        clearTimeout(timer);
        resolve(inc);
      });
    });
  }

  async _bucle() {
    while (this.activo) {
      try {
        const actual = await conReintentos(() => this.cliente.getBlockNumber());
        for (let n = this.ultimo + 1n; n <= actual; n++) {
          const bloque = await conReintentos(() => this.cliente.getBlock({ blockNumber: n }));
          const t = Date.now();
          for (const hash of bloque.transactions) {
            const h = hash.toLowerCase();
            const inc = { bloque: n, t, timestamp: Number(bloque.timestamp) };
            const resolve = this.pendientes.get(h);
            if (resolve) {
              this.pendientes.delete(h);
              this.txPorBloque.set(n, (this.txPorBloque.get(n) || 0) + 1);
              resolve(inc);
            } else {
              this.vistos.set(h, inc);
            }
          }
          // Memoria acotada de hashes vistos
          if (this.vistos.size > 50_000) this.vistos.clear();
          this.ultimo = n;
        }
      } catch {
        // se reintenta en la siguiente vuelta
      }
      await dormir(this.intervaloMs);
    }
  }
}

/**
 * Remitente de transacciones con cuentas locales (llave privada / mnemónico).
 * Firma localmente y usa eth_sendRawTransaction, controlando nonce, gas y fees.
 */
export class Remitente {
  constructor({ publico, red, esMonad, rastreador, log = () => {} }) {
    this.publico = publico;
    this.red = red;
    this.esMonad = esMonad;
    this.rastreador = rastreador;
    this.log = log;
    this.ultimoEnvio = new Map(); // address -> ms
    this.fees = null;
  }

  async actualizarFees() {
    const f = await conReintentos(() => this.publico.estimateFeesPerGas());
    this.fees = { maxFeePerGas: f.maxFeePerGas, maxPriorityFeePerGas: f.maxPriorityFeePerGas };
    return this.fees;
  }

  /**
   * Envía una llamada a contrato (o transferencia si no hay abi) y espera a que entre a un bloque.
   * @returns {Promise<{hash, bloque, ms, gasLimit, status, gasUsed}>}
   */
  async enviar(cuenta, { address, abi, functionName, args = [], value = 0n, gasExtra = 0n, etiqueta }) {
    if (!this.fees) await this.actualizarFees();
    const data = abi ? encodeFunctionData({ abi, functionName, args }) : undefined;

    // Monad: respeta 1 tx cada ~3 bloques por cuenta (cuentas con < 10 MON)
    if (this.esMonad) {
      const ultimo = this.ultimoEnvio.get(cuenta.address) || 0;
      const falta = 1300 - (Date.now() - ultimo);
      if (falta > 0) await dormir(falta);
    }

    let gasLimit;
    try {
      const est = await conReintentos(() =>
        this.publico.estimateGas({ account: cuenta, to: address, data, value }),
      );
      gasLimit = est + est / 10n + gasExtra; // +10 %: en Monad pagas el límite completo
    } catch (e) {
      // Re-simula para obtener el error custom decodificado
      if (abi) {
        try {
          await this.publico.simulateContract({ account: cuenta, address, abi, functionName, args, value });
        } catch (e2) {
          throw new Error(`${etiqueta || functionName}: ${explicarError(e2)}`);
        }
      }
      throw new Error(`${etiqueta || functionName}: ${explicarError(e)}`);
    }

    const nonce = await conReintentos(() =>
      this.publico.getTransactionCount({ address: cuenta.address, blockTag: "pending" }),
    );
    const firmada = await cuenta.signTransaction({
      chainId: this.red.id,
      type: "eip1559",
      to: address,
      data,
      value,
      nonce,
      gas: gasLimit,
      ...this.fees,
    });

    const t0 = Date.now();
    const hash = await conReintentos(() => this.publico.sendRawTransaction({ serializedTransaction: firmada }));
    this.ultimoEnvio.set(cuenta.address, Date.now());
    const inclusion = await this.rastreador.esperar(hash);
    const recibo = await conReintentos(() => this.publico.getTransactionReceipt({ hash }));
    if (recibo.status !== "success") {
      throw new Error(`${etiqueta || functionName}: la transacción revirtió (${hash})`);
    }
    // En Monad se cobra gasLimit × precio; en otras cadenas, gasUsed × precio.
    const costo = (this.esMonad ? gasLimit : recibo.gasUsed) * recibo.effectiveGasPrice;
    return { hash, bloque: inclusion.bloque, ms: inclusion.t - t0, gasLimit, gasUsed: recibo.gasUsed, costo, t0, t1: inclusion.t };
  }
}

export function estadisticas(valores) {
  if (valores.length === 0) return { n: 0 };
  const v = [...valores].sort((a, b) => a - b);
  const p = (q) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
  return {
    n: v.length,
    min: v[0],
    p50: p(0.5),
    p95: p(0.95),
    max: v[v.length - 1],
    promedio: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
  };
}
