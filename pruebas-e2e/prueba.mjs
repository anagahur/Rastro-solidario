// Prueba E2E del frontend real contra Anvil, con un "MetaMask" falso que reenvía al nodo
// (Anvil tiene las cuentas de prueba desbloqueadas: firma eth_sendTransaction y signTypedData).
//
// Recorre TODO el producto: censo y tarjetas QR, aporte de una empresa aliada, donación con Nequi sin
// wallet (billetera invisible + gas patrocinado), donación con MetaMask, alerta de sobrecosto,
// evidencia con foto y GPS, 3 de 3 verificadores, confirmación de una familia desde el celular,
// página pública (línea de tiempo, mapa, integridad), reputación, avisos al donante, rechazo y
// reembolso sin gas.
//
// Uso (con Anvil corriendo, contratos desplegados con pnpm deploy:local y pnpm dev activo):
//   cd pruebas-e2e && npm run instalar && npm run prueba
// Las capturas quedan en pruebas-e2e/shots/.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHOTS = path.join(process.cwd(), "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const C = {
  admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  fundacion: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  v1: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  v2: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  v3: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  empresa: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
};
const MOCOA = { latitude: 1.1475, longitude: -76.647 };
// PNG de 1×1 (la "foto" de la evidencia)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

function proveedorFalso(addr) {
  const RPC = "http://127.0.0.1:8545";
  let id = 1;
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    async request({ method, params }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params: params ?? [] }) });
      const j = await r.json();
      if (j.error) {
        const e = new Error(j.error.message);
        e.code = j.error.code;
        e.data = j.error.data;
        throw e;
      }
      return j.result;
    },
    on(ev, fn) {
      (listeners[ev] ||= []).push(fn);
    },
    removeListener(ev, fn) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
    },
  };
}

const errores = [];
const paginas = [];
const browser = await chromium.launch();

function vigilar(nombre, page) {
  paginas.push([nombre, page]);
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(`[${nombre}] ${m.text()}`);
  });
  page.on("pageerror", (e) => errores.push(`[${nombre}] pageerror ${e.message}`));
  page.on("dialog", (d) => d.accept());
}

async function abrir(cuenta, ruta, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, geolocation: MOCOA, permissions: ["geolocation"] });
  await ctx.addInitScript(proveedorFalso, cuenta);
  const page = await ctx.newPage();
  vigilar(cuenta.slice(0, 6), page);
  await page.goto(`${BASE}/#/${ruta}`);
  await page.getByRole("button", { name: "Conectar MetaMask" }).click();
  await page.getByText(cuenta.slice(0, 6), { exact: false }).first().waitFor({ timeout: 15000 });
  return { ctx, page };
}

/** Navegador sin wallet (donante con Nequi, familia, periodista). */
async function abrirSinWallet(nombre, ruta, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  vigilar(nombre, page);
  await page.goto(`${BASE}/#/${ruta}`);
  return { ctx, page };
}

async function toast(page, texto, timeout = 30000) {
  await page.getByText(texto, { exact: false }).first().waitFor({ timeout });
}

async function reconectar(page) {
  await page.reload();
  await page.getByRole("button", { name: "Conectar MetaMask" }).click({ timeout: 5000 }).catch(() => {});
}

/** Sube foto + nota + GPS en el formulario de evidencia y espera a que quede en IPFS. */
async function evidencia(page, nota, conFoto = true) {
  if (conFoto) await page.locator('input[type="file"]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByPlaceholder(/^Nota/).first().fill(nota);
  if (conFoto) {
    await page.getByRole("button", { name: /Agregar ubicación GPS/ }).click();
    await page.getByText("1.1475, -76.647", { exact: false }).first().waitFor({ timeout: 10000 });
    await page.getByPlaceholder("Lugar (barrio, vereda)").fill("Sector La Playita, Mocoa");
  }
  await page.getByRole("button", { name: "Subir evidencia" }).click();
  await page.getByRole("button", { name: "✓ Evidencia lista" }).waitFor({ timeout: 15000 });
}

async function sinScrollHorizontal(page, ancho) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > ancho) throw new Error(`scroll horizontal en móvil: ${w}px`);
}

