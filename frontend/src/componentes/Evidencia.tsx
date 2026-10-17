import { useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import {
  crearEvidencia,
  enlaceMapa,
  hayHash,
  obtenerUbicacion,
  urlIpfs,
  useDocumentoEvidencia,
  type DocumentoEvidencia,
  type Ubicacion,
} from "../lib/evidencia";

export interface EvidenciaLista {
  hash: Hex;
  uri: string;
}

/**
 * Formulario de evidencia: foto o PDF (en el celular abre la cámara), nota, fecha automática y
 * ubicación GPS. Sube todo al almacén IPFS y entrega el hash + URI para la transacción.
 */
export function SubirEvidencia({
  etiqueta,
  clase,
  campana,
  etapa,
  autor,
  titulo,
  onLista,
}: {
  etiqueta: string;
  clase: DocumentoEvidencia["clase"];
  campana: string;
  etapa: number;
  autor?: string;
  titulo: string;
  onLista: (e: EvidenciaLista | null) => void;
}) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [nota, setNota] = useState("");
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [lugar, setLugar] = useState("");
  const [estado, setEstado] = useState<"" | "ubicando" | "subiendo" | "lista">("");
  const [error, setError] = useState("");
  const [lista, setLista] = useState<EvidenciaLista | null>(null);
  const vistas = useVistasPrevias(archivos);

  // Cualquier cambio invalida la evidencia ya subida.
  useEffect(() => {
    setLista(null);
    onLista(null);
    if (estado === "lista") setEstado("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivos, nota, ubicacion, lugar]);

  async function ubicar() {
    setError("");
    setEstado("ubicando");
    try {
      setUbicacion(await obtenerUbicacion());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEstado("");
    }
  }

  async function preparar() {
    setError("");
    setEstado("subiendo");
    try {
      const r = await crearEvidencia(
        {
          clase,
          campana,
          etapa,
          titulo,
          nota: nota.trim() || undefined,
          ubicacion: ubicacion ? { ...ubicacion, lugar: lugar.trim() || undefined } : null,
          autor,
        },
        archivos,
      );
      setLista({ hash: r.hash, uri: r.uri });
      onLista({ hash: r.hash, uri: r.uri });
      setEstado("lista");
    } catch (e) {
      setError((e as Error).message);
      setEstado("");
    }
  }

  const puede = archivos.length > 0 || nota.trim().length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-neutro-200 bg-white p-3">
      <span className="etiqueta">{etiqueta}</span>
      <input
        type="file"
        multiple
        accept="image/*,application/pdf"
        capture="environment"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutro-200 file:px-3 file:py-2 file:text-sm file:font-medium"
        onChange={(e) => setArchivos([...(e.target.files ?? [])].slice(0, 4))}
        aria-label="Foto o documento"
      />
      {vistas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vistas.map((v) =>
            v.url ? (
              <img key={v.nombre} src={v.url} alt={v.nombre} className="h-20 w-20 rounded-lg border border-neutro-200 object-cover" />
            ) : (
              <span key={v.nombre} className="flex h-20 w-20 items-center justify-center rounded-lg border border-neutro-200 bg-neutro-50 p-1 text-center text-[10px] text-neutro-500">
                {v.nombre}
              </span>
            ),
          )}
        </div>
      )}
      <input className="campo" placeholder="Nota (p. ej. Factura FE-1043 · 20 mercados entregados en el salón comunal)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={280} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-secundario px-3 py-1.5 text-xs" onClick={ubicar} disabled={estado === "ubicando"}>
          {estado === "ubicando" ? "Ubicando…" : ubicacion ? "Actualizar ubicación" : "📍 Agregar ubicación GPS"}
        </button>
        {ubicacion && (
          <>
            <a className="font-mono text-xs text-marca-700 hover:underline" href={enlaceMapa(ubicacion)} target="_blank" rel="noreferrer">
              {ubicacion.lat}, {ubicacion.lng} (±{ubicacion.precisionM ?? "?"} m)
            </a>
            <input className="campo flex-1 py-1.5 text-xs" placeholder="Lugar (barrio, vereda)" value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={80} />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secundario" onClick={preparar} disabled={!puede || estado === "subiendo" || estado === "lista"}>
          {estado === "subiendo" ? "Subiendo a IPFS…" : estado === "lista" ? "✓ Evidencia lista" : "Subir evidencia"}
        </button>
        <span className="text-[11px] text-neutro-400">Fecha y hora se agregan solas. En la cadena queda el enlace ipfs:// y su hash.</span>
      </div>
      {lista && (
        <p className="hash">
          {lista.uri}
          <br />
          keccak256 {lista.hash}
        </p>
      )}
      {error && <p className="text-xs text-peligro-700">{error}</p>}
    </div>
  );
}

function useVistasPrevias(archivos: File[]) {
  const [vistas, setVistas] = useState<{ nombre: string; url?: string }[]>([]);
  useEffect(() => {
    const v = archivos.map((a) => ({ nombre: a.name, url: a.type.startsWith("image/") ? URL.createObjectURL(a) : undefined }));
    setVistas(v);
    return () => v.forEach((x) => x.url && URL.revokeObjectURL(x.url));
  }, [archivos]);
  return vistas;
}

const CLASES: Record<DocumentoEvidencia["clase"], string> = { factura: "Factura", acta: "Acta de entrega", rechazo: "Motivo del rechazo" };

/**
 * Muestra una evidencia registrada en la cadena: foto, fecha, lugar y si el documento
 * coincide byte a byte con el hash guardado en el contrato.
 */
export function VerEvidencia({ uri, hash, compacta = false }: { uri?: string; hash?: string; compacta?: boolean }) {
  const { data, isLoading } = useDocumentoEvidencia(uri, hash);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ampliada) dialogo.current?.showModal();
  }, [ampliada]);

  if (!uri) {
    return hayHash(hash) ? (
      <p className="text-xs text-neutro-500">
        Solo hash (sin documento público): <span className="hash">{hash}</span>
      </p>
    ) : null;
  }
  if (isLoading) return <div className="h-16 animate-pulse rounded-lg bg-neutro-100" />;
  const doc = data?.documento;
  const imagenes = doc?.archivos.filter((a) => a.tipo.startsWith("image/")) ?? [];
  const otros = doc?.archivos.filter((a) => !a.tipo.startsWith("image/")) ?? [];

  return (
    <div className={`rounded-lg border border-neutro-200 bg-neutro-50/60 ${compacta ? "p-2" : "p-3"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Integridad estado={data?.integridad} />
        {doc && <span className="font-semibold text-neutro-700">{CLASES[doc.clase] ?? doc.clase}</span>}
        {doc && <span className="text-neutro-500">{new Date(doc.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span>}
        {doc?.ubicacion && (
          <a className="text-marca-700 hover:underline" href={enlaceMapa(doc.ubicacion)} target="_blank" rel="noreferrer">
            📍 {doc.ubicacion.lugar ?? `${doc.ubicacion.lat}, ${doc.ubicacion.lng}`}
          </a>
        )}
      </div>
      {doc?.titulo && !compacta && <p className="mt-1 text-sm font-medium text-neutro-800">{doc.titulo}</p>}
      {doc?.nota && <p className="mt-0.5 text-sm text-neutro-600">{doc.nota}</p>}
      {imagenes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {imagenes.map((a, i) => (
            <button key={`${a.uri}-${i}`} type="button" onClick={() => setAmpliada(urlIpfs(a.uri)!)} className="overflow-hidden rounded-lg border border-neutro-200 bg-white" title="Ver en grande">
              <img src={urlIpfs(a.uri)} alt={a.nombre} loading="lazy" className={`${compacta ? "h-16 w-24" : "h-28 w-40"} object-cover`} />
            </button>
          ))}
        </div>
      )}
      {otros.map((a, i) => (
        <a key={`${a.uri}-${i}`} className="mt-1 block text-xs text-marca-700 hover:underline" href={urlIpfs(a.uri)} target="_blank" rel="noreferrer">
          📄 {a.nombre}
        </a>
      ))}
      {!compacta && (
        <p className="mt-2 break-all font-mono text-[10px] text-neutro-400">
          <a className="hover:underline" href={urlIpfs(uri)} target="_blank" rel="noreferrer">
            {uri}
          </a>
        </p>
      )}
      <dialog ref={dialogo} className="max-w-3xl rounded-2xl p-0 backdrop:bg-black/70" onClose={() => setAmpliada(null)} onClick={() => dialogo.current?.close()}>
        {ampliada && <img src={ampliada} alt="Evidencia" className="max-h-[85vh] w-full object-contain" />}
      </dialog>
    </div>
  );
}

function Integridad({ estado }: { estado?: string }) {
  if (estado === "verificada")
    return (
      <span className="rounded-full bg-exito-100 px-2 py-0.5 font-semibold text-exito-800" title="El documento coincide byte a byte con el hash guardado en el contrato">
        ✓ Íntegra
      </span>
    );
  if (estado === "alterada")
    return (
      <span className="rounded-full bg-peligro-600 px-2 py-0.5 font-semibold text-white" title="El documento NO coincide con el hash del contrato">
        ✕ No coincide con la cadena
      </span>
    );
  return <span className="rounded-full bg-neutro-200 px-2 py-0.5 font-semibold text-neutro-600">Documento no disponible</span>;
}
