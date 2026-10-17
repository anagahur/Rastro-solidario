/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  /** RPCs de respaldo separados por comas (vacío = sin respaldo) */
  readonly VITE_RPC_RESPALDO?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_MOCKCOP_ADDRESS?: string;
  readonly VITE_REGISTRO_ADDRESS?: string;
  readonly VITE_RECIBO_ADDRESS?: string;
  readonly VITE_FACTORY_ADDRESS?: string;
  readonly VITE_BLOQUE_DESPLIEGUE?: string;
  readonly VITE_IPFS_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
