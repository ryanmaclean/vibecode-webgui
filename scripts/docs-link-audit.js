#!/usr/bin/env node
/**
 * Static link audit for Astro docs output.
 * Scans docs/dist for internal href/src references that do not resolve.
 */

const fs = require('fs');
const path = require('path');

const distRoot = path.resolve(__dirname, '..', 'docs', 'dist');
const siteBase = process.env.DOCS_SITE_BASE || 'vibecode-webgui';
const EXTERNAL_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'data', 'javascript', 'vscode', 'about']);

if (!fs.existsSync(distRoot)) {
  console.error('docs-link-audit: docs/dist not found. Run "npm run build" inside docs/ first.');
  process.exit(1);
}

/** @param {string} dir */
function getHtmlFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

/** Normalize link into filesystem path inside docs/dist */
function resolveLink(htmlFile, rawLink) {
  const trimmed = rawLink.split('#')[0].split('?')[0].trim();
  if (!trimmed) return null;
  if (trimmed.includes('{') || trimmed.includes('}')) return null;

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (EXTERNAL_PROTOCOLS.has(scheme)) return null;
  }
  if (trimmed.startsWith('//')) return null;

  let candidate;
  if (trimmed.startsWith('/')) {
    let relative = trimmed.replace(/^\/+/, '');
    if (siteBase && relative.startsWith(siteBase + '/')) {
      relative = relative.slice(siteBase.length + 1);
    }
    candidate = path.join(distRoot, relative);
  } else {
    candidate = path.resolve(path.dirname(htmlFile), trimmed);
  }

  // Ensure candidate stays within docs/dist
  if (!candidate.startsWith(distRoot)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return path.join(candidate, 'index.html');
  }

  if (!path.extname(candidate)) {
    const asHtml = `${candidate}.html`;
    if (fs.existsSync(asHtml)) return asHtml;
    const asIndex = path.join(candidate, 'index.html');
    if (fs.existsSync(asIndex)) return asIndex;
  }

  return candidate;
}

const htmlFiles = getHtmlFiles(distRoot);
const missing = [];
const linkPattern = /(href|src)=("|')([^"'#?]+(?:\?[^"'#]*)?)("|')/g;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const target = resolveLink(file, match[3]);
    if (!target) continue;
    if (!fs.existsSync(target)) {
      missing.push({ file, link: match[3], resolved: target });
    }
  }
}

if (missing.length) {
  console.error(`docs-link-audit: Found ${missing.length} missing link${missing.length === 1 ? '' : 's'}.`);
  for (const issue of missing.slice(0, 50)) {
    console.error(`  - ${path.relative(distRoot, issue.file)} -> ${issue.link} (expected ${path.relative(distRoot, issue.resolved)})`);
  }
  if (missing.length > 50) {
    console.error(`  …and ${missing.length - 50} more`);
  }
  process.exit(1);
}

console.log('docs-link-audit: All links resolved inside docs/dist.');
