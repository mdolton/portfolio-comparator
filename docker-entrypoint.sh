#!/bin/sh
set -e

# The container starts as root so it can fix ownership of the data directory:
# named volumes keep ownership from when older images ran as root, and Docker
# auto-creates missing bind-mount sources as root:root. Once fixed, drop
# privileges so the server itself never runs as root.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/server/data
  exec su-exec node "${@}"
fi

exec "${@}"
