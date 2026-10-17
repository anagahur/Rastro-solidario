import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// Servicios de la demo (evidencias, pasarela simulada, gas patrocinado). Ver scripts/servidor.mjs
import { serviciosRastro } from "../scripts/servidor.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const chainId = Number(env.VITE_CHAIN_ID || 31337);
  const rpc = env.VITE_RPC_URL || "http://127.0.0.1:8545";
  return {
    plugins: [react(), serviciosRastro({ chainId })],
    server: {
      port: 5173,
      // host: true para que un celular en la misma red abra la app y escanee las tarjetas QR.
      host: true,
      // El celular no ve el 127.0.0.1 del computador: la app le habla al nodo a través de /rpc.
      proxy: { "/rpc": { target: rpc, changeOrigin: true, rewrite: () => "" } },
    },
    preview: { port: 4173, host: true, proxy: { "/rpc": { target: rpc, changeOrigin: true, rewrite: () => "" } } },
    build: {
      // Librerías en archivos aparte: se descargan en paralelo y el navegador las conserva en caché
      // entre despliegues (solo cambia el código de la app).
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
            if (/[\\/]node_modules[\\/](viem|ox|abitype|@noble|@scure)[\\/]/.test(id)) return "viem";
            if (/[\\/]node_modules[\\/](wagmi|@wagmi|@tanstack)[\\/]/.test(id)) return "wagmi";
            if (/[\\/]node_modules[\\/]leaflet[\\/]/.test(id)) return "mapa";
          },
        },
      },
    },
  };
});
