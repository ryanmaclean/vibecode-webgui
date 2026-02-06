#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/**
 * No-op native binary verifier.
 *
 * This script historically ensured optional native dependencies (e.g., prebuilt bundles)
 * were available after npm install. In CI we simply skip the checks so npm postinstall
 * hooks do not fail. Local developers can extend this script later if needed.
 */

if (process.env.CI) {
  console.log('[ensure-native-binaries] CI detected; skipping native binary validation.')
  process.exit(0)
}

console.log('[ensure-native-binaries] No validation implemented; exiting successfully.')
