#!/usr/bin/env node
/**
 * Parse JUnit XML files in .test-results and produce a concise summary.
 * Outputs:
 *  - .test-results/summary.json
 *  - .test-results/summary.md
 */

import fs from 'fs/promises';
import path from 'path';

const RESULTS_DIR = '.test-results';
const FILES = [
  'junit-root.xml',
  'junit-docs.xml',
  'playwright/junit-playwright.xml',
];

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseAttributes(tag) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function parseJUnit(xml) {
  const summary = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  const failedTests = [];

  // Try <testsuites ...>
  const suitesTag = xml.match(/<testsuites\b[^>]*>/);
  if (suitesTag) {
    const attrs = parseAttributes(suitesTag[0]);
    summary.tests += Number(attrs.tests || 0);
    summary.failures += Number(attrs.failures || 0);
    summary.errors += Number(attrs.errors || 0);
    summary.skipped += Number(attrs.skipped || 0);
  } else {
    // Sum over <testsuite ...>
    const tsRe = /<testsuite\b[^>]*>/g;
    let m;
    while ((m = tsRe.exec(xml))) {
      const attrs = parseAttributes(m[0]);
      summary.tests += Number(attrs.tests || 0);
      summary.failures += Number(attrs.failures || 0);
      summary.errors += Number(attrs.errors || 0);
      summary.skipped += Number(attrs.skipped || 0);
    }
  }

  // Collect failed testcases
  const tcRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  let m;
  while ((m = tcRe.exec(xml))) {
    const attrs = parseAttributes(`<x ${m[1]}>`);
    const body = m[2] || '';
    if (body.includes('<failure') || body.includes('<error')) {
      const failMatch = body.match(/<(failure|error)\b[^>]*?message="([^"]*)"[^>]*>([\s\S]*?)<\/(failure|error)>/);
      const message = failMatch ? failMatch[2] : 'Failure/Error';
      const details = failMatch ? (failMatch[3] || '').trim().slice(0, 500) : '';
      failedTests.push({
        name: attrs.name || 'unknown',
        classname: attrs.classname || attrs.file || 'unknown',
        time: attrs.time ? Number(attrs.time) : undefined,
        message,
        details,
      });
    }
  }

  return { summary, failedTests };
}

function toMarkdown(all) {
  const lines = [];
  lines.push('# Local Test Results Summary');
  lines.push('');
  for (const item of all) {
    lines.push(`## ${item.label}`);
    const s = item.data.summary;
    lines.push(`- **Tests**: ${s.tests}`);
    lines.push(`- **Failures**: ${s.failures}`);
    lines.push(`- **Errors**: ${s.errors}`);
    lines.push(`- **Skipped**: ${s.skipped}`);
    if (item.data.failedTests.length) {
      lines.push('- **Top Failures**:');
      const top = item.data.failedTests.slice(0, 15);
      for (const f of top) {
        const title = `${f.classname} :: ${f.name}`.trim();
        lines.push(`  - ${title} — ${f.message}`);
      }
    } else {
      lines.push('- **Top Failures**: none');
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const results = [];
  for (const f of FILES) {
    const p = path.join(RESULTS_DIR, f);
    if (!(await fileExists(p))) continue;
    try {
      const xml = await fs.readFile(p, 'utf8');
      const data = parseJUnit(xml);
      results.push({ label: f, data });
    } catch (e) {
      results.push({ label: f, error: String(e) });
    }
  }

  // Aggregate overall
  const agg = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  for (const r of results) {
    if (!r.data) continue;
    agg.tests += r.data.summary.tests;
    agg.failures += r.data.summary.failures;
    agg.errors += r.data.summary.errors;
    agg.skipped += r.data.summary.skipped;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    overall: agg,
    results,
  };

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(path.join(RESULTS_DIR, 'summary.json'), JSON.stringify(out, null, 2), 'utf8');
  await fs.writeFile(path.join(RESULTS_DIR, 'summary.md'), toMarkdown(results), 'utf8');
  console.log('Wrote .test-results/summary.json and .test-results/summary.md');
}

main().catch((err) => {
  console.error('Failed to parse JUnit:', err);
  process.exit(1);
});
