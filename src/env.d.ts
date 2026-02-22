/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SCANNER_API_BASE_URL?: string;
  readonly PUBLIC_SCANNER_WS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
