// Default runtime config placeholder.
// In self-hosted Docker, this file is overwritten at container start by
// docker-entrypoint.sh with values from environment variables.
// In local dev (Vite), it stays empty and the app falls back to VITE_* env vars.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
