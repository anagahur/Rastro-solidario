import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEther, parseEventLogs, type Address } from "viem";
import { useAccount } from "wagmi";
import { campanaEmergenciaAbi, campanaFactoryAbi, mockCOPAbi, registroActoresAbi } from "../abis";
import { DIRECCIONES } from "../config";
import { Etapas } from "../componentes/Campana";
import { Barra, Direccion, Insignia, Seccion, Vacio } from "../componentes/Comunes";
import { SubirEvidencia, type EvidenciaLista } from "../componentes/Evidencia";
import { InsigniaConfianza } from "../componentes/Reputacion";
import { useActores, useAhora, useCampana, useNombres, useReputacion, useRoles, useSaldoCop } from "../lib/datos";
import { ESTADO_CAMPANA, analizarPrecio, esDireccion, mismaDireccion, pesos, porcentaje, tiempoRestante } from "../lib/formato";
import { generarTarjetas, guardarTarjetas, useTarjetas } from "../lib/tarjetas";
import { useEscribir } from "../lib/useEscribir";

export function VistaPanel({ campana, onCampanaCreada }: { campana?: Address; onCampanaCreada: (a: Address) => void }) {
  const { address } = useAccount();
  const roles = useRoles(address);
  const { info } = useCampana(campana);

  if (!address) {
    return (
      <Vacio>
        Conecta tu wallet para ver las acciones de tu rol (fundación, verificador, empresa aliada o administrador). Para seguir una campaña sin wallet usa la{" "}
        <a className="font-semibold text-marca-700 underline" href={campana ? `#/campana/${campana}` : "#/donar"}>
          página pública
        </a>
        .
      </Vacio>
    );
  }

  const soyFundacionDeCampana = mismaDireccion(info?.fundacion, address);
  const soyVerificadorDeCampana = !!info?.verificadores.some((v) => mismaDireccion(v, address));
  const sinRol = !roles.cargando && !roles.admin && !roles.fundacion && !roles.verificador && !roles.empresa;

  return (
    <div className="space-y-6">
      <section className="tarjeta flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutro-500">Tus roles:</span>
        {roles.admin && <Insignia texto="Administrador del registro" />}
        {roles.fundacion && <Insignia texto="Fundación" />}
        {roles.verificador && <Insignia texto="Verificador" />}
        {roles.proveedor && <Insignia texto="Proveedor" />}
        {roles.empresa && <Insignia texto="Empresa aliada" />}
        {sinRol && <span className="text-neutro-500">ninguno. Puedes donar, rastrear y activar reembolsos vencidos.</span>}
      </section>

      {campana && info && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Seccion titulo={info.nombre} descripcion={`Estado: ${ESTADO_CAMPANA[info.estado]} · ${pesos(info.totalRecaudado)} de ${pesos(info.meta)} MockCOP`}>
            <Etapas direccion={campana} />
          </Seccion>
          <div className="space-y-6">
            {soyFundacionDeCampana && <AccionesFundacion campana={campana} />}
            {soyVerificadorDeCampana && <AccionesVerificador campana={campana} />}
            {soyVerificadorDeCampana && <CensoBeneficiarios campana={campana} />}
            {roles.empresa && <AccionesEmpresa campana={campana} />}
            {roles.fundacion && !soyFundacionDeCampana && (
              <p className="rounded-xl bg-neutro-100 p-3 text-sm text-neutro-600">Esta campaña pertenece a otra fundación.</p>
            )}
            <AccionesPublicas campana={campana} />
          </div>
        </div>
      )}

      {roles.fundacion && <CrearCampana onCreada={onCampanaCreada} />}
      {roles.admin && <AdminRegistro />}
    </div>
  );
}

// ───────────────────────── Fundación ─────────────────────────

