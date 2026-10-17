import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { mockCOPAbi } from "../abis";
import { CHAIN_ID, DIRECCIONES, appChain } from "../config";
import { useSaldoCop } from "../lib/datos";
import { corta, pesos } from "../lib/formato";
import { useEscribir } from "../lib/useEscribir";
import { mensajeError } from "../lib/errores";
import { useAvisar } from "../lib/notificaciones";

export function Billetera() {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: cambiando } = useSwitchChain();
  const avisar = useAvisar();

  if (!isConnected) {
    const conector = connectors[0];
    return (
      <button
        className="btn-primario"
        disabled={isPending || !conector}
        onClick={async () => {
          try {
            await connectAsync({ connector: conector, chainId: CHAIN_ID });
          } catch (e) {
            const sinWallet = !(window as unknown as { ethereum?: unknown }).ethereum;
            avisar("error", "No se pudo conectar", sinWallet ? "Instala MetaMask para continuar." : mensajeError(e));
          }
        }}
      >
        {isPending ? "Conectando…" : "Conectar MetaMask"}
      </button>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <button
        className="btn bg-amber-500 text-white hover:bg-amber-600"
        disabled={cambiando}
        onClick={() => switchChainAsync({ chainId: CHAIN_ID }).catch((e) => avisar("error", "No se pudo cambiar de red", mensajeError(e)))}
      >
        Cambiar a {appChain.name}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-mono text-xs text-stone-600" title={address}>
        {corta(address)}
      </span>
      <button className="btn-secundario px-3 py-1.5 text-xs" onClick={() => disconnect()}>
        Salir
      </button>
    </div>
  );
}

export function SaldoYFaucet() {
  const { isConnected, chainId } = useAccount();
  const saldo = useSaldoCop();
  const { ejecutar, pendiente } = useEscribir();
  if (!isConnected || chainId !== CHAIN_ID) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-stone-500">
        Tu saldo: <strong className="text-stone-800">{pesos(saldo)} MockCOP</strong>
      </span>
      <button
        className="btn-secundario px-3 py-1.5 text-xs"
        disabled={!!pendiente}
        onClick={() =>
          ejecutar({
            address: DIRECCIONES.cop,
            abi: mockCOPAbi,
            functionName: "faucet",
            etiqueta: "Pedir MockCOP",
            exito: "Recibiste 500.000 MockCOP de prueba",
          })
        }
      >
        {pendiente === "Pedir MockCOP" ? "Pidiendo…" : "Pedir 500.000 MockCOP (faucet)"}
      </button>
    </div>
  );
}
