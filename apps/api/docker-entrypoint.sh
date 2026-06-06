#!/bin/sh
set -eu

if [ "${SELF_HOSTED:-false}" = "true" ]; then
  node dist/bootstrap-selfhost.js
fi

exec "$@"
