import type { ReactNode } from "react";
import type { Address } from "viem";
import type { InfoCampana, Reputacion } from "../lib/datos";
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
  const { info, matchings, etapas } = useCampana(direccion);
  const nombre = useNombres([info?.fundacion, ...matchings.map((m) => m.empresa)]);
  const rep = useReputacion([info?.fundacion]);
  const ahora = useAhora(5000);
  if (!info) return <div className="h-80 animate-pulse rounded-2xl bg-gradient-to-br from-marca-200/60 to-neutro-200/60" />;
  const avance = porcentaje(info.totalRecaudado, info.meta);
  const estado = ESTADO_CAMPANA[info.estado];
  const plazo = tiempoRestante(info.fechaCierreRecaudo, ahora);
  const plazoTotal = Number(info.fechaCierreRecaudo - info.fechaCreacion);
  const transcurrido = plazoTotal > 0 ? Math.min(100, Math.max(0, ((ahora / 1000 - Number(info.fechaCreacion)) / plazoTotal) * 100)) : 0;
  const etapaActual = etapas?.[Number(info.etapaActual)];
  const enRevision = info.estado === 1 && !!etapaActual && (etapaActual.estado === 1 || etapaActual.estado === 2);
  // Misma regla del contrato: redondea hacia arriba (30 % de 20 = 6 familias)
  const familiasRequeridas = enRevision
    ? etapaActual!.beneficiariosRequeridos
    : Math.ceil((Number(info.numeroBeneficiarios) * info.quorumBeneficiariosBps) / 10_000);
  const empresasConMatching = matchings.filter((m) => m.usado > 0n).length;
  const donantes = Number(info.numeroDonantes) - empresasConMatching;

  return (
    <section className="overflow-hidden rounded-2xl border border-neutro-200/80 bg-white shadow-suave">
      {/* Franja de marca: estado, nombre, monto y avance */}
      <div className="relative overflow-hidden bg-gradient-to-br from-marca-700 via-marca-800 to-marca-950 px-5 pb-6 pt-5 text-white sm:px-7 sm:pb-7 sm:pt-6">
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 text-white/[0.06]">
          <circle cx="100" cy="100" r="98" fill="currentColor" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="14" />
        </svg>
        <div className="relative">
          <Insignia texto={estado} />
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-[32px]">{info.nombre}</h1>
          {info.descripcion && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-marca-50/80">{info.descripcion}</p>}

          <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
            <p className="tabular">
              <span className="font-display text-3xl font-extrabold sm:text-4xl">{pesos(info.totalRecaudado)}</span>
              <span className="ml-1.5 text-sm text-marca-50/70">de {pesos(info.meta)} MockCOP</span>
            </p>
            <p className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-semibold tabular ring-1 ring-inset ring-white/15">{avance.toFixed(1)} %</p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(avance)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-marca-300 to-white transition-all duration-700 ease-out" style={{ width: `${Math.min(100, avance)}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-7">
      <TarjetaFundacion cuenta={info.fundacion} nombre={nombre(info.fundacion)} rep={rep(info.fundacion)} />

      {matchings.length > 0 && (
        <ul className="space-y-2">
          {matchings.map((m) => {
            const libre = m.tope - m.usado;
            const activo = info.estado === 0 && libre > 0n;
            const que = m.proporcionBps === 10_000 ? "duplica cada donación" : `suma el ${m.proporcionBps / 100} % de cada donación`;
            return (
              <li key={m.empresa} className={activo ? "nota-matching" : "nota bg-neutro-50 text-neutro-700 ring-neutro-200"}>
                <p className="mb-2 flex items-start gap-2">
                  <span aria-hidden>🎁</span>
                  <span>
                    <strong>{nombre(m.empresa) ?? corta(m.empresa)}</strong> {activo ? `${que} · quedan ${pesos(libre)} de ${pesos(m.tope)} MockCOP` : `sumó ${pesos(m.usado)} MockCOP a las donaciones`}
                  </span>
                </p>
                {activo && <Barra valor={porcentaje(m.usado, m.tope)} className="bg-gradient-to-r from-alerta-400 to-alerta-600" />}
              </li>
            );
          })}
        </ul>
      )}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {/* Pagado a proveedores */}
        <Dato titulo="Pagado a proveedores" extra={`${porcentaje(info.totalPagado, info.totalRecaudado).toFixed(0)} %`}>
          <dd className="font-display text-xl font-extrabold text-neutro-900">
            ${pesos(info.totalPagado)} <span className="text-sm font-semibold text-neutro-400">de ${pesos(info.totalRecaudado)}</span>
          </dd>
          <Barra valor={porcentaje(info.totalPagado, info.totalRecaudado)} className="bg-gradient-to-r from-exito-400 to-exito-600" />
          <p className="text-xs text-neutro-500">{info.estado === 0 ? "Los pagos empiezan cuando se cierra el recaudo." : "Siempre directo del contrato al proveedor."}</p>
        </Dato>

        {/* Cierre del recaudo, o reembolsos si ya cerró */}
        {info.estado === 0 ? (
          <Dato titulo="Cierre del recaudo" extra={plazo.vencido ? "vencido" : undefined}>
            <dd className={`font-display text-xl font-extrabold ${plazo.vencido ? "text-peligro-700" : "text-neutro-900"}`}>
              {plazo.vencido ? "Plazo vencido" : plazo.texto} {!plazo.vencido && <span className="text-sm font-semibold text-neutro-400">restantes</span>}
            </dd>
            <Barra valor={transcurrido} className={plazo.vencido ? "bg-peligro-500" : "bg-gradient-to-r from-info-400 to-info-600"} />
            <p className="text-xs text-neutro-500">
              Plazo total de {duracion(info.fechaCierreRecaudo - info.fechaCreacion)} · cierra el {fecha(info.fechaCierreRecaudo)}
            </p>
          </Dato>
        ) : (
          <Dato titulo="Reembolsado a donantes" extra={`${porcentaje(info.totalReembolsado, info.totalRecaudado).toFixed(0)} %`}>
            <dd className="font-display text-xl font-extrabold text-neutro-900">
              ${pesos(info.totalReembolsado)} <span className="text-sm font-semibold text-neutro-400">de ${pesos(info.totalRecaudado)}</span>
            </dd>
            <Barra valor={porcentaje(info.totalReembolsado, info.totalRecaudado)} className="bg-gradient-to-r from-info-400 to-info-600" />
            <p className="text-xs text-neutro-500">{info.estado === 3 ? "Cada donante reclama su parte de lo no pagado." : "No hubo reembolsos: todo llegó a los proveedores."}</p>
          </Dato>
        )}

        {/* Verificación: en vivo si hay una etapa en revisión; si no, la regla */}
        <Dato titulo="Verificación" extra={enRevision ? `Etapa ${Number(info.etapaActual) + 1} en revisión` : undefined}>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex gap-1" aria-hidden>
              {info.verificadores.map((v, i) => (
                <IconoPersona key={v} activa={i < (enRevision ? etapaActual!.confirmaciones : info.umbral)} />
              ))}
            </span>
            <span className="text-neutro-700">
              {enRevision ? (
                <>
                  <strong className="text-neutro-900">{etapaActual!.confirmaciones}</strong> de {etapaActual!.confirmacionesRequeridas} verificadores
                </>
              ) : (
                <>
                  Necesita <strong className="text-neutro-900">{info.umbral} de {info.verificadores.length}</strong> verificadores
                </>
              )}
            </span>
          </dd>
          {familiasRequeridas > 0 && (
            <>
              <p className="flex items-center gap-1.5 text-neutro-700">
                <span aria-hidden>👪</span>
                {enRevision ? (
                  <span>
                    <strong className="text-comunidad-800">{etapaActual!.confirmacionesBeneficiarios}</strong> de {familiasRequeridas} familias confirmaron
                  </span>
                ) : (
                  <span>
                    y <strong className="text-comunidad-800">{familiasRequeridas} de {info.numeroBeneficiarios.toString()}</strong> familias ({info.quorumBeneficiariosBps / 100} %)
                  </span>
                )}
              </p>
              {enRevision && (
                <Barra valor={(etapaActual!.confirmacionesBeneficiarios / familiasRequeridas) * 100} className="bg-gradient-to-r from-comunidad-400 to-comunidad-600" />
              )}
            </>
          )}
        </Dato>

        {/* Donantes */}
        <Dato titulo="Donantes" extra={empresasConMatching > 0 ? `+ ${empresasConMatching} ${empresasConMatching === 1 ? "empresa aliada" : "empresas aliadas"}` : undefined}>
          <dd className="font-display text-xl font-extrabold text-neutro-900">
            {donantes} <span className="text-sm font-semibold text-neutro-400">{donantes === 1 ? "persona donó" : "personas donaron"}</span>
          </dd>
          <p className="flex flex-wrap items-center gap-1" aria-hidden>
            {Array.from({ length: Math.min(donantes, MAX_CORAZONES) }, (_, i) => (
              <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-marca-100 text-[10px] text-marca-700">
                ♥
              </span>
            ))}
            {donantes > MAX_CORAZONES && <span className="ml-1 text-xs font-semibold text-neutro-500">+{donantes - MAX_CORAZONES}</span>}
          </p>
        </Dato>
      </dl>

      {info.estado === 3 && (
        <p className="nota-peligro">
          Campaña en reembolso porque {MOTIVO_REEMBOLSO[info.motivoReembolso]}. Cada donante puede reclamar su parte de lo no
          pagado desde la vista <a className="font-semibold underline" href={`#/rastreo/${info.direccion}`}>Rastreo</a>.
        </p>
      )}
      <p className="truncate font-mono text-[11px] text-neutro-400" title={info.direccion}>Contrato: {info.direccion}</p>
      </div>
    </section>
  );
}