function AccionesFundacion({ campana }: { campana: Address }) {
  const { address } = useAccount();
  const { info, etapas } = useCampana(campana);
  const { proveedores } = useActores();
  const rep = useReputacion(proveedores.map((p) => p.cuenta));
  const { ejecutar, pendiente } = useEscribir();
  const [proveedor, setProveedor] = useState<string>("");
  const [unidades, setUnidades] = useState("");
  const [evidencia, setEvidencia] = useState<EvidenciaLista | null>(null);
  useEffect(() => {
    if (!proveedor && proveedores[0]) setProveedor(proveedores[0].cuenta);
  }, [proveedores, proveedor]);
  if (!info || !etapas) return null;
  const c = { address: campana, abi: campanaEmergenciaAbi } as const;
  const idx = Number(info.etapaActual);
  const etapa = etapas[idx];
  const puedeProponer = info.estado === 1 && etapa?.estado === 0;
  const nUnidades = Number(unidades) || 0;
  const precio = etapa && etapa.precioReferencia > 0n ? analizarPrecio(etapa.monto, nUnidades, etapa.precioReferencia) : null;
  const faltaCenso = info.quorumBeneficiariosBps > 0 && info.numeroBeneficiarios === 0n;
  const faltanUnidades = !!etapa && etapa.precioReferencia > 0n && nUnidades <= 0;

  return (
    <Seccion titulo="Acciones de la fundación" descripcion="Tú propones cómo se gasta el dinero, pero nunca lo recibes: el pago va del contrato al proveedor.">
      <div className="space-y-5">
        {info.estado === 0 && (
          <div className="rounded-xl bg-neutro-50 p-4">
            <p className="text-sm text-neutro-600">
              Recaudado {pesos(info.totalRecaudado)} de {pesos(info.meta)}. Al cerrar el recaudo se fijan los montos de cada etapa, el matching que no se usó vuelve a las empresas y
              empieza a correr el plazo de la primera etapa.
            </p>
            <button
              className="btn-primario mt-3"
              disabled={!!pendiente || info.totalRecaudado === 0n}
              onClick={() => ejecutar({ ...c, functionName: "cerrarRecaudo", etiqueta: "Cerrar recaudo", exito: "Recaudo cerrado: ya puedes proponer la etapa 1" })}
            >
              Cerrar recaudo
            </button>
          </div>
        )}

        {puedeProponer && (
          <form
            className="space-y-3 rounded-xl bg-neutro-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!evidencia || !esDireccion(proveedor) || faltanUnidades) return;
              ejecutar({
                ...c,
                functionName: "proponerDesembolso",
                args: [BigInt(idx), proveedor, evidencia.hash, evidencia.uri, nUnidades],
                etiqueta: "Proponer desembolso",
                exito: `Etapa ${idx + 1} propuesta. Ahora los verificadores y las familias deben confirmar la entrega.`,
              });
            }}
          >
            <p className="font-semibold text-neutro-900">
              Proponer etapa {idx + 1}: {etapa.descripcion} · {pesos(etapa.monto)} MockCOP
            </p>
            {faltaCenso && (
              <p className="rounded-lg bg-alerta-50 p-2 text-xs text-alerta-900">
                Esta campaña exige confirmación de la comunidad: primero un verificador (p. ej. la Junta de Acción Comunal) debe registrar el censo de familias.
              </p>
            )}
            <label className="block">
              <span className="etiqueta">Proveedor registrado</span>
              <select className="campo" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
                {proveedores.map((p) => {
                  const r = rep(p.cuenta);
                  return (
                    <option key={p.cuenta} value={p.cuenta}>
                      {p.nombre} — {r?.indice === null || !r ? "sin historial" : `confianza ${Math.round(r.indice)} %`}
                      {r && r.sobrecostos > 0 ? ` · ${r.sobrecostos} sobrecosto(s)` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="text-xs">
              <InsigniaConfianza rep={rep(proveedor)} rol="proveedor" />
            </div>
            <label className="block">
              <span className="etiqueta">
                Unidades en la factura{etapa.precioReferencia > 0n ? ` (${etapa.unidad}) · obligatorio` : " (opcional)"}
              </span>
              <input className="campo" inputMode="numeric" value={unidades} onChange={(e) => setUnidades(e.target.value.replace(/\D/g, ""))} placeholder="20" />
            </label>
            {precio && (
              <p className={`rounded-lg p-2 text-sm ${precio.sobrecosto ? "bg-peligro-600 text-white" : "bg-exito-50 text-exito-900"}`}>
                Precio por unidad: <strong>${pesos(precio.unitario)}</strong> vs. referencia ${pesos(etapa.precioReferencia)} ({precio.diferencia >= 0 ? "+" : ""}
                {precio.diferencia.toFixed(0)} %).{" "}
                {precio.sobrecosto
                  ? `⚠ Sobrecosto: quedará marcado en rojo, en tu historial y en el del proveedor, y exigirá ${Math.min(info.umbral + 1, info.verificadores.length)} de ${info.verificadores.length} verificadores.`
                  : "✓ Dentro de la referencia (+10 % de tolerancia)."}
              </p>
            )}
            <SubirEvidencia
              etiqueta="Factura o cotización (foto o PDF)"
              clase="factura"
              campana={campana}
              etapa={idx}
              autor={address}
              titulo={`Factura · etapa ${idx + 1}: ${etapa.descripcion}`}
              onLista={setEvidencia}
            />
            <button className="btn-primario" disabled={!!pendiente || !evidencia || !proveedor || faltaCenso || faltanUnidades}>
              Proponer desembolso
            </button>
          </form>
        )}

        {info.estado === 1 && etapa?.estado === 1 && <p className="text-sm text-neutro-600">La etapa {idx + 1} espera la confirmación de los verificadores y de la comunidad.</p>}
        {info.estado === 1 && etapa?.estado === 2 && (
          <p className="text-sm text-comunidad-700">Los verificadores ya aprobaron la etapa {idx + 1}: el pago saldrá cuando confirmen las familias.</p>
        )}
        {info.estado === 2 && <p className="text-sm text-exito-700">Campaña finalizada: todas las etapas se pagaron.</p>}

        {(info.estado === 0 || info.estado === 1) && (
          <div className="border-t border-neutro-200 pt-4">
            <button
              className="btn-peligro"
              disabled={!!pendiente}
              onClick={() => {
                if (confirm("¿Cancelar la campaña? Los donantes podrán reclamar lo que no se ha pagado. No se puede deshacer.")) {
                  ejecutar({ ...c, functionName: "cancelar", etiqueta: "Cancelar campaña", exito: "Campaña cancelada: los donantes ya pueden reclamar" });
                }
              }}
            >
              Cancelar campaña
            </button>
          </div>
        )}
      </div>
    </Seccion>
  );
}

interface EtapaForm {
  descripcion: string;
  porcentaje: string;
  plazoDias: string;
  precio: string;
  unidad: string;
}

function CrearCampana({ onCreada }: { onCreada: (a: Address) => void }) {
  const { verificadores } = useActores();
  const { address } = useAccount();
  const { ejecutar, pendiente } = useEscribir();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [meta, setMeta] = useState("10000000");
  const [dias, setDias] = useState("3");
  const [quorum, setQuorum] = useState("30");
  const [etapas, setEtapas] = useState<EtapaForm[]>([
    { descripcion: "Mercados", porcentaje: "30", plazoDias: "3", precio: "150000", unidad: "mercado familiar" },
    { descripcion: "Materiales", porcentaje: "40", plazoDias: "10", precio: "400000", unidad: "kit de techo" },
    { descripcion: "Reconstrucción", porcentaje: "30", plazoDias: "30", precio: "", unidad: "" },
  ]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [umbral, setUmbral] = useState(2);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (elegidos.length === 0 && verificadores.length > 0) {
      setElegidos(verificadores.filter((v) => !mismaDireccion(v.cuenta, address)).slice(0, 3).map((v) => v.cuenta));
    }
  }, [verificadores, elegidos.length, address]);

  const suma = etapas.reduce((a, e) => a + (Number(e.porcentaje) || 0), 0);
  const refsValidas = etapas.every((e) => !Number(e.precio) || e.unidad.trim());
  const nQuorum = Number(quorum) || 0;
  const valido =
    nombre.trim() && Number(meta) > 0 && suma === 100 && elegidos.length >= 2 && umbral >= 2 && umbral <= elegidos.length && refsValidas && nQuorum >= 0 && nQuorum <= 100;
  const editar = (i: number, campo: keyof EtapaForm, valor: string) => setEtapas((es) => es.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)));

  if (!abierto) {
    return (
      <Seccion titulo="Nueva campaña" descripcion="Como fundación registrada puedes abrir una campaña por emergencia." accion={<button className="btn-primario" onClick={() => setAbierto(true)}>Crear campaña</button>}>
        <></>
      </Seccion>
    );
  }

  const conPrecios = etapas.some((e) => Number(e.precio) > 0);

  return (
    <Seccion titulo="Nueva campaña" descripcion="Define la meta, las etapas (deben sumar 100 %), los precios de referencia, la voz de la comunidad y los verificadores independientes.">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido) return;
          const recibo = await ejecutar({
            address: DIRECCIONES.factory,
            abi: campanaFactoryAbi,
            functionName: "crearCampana",
            args: [
              {
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                meta: parseEther(String(Number(meta))),
                duracionRecaudo: BigInt(Math.round(Number(dias) * 86400)),
                verificadores: elegidos as Address[],
                umbral,
                descripcionesEtapas: etapas.map((x) => x.descripcion.trim()),
                porcentajesBps: etapas.map((x) => Math.round(Number(x.porcentaje) * 100)),
                plazosEtapas: etapas.map((x) => BigInt(Math.round(Number(x.plazoDias) * 86400))),
                preciosReferencia: conPrecios ? etapas.map((x) => parseEther(String(Number(x.precio) || 0))) : [],
                unidadesReferencia: conPrecios ? etapas.map((x) => (Number(x.precio) > 0 ? x.unidad.trim() : "")) : [],
                quorumBeneficiariosBps: Math.round(nQuorum * 100),
              },
            ],
            etiqueta: "Crear campaña",
            exito: "Campaña creada",
          });
          if (recibo) {
            const [ev] = parseEventLogs({ abi: campanaFactoryAbi, logs: recibo.logs, eventName: "CampanaCreada" });
            if (ev) onCreada(ev.args.campana);
            setAbierto(false);
          }
        }}
      >
        <label className="block md:col-span-2">
          <span className="etiqueta">Nombre</span>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Inundación en Antioquia" maxLength={80} />
        </label>
        <label className="block md:col-span-2">
          <span className="etiqueta">Descripción</span>
          <textarea className="campo" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} />
        </label>
        <label className="block">
          <span className="etiqueta">Meta (MockCOP)</span>
          <input className="campo" inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="block">
          <span className="etiqueta">Días de recaudo</span>
          <input className="campo" inputMode="decimal" value={dias} onChange={(e) => setDias(e.target.value)} />
        </label>

        <div className="md:col-span-2">
          <span className="etiqueta">Etapas (suma: {suma} %)</span>
          <div className="space-y-2">
            {etapas.map((et, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-neutro-200 p-2 sm:grid-cols-[1.4fr_70px_80px_1fr_1.2fr_auto]">
                <input className="campo col-span-2 sm:col-span-1" value={et.descripcion} onChange={(e) => editar(i, "descripcion", e.target.value)} aria-label="Descripción" placeholder="Descripción" />
                <input className="campo" value={et.porcentaje} onChange={(e) => editar(i, "porcentaje", e.target.value)} aria-label="Porcentaje" title="%" placeholder="%" />
                <input className="campo" value={et.plazoDias} onChange={(e) => editar(i, "plazoDias", e.target.value)} aria-label="Plazo en días" title="días de plazo" placeholder="días" />
                <input className="campo" inputMode="numeric" value={et.precio} onChange={(e) => editar(i, "precio", e.target.value.replace(/\D/g, ""))} aria-label="Precio de referencia por unidad" placeholder="$ ref. / unidad" />
                <input className="campo" value={et.unidad} onChange={(e) => editar(i, "unidad", e.target.value)} aria-label="Unidad" placeholder="unidad (mercado…)" />
                <button type="button" className="btn-secundario px-3" onClick={() => setEtapas((es) => es.filter((_, j) => j !== i))} disabled={etapas.length <= 1} aria-label="Quitar etapa">
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-neutro-400">
            Columnas: descripción · % · días de plazo · precio de referencia por unidad (opcional, p. ej. SIPSA-DANE) · unidad. Si la factura supera la referencia en más del 10 %, se marca
            sobrecosto y se exige un verificador más.
          </p>
          <button type="button" className="btn-secundario mt-2 text-xs" onClick={() => setEtapas((es) => [...es, { descripcion: "", porcentaje: "0", plazoDias: "7", precio: "", unidad: "" }])} disabled={etapas.length >= 10}>
            + Etapa
          </button>
        </div>

        <div className="md:col-span-2">
          <span className="etiqueta">Verificadores independientes</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {verificadores.map((v) => (
              <label key={v.cuenta} className="flex items-center gap-2 rounded-lg border border-neutro-200 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={elegidos.includes(v.cuenta)}
                  disabled={mismaDireccion(v.cuenta, address)}
                  onChange={(e) => setElegidos((x) => (e.target.checked ? [...x, v.cuenta] : x.filter((y) => y !== v.cuenta)))}
                />
                <Direccion valor={v.cuenta} nombre={v.nombre} />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              Confirmaciones necesarias:
              <input className="campo w-20" type="number" min={2} max={elegidos.length} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} />
              de {elegidos.length}
            </label>
            <label className="flex items-center gap-2">
              Voz de la comunidad: debe confirmar el
              <input className="campo w-20" type="number" min={0} max={100} value={quorum} onChange={(e) => setQuorum(e.target.value)} />% del censo (0 = no aplica)
            </label>
          </div>
        </div>

        <div className="flex gap-2 md:col-span-2">
          <button className="btn-primario" disabled={!valido || !!pendiente}>
            {pendiente ? `${pendiente}…` : "Crear campaña"}
          </button>
          <button type="button" className="btn-secundario" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </div>
        {suma !== 100 && <p className="text-sm text-peligro-700 md:col-span-2">Los porcentajes deben sumar 100 %.</p>}
        {!refsValidas && <p className="text-sm text-peligro-700 md:col-span-2">Cada precio de referencia necesita su unidad.</p>}
      </form>
    </Seccion>
  );
}

// ───────────────────────── Verificador ─────────────────────────

function AccionesVerificador({ campana }: { campana: Address }) {
  const { address } = useAccount();
  const { info, etapas, votos } = useCampana(campana);
  const nombre = useNombres((etapas ?? []).map((e) => e.proveedor));
  const { ejecutar, pendiente } = useEscribir();
  const [evidencia, setEvidencia] = useState<EvidenciaLista | null>(null);
  const [contadas, setContadas] = useState("");
  useEffect(() => setContadas(""), [info?.etapaActual]);
  if (!info || !etapas) return null;
  const idx = Number(info.etapaActual);
  const etapa = etapas[idx];
  const miPos = info.verificadores.findIndex((v) => mismaDireccion(v, address));
  const miVoto = votos?.[0]?.[miPos] ?? 0;
  const c = { address: campana, abi: campanaEmergenciaAbi } as const;
  // Conteo en campo: si la factura declaró unidades, el verificador dice cuántas vio.
  const pideConteo = !!etapa && etapa.unidades > 0;
  const nContadas = Math.max(0, Math.floor(Number(contadas) || 0));
  const faltan = pideConteo && nContadas > 0 ? etapa.unidades - nContadas : 0;
  const unidad = etapa?.unidad || "unidades";

  function confirmar() {
    if (faltan > 0 && !confirm(`Contaste ${nContadas} y la factura dice ${etapa.unidades}. Tu confirmación quedará registrada como RECHAZO (entrega incompleta). ¿Continuar?`)) return;
    ejecutar({ ...c, functionName: "confirmarEntrega", args: [BigInt(idx), evidencia!.hash, evidencia!.uri, pideConteo ? nContadas : 0], etiqueta: "Confirmar entrega", exito: faltan > 0 ? "Registrado como rechazo: faltan unidades" : "Confirmación registrada" });
  }

  return (
    <Seccion titulo="Verificación de entregas" descripcion="Confirma solo si la entrega ocurrió. Sube la foto del acta: queda pública con fecha y ubicación.">
      {info.estado !== 1 || etapa?.estado !== 1 ? (
        <Vacio>{etapa?.estado === 2 ? "La etapa ya tiene los votos de los verificadores; falta la comunidad." : "No hay una etapa esperando verificación."}</Vacio>
      ) : miVoto !== 0 ? (
        <Vacio>Ya votaste en la etapa {idx + 1} ({miVoto === 1 ? "confirmaste" : "rechazaste"}).</Vacio>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 text-sm ${etapa.sobrecosto ? "bg-peligro-50" : "bg-alerta-50"}`}>
            <p className="font-semibold text-neutro-900">
              Etapa {idx + 1}: {etapa.descripcion} · {pesos(etapa.monto)} MockCOP
            </p>
            <p className="mt-1">
              Proveedor: <Direccion valor={etapa.proveedor} nombre={nombre(etapa.proveedor)} />
            </p>
            {etapa.sobrecosto && (
              <p className="mt-2 font-semibold text-peligro-700">
                ⚠ Sobrecosto: esta etapa exige {etapa.confirmacionesRequeridas} confirmaciones. Revisa la factura con cuidado y deja constancia en tu acta.
              </p>
            )}
          </div>
          <SubirEvidencia
            etiqueta="Foto del acta de entrega (o del motivo del rechazo)"
            clase="acta"
            campana={campana}
            etapa={idx}
            autor={address}
            titulo={`Verificación · etapa ${idx + 1}: ${etapa.descripcion}`}
            onLista={setEvidencia}
          />
          {pideConteo && (
            <label className="block text-sm">
              <span className="font-medium text-neutro-800">¿Cuántas unidades ({unidad}) contaste en el sitio? · obligatorio</span>
              <input
                className="campo mt-1 w-40"
                type="number"
                min={1}
                inputMode="numeric"
                value={contadas}
                onChange={(ev) => setContadas(ev.target.value)}
                placeholder="Cuenta en campo"
              />
              {nContadas > 0 && (
                <span className={`mt-1 block ${faltan > 0 ? "font-semibold text-peligro-700" : "text-exito-700"}`}>
                  {faltan > 0
                    ? `Faltan ${faltan} de ${etapa.unidades} facturadas: el contrato registrará tu voto como rechazo.`
                    : `✓ Cuadra con la factura (${etapa.unidades}).`}
                </span>
              )}
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primario"
              disabled={!evidencia || !!pendiente || (pideConteo && nContadas === 0)}
              onClick={confirmar}
            >
              Confirmar entrega
            </button>
            <button
              className="btn-peligro"
              disabled={!evidencia || !!pendiente}
              onClick={() => {
                if (confirm("¿Rechazar la etapa? Si se alcanza el número de rechazos, la campaña pasa a reembolso.")) {
                  ejecutar({ ...c, functionName: "rechazarEtapa", args: [BigInt(idx), evidencia!.hash, evidencia!.uri], etiqueta: "Rechazar etapa", exito: "Rechazo registrado" });
                }
              }}
            >
              Rechazar
            </button>
          </div>
        </div>
      )}
    </Seccion>
  );
}

/** Censo de familias: lo carga un verificador (no la fundación) y genera las tarjetas QR. */
function CensoBeneficiarios({ campana }: { campana: Address }) {
  const { info, etapas } = useCampana(campana);
  const { ejecutar, pendiente } = useEscribir();
  const qc = useQueryClient();
  const tarjetas = useTarjetas(campana).data ?? [];
  const [cantidad, setCantidad] = useState("10");
  const [prefijo, setPrefijo] = useState("Familia");
  if (!info) return null;
  const abierta = info.estado === 0 || info.estado === 1;
  const etapa = etapas?.[Number(info.etapaActual)];
  const n = Math.max(1, Math.min(200, Number(cantidad) || 0));

  async function registrar() {
    const nuevas = generarTarjetas(n, prefijo.trim() || "Familia", Number(info!.numeroBeneficiarios) + 1);
    const ok = await ejecutar({
      address: campana,
      abi: campanaEmergenciaAbi,
      functionName: "registrarBeneficiarios",
      args: [nuevas.map((t) => t.cuenta)],
      etiqueta: "Registrar censo",
      exito: `${n} familias registradas. Imprime sus tarjetas.`,
    });
    if (ok) {
      guardarTarjetas(campana, nuevas);
      await qc.invalidateQueries({ queryKey: ["tarjetas", campana] });
    }
  }

  return (
    <Seccion
      titulo="Censo de familias damnificadas"
      descripcion="Lo carga un verificador que conoce a la comunidad, nunca la fundación. Cada familia recibe una tarjeta con QR para confirmar, sin cripto, que recibió la ayuda."
      accion={
        tarjetas.length > 0 ? (
          <a className="btn-secundario px-3 py-1.5 text-xs" href={`#/tarjetas/${campana}`}>
            🖨 Tarjetas ({tarjetas.length})
          </a>
        ) : undefined
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <strong className="text-2xl text-comunidad-800">{info.numeroBeneficiarios.toString()}</strong> familias en el censo
          {info.quorumBeneficiariosBps > 0 ? ` · cada etapa necesita que confirme el ${info.quorumBeneficiariosBps / 100} %` : " · esta campaña no exige confirmación comunitaria"}
        </p>
        {etapa && etapa.beneficiariosRequeridos > 0 && (etapa.estado === 1 || etapa.estado === 2) && (
          <div>
            <p className="text-neutro-600">
              Etapa actual: {etapa.confirmacionesBeneficiarios} de {etapa.beneficiariosRequeridos} confirmaciones necesarias
            </p>
            <Barra valor={porcentaje(BigInt(etapa.confirmacionesBeneficiarios), BigInt(Math.max(1, etapa.beneficiariosRequeridos)))} className="bg-comunidad-600" />
          </div>
        )}
        {abierta && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-comunidad-50 p-3">
            <label>
              <span className="etiqueta">Familias a registrar</span>
              <input className="campo w-24" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="flex-1">
              <span className="etiqueta">Nombre en la tarjeta</span>
              <input className="campo" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} maxLength={40} />
            </label>
            <button className="btn-primario" disabled={!!pendiente} onClick={registrar}>
              Generar {n} tarjetas y registrar
            </button>
            <p className="w-full text-[11px] text-comunidad-900/70">
              Las llaves se crean en este navegador y solo quedan en las tarjetas: la cadena guarda únicamente la dirección pública de cada familia. En producción el censo se cruza con el
              Registro Único de Damnificados (RUD).
            </p>
          </div>
        )}
      </div>
    </Seccion>
  );
}

// ───────────────────────── Empresa aliada (matching) ─────────────────────────

function AccionesEmpresa({ campana }: { campana: Address }) {
  const { address } = useAccount();
  const { info, matchings } = useCampana(campana);
  const saldo = useSaldoCop();
  const { ejecutar, pendiente } = useEscribir();
  const [proporcion, setProporcion] = useState(10_000);
  const [tope, setTope] = useState("2000000");
  if (!info) return null;
  const mio = matchings.find((m) => mismaDireccion(m.empresa, address));
  const restante = info.meta - info.totalRecaudado;
  const wei = parseEther(String(Number(tope) || 0));

  async function comprometer() {
    const ok = await ejecutar({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "approve", args: [campana, wei], etiqueta: "Autorizar MockCOP", exito: "Autorización lista" });
    if (!ok) return;
    await ejecutar({
      address: campana,
      abi: campanaEmergenciaAbi,
      functionName: "comprometerMatching",
      args: [proporcion, wei],
      etiqueta: "Comprometer matching",
      exito: "Matching activo: cada donación nueva se multiplica",
    });
  }

  return (
    <Seccion titulo="Matching de tu empresa" descripcion="Bloquea fondos en el contrato para multiplicar cada donación. Lo que no se use vuelve a tu empresa al cerrar el recaudo.">
      {mio ? (
        <div className="space-y-2 text-sm">
          <p>
            Comprometiste {pesos(mio.tope)} MockCOP ({mio.proporcionBps / 100} % de cada donación). Usado: <strong>{pesos(mio.usado)}</strong>.
          </p>
          <Barra valor={porcentaje(mio.usado, mio.tope)} className="bg-alerta-500" />
          <p className="text-xs text-neutro-500">Lo usado cuenta como tu aporte: si la campaña entra en reembolso, recuperas tu parte como cualquier donante.</p>
        </div>
      ) : info.estado !== 0 ? (
        <Vacio>La campaña ya no recauda: el matching solo se puede comprometer mientras recibe donaciones.</Vacio>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              [5000, "+50 %"],
              [10_000, "Duplica"],
              [20_000, "Triplica"],
            ].map(([bps, t]) => (
              <label key={bps} className={`cursor-pointer rounded-xl border p-2 text-center font-semibold ${proporcion === bps ? "border-alerta-500 bg-alerta-50" : "border-neutro-200"}`}>
                <input type="radio" className="sr-only" checked={proporcion === bps} onChange={() => setProporcion(bps as number)} />
                {t}
              </label>
            ))}
          </div>
          <label className="block">
            <span className="etiqueta">Tope (MockCOP) · máximo {pesos(restante)}</span>
            <input className="campo" inputMode="numeric" value={tope} onChange={(e) => setTope(e.target.value.replace(/\D/g, ""))} />
          </label>
          {saldo !== undefined && saldo < wei && <p className="rounded-lg bg-peligro-50 p-2 text-xs text-peligro-800">Tu saldo ({pesos(saldo)}) no alcanza.</p>}
          <button className="btn-primario w-full" disabled={!!pendiente || wei === 0n || wei > restante} onClick={comprometer}>
            Bloquear {pesos(wei)} y activar matching
          </button>
        </div>
      )}
    </Seccion>
  );
}

