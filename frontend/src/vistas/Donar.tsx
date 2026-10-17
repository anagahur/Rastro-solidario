import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEther, parseSignature, type Address } from "viem";
import { useAccount, usePublicClient, useSignTypedData, useSwitchChain } from "wagmi";
import { campanaEmergenciaAbi, mockCOPAbi } from "../abis";
import { CHAIN_ID, DIRECCIONES, ES_MONAD } from "../config";
import { Etapas, ResumenCampana } from "../componentes/Campana";
import { Seccion, Vacio } from "../componentes/Comunes";
import { ErrorReenvio, useBilleteraInvisible, donarSinCripto, type PagoPrevio, type PasoDonacion } from "../lib/billeteraInvisible";
import { useCampana, useNombres, useSaldoCop } from "../lib/datos";
import { mensajeError } from "../lib/errores";
import { corta, fecha, mismaDireccion, pesos } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";
import { navegar } from "../lib/ruta";
import { useEscribir } from "../lib/useEscribir";

const ATAJOS = [5_000, 10_000, 50_000, 100_000, 200_000];

export function VistaDonar({ campana }: { campana?: Address }) {
  if (!campana) {
    return <Vacio>Aún no hay campañas. Crea una desde el Panel (como fundación) o ejecuta el script de simulación.</Vacio>;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
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
        <CajaDonar campana={campana} />
        <DonacionesRecientes campana={campana} />
        <PorQueMonad />
      </div>
    </div>
  );
}

