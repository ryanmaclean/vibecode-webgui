/**
 * Input Sanitization Utilities
 *
 * Provides reusable sanitization functions for API input validation.
 * Helps prevent XSS, SQL injection, and other security vulnerabilities.
 */

/**
 * Remove HTML tags from a string to prevent XSS
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(input: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return input.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char)
}

/**
 * Remove control characters (ASCII 0-31, except tabs and newlines)
 */
export function stripControlCharacters(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Normalize whitespace (collapse multiple spaces/newlines)
 */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

/**
 * Remove null bytes (potential security risk in file paths)
 */
export function stripNullBytes(input: string): string {
  return input.replace(/\0/g, '')
}

/**
 * Sanitize a string for safe use in file paths
 * Removes directory traversal sequences and unsafe characters
 */
export function sanitizeFilePath(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove directory traversal
    .replace(/\.\./g, '')
    // Remove leading/trailing slashes
    .replace(/^[\/\\]+|[\/\\]+$/g, '')
    // Replace multiple slashes with single
    .replace(/[\/\\]+/g, '/')
    // Remove shell metacharacters
    .replace(/[;|&`$()<>]/g, '')
}

/**
 * Sanitize a string for safe use in file names
 * More restrictive than sanitizeFilePath
 */
export function sanitizeFileName(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove directory separators
    .replace(/[\/\\]/g, '')
    // Remove directory traversal
    .replace(/\.\./g, '')
    // Remove shell metacharacters
    .replace(/[;|&`$()<>]/g, '')
    // Remove other unsafe characters
    .replace(/[<>:"|?*]/g, '')
    // Limit length
    .slice(0, 255)
}

/**
 * Sanitize a workspace/project ID
 * Only allows alphanumeric, hyphens, and underscores
 */
export function sanitizeId(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100)
}

/**
 * Sanitize a search query string
 * Removes potentially dangerous characters while preserving search intent
 */
export function sanitizeSearchQuery(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length
    .slice(0, 500)
}

/**
 * Sanitize a URL string
 * Validates and normalizes URLs
 */
export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Sanitize an email address
 * Basic validation and normalization
 */
export function sanitizeEmail(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .slice(0, 255)
}

/**
 * Sanitize user-provided code content
 * Strips dangerous sequences while preserving valid code
 */
export function sanitizeCodeContent(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip non-printable characters except tabs and newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/**
 * Sanitize JSON data by recursively processing strings
 */
export function sanitizeJsonStrings<T>(data: T, sanitizer: (s: string) => string = stripControlCharacters): T {
  if (typeof data === 'string') {
    return sanitizer(data) as T
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJsonStrings(item, sanitizer)) as T
  }
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeJsonStrings(value, sanitizer)
    }
    return result as T
  }
  return data
}

/**
 * Comprehensive sanitization for general user text input
 */
export function sanitizeUserInput(input: string): string {
  return stripControlCharacters(stripNullBytes(input)).trim()
}

/**
 * Sanitize tags/labels array
 */
export function sanitizeTags(tags: string[], maxCount = 20, maxLength = 50): string[] {
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim().slice(0, maxLength))
    .filter(tag => tag.length > 0)
    .slice(0, maxCount)
}

/**
 * Sanitize a description or text field
 */
export function sanitizeDescription(input: string, maxLength = 1000): string {
  return stripControlCharacters(stripNullBytes(input))
    .trim()
    .slice(0, maxLength)
}

/**
 * Type-safe sanitization result
 */
export interface SanitizationResult<T> {
  value: T
  modified: boolean
  warnings: string[]
}

/**
 * Sanitize with detailed result tracking
 */
export function sanitizeWithDetails(input: string): SanitizationResult<string> {
  const warnings: string[] = []
  let value = input
  const original = input

  // Check for null bytes
  if (value.includes('\0')) {
    warnings.push('Null bytes removed')
    value = stripNullBytes(value)
  }

  // Check for control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
    warnings.push('Control characters removed')
    value = stripControlCharacters(value)
  }

  // Check for HTML tags
  if (/<[^>]*>/.test(value)) {
    warnings.push('HTML tags detected (not removed)')
  }

  return {
    value,
    modified: value !== original,
    warnings
  }
}
