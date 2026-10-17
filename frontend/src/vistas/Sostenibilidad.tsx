import { Direccion, Seccion } from "../componentes/Comunes";
import { tonoIndice } from "../componentes/Reputacion";
import { useActores, useReputacion } from "../lib/datos";
import { TRAMOS, tasaBps, textoTasa } from "../lib/sostenibilidad";

const PASOS = [
  { icono: "🔒", titulo: "Se aparta una reserva", texto: "Al cerrar el recaudo, el contrato separa una tasa pequeña de lo recaudado. Las etapas se calculan con el resto." },
  { icono: "✓", titulo: "Sale solo si la ayuda llega", texto: "Cada vez que verificadores y familias confirman una entrega y se paga la etapa, sale la parte proporcional al Fondo de Sostenibilidad." },
  { icono: "↺", titulo: "Si algo falla, vuelve", texto: "Si una etapa se rechaza o la campaña se cae, la parte de la tasa que no se cobró vuelve a los donantes con su reembolso." },
];

const USOS = [
  ["Gas patrocinado", "Que donar con Nequi o confirmar con el QR no le cueste nada a nadie."],
  ["Evidencias en IPFS", "Fotos, facturas y actas públicas y permanentes."],
  ["Servidores y RPC", "Que la app esté disponible cuando llega una emergencia."],
  ["Auditorías", "Revisión externa de los contratos antes de mover dinero real."],
  ["Desarrollo y soporte", "Mantenimiento, mejoras y acompañamiento a fundaciones."],
];

const BENEFICIOS = [
  ["⭐", "Fundaciones destacadas", "Aparecen en «Conoce a las fundaciones», con la etiqueta Aliado de sostenibilidad."],
  ["🪪", "Perfil ampliado", "Logo, historia, galería de entregas pasadas y redes."],
  ["🛡", "Sello de transparencia", "Su índice de confianza en vivo, para su web y sus redes."],
  ["📄", "Reportes automáticos", "Rendición de cuentas en PDF para su junta, donantes y entes de control."],
  ["🤝", "Conexión con empresas", "Prioridad para conocer empresas aliadas que buscan dónde donar."],
  ["🧾", "Certificados de donación", "Generados automáticamente para sus donantes."],
];

const REGLAS = [
  ["La plata no compra confianza", "Solo pueden ser destacadas las fundaciones con índice de 80 % o más."],
  ["Las emergencias no se ordenan por pago", "Siempre por urgencia y por lo que les falta para la meta."],
  ["Siempre se ve", "La etiqueta «Aliado de sostenibilidad» está visible en todo momento."],
];

