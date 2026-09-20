#!/bin/sh
set -e

# The container starts as root so it can fix ownership of the data directory:
# named volumes keep ownership from when older images ran as root, and Docker
# auto-creates missing bind-mount sources as root:root. Once fixed, drop
# privileges so the server itself never runs as root.
if [ "$(id -u)" = "0" ]; then
  # Heal only when something under data/ isn't node-owned (volumes written by
  # older root-running images, bind-mount sources Docker created as root:root).
  if [ -n "$(find /app/server/data ! -user node -print -quit 2>/dev/null)" ]; then
    # Best-effort: on volumes where chown is impossible (root_squash, read-only
    # mounts), start anyway rather than crash-looping.
    chown -R node:node /app/server/data 2>/dev/null \
      || echo "warning: could not chown /app/server/data; starting as-is" >&2
  fi
  exec su-exec node "${@}"
fi

exec "${@}"
