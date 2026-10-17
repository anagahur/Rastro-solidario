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
  parseEther,
  parseSignature,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { campanaEmergenciaAbi, mockCOPAbi, reenviadorGasAbi } from "../abis";
import { CHAIN_ID, DIRECCIONES } from "../config";
import { MENSAJES } from "./errores";
import { clientePublico } from "./cliente";

const CLAVE = "rastro:billetera-invisible";

function leerLlave(): Hex | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as Hex) : null;
  } catch {
    return null;
  }
}

export function cuentaInvisible(crear = false): PrivateKeyAccount | null {
  let llave = leerLlave();
  if (!llave && crear) {
    llave = generatePrivateKey();
    try {
      localStorage.setItem(CLAVE, llave);
    } catch {}
    window.dispatchEvent(new Event("rastro:billetera"));
  }
  return llave ? privateKeyToAccount(llave) : null;
}

export function exportarLlave(): Hex | null {
  return leerLlave();
}

/** Dirección de la billetera invisible de este navegador (si ya existe). */
export function useBilleteraInvisible() {
  const [direccion, setDireccion] = useState<Address | undefined>(() => cuentaInvisible()?.address);
  useEffect(() => {
    const f = () => setDireccion(cuentaInvisible()?.address);
    window.addEventListener("rastro:billetera", f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener("rastro:billetera", f);
      window.removeEventListener("storage", f);
    };
  }, []);
  const crear = useCallback(() => cuentaInvisible(true)!, []);
  return { direccion, crear };
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