function CajaDonar({ campana }: { campana: Address }) {
  const { info, matchings } = useCampana(campana);
  const [modo, setModo] = useState<"facil" | "wallet">("facil");
  const [monto, setMonto] = useState("20000");
  const pesosNum = Number(monto.replace(/\D/g, "")) || 0;
  const wei = parseEther(String(pesosNum));
  const restante = info ? info.meta - info.totalRecaudado : 0n;
  const abierta = info?.estado === 0;

  // Cuánto suma el matching a esta donación (misma regla que el contrato, en orden).
  let extra = 0n;
  let quedan = restante - (wei > restante ? restante : wei);
  for (const m of matchings) {
    const libre = m.tope - m.usado;
    let e = (wei * BigInt(m.proporcionBps)) / 10_000n;
    if (e > libre) e = libre;
    if (e > quedan) e = quedan;
    if (e > 0n) {
      extra += e;
      quedan -= e;
    }
  }

  return (
    <Seccion titulo="Donar" descripcion="Tu donación queda en el contrato, no en la cuenta de la fundación.">
      {!abierta ? (
        <Vacio>{info ? "Esta campaña ya no recibe donaciones. Puedes seguir cómo se gasta en la página pública." : "Cargando…"}</Vacio>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
            <button className={`rounded-lg px-3 py-2 ${modo === "facil" ? "bg-white text-teal-800 shadow-sm" : "text-stone-500"}`} onClick={() => setModo("facil")}>
              Nequi o PSE
            </button>
            <button className={`rounded-lg px-3 py-2 ${modo === "wallet" ? "bg-white text-teal-800 shadow-sm" : "text-stone-500"}`} onClick={() => setModo("wallet")}>
              Wallet cripto
            </button>
          </div>

          <div>
            <label className="etiqueta" htmlFor="monto">
              ¿Cuánto quieres donar? (pesos)
            </label>
            <input
              id="monto"
              className="campo text-lg font-semibold"
              inputMode="numeric"
              value={pesosNum ? pesosNum.toLocaleString("es-CO") : ""}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="20.000"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {ATAJOS.map((a) => (
                <button type="button" key={a} className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium hover:bg-stone-100" onClick={() => setMonto(String(a))}>
                  {a.toLocaleString("es-CO")}
                </button>
              ))}
            </div>
          </div>

          {extra > 0n && (
            <p className="rounded-xl bg-gradient-to-r from-amber-100 to-orange-50 p-3 text-sm text-amber-950">
              🎁 Con el matching de las empresas aliadas, tus {pesos(wei)} se convierten en <strong>{pesos(wei + extra)}</strong> para la emergencia.
            </p>
          )}
          {wei > restante && restante > 0n && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Faltan {pesos(restante)} para la meta: solo se cobrará esa cantidad.</p>
          )}

          {modo === "facil" ? <DonarFacil campana={campana} montoPesos={pesosNum} extra={extra} /> : <DonarConWallet campana={campana} wei={wei} restante={restante} pesosNum={pesosNum} />}
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

function DonarFacil({ campana, montoPesos, extra }: { campana: Address; montoPesos: number; extra: bigint }) {
  const qc = useQueryClient();
  const avisar = useAvisar();
  const { direccion } = useBilleteraInvisible();
  const [metodo, setMetodo] = useState<"nequi" | "pse">("nequi");
  const [celular, setCelular] = useState("");
  const [banco, setBanco] = useState("Bancolombia");
  const [fase, setFase] = useState<"formulario" | "pasarela" | "procesando" | "error" | "listo">("formulario");
  const [error, setError] = useState("");
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ referencia: string; hash?: string; cuenta: Address; extra: bigint } | null>(null);
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
    const extraAlPagar = extra;
    try {
      const r = await donarSinCripto(campana, montoPesos, metodo, (p) => setHechos((h) => new Set([...h, p.paso])), pagoPrevio.current);
      pagoPrevio.current = undefined;
      setResultado({ referencia: r.referencia, hash: r.hash, cuenta: r.cuenta, extra: extraAlPagar });
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
      <div className="space-y-3 rounded-xl bg-emerald-50 p-4">
        <p className="text-lg font-bold text-emerald-900">¡Gracias! Donaste {montoPesos.toLocaleString("es-CO")} pesos 💚</p>
        {resultado.extra > 0n && <p className="text-sm text-emerald-800">La empresa aliada sumó {pesos(resultado.extra)} más gracias a ti.</p>}
        <p className="text-sm text-emerald-800">
          Referencia del pago: <strong>{resultado.referencia}</strong>. Tu donación ya está en el contrato y nadie la puede mover sin verificación.
        </p>
        <button className="btn-primario w-full" onClick={() => navegar(`/rastreo/${campana}/${resultado.cuenta}`)}>
          Ver a dónde va mi dinero →
        </button>
        <button className="btn-secundario w-full text-xs" onClick={() => navigator.clipboard?.writeText(enlace).then(() => avisar("exito", "Enlace copiado", "Guárdalo para seguir tu donación desde cualquier lugar."))}>
          Copiar mi enlace de rastreo
        </button>
        <p className="text-[11px] text-emerald-700">
          Te avisaremos aquí (🔔) cuando se use tu plata. Tu "billetera invisible" ({corta(resultado.cuenta)}) quedó guardada en este navegador.
        </p>
      </div>
    );
  }

  if (fase === "pasarela" || fase === "procesando" || fase === "error") {
    return (
      <div className="overflow-hidden rounded-xl border border-stone-200">
        <div className={`px-4 py-3 text-white ${metodo === "nequi" ? "bg-[#200020]" : "bg-[#0b3b8c]"}`}>
          <p className="text-xs uppercase tracking-wide opacity-80">Pasarela de pagos · simulación</p>
          <p className="text-lg font-bold">{metodo === "nequi" ? "Nequi" : `PSE · ${banco}`}</p>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-stone-600">
            Pagar <strong className="text-stone-900">${montoPesos.toLocaleString("es-CO")}</strong> a Rastro Solidario
            {metodo === "nequi" ? ` desde el celular ${celular}` : ""}.
          </p>
          {fase === "error" ? (
            <>
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
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
              <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">
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
                  <li key={p.id} className={`flex items-center gap-2 text-sm ${hecho ? "text-emerald-800" : enCurso ? "text-stone-900" : "text-stone-400"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${hecho ? "bg-emerald-600 text-white" : enCurso ? "animate-pulse bg-amber-400" : "bg-stone-200"}`}>
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
          <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${metodo === m ? "border-teal-600 bg-teal-50" : "border-stone-200"}`}>
            <input type="radio" name="metodo" checked={metodo === m} onChange={() => setMetodo(m)} />
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
      <button className="btn-primario w-full py-3 text-base" disabled={!valido}>
        Donar {montoPesos ? `$${montoPesos.toLocaleString("es-CO")}` : ""}
      </button>
      <p className="text-[11px] leading-relaxed text-stone-500">
        Sin MetaMask, sin cripto y sin comisiones de red: una billetera invisible se crea en tu navegador y Rastro Solidario paga el gas.
        {direccion && <> Ya tienes una: {corta(direccion)}.</>} Pasarela simulada para la demo: no se cobra dinero real.
      </p>
    </form>
  );
}

// ─────────────────────────── Con wallet (MetaMask) ───────────────────────────

function DonarConWallet({ campana, wei, restante, pesosNum }: { campana: Address; wei: bigint; restante: bigint; pesosNum: number }) {
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (usarApprove) donarConApprove();
        else donarConPermit();
      }}
      className="space-y-3"
    >
      {address && saldo !== undefined && saldo < wei && (
        <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">Tu saldo ({pesos(saldo)}) no alcanza. Pide MockCOP en el faucet de arriba.</p>
      )}
      <button className="btn-primario w-full py-3 text-base" disabled={!address || ocupado || pesosNum <= 0}>
        {!address ? "Conecta tu wallet para donar" : firmando ? "Firma el permiso en MetaMask…" : pendiente ? `${pendiente}…` : `Donar ${pesosNum.toLocaleString("es-CO")} MockCOP`}
      </button>
      <label className="flex items-start gap-2 text-xs text-stone-500">
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
  );
}

function DonacionesRecientes({ campana }: { campana: Address }) {
  const { recientes, matchings } = useCampana(campana);
  const nombre = useNombres(matchings.map((m) => m.empresa));
  return (
    <Seccion titulo="Últimas donaciones" descripcion="Leídas directamente del contrato.">
      {recientes.length === 0 ? (
        <Vacio>Sé la primera persona en donar.</Vacio>
      ) : (
        <ul className="divide-y divide-stone-100">
          {recientes.map((d, i) => {
            const empresa = matchings.some((m) => mismaDireccion(m.empresa, d.donante));
            return (
              <li key={`${d.donante}-${d.bloque}-${i}`} className="flex items-center justify-between py-2 text-sm">
                {empresa ? (
                  <span className="text-xs font-semibold text-amber-800">🎁 {nombre(d.donante) ?? "Empresa aliada"} (matching)</span>
                ) : (
                  <a className="font-mono text-xs text-stone-500 hover:underline" href={`#/rastreo/${campana}/${d.donante}`}>
                    {corta(d.donante)}
                  </a>
                )}
                <span className="text-right">
                  <strong className="text-stone-900">{pesos(d.monto)}</strong>
                  <span className="block text-[11px] text-stone-400">{fecha(d.fecha)}</span>
                </span>
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
      <ul className="space-y-2 text-sm text-stone-600">
        <li>
          <strong className="text-stone-800">Comisiones casi nulas.</strong> En una emergencia la gente dona 5.000 o 10.000 pesos; en una cadena cara el gas se comería la donación, y
          aquí además lo paga un patrocinador.
        </li>
        <li>
          <strong className="text-stone-800">Rendimiento.</strong> En las primeras horas llegan miles de donaciones a la vez; bloques de ~400 ms y ejecución en paralelo.
        </li>
        <li>
          <strong className="text-stone-800">Contratos de hasta 128 KB.</strong> Toda la lógica anticorrupción (censo, sobrecosto, matching, reputación) vive en la cadena, no en un
          servidor.
        </li>
      </ul>
      {c && (
        <div className="mt-4 rounded-xl bg-teal-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Medición del script de simulación · {sim!.red}
            {sim!.chainId === 31337 && " (nodo local, no es Monad)"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-teal-700">Donaciones en paralelo</dt>
              <dd className="text-xl font-bold text-teal-900">{c.paralelo.cantidad}</dd>
            </div>
            <div>
              <dt className="text-teal-700">Confirmadas en</dt>
              <dd className="text-xl font-bold text-teal-900">{(c.paralelo.ventanaMs / 1000).toFixed(2)} s</dd>
            </div>
            <div>
              <dt className="text-teal-700">Latencia p50 / p95</dt>
              <dd className="font-bold text-teal-900">
                {c.paralelo.latenciaMs.p50} / {c.paralelo.latenciaMs.p95} ms
              </dd>
            </div>
            <div>
              <dt className="text-teal-700">Gas por donación</dt>
              <dd className="font-bold text-teal-900">
                {Number(c.costoPromedio).toFixed(5)} {ES_MONAD ? "MON" : "ETH"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-teal-700">
            {c.paralelo.bloquesUsados} bloques · hasta {c.paralelo.maxDonacionesEnUnBloque} donaciones en un mismo bloque · {new Date(sim!.fecha).toLocaleString("es-CO")}
          </p>
        </div>
      )}
    </Seccion>
  );
}
