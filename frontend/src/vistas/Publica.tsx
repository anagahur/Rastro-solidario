import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Address } from "viem";
import { Etapas, ResumenCampana } from "../componentes/Campana";
import { Seccion, Vacio } from "../componentes/Comunes";
import { Mapa, type PuntoMapa } from "../componentes/Mapa";
import { Qr } from "../componentes/Qr";
import { useCampana, useNombres, useTodasLasDonaciones, useVotosTodas } from "../lib/datos";
import { consultaEvidencia, urlIpfs, type EvidenciaCargada } from "../lib/evidencia";
import { MOTIVO_REEMBOLSO, corta, fecha, mismaDireccion, pesos } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";

interface Hito {
  fecha: number;
  icono: string;
  titulo: string;
  detalle?: string;
  tono: "neutro" | "bueno" | "alerta" | "malo" | "comunidad";
}

const TONOS: Record<Hito["tono"], string> = {
  neutro: "bg-neutro-100 text-neutro-600",
  bueno: "bg-exito-600 text-white",
  alerta: "bg-peligro-600 text-white",
  malo: "bg-peligro-100 text-peligro-800",
  comunidad: "bg-comunidad-600 text-white",
};

/**
 * Página pública de la campaña. No hace falta wallet: es lo que vería un periodista, un alcalde
 * o una veeduría ciudadana. Todo sale de la cadena y del almacén de evidencias.
 */
