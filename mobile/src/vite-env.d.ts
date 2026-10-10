/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAP_PROVIDER?: string;
  readonly VITE_MAP_API_KEY?: string;
  readonly VITE_LOCATION_TILE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
