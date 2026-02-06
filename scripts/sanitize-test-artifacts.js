#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/**
 * Sanitize test artifacts by redacting secrets and tokens.
 *
 * Usage:
 *   node scripts/sanitize-test-artifacts.js [.test-results] [test-results] [playwright-report] [logs]
 *
 * This script recursively walks the provided directories and replaces sensitive
 * values (API keys, tokens, secrets, common env vars) with ***REDACTED*** in
 * text-based files (log, txt, json, xml, md, html, yml, yaml, csv).
 */

import fs from 'fs/promises';
import path from 'path';

const TEXT_EXTENSIONS = new Set([

// Initialize log aggregation
const logAggregation = new LogAggregation();

  '.log', '.txt', '.json', '.xml', '.md', '.html', '.yml', '.yaml', '.csv'
]);

const DEFAULT_TARGETS = ['.test-results', 'test-results', 'playwright-report', 'logs'];

// Patterns to redact. Order matters: specific before generic.
const redactPatterns = [
  { name: 'OpenAIKey', regex: /sk-[a-zA-Z0-9]{32,}/g },
  { name: 'OpenAIAssistantKey', regex: /sk-ant-[a-zA-Z0-9]{32,}/g },
  { name: 'GitHubToken', regex: /ghp_[A-Za-z0-9]{36,}/g },
  { name: 'AWSAccessKeyId', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'BearerToken', regex: /Bearer\s+[A-Za-z0-9._-]{20,}/g },
  { name: 'VercelToken', regex: /vercel\s+token\s+[A-Za-z0-9._-]{20,}/gi },
  { name: 'UUIDSecrets', regex: /[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}/g },
  // Common env var assignments
  {
    name: 'EnvAssignments',
    regex: /(OPENAI_API_KEY|AZURE_OPENAI_API_KEY|AZURE_OPENAI_ENDPOINT|NEXTAUTH_SECRET|DATABASE_URL|REDIS_URL|POSTGRES_PASSWORD|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|GITHUB_TOKEN|GH_TOKEN|DD_API_KEY|VERCEL_TOKEN|LITELLM_API_KEY)\s*[:=]\s*(["']?)[^\n\"']+\2/gi
  },
  // Generic JSON env key patterns: "key": "..."
  {
    name: 'JsonLikeKeys',
    regex: new RegExp(
      '"(openai|azure|github|git|aws|vercel|token|secret|password|api[_-]?key)"\s*:\\s*"[^"\n]{6,}"',
      'gi'
    )
  }
];

function looksTextualByExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

async function isFile(filePath) {
  try {
    const st = await fs.stat(filePath);
    return st.isFile();
  } catch {
    return false;
  }
}

async function walk(dir, files = []) {
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const d of dirents) {
      const res = path.join(dir, d.name);
      if (d.isDirectory()) {
        await walk(res, files);
      } else if (d.isFile()) {
        files.push(res);
      }
    }
  } catch (e) {
    // ignore missing dirs
  }
  return files;
}

function sanitizeContent(content, counters) {
  let out = content;
  for (const { name, regex } of redactPatterns) {
    const before = out;
    out = out.replace(regex, (m) => {
      counters[name] = (counters[name] || 0) + 1;
      if (/^Bearer\s+/.test(m)) return 'Bearer ***REDACTED***';
      if (/^(vercel\s+token\s+)/i.test(m)) return 'vercel token ***REDACTED***';
      // Preserve key prefixes like AKIA, ghp_, sk-
      if (/^(AKIA|ghp_|sk-|sk-ant-)/.test(m)) return m.replace(/(.{3}).+/, '$1***REDACTED***');
      return '***REDACTED***';
    });
    if (before !== out) {
      // continue to next pattern with updated content
    }
  }
  return out;
}

async function processFile(filePath, summary) {
  // Only process textual files by extension; skip large files > 5MB
  try {
    const st = await fs.stat(filePath);
    if (st.size > 5 * 1024 * 1024) return; // skip large
  } catch {
    return;
  }
  if (!looksTextualByExt(filePath)) return;

  try {
    const buf = await fs.readFile(filePath);
    const content = buf.toString('utf8');
    const counters = {};
    const sanitized = sanitizeContent(content, counters);
    if (sanitized !== content) {
      await fs.writeFile(filePath, sanitized, 'utf8');
      summary.changedFiles++;
      for (const [k, v] of Object.entries(counters)) {
        summary.replacements[k] = (summary.replacements[k] || 0) + v;
      }
    }
  } catch {
    // ignore read/write errors for robustness
  }
}

async function main() {
  const targets = process.argv.slice(2);
  const dirs = targets.length ? targets : DEFAULT_TARGETS;

  const summary = { changedFiles: 0, replacements: {} };
  for (const dir of dirs) {
    const exists = await fs
      .stat(dir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (!exists) continue;
    const files = await walk(dir);
    for (const f of files) {
      await processFile(f, summary);
    }
  }

  // Print a concise summary for CI logs
  const replaced = Object.entries(summary.replacements)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  console.log(`Sanitizer complete. Files changed: ${summary.changedFiles}. Replacements: ${replaced || 'none'}`);
}

main().catch((err) => {
  console.error('Sanitizer failed:', err);
  process.exit(1);
});
