/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the analytics host, e.g. https://analytics.example.com. Unset in a build with no analytics. */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_ANALYTICS_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
