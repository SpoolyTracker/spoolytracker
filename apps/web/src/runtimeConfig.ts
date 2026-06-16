// Resolves infrastructure URLs/keys with the following precedence:
//   1. Runtime config injected by the container entrypoint (window.__APP_CONFIG__)
//   2. Build-time Vite env vars (import.meta.env.VITE_*) — used in `npm run dev`
//   3. Sensible localhost defaults
//
// This lets a single prebuilt web image be deployed to any host/domain without
// rebuilding: the self-host entrypoint writes /config.js from env vars at
// container start. See apps/web/docker-entrypoint.sh.

export interface AppRuntimeConfig {
  API_URL?: string;
  AI_ENGINE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig;
  }
}

const runtime: AppRuntimeConfig =
  (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

function resolve(
  runtimeValue: string | undefined,
  buildValue: string | undefined,
  fallback: string,
): string {
  if (runtimeValue && runtimeValue.trim() !== '') return runtimeValue;
  if (buildValue && buildValue.trim() !== '') return buildValue;
  return fallback;
}

export const API_URL = resolve(
  runtime.API_URL,
  import.meta.env.VITE_API_URL,
  'http://localhost:3000',
);

export const AI_ENGINE_URL = resolve(
  runtime.AI_ENGINE_URL,
  import.meta.env.VITE_AI_ENGINE_URL,
  'http://localhost:8000',
);

export const GOOGLE_CLIENT_ID = resolve(
  runtime.GOOGLE_CLIENT_ID,
  import.meta.env.VITE_GOOGLE_CLIENT_ID,
  '',
);
