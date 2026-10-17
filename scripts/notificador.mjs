// Notificador: le avisa a cada donante cuando se usa su plata.
//   "Hoy se usaron $60.000 de tu donación en mercados para «Inundación en Antioquia»."
//
//   pnpm notificador                 (Anvil)      ·   pnpm notificador:monad
//
// Con TELEGRAM_BOT_TOKEN en .env funciona como bot: el donante abre
// t.me/<bot>?start=<su wallet> (la app le muestra el botón) y queda suscrito.
// Sin token corre en "modo consola": imprime los avisos que enviaría (útil en la demo).
// Todo se lee con funciones view: no necesita eth_getLogs ni base de datos.
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, formatEther, http, isAddress } from "viem";
import { RAIZ, abi, dormir, leerReporte, redPorNombre } from "./lib/entorno.mjs";

const args = process.argv.slice(2);
const valor = (n, def) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);
const red = redPorNombre(valor("--red", "local"));
const reporte = leerReporte(red.id);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const INTERVALO = Number(valor("--intervalo", 3000));
const explorador = red.id === 10143 ? red.blockExplorers.default.url : null;
const APP = process.env.FRONTEND_URL || "http://localhost:5173/";

const ABI = { factory: abi("CampanaFactory"), campana: abi("CampanaEmergencia"), registro: abi("RegistroActores") };
const cliente = createPublicClient({ chain: red, transport: http(red.rpcUrls.default.http[0]) });
const pesos = (wei) => Number(formatEther(wei)).toLocaleString("es-CO", { maximumFractionDigits: 0 });

// Estado persistente: suscripciones (chat → wallets) y qué etapas ya se avisaron.
const rutaSus = path.join(RAIZ, "reports", `suscripciones-${red.id}.json`);
const rutaEstado = path.join(RAIZ, "reports", `notificador-${red.id}.json`);
const leerJson = (r, def) => (fs.existsSync(r) ? JSON.parse(fs.readFileSync(r, "utf8")) : def);
const suscripciones = leerJson(rutaSus, {}); // chatId -> [wallets]
const estado = leerJson(rutaEstado, { avisadas: {} }); // `${campana}-${etapa}-${estadoEtapa}` -> true
const guardar = () => {
  fs.writeFileSync(rutaSus, JSON.stringify(suscripciones, null, 2));
  fs.writeFileSync(rutaEstado, JSON.stringify(estado, null, 2));
};

async function telegram(metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return r.json();
}

async function enviar(chatId, texto) {
  if (!TOKEN) return console.log(`  📨 [consola → ${chatId}] ${texto.replace(/<[^>]+>/g, "")}`);
  await telegram("sendMessage", { chat_id: chatId, text: texto, parse_mode: "HTML", disable_web_page_preview: true });
}

// ─────────── Suscripciones por Telegram (/start 0x…) ───────────
let offset = 0;
async function leerMensajes() {
  if (!TOKEN) return;
  const r = await telegram("getUpdates", { offset, timeout: 0 });
  for (const u of r.result ?? []) {
    offset = u.update_id + 1;
    const m = u.message;
    if (!m?.text) continue;
    const chat = String(m.chat.id);
    const wallet = m.text.split(/\s+/)[1];
    if (m.text.startsWith("/start") && wallet && isAddress(wallet)) {
      suscripciones[chat] = [...new Set([...(suscripciones[chat] ?? []), wallet.toLowerCase()])];
      guardar();
      await enviar(chat, `✅ Listo. Te avisaré cada vez que se use dinero de la wallet <code>${wallet}</code>.\nNadie puede mover esa plata sin verificadores y sin la confirmación de las familias.`);
    } else if (m.text.startsWith("/start")) {
      await enviar(chat, "Hola 👋 Abre este bot desde el botón «Recibir avisos por Telegram» de Rastro Solidario para quedar suscrito a tu donación.");
    }
  }
}

