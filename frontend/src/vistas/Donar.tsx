import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEther, parseSignature, type Address } from "viem";
import { useAccount, usePublicClient, useSignTypedData, useSwitchChain } from "wagmi";
import { campanaEmergenciaAbi, mockCOPAbi } from "../abis";
import { CHAIN_ID, DIRECCIONES, ES_MONAD } from "../config";
import { Etapas, ResumenCampana } from "../componentes/Campana";
import { Seccion, Vacio } from "../componentes/Comunes";
import { ConstanciaDonacion } from "../componentes/Constancia";
import { RespaldoPalabras } from "../componentes/Recuperacion";
import { ErrorReenvio, useBilleteraInvisible, donarSinCripto, type PagoPrevio, type PasoDonacion } from "../lib/billeteraInvisible";
import { useCampana, useEmpresasAliadas, useNombres, useNombresPublicos, useSaldoCop } from "../lib/datos";
import { mensajeError } from "../lib/errores";
import { corta, fecha, pesos } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";
import { navegar } from "../lib/ruta";
import { useEscribir } from "../lib/useEscribir";

const ATAJOS = [5_000, 10_000, 50_000, 100_000, 200_000];

export function VistaDonar({ campana }: { campana?: Address }) {
  if (!campana) {
    return <Vacio>Aún no hay campañas. Crea una desde el Panel (como fundación) o ejecuta el script de simulación.</Vacio>;
  }
  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-[1fr_400px] lg:pb-0">
      <div className="space-y-6">
        <ResumenCampana direccion={campana} />
        <Seccion
          titulo="Etapas del gasto"
          descripcion="El dinero solo sale del contrato cuando los verificadores y las familias confirman cada entrega, y va directo al proveedor."
          accion={
            <a className="btn-secundario px-3 py-1.5 text-xs" href={`#/campana/${campana}`}>
              Página pública →
            </a>
          }
        >
          <Etapas direccion={campana} detallada={false} />
        </Seccion>
      </div>
      <div className="space-y-6">
        <div id="caja-donar" className="scroll-mt-32">
          <CajaDonar campana={campana} />
        </div>
        <DonacionesRecientes campana={campana} />
        <PorQueMonad />
      </div>
      <BotonDonarMovil campana={campana} />
    </div>
  );
}

