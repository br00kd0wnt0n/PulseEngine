/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_INGESTION_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_AUTO_SAVE_DEBOUNCE_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
