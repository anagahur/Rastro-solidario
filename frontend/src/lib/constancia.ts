// Constancia de donación en PDF. Los datos personales (nombre completo y documento) solo viven
// en este navegador y en el PDF: nunca se envían al servidor ni a la cadena. Lo verificable
// (campaña, monto, fecha, recibo NFT) sale del contrato y el QR lleva al rastreo público.
import QRCode from "qrcode";
import type { Address } from "viem";
import { CHAIN_ID, ES_MONAD } from "../config";

export const TIPOS_DOCUMENTO = ["CC", "CE", "NIT", "Pasaporte"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export interface DatosPersonales {
  nombre: string;
  tipoDocumento: TipoDocumento;
  documento: string;
}

const clave = (campana: Address, donante: Address) => `rastro:constancia:${CHAIN_ID}:${campana.toLowerCase()}:${donante.toLowerCase()}`;

export function leerDatosPersonales(campana: Address, donante: Address): DatosPersonales {
  try {
    const v = JSON.parse(localStorage.getItem(clave(campana, donante)) || "null");
    if (v && typeof v.nombre === "string") return { nombre: v.nombre, tipoDocumento: TIPOS_DOCUMENTO.includes(v.tipoDocumento) ? v.tipoDocumento : "CC", documento: String(v.documento ?? "") };
  } catch {}
  return { nombre: "", tipoDocumento: "CC", documento: "" };
}

export function guardarDatosPersonales(campana: Address, donante: Address, datos: DatosPersonales) {
  try {
    localStorage.setItem(clave(campana, donante), JSON.stringify(datos));
  } catch {}
}

export interface DatosConstancia {
  personales: DatosPersonales;
  campana: Address;
  nombreCampana: string;
  fundacion: string;
  donante: Address;
  aporte: string; // "20.000"
  fechaDonacion?: Date;
  recibo?: bigint;
  /** null = anónimo en la página pública */
  nombrePublico: string | null;
  enlace: string;
}

const fechaLarga = (d: Date) => d.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

/** Genera y descarga la constancia en PDF (jsPDF se carga solo cuando se usa). */
export async function descargarConstancia(d: DatosConstancia) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const ancho = pdf.internal.pageSize.getWidth();
  const m = 20; // margen
  const util = ancho - 2 * m;
  const marca: [number, number, number] = [15, 118, 110];
  const tinta: [number, number, number] = [28, 25, 23];
  const gris: [number, number, number] = [120, 113, 108];

  // Franja de marca
  pdf.setFillColor(...marca);
  pdf.rect(0, 0, ancho, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Constancia de donación", m, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Rastro Solidario · cada peso, verificado por la comunidad", m, 29);

  // Declaración
  const p = d.personales;
  const conNombre = p.nombre.trim().length > 0;
  const quien = conNombre
    ? `${p.nombre.trim()}${p.documento.trim() ? `, identificado(a) con ${p.tipoDocumento} ${p.documento.trim()},` : ","}`
    : "una persona que prefirió no identificarse";
  pdf.setTextColor(...tinta);
  pdf.setFontSize(12);
  const declaracion = `Rastro Solidario deja constancia de que ${quien} donó $${d.aporte} MockCOP a la campaña «${d.nombreCampana}», organizada por ${d.fundacion}. El dinero quedó en un contrato inteligente y solo sale hacia los proveedores cuando verificadores independientes y las familias damnificadas confirman cada entrega.`;
  let y = 54;
  const lineas = pdf.splitTextToSize(declaracion, util);
  pdf.text(lineas, m, y, { lineHeightFactor: 1.45 });
  y += lineas.length * 6.6 + 8;

  // Monto destacado
  pdf.setFillColor(240, 253, 250);
  pdf.roundedRect(m, y, util, 24, 3, 3, "F");
  pdf.setTextColor(...gris);
  pdf.setFontSize(9);
  pdf.text("TOTAL DONADO A ESTA CAMPAÑA", m + 6, y + 8);
  pdf.setTextColor(...marca);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(`$${d.aporte} MockCOP`, m + 6, y + 18);
  pdf.setFont("helvetica", "normal");
  y += 34;

  // Detalle verificable
  const filas: [string, string][] = [
    ["Donante", conNombre ? `${p.nombre.trim()}${p.documento.trim() ? ` · ${p.tipoDocumento} ${p.documento.trim()}` : ""}` : "Anónimo"],
    ["Cómo aparece en público", d.nombrePublico ? `Con el nombre «${d.nombrePublico}»` : "Anónimo"],
    ["Fecha de la donación", d.fechaDonacion ? fechaLarga(d.fechaDonacion) : "—"],
    ["Recibo NFT", d.recibo && d.recibo > 0n ? `#${d.recibo}` : "—"],
    ["Billetera del donante", d.donante],
    ["Contrato de la campaña", d.campana],
    ["Red", ES_MONAD ? "Monad Testnet (chain 10143)" : `Chain ${CHAIN_ID}`],
    ["Constancia generada", fechaLarga(new Date())],
  ];
  pdf.setFontSize(10);
  for (const [t, v] of filas) {
    pdf.setTextColor(...gris);
    pdf.text(t, m, y);
    pdf.setTextColor(...tinta);
    const val = pdf.splitTextToSize(v, util - 55);
    pdf.text(val, m + 55, y);
    const alto = Math.max(1, val.length) * 5;
    pdf.setDrawColor(231, 229, 228);
    pdf.line(m, y + alto - 2, m + util, y + alto - 2);
    y += alto + 4;
  }

  // QR de verificación
  y += 6;
  const qr = await QRCode.toDataURL(d.enlace, { width: 360, margin: 1, color: { dark: "#134e4a", light: "#ffffff" } });
  pdf.addImage(qr, "PNG", m, y, 36, 36);
  pdf.setTextColor(...tinta);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Verifica esta donación", m + 44, y + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...gris);
  const ayuda = pdf.splitTextToSize(
    "Escanea el código o abre el enlace: muestra, leído directamente de la blockchain, cuánto donó esta billetera y en qué se gastó cada peso.",
    util - 44,
  );
  pdf.text(ayuda, m + 44, y + 14);
  pdf.setTextColor(...marca);
  pdf.text(pdf.splitTextToSize(d.enlace, util - 44), m + 44, y + 14 + ayuda.length * 4.2 + 2);

  // Nota legal
  pdf.setTextColor(...gris);
  pdf.setFontSize(8);
  const nota = pdf.splitTextToSize(
    "Constancia informativa generada a partir de los datos de la blockchain. MockCOP es un peso colombiano simulado y no tiene valor real (proyecto académico). " +
      "Este documento no reemplaza el certificado de donación para efectos tributarios, que expide la entidad que recibe la donación. " +
      "Los datos personales de esta constancia no se guardan en la blockchain ni en los servidores de Rastro Solidario.",
    util,
  );
  pdf.text(nota, m, pdf.internal.pageSize.getHeight() - 22);

  pdf.save(`constancia-donacion-${d.donante.slice(2, 8)}-${d.campana.slice(2, 8)}.pdf`);
}
