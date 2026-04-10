#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8080}"

cd "$ROOT_DIR"

echo "[Stock Window Compare]"
echo "root: $ROOT_DIR"
echo "port: $PORT"
echo "url : http://localhost:$PORT"

echo
PORT="$PORT" python3 server.py