// ───────────────────────── Cualquiera ─────────────────────────

function AccionesPublicas({ campana }: { campana: Address }) {
  const { info, etapas } = useCampana(campana);
  const { ejecutar, pendiente } = useEscribir();
  const ahora = useAhora();
  if (!info || !etapas) return null;
  const c = { address: campana, abi: campanaEmergenciaAbi } as const;
  const etapa = etapas[Number(info.etapaActual)];
  const etapaVencida = info.estado === 1 && etapa && tiempoRestante(etapa.fechaLimite, ahora).vencido;
  const recaudoVencido = info.estado === 0 && tiempoRestante(info.fechaCierreRecaudo, ahora).vencido && info.totalRecaudado > 0n;
  if (!etapaVencida && !recaudoVencido) return null;
  return (
    <Seccion titulo="Acciones abiertas a cualquiera">
      {etapaVencida && (
        <button
          className="btn-peligro"
          disabled={!!pendiente}
          onClick={() => ejecutar({ ...c, functionName: "activarReembolsoPorVencimiento", etiqueta: "Activar reembolso", exito: "Reembolso activado: los donantes ya pueden reclamar" })}
        >
          La etapa venció: activar reembolso
        </button>
      )}
      {recaudoVencido && (
        <button className="btn-primario" disabled={!!pendiente} onClick={() => ejecutar({ ...c, functionName: "cerrarRecaudo", etiqueta: "Cerrar recaudo" })}>
          El plazo de recaudo venció: cerrar recaudo
        </button>
      )}
    </Seccion>
  );
}

