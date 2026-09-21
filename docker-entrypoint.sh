#!/bin/sh
set -e

DATA_DIR=/app/server/data

# The container starts as root so it can sort out ownership of the data
# directory, then drops privileges so the server itself never runs as root.
if [ "$(id -u)" = "0" ]; then
  # Run as whoever owns the data directory. A bind-mounted host directory keeps
  # its owner's uid, so the container never takes the host user's files away
  # from them. A root-owned directory (named volumes written by older
  # root-running images, bind-mount sources Docker auto-created as root:root)
  # is handed to node instead.
  owner="$(stat -c '%u:%g' "$DATA_DIR")"
  if [ "${owner%%:*}" = "0" ]; then
    owner="$(id -u node):$(id -g node)"
  fi

  # Heal only when something under data/ belongs to someone else (e.g. db files
  # an older root-running image left behind).
  if [ -n "$(find "$DATA_DIR" ! -user "${owner%%:*}" -print -quit 2>/dev/null)" ]; then
    # Best-effort: on volumes where chown is impossible (root_squash, read-only
    # mounts), start anyway rather than crash-looping.
    chown -hR "$owner" "$DATA_DIR" \
      || echo "warning: could not chown $DATA_DIR to $owner; starting as-is" >&2
  fi
  exec su-exec "$owner" "${@}"
fi

exec "${@}"
