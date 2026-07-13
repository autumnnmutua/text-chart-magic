/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MERMAID_ANALYTICS_URL?: string;
  readonly MERMAID_DOCS_URL?: string;
  readonly MERMAID_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
