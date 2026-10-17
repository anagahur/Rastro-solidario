import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import App from "./App";
import { wagmiConfig } from "./lib/cliente";
import { ProveedorNotificaciones } from "./lib/notificaciones";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ProveedorNotificaciones>
          <App />
        </ProveedorNotificaciones>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
