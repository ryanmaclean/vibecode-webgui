# Archived Root-Level Test Scripts

This directory contains manual test and debugging scripts that were previously located in the project root.

## Purpose

These files were used during development for:
- Manual database connection testing
- RAG (Retrieval-Augmented Generation) workflow verification
- Datadog monitoring integration debugging
- Vector database functionality testing

## Why Archived?

These scripts were moved out of the project root to:
1. Reduce root directory clutter
2. Maintain clean project structure
3. Preserve historical development/debugging tools without polluting the main codebase
4. Follow the repository organization standards

## Contents

### Database Connection Tests
- `test-connection-simple.cjs` - Simple PostgreSQL connection test
- `test-connection-detailed.cjs` - Detailed connection diagnostics
- `test-postgres-connection.cjs` - PostgreSQL-specific connection test

### RAG/Vector Tests
- `test-rag-basic.ts` - Basic RAG workflow test
- `test-rag-simple.cjs` - Simplified RAG test
- `test-rag-connection.cjs` - RAG connection test
- `test-rag-datadog.cjs` - RAG with Datadog monitoring
- `test-rag-direct-sql.ts` - Direct SQL RAG test
- `test-rag-manual.ts` - Manual RAG testing script
- `test-real-rag.cjs` - Real RAG workflow test
- `test-vector-db.js` - Vector database test

### Monitoring Tests
- `test-datadog-api.js` - Datadog API integration test
- `test-datadog-api.cjs` - Datadog API CommonJS test
- `test-db-metrics-simple.js` - Simple database metrics test

### Other
- `test-roundtable-mcp.sh` - Roundtable MCP testing script

## Current Test Location

For current, maintained tests, see:
- `tests/` - Jest/Playwright test suites
- `scripts/tests/` - Shell script test harnesses
- `tests/manual/` - Current manual testing scripts

## Date Archived

These files were archived as part of the shell script consolidation effort tracked in issue: "Consolidate shell script bootstrap and clean root-level clutter"
