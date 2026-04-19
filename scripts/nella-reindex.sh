#!/usr/bin/env bash
# nella-reindex — rebuild the local nella workspace index from the PQR corpus.
#
# Steps:
#   1. Export redacted PQRs to fixtures/pqr-corpus/ (one .md per PQR).
#   2. Run `nella index --workspace ./fixtures/pqr-corpus --force` to
#      rebuild nella's vector/keyword index on top of the fresh export.
#
# Pre-requisites:
#   - nella CLI on PATH (install via `brew install nella` or equivalent)
#   - Supabase env vars exported (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
#   - `nella auth login` has been run once (see docs/nella-indexing.md)
#
# This script is ship-ready but the integration tests deliberately do NOT
# invoke `nella index` — we want a clean local dev loop without requiring
# the CLI for every developer.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[nella-reindex] Exporting PQR corpus with PII redaction..."
pnpm dlx tsx scripts/export-pqr-corpus.ts "$@"

echo "[nella-reindex] Verifying no PII leaked into the export..."
pnpm dlx tsx scripts/verify-nella-index.ts

if ! command -v nella >/dev/null 2>&1; then
  echo "[nella-reindex] ERROR: nella CLI not found on PATH. Install it and run 'nella auth login'." >&2
  exit 1
fi

echo "[nella-reindex] Rebuilding nella index..."
nella index --workspace ./fixtures/pqr-corpus --force

echo "[nella-reindex] Done."
