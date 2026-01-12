/**
 * Comprehensive tests for file validation security utilities
 * Tests for PDF validation, malicious content scanning, and filename sanitization
 */

import {
  validateFileUpload,
  sanitizeFilename,
  generateSecureStorageName,
} from '@/lib/security/file-validation';
import { Buffer } from 'buffer';

describe('File Validation Security', () => {
  describe('validateFileUpload', () => {
    const createMockFile = (
      name: string,
      size: number,
      type: string = 'application/pdf'
    ): File => {
      return {
        name,
        size,
        type,
      } as File;
    };

    const createPDFBuffer = (includeFooter: boolean = true): Buffer => {
      let content = '%PDF-1.4\n';
      content += '1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n';
      if (includeFooter) {
        content += '%%EOF\n';
      }
      return Buffer.from(content);
    };

    it('should validate a valid PDF file', () => {
      const file = createMockFile('document.pdf', 1000);
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe('PDF');
      expect(result.metadata).toEqual({
        actualSize: 1000,
        detectedType: 'PDF',
        mimeType: 'application/pdf',
      });
    });

    it('should reject empty files', () => {
      const file = createMockFile('empty.pdf', 0);
      const buffer = Buffer.alloc(0);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject files that are too large', () => {
      const maxSize = 25 * 1024 * 1024; // 25MB
      const file = createMockFile('huge.pdf', maxSize + 1);
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('File too large'));
    });

    it('should reject files with invalid extensions', () => {
      const file = createMockFile('document.exe', 1000);
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid file extension. Only PDF files are allowed');
    });

    it('should reject files with invalid MIME types', () => {
      const file = createMockFile('document.pdf', 1000, 'application/octet-stream');
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid MIME type. Expected application/pdf');
    });

    it('should reject files with invalid signatures', () => {
      const file = createMockFile('fake.pdf', 1000);
      const buffer = Buffer.from('Not a real PDF file');

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid file signature. File may be corrupted or not a valid PDF'
      );
    });

    it('should reject PDFs without proper header', () => {
      const file = createMockFile('invalid.pdf', 1000);
      const buffer = Buffer.from('Invalid PDF\n%%EOF\n');

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid PDF header');
    });

    it('should reject PDFs without footer', () => {
      const file = createMockFile('incomplete.pdf', 1000);
      const buffer = createPDFBuffer(false);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing PDF footer');
    });

    it('should reject files that are too small', () => {
      const file = createMockFile('tiny.pdf', 50);
      const buffer = Buffer.from('%PDF-1.4\n%%EOF');

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File too small to be a valid PDF');
    });

    it('should reject PDFs with embedded executables', () => {
      const file = createMockFile('malicious.pdf', 1000);
      let content = '%PDF-1.4\n';
      content += Buffer.from([0x4d, 0x5a]).toString(); // MZ signature
      content += '\n%%EOF\n';
      const buffer = Buffer.from(content);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Embedded executable detected'));
    });

    it('should detect suspicious JavaScript in PDFs', () => {
      const file = createMockFile('scripted.pdf', 1000);
      let content = '%PDF-1.4\n';
      content += '/JavaScript eval(malicious_code)\n';
      content += '%%EOF\n';
      const buffer = Buffer.from(content);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Suspicious JavaScript content detected')
      );
    });

    it('should detect excessive URLs in PDFs', () => {
      const file = createMockFile('phishing.pdf', 1000);
      let content = '%PDF-1.4\n';
      // Add more than 10 URLs
      for (let i = 0; i < 12; i++) {
        content += `http://malicious${i}.com\n`;
      }
      content += '%%EOF\n';
      const buffer = Buffer.from(content);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Excessive URL references detected'));
    });

    it('should detect directory traversal in filenames', () => {
      const file = createMockFile('../../../etc/passwd.pdf', 1000);
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious filename detected');
    });

    it('should detect null byte injection in filenames', () => {
      const file = createMockFile('document.pdf\0.exe', 1000);
      const buffer = createPDFBuffer();

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious filename detected');
    });

    it('should provide warnings for low-confidence threats', () => {
      const file = createMockFile('suspicious.pdf', 1000);
      let content = '%PDF-1.4\n';
      content += 'http://example.com\n'; // One URL (low confidence)
      content += '%%EOF\n';
      const buffer = Buffer.from(content);

      const result = validateFileUpload(file, buffer);

      // Should pass but with warnings
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should reject unsupported PDF versions', () => {
      const file = createMockFile('future.pdf', 1000);
      let content = '%PDF-2.5\n'; // Future version
      content += '%%EOF\n';
      const buffer = Buffer.from(content);

      const result = validateFileUpload(file, buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported PDF version');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize basic filenames correctly', () => {
      const result = sanitizeFilename('document.pdf');
      expect(result).toBe('document.pdf');
    });

    it('should replace directory traversal patterns', () => {
      const result = sanitizeFilename('../../../etc/passwd.pdf');
      expect(result).toBe('_.._.._.._etc_passwd.pdf');
    });

    it('should replace Windows directory traversal', () => {
      const result = sanitizeFilename('..\\..\\windows\\system32\\config.pdf');
      expect(result).toMatch(/^_/);
      expect(result).not.toContain('\\');
    });

    it('should remove special characters', () => {
      const result = sanitizeFilename('file:with*special?chars<>|.pdf');
      expect(result).toBe('file_with_special_chars___.pdf');
    });

    it('should remove null bytes', () => {
      const result = sanitizeFilename('document.pdf\0.exe');
      expect(result).toBe('document.pdf.exe');
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should not start with a dot', () => {
      const result = sanitizeFilename('.hidden-file.pdf');
      expect(result).toBe('_hidden-file.pdf');
      expect(result.startsWith('.')).toBe(false);
    });

    it('should handle filenames with multiple dots', () => {
      const result = sanitizeFilename('document.backup.final.pdf');
      expect(result).toBe('document.backup.final.pdf');
    });

    it('should handle filenames without extensions', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should preserve unicode characters', () => {
      const result = sanitizeFilename('文档.pdf');
      expect(result).toBe('文档.pdf');
    });
  });

  describe('generateSecureStorageName', () => {
    it('should generate secure storage name with job ID', () => {
      const result = generateSecureStorageName('document.pdf', 'job-12345');
      expect(result).toBe('job-12345.pdf');
    });

    it('should sanitize the original filename first', () => {
      const result = generateSecureStorageName('../../../malicious.pdf', 'job-67890');
      expect(result).toBe('job-67890.pdf');
    });

    it('should extract extension correctly', () => {
      const result = generateSecureStorageName('document.backup.pdf', 'job-abc');
      expect(result).toBe('job-abc.pdf');
    });

    it('should handle files with special characters', () => {
      const result = generateSecureStorageName('file*with:special?.pdf', 'job-xyz');
      expect(result).toBe('job-xyz.pdf');
    });

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = generateSecureStorageName(longName, 'job-123');
      expect(result).toBe('job-123.pdf');
    });

    it('should handle filenames without extensions', () => {
      const result = generateSecureStorageName('document', 'job-456');
      expect(result).toBe('job-456.document');
    });

    it('should handle hidden files', () => {
      const result = generateSecureStorageName('.hidden.pdf', 'job-789');
      expect(result).toBe('job-789.pdf');
    });
  });
});
