/**
 * VM Security Utilities
 * Input validation for VM paths, URLs, and names to prevent
 * path traversal, SSRF, and other injection attacks.
 */

import * as path from 'path';

/** Allowed characters for VM names: alphanumeric, hyphens, underscores, dots (no leading dot) */
const VM_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** Allowed download domains for VM images */
const ALLOWED_DOWNLOAD_HOSTS = [
  'dl-cdn.alpinelinux.org',
];

/**
 * Validate a VM name to prevent path traversal.
 * Rejects names containing path separators, "..", or other dangerous characters.
 */
export function validateVMName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('VM name must be a non-empty string');
  }

  if (name.length > 128) {
    throw new Error('VM name must be 128 characters or fewer');
  }

  if (!VM_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid VM name "${name}": must start with alphanumeric and contain only alphanumeric, hyphens, underscores, or dots`
    );
  }

  if (name.includes('..')) {
    throw new Error(`Invalid VM name "${name}": must not contain "..""`);
  }

  return name;
}

/**
 * Validate that a resolved path is within the expected base directory.
 * Prevents path traversal attacks via ".." or symlinks.
 */
export function validateVMPath(basePath: string, userPath: string): string {
  const resolved = path.resolve(basePath, userPath);
  const normalizedBase = path.resolve(basePath);

  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error(
      `Path traversal detected: "${userPath}" resolves outside base directory`
    );
  }

  return resolved;
}

/**
 * Validate a download URL is from an allowed host and uses HTTPS.
 * Prevents SSRF by restricting to known-safe Alpine CDN domains.
 */
export function validateDownloadUrl(url: string): URL {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new Error(`Invalid URL protocol "${parsed.protocol}": only HTTPS is allowed`);
  }

  if (!ALLOWED_DOWNLOAD_HOSTS.includes(parsed.hostname)) {
    throw new Error(
      `Invalid download host "${parsed.hostname}": allowed hosts are ${ALLOWED_DOWNLOAD_HOSTS.join(', ')}`
    );
  }

  return parsed;
}
