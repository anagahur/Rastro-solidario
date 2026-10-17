// Almacén de evidencias (facturas, fotos de entrega, actas) direccionado por contenido.
//
// Cada archivo se identifica por su CID de IPFS (CIDv1, códec raw, sha2-256): el mismo que da
// `ipfs add --cid-version 1 --raw-leaves` para archivos de hasta 256 KB (por encima, IPFS los
// parte en bloques y el CID cambia). En la cadena queda `ipfs://<cid>` del documento de
// evidencia y el keccak256 de sus bytes, así cualquiera comprueba que nadie lo cambió.
//
// Modos:
//   - Local (por defecto): los archivos quedan en evidencias/ y la app los sirve en /ipfs/<cid>.
//   - Pinata (PINATA_JWT en .env): además se fijan en IPFS de verdad y se usa el CID de Pinata.
//   - Vercel: el disco no persiste, así que subir evidencias exige PINATA_JWT. Las de la
//     simulación ya publicada se sirven desde evidencias-publicas/ (pnpm evidencias:publicar).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { keccak256, toHex } from "viem";
import { RAIZ } from "./entorno.mjs";

const EN_VERCEL = !!process.env.VERCEL;
export const DIR_EVIDENCIAS = EN_VERCEL ? path.join(os.tmpdir(), "evidencias") : path.join(RAIZ, "evidencias");
/** Evidencias de la cadena publicada que van dentro del repositorio (se sirven en Vercel). */
export const DIR_PUBLICAS = path.join(RAIZ, "evidencias-publicas");
export const MAX_BYTES = 8 * 1024 * 1024;

/** ¿Se pueden subir evidencias nuevas? En Vercel solo con Pinata (el disco no persiste). */
export const puedeGuardar = () => !EN_VERCEL || !!process.env.PINATA_JWT;

const TIPOS_PERMITIDOS = /^(image\/(png|jpeg|webp|gif|svg\+xml)|application\/(pdf|json)|text\/plain)$/;

export async function cidDe(bytes) {
  return CID.create(1, raw.code, await sha256.digest(bytes)).toString();
}

export function tipoPermitido(tipo) {
  return TIPOS_PERMITIDOS.test(tipo);
}

/**
 * Guarda bytes y devuelve su identidad.
 * @returns {Promise<{ cid: string, uri: string, keccak256: `0x${string}`, tipo: string, bytes: number, fijado: string }>}
 */
export async function guardar(bytes, tipo) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error(`Tamaño inválido (máx. ${MAX_BYTES / 1024 / 1024} MB)`);
  if (!tipoPermitido(tipo)) throw new Error(`Tipo de archivo no permitido: ${tipo}`);
  if (!puedeGuardar()) {
    throw Object.assign(new Error("Subir evidencias en línea requiere PINATA_JWT (IPFS) configurado en el servidor"), { estado: 503 });
  }

  let cid = await cidDe(bytes);
  let fijado = "local";
  if (process.env.PINATA_JWT) {
    cid = await fijarEnPinata(bytes, tipo, cid);
    fijado = "pinata";
  }
  fs.mkdirSync(DIR_EVIDENCIAS, { recursive: true });
  fs.writeFileSync(path.join(DIR_EVIDENCIAS, cid), bytes);
  fs.writeFileSync(path.join(DIR_EVIDENCIAS, `${cid}.tipo`), tipo);
  return { cid, uri: `ipfs://${cid}`, keccak256: keccak256(bytes), tipo, bytes: bytes.length, fijado };
}

/** Guarda un objeto como JSON canónico (sin espacios) y devuelve su identidad. */
export async function guardarJson(objeto) {
  return guardar(new TextEncoder().encode(JSON.stringify(objeto)), "application/json");
}

/** @returns {{ bytes: Buffer, tipo: string } | null} */
export function leer(cid) {
  if (!/^[a-z0-9]{20,120}$/i.test(cid)) return null;
  const ruta = [DIR_EVIDENCIAS, DIR_PUBLICAS].map((d) => path.join(d, cid)).find((r) => fs.existsSync(r));
  if (!ruta) return null;
  const rutaTipo = `${ruta}.tipo`;
  return { bytes: fs.readFileSync(ruta), tipo: fs.existsSync(rutaTipo) ? fs.readFileSync(rutaTipo, "utf8") : "application/octet-stream" };
}

export const gatewayPublico = () => process.env.IPFS_GATEWAY || (process.env.PINATA_JWT ? "https://gateway.pinata.cloud/ipfs/" : "https://ipfs.io/ipfs/");

async function fijarEnPinata(bytes, tipo, cidLocal) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: tipo }), cidLocal);
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });
  if (!r.ok) throw new Error(`Pinata respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).IpfsHash;
}

export const hashTexto = (t) => keccak256(toHex(t));