export function VistaPublica({ campana }: { campana?: Address }) {
  const { info, etapas, matchings } = useCampana(campana);
  const { data: donaciones } = useTodasLasDonaciones(campana, info?.numeroDonaciones);
  const votos = useVotosTodas(campana, etapas?.length ?? 0);
  const nombre = useNombres([...(etapas ?? []).map((e) => e.proveedor), ...matchings.map((m) => m.empresa), ...(info?.verificadores ?? [])]);
  const avisar = useAvisar();

  // Todas las evidencias de la campaña (facturas y actas de cada etapa)
  const fuentes = useMemo(() => {
    const lista: { uri: string; hash: string; etapa: number; autor?: string }[] = [];
    (etapas ?? []).forEach((e, i) => {
      if (e.uriEvidencia) lista.push({ uri: e.uriEvidencia, hash: e.hashEvidencia, etapa: i });
      const v = votos[i];
      v?.[2].forEach((u, j) => u && lista.push({ uri: u, hash: v[1][j], etapa: i, autor: info?.verificadores[j] }));
    });
    return lista;
  }, [etapas, votos, info?.verificadores]);
  const docs = useQueries({ queries: fuentes.map((f) => consultaEvidencia(f.uri, f.hash)) });
  const cargadas = fuentes.map((f, i) => ({ ...f, ...(docs[i]?.data as EvidenciaCargada | undefined) }));

  const puntos: PuntoMapa[] = cargadas
    .filter((c) => c.documento?.ubicacion)
    .map((c) => ({
      lat: c.documento!.ubicacion!.lat,
      lng: c.documento!.ubicacion!.lng,
      tipo: c.documento!.clase,
      titulo: c.documento!.titulo,
      detalle: `${etapas?.[c.etapa]?.descripcion ?? ""} · ${new Date(c.documento!.fecha).toLocaleDateString("es-CO")}${c.integridad === "verificada" ? " · ✓ íntegra" : ""}`,
      imagen: urlIpfs(c.documento!.archivos.find((a) => a.tipo.startsWith("image/"))?.uri),
    }));
  const galeria = cargadas.flatMap((c) =>
    (c.documento?.archivos ?? []).filter((a) => a.tipo.startsWith("image/")).map((a) => ({ ...a, titulo: c.documento!.titulo, clase: c.documento!.clase, integridad: c.integridad })),
  );

  const hitos = useMemo<Hito[]>(() => {
    if (!info || !etapas) return [];
    const h: Hito[] = [{ fecha: Number(info.fechaCreacion), icono: "★", titulo: "Se abrió la campaña", detalle: `Meta ${pesos(info.meta)} MockCOP`, tono: "neutro" }];
    for (const m of matchings) {
      h.push({ fecha: Number(m.fecha), icono: "🎁", titulo: `${nombre(m.empresa) ?? "Una empresa aliada"} se comprometió a ${m.proporcionBps === 10_000 ? "duplicar" : "multiplicar"} donaciones`, detalle: `${pesos(m.usado)} MockCOP sumados`, tono: "neutro" });
    }
    if (donaciones?.length) {
      const propias = donaciones.filter((d) => !matchings.some((m) => mismaDireccion(m.empresa, d.donante)));
      if (propias[0]) h.push({ fecha: Number(propias[0].fecha), icono: "♥", titulo: "Primera donación", detalle: `${pesos(propias[0].monto)} MockCOP`, tono: "neutro" });
      let acumulado = 0n;
      const marcas = [25n, 50n, 75n];
      let k = 0;
      for (const d of donaciones) {
        acumulado += d.monto;
        while (k < marcas.length && acumulado * 100n >= info.meta * marcas[k]) {
          h.push({ fecha: Number(d.fecha), icono: "↑", titulo: `Se llegó al ${marcas[k]} % de la meta`, tono: "neutro" });
          k++;
        }
      }
    }
    if (info.fechaRecaudoCerrado > 0n) {
      h.push({ fecha: Number(info.fechaRecaudoCerrado), icono: "🔒", titulo: "Se cerró el recaudo", detalle: `${pesos(info.totalRecaudado)} MockCOP de ${info.numeroDonantes} aportantes`, tono: "neutro" });
    }
    etapas.forEach((e, i) => {
      if (e.fechaPropuesta > 0n) {
        h.push({
          fecha: Number(e.fechaPropuesta),
          icono: e.sobrecosto ? "⚠" : "📄",
          titulo: `Etapa ${i + 1} (${e.descripcion}): la fundación propone pagar a ${nombre(e.proveedor) ?? corta(e.proveedor)}`,
          detalle: e.sobrecosto ? `SOBRECOSTO detectado: exige ${e.confirmacionesRequeridas} verificadores` : `${pesos(e.monto)} MockCOP${e.unidades ? ` · ${e.unidades} ${e.unidades === 1 ? "unidad" : "unidades"}` : ""}`,
          tono: e.sobrecosto ? "alerta" : "neutro",
        });
      }
      if (e.fechaPago > 0n) {
        h.push({
          fecha: Number(e.fechaPago),
          icono: "✓",
          titulo: `Pagado: ${pesos(e.monto)} MockCOP a ${nombre(e.proveedor) ?? corta(e.proveedor)}`,
          detalle: `${e.confirmaciones} ${e.confirmaciones === 1 ? "verificador" : "verificadores"}${e.beneficiariosRequeridos > 0 ? ` y ${e.confirmacionesBeneficiarios} ${e.confirmacionesBeneficiarios === 1 ? "familia" : "familias"}` : ""} ${e.confirmaciones + e.confirmacionesBeneficiarios === 1 ? "confirmó" : "confirmaron"} la entrega`,
          tono: "bueno",
        });
      }
    });
    if (info.fechaReembolso > 0n) {
      h.push({ fecha: Number(info.fechaReembolso), icono: "↺", titulo: "Reembolso activado", detalle: `Porque ${MOTIVO_REEMBOLSO[info.motivoReembolso]}. Lo no pagado vuelve a los donantes.`, tono: "malo" });
    }
    return h.sort((a, b) => a.fecha - b.fecha);
  }, [info, etapas, matchings, donaciones, nombre]);

  if (!campana) return <Vacio>No hay campañas todavía.</Vacio>;
  const enlace = `${window.location.origin}/#/campana/${campana}`;
  const texto = encodeURIComponent(`Mira en qué se gasta cada peso de "${info?.nombre ?? "esta campaña"}", verificado en blockchain: ${enlace}`);

  function descargar(nombreArchivo: string, contenido: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportarCsv() {
    const filas = [["tipo", "fecha", "cuenta", "monto_mockcop", "bloque", "detalle"]];
    for (const d of donaciones ?? []) {
      const emp = matchings.some((m) => mismaDireccion(m.empresa, d.donante));
      filas.push([emp ? "matching" : "donacion", new Date(Number(d.fecha) * 1000).toISOString(), d.donante, (Number(d.monto) / 1e18).toFixed(0), d.bloque.toString(), emp ? nombre(d.donante) ?? "" : ""]);
    }
    for (const [i, e] of (etapas ?? []).entries()) {
      if (e.estado === 3)
        filas.push(["pago", new Date(Number(e.fechaPago) * 1000).toISOString(), e.proveedor, (Number(e.monto) / 1e18).toFixed(0), e.bloquePago.toString(), `etapa ${i + 1}: ${e.descripcion}${e.sobrecosto ? " (sobrecosto)" : ""}`]);
    }
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    descargar(`rastro-${campana!.slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  }
  function exportarJson() {
    const datos = { campana: info, etapas, matchings, donaciones, votos, evidencias: cargadas.map((c) => ({ uri: c.uri, hash: c.hash, etapa: c.etapa, integridad: c.integridad, documento: c.documento })) };
    descargar(`rastro-${campana!.slice(0, 10)}.json`, JSON.stringify(datos, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2), "application/json");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <ResumenCampana direccion={campana} />

        <Seccion titulo="Línea de tiempo" descripcion="Cada hito sale de la cadena: nadie puede editarlo ni borrarlo.">
          {hitos.length === 0 ? (
            <Vacio>Cargando…</Vacio>
          ) : (
            <ol className="relative ml-1 space-y-5 border-l-2 border-dashed border-neutro-200 pl-7">
              {hitos.map((h, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white ${TONOS[h.tono]}`}>{h.icono}</span>
                  <p className="text-xs font-medium tabular text-neutro-400">{fecha(h.fecha)}</p>
                  <p className={`font-semibold ${h.tono === "alerta" ? "text-peligro-700" : "text-neutro-900"}`}>{h.titulo}</p>
                  {h.detalle && <p className="text-sm text-neutro-600">{h.detalle}</p>}
                </li>
              ))}
            </ol>
          )}
        </Seccion>

        <Seccion titulo="Mapa de entregas" descripcion="Cada punto es una factura o un acta con ubicación GPS. Verde: entrega confirmada · rojo: rechazo.">
          {puntos.length === 0 ? <Vacio>Aún no hay evidencias con ubicación.</Vacio> : <Mapa puntos={puntos} />}
        </Seccion>

        <Seccion titulo="Etapas y evidencias" descripcion="Facturas, fotos de entrega y actas. ✓ Íntegra = el archivo coincide byte a byte con el hash guardado en el contrato.">
          <Etapas direccion={campana} />
        </Seccion>

        {galeria.length > 0 && (
          <Seccion titulo="Galería de evidencias">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galeria.map((g, i) => (
                <a key={`${g.uri}-${i}`} href={urlIpfs(g.uri)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-neutro-200 bg-white">
                  <img src={urlIpfs(g.uri)} alt={g.titulo} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                  <p className="truncate px-2 py-1.5 text-xs text-neutro-600" title={g.titulo}>
                    {g.integridad === "verificada" ? "✓ " : ""}
                    {g.titulo}
                  </p>
                </a>
              ))}
            </div>
          </Seccion>
        )}
      </div>

      <div className="space-y-6">
        <Seccion titulo="Compartir" descripcion="Cualquiera puede abrir esta página sin wallet.">
          <div className="flex flex-col items-center gap-3">
            <Qr texto={enlace} tamano={200} />
            <div className="grid w-full grid-cols-2 gap-2">
              <button className="btn-secundario text-xs" onClick={() => navigator.clipboard?.writeText(enlace).then(() => avisar("exito", "Enlace copiado"))}>
                Copiar enlace
              </button>
              <a className="btn-secundario text-xs" href={`https://wa.me/?text=${texto}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <a className="btn-secundario text-xs" href={`https://twitter.com/intent/tweet?text=${texto}`} target="_blank" rel="noreferrer">
                X / Twitter
              </a>
              <a className="btn-primario text-xs" href="#/donar">
                Donar
              </a>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Datos abiertos" descripcion="Para periodistas, veedurías y la Contraloría: descarga todo y verifícalo por tu cuenta.">
          <div className="grid gap-2">
            <button className="btn-secundario" onClick={exportarCsv} disabled={!donaciones}>
              Descargar donaciones y pagos (CSV)
            </button>
            <button className="btn-secundario" onClick={exportarJson} disabled={!info}>
              Descargar todo con evidencias (JSON)
            </button>
          </div>
          <p className="mt-3 break-all font-mono text-[11px] text-neutro-400">Contrato: {campana}</p>
        </Seccion>

        <section className="tarjeta text-sm text-neutro-600">
          <h3 className="font-bold text-neutro-900">¿Cómo se protege el dinero?</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>El dinero está en un contrato: la fundación no puede tocarlo.</li>
            <li>Cada pago exige verificadores independientes con foto, fecha y ubicación.</li>
            <li>Y además que las familias confirmen con su QR que recibieron.</li>
            <li>Si la factura supera el precio de referencia, se marca sobrecosto y se exige un verificador más.</li>
            <li>Si algo falla o vence, cada donante recupera su parte de lo no gastado.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
