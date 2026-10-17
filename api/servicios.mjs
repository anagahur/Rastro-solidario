// Función de Vercel con los servicios de la demo (pasarela simulada, gas patrocinado,
// evidencias). Es el mismo código que corre dentro de `pnpm dev` (scripts/servidor.mjs).
// vercel.json reescribe /api/* y /ipfs/* hacia aquí y pasa la ruta original en ?__ruta=.
import { manejar } from "../scripts/servidor.mjs";

const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.VITE_CHAIN_ID || 10143);

export default async function servicios(req, res) {
  const url = new URL(req.url, "http://x");
  const ruta = url.searchParams.get("__ruta") || url.pathname;
  const atendida = await manejar(req, res, { chainId: CHAIN_ID, ruta: ruta.startsWith("/") ? ruta : `/${ruta}` });
  if (!atendida) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "No existe" }));
  }
}
