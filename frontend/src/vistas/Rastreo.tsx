import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { campanaEmergenciaAbi, reciboDonacionAbi } from "../abis";
import { BOT_TELEGRAM, CHAIN_ID, DIRECCIONES, REFRESCO_MS } from "../config";
import { Direccion, EnlaceTx, Insignia, Seccion, Vacio } from "../componentes/Comunes";
import { VerEvidencia } from "../componentes/Evidencia";
import { seguirCuenta, useCuentasSeguidas } from "../lib/avisos";
import { cuentaInvisible, enviarSinGas, useBilleteraInvisible } from "../lib/billeteraInvisible";
import { useCampana, useEmpresasAliadas, useNombres } from "../lib/datos";
import { corta, esDireccion, etiquetaEtapa, fecha, mismaDireccion, pesos, porcentaje } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";
import { navegar } from "../lib/ruta";
import { useEscribir } from "../lib/useEscribir";

const COLORES_ETAPA = ["bg-teal-600", "bg-emerald-500", "bg-cyan-600", "bg-lime-600", "bg-sky-600", "bg-teal-400", "bg-emerald-700", "bg-cyan-400", "bg-lime-500", "bg-sky-400"];

export function VistaRastreo({ campana, donanteRuta }: { campana?: Address; donanteRuta?: string }) {
  const { address } = useAccount();
  const { direccion: invisible } = useBilleteraInvisible();
  const seguidas = useCuentasSeguidas();
  const [entrada, setEntrada] = useState(donanteRuta ?? address ?? invisible ?? "");
  useEffect(() => {
    if (donanteRuta) setEntrada(donanteRuta);
    else if (address || invisible) setEntrada((x) => x || address || invisible || "");
  }, [donanteRuta, address, invisible]);
  const donante = esDireccion(entrada) ? (entrada as Address) : undefined;
  const sigo = !!donante && seguidas.some((s) => mismaDireccion(s, donante));

  if (!campana) return <Vacio>No hay campañas todavía.</Vacio>;

  return (
    <div className="space-y-6">
      <section className="tarjeta">
        <label className="etiqueta" htmlFor="donante">Wallet del donante</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="donante"
            className="campo font-mono"
            placeholder="0x…"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value.trim())}
          />
          {address && entrada.toLowerCase() !== address.toLowerCase() && (
            <button className="btn-secundario whitespace-nowrap" onClick={() => setEntrada(address)}>
              Usar mi wallet
            </button>
          )}
          {invisible && entrada.toLowerCase() !== invisible.toLowerCase() && (
            <button className="btn-secundario whitespace-nowrap" onClick={() => setEntrada(invisible)}>
              Mis donaciones con Nequi/PSE
            </button>
          )}
          {donante && !sigo && (
            <button className="btn-secundario whitespace-nowrap" onClick={() => seguirCuenta(donante)} title="Te avisamos (🔔) cada vez que se use dinero de esta wallet">
              🔔 Avisarme
            </button>
          )}
          {donante && BOT_TELEGRAM && (
            <a className="btn-secundario whitespace-nowrap" href={`https://t.me/${BOT_TELEGRAM}?start=${donante}`} target="_blank" rel="noreferrer">
              ✈ Telegram
            </a>
          )}
          {donante && (
            <button
              className="btn-secundario whitespace-nowrap"
              onClick={() => {
                navegar(`/rastreo/${campana}/${donante}`);
                navigator.clipboard?.writeText(window.location.href);
              }}
            >
              Copiar enlace
            </button>
          )}
        </div>
        {entrada && !donante && <p className="mt-1 text-xs text-rose-700">Escribe una dirección válida (0x + 40 caracteres).</p>}
      </section>
      {donante && <RastroDonante campana={campana} donante={donante} />}
    </div>
  );
}

