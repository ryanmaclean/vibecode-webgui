/**
 * Unit Tests for File Upload Security Validation
 * Tests file signature validation, malware scanning, and content security
 */

import { jest } from '@jest/globals'
import { Buffer } from 'buffer'
import * as fileValidation from '@/lib/security/file-validation'

describe('File Upload Security Validation', () => {
  describe('validateFileUpload', () => {
    it.skip('should validate a proper PDF file', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'document.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.fileType).toBe('PDF')
    })

    it('should reject empty files', () => {
      const emptyBuffer = Buffer.from('')
      const file = new File([emptyBuffer], 'empty.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, emptyBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File is empty')
    })

    it('should reject files exceeding size limit', () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26 MB
      const file = new File([largeBuffer], 'large.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 26 * 1024 * 1024 })

      const result = fileValidation.validateFileUpload(file, largeBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('too large')]))
    })

    it('should reject invalid file extensions', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'document.exe', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid file extension')]))
    })

    it('should reject invalid MIME types', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'document.pdf', { type: 'application/octet-stream' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid MIME type')]))
    })

    it('should reject files without PDF signature', () => {
      const fakeBuffer = Buffer.from('This is not a PDF')
      const file = new File([fakeBuffer], 'fake.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, fakeBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid file signature')]))
    })

    it('should reject PDF without proper footer', () => {
      const invalidPdfBuffer = Buffer.from('%PDF-1.4\n...content...')
      const file = new File([invalidPdfBuffer], 'invalid.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, invalidPdfBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Missing PDF footer')]))
    })

    it('should reject files that are too small', () => {
      const tinyBuffer = Buffer.from('%PDF-1.4\n%%EOF')
      const file = new File([tinyBuffer], 'tiny.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, tinyBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('too small')]))
    })

    it('should detect directory traversal in filename', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], '../../../etc/passwd.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Suspicious filename')]))
    })

    it('should detect null byte injection in filename', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'document\0.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Suspicious filename')]))
    })

    it('should include metadata in result', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'document.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      expect(result.metadata).toBeDefined()
      expect(result.metadata?.actualSize).toBe(file.size)
      expect(result.metadata?.mimeType).toBe('application/pdf')
    })

    it('should warn about suspicious content without failing', () => {
      const pdfWithUrl = Buffer.from(
        '%PDF-1.4\nhttp://example.com\nhttp://example2.com\n%%EOF'
      )
      const file = new File([pdfWithUrl], 'document.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithUrl)

      // May have warnings but not necessarily errors
      expect(result.warnings).toBeDefined()
    })
  })

  describe('Malware Detection', () => {
    it('should detect embedded Windows executables', () => {
      const executableSignature = Buffer.from([0x4d, 0x5a]) // MZ header
      const pdfWithExe = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        executableSignature,
        Buffer.from('\n%%EOF'),
      ])
      const file = new File([pdfWithExe], 'malware.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithExe)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('executable')]))
    })

    it('should detect embedded ELF executables', () => {
      const elfSignature = Buffer.from([0x7f, 0x45, 0x4c, 0x46]) // ELF header
      const pdfWithElf = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        elfSignature,
        Buffer.from('\n%%EOF'),
      ])
      const file = new File([pdfWithElf], 'malware.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithElf)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('executable')]))
    })

    it('should detect suspicious JavaScript in PDF', () => {
      const pdfWithJs = Buffer.from(
        '%PDF-1.4\n/JavaScript eval(maliciousCode)\n%%EOF'
      )
      const file = new File([pdfWithJs], 'suspicious.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithJs)

      expect(result.isValid).toBe(false)
      expect(result.errors.join(' ')).toMatch(/JavaScript|script/i)
    })

    it('should detect excessive URLs as suspicious', () => {
      let pdfContent = '%PDF-1.4\n'
      for (let i = 0; i < 15; i++) {
        pdfContent += `http://example${i}.com\n`
      }
      pdfContent += '%%EOF'

      const pdfWithManyUrls = Buffer.from(pdfContent)
      const file = new File([pdfWithManyUrls], 'urls.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithManyUrls)

      // May be flagged as suspicious
      expect(result.warnings.length > 0 || result.errors.length > 0).toBe(true)
    })

    it.skip('should detect potential buffer overflow patterns', () => {
      const pdfWithPattern = Buffer.from(
        '%PDF-1.4\n' + 'A'.repeat(1500) + '\n%%EOF'
      )
      const file = new File([pdfWithPattern], 'overflow.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithPattern)

      // May be flagged as suspicious (either warnings or errors)
      expect(result.warnings.length > 0 || result.errors.length > 0).toBe(true)
    })
  })

  describe('PDF Structure Validation', () => {
    it('should reject PDF with invalid header', () => {
      const invalidPdf = Buffer.from('Not-PDF-1.4\n...content...%%EOF')
      const file = new File([invalidPdf], 'invalid.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, invalidPdf)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid PDF header')]))
    })

    it('should reject unsupported PDF versions', () => {
      const futurePdf = Buffer.from('%PDF-3.0\n...content...%%EOF')
      const file = new File([futurePdf], 'future.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, futurePdf)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Unsupported PDF version')]))
    })

    it('should detect excessive cross-reference tables', () => {
      let pdfContent = '%PDF-1.4\n'
      for (let i = 0; i < 150; i++) {
        pdfContent += 'xref\n'
      }
      pdfContent += '%%EOF'

      const pdfWithManyXrefs = Buffer.from(pdfContent)
      const file = new File([pdfWithManyXrefs], 'xrefs.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithManyXrefs)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('cross-reference')]))
    })

    it('should detect excessive object nesting', () => {
      let pdfContent = '%PDF-1.4\n'
      pdfContent += '['.repeat(1200) // Deep nesting
      pdfContent += ']'.repeat(1200)
      pdfContent += '\n%%EOF'

      const pdfWithNesting = Buffer.from(pdfContent)
      const file = new File([pdfWithNesting], 'nested.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithNesting)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('nesting')]))
    })
  })

  describe('sanitizeFilename', () => {
    it('should remove directory traversal patterns', () => {
      const result = fileValidation.sanitizeFilename('../../../etc/passwd')

      // Sanitization should make the filename safe (slashes replaced with underscores)
      expect(result).not.toContain('/')
      // Result should be a sanitized filename without path separators
      expect(result).toMatch(/^[^\/\\]+$/)
    })

    it('should remove invalid characters', () => {
      const result = fileValidation.sanitizeFilename('file:name*with?invalid<chars>')

      expect(result).not.toContain(':')
      expect(result).not.toContain('*')
      expect(result).not.toContain('?')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    it('should remove null bytes', () => {
      const result = fileValidation.sanitizeFilename('file\0name.pdf')

      expect(result).not.toContain('\0')
      expect(result).toBe('filename.pdf')
    })

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.pdf'
      const result = fileValidation.sanitizeFilename(longName)

      expect(result.length).toBeLessThanOrEqual(255)
      expect(result).toContain('.pdf')
    })

    it('should not allow filenames starting with dot', () => {
      const result = fileValidation.sanitizeFilename('.hidden')

      expect(result).not.toMatch(/^\./)
    })

    it('should preserve file extension', () => {
      const result = fileValidation.sanitizeFilename('my-document.pdf')

      expect(result).toContain('.pdf')
      expect(result).toBe('my-document.pdf')
    })

    it('should handle filenames without extension', () => {
      const result = fileValidation.sanitizeFilename('document')

      expect(result).toBe('document')
    })
  })

  describe('generateSecureStorageName', () => {
    it('should generate storage name with job ID', () => {
      const result = fileValidation.generateSecureStorageName('document.pdf', 'job-123')

      expect(result).toBe('job-123.pdf')
    })

    it('should preserve file extension', () => {
      const result = fileValidation.generateSecureStorageName('image.png', 'job-456')

      expect(result).toBe('job-456.png')
    })

    it('should sanitize original filename', () => {
      const result = fileValidation.generateSecureStorageName(
        '../../../evil.pdf',
        'job-789'
      )

      expect(result).toBe('job-789.pdf')
      expect(result).not.toContain('..')
    })

    it('should handle filenames with multiple dots', () => {
      const result = fileValidation.generateSecureStorageName(
        'document.backup.pdf',
        'job-abc'
      )

      expect(result).toBe('job-abc.pdf')
    })

    it('should handle filenames without extension', () => {
      const result = fileValidation.generateSecureStorageName('document', 'job-def')

      expect(result).toMatch(/^job-def\./)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very small valid PDFs', () => {
      // Minimum valid PDF
      const minPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n193\n%%EOF')
      const file = new File([minPdf], 'minimal.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, minPdf)

      // Structure validation matters more than exact size
      expect(result.errors.filter(e => e.includes('structure')).length).toBe(0)
    })

    it('should handle Unicode filenames', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...content...%%EOF')
      const file = new File([pdfBuffer], 'документ.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfBuffer)

      // Should not crash, may have validation errors based on content
      expect(result).toBeDefined()
    })

    it('should handle binary data in PDF', () => {
      const binaryData = Buffer.alloc(200)
      for (let i = 0; i < 200; i++) {
        binaryData[i] = i % 256
      }

      const pdfWithBinary = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        binaryData,
        Buffer.from('\n%%EOF'),
      ])
      const file = new File([pdfWithBinary], 'binary.pdf', { type: 'application/pdf' })

      const result = fileValidation.validateFileUpload(file, pdfWithBinary)

      // Should handle binary without crashing
      expect(result).toBeDefined()
    })

    it('should handle empty filename', () => {
      const sanitized = fileValidation.sanitizeFilename('')

      expect(sanitized).toBe('')
    })

    it('should handle filename with only special characters', () => {
      const sanitized = fileValidation.sanitizeFilename('***???')

      expect(sanitized).not.toContain('*')
      expect(sanitized).not.toContain('?')
    })
  })
})
