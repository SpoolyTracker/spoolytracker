#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env.js <<EOF
window.__SPOOLY_CONFIG__ = {
  API_PUBLIC_URL: "${API_PUBLIC_URL:-http://localhost:3000}",
  AI_ENGINE_PUBLIC_URL: "${AI_ENGINE_PUBLIC_URL:-http://localhost:8000}",
  SELF_HOSTED: "${SELF_HOSTED:-false}",
  GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}",
  FIREBASE_URL: "${FIREBASE_URL:-}",
  APPSTORE_URL: "${APPSTORE_URL:-}",
  PLAYSTORE_URL: "${PLAYSTORE_URL:-}",
  DISCORD_URL: "${DISCORD_URL:-}"
};
EOF

exec "$@"
