// Prueba de humo de la app conectada a Monad testnet: sirve para localhost y para el despliegue
// en Vercel. Dona de verdad en la testnet (≈ 0,15 MON del patrocinador por corrida).
//
//   cd pruebas-e2e && node monad.mjs                                   # http://localhost:5173
//   BASE_URL=https://tu-app.vercel.app node monad.mjs
//
// Revisa: /api/estado, las 5 pestañas sin errores de consola, una evidencia publicada en /ipfs/,
// una donación con Nequi y otra con PSE (billetera invisible + gas patrocinado) y su rastreo.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
let fallas = 0;
const ok = (m) => log(`✓ ${m}`);
const mal = (m) => {
  fallas++;
  log(`✗ ${m}`);
};

// 1. Servicios
const estado = await fetch(`${BASE}/api/estado`).then((r) => r.json()).catch((e) => ({ error: e.message }));
if (estado.desplegado && estado.pasarela && estado.patrocinador) {
  const saldo = estado.saldoPatrocinador ? (Number(BigInt(estado.saldoPatrocinador) / 10n ** 15n) / 1000).toFixed(3) : "?";
  ok(`API: pasarela activa, patrocinador ${estado.patrocinador} con ${saldo} MON, evidencias nuevas: ${estado.evidencias ? "sí" : "no (falta PINATA_JWT)"}`);
} else mal(`API /api/estado: ${JSON.stringify(estado)}`);

// 2. Una evidencia publicada se sirve con su tipo
const dirPublicas = path.join(RAIZ, "evidencias-publicas");
const cid = fs.existsSync(dirPublicas) ? fs.readdirSync(dirPublicas).find((f) => !f.endsWith(".tipo")) : null;
if (cid) {
  const r = await fetch(`${BASE}/ipfs/${cid}`, { redirect: "manual" });
  if (r.status === 200) ok(`evidencia /ipfs/${cid.slice(0, 16)}… (${r.headers.get("content-type")})`);
  else mal(`evidencia /ipfs/${cid}: HTTP ${r.status}`);
}

const browser = await chromium.launch();
try {
  // 3. Pestañas
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errores.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errores.push(`pageerror ${e.message}`));
  for (const ruta of ["donar", "campana", "rastreo", "reputacion", "panel"]) {
    await page.goto(`${BASE}/#/${ruta}`);
    await page.getByText("Cargando…").first().waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const cargando = await page.getByText("Cargando…").count();
    cargando ? mal(`#/${ruta} sigue cargando`) : ok(`#/${ruta} carga`);
  }
  errores.length ? mal(`errores de consola: ${errores.slice(0, 3).join(" | ")}`) : ok("sin errores de consola");
  await ctx.close();

  // 4. Donaciones sin cripto
  for (const metodo of ["nequi", "pse"]) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${BASE}/#/donar`);
    await p.getByLabel(/¿Cuánto quieres donar/).fill("2000", { timeout: 60000 });
    if (metodo === "pse") await p.getByText("PSE (banco)").click();
    else await p.getByLabel("Celular Nequi").fill("3001234567");
    await p.getByRole("button", { name: /^Donar \$2\.000/ }).click();
    await p.getByRole("button", { name: "Aprobar pago" }).click();
    const tPago = Date.now();
    const resultado = await Promise.race([
      p.getByText("¡Gracias! Donaste").waitFor({ timeout: 120000 }).then(() => "ok"),
      p.getByText("No se pudo completar la donación").waitFor({ timeout: 120000 }).then(async () => await p.locator(".bg-rose-50").first().innerText()),
    ]).catch(() => "sin respuesta en 120 s");
    const s = ((Date.now() - tPago) / 1000).toFixed(1);
    if (resultado !== "ok") {
      mal(`donación ${metodo}: ${resultado.replace(/\s+/g, " ")}`);
    } else {
      ok(`donación ${metodo} de 2.000 en ${s} s`);
      await p.getByRole("button", { name: "Ver a dónde va mi dinero →" }).click();
      await p
        .getByText("De tus 2.000", { exact: false })
        .first()
        .waitFor({ timeout: 30000 })
        .then(() => ok(`rastreo de la donación ${metodo}`), () => mal(`rastreo de la donación ${metodo} no apareció`));
    }
    await c.close();
  }
} finally {
  await browser.close();
}

console.log(fallas ? `\n✗ ${fallas} falla(s)` : "\n✅ Todo funciona contra Monad testnet");
process.exit(fallas ? 1 : 0);
