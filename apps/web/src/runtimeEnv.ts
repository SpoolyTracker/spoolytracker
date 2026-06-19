// Prefers runtime config injected by the desktop shell (window.__SPOOLY_ENV__),
// then Vite build-time env, then the provided fallback.
declare global {
    interface Window { __SPOOLY_ENV__?: Record<string, string>; }
}

export function getEnv(key: string, fallback: string): string {
    const runtime = typeof window !== 'undefined' ? window.__SPOOLY_ENV__ : undefined;
    if (runtime && runtime[key]) return runtime[key];
    const viteVal = (import.meta.env as Record<string, string | undefined>)[key];
    return viteVal || fallback;
}
