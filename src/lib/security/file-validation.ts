/**
 * File Upload Security Validation
 * Provides comprehensive file content validation beyond MIME type checking
 */

import { Buffer } from 'buffer';

// File signatures (magic numbers) for validation
const FILE_SIGNATURES = {
  PDF: {
    signatures: [
      [0x25, 0x50, 0x44, 0x46], // %PDF
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedExtensions: ['.pdf']
  },
  // Add other file types as needed
} as const;

interface FileValidationResult {
  isValid: boolean;
  fileType?: string;
  errors: string[];
  warnings: string[];
  metadata?: {
    actualSize: number;
    detectedType: string;
    mimeType: string;
  };
}

interface ScanResult {
  isSafe: boolean;
  threats: string[];
  confidence: number;
}

/**
 * Validate file signature (magic numbers)
 */
function validateFileSignature(buffer: Buffer, expectedType: keyof typeof FILE_SIGNATURES): boolean {
  const typeConfig = FILE_SIGNATURES[expectedType];
  
  for (const signature of typeConfig.signatures) {
    if (buffer.length >= signature.length) {
      const fileStart = Array.from(buffer.subarray(0, signature.length));
      if (JSON.stringify(fileStart) === JSON.stringify(signature)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check for embedded executables or suspicious content
 */
function scanForMaliciousContent(buffer: Buffer): ScanResult {
  const threats: string[] = [];
  let confidence = 0;
  
  // Check for common executable signatures
  const executableSignatures = [
    [0x4D, 0x5A], // MZ (DOS/Windows executables)
    [0x7F, 0x45, 0x4C, 0x46], // ELF executables
    [0xCF, 0xFA, 0xED, 0xFE], // Mach-O executables (macOS)
    [0xFE, 0xED, 0xFA, 0xCE], // Mach-O executables (macOS, different endian)
  ];
  
  for (const signature of executableSignatures) {
    if (buffer.includes(Buffer.from(signature))) {
      threats.push('Embedded executable detected');
      confidence += 80;
    }
  }
  
  // Check for JavaScript in PDF (common attack vector)
  const jsPatterns = [
    '/JavaScript',
    '/JS',
    'eval(',
    'document.write',
    'window.open',
    'XMLHttpRequest'
  ];
  
  const bufferString = buffer.toString('ascii').toLowerCase();
  for (const pattern of jsPatterns) {
    if (bufferString.includes(pattern.toLowerCase())) {
      threats.push('Suspicious JavaScript content detected');
      confidence += 60;
    }
  }
  
  // Check for suspicious URLs
  const urlPatterns = [
    'http://',
    'https://',
    'ftp://',
    'javascript:',
    'data:',
    'vbscript:'
  ];
  
  let urlCount = 0;
  for (const pattern of urlPatterns) {
    const matches = bufferString.split(pattern.toLowerCase()).length - 1;
    urlCount += matches;
  }
  
  if (urlCount > 10) {
    threats.push('Excessive URL references detected');
    confidence += 40;
  }
  
  // Check for potential buffer overflow patterns
  const suspiciousPatterns = [
    'A'.repeat(1000), // Long repetitive strings
    Buffer.alloc(1000, 0x90).toString('hex'), // NOP sleds
    '%u', // Unicode escape sequences
    '\\x', // Hex escape sequences
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (bufferString.includes(pattern)) {
      threats.push('Potential exploit pattern detected');
      confidence += 50;
    }
  }
  
  return {
    isSafe: confidence < 60, // Threshold for determining if file is safe
    threats,
    confidence
  };
}

/**
 * Validate PDF structure
 */
function validatePDFStructure(buffer: Buffer): string[] {
  const errors: string[] = [];
  const content = buffer.toString('ascii');
  
  // Check for required PDF structure
  if (!content.includes('%PDF-')) {
    errors.push('Invalid PDF header');
  }
  
  if (!content.includes('%%EOF')) {
    errors.push('Missing PDF footer');
  }
  
  // Check for PDF version
  const versionMatch = content.match(/%PDF-(\d+\.\d+)/);
  if (versionMatch) {
    const version = parseFloat(versionMatch[1]);
    if (version > 2.0) {
      errors.push('Unsupported PDF version');
    }
  }
  
  // Check for excessive cross-reference tables (potential DoS)
  const xrefCount = (content.match(/xref/g) || []).length;
  if (xrefCount > 100) {
    errors.push('Excessive cross-reference tables detected');
  }
  
  // Check for deeply nested objects (potential DoS)
  let nesting = 0;
  let maxNesting = 0;
  for (const char of content) {
    if (char === '[' || char === '<' || char === '(') {
      nesting++;
      maxNesting = Math.max(maxNesting, nesting);
    } else if (char === ']' || char === '>' || char === ')') {
      nesting--;
    }
  }
  
  if (maxNesting > 1000) {
    errors.push('Excessive object nesting detected');
  }
  
  return errors;
}

/**
 * Comprehensive file validation
 */
export function validateFileUpload(file: File, buffer: Buffer): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate file size
  if (file.size === 0) {
    errors.push('File is empty');
  }
  
  if (file.size > FILE_SIGNATURES.PDF.maxSize) {
    errors.push(`File too large. Maximum size: ${FILE_SIGNATURES.PDF.maxSize} bytes`);
  }
  
  // Validate file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = FILE_SIGNATURES.PDF.allowedExtensions.some(ext => 
    fileName.endsWith(ext)
  );
  
  if (!hasValidExtension) {
    errors.push('Invalid file extension. Only PDF files are allowed');
  }
  
  // Validate MIME type
  if (file.type !== 'application/pdf') {
    errors.push('Invalid MIME type. Expected application/pdf');
  }
  
  // Validate file signature
  if (!validateFileSignature(buffer, 'PDF')) {
    errors.push('Invalid file signature. File may be corrupted or not a valid PDF');
  }
  
  // Validate PDF structure
  const pdfErrors = validatePDFStructure(buffer);
  errors.push(...pdfErrors);
  
  // Scan for malicious content
  const scanResult = scanForMaliciousContent(buffer);
  if (!scanResult.isSafe) {
    errors.push(`Security scan failed: ${scanResult.threats.join(', ')}`);
  }
  
  if (scanResult.threats.length > 0 && scanResult.confidence < 60) {
    warnings.push(`Potential security concerns: ${scanResult.threats.join(', ')}`);
  }
  
  // Additional size validation based on content
  const expectedMinSize = 100; // Minimum viable PDF size
  if (file.size < expectedMinSize) {
    errors.push('File too small to be a valid PDF');
  }
  
  // Check for filename manipulation attempts
  const suspiciousFileNamePatterns = [
    '../', // Directory traversal
    '..\\\\', // Windows directory traversal
    '\0', // Null byte injection
    '<script', // HTML/JS injection
  ];
  
  for (const pattern of suspiciousFileNamePatterns) {
    if (file.name.includes(pattern)) {
      errors.push('Suspicious filename detected');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    fileType: 'PDF',
    errors,
    warnings,
    metadata: {
      actualSize: file.size,
      detectedType: validateFileSignature(buffer, 'PDF') ? 'PDF' : 'Unknown',
      mimeType: file.type
    }
  };
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory traversal patterns
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const parts = sanitized.split('.');
    const hasExtension = parts.length > 1 && parts[parts.length - 1].length <= 10;

    if (hasExtension) {
      const ext = parts.pop()!;
      const name = parts.join('.').substring(0, 255 - ext.length - 1);
      sanitized = `${name}.${ext}`;
    } else {
      sanitized = sanitized.substring(0, 255);
    }
  }
  
  // Ensure it doesn't start with a dot (hidden file)
  if (sanitized.startsWith('.')) {
    sanitized = '_' + sanitized.substring(1);
  }
  
  return sanitized;
}

/**
 * Generate secure file storage name
 */
export function generateSecureStorageName(originalName: string, jobId: string): string {
  const sanitizedName = sanitizeFilename(originalName);
  const ext = sanitizedName.split('.').pop();
  return `${jobId}.${ext}`;
}