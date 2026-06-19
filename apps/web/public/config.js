// Default runtime env placeholder.
// In self-hosted Docker, this file is overwritten at container start by
// docker-entrypoint.sh with values from environment variables.
// In local dev (Vite) or the desktop shell, it preserves any pre-injected
// window.__SPOOLY_ENV__ and the app falls back to VITE_* build-time env vars.
window.__SPOOLY_ENV__ = window.__SPOOLY_ENV__ || {};
