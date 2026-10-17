// "Mi mamá puede donar sin saber qué es blockchain".
//
// Billetera invisible: una llave que se crea en el navegador la primera vez que alguien dona con
// Nequi/PSE. La persona nunca ve una frase semilla ni paga gas:
//   1. La pasarela (simulada) cobra en pesos y acredita MockCOP a esa billetera.
//   2. La billetera FIRMA el permiso del token y la solicitud de donación (gratis, fuera de la cadena).
//   3. El patrocinador de gas entrega la firma al ReenviadorGas (ERC-2771) y paga la transacción.
// La campaña ve como donante a la billetera invisible, así que el rastreo, el NFT de recibo y el
// reembolso le pertenecen. La misma idea sirve para las familias que confirman con su QR.
import { useCallback, useEffect, useState } from "react";
import {
  decodeErrorResult,
  encodeFunctionData,
  hexToBytes,
  parseEther,
  parseSignature,
  sha256,
  toHex,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { generateMnemonic, mnemonicToAccount, privateKeyToAccount, spanish } from "viem/accounts";
import { campanaEmergenciaAbi, mockCOPAbi, reenviadorGasAbi } from "../abis";
import { CHAIN_ID, DIRECCIONES } from "../config";
import { MENSAJES } from "./errores";
import { clientePublico } from "./cliente";

const CLAVE = "rastro:billetera-invisible";
// 12 palabras en español (BIP-39) de las que sale la llave: con ellas se recupera la billetera
// en otro celular. Las billeteras creadas antes solo tienen la llave (se respaldan con ella).
const CLAVE_PALABRAS = "rastro:billetera-palabras";
const CLAVE_RESPALDADA = "rastro:billetera-respaldada";

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};
const avisarCambio = () => window.dispatchEvent(new Event("rastro:billetera"));

function leerLlave(): Hex | null {
  const v = leer(CLAVE);
  return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as Hex) : null;
}

/** Llave de la cuenta 0 (m/44'/60'/0'/0/0) de unas palabras: la misma que daría MetaMask. */
function llaveDePalabras(palabras: string): Hex {
  return toHex(mnemonicToAccount(palabras).getHdKey().privateKey!);
}

export function cuentaInvisible(crear = false): PrivateKeyAccount | null {
  let llave = leerLlave();
  if (!llave && crear) {
    const palabras = generateMnemonic(spanish);
    llave = llaveDePalabras(palabras);
    escribir(CLAVE_PALABRAS, palabras);
    escribir(CLAVE, llave);
    escribir(CLAVE_RESPALDADA, null);
    avisarCambio();
  }
  return llave ? privateKeyToAccount(llave) : null;
}

export function exportarLlave(): Hex | null {
  return leerLlave();
}

/** Lo que la persona debe guardar: sus 12 palabras o, si su billetera es anterior, la llave. */
export function respaldo(): { tipo: "palabras"; palabras: string[] } | { tipo: "llave"; llave: Hex } | null {
  const llave = leerLlave();
  if (!llave) return null;
  const palabras = leer(CLAVE_PALABRAS);
  if (palabras && llaveDePalabras(palabras) === llave) return { tipo: "palabras", palabras: palabras.split(" ") };
  return { tipo: "llave", llave };
}

/** La persona confirmó que guardó su respaldo (se recuerda por dirección). */
export function marcarRespaldada(direccion: Address) {
  escribir(CLAVE_RESPALDADA, direccion.toLowerCase());
  avisarCambio();
}

// ─── Recuperación ───

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LISTA = spanish.map(sinTildes);

/**
 * Convierte lo que escribió la persona en las palabras exactas de la lista. Acepta palabras sin
 * tildes, en mayúsculas, numeradas ("1. árbol"), separadas por comas, o solo sus 4 primeras letras
 * (en la lista española son únicas). Comprueba el dígito de control para detectar errores.
 */
