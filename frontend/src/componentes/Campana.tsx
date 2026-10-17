import type { Address } from "viem";
import type { InfoCampana } from "../lib/datos";
import { useAhora, useCampana, useNombres, useReputacion } from "../lib/datos";
import { ESTADO_CAMPANA, MOTIVO_REEMBOLSO, VOTO, analizarPrecio, etiquetaEtapa, corta, fecha, pesos, porcentaje, tiempoRestante } from "../lib/formato";
import { Barra, Direccion, Insignia } from "./Comunes";
import { VerEvidencia } from "./Evidencia";
import { InsigniaConfianza } from "./Reputacion";

export function SelectorCampana({
  campanas,
  seleccionada,
  onCambiar,
}: {
  campanas: InfoCampana[];
  seleccionada?: Address;
  onCambiar: (a: Address) => void;
}) {
  if (campanas.length === 0) return null;
  return (
    <label className="block">
      <span className="etiqueta">Campaña</span>
      <select className="campo" value={seleccionada ?? ""} onChange={(e) => onCambiar(e.target.value as Address)}>
        {campanas.map((c) => (
          <option key={c.direccion} value={c.direccion}>
            {c.nombre} — {ESTADO_CAMPANA[c.estado]} ({pesos(c.totalRecaudado)} / {pesos(c.meta)})
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResumenCampana({ direccion }: { direccion: Address }) {
  const { info, matchings } = useCampana(direccion);
  const nombre = useNombres([info?.fundacion, ...matchings.map((m) => m.empresa)]);
  const rep = useReputacion([info?.fundacion]);
  const ahora = useAhora(5000);
  if (!info) return <div className="tarjeta h-40 animate-pulse" />;
  const avance = porcentaje(info.totalRecaudado, info.meta);
  const estado = ESTADO_CAMPANA[info.estado];
  const plazo = tiempoRestante(info.fechaCierreRecaudo, ahora);

  return (
    <section className="tarjeta">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia texto={estado} />
        <span className="text-xs text-stone-500">
          Fundación: <Direccion valor={info.fundacion} nombre={nombre(info.fundacion)} />
        </span>
        <InsigniaConfianza rep={rep(info.fundacion)} rol="fundacion" />
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{info.nombre}</h1>
      {info.descripcion && <p className="mt-2 max-w-3xl text-stone-600">{info.descripcion}</p>}

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <p>
            <span className="text-2xl font-bold text-teal-800">{pesos(info.totalRecaudado)}</span>
            <span className="text-stone-500"> de {pesos(info.meta)} MockCOP</span>
          </p>
          <p className="text-sm text-stone-500">{avance.toFixed(1)} %</p>
        </div>
        <Barra valor={avance} />
      </div>

      {matchings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {matchings.map((m) => {
            const libre = m.tope - m.usado;
            const activo = info.estado === 0 && libre > 0n;
            const que = m.proporcionBps === 10_000 ? "duplica cada donación" : `suma el ${m.proporcionBps / 100} % de cada donación`;
            return (
              <li key={m.empresa} className={`rounded-xl p-3 text-sm ${activo ? "bg-gradient-to-r from-amber-100 to-orange-50 text-amber-950" : "bg-stone-100 text-stone-700"}`}>
                <p className="mb-1.5">
                  <strong>{nombre(m.empresa) ?? corta(m.empresa)}</strong> {activo ? `${que} · quedan ${pesos(libre)} de ${pesos(m.tope)} MockCOP` : `sumó ${pesos(m.usado)} MockCOP a las donaciones`}
                </p>
                {activo && <Barra valor={porcentaje(m.usado, m.tope)} className="bg-amber-500" />}
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Dato titulo="Donantes" valor={(info.numeroDonantes - BigInt(matchings.filter((m) => m.usado > 0n).length)).toString()} />
        <Dato titulo="Pagado a proveedores" valor={`${pesos(info.totalPagado)}`} />
        <Dato
          titulo="Verificación"
          valor={`${info.umbral} de ${info.verificadores.length}${info.quorumBeneficiariosBps > 0 ? ` + ${info.quorumBeneficiariosBps / 100} % de ${info.numeroBeneficiarios} familias` : ""}`}
        />
        <Dato
          titulo={info.estado === 0 ? "Cierre del recaudo" : "Reembolsado"}
          valor={info.estado === 0 ? (plazo.vencido ? "vencido" : `en ${plazo.texto}`) : pesos(info.totalReembolsado)}
        />
      </dl>

      {info.estado === 3 && (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          Campaña en reembolso porque {MOTIVO_REEMBOLSO[info.motivoReembolso]}. Cada donante puede reclamar su parte de lo no
          pagado desde la vista <a className="font-semibold underline" href={`#/rastreo/${info.direccion}`}>Rastreo</a>.
        </p>
      )}
      <p className="mt-4 font-mono text-[11px] text-stone-400">Contrato: {info.direccion}</p>
    </section>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{titulo}</dt>
      <dd className="mt-0.5 font-semibold text-stone-900">{valor}</dd>
    </div>
  );
}

/** Línea de tiempo de etapas: monto, proveedor, precio por unidad, evidencia, votos, comunidad y plazo. */
export function Etapas({ direccion, detallada = true }: { direccion: Address; detallada?: boolean }) {
  const { info, etapas, votos } = useCampana(direccion);
  const proveedores = (etapas ?? []).map((e) => e.proveedor);
  const nombre = useNombres([...proveedores, ...(info?.verificadores ?? [])]);
  const rep = useReputacion(proveedores);
  const ahora = useAhora();
  if (!info || !etapas) return null;
  const cerrado = info.estado !== 0;

  return (
    <ol className="space-y-3">
      {etapas.map((e, i) => {
        const estado = etiquetaEtapa(e.estado, info.estado);
        const actual = BigInt(i) === info.etapaActual && info.estado === 1;
        const plazo = e.fechaLimite > 0n ? tiempoRestante(e.fechaLimite, ahora) : null;
        const tieneProveedor = e.proveedor !== "0x0000000000000000000000000000000000000000";
        const precio = e.unidades > 0 ? analizarPrecio(e.monto, e.unidades, e.precioReferencia) : null;
        const votando = actual && (e.estado === 1 || e.estado === 2);
        return (
          <li key={i} className={`rounded-xl border p-4 ${e.sobrecosto && e.estado < 3 ? "border-rose-300 bg-rose-50/40" : actual ? "border-amber-300 bg-amber-50/50" : "border-stone-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${e.estado === 3 ? "bg-emerald-600 text-white" : e.estado === 4 ? "bg-rose-600 text-white" : "bg-stone-200 text-stone-700"}`}>
                  {e.estado === 3 ? "✓" : e.estado === 4 ? "✕" : i + 1}
                </span>
                <div>
                  <p className="font-semibold text-stone-900">
                    {e.descripcion} <span className="font-normal text-stone-500">· {e.porcentajeBps / 100} %</span>
                  </p>
                  <p className="text-sm text-stone-500">
                    {cerrado ? `${pesos(e.monto)} MockCOP` : `${e.porcentajeBps / 100} % de lo recaudado`}
                    {e.precioReferencia > 0n && <span> · referencia ${pesos(e.precioReferencia)} por {e.unidad}</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {e.sobrecosto && <Insignia texto="Sobrecosto" />}
                <Insignia texto={estado} />
              </div>
            </div>

            {e.sobrecosto && precio && (
              <p className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white">
                ⚠ <strong>Alerta de sobrecosto:</strong> ${pesos(precio.unitario)} por {e.unidad} ({e.unidades} {e.unidades === 1 ? "unidad" : "unidades"}) contra ${pesos(e.precioReferencia)} de referencia (+
                {precio.diferencia.toFixed(0)} %). El contrato exige {e.confirmacionesRequeridas} de {info.verificadores.length} verificadores
                {e.rechazosRequeridos === 1 ? " y un solo rechazo la tumba" : ""}.
              </p>
            )}

            {e.unidadesNoCuadran && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                ⚠ <strong>El conteo en campo no cuadra:</strong> al menos un verificador contó menos de {e.unidades} {e.unidad || "unidades"} que dice la factura. Su voto quedó como rechazo.
              </p>
            )}

            {(tieneProveedor || (actual && plazo)) && (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {tieneProveedor && (
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="text-stone-500">Proveedor: </span>
                    <Direccion valor={e.proveedor} nombre={nombre(e.proveedor)} />
                    <InsigniaConfianza rep={rep(e.proveedor)} rol="proveedor" />
                  </p>
                )}
                {actual && plazo && (
                  <p className={plazo.vencido ? "font-semibold text-rose-700" : "text-stone-600"}>
                    {plazo.vencido ? "Plazo vencido" : `Plazo: vence en ${plazo.texto}`}
                    <span className="text-stone-400"> ({fecha(e.fechaLimite)})</span>
                  </p>
                )}
                {precio && !e.sobrecosto && (
                  <p className="text-stone-600">
                    {e.unidades} × {e.unidad} a ${pesos(precio.unitario)} c/u <span className="text-emerald-700">✓ dentro de la referencia</span>
                  </p>
                )}
              </div>
            )}

            {detallada && tieneProveedor && (
              <div className="mt-3">
                <VerEvidencia uri={e.uriEvidencia} hash={e.hashEvidencia} compacta={!actual} />
              </div>
            )}

            {(votando || (e.beneficiariosRequeridos > 0 && e.estado >= 1)) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {votando && votos && (
                  <div className="rounded-lg bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Verificadores: {e.confirmaciones} de {e.confirmacionesRequeridas} · {e.rechazos} rechazos
                    </p>
                    <ul className="space-y-1 text-sm">
                      {info.verificadores.map((v, j) => (
                        <li key={v} className="flex flex-wrap items-center justify-between gap-2">
                          <Direccion valor={v} nombre={nombre(v)} />
                          <span className={votos[0][j] === 1 ? "text-emerald-700" : votos[0][j] === 2 ? "text-rose-700" : "text-stone-400"}>
                            {VOTO[votos[0][j]]}
                            {e.unidades > 0 && votos[3][j] > 0 && (
                              <span className={votos[3][j] < e.unidades ? " font-semibold" : " text-stone-500"}> · contó {votos[3][j]} de {e.unidades}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {e.beneficiariosRequeridos > 0 && (
                  <ComunidadEtapa confirmaron={e.confirmacionesBeneficiarios} requeridas={e.beneficiariosRequeridos} censo={Number(info.numeroBeneficiarios)} pagada={e.estado === 3} />
                )}
              </div>
            )}

            {detallada && votando && votos && votos[2].some((u) => u) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {info.verificadores.map((v, j) =>
                  votos[2][j] ? (
                    <div key={v}>
                      <p className="mb-1 text-xs text-stone-500">{nombre(v) ?? corta(v)}</p>
                      <VerEvidencia uri={votos[2][j]} hash={votos[1][j]} compacta />
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ComunidadEtapa({ confirmaron, requeridas, censo, pagada }: { confirmaron: number; requeridas: number; censo: number; pagada: boolean }) {
  const listo = confirmaron >= requeridas;
  return (
    <div className={`rounded-lg p-3 ${listo ? "bg-violet-50" : "bg-white"}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Voz de la comunidad</p>
      <p className="text-sm text-stone-700">
        <strong className="text-lg text-violet-800">{confirmaron}</strong> de {censo} familias confirmaron que recibieron
        {!pagada && <span className="text-stone-500"> (se necesitan {requeridas})</span>}
      </p>
      <Barra valor={censo ? (confirmaron / censo) * 100 : 0} className="bg-violet-600" />
      {!pagada && !listo && <p className="mt-1 text-[11px] text-stone-500">Sin la comunidad el pago no sale, aunque los verificadores aprueben.</p>}
    </div>
  );
}
