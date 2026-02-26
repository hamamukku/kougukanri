#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/backend"

if command -v sqlc >/dev/null 2>&1; then
  SQLC_CMD=(sqlc)
else
  SQLC_CMD=(docker run --rm -v "${ROOT}/backend:/src" -w /src sqlc/sqlc:1.27.0)
fi

echo "[sqlc] version:"
"${SQLC_CMD[@]}" version
"${SQLC_CMD[@]}" generate