// ───────────────────────── Administrador del registro ─────────────────────────

function AdminRegistro() {
  const { roles, fundaciones, verificadores, proveedores, empresas } = useActores();
  const { ejecutar, pendiente } = useEscribir();
  const [rol, setRol] = useState<"fundacion" | "verificador" | "proveedor" | "empresa">("proveedor");
  const [cuenta, setCuenta] = useState("");
  const [nombre, setNombre] = useState("");
  const reg = { address: DIRECCIONES.registro, abi: registroActoresAbi } as const;

  const listas = [
    { titulo: "Fundaciones", rol: roles.fundacion, items: fundaciones },
    { titulo: "Verificadores", rol: roles.verificador, items: verificadores },
    { titulo: "Proveedores", rol: roles.proveedor, items: proveedores },
    { titulo: "Empresas aliadas", rol: roles.empresa, items: empresas },
  ];

  return (
    <Seccion titulo="Registro de actores" descripcion="Como administrador habilitas fundaciones, verificadores, proveedores y empresas aliadas. Solo los proveedores registrados pueden cobrar.">
      <form
        className="grid gap-3 md:grid-cols-[170px_1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = roles[rol];
          if (!r || !esDireccion(cuenta) || !nombre.trim()) return;
          const ok = await ejecutar({ ...reg, functionName: "registrarActor", args: [r, cuenta, nombre.trim()], etiqueta: "Registrar actor", exito: `${nombre} registrado` });
          if (ok) {
            setCuenta("");
            setNombre("");
          }
        }}
      >
        <select className="campo" value={rol} onChange={(e) => setRol(e.target.value as typeof rol)} aria-label="Rol">
          <option value="fundacion">Fundación</option>
          <option value="verificador">Verificador</option>
          <option value="proveedor">Proveedor</option>
          <option value="empresa">Empresa aliada</option>
        </select>
        <input className="campo font-mono" placeholder="0x… dirección" value={cuenta} onChange={(e) => setCuenta(e.target.value.trim())} aria-label="Dirección" />
        <input className="campo" placeholder="Nombre público" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
        <button className="btn-primario" disabled={!!pendiente || !esDireccion(cuenta) || !nombre.trim()}>
          Registrar
        </button>
      </form>
      {cuenta && !esDireccion(cuenta) && <p className="mt-1 text-xs text-peligro-700">Dirección inválida.</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {listas.map((l) => (
          <div key={l.titulo}>
            <h3 className="etiqueta">{l.titulo}</h3>
            <ul className="space-y-2">
              {l.items.map((a) => (
                <li key={a.cuenta} className="flex items-center justify-between gap-2 rounded-lg border border-neutro-200 p-2 text-sm">
                  <Direccion valor={a.cuenta} nombre={a.nombre} />
                  <button
                    className="text-xs font-medium text-peligro-700 hover:underline disabled:opacity-50"
                    disabled={!!pendiente}
                    onClick={() => {
                      if (confirm(`¿Revocar a ${a.nombre}?`)) ejecutar({ ...reg, functionName: "revocarActor", args: [l.rol!, a.cuenta], etiqueta: "Revocar actor" });
                    }}
                  >
                    revocar
                  </button>
                </li>
              ))}
              {l.items.length === 0 && <li className="text-sm text-neutro-400">—</li>}
            </ul>
          </div>
        ))}
      </div>
    </Seccion>
  );
}
