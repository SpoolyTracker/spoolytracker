#!/bin/sh
set -e

# Runs via the nginx:alpine entrypoint (/docker-entrypoint.d/) before nginx starts.
# Generates the runtime env consumed by the SPA (window.__SPOOLY_ENV__, the same
# global the desktop shell injects) from environment variables, so a single
# prebuilt image works on any host/domain without rebuilding. Must NOT
# exec/replace the process — the base entrypoint starts nginx afterwards.
CONFIG_FILE=/usr/share/nginx/html/config.js

cat > "$CONFIG_FILE" <<EOF
window.__SPOOLY_ENV__ = {
  VITE_API_URL: "${API_PUBLIC_URL:-}",
  VITE_AI_ENGINE_URL: "${AI_ENGINE_PUBLIC_URL:-}",
  VITE_GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}"
};
EOF

echo "[40-app-config] generated $CONFIG_FILE"