export function interpretarRespaldo(texto: string): { llave: Hex; palabras?: string } | { error: string; faltan?: number } {
  const limpio = texto.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(limpio)) return { llave: limpio as Hex };

  const escritas = limpio
    .split(/[\s,;]+/)
    .map((p) => p.replace(/^\d+[.)-]?$/, "").replace(/^\d+[.)-]/, ""))
    .filter(Boolean);
  if (escritas.length === 0) return { error: "Escribe tus 12 palabras.", faltan: 12 };
  if (escritas.length < 12) return { error: `Van ${escritas.length} de 12 palabras.`, faltan: 12 - escritas.length };
  if (escritas.length > 12) return { error: `Escribiste ${escritas.length} palabras; son 12.` };

  const indices: number[] = [];
  const raras: string[] = [];
  escritas.forEach((p, i) => {
    const s = sinTildes(p);
    let j = LISTA.indexOf(s);
    if (j < 0 && s.length >= 4) {
      const candidatas = LISTA.flatMap((w, k) => (w.startsWith(s.slice(0, 4)) ? [k] : []));
      if (candidatas.length === 1) j = candidatas[0];
    }
    if (j < 0) raras.push(`${i + 1} («${p}»)`);
    indices.push(j);
  });
  if (raras.length) return { error: `No reconozco la palabra ${raras.join(", ")}. Revisa cómo la escribiste.` };

  // 12 palabras = 132 bits: 128 de entropía + 4 de control (los primeros bits de su sha256)
  const bits = indices.map((n) => n.toString(2).padStart(11, "0")).join("");
  const entropia = new Uint8Array(16).map((_, k) => parseInt(bits.slice(k * 8, k * 8 + 8), 2));
  const control = hexToBytes(sha256(entropia))[0] >> 4;
  if (control !== parseInt(bits.slice(128), 2)) return { error: "Las palabras no coinciden entre sí: puede haber una equivocada o en otro orden." };

  const palabras = indices.map((n) => spanish[n]).join(" ");
  return { llave: llaveDePalabras(palabras), palabras };
}

/** Restaura la billetera en este navegador. Devuelve su dirección. */
export function restaurarBilletera(r: { llave: Hex; palabras?: string }): Address {
  escribir(CLAVE, r.llave);
  escribir(CLAVE_PALABRAS, r.palabras ?? null);
  const direccion = privateKeyToAccount(r.llave).address;
  // Quien la recupera ya tenía su respaldo
  escribir(CLAVE_RESPALDADA, direccion.toLowerCase());
  avisarCambio();
  return direccion;
}

/** Dirección de la billetera invisible de este navegador (si ya existe) y si ya está respaldada. */
export function useBilleteraInvisible() {
  const estado = () => {
    const direccion = cuentaInvisible()?.address;
    return { direccion, respaldada: !!direccion && leer(CLAVE_RESPALDADA) === direccion.toLowerCase() };
  };
  const [{ direccion, respaldada }, setEstado] = useState(estado);
  useEffect(() => {
    const f = () => setEstado(estado());
    window.addEventListener("rastro:billetera", f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener("rastro:billetera", f);
      window.removeEventListener("storage", f);
    };
  }, []);
  const crear = useCallback(() => cuentaInvisible(true)!, []);
  return { direccion, respaldada, crear };
}

/** Pago que la pasarela ya acreditó en un intento que falló después (para no cobrar dos veces). */
export interface PagoPrevio {
  referencia: string;
  /** aportes(cuenta) en la campaña antes de ese intento */
  aportesAntes: bigint;
}

export class ErrorReenvio extends Error {
  pagoPrevio?: PagoPrevio;
}

/** Peticiones al servidor de la demo: sin respuesta en este tiempo se informa a la persona. */
const ESPERA_API_MS = 120_000;

function traducir(revert?: Hex, mensaje?: string): string {
  if (revert) {
    try {
      const d = decodeErrorResult({ abi: campanaEmergenciaAbi, data: revert });
      return MENSAJES[d.errorName] ?? d.errorName;
    } catch {}
  }
  return mensaje || "No se pudo completar la operación";
}

/**
 * Firma una llamada como `cuenta` y la entrega al patrocinador de gas.
 * @returns hash de la transacción que pagó el patrocinador
 */