/** En el celular la caja de donar queda debajo de las etapas: este botón fijo lleva hasta ella. */
function BotonDonarMovil({ campana }: { campana: Address }) {
  const { info } = useCampana(campana);
  const [cajaVisible, setCajaVisible] = useState(false);
  useEffect(() => {
    const caja = document.getElementById("caja-donar");
    if (!caja || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setCajaVisible(e.isIntersecting), { rootMargin: "0px 0px -30% 0px" });
    obs.observe(caja);
    return () => obs.disconnect();
  }, []);
  if (info?.estado !== 0 || cajaVisible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutro-200/70 bg-white/90 p-3 backdrop-blur-md lg:hidden print:hidden">
      <button
        className="btn-primario w-full rounded-2xl py-3.5 text-base"
        onClick={() => document.getElementById("caja-donar")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        Donar ahora <span aria-hidden>↓</span>
      </button>
    </div>
  );
}

function CajaDonar({ campana }: { campana: Address }) {
  const { info } = useCampana(campana);
  const [modo, setModo] = useState<"facil" | "wallet">("facil");
  const [monto, setMonto] = useState("20000");
  const pesosNum = Number(monto.replace(/\D/g, "")) || 0;
  const wei = parseEther(String(pesosNum));
  const restante = info ? info.meta - info.totalRecaudado : 0n;
  const abierta = info?.estado === 0;

  return (
    <Seccion titulo="Donar" descripcion="Tu donación queda en el contrato, no en la cuenta de la fundación.">
      {!abierta ? (
        <Vacio>{info ? "Esta campaña ya no recibe donaciones. Puedes seguir cómo se gasta en la página pública." : "Cargando…"}</Vacio>
      ) : (
        <div className="space-y-4">
          <div className="segmentado grid-cols-2" role="tablist" aria-label="Forma de pago">
            <button role="tab" aria-selected={modo === "facil"} className={modo === "facil" ? "segmento-activo" : "segmento"} onClick={() => setModo("facil")}>
              Nequi o PSE
            </button>
            <button role="tab" aria-selected={modo === "wallet"} className={modo === "wallet" ? "segmento-activo" : "segmento"} onClick={() => setModo("wallet")}>
              Wallet cripto
            </button>
          </div>

          <div>
            <label className="etiqueta" htmlFor="monto">
              ¿Cuánto quieres donar?
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl font-bold text-neutro-400">$</span>
              <input
                id="monto"
                className="campo py-3.5 pl-9 font-display text-2xl font-bold tabular"
                inputMode="numeric"
                value={pesosNum ? pesosNum.toLocaleString("es-CO") : ""}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="20.000"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutro-400">COP</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ATAJOS.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={pesosNum === a ? "chip border-marca-600 bg-marca-600 text-white hover:border-marca-700 hover:bg-marca-700 hover:text-white" : "chip"}
                  onClick={() => setMonto(String(a))}
                >
                  ${a.toLocaleString("es-CO")}
                </button>
              ))}
            </div>
          </div>

          {wei > restante && restante > 0n && <p className="nota-alerta text-xs">Faltan {pesos(restante)} para la meta: solo se cobrará esa cantidad.</p>}

          {modo === "facil" ? <DonarFacil campana={campana} montoPesos={pesosNum} /> : <DonarConWallet campana={campana} wei={wei} restante={restante} pesosNum={pesosNum} />}
        </div>
      )}
    </Seccion>
  );
}

// ─────────────────────────── Sin cripto (Nequi / PSE simulado) ───────────────────────────

/** Mensaje corto para la persona: los errores de red del RPC traen URL y cuerpo de la petición. */
function mensajeDonacion(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || String(e);
  if (/took too long|timed out|timeout|HTTP request failed|Failed to fetch|fetch failed|limited to/i.test(m)) {
    return "La red de Monad está respondiendo lento. Espera unos segundos e inténtalo de nuevo.";
  }
  return m.split("\n")[0];
}

const PASOS: { id: PasoDonacion["paso"]; texto: string }[] = [
  { id: "pago", texto: "Pago aprobado" },
  { id: "acreditado", texto: "Pesos convertidos a MockCOP" },
  { id: "firmado", texto: "Tu donación firmada (sin costo)" },
  { id: "registrado", texto: "Registrada en la blockchain · gas pagado por Rastro Solidario" },
];

