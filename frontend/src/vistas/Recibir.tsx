import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useReadContracts } from "wagmi";
import { campanaEmergenciaAbi } from "../abis";
import { REFRESCO_MS } from "../config";
import { Barra } from "../componentes/Comunes";
import { enviarSinGas } from "../lib/billeteraInvisible";
import { useCampana, useNombres } from "../lib/datos";
import { pesos } from "../lib/formato";

/**
 * Lo que ve una familia damnificada al escanear el QR de su tarjeta con la cámara del celular.
 * Un solo botón: "Sí, recibí". Sin wallet, sin cripto, sin gas: la llave de la tarjeta firma y el
 * patrocinador paga la transacción.
 */
export function VistaRecibir({ campana, llave }: { campana?: string; llave?: string }) {
  const cuenta = useMemo(() => {
    try {
      return llave && /^0x[0-9a-fA-F]{64}$/.test(llave) ? privateKeyToAccount(llave as Hex) : null;
    } catch {
      return null;
    }
  }, [llave]);
  const direccion = campana && /^0x[0-9a-fA-F]{40}$/.test(campana) ? (campana as Address) : undefined;
  if (!cuenta || !direccion) {
    return <Marco>Este código QR no es válido. Pide a la Junta de Acción Comunal una tarjeta nueva.</Marco>;
  }
  return <Confirmar campana={direccion} cuenta={cuenta} />;
}

