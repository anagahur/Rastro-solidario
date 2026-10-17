// Imágenes SVG de evidencia para la simulación (en la demo real serían fotos y PDFs).
// Son archivos de verdad: se suben al almacén, tienen CID y su hash queda en la cadena.

const esc = (t) => String(t).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const pesos = (n) => Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });

/** Factura electrónica simulada. */
export function svgFactura({ proveedor, nit, numero, fecha, items, total, nota }) {
  const filas = items
    .map(
      (it, i) => `
    <text x="40" y="${250 + i * 34}" font-size="17" fill="#1c1917">${esc(it.descripcion)}</text>
    <text x="430" y="${250 + i * 34}" font-size="17" fill="#1c1917" text-anchor="end">${pesos(it.cantidad)}</text>
    <text x="560" y="${250 + i * 34}" font-size="17" fill="#1c1917" text-anchor="end">$${pesos(it.unitario)}</text>
    <text x="720" y="${250 + i * 34}" font-size="17" fill="#1c1917" text-anchor="end">$${pesos(it.cantidad * it.unitario)}</text>`,
    )
    .join("");
  const yTotal = 270 + items.length * 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 ${yTotal + 150}" font-family="Helvetica, Arial, sans-serif">
  <rect width="760" height="${yTotal + 150}" fill="#fafaf9"/>
  <rect x="0" y="0" width="760" height="110" fill="#0f766e"/>
  <text x="40" y="52" font-size="28" font-weight="bold" fill="#fff">${esc(proveedor)}</text>
  <text x="40" y="84" font-size="16" fill="#ccfbf1">NIT ${esc(nit)} · Factura electrónica de venta (simulada)</text>
  <text x="720" y="52" font-size="22" font-weight="bold" fill="#fff" text-anchor="end">${esc(numero)}</text>
  <text x="720" y="84" font-size="16" fill="#ccfbf1" text-anchor="end">${esc(fecha)}</text>
  <text x="40" y="160" font-size="15" fill="#57534e">Cliente: Campaña de emergencia (pago directo desde contrato inteligente)</text>
  <line x1="40" y1="200" x2="720" y2="200" stroke="#d6d3d1" stroke-width="2"/>
  <text x="40" y="222" font-size="14" font-weight="bold" fill="#57534e">DESCRIPCIÓN</text>
  <text x="430" y="222" font-size="14" font-weight="bold" fill="#57534e" text-anchor="end">CANT.</text>
  <text x="560" y="222" font-size="14" font-weight="bold" fill="#57534e" text-anchor="end">UNITARIO</text>
  <text x="720" y="222" font-size="14" font-weight="bold" fill="#57534e" text-anchor="end">TOTAL</text>
  ${filas}
  <line x1="40" y1="${yTotal - 10}" x2="720" y2="${yTotal - 10}" stroke="#d6d3d1" stroke-width="2"/>
  <text x="560" y="${yTotal + 26}" font-size="20" font-weight="bold" fill="#1c1917" text-anchor="end">TOTAL</text>
  <text x="720" y="${yTotal + 26}" font-size="22" font-weight="bold" fill="#0f766e" text-anchor="end">$${pesos(total)}</text>
  <text x="40" y="${yTotal + 80}" font-size="14" fill="#78716c">${esc(nota ?? "Documento de prueba generado por la simulación de Rastro Solidario. Sin validez fiscal.")}</text>
</svg>`;
}

/** "Foto" de una entrega: cajas de mercado o láminas de techo frente a las casas. */
export function svgEntrega({ titulo, lugar, fecha, tipo = "mercados", personas = 5 }) {
  const cajas = Array.from({ length: 7 }, (_, i) => {
    const x = 90 + i * 85;
    return tipo === "techo"
      ? `<g><rect x="${x}" y="${330 - (i % 3) * 8}" width="70" height="16" rx="2" fill="#94a3b8"/><rect x="${x}" y="${312 - (i % 3) * 8}" width="70" height="16" rx="2" fill="#cbd5e1"/></g>`
      : `<g><rect x="${x}" y="300" width="64" height="54" rx="4" fill="#d97706"/><rect x="${x}" y="300" width="64" height="12" fill="#b45309"/>
         <circle cx="${x + 18}" cy="296" r="9" fill="#16a34a"/><rect x="${x + 34}" y="282" width="14" height="22" rx="3" fill="#dc2626"/></g>`;
  }).join("");
  const gente = Array.from({ length: personas }, (_, i) => {
    const x = 120 + i * 120;
    const color = ["#0f766e", "#7c3aed", "#db2777", "#2563eb", "#ea580c"][i % 5];
    return `<g><circle cx="${x}" cy="400" r="16" fill="#a16207"/><rect x="${x - 18}" y="418" width="36" height="52" rx="12" fill="${color}"/></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 560" font-family="Helvetica, Arial, sans-serif">
  <defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient></defs>
  <rect width="760" height="560" fill="url(#cielo)"/>
  <path d="M0 250 Q 190 200 380 240 T 760 230 V 560 H 0 Z" fill="#86efac"/>
  <g fill="#fef3c7" stroke="#92400e" stroke-width="3">
    <rect x="70" y="150" width="150" height="110"/><rect x="300" y="160" width="170" height="100"/><rect x="560" y="150" width="140" height="110"/>
  </g>
  <g fill="#b91c1c"><path d="M60 150 L145 95 L230 150 Z"/><path d="M290 160 L385 100 L480 160 Z"/><path d="M550 150 L630 95 L710 150 Z"/></g>
  <g fill="#78350f"><rect x="130" y="210" width="30" height="50"/><rect x="370" y="210" width="30" height="50"/><rect x="615" y="210" width="30" height="50"/></g>
  <path d="M0 270 Q 200 285 380 272 T 760 280 V 300 H 0 Z" fill="#7dd3fc" opacity="0.6"/>
  ${cajas}
  ${gente}
  <rect x="0" y="490" width="760" height="70" fill="#000" opacity="0.55"/>
  <text x="24" y="520" font-size="20" font-weight="bold" fill="#fff">${esc(titulo)}</text>
  <text x="24" y="546" font-size="15" fill="#e7e5e4">${esc(lugar)} · ${esc(fecha)}</text>
</svg>`;
}

/** Bodega vacía: evidencia de un rechazo (la entrega no ocurrió). */
export function svgRechazo({ titulo, lugar, fecha }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 560" font-family="Helvetica, Arial, sans-serif">
  <rect width="760" height="560" fill="#e7e5e4"/>
  <rect x="80" y="90" width="600" height="380" fill="#d6d3d1" stroke="#57534e" stroke-width="4"/>
  <g stroke="#a8a29e" stroke-width="3"><line x1="80" y1="190" x2="680" y2="190"/><line x1="80" y1="290" x2="680" y2="290"/><line x1="80" y1="390" x2="680" y2="390"/></g>
  <text x="380" y="300" font-size="44" font-weight="bold" fill="#b91c1c" text-anchor="middle" opacity="0.85">BODEGA VACÍA</text>
  <rect x="0" y="490" width="760" height="70" fill="#000" opacity="0.55"/>
  <text x="24" y="520" font-size="20" font-weight="bold" fill="#fff">${esc(titulo)}</text>
  <text x="24" y="546" font-size="15" fill="#e7e5e4">${esc(lugar)} · ${esc(fecha)}</text>
</svg>`;
}