/** Cómo se sostiene Rastro Solidario: tasa de éxito por reputación, fondo transparente y aliados. */
export function VistaSostenibilidad() {
  const { fundaciones } = useActores();
  const rep = useReputacion(fundaciones.map((f) => f.cuenta));

  return (
    <div className="space-y-6">
      {/* Portada */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-marca-700 via-marca-800 to-marca-950 px-5 py-7 text-white shadow-suave sm:px-8 sm:py-9">
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 text-white/[0.06]">
          <circle cx="100" cy="100" r="98" fill="currentColor" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="14" />
        </svg>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-white/20">
            Modelo de sostenibilidad · próxima versión del contrato
          </span>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Solo cobramos si la ayuda llega</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-marca-50/85">
            Rastro Solidario se sostiene con una <strong className="text-white">tasa de éxito</strong> pequeña, escrita en el contrato y visible para todos. La plataforma gana
            únicamente cuando verificadores y familias confirman que la ayuda se entregó, igual que el proveedor. Y una fundación con mejor reputación paga menos.
          </p>
        </div>
      </section>

      {/* Cómo funciona */}
      <Seccion titulo="Cómo funciona la tasa de éxito" descripcion="Las mismas reglas de transparencia que aplicamos a las fundaciones, aplicadas a nosotros.">
        <ol className="grid gap-3 md:grid-cols-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marca-700 text-sm font-bold text-white">{p.icono}</span>
                <span className="rotulo">Paso {i + 1}</span>
              </div>
              <p className="mt-3 font-display font-bold text-neutro-900">{p.titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-neutro-600">{p.texto}</p>
            </li>
          ))}
        </ol>
        <p className="nota-exito mt-4">
          Ejemplo: de una donación de <strong>$20.000</strong> a una fundación con índice de 90 % o más, <strong>$19.800</strong> van a la emergencia y <strong>$200</strong> sostienen
          la plataforma, y esos $200 solo se cobran a medida que se entregan las ayudas.
        </p>
      </Seccion>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasa por reputación */}
        <Seccion titulo="Mejor reputación, menor tasa" descripcion="La tasa queda fija para cada campaña desde que se crea: nadie la puede cambiar a mitad de camino.">
          <ul className="space-y-2">
            {TRAMOS.map((t) => (
              <li key={t.texto} className="flex items-center justify-between gap-3 rounded-xl bg-neutro-50 px-4 py-3 ring-1 ring-inset ring-neutro-200/60">
                <span className="text-sm text-neutro-700">Índice de confianza: {t.texto}</span>
                <strong className="font-display text-lg text-marca-800">{textoTasa(t.bps)}</strong>
              </li>
            ))}
          </ul>

          {fundaciones.length > 0 && (
            <div className="mt-5">
              <p className="rotulo">Así quedaría hoy, según la reputación on-chain</p>
              <ul className="mt-2 divide-y divide-neutro-100">
                {fundaciones.map((f) => {
                  const r = rep(f.cuenta);
                  return (
                    <li key={f.cuenta} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Direccion valor={f.cuenta} nombre={f.nombre} />
                      <span className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tonoIndice(r?.indice ?? null)}`}>
                          {r?.indice == null ? "sin historial" : `confianza ${Math.round(r.indice)} %`}
                        </span>
                        <strong className="font-display text-neutro-900">{textoTasa(tasaBps(r))}</strong>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Seccion>

        {/* Fondo de Sostenibilidad */}
        <Seccion titulo="Fondo de Sostenibilidad" descripcion="Un contrato tesorería público: cualquiera ve cuánto entra, de qué campañas y en qué se gasta, con sus facturas.">
          <ul className="space-y-2.5">
            {USOS.map(([t, d]) => (
              <li key={t} className="flex gap-3 text-sm">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marca-500" />
                <span>
                  <strong className="text-neutro-900">{t}.</strong> <span className="text-neutro-600">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="nota-info mt-4">
            <strong>Lo que sobre vuelve a las emergencias:</strong> todo excedente por encima de los costos va al Fondo de Respuesta Rápida, que se activa apenas se declara una
            emergencia.
          </p>
        </Seccion>
      </div>

      {/* Aliados */}
      <Seccion
        titulo="Aliados de Sostenibilidad"
        descripcion="Las fundaciones que aportan un poco más (cuota mensual o un 0,5 % voluntario adicional) reciben visibilidad y herramientas."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(([i, t, d]) => (
            <div key={t} className="flex gap-3 rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-inset ring-neutro-200">
                {i}
              </span>
              <div>
                <p className="font-display font-bold text-neutro-900">{t}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutro-600">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-alerta-50/60 p-4 ring-1 ring-inset ring-alerta-200/70">
          <p className="rotulo text-alerta-800">Tres reglas para que la visibilidad no dañe la confianza</p>
          <ol className="mt-2.5 grid gap-3 md:grid-cols-3">
            {REGLAS.map(([t, d], i) => (
              <li key={t} className="text-sm">
                <p className="font-semibold text-neutro-900">
                  {i + 1}. {t}
                </p>
                <p className="mt-0.5 text-neutro-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Seccion>

      {/* Otras fuentes */}
      <Seccion titulo="Otras fuentes que complementan">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["⛽", "Empresas que patrocinan el gas", "«Las donaciones de hoy no tienen costo gracias a…»: visibilidad positiva y un costo real cubierto."],
            ["💚", "Aporte voluntario del donante", "Una casilla opcional para sumar $500 al Fondo de Sostenibilidad."],
            ["🏛", "Licencias para entidades públicas", "Alcaldías y gobernaciones desembolsan fondos de emergencia con trazabilidad."],
          ].map(([i, t, d]) => (
            <div key={t} className="rounded-xl bg-neutro-50 p-4 ring-1 ring-inset ring-neutro-200/60">
              <p className="text-xl" aria-hidden>
                {i}
              </p>
              <p className="mt-2 font-display font-bold text-neutro-900">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-neutro-600">{d}</p>
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}