function RastroDonante({ campana, donante }: { campana: Address; donante: Address }) {
  const { info, etapas } = useCampana(campana);
  const resumen = useReadContract({
    address: campana,
    abi: campanaEmergenciaAbi,
    functionName: "resumenDonante",
    args: [donante],
    query: { refetchInterval: REFRESCO_MS },
  }).data;
  const { esEmpresa: esCuentaDeEmpresa } = useEmpresasAliadas(campana);
  const nombre = useNombres([...(etapas ?? []).map((e) => e.proveedor), donante]);
  const { ejecutar, pendiente } = useEscribir();
  const { address } = useAccount();
  const { direccion: invisible } = useBilleteraInvisible();
  const qc = useQueryClient();
  const avisar = useAvisar();
  const [reclamando, setReclamando] = useState(false);

  if (!info || !etapas || !resumen) return <div className="tarjeta h-48 animate-pulse" />;
  if (resumen.aporte === 0n) return <Vacio>Esta wallet no ha donado a “{info.nombre}”.</Vacio>;

  const cerrado = info.estado !== 0;
  const partes = etapas.map((e, i) => ({ etapa: e, parte: resumen.partePorEtapa[i], i }));
  const soyYo = address?.toLowerCase() === donante.toLowerCase();
  const esInvisible = mismaDireccion(invisible, donante);
  const esEmpresa = esCuentaDeEmpresa(donante);

  async function reclamarSinGas() {
    const cuenta = cuentaInvisible();
    if (!cuenta) return;
    setReclamando(true);
    try {
      await enviarSinGas(cuenta, campana, encodeFunctionData({ abi: campanaEmergenciaAbi, functionName: "reclamarReembolso" }));
      avisar("exito", `Recuperaste ${pesos(resumen!.reembolsable)} MockCOP`, "Sin pagar gas: lo cubrió el patrocinador.");
      await qc.invalidateQueries();
    } catch (e) {
      avisar("error", "No se pudo reclamar", (e as Error).message);
    } finally {
      setReclamando(false);
    }
  }

  // "De tus 200.000: 60.000 en mercados (Supermercado X), 80.000 en materiales, 60.000 pendientes"
  const frase = partes
    .filter((p) => p.etapa.estado === 3)
    .map((p) => `${pesos(p.parte)} en ${p.etapa.descripcion.toLowerCase()} (${nombre(p.etapa.proveedor) ?? "proveedor"})`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="tarjeta">
          <p className="text-sm text-stone-500">{info.nombre}</p>
          <h2 className="mt-1 text-2xl font-bold text-stone-900">
            De tus {pesos(resumen.aporte)} MockCOP{frase.length ? ":" : ""}
          </h2>
          <p className="mt-2 text-lg text-stone-700">
            {frase.join(", ")}
            {frase.length > 0 && (resumen.pendiente > 0n || resumen.reembolsado > 0n) ? ", " : ""}
            {resumen.pendiente > 0n && (
              <span>
                {info.estado === 3
                  ? `${pesos(resumen.reembolsable)} para reclamar como reembolso`
                  : `${pesos(resumen.pendiente)} ${cerrado ? "pendientes" : "esperando el cierre del recaudo"}`}
              </span>
            )}
            {resumen.reembolsado > 0n && <span>{pesos(resumen.reembolsado)} te fueron reembolsados</span>}
            {frase.length === 0 && resumen.pendiente === 0n && resumen.reembolsado === 0n && resumen.reembolsable > 0n && (
              <span>{pesos(resumen.reembolsable)} disponibles para reembolso</span>
            )}
            .
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Tu aporte es el {porcentaje(resumen.aporte, resumen.totalRecaudado).toFixed(2)} % del total, así que de cada pago esa misma proporción “es tuya”.
          </p>
          {esEmpresa && (
            <p className="mt-3 rounded-xl bg-stone-100 p-3 text-sm text-stone-700">
              🏢 Esta cuenta es la empresa aliada <strong>{nombre(donante) ?? corta(donante)}</strong>: este es el rastreo de su aporte, igual que el de cualquier donante.
            </p>
          )}

          {/* Barra apilada: cómo se reparte tu aporte */}
          <div className="mt-5 flex h-5 w-full overflow-hidden rounded-full bg-stone-200" aria-hidden>
            {partes.map((p) => (
              <div
                key={p.i}
                className={p.etapa.estado === 3 ? COLORES_ETAPA[p.i % COLORES_ETAPA.length] : p.etapa.estado === 4 || info.estado === 3 ? "bg-sky-300" : "bg-stone-300"}
                style={{ width: `${porcentaje(p.parte, resumen.aporte)}%` }}
                title={`${p.etapa.descripcion}: ${pesos(p.parte)}`}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            {partes.map((p) => (
              <li key={p.i} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${p.etapa.estado === 3 ? COLORES_ETAPA[p.i % COLORES_ETAPA.length] : p.etapa.estado === 4 || info.estado === 3 ? "bg-sky-300" : "bg-stone-300"}`} />
                {p.etapa.descripcion}: {pesos(p.parte)} ({etiquetaEtapa(p.etapa.estado, info.estado).toLowerCase()})
              </li>
            ))}
          </ul>
        </section>

        {resumen.reembolsable > 0n && (
          <section className="tarjeta border-sky-300 bg-sky-50">
            <h3 className="text-lg font-bold text-sky-900">Tienes {pesos(resumen.reembolsable)} MockCOP para reclamar</h3>
            <p className="mt-1 text-sm text-sky-800">Es tu parte proporcional de lo que no se alcanzó a pagar a proveedores.</p>
            {esInvisible ? (
              <button className="btn-primario mt-3" disabled={reclamando} onClick={reclamarSinGas}>
                {reclamando ? "Reclamando…" : "Reclamar reembolso (sin costo)"}
              </button>
            ) : soyYo ? (
              <button
                className="btn-primario mt-3"
                disabled={!!pendiente}
                onClick={() =>
                  ejecutar({ address: campana, abi: campanaEmergenciaAbi, functionName: "reclamarReembolso", etiqueta: "Reclamar reembolso", exito: `Recibiste ${pesos(resumen.reembolsable)} MockCOP de vuelta` })
                }
              >
                Reclamar reembolso
              </button>
            ) : (
              <p className="mt-2 text-sm text-sky-800">Conecta esa wallet para reclamarlo.</p>
            )}
          </section>
        )}

        <Seccion titulo="Pago por pago" descripcion="Cada pago salió del contrato directo al proveedor. Tu parte es proporcional a tu aporte.">
          <ol className="space-y-3">
            {partes.map(({ etapa, parte, i }) => (
              <li key={i} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-stone-900">
                    {i + 1}. {etapa.descripcion}
                    <span className="ml-2 font-normal text-stone-500">tu parte: {pesos(parte)}</span>
                  </p>
                  <Insignia texto={etiquetaEtapa(etapa.estado, info.estado)} />
                </div>
                {cerrado && <p className="mt-1 text-sm text-stone-500">Monto de la etapa: {pesos(etapa.monto)} MockCOP</p>}
                {etapa.estado >= 1 && (
                  <div className="mt-2 space-y-2 text-sm">
                    <p>
                      <span className="text-stone-500">Proveedor: </span>
                      <Direccion valor={etapa.proveedor} nombre={nombre(etapa.proveedor)} />
                      {etapa.sobrecosto && <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white">Sobrecosto · {etapa.confirmacionesRequeridas} verificadores</span>}
                    </p>
                    {etapa.beneficiariosRequeridos > 0 && (
                      <p className="text-violet-800">
                        👪 {etapa.confirmacionesBeneficiarios} familias confirmaron que recibieron (se necesitaban {etapa.beneficiariosRequeridos})
                      </p>
                    )}
                    {etapa.estado === 3 && <TxPago campana={campana} etapa={i} bloque={etapa.bloquePago} />}
                    <VerEvidencia uri={etapa.uriEvidencia} hash={etapa.hashEvidencia} compacta />
                    {etapa.estado >= 2 && <Actas campana={campana} etapa={i} />}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Seccion>

        <MisDonaciones campana={campana} donante={donante} total={info.numeroDonaciones} />
      </div>

      <div className="space-y-6">
        {resumen.recibo > 0n && <ReciboNft id={resumen.recibo} />}
        <section className="tarjeta text-sm text-stone-600">
          <h3 className="font-bold text-stone-900">¿Cómo se calcula?</h3>
          <p className="mt-2">
            Las donaciones se cierran antes del primer pago, así que tu participación queda fija: <em>tu aporte ÷ total recaudado</em>. De cada pago a un proveedor, esa
            proporción es tuya. Si una etapa se rechaza o vence, recuperas la misma proporción de lo que no se pagó.
          </p>
          <p className="mt-2">Todo esto se lee directamente del contrato; nadie puede alterarlo.</p>
        </section>
      </div>
    </div>
  );
}

/** Busca el tx del pago en el bloque guardado on-chain (getLogs de 1 bloque: cabe en el límite del RPC). */
function TxPago({ campana, etapa, bloque }: { campana: Address; etapa: number; bloque: bigint }) {
  const cliente = usePublicClient({ chainId: CHAIN_ID });
  const { data } = useQuery({
    queryKey: ["txPago", campana, etapa, bloque.toString()],
    enabled: !!cliente && bloque > 0n,
    staleTime: Infinity,
    queryFn: async () => {
      const logs = await cliente!.getContractEvents({
        address: campana,
        abi: campanaEmergenciaAbi,
        eventName: "FondosLiberados",
        args: { etapa: BigInt(etapa) },
        fromBlock: bloque,
        toBlock: bloque,
      });
      return logs[0]?.transactionHash ?? null;
    },
  });
  return (
    <p className="text-stone-500">
      Pagado en el bloque {bloque.toString()} <EnlaceTx hash={data ?? undefined} texto="ver pago" />
    </p>
  );
}

function Actas({ campana, etapa }: { campana: Address; etapa: number }) {
  const { info } = useCampana(campana);
  const votos = useReadContract({ address: campana, abi: campanaEmergenciaAbi, functionName: "votos", args: [BigInt(etapa)], query: { staleTime: 60_000 } }).data;
  const nombre = useNombres(info?.verificadores ?? []);
  if (!votos || !info) return null;
  return (
    <ul className="mt-1 grid gap-2 sm:grid-cols-2">
      {info.verificadores.map((v, j) =>
        votos[0][j] === 1 ? (
          <li key={v} className="text-xs text-stone-500">
            <p className="mb-1">✓ {nombre(v) ?? v.slice(0, 8)} confirmó la entrega</p>
            <VerEvidencia uri={votos[2][j]} hash={votos[1][j]} compacta />
          </li>
        ) : null,
      )}
    </ul>
  );
}

function MisDonaciones({ campana, donante, total }: { campana: Address; donante: Address; total: bigint }) {
  const cliente = usePublicClient({ chainId: CHAIN_ID });
  const { data } = useQuery({
    queryKey: ["misDonaciones", campana, donante, total.toString()],
    enabled: !!cliente && total > 0n,
    queryFn: async () => {
      const todas = [];
      for (let desde = 0n; desde < total; desde += 300n) {
        const pagina = await cliente!.readContract({ address: campana, abi: campanaEmergenciaAbi, functionName: "donaciones", args: [desde, 300n] });
        todas.push(...pagina);
      }
      return todas.filter((d) => d.donante.toLowerCase() === donante.toLowerCase());
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <Seccion titulo="Tus donaciones">
      <ul className="divide-y divide-stone-100">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between py-2 text-sm">
            <span>
              <strong>{pesos(d.monto)}</strong> <span className="text-stone-400">· {fecha(d.fecha)}</span>
            </span>
            <TxDonacion campana={campana} donante={donante} bloque={d.bloque} />
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

function TxDonacion({ campana, donante, bloque }: { campana: Address; donante: Address; bloque: bigint }) {
  const cliente = usePublicClient({ chainId: CHAIN_ID });
  const { data } = useQuery({
    queryKey: ["txDonacion", campana, donante, bloque.toString()],
    enabled: !!cliente,
    staleTime: Infinity,
    queryFn: async () => {
      const logs = await cliente!.getContractEvents({ address: campana, abi: campanaEmergenciaAbi, eventName: "Donacion", args: { donante }, fromBlock: bloque, toBlock: bloque });
      return logs[0]?.transactionHash ?? null;
    },
  });
  return <EnlaceTx hash={data ?? undefined} texto={`bloque ${bloque}`} />;
}

function ReciboNft({ id }: { id: bigint }) {
  const uri = useReadContract({ address: DIRECCIONES.recibo, abi: reciboDonacionAbi, functionName: "tokenURI", args: [id], query: { refetchInterval: 15_000 } }).data;
  const meta = useMemo(() => {
    if (!uri) return null;
    try {
      const json = new TextDecoder().decode(Uint8Array.from(atob(uri.split(",")[1]), (c) => c.charCodeAt(0)));
      return JSON.parse(json) as { name: string; image: string; description: string };
    } catch {
      return null;
    }
  }, [uri]);
  if (!meta) return null;
  return (
    <section className="tarjeta">
      <h3 className="font-bold text-stone-900">Tu recibo NFT</h3>
      <p className="mt-1 text-xs text-stone-500">Intransferible. Se generó en la cadena con tu primera donación.</p>
      <img src={meta.image} alt={meta.name} className="mt-3 w-full rounded-xl" />
      <p className="mt-2 text-xs text-stone-500">
        {meta.name} · contrato <span className="font-mono">{DIRECCIONES.recibo.slice(0, 10)}…</span>
      </p>
    </section>
  );
}