export async function enviarSinGas(cuenta: PrivateKeyAccount, to: Address, data: Hex) {
  const cliente = clientePublico();
  // Gas que necesita la llamada interna (se estima como si la hiciera el firmante).
  let gas: bigint;
  try {
    gas = await cliente.estimateGas({ account: cuenta.address, to, data });
  } catch (e) {
    const revert = (e as { cause?: { data?: Hex } })?.cause?.data ?? (e as { data?: Hex }).data;
    throw new ErrorReenvio(traducir(typeof revert === "string" ? revert : undefined, (e as Error).message));
  }
  gas = gas + gas / 3n + 30_000n;
  const nonce = await cliente.readContract({ address: DIRECCIONES.reenviador, abi: reenviadorGasAbi, functionName: "nonces", args: [cuenta.address] });
  const deadline = Math.floor(Date.now() / 1000) + 15 * 60;
  const signature = await cuenta.signTypedData({
    domain: { name: "Rastro Solidario", version: "1", chainId: CHAIN_ID, verifyingContract: DIRECCIONES.reenviador },
    types: {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    },
    primaryType: "ForwardRequest",
    message: { from: cuenta.address, to, value: 0n, gas, nonce, deadline, data },
  });
  const r = await fetch("/api/reenviar", {
    method: "POST",
    signal: AbortSignal.timeout(ESPERA_API_MS),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request: { from: cuenta.address, to, value: "0", gas: gas.toString(), deadline, data, signature } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorReenvio(traducir(j.revert, j.error));
  return j as { hash: Hex; bloque: string; patrocinador: Address; gasPagado: string };
}

/** Firma el permiso ERC-2612 de MockCOP (gratis) para que la campaña tome `monto`. */
export async function firmarPermiso(cuenta: PrivateKeyAccount, campana: Address, monto: bigint) {
  const cliente = clientePublico();
  const nonce = await cliente.readContract({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "nonces", args: [cuenta.address] });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
  const firma = await cuenta.signTypedData({
    domain: { name: "MockCOP", version: "1", chainId: CHAIN_ID, verifyingContract: DIRECCIONES.cop },
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
    message: { owner: cuenta.address, spender: campana, value: monto, nonce, deadline },
  });
  const { r, s, v, yParity } = parseSignature(firma);
  return { deadline, v: v !== undefined ? Number(v) : yParity! + 27, r, s };
}

export interface PasoDonacion {
  paso: "pago" | "acreditado" | "firmado" | "registrado";
  detalle?: string;
}

/**
 * Donación completa sin cripto: pago simulado → MockCOP → firma → transacción patrocinada.
 * Con `pagoPrevio` (reintento tras un fallo de red) no se vuelve a cobrar si los MockCOP siguen
 * en la billetera, y si la donación sí alcanzó a entrar a la campaña se da por hecha.
 */
export async function donarSinCripto(
  campana: Address,
  montoPesos: number,
  metodo: "nequi" | "pse",
  alAvanzar: (p: PasoDonacion) => void,
  pagoPrevio?: PagoPrevio,
) {
  const cuenta = cuentaInvisible(true)!;
  const cliente = clientePublico();
  const monto = parseEther(String(montoPesos));
  const aportes = () => cliente.readContract({ address: campana, abi: campanaEmergenciaAbi, functionName: "aportes", args: [cuenta.address] });

  let pendiente = pagoPrevio;
  if (pendiente) {
    if ((await aportes()) > pendiente.aportesAntes) {
      // El intento anterior sí quedó en la cadena; solo se perdió la respuesta.
      for (const paso of ["pago", "acreditado", "firmado", "registrado"] as const) alAvanzar({ paso });
      return { cuenta: cuenta.address, referencia: pendiente.referencia, hash: undefined };
    }
    const saldo = await cliente.readContract({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "balanceOf", args: [cuenta.address] });
    if (saldo < monto) pendiente = undefined;
  }
  if (!pendiente) {
    const aportesAntes = await aportes();
    const r = await fetch("/api/pasarela/pago", {
      method: "POST",
      signal: AbortSignal.timeout(ESPERA_API_MS),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cuenta: cuenta.address, montoPesos, metodo }),
    });
    const pago = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErrorReenvio(pago.error || "La pasarela rechazó el pago");
    pendiente = { referencia: pago.referencia as string, aportesAntes };
  }
  alAvanzar({ paso: "pago", detalle: pendiente.referencia });
  alAvanzar({ paso: "acreditado" });

  try {
    const { deadline, v, r: rr, s } = await firmarPermiso(cuenta, campana, monto);
    alAvanzar({ paso: "firmado" });
    const data = encodeFunctionData({ abi: campanaEmergenciaAbi, functionName: "donarConPermit", args: [monto, deadline, v, rr, s] });
    const envio = await enviarSinGas(cuenta, campana, data);
    alAvanzar({ paso: "registrado", detalle: envio.hash });
    return { cuenta: cuenta.address, referencia: pendiente.referencia, ...envio };
  } catch (e) {
    const err = e instanceof ErrorReenvio ? e : new ErrorReenvio((e as { shortMessage?: string })?.shortMessage || (e as Error)?.message || String(e));
    err.pagoPrevio = pendiente;
    throw err;
  }
}
