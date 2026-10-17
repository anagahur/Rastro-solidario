import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import App from "./App";
import { ES_MONAD, appChain, transporteApp } from "./config";
import { ProveedorNotificaciones } from "./lib/notificaciones";
import "./index.css";

const config = createConfig({
  chains: [appChain],
  connectors: [injected()],
  transports: { [appChain.id]: transporteApp() },
  // Monad confirma en ~400 ms: consultar recibos seguido hace que la UI se sienta instantánea.
  pollingInterval: ES_MONAD ? 500 : 1000,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ProveedorNotificaciones>
          <App />
        </ProveedorNotificaciones>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
