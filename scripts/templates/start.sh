#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Optional: copy `.env.example` to `.env` and edit before launch to override.
if [ -f "$DIR/.env" ]; then
  set -a
  . "$DIR/.env"
  set +a
fi

export MDCZ_WEB_DIST_DIR="${MDCZ_WEB_DIST_DIR:-$DIR/web}"
export PORT="${PORT:-3838}"
export MDCZ_HOST="${MDCZ_HOST:-127.0.0.1}"

exec node "$DIR/server.js" "$@"