const MAX_CORAZONES = 12;

/** "6 d 23 h", "3 d", "5 h" a partir de segundos. */
function duracion(segundos: bigint) {
  const s = Number(segundos);
  const d = Math.floor(s / 86400);
  const h = Math.round((s % 86400) / 3600);
  return d > 0 ? `${d} ${d === 1 ? "día" : "días"}${h > 0 ? ` y ${h} h` : ""}` : `${h} h`;
}

function Dato({ titulo, extra, children }: { titulo: string; extra?: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
      <dt className="flex items-center justify-between gap-2 text-xs font-semibold text-neutro-500">
        {titulo}
        {extra && <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-neutro-600 ring-1 ring-inset ring-neutro-200">{extra}</span>}
      </dt>
      {children}
    </div>
  );
}

function IconoPersona({ activa }: { activa: boolean }) {
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${activa ? "bg-marca-600 text-white" : "bg-white text-neutro-300 ring-1 ring-inset ring-neutro-200"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" />
      </svg>
    </span>
  );
}

/** Quién organiza la campaña y qué tan confiable ha sido, según su historial on-chain. */
function TarjetaFundacion({ cuenta, nombre, rep }: { cuenta: Address; nombre?: string; rep?: Reputacion }) {
  const indice = rep?.indice ?? null;
  const color = indice === null ? "text-neutro-300" : indice >= 90 ? "text-exito-500" : indice >= 60 ? "text-alerta-500" : "text-peligro-500";
  const r = 22;
  const vuelta = 2 * Math.PI * r;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white font-display text-xl font-extrabold text-marca-700 shadow-sm ring-1 ring-inset ring-marca-100">
        {(nombre ?? "F").trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-[10rem] flex-1">
        <p className="rotulo">Organiza la campaña</p>
        <p className="mt-0.5 font-display text-base font-bold text-neutro-900">{nombre ?? "Fundación"}</p>
        <Direccion valor={cuenta} />
      </div>
      {rep && (
        <div className="flex w-full items-center gap-3 border-t border-neutro-200/80 pt-3 sm:w-auto sm:border-0 sm:pt-0">
          <div className="relative h-14 w-14 shrink-0" title="Índice de confianza on-chain">
            <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
              <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-neutro-200" />
              <circle
                cx="28"
                cy="28"
                r={r}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                stroke="currentColor"
                className={`${color} transition-all duration-700`}
                strokeDasharray={vuelta}
                strokeDashoffset={vuelta * (1 - (indice ?? 0) / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-extrabold text-neutro-900">{indice === null ? "—" : `${Math.round(indice)}%`}</span>
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-neutro-800">{indice === null ? "Sin historial" : "Confianza"}</p>
            <p className="text-neutro-500">
              {rep.evaluadas} hechos · {rep.campanas} {rep.campanas === 1 ? "campaña" : "campañas"}
            </p>
            {rep.sobrecostos > 0 && (
              <p className="mt-0.5 inline-flex rounded-full bg-peligro-600 px-2 py-0.5 font-semibold text-white">
                {rep.sobrecostos} sobrecosto{rep.sobrecostos > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}
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
          <li
            key={i}
            className={`rounded-xl border border-l-4 p-4 transition ${
              e.sobrecosto && e.estado < 3
                ? "border-peligro-200 border-l-peligro-500 bg-peligro-50/50"
                : actual
                  ? "border-alerta-200 border-l-alerta-400 bg-alerta-50/60 shadow-suave"
                  : e.estado === 3
                    ? "border-neutro-200/80 border-l-exito-500 bg-white"
                    : e.estado === 4
                      ? "border-neutro-200/80 border-l-peligro-400 bg-white"
                      : "border-neutro-200/80 border-l-neutro-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                    e.estado === 3 ? "bg-exito-600 text-white" : e.estado === 4 ? "bg-peligro-600 text-white" : actual ? "bg-alerta-400 text-alerta-950" : "bg-neutro-100 text-neutro-600 ring-1 ring-inset ring-neutro-200"
                  }`}
                >
                  {e.estado === 3 ? "✓" : e.estado === 4 ? "✕" : i + 1}
                </span>
                <div>
                  <p className="font-semibold text-neutro-900">
                    {e.descripcion} <span className="font-normal text-neutro-500">· {e.porcentajeBps / 100} %</span>
                  </p>
                  <p className="text-sm text-neutro-500">
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
              <p className="mt-3 rounded-lg bg-peligro-600 px-3 py-2 text-sm text-white">
                ⚠ <strong>Alerta de sobrecosto:</strong> ${pesos(precio.unitario)} por {e.unidad} ({e.unidades} {e.unidades === 1 ? "unidad" : "unidades"}) contra ${pesos(e.precioReferencia)} de referencia (+
                {precio.diferencia.toFixed(0)} %). El contrato exige {e.confirmacionesRequeridas} de {info.verificadores.length} verificadores
                {e.rechazosRequeridos === 1 ? " y un solo rechazo la tumba" : ""}.
              </p>
            )}

            {e.unidadesNoCuadran && (
              <p className="mt-3 rounded-lg bg-peligro-50 px-3 py-2 text-sm text-peligro-800">
                ⚠ <strong>El conteo en campo no cuadra:</strong> al menos un verificador contó menos de {e.unidades} {e.unidad || "unidades"} que dice la factura. Su voto quedó como rechazo.
              </p>
            )}

            {(tieneProveedor || (actual && plazo)) && (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {tieneProveedor && (
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="text-neutro-500">Proveedor: </span>
                    <Direccion valor={e.proveedor} nombre={nombre(e.proveedor)} />
                    <InsigniaConfianza rep={rep(e.proveedor)} rol="proveedor" />
                  </p>
                )}
                {actual && plazo && (
                  <p className={plazo.vencido ? "font-semibold text-peligro-700" : "text-neutro-600"}>
                    {plazo.vencido ? "Plazo vencido" : `Plazo: vence en ${plazo.texto}`}
                    <span className="text-neutro-400"> ({fecha(e.fechaLimite)})</span>
                  </p>
                )}
                {precio && !e.sobrecosto && (
                  <p className="text-neutro-600">
                    {e.unidades} × {e.unidad} a ${pesos(precio.unitario)} c/u <span className="text-exito-700">✓ dentro de la referencia</span>
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
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutro-500">
                      Verificadores: {e.confirmaciones} de {e.confirmacionesRequeridas} · {e.rechazos} rechazos
                    </p>
                    <ul className="space-y-1 text-sm">
                      {info.verificadores.map((v, j) => (
                        <li key={v} className="flex flex-wrap items-center justify-between gap-2">
                          <Direccion valor={v} nombre={nombre(v)} />
                          <span className={votos[0][j] === 1 ? "text-exito-700" : votos[0][j] === 2 ? "text-peligro-700" : "text-neutro-400"}>
                            {VOTO[votos[0][j]]}
                            {e.unidades > 0 && votos[3][j] > 0 && (
                              <span className={votos[3][j] < e.unidades ? " font-semibold" : " text-neutro-500"}> · contó {votos[3][j]} de {e.unidades}</span>
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
                      <p className="mb-1 text-xs text-neutro-500">{nombre(v) ?? corta(v)}</p>
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
    <div className={`rounded-lg p-3 ${listo ? "bg-comunidad-50" : "bg-white"}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-comunidad-700">Voz de la comunidad</p>
      <p className="text-sm text-neutro-700">
        <strong className="text-lg text-comunidad-800">{confirmaron}</strong> de {censo} familias confirmaron que recibieron
        {!pagada && <span className="text-neutro-500"> (se necesitan {requeridas})</span>}
      </p>
      <Barra valor={censo ? (confirmaron / censo) * 100 : 0} className="bg-comunidad-600" />
      {!pagada && !listo && <p className="mt-1 text-[11px] text-neutro-500">Sin la comunidad el pago no sale, aunque los verificadores aprueben.</p>}
    </div>
  );
}
