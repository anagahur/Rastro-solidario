import { useMemo, useState } from "react";
import type { Address } from "viem";
import { interpretarRespaldo, marcarRespaldada, respaldo, restaurarBilletera, useBilleteraInvisible } from "../lib/billeteraInvisible";
import { corta } from "../lib/formato";
import { useAvisar } from "../lib/notificaciones";

/**
 * Las 12 palabras de la billetera invisible: con ellas la persona recupera sus donaciones (y sus
 * reembolsos) si cambia de celular o borra el navegador. Nadie más las tiene.
 */
export function RespaldoPalabras() {
  const { direccion, respaldada } = useBilleteraInvisible();
  const avisar = useAvisar();
  const [visibles, setVisibles] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const datos = useMemo(() => (direccion ? respaldo() : null), [direccion]);
  if (!direccion || !datos) return null;

  const texto = datos.tipo === "palabras" ? datos.palabras.join(" ") : datos.llave;
  const nombre = datos.tipo === "palabras" ? "12 palabras" : "llave de recuperación";

  if (respaldada && !abierto) {
    return (
      <div className="nota-exito flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden>✓</span> Guardaste tus {nombre}: puedes recuperar tus donaciones en cualquier celular.
        </span>
        <button className="text-xs font-semibold text-exito-800 underline" onClick={() => setAbierto(true)}>
          Ver de nuevo
        </button>
      </div>
    );
  }

  function descargar() {
    const contenido = [
      "RASTRO SOLIDARIO · Recuperación de tu billetera de donaciones",
      "",
      `Billetera: ${direccion}`,
      "",
      datos!.tipo === "palabras" ? datos!.palabras.map((p, i) => `${String(i + 1).padStart(2, " ")}. ${p}`).join("\n") : `Llave: ${datos!.llave}`,
      "",
      "Guárdalo en un lugar seguro y no se lo muestres a nadie: quien lo tenga puede reclamar tus reembolsos.",
      "Para recuperar: Rastrear mi donación → «¿Cambiaste de celular?»",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rastro-solidario-recuperacion-${direccion!.slice(2, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-inset ring-alerta-200 shadow-suave">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-alerta-100 text-base ring-1 ring-inset ring-alerta-200">
          🔑
        </span>
        <div>
          <p className="font-display text-base font-extrabold text-neutro-900">Guarda tus {nombre}</p>
          <p className="mt-0.5 leading-relaxed text-neutro-600">
            Si cambias de celular o borras el navegador, con {datos.tipo === "palabras" ? "ellas" : "ella"} recuperas tus donaciones y tus reembolsos. Nadie más{" "}
            {datos.tipo === "palabras" ? "las" : "la"} tiene, ni siquiera Rastro Solidario.
          </p>
        </div>
      </div>

      <div className="relative">
        {datos.tipo === "palabras" ? (
          <ol className={`grid grid-cols-3 gap-1.5 transition ${visibles ? "" : "select-none blur-sm"}`} aria-hidden={!visibles}>
            {datos.palabras.map((p, i) => (
              <li key={i} className="flex items-baseline gap-1.5 rounded-lg bg-neutro-50 px-2 py-1.5 ring-1 ring-inset ring-neutro-200/70">
                <span className="w-4 text-right text-[10px] font-semibold tabular text-neutro-400">{i + 1}</span>
                <span className="font-semibold text-neutro-900">{p}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={`hash rounded-lg bg-neutro-50 p-3 ring-1 ring-inset ring-neutro-200/70 ${visibles ? "" : "select-none blur-sm"}`}>{datos.llave}</p>
        )}
        {!visibles && (
          <button className="btn-secundario absolute inset-0 m-auto h-fit w-fit" onClick={() => setVisibles(true)}>
            👁 Mostrar mis {nombre}
          </button>
        )}
      </div>

      {visibles && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secundario py-2 text-xs"
              onClick={() => navigator.clipboard?.writeText(texto).then(() => avisar("exito", "Copiadas", "Pégalas en un lugar seguro, por ejemplo una nota privada."))}
            >
              Copiar
            </button>
            <button className="btn-secundario py-2 text-xs" onClick={descargar}>
              Descargar (.txt)
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-neutro-500">
            Escríbelas en papel o guárdalas en tus notas. No se las muestres a nadie: quien las tenga puede reclamar tus reembolsos.
          </p>
          <button
            className="btn-primario w-full"
            onClick={() => {
              marcarRespaldada(direccion as Address);
              setAbierto(false);
              setVisibles(false);
            }}
          >
            Ya las guardé en un lugar seguro
          </button>
        </>
      )}
    </div>
  );
}

/** Formulario para traer la billetera de otro celular con sus 12 palabras (o su llave). */
export function RecuperarBilletera({ onRecuperada }: { onRecuperada: (d: Address) => void }) {
  const { direccion: actual, respaldada } = useBilleteraInvisible();
  const avisar = useAvisar();
  const [texto, setTexto] = useState("");
  const [intento, setIntento] = useState(false);
  const r = interpretarRespaldo(texto);
  const ok = "llave" in r;

  function recuperar() {
    setIntento(true);
    if (!ok) return;
    if (actual && !respaldada) {
      const sigue = confirm(
        `Este navegador ya tiene otra billetera (${corta(actual)}) y no guardaste sus palabras. Si continúas, se reemplaza y no podrás volver a ella. ¿Continuar?`,
      );
      if (!sigue) return;
    }
    const direccion = restaurarBilletera(r);
    setTexto("");
    setIntento(false);
    avisar("exito", "¡Billetera recuperada!", `Ya puedes ver tus donaciones y reclamar reembolsos desde ${corta(direccion)}.`);
    onRecuperada(direccion);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        recuperar();
      }}
    >
      <label className="block">
        <span className="etiqueta">Tus 12 palabras, en orden</span>
        <textarea
          className="campo min-h-[96px] font-medium"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="árbol casa flor lago luna mar …"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      {texto.trim() && (
        <p className={`text-xs ${ok ? "font-semibold text-exito-700" : intento || r.faltan === undefined ? "text-peligro-700" : "text-neutro-500"}`}>
          {ok ? "✓ Palabras correctas" : r.error}
        </p>
      )}
      <button className="btn-primario w-full" disabled={!ok}>
        Recuperar mis donaciones
      </button>
      <p className="text-[11px] leading-relaxed text-neutro-500">
        Puedes escribirlas sin tildes o solo con sus primeras 4 letras. Si guardaste una llave que empieza por 0x, pégala aquí.
      </p>
    </form>
  );
}
