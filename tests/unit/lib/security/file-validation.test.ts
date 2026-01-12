/**
 * File Validation Security Tests
 * Tests comprehensive file upload validation logic
 */

import { Buffer } from 'buffer';
import {
  validateFileUpload,
  sanitizeFilename,
  generateSecureStorageName,
} from '@/lib/security/file-validation';

// Mock File class for Node.js environment
class MockFile {
  name: string;
  size: number;
  type: string;

  constructor(name: string, size: number, type: string) {
    this.name = name;
    this.size = size;
    this.type = type;
  }
}

// Helper to create a valid PDF buffer
function createValidPDFBuffer(): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
198
%%EOF`;

  return Buffer.from(pdfContent);
}

describe('File Validation Security', () => {
  describe('sanitizeFilename', () => {
    it('should remove directory traversal patterns', () => {
      expect(sanitizeFilename('../../../etc/passwd')).not.toContain('../');
    });

    it('should remove dangerous characters', () => {
      const dangerous = 'file:name<with>dangerous|chars*.pdf';
      const sanitized = sanitizeFilename(dangerous);

      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('|');
      expect(sanitized).not.toContain('*');
    });

    it('should remove null bytes', () => {
      const filename = 'document.pdf\0.txt';
      const sanitized = sanitizeFilename(filename);

      expect(sanitized).not.toContain('\0');
    });

    it('should limit filename length to 255 characters', () => {
      const longFilename = 'a'.repeat(300) + '.pdf';
      const sanitized = sanitizeFilename(longFilename);

      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });

    it('should not allow hidden files (starting with dot)', () => {
      const hiddenFile = '.hidden_config';
      const sanitized = sanitizeFilename(hiddenFile);

      expect(sanitized.startsWith('.')).toBe(false);
      expect(sanitized.startsWith('_')).toBe(true);
    });

    it('should preserve valid filenames', () => {
      const validFilename = 'my_document_2024.pdf';
      const sanitized = sanitizeFilename(validFilename);

      expect(sanitized).toBe(validFilename);
    });
  });

  describe('generateSecureStorageName', () => {
    it('should generate secure name with job ID', () => {
      const originalName = 'document.pdf';
      const jobId = 'job-12345';

      const secureName = generateSecureStorageName(originalName, jobId);

      expect(secureName).toBe('job-12345.pdf');
      expect(secureName).toContain(jobId);
      expect(secureName.endsWith('.pdf')).toBe(true);
    });

    it('should sanitize filename before using it', () => {
      const maliciousName = '../../../etc/passwd.pdf';
      const jobId = 'job-67890';

      const secureName = generateSecureStorageName(maliciousName, jobId);

      expect(secureName).not.toContain('../');
      expect(secureName).toBe('job-67890.pdf');
    });

    it('should preserve file extension', () => {
      const originalName = 'document.docx';
      const jobId = 'job-abc';

      const secureName = generateSecureStorageName(originalName, jobId);

      expect(secureName.endsWith('.docx')).toBe(true);
    });
  });

  describe('validateFileUpload', () => {
    it('should accept a valid PDF file', () => {
      const file = new MockFile('document.pdf', 500, 'application/pdf') as unknown as File;
      const buffer = createValidPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe('PDF');
      expect(result.metadata).toBeDefined();
    });

    it('should reject empty files', () => {
      const file = new MockFile('document.pdf', 0, 'application/pdf') as unknown as File;
      const buffer = Buffer.from('');

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject files with invalid extension', () => {
      const file = new MockFile('document.txt', 500, 'application/pdf') as unknown as File;
      const buffer = createValidPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid file extension'))).toBe(true);
    });

    it('should detect suspicious filenames', () => {
      const file = new MockFile('../../../etc/passwd.pdf', 500, 'application/pdf') as unknown as File;
      const buffer = createValidPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Suspicious filename'))).toBe(true);
    });
  });
});