// ─────────── Revisión de la cadena ───────────
async function revisar() {
  const campanas = await cliente.readContract({ address: reporte.CampanaFactory, abi: ABI.factory, functionName: "campanas" });
  const wallets = [...new Set(Object.values(suscripciones).flat())];
  for (const c of campanas) {
    const [info, etapas] = await Promise.all([
      cliente.readContract({ address: c, abi: ABI.campana, functionName: "info" }),
      cliente.readContract({ address: c, abi: ABI.campana, functionName: "etapas" }),
    ]);
    for (const [i, e] of etapas.entries()) {
      const evento = e.estado === 3 ? "pagada" : e.estado === 4 ? "rechazada" : e.sobrecosto && e.estado >= 1 ? "sobrecosto" : null;
      if (!evento) continue;
      const clave = `${c}-${i}-${evento}`.toLowerCase();
      if (estado.avisadas[clave]) continue;
      estado.avisadas[clave] = true;
      const proveedor = await cliente.readContract({ address: reporte.RegistroActores, abi: ABI.registro, functionName: "nombre", args: [e.proveedor] });
      console.log(`[${new Date().toLocaleTimeString("es-CO")}] «${info.nombre}» etapa ${i + 1} (${e.descripcion}): ${evento}`);

      // Destinatarios: cada chat suscrito con alguna wallet que donó a esta campaña.
      for (const [chat, ws] of Object.entries(suscripciones)) {
        for (const w of ws) {
          const aporte = await cliente.readContract({ address: c, abi: ABI.campana, functionName: "aportes", args: [w] });
          if (aporte === 0n) continue;
          const parte = await cliente.readContract({ address: c, abi: ABI.campana, functionName: "parteDonanteEnEtapa", args: [w, BigInt(i)] });
          const enlace = `${APP}#/rastreo/${c}/${w}`;
          const texto =
            evento === "pagada"
              ? `💚 Hoy se usaron <b>$${pesos(parte)}</b> de tu donación en <b>${e.descripcion.toLowerCase()}</b> para «${info.nombre}».\nSe pagó directo a ${proveedor || "el proveedor"} después de que los verificadores${e.beneficiariosRequeridos > 0 ? ` y ${e.confirmacionesBeneficiarios} familias` : ""} confirmaran la entrega.\n${enlace}`
              : evento === "rechazada"
                ? `⚠️ En «${info.nombre}» los verificadores rechazaron la etapa de ${e.descripcion.toLowerCase()}: la entrega no ocurrió. Tu parte de lo no gastado ya se puede reclamar.\n${enlace}`
                : `🔴 Alerta de sobrecosto en «${info.nombre}» (${e.descripcion.toLowerCase()}): la factura supera el precio de referencia. El contrato exige un verificador más antes de pagar.\n${enlace}`;
          await enviar(chat, texto);
        }
      }
    }
  }
  guardar();
  return wallets.length;
}

console.log(`Notificador de Rastro Solidario · ${red.name} · ${TOKEN ? "bot de Telegram activo" : "modo consola (define TELEGRAM_BOT_TOKEN para usar Telegram)"}`);
if (!TOKEN && Object.keys(suscripciones).length === 0) {
  // En modo consola sin suscriptores, sigue a los donantes de la última campaña para mostrar los avisos.
  const campanas = await cliente.readContract({ address: reporte.CampanaFactory, abi: ABI.factory, functionName: "campanas" });
  if (campanas.length) {
    const [cuentas] = await cliente.readContract({ address: campanas.at(-1), abi: ABI.campana, functionName: "donantes", args: [0n, 3n] });
    suscripciones["consola"] = cuentas.map((x) => x.toLowerCase());
    console.log(`(modo consola: siguiendo ${cuentas.length} donantes de la campaña más reciente)`);
  }
}
if (explorador) console.log(`Explorador: ${explorador}`);
while (true) {
  try {
    await leerMensajes();
    await revisar();
  } catch (e) {
    console.error("  (reintentando)", e.shortMessage || e.message);
  }
  await dormir(INTERVALO);
}