const paso = (m) => console.log(`\n▶ ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);

try {
  // 1. La fundación crea una campaña con precios de referencia y voz de la comunidad (30 %)
  paso("Fundación crea campaña (precios de referencia + quórum de la comunidad)");
  const f = await abrir(C.fundacion, "panel");
  await f.page.getByText("Fundación", { exact: true }).first().waitFor();
  await f.page.getByRole("button", { name: "Crear campaña" }).first().click();
  await f.page.getByPlaceholder("Inundación en Antioquia").fill("Prueba E2E: avenida torrencial");
  await f.page.getByLabel("Meta (MockCOP)").fill("1000000");
  await f.page.locator("form").getByRole("button", { name: "Crear campaña" }).click();
  await toast(f.page, "Campaña creada");
  await f.page.getByRole("heading", { name: "Prueba E2E: avenida torrencial" }).first().waitFor({ timeout: 20000 });
  const campana = await f.page.evaluate(() => localStorage.getItem("rastro:campana"));
  ok(`campaña ${campana}`);

  // 2. La Junta de Acción Comunal (verificador 2) carga el censo y genera las tarjetas QR
  paso("Verificador carga el censo de 3 familias y genera las tarjetas QR");
  const v2 = await abrir(C.v2, "panel");
  await v2.page.getByText("Censo de familias damnificadas").waitFor({ timeout: 20000 });
  await v2.page.getByLabel("Familias a registrar").fill("3");
  await v2.page.getByRole("button", { name: "Generar 3 tarjetas y registrar" }).click();
  await toast(v2.page, "3 familias registradas");
  const tarjetas = await v2.page.evaluate((c) => JSON.parse(localStorage.getItem(`rastro:tarjetas:31337:${c.toLowerCase()}`) || "[]"), campana);
  if (tarjetas.length !== 3) throw new Error(`se esperaban 3 tarjetas, hay ${tarjetas.length}`);
  await v2.page.goto(`${BASE}/#/tarjetas/${campana}`);
  await v2.page.getByText("Tarjeta de familia").nth(2).waitFor({ timeout: 15000 });
  await v2.page.waitForTimeout(500);
  await v2.page.screenshot({ path: `${SHOTS}/01-tarjetas-qr.png`, fullPage: true });
  ok("3 familias en el censo y 3 tarjetas con QR");

  // 3. Empresa aliada dona con su nombre desde el Panel
  paso("Empresa aliada dona 200.000 con su nombre");
  const e = await abrir(C.empresa, "panel");
  await e.page.getByText("Aporte de tu empresa").waitFor({ timeout: 20000 });
  await e.page.getByRole("button", { name: /faucet/ }).click();
  await toast(e.page, "Recibiste 500.000");
  await e.page.getByLabel(/^Monto a donar/).fill("200000");
  await e.page.getByRole("button", { name: /^Donar 200\.000 MockCOP/ }).click();
  await toast(e.page, "Gracias");
  await e.page.getByText("Tu empresa aportó 200.000", { exact: false }).waitFor({ timeout: 20000 });
  ok("200.000 a nombre de la empresa, con su recibo NFT");
  await e.ctx.close();

  // 4. Donante SIN wallet: Nequi simulado → billetera invisible → gas patrocinado
  paso("Donante sin cripto dona 300.000 con Nequi");
  const n = await abrirSinWallet("nequi", "donar");
  await n.page.getByText("Empresas aliadas", { exact: true }).first().waitFor({ timeout: 20000 });
  await n.page.getByLabel(/¿Cuánto quieres donar/).fill("300000");
  await n.page.getByLabel("Celular Nequi").fill("3001234567");
  await n.page.getByRole("button", { name: /^Donar \$300\.000/ }).click();
  await n.page.getByRole("button", { name: "Aprobar pago" }).click();
  await n.page.getByText("¡Gracias! Donaste $300.000").waitFor({ timeout: 30000 });
  await n.page.screenshot({ path: `${SHOTS}/02-donar-nequi.png`, fullPage: true });
  await n.page.getByRole("button", { name: "Ver a dónde va mi dinero →" }).click();
  await n.page.getByText("De tus 300.000 MockCOP").waitFor({ timeout: 20000 });
  ok("donación sin wallet y sin pagar gas; la empresa aliada aparece con su aporte");

  // 5. Donante con MetaMask completa la meta (permit, 1 tx)
  paso("Donante con MetaMask completa la meta");
  const d = await abrir(C.admin, "donar");
  await d.page.getByRole("tab", { name: "Wallet cripto" }).click();
  await d.page.getByRole("button", { name: /faucet/ }).click();
  await toast(d.page, "Recibiste 500.000");
  await d.page.getByLabel(/¿Cuánto quieres donar/).fill("500000");
  await d.page.getByRole("button", { name: /^Donar 500\.000 MockCOP/ }).click();
  await toast(d.page, "Gracias");
  await d.page.getByText("En ejecución", { exact: true }).first().waitFor({ timeout: 15000 });
  ok("meta de 1.000.000 completa → recaudo cerrado solo");
  await d.ctx.close();

  // 6. La fundación propone la etapa 1 con SOBRECOSTO (300.000 por 1 mercado vs 150.000)
  paso("Fundación propone etapa 1 con factura, foto y GPS → alerta de sobrecosto");
  await reconectar(f.page);
  await f.page.getByText("Proponer etapa 1").waitFor({ timeout: 20000 });
  await f.page.getByLabel(/Unidades en la factura/).fill("1");
  await f.page.getByText("⚠ Sobrecosto: quedará marcado", { exact: false }).waitFor();
  await evidencia(f.page, "Factura FE-1001 · 1 mercado");
  await f.page.getByRole("button", { name: "Proponer desembolso" }).click();
  await toast(f.page, "Etapa 1 propuesta");
  await f.page.getByText("Alerta de sobrecosto:", { exact: false }).first().waitFor({ timeout: 15000 });
  await f.page.screenshot({ path: `${SHOTS}/03-sobrecosto.png`, fullPage: true });
  ok("etapa marcada en rojo: exige 3 de 3 verificadores");

  // 7. Los 3 verificadores confirman con foto y GPS
  paso("3 de 3 verificadores confirman con foto del acta");
  for (const [i, cuenta] of [C.v1, C.v2, C.v3].entries()) {
    const p = i === 1 ? v2 : await abrir(cuenta, "panel");
    if (i === 1) {
      await p.page.goto(`${BASE}/#/panel`);
      await reconectar(p.page);
    }
    await p.page.getByText("Verificación de entregas").waitFor({ timeout: 20000 });
    await p.page.getByText("esta etapa exige 3 confirmaciones", { exact: false }).waitFor({ timeout: 20000 });
    await evidencia(p.page, `Acta de entrega · verificador ${i + 1}`);
    await p.page.getByLabel(/contaste en el sitio/).fill("1");
    await p.page.getByText("Cuadra con la factura").waitFor({ timeout: 5000 });
    await p.page.getByRole("button", { name: "Confirmar entrega" }).click();
    await toast(p.page, "Confirmación registrada");
    await p.ctx.close();
    ok(`verificador ${i + 1} confirmó`);
  }
  await reconectar(f.page);
  await f.page.getByText("Esperando a la comunidad").first().waitFor({ timeout: 20000 });
  ok("aprobada por verificadores, pero el pago espera a la comunidad");

  // 8. Una familia escanea su QR en el celular y confirma (sin wallet, sin gas)
  paso("Familia confirma desde el celular con su QR");
  const fam = await abrirSinWallet("familia", `recibir/${campana}/${tarjetas[0].llave}`, { width: 390, height: 844 });
  await fam.page.getByText("¿Tu familia ya recibió esta ayuda?").waitFor({ timeout: 20000 });
  await sinScrollHorizontal(fam.page, 390);
  await fam.page.screenshot({ path: `${SHOTS}/04-familia-qr.png`, fullPage: true });
  await fam.page.getByRole("button", { name: "Sí, la recibí" }).click();
  await fam.page.getByText("Tu confirmación quedó registrada").waitFor({ timeout: 30000 });
  await fam.page.screenshot({ path: `${SHOTS}/05-familia-confirmo.png`, fullPage: true });
  await fam.ctx.close();
  ok("confirmación de la familia → pago automático al proveedor");

  // 9. Página pública: línea de tiempo, mapa e integridad de la evidencia
  paso("Página pública sin wallet");
  const pub = await abrirSinWallet("publica", `campana/${campana}`);
  await pub.page.getByText("SOBRECOSTO detectado", { exact: false }).waitFor({ timeout: 20000 });
  await pub.page.getByText("Pagado: 300.000 MockCOP a", { exact: false }).waitFor({ timeout: 20000 });
  await pub.page.getByText("✓ Íntegra").first().waitFor({ timeout: 20000 });
  const marcadores = await pub.page.locator("path.leaflet-interactive").count();
  if (marcadores < 1) throw new Error("el mapa no muestra entregas");
  await pub.page.waitForTimeout(1500);
  await pub.page.screenshot({ path: `${SHOTS}/06-publica.png`, fullPage: true });
  ok(`línea de tiempo + ${marcadores} puntos en el mapa + evidencia íntegra`);

  // 10. Reputación on-chain
  paso("Reputación on-chain");
  await pub.page.goto(`${BASE}/#/reputacion`);
  await pub.page.getByRole("tab", { name: /^Proveedores/ }).click();
  await pub.page.getByText("Supermercado La Cosecha").first().waitFor({ timeout: 20000 });
  await pub.page.waitForTimeout(1000);
  await pub.page.screenshot({ path: `${SHOTS}/07-reputacion.png`, fullPage: true });
  ok("historial de proveedores con sobrecostos");
  await pub.ctx.close();

  // 11. El donante de Nequi recibe el aviso de en qué se usó su plata
  paso("Aviso al donante: “se usaron $X de tu donación en mercados”");
  await n.page.goto(`${BASE}/#/donar`);
  const campanita = n.page.getByRole("button", { name: /Avisos: \d+ nuevos/ });
  await campanita.waitFor({ timeout: 20000 });
  await campanita.click();
  await n.page.getByText("de tu donación en mercados", { exact: false }).first().waitFor();
  await n.page.screenshot({ path: `${SHOTS}/08-avisos.png` });
  ok("aviso visible en la campanita");

  // 12. Etapa 2: la entrega no ocurre → 1 rechazo + 1 conteo incompleto → reembolso
  paso("Etapa 2 rechazada por 2 de 3 (uno por conteo en campo) → reembolso");
  await reconectar(f.page);
  await f.page.getByText("Proponer etapa 2").waitFor({ timeout: 20000 });
  await f.page.getByLabel(/Unidades en la factura/).fill("2");
  await evidencia(f.page, "Factura FE-2002 · 2 kits de techo", false);
  await f.page.getByRole("button", { name: "Proponer desembolso" }).click();
  await toast(f.page, "Etapa 2 propuesta");
  {
    const p = await abrir(C.v1, "panel");
    await p.page.getByText("Verificación de entregas").waitFor({ timeout: 20000 });
    await evidencia(p.page, "La entrega no ocurrió: la bodega estaba vacía");
    await p.page.getByRole("button", { name: "Rechazar" }).click();
    await toast(p.page, "Rechazo registrado");
    await p.ctx.close();
    ok("verificador 1 rechazó");
  }
  {
    const p = await abrir(C.v3, "panel");
    await p.page.getByText("Verificación de entregas").waitFor({ timeout: 20000 });
    await evidencia(p.page, "Solo había 1 kit de los 2 facturados");
    await p.page.getByLabel(/contaste en el sitio/).fill("1");
    await p.page.getByText("Faltan 1 de 2 facturadas", { exact: false }).waitFor({ timeout: 5000 });
    await p.page.screenshot({ path: `${SHOTS}/08b-conteo-no-cuadra.png`, fullPage: true });
    await p.page.getByRole("button", { name: "Confirmar entrega" }).click();
    await toast(p.page, "Registrado como rechazo: faltan unidades");
    await p.ctx.close();
    ok("verificador 3 contó 1 de 2: el contrato lo registró como rechazo");
  }
  await reconectar(f.page);
  await f.page.getByText("El conteo en campo no cuadra", { exact: false }).first().waitFor({ timeout: 20000 });
  ok("etapa rechazada y marcada: el conteo en campo no cuadra");

  // 13. El donante de Nequi recupera su parte sin pagar gas
  paso("Donante sin cripto reclama su reembolso (sin gas)");
  await n.page.goto(`${BASE}/#/rastreo`);
  await n.page.getByText("Tienes 210.000 MockCOP para reclamar").waitFor({ timeout: 20000 });
  await n.page.getByRole("button", { name: "Reclamar reembolso (sin costo)" }).click();
  await toast(n.page, "Recuperaste 210.000 MockCOP");
  await n.page.getByText("210.000 te fueron reembolsados", { exact: false }).waitFor({ timeout: 15000 });
  await n.page.screenshot({ path: `${SHOTS}/09-rastreo-reembolso.png`, fullPage: true });
  ok("reembolso de 210.000 (70 % de 300.000) con gas patrocinado");

  // 14. Vista móvil
  paso("Vista móvil (390 px)");
  const m = await abrirSinWallet("movil", "donar", { width: 390, height: 844 });
  await m.page.getByText("Etapas del gasto").first().waitFor({ timeout: 20000 });
  await m.page.waitForTimeout(1500);
  await sinScrollHorizontal(m.page, 390);
  await m.page.screenshot({ path: `${SHOTS}/10-movil.png`, fullPage: true });
  await m.page.goto(`${BASE}/#/campana/${campana}`);
  await m.page.getByText("Línea de tiempo").waitFor({ timeout: 20000 });
  await m.page.waitForTimeout(1500);
  await sinScrollHorizontal(m.page, 390);
  ok("sin scroll horizontal en Donar ni en la página pública");

  console.log("\n✅ PRUEBA E2E COMPLETA");
} catch (e) {
  console.error("\n❌ FALLÓ:", e.message);
  for (const [nombre, p] of paginas) {
    try {
      if (p.isClosed()) continue;
      await p.screenshot({ path: `${SHOTS}/fallo-${nombre}.png`, fullPage: true });
      const avisos = await p.locator("[aria-live] > div").allInnerTexts();
      if (avisos.length) console.log(`  avisos en ${nombre}:`, JSON.stringify(avisos));
    } catch {}
  }
  process.exitCode = 1;
} finally {
  const relevantes = errores.filter((x) => !/Download the React DevTools|favicon|tile\.openstreetmap|ERR_INTERNET_DISCONNECTED|net::ERR/.test(x));
  if (relevantes.length) {
    console.log(`\nErrores de consola (${relevantes.length}):`);
    for (const x of [...new Set(relevantes)].slice(0, 20)) console.log("  ", x.slice(0, 300));
  }
  await browser.close();
}