function DonarFacil({ campana, montoPesos }: { campana: Address; montoPesos: number }) {
  const qc = useQueryClient();
  const avisar = useAvisar();
  const { direccion } = useBilleteraInvisible();
  const [metodo, setMetodo] = useState<"nequi" | "pse">("nequi");
  const [celular, setCelular] = useState("");
  const [banco, setBanco] = useState("Bancolombia");
  const [fase, setFase] = useState<"formulario" | "pasarela" | "procesando" | "error" | "listo">("formulario");
  const [error, setError] = useState("");
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ referencia: string; hash?: string; cuenta: Address } | null>(null);
  // Pago ya acreditado en un intento que falló después: "Intentar de nuevo" no vuelve a cobrar.
  const pagoPrevio = useRef<PagoPrevio | undefined>(undefined);
  useEffect(() => {
    setFase("formulario");
    setResultado(null);
    pagoPrevio.current = undefined;
  }, [campana]);

  const valido = montoPesos >= 1000 && montoPesos <= 5_000_000 && (metodo === "pse" || /^3\d{9}$/.test(celular.replace(/\D/g, "")));

  async function pagar() {
    setFase("procesando");
    setHechos(new Set());
    try {
      const r = await donarSinCripto(campana, montoPesos, metodo, (p) => setHechos((h) => new Set([...h, p.paso])), pagoPrevio.current);
      pagoPrevio.current = undefined;
      setResultado({ referencia: r.referencia, hash: r.hash, cuenta: r.cuenta });
      setFase("listo");
      await qc.invalidateQueries();
    } catch (e) {
      if (e instanceof ErrorReenvio && e.pagoPrevio) pagoPrevio.current = e.pagoPrevio;
      setError(mensajeDonacion(e) + (pagoPrevio.current ? " Tu pago ya quedó acreditado: al reintentar no se te cobra de nuevo." : ""));
      setFase("error");
    }
  }

  if (fase === "listo" && resultado) {
    const enlace = `${window.location.origin}/#/rastreo/${campana}/${resultado.cuenta}`;
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl bg-exito-50 p-5 ring-1 ring-inset ring-exito-200">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-exito-600 text-xl font-bold text-white shadow-sm" aria-hidden>
            ✓
          </span>
          <p className="font-display text-xl font-extrabold text-exito-900">¡Gracias! Donaste ${montoPesos.toLocaleString("es-CO")} 💚</p>
          <p className="text-sm text-exito-800">
            Referencia del pago: <strong>{resultado.referencia}</strong>. Tu donación ya está en el contrato y nadie la puede mover sin verificación.
          </p>
          <button className="btn-primario w-full" onClick={() => navegar(`/rastreo/${campana}/${resultado.cuenta}`)}>
            Ver a dónde va mi dinero →
          </button>
          <button className="btn-secundario w-full text-xs" onClick={() => navigator.clipboard?.writeText(enlace).then(() => avisar("exito", "Enlace copiado", "Guárdalo para seguir tu donación desde cualquier lugar."))}>
            Copiar mi enlace de rastreo
          </button>
          <p className="text-[11px] text-exito-700">
            Te avisaremos aquí (🔔) cuando se use tu plata. Tu "billetera invisible" ({corta(resultado.cuenta)}) quedó guardada en este navegador.
          </p>
          <RespaldoPalabras />
        </div>
        <ConstanciaDonacion campana={campana} donante={resultado.cuenta} />
      </div>
    );
  }

  if (fase === "pasarela" || fase === "procesando" || fase === "error") {
    return (
      <div className="overflow-hidden rounded-xl border border-neutro-200">
        <div className={`px-4 py-3 text-white ${metodo === "nequi" ? "bg-[#200020]" : "bg-[#0b3b8c]"}`}>
          <p className="text-xs uppercase tracking-wide opacity-80">Pasarela de pagos · simulación</p>
          <p className="text-lg font-bold">{metodo === "nequi" ? "Nequi" : `PSE · ${banco}`}</p>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-neutro-600">
            Pagar <strong className="text-neutro-900">${montoPesos.toLocaleString("es-CO")}</strong> a Rastro Solidario
            {metodo === "nequi" ? ` desde el celular ${celular}` : ""}.
          </p>
          {fase === "error" ? (
            <>
              <p className="rounded-lg bg-peligro-50 p-3 text-sm text-peligro-800">
                <strong>No se pudo completar la donación.</strong> {error}
              </p>
              <div className="flex gap-2">
                <button className="btn-primario flex-1" onClick={pagar}>
                  Intentar de nuevo
                </button>
                <button className="btn-secundario" onClick={() => setFase("formulario")}>
                  Volver
                </button>
              </div>
            </>
          ) : fase === "pasarela" ? (
            <>
              <p className="rounded-lg bg-neutro-50 p-3 text-xs text-neutro-500">
                {metodo === "nequi" ? "En la vida real te llegaría una notificación a la app de Nequi para aceptar el pago." : "En la vida real te llevaría al portal de tu banco."} En esta
                demo no se mueve dinero real.
              </p>
              <div className="flex gap-2">
                <button className="btn-primario flex-1" onClick={pagar}>
                  Aprobar pago
                </button>
                <button className="btn-secundario" onClick={() => setFase("formulario")}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <ol className="space-y-2">
              {PASOS.map((p) => {
                const hecho = hechos.has(p.id);
                const enCurso = !hecho && PASOS.findIndex((x) => !hechos.has(x.id)) === PASOS.indexOf(p);
                return (
                  <li key={p.id} className={`flex items-center gap-2 text-sm ${hecho ? "text-exito-800" : enCurso ? "text-neutro-900" : "text-neutro-400"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${hecho ? "bg-exito-600 text-white" : enCurso ? "animate-pulse bg-alerta-400" : "bg-neutro-200"}`}>
                      {hecho ? "✓" : ""}
                    </span>
                    {p.texto}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) setFase("pasarela");
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        {(["nequi", "pse"] as const).map((m) => (
          <label
            key={m}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm font-semibold transition ${metodo === m ? "border-marca-500 bg-marca-50 text-marca-900 ring-2 ring-marca-500/15" : "border-neutro-200 bg-white text-neutro-700 hover:border-neutro-300"}`}
          >
            <input type="radio" name="metodo" className="accent-marca-700" checked={metodo === m} onChange={() => setMetodo(m)} />
            {m === "nequi" ? "Nequi" : "PSE (banco)"}
          </label>
        ))}
      </div>
      {metodo === "nequi" ? (
        <label className="block">
          <span className="etiqueta">Celular Nequi</span>
          <input className="campo" inputMode="tel" placeholder="300 123 4567" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </label>
      ) : (
        <label className="block">
          <span className="etiqueta">Banco</span>
          <select className="campo" value={banco} onChange={(e) => setBanco(e.target.value)}>
            {["Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco Popular", "Nu Colombia"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      )}
      <button className="btn-primario w-full rounded-2xl py-3.5 text-base" disabled={!valido}>
        Donar {montoPesos ? `$${montoPesos.toLocaleString("es-CO")}` : ""}
        <span aria-hidden>→</span>
      </button>
      <p className="flex gap-2 rounded-xl bg-neutro-50 p-3 text-[11px] leading-relaxed text-neutro-500">
        <span aria-hidden className="text-sm leading-4">🔒</span>
        <span>
        Sin MetaMask, sin cripto y sin comisiones de red: una billetera invisible se crea en tu navegador y Rastro Solidario paga el gas.
        {direccion && <> Ya tienes una: {corta(direccion)}.</>} Pasarela simulada para la demo: no se cobra dinero real.
        </span>
      </p>
    </form>
  );
}

// ─────────────────────────── Con wallet (MetaMask) ───────────────────────────

export function DonarConWallet({ campana, wei, restante, pesosNum }: { campana: Address; wei: bigint; restante: bigint; pesosNum: number }) {
  const { address, chainId } = useAccount();
  const saldo = useSaldoCop();
  const cliente = usePublicClient({ chainId: CHAIN_ID });
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const { ejecutar, pendiente } = useEscribir();
  const avisar = useAvisar();
  const [usarApprove, setUsarApprove] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(false), [campana]);
  const ocupado = firmando || !!pendiente;

  async function donarConPermit() {
    if (!address || !cliente) return;
    setFirmando(true);
    try {
      if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
      const nonce = await cliente.readContract({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "nonces", args: [address] });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
      // Firma gratis (fuera de la cadena): autoriza a la campaña a tomar exactamente este monto.
      const firma = await signTypedDataAsync({
        domain: { name: "MockCOP", version: "1", chainId: CHAIN_ID, verifyingContract: DIRECCIONES.cop },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        message: { owner: address, spender: campana, value: wei, nonce, deadline },
      });
      const { r, s, v, yParity } = parseSignature(firma);
      setFirmando(false);
      const ok = await ejecutar({
        address: campana,
        abi: campanaEmergenciaAbi,
        functionName: "donarConPermit",
        args: [wei, deadline, v !== undefined ? Number(v) : yParity + 27, r, s],
        etiqueta: "Donar",
        exito: `¡Gracias! Donaste ${pesos(wei > restante ? restante : wei)} MockCOP`,
      });
      if (ok) setListo(true);
    } catch (e) {
      avisar("error", "No se pudo firmar el permiso", `${mensajeError(e)} — puedes intentar con "approve".`);
    } finally {
      setFirmando(false);
    }
  }

  async function donarConApprove() {
    if (!address || !cliente) return;
    const permitido = await cliente.readContract({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "allowance", args: [address, campana] });
    if (permitido < wei) {
      const ok = await ejecutar({ address: DIRECCIONES.cop, abi: mockCOPAbi, functionName: "approve", args: [campana, wei], etiqueta: "Autorizar MockCOP", exito: "Autorización lista" });
      if (!ok) return;
    }
    const ok = await ejecutar({ address: campana, abi: campanaEmergenciaAbi, functionName: "donar", args: [wei], etiqueta: "Donar", exito: "¡Gracias por tu donación!" });
    if (ok) setListo(true);
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (usarApprove) donarConApprove();
          else donarConPermit();
        }}
        className="space-y-3"
      >
        {address && saldo !== undefined && saldo < wei && (
          <p className="rounded-lg bg-peligro-50 p-2 text-xs text-peligro-800">Tu saldo ({pesos(saldo)}) no alcanza. Pide MockCOP en el faucet de arriba.</p>
        )}
        <button className="btn-primario w-full py-3 text-base" disabled={!address || ocupado || pesosNum <= 0}>
          {!address ? "Conecta tu wallet para donar" : firmando ? "Firma el permiso en MetaMask…" : pendiente ? `${pendiente}…` : `Donar ${pesosNum.toLocaleString("es-CO")} MockCOP`}
        </button>
        <label className="flex items-start gap-2 text-xs text-neutro-500">
          <input type="checkbox" checked={usarApprove} onChange={(e) => setUsarApprove(e.target.checked)} className="mt-0.5" />
          <span>
            Usar <em>approve</em> + donar (2 transacciones). Por defecto se usa una firma gratuita (permit) y <strong>una sola transacción</strong>.
          </span>
        </label>
        {listo && address && (
          <button type="button" className="btn-secundario w-full" onClick={() => navegar(`/rastreo/${campana}/${address}`)}>
            Ver a dónde va mi dinero →
          </button>
        )}
      </form>
      {listo && address && <ConstanciaDonacion campana={campana} donante={address} />}
    </>
  );
}

function DonacionesRecientes({ campana }: { campana: Address }) {
  const { recientes } = useCampana(campana);
  const { esEmpresa } = useEmpresasAliadas(campana);
  const nombre = useNombres(recientes.filter((d) => esEmpresa(d.donante)).map((d) => d.donante));
  // Cada donante eligió si aparece con su nombre; si no, es anónimo
  const nombrePublico = useNombresPublicos(campana, recientes.map((d) => d.donante));
  return (
    <Seccion titulo="Últimas donaciones" descripcion="Leídas directamente del contrato.">
      {recientes.length === 0 ? (
        <Vacio>Sé la primera persona en donar.</Vacio>
      ) : (
        <ul className="divide-y divide-neutro-100">
          {recientes.map((d, i) => {
            const empresa = esEmpresa(d.donante);
            return (
              <li key={`${d.donante}-${d.bloque}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${empresa ? "bg-alerta-100 ring-1 ring-inset ring-alerta-200" : "bg-marca-50 text-marca-700 ring-1 ring-inset ring-marca-100"}`}
                >
                  {empresa ? "🏢" : "♥"}
                </span>
                <span className="min-w-0 flex-1">
                  {empresa ? (
                    <a className="block truncate text-xs font-semibold text-alerta-800 hover:underline" href={`#/rastreo/${campana}/${d.donante}`}>
                      {nombre(d.donante) ?? "Empresa aliada"}
                    </a>
                  ) : nombrePublico(d.donante) ? (
                    <a className="block truncate text-xs font-semibold text-neutro-800 hover:text-marca-700 hover:underline" href={`#/rastreo/${campana}/${d.donante}`}>
                      {nombrePublico(d.donante)}
                    </a>
                  ) : (
                    <a className="block truncate text-xs text-neutro-600 hover:text-marca-700 hover:underline" href={`#/rastreo/${campana}/${d.donante}`}>
                      Anónimo <span className="font-mono text-neutro-400">· {corta(d.donante)}</span>
                    </a>
                  )}
                  <span className="block text-[11px] text-neutro-400">{empresa ? "Empresa aliada · " : ""}{fecha(d.fecha)}</span>
                </span>
                <strong className="font-display text-neutro-900">${pesos(d.monto)}</strong>
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}

interface ReporteSim {
  red: string;
  chainId: number;
  fecha: string;
  escenarios: {
    completo?: {
      donantes: number;
      donaciones: {
        paralelo: { cantidad: number; ventanaMs: number; tps: number; latenciaMs: { p50: number; p95: number }; bloquesUsados: number; maxDonacionesEnUnBloque: number };
        costoPromedio: string;
        gasLimitPromedio: number;
      };
    };
  };
}

function PorQueMonad() {
  const [sim, setSim] = useState<ReporteSim | null>(null);
  useEffect(() => {
    fetch("/simulacion.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSim(j?.chainId === CHAIN_ID ? j : null))
      .catch(() => setSim(null));
  }, []);
  const c = sim?.escenarios?.completo?.donaciones;

  return (
    <Seccion titulo="¿Por qué Monad?">
      <ul className="space-y-3 text-sm leading-relaxed text-neutro-600 [&>li]:border-l-2 [&>li]:border-marca-200 [&>li]:pl-3">
        <li>
          <strong className="text-neutro-800">Comisiones casi nulas.</strong> En una emergencia la gente dona 5.000 o 10.000 pesos; en una cadena cara el gas se comería la donación, y
          aquí además lo paga un patrocinador.
        </li>
        <li>
          <strong className="text-neutro-800">Rendimiento.</strong> En las primeras horas llegan miles de donaciones a la vez; bloques de ~400 ms y ejecución en paralelo.
        </li>
        <li>
          <strong className="text-neutro-800">Contratos de hasta 128 KB.</strong> Toda la lógica anticorrupción (censo, sobrecosto, reembolsos, reputación) vive en la cadena, no en un
          servidor.
        </li>
      </ul>
      {c && (
        <div className="mt-4 rounded-xl bg-marca-50 p-4 ring-1 ring-inset ring-marca-100">
          <p className="rotulo text-marca-800">
            Medición del script de simulación · {sim!.red}
            {sim!.chainId === 31337 && " (nodo local, no es Monad)"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-marca-700">Donaciones en paralelo</dt>
              <dd className="text-xl font-bold text-marca-900">{c.paralelo.cantidad}</dd>
            </div>
            <div>
              <dt className="text-marca-700">Confirmadas en</dt>
              <dd className="text-xl font-bold text-marca-900">{(c.paralelo.ventanaMs / 1000).toFixed(2)} s</dd>
            </div>
            <div>
              <dt className="text-marca-700">Latencia p50 / p95</dt>
              <dd className="font-bold text-marca-900">
                {c.paralelo.latenciaMs.p50} / {c.paralelo.latenciaMs.p95} ms
              </dd>
            </div>
            <div>
              <dt className="text-marca-700">Gas por donación</dt>
              <dd className="font-bold text-marca-900">
                {Number(c.costoPromedio).toFixed(5)} {ES_MONAD ? "MON" : "ETH"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-marca-700">
            {c.paralelo.bloquesUsados} bloques · hasta {c.paralelo.maxDonacionesEnUnBloque} donaciones en un mismo bloque · {new Date(sim!.fecha).toLocaleString("es-CO")}
          </p>
        </div>
      )}
    </Seccion>
  );
}
