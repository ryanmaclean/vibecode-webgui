#!/usr/bin/env bash
# Start PostgreSQL VM - Database with pgvector for VibeCode
# Port: 5432
# Memory: 2GB
# Features: pgvector extension, full-text search

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/vm-manager.sh" start postgresql