function Confirmar({ campana, cuenta }: { campana: Address; cuenta: ReturnType<typeof privateKeyToAccount> }) {
  const qc = useQueryClient();
  const { info, etapas } = useCampana(campana);
  const idx = info?.etapaActual ?? 0n;
  const base = { address: campana, abi: campanaEmergenciaAbi } as const;
  const r = useReadContracts({
    contracts: [
      { ...base, functionName: "esBeneficiario", args: [cuenta.address] },
      { ...base, functionName: "recepcionDe", args: [idx, cuenta.address] },
    ],
    query: { refetchInterval: REFRESCO_MS, enabled: !!info },
  });
  const esBeneficiario = r.data?.[0]?.result;
  const yaConfirmo = r.data?.[1]?.result;
  const etapa = etapas?.[Number(idx)];
  const nombre = useNombres([etapa?.proveedor]);
  const [estado, setEstado] = useState<"" | "enviando" | "listo">("");
  const [error, setError] = useState("");
  const [confirmada, setConfirmada] = useState<{ descripcion: string; pago: boolean } | null>(null);

  if (!info || !etapas || esBeneficiario === undefined) {
    return (
      <Marco>
        <div className="h-40 animate-pulse rounded-2xl bg-neutro-200" />
      </Marco>
    );
  }
  if (!esBeneficiario) return <Marco titulo={info.nombre}>Esta tarjeta no está en el censo de esta campaña. Habla con la Junta de Acción Comunal.</Marco>;

  const entregaEnCurso = info.estado === 1 && etapa && (etapa.estado === 1 || etapa.estado === 2);

  // Tras confirmar se muestra el resultado aunque la etapa ya haya avanzado (si esta confirmación
  // completó el quórum, el pago salió en la misma transacción).
  if (confirmada) {
    return (
      <Marco titulo={info.nombre}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-exito-600 p-6 text-center text-white">
            <p className="text-5xl">✓</p>
            <p className="mt-2 text-xl font-bold">¡Gracias! Tu confirmación quedó registrada</p>
            <p className="mt-1 text-sm text-exito-50">Entrega: {confirmada.descripcion}. Nadie la puede borrar ni cambiar.</p>
          </div>
          {confirmada.pago && (
            <p className="rounded-2xl bg-comunidad-50 p-4 text-center text-sm text-comunidad-900">
              Con tu voz se completaron las confirmaciones de la comunidad: el pago al proveedor salió en este mismo momento.
            </p>
          )}
        </div>
      </Marco>
    );
  }

  async function confirmar() {
    setError("");
    setEstado("enviando");
    try {
      await enviarSinGas(cuenta, campana, encodeFunctionData({ abi: campanaEmergenciaAbi, functionName: "confirmarRecepcion", args: [idx] }));
      const completo = etapa!.estado === 2 && etapa!.confirmacionesBeneficiarios + 1 >= etapa!.beneficiariosRequeridos;
      setConfirmada({ descripcion: etapa!.descripcion, pago: completo });
      setEstado("listo");
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
      setEstado("");
    }
  }

  if (!entregaEnCurso) {
    return (
      <Marco titulo={info.nombre}>
        {info.estado === 0
          ? "Todavía se están recogiendo las donaciones. Cuando empiece la entrega, vuelve a escanear tu tarjeta."
          : info.estado === 2
            ? "Todas las entregas de esta campaña ya terminaron. ¡Gracias por tu ayuda verificando!"
            : info.estado === 3
              ? "Esta campaña se canceló y el dinero volvió a los donantes."
              : "En este momento no hay una entrega esperando confirmación. Vuelve a escanear cuando recibas la próxima ayuda."}
      </Marco>
    );
  }

  const confirmaron = etapa.confirmacionesBeneficiarios;
  const requeridas = etapa.beneficiariosRequeridos;
  const lista = yaConfirmo || estado === "listo";

  return (
    <Marco titulo={info.nombre}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-marca-50 p-5 ring-1 ring-inset ring-marca-100">
          <p className="rotulo text-marca-700">Entrega {Number(idx) + 1}</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-neutro-900">{etapa.descripcion}</p>
          <p className="mt-2 text-neutro-700">
            {etapa.unidades > 0 && etapa.unidad ? `${etapa.unidades} × ${etapa.unidad}` : `${pesos(etapa.monto)} pesos en ayuda`}
            {nombre(etapa.proveedor) ? ` de ${nombre(etapa.proveedor)}` : ""}
          </p>
        </div>

        {lista ? (
          <div className="rounded-2xl bg-exito-600 p-6 text-center text-white">
            <p className="text-5xl">✓</p>
            <p className="mt-2 text-xl font-bold">¡Gracias! Tu confirmación quedó registrada</p>
            <p className="mt-1 text-sm text-exito-50">Nadie la puede borrar ni cambiar. Sin tu voz y la de tus vecinos, el pago no sale.</p>
          </div>
        ) : (
          <>
            <p className="text-center font-display text-xl font-bold text-neutro-900">¿Tu familia ya recibió esta ayuda?</p>
            <button
              className="w-full rounded-2xl bg-marca-700 px-6 py-6 font-display text-2xl font-extrabold text-white shadow-boton transition hover:bg-marca-800 active:scale-[0.98] disabled:opacity-60"
              disabled={estado === "enviando"}
              onClick={confirmar}
            >
              {estado === "enviando" ? "Registrando…" : "Sí, la recibí"}
            </button>
            <p className="text-center text-sm text-neutro-500">Si no la recibiste, no confirmes y avísale a la Personería. No tiene ningún costo para ti.</p>
          </>
        )}
        {error && <p className="rounded-xl bg-peligro-50 p-3 text-center text-sm text-peligro-800">{error}</p>}

        <div className="rounded-2xl bg-comunidad-50/60 p-4 ring-1 ring-inset ring-comunidad-100">
          <p className="mb-2 text-sm text-neutro-600">
            <strong className="text-comunidad-800">{confirmaron}</strong> de {info.numeroBeneficiarios.toString()} familias han confirmado
            {requeridas > confirmaron ? ` · se necesitan ${requeridas} para liberar el pago` : " · ya hay suficientes confirmaciones"}
          </p>
          <Barra valor={info.numeroBeneficiarios > 0n ? (confirmaron / Number(info.numeroBeneficiarios)) * 100 : 0} className="bg-comunidad-600" />
        </div>
      </div>
    </Marco>
  );
}

function Marco({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutro-50">
      <div className="bg-gradient-to-br from-marca-700 via-marca-800 to-marca-950 px-4 pb-16 pt-6 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl ring-2 ring-white/20" />
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold leading-tight">Rastro Solidario</p>
            <p className="truncate text-sm text-marca-50/75">{titulo ?? "Confirmación de entrega"}</p>
          </div>
        </div>
      </div>
      <div className="mx-auto -mt-10 max-w-md px-4 pb-8">
        <div className="rounded-3xl border border-neutro-200/80 bg-white p-5 text-[15px] leading-relaxed text-neutro-700 shadow-elevada">{children}</div>
      </div>
    </div>
  );
}
