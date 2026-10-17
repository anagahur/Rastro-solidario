import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { campanaEmergenciaAbi, nombresDonantesAbi, reciboDonacionAbi } from "../abis";
import { DIRECCIONES, DIRECCION_NOMBRES, HAY_NOMBRES } from "../config";
import { cuentaInvisible, enviarSinGas, useBilleteraInvisible } from "../lib/billeteraInvisible";
import { TIPOS_DOCUMENTO, descargarConstancia, guardarDatosPersonales, leerDatosPersonales, type TipoDocumento } from "../lib/constancia";
import { useCampana, useNombres, useNombresPublicos } from "../lib/datos";
import { mismaDireccion, pesos } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";
import { useEscribir } from "../lib/useEscribir";

/** "María Fernanda González" → "María G." (lo que se sugiere mostrar en público). */
function aliasSugerido(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : "";
  return ultimo ? `${partes[0]} ${ultimo[0].toUpperCase()}.` : partes[0];
}

/**
 * Para quien donó: elige si aparece anónimo o con su nombre en la página pública, y descarga su
 * constancia en PDF. El nombre público va a la cadena (lo elige y lo puede quitar la persona);
 * el nombre completo y el documento solo quedan en este dispositivo y en el PDF.
 */
export function ConstanciaDonacion({ campana, donante }: { campana: Address; donante: Address }) {
  const { info } = useCampana(campana);
  const nombreActor = useNombres([info?.fundacion]);
  const resumen = useReadContract({ address: campana, abi: campanaEmergenciaAbi, functionName: "resumenDonante", args: [donante] }).data;
  const recibo = resumen?.recibo ?? 0n;
  const datosRecibo = useReadContract({
    address: DIRECCIONES.recibo,
    abi: reciboDonacionAbi,
    functionName: "datosRecibo",
    args: [recibo],
    query: { enabled: recibo > 0n, staleTime: Infinity },
  }).data;
  const nombrePublicoDe = useNombresPublicos(campana, [donante]);
  const nombrePublico = nombrePublicoDe(donante) ?? null;

  const { address } = useAccount();
  const { direccion: invisible } = useBilleteraInvisible();
  const esInvisible = mismaDireccion(invisible, donante);
  const soyYo = mismaDireccion(address, donante);
  const { ejecutar, pendiente } = useEscribir();
  const avisar = useAvisar();
  const qc = useQueryClient();

  const [datos, setDatos] = useState(() => leerDatosPersonales(campana, donante));
  const [modo, setModo] = useState<"anonimo" | "nombre">("anonimo");
  const [alias, setAlias] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  useEffect(() => setDatos(leerDatosPersonales(campana, donante)), [campana, donante]);
  // Lo que dice la cadena manda: al cargar (o al cambiar) se refleja en el formulario
  useEffect(() => {
    setModo(nombrePublico ? "nombre" : "anonimo");
    if (nombrePublico) setAlias(nombrePublico);
  }, [nombrePublico]);

  if (!info || !resumen || resumen.aporte === 0n || (!esInvisible && !soyYo)) return null;

  const cambiarDatos = (cambio: Partial<typeof datos>) => {
    const nuevos = { ...datos, ...cambio };
    setDatos(nuevos);
    guardarDatosPersonales(campana, donante, nuevos);
  };
  const aliasLimpio = alias.trim();
  const sinCambios = modo === "anonimo" ? !nombrePublico : aliasLimpio === nombrePublico;
  const aliasInvalido = modo === "nombre" && (aliasLimpio.length === 0 || new TextEncoder().encode(aliasLimpio).length > 60);

  async function guardarVisibilidad() {
    const mostrar = modo === "nombre";
    const exito = mostrar ? `Ahora apareces como «${aliasLimpio}» en la campaña` : "Ahora apareces como anónimo en la campaña";
    if (esInvisible) {
      const cuenta = cuentaInvisible();
      if (!cuenta) return;
      setGuardando(true);
      try {
        const data = mostrar
          ? encodeFunctionData({ abi: nombresDonantesAbi, functionName: "mostrarNombre", args: [campana, aliasLimpio] })
          : encodeFunctionData({ abi: nombresDonantesAbi, functionName: "ocultarNombre", args: [campana] });
        await enviarSinGas(cuenta, DIRECCION_NOMBRES, data);
        avisar("exito", exito, "Sin pagar gas: lo cubrió el patrocinador.");
        await qc.invalidateQueries();
      } catch (e) {
        avisar("error", "No se pudo guardar", (e as Error).message);
      } finally {
        setGuardando(false);
      }
    } else if (mostrar) {
      await ejecutar({ address: DIRECCION_NOMBRES, abi: nombresDonantesAbi, functionName: "mostrarNombre", args: [campana, aliasLimpio], etiqueta: "Mostrar mi nombre", exito });
    } else {
      await ejecutar({ address: DIRECCION_NOMBRES, abi: nombresDonantesAbi, functionName: "ocultarNombre", args: [campana], etiqueta: "Volver a anónimo", exito });
    }
  }

  async function descargar() {
    setGenerando(true);
    try {
      await descargarConstancia({
        personales: datos,
        campana,
        nombreCampana: info!.nombre,
        fundacion: nombreActor(info!.fundacion) ?? "la fundación",
        donante,
        aporte: pesos(resumen!.aporte),
        fechaDonacion: datosRecibo ? new Date(Number(datosRecibo[2]) * 1000) : undefined,
        recibo,
        nombrePublico,
        enlace: `${window.location.origin}/#/rastreo/${campana}/${donante}`,
      });
    } catch (e) {
      avisar("error", "No se pudo generar la constancia", (e as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  const ocupado = guardando || !!pendiente;

  return (
    <section className="tarjeta space-y-5" aria-label="Constancia de donación">
      <div>
        <h3 className="font-display text-lg font-bold text-neutro-900">Tu constancia de donación</h3>
        <p className="mt-1 text-sm text-neutro-600">
          Un PDF con tu donación de <strong className="text-neutro-900">${pesos(resumen.aporte)}</strong> y un código QR para que cualquiera la verifique en la blockchain.
        </p>
      </div>

      {HAY_NOMBRES && (
        <div className="space-y-3 rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
          <p className="text-sm font-semibold text-neutro-900">¿Cómo quieres aparecer en la página pública?</p>
          <div className="segmentado grid-cols-2" role="radiogroup" aria-label="Cómo apareces en público">
            <button type="button" role="radio" aria-checked={modo === "anonimo"} className={modo === "anonimo" ? "segmento-activo" : "segmento"} onClick={() => setModo("anonimo")}>
              Anónimo
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={modo === "nombre"}
              className={modo === "nombre" ? "segmento-activo" : "segmento"}
              onClick={() => {
                setModo("nombre");
                if (!alias) setAlias(nombrePublico ?? aliasSugerido(datos.nombre));
              }}
            >
              Con mi nombre
            </button>
          </div>
          {modo === "nombre" && (
            <label className="block">
              <span className="etiqueta">Nombre que verán todos</span>
              <input className="campo" maxLength={60} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="María G." />
            </label>
          )}
          <p className="text-xs text-neutro-500">
            Hoy apareces como <strong className="text-neutro-800">{nombrePublico ? `«${nombrePublico}»` : "Anónimo"}</strong>. Tu documento nunca se publica, y puedes volver a
            anónimo cuando quieras.
          </p>
          <button type="button" className="btn-secundario w-full" disabled={ocupado || sinCambios || aliasInvalido} onClick={guardarVisibilidad}>
            {ocupado ? "Guardando…" : "Guardar cómo aparezco"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-neutro-900">Datos de la constancia</p>
        <label className="block">
          <span className="etiqueta">Nombre completo (opcional)</span>
          <input className="campo" value={datos.nombre} onChange={(e) => cambiarDatos({ nombre: e.target.value })} placeholder="Si lo dejas vacío, la constancia dice «Anónimo»" />
        </label>
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <label className="block">
            <span className="etiqueta">Documento</span>
            <select className="campo" value={datos.tipoDocumento} onChange={(e) => cambiarDatos({ tipoDocumento: e.target.value as TipoDocumento })}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta">Número (opcional)</span>
            <input className="campo" inputMode="numeric" value={datos.documento} onChange={(e) => cambiarDatos({ documento: e.target.value.replace(/[^\dA-Za-z.-]/g, "") })} placeholder="1.020.304.050" />
          </label>
        </div>
        <p className="text-xs text-neutro-500">Estos datos solo quedan en este dispositivo y en tu PDF: no se guardan en la blockchain ni en nuestros servidores.</p>
        <button type="button" className="btn-primario w-full" disabled={generando} onClick={descargar}>
          {generando ? "Generando…" : "Descargar constancia (PDF)"}
        </button>
      </div>
    </section>
  );
}
