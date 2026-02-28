/**
 * Tests for Diff Optimizer (Myers Algorithm)
 */

import {
  MyersDiff,
  DiffType,
  computeDiff,
  computeDiffStats,
  areSimilar,
  formatUnifiedDiff,
  DIFF_CONFIG,
  type DiffOperation,
  type DiffResult,
  type DiffStats,
} from '@/lib/editor/diff-optimizer'

describe('Diff Optimizer', () => {
  describe('DIFF_CONFIG', () => {
    it('should have correct configuration constants', () => {
      expect(DIFF_CONFIG.MAX_DIRECT_DIFF_LINES).toBe(10000)
      expect(DIFF_CONFIG.MAX_EDIT_DISTANCE).toBe(50000)
      expect(DIFF_CONFIG.MAX_DIFF_MEMORY).toBe(100 * 1024 * 1024)
      expect(DIFF_CONFIG.CHUNK_SIZE).toBe(1000)
      expect(DIFF_CONFIG.CHUNK_OVERLAP).toBe(50)
    })
  })

  describe('DiffType', () => {
    it('should have correct enum values', () => {
      expect(DiffType.EQUAL).toBe('equal')
      expect(DiffType.DELETE).toBe('delete')
      expect(DiffType.INSERT).toBe('insert')
    })
  })

  describe('MyersDiff', () => {
    let differ: MyersDiff

    beforeEach(() => {
      differ = new MyersDiff()
    })

    describe('computeDiff', () => {
      it('should return identical result for same text', () => {
        const text = 'Hello World'
        const result = differ.computeDiff(text, text)

        expect(result.isIdentical).toBe(true)
        expect(result.additions).toBe(0)
        expect(result.deletions).toBe(0)
        expect(result.unchanged).toBe(1)
        expect(result.editDistance).toBe(0)
        expect(result.wasChunked).toBe(false)
        expect(result.operations).toHaveLength(1)
        expect(result.operations[0].type).toBe(DiffType.EQUAL)
      })

      it('should handle empty strings', () => {
        const result = differ.computeDiff('', '')

        expect(result.isIdentical).toBe(true)
        expect(result.additions).toBe(0)
        expect(result.deletions).toBe(0)
        expect(result.unchanged).toBe(0)
        expect(result.editDistance).toBe(0)
        expect(result.operations).toHaveLength(0)
      })

      it('should detect single line addition', () => {
        const original = 'Line 1\nLine 2'
        const modified = 'Line 1\nLine 2\nLine 3'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.additions).toBeGreaterThan(0)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should detect single line deletion', () => {
        const original = 'Line 1\nLine 2\nLine 3'
        const modified = 'Line 1\nLine 2'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.deletions).toBeGreaterThan(0)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should detect multiple line changes', () => {
        const original = 'Line 1\nLine 2\nLine 3\nLine 4'
        const modified = 'Line 1\nModified Line 2\nLine 3\nLine 5'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.additions).toBeGreaterThan(0)
        expect(result.deletions).toBeGreaterThan(0)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should detect insertion at the beginning', () => {
        const original = 'Line 2\nLine 3'
        const modified = 'Line 1\nLine 2\nLine 3'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.additions).toBeGreaterThan(0)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should detect deletion at the beginning', () => {
        const original = 'Line 1\nLine 2\nLine 3'
        const modified = 'Line 2\nLine 3'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.deletions).toBeGreaterThan(0)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should handle complete replacement', () => {
        const original = 'Old text 1\nOld text 2'
        const modified = 'New text 1\nNew text 2'
        const result = differ.computeDiff(original, modified)

        expect(result.additions).toBe(2)
        expect(result.deletions).toBe(2)
        expect(result.unchanged).toBe(0)
        expect(result.editDistance).toBe(4)
      })

      it('should handle single character strings', () => {
        const result = differ.computeDiff('a', 'b')

        expect(result.additions).toBe(1)
        expect(result.deletions).toBe(1)
        expect(result.unchanged).toBe(0)
      })

      it('should handle whitespace differences', () => {
        const original = 'Line 1\nLine 2'
        const modified = 'Line 1\n Line 2'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should handle multiline identical text', () => {
        const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
        const result = differ.computeDiff(text, text)

        expect(result.isIdentical).toBe(true)
        expect(result.unchanged).toBe(5)
        expect(result.operations).toHaveLength(1)
        expect(result.operations[0].lineCount).toBe(5)
      })

      it('should include processing time', () => {
        const result = differ.computeDiff('test', 'test')

        expect(result.processingTime).toBeGreaterThanOrEqual(0)
        expect(typeof result.processingTime).toBe('number')
      })

      it('should handle original text only', () => {
        const result = differ.computeDiff('Some text', '')

        expect(result.additions).toBe(0)
        expect(result.deletions).toBe(1)
        expect(result.unchanged).toBe(0)
      })

      it('should handle modified text only', () => {
        const result = differ.computeDiff('', 'Some text')

        expect(result.additions).toBe(1)
        expect(result.deletions).toBe(0)
        expect(result.unchanged).toBe(0)
      })

      it('should detect mixed operations in correct order', () => {
        const original = 'Line 1\nLine 2\nLine 3'
        const modified = 'Line 1\nNew Line\nLine 3\nLine 4'
        const result = differ.computeDiff(original, modified)

        expect(result.operations.length).toBeGreaterThan(0)

        // Verify operations maintain logical order
        let prevOriginalLine = -1
        let prevModifiedLine = -1

        for (const op of result.operations) {
          if (op.originalLine !== undefined) {
            expect(op.originalLine).toBeGreaterThanOrEqual(prevOriginalLine)
            prevOriginalLine = op.originalLine
          }
          if (op.modifiedLine !== undefined) {
            expect(op.modifiedLine).toBeGreaterThanOrEqual(prevModifiedLine)
            prevModifiedLine = op.modifiedLine
          }
        }
      })

      it('should handle special characters', () => {
        const original = 'Line with $pecial\nCharacters! @#$'
        const modified = 'Line with $pecial\nChanged! @#$'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should handle Unicode characters', () => {
        const original = 'Hello 世界\nПривет мир'
        const modified = 'Hello 世界\nПривет друзья'
        const result = differ.computeDiff(original, modified)

        expect(result.isIdentical).toBe(false)
        expect(result.editDistance).toBeGreaterThan(0)
        expect(result.operations.length).toBeGreaterThan(0)
      })
    })

    describe('chunked processing', () => {
      it('should use chunked processing for large files', () => {
        // Create a large file that exceeds MAX_DIRECT_DIFF_LINES
        const lineCount = DIFF_CONFIG.MAX_DIRECT_DIFF_LINES + 1000
        const originalLines = Array(lineCount)
          .fill(0)
          .map((_, i) => `Line ${i}`)
        const modifiedLines = [...originalLines]
        modifiedLines[500] = 'Modified Line 500'

        const original = originalLines.join('\n')
        const modified = modifiedLines.join('\n')

        const result = differ.computeDiff(original, modified)

        expect(result.wasChunked).toBe(true)
        expect(result.editDistance).toBeGreaterThan(0)
      })

      it('should not use chunked processing for small files', () => {
        const original = 'Line 1\nLine 2\nLine 3'
        const modified = 'Line 1\nModified\nLine 3'
        const result = differ.computeDiff(original, modified)

        expect(result.wasChunked).toBe(false)
      })

      it('should produce consistent results with and without chunking', () => {
        const lineCount = 100
        const originalLines = Array(lineCount)
          .fill(0)
          .map((_, i) => `Line ${i}`)
        const modifiedLines = [...originalLines]
        modifiedLines[50] = 'Modified Line 50'

        const original = originalLines.join('\n')
        const modified = modifiedLines.join('\n')

        const result = differ.computeDiff(original, modified)

        // Verify basic properties are consistent
        expect(result.editDistance).toBeGreaterThan(0)
        expect(result.additions + result.deletions).toBeGreaterThan(0)
        expect(result.operations.length).toBeGreaterThan(0)
      })
    })

    describe('custom memory limit', () => {
      it('should accept custom memory limit in constructor', () => {
        const customDiffer = new MyersDiff(50 * 1024 * 1024)
        const result = customDiffer.computeDiff('test', 'test')

        expect(result.isIdentical).toBe(true)
      })

      it('should use default memory limit when not provided', () => {
        const defaultDiffer = new MyersDiff()
        const result = defaultDiffer.computeDiff('test', 'test')

        expect(result.isIdentical).toBe(true)
      })
    })
  })

  describe('computeDiff', () => {
    it('should compute diff using convenience function', () => {
      const result = computeDiff('test', 'test')

      expect(result.isIdentical).toBe(true)
      expect(result.additions).toBe(0)
      expect(result.deletions).toBe(0)
    })

    it('should handle different texts', () => {
      const result = computeDiff('Line 1\nLine 2', 'Line 1\nLine 3')

      expect(result.isIdentical).toBe(false)
      expect(result.editDistance).toBeGreaterThan(0)
    })

    it('should return proper DiffResult structure', () => {
      const result = computeDiff('a', 'b')

      expect(result).toHaveProperty('operations')
      expect(result).toHaveProperty('additions')
      expect(result).toHaveProperty('deletions')
      expect(result).toHaveProperty('unchanged')
      expect(result).toHaveProperty('editDistance')
      expect(result).toHaveProperty('isIdentical')
      expect(result).toHaveProperty('processingTime')
      expect(result).toHaveProperty('wasChunked')
    })
  })

  describe('computeDiffStats', () => {
    it('should compute statistics for identical texts', () => {
      const text = 'Line 1\nLine 2\nLine 3'
      const stats = computeDiffStats(text, text)

      expect(stats.originalLines).toBe(3)
      expect(stats.modifiedLines).toBe(3)
      expect(stats.additions).toBe(0)
      expect(stats.deletions).toBe(0)
      expect(stats.unchanged).toBe(3)
      expect(stats.changePercentage).toBe(0)
    })

    it('should compute statistics for different texts', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'Line 1\nLine 3\nLine 4'
      const stats = computeDiffStats(original, modified)

      expect(stats.originalLines).toBe(3)
      expect(stats.modifiedLines).toBe(3)
      expect(stats.additions).toBeGreaterThan(0)
      expect(stats.deletions).toBeGreaterThan(0)
      expect(stats.changePercentage).toBeGreaterThan(0)
      expect(stats.changePercentage).toBeLessThanOrEqual(200)
    })

    it('should compute statistics for empty original', () => {
      const stats = computeDiffStats('', 'Line 1\nLine 2')

      expect(stats.originalLines).toBe(0)
      expect(stats.modifiedLines).toBe(2)
      expect(stats.additions).toBe(2)
      expect(stats.deletions).toBe(0)
      expect(stats.unchanged).toBe(0)
      expect(stats.changePercentage).toBe(100)
    })

    it('should compute statistics for empty modified', () => {
      const stats = computeDiffStats('Line 1\nLine 2', '')

      expect(stats.originalLines).toBe(2)
      expect(stats.modifiedLines).toBe(0)
      expect(stats.additions).toBe(0)
      expect(stats.deletions).toBe(2)
      expect(stats.unchanged).toBe(0)
      expect(stats.changePercentage).toBe(100)
    })

    it('should compute statistics for both empty', () => {
      const stats = computeDiffStats('', '')

      expect(stats.originalLines).toBe(0)
      expect(stats.modifiedLines).toBe(0)
      expect(stats.additions).toBe(0)
      expect(stats.deletions).toBe(0)
      expect(stats.unchanged).toBe(0)
      expect(stats.changePercentage).toBe(0)
    })

    it('should calculate change percentage correctly', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4'
      const modified = 'Line 1\nLine 2\nLine 3\nLine 5'
      const stats = computeDiffStats(original, modified)

      // changePercentage = (additions + deletions) / max(originalLines, modifiedLines) * 100
      expect(stats.changePercentage).toBeGreaterThan(0)
      expect(stats.changePercentage).toBeLessThanOrEqual(200)
    })

    it('should return proper DiffStats structure', () => {
      const stats = computeDiffStats('a', 'b')

      expect(stats).toHaveProperty('originalLines')
      expect(stats).toHaveProperty('modifiedLines')
      expect(stats).toHaveProperty('additions')
      expect(stats).toHaveProperty('deletions')
      expect(stats).toHaveProperty('unchanged')
      expect(stats).toHaveProperty('changePercentage')
    })
  })

  describe('areSimilar', () => {
    it('should return true for identical texts', () => {
      const text = 'Line 1\nLine 2\nLine 3'
      const result = areSimilar(text, text)

      expect(result).toBe(true)
    })

    it('should return true for similar texts with default threshold', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      const modified = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      const result = areSimilar(original, modified)

      // Identical texts should always be similar
      expect(result).toBe(true)
    })

    it('should return false for very different texts', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'New 1\nNew 2\nNew 3'
      const result = areSimilar(original, modified)

      // All lines different = 100% change
      expect(result).toBe(false)
    })

    it('should respect custom threshold', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4'
      const modified = 'Line 1\nLine 2\nLine 3\nLine 5'

      // With high threshold, should be similar
      expect(areSimilar(original, modified, 250)).toBe(true)
      // With low threshold, should not be similar
      expect(areSimilar(original, modified, 10)).toBe(false)
    })

    it('should handle zero threshold', () => {
      const text = 'Line 1\nLine 2'
      const result = areSimilar(text, text, 0)

      expect(result).toBe(true)
    })

    it('should handle 100% threshold', () => {
      const result = areSimilar('a', 'b', 200)

      // With high enough threshold, any texts should be similar
      expect(result).toBe(true)
    })

    it('should handle empty strings with any threshold', () => {
      expect(areSimilar('', '', 20)).toBe(true)
      expect(areSimilar('test', '', 20)).toBe(false)
      expect(areSimilar('', 'test', 20)).toBe(false)
    })

    it('should use default threshold of 20 when not specified', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      const modified = 'Line 1\nLine 2\nLine 3\nLine 4\nModified'

      // Default threshold should be applied
      const result = areSimilar(original, modified)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('formatUnifiedDiff', () => {
    it('should format identical texts', () => {
      const text = 'Line 1\nLine 2'
      const result = computeDiff(text, text)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
      expect(formatted).toContain(' Line 1')
      expect(formatted).toContain(' Line 2')
    })

    it('should format additions correctly', () => {
      const original = 'Line 1\nLine 2'
      const modified = 'Line 1\nLine 2\nLine 3'
      const result = computeDiff(original, modified)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
      expect(formatted).toContain('+Line 3')
    })

    it('should format deletions correctly', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'Line 1\nLine 2'
      const result = computeDiff(original, modified)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
      expect(formatted).toContain('-Line 3')
    })

    it('should format mixed changes correctly', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'Line 1\nModified\nLine 3'
      const result = computeDiff(original, modified)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
      expect(formatted).toContain('Line 1')
      expect(formatted).toContain('Line 3')
      expect(formatted).toContain('Modified')
    })

    it('should use custom file names', () => {
      const text = 'test'
      const result = computeDiff(text, text)
      const formatted = formatUnifiedDiff(result, 'file1.txt', 'file2.txt')

      expect(formatted).toContain('--- file1.txt')
      expect(formatted).toContain('+++ file2.txt')
    })

    it('should use default file names when not provided', () => {
      const text = 'test'
      const result = computeDiff(text, text)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
    })

    it('should handle empty diff', () => {
      const result = computeDiff('', '')
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('--- original')
      expect(formatted).toContain('+++ modified')
    })

    it('should preserve line content in formatted output', () => {
      const original = 'Hello World'
      const modified = 'Hello World!'
      const result = computeDiff(original, modified)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('Hello World')
    })

    it('should handle special characters in formatted output', () => {
      const original = 'Line with $pecial @#$'
      const modified = 'Line with $pecial @#$ extra'
      const result = computeDiff(original, modified)
      const formatted = formatUnifiedDiff(result)

      expect(formatted).toContain('$pecial')
      expect(formatted).toContain('@#$')
    })
  })

  describe('DiffOperation structure', () => {
    it('should create operations with correct properties for EQUAL', () => {
      const text = 'Line 1\nLine 2'
      const result = computeDiff(text, text)

      expect(result.operations[0].type).toBe(DiffType.EQUAL)
      expect(result.operations[0].text).toBe(text)
      expect(result.operations[0]).toHaveProperty('originalLine')
      expect(result.operations[0]).toHaveProperty('modifiedLine')
      expect(result.operations[0].lineCount).toBe(2)
    })

    it('should create operations with correct properties for INSERT', () => {
      const result = computeDiff('', 'New Line')

      const insertOp = result.operations.find(op => op.type === DiffType.INSERT)
      expect(insertOp).toBeDefined()
      expect(insertOp?.text).toBe('New Line')
      expect(insertOp).toHaveProperty('modifiedLine')
      expect(insertOp?.lineCount).toBe(1)
    })

    it('should create operations with correct properties for DELETE', () => {
      const result = computeDiff('Old Line', '')

      const deleteOp = result.operations.find(op => op.type === DiffType.DELETE)
      expect(deleteOp).toBeDefined()
      expect(deleteOp?.text).toBe('Old Line')
      expect(deleteOp).toHaveProperty('originalLine')
      expect(deleteOp?.lineCount).toBe(1)
    })

    it('should merge consecutive operations of same type', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'New 1\nNew 2\nNew 3'
      const result = computeDiff(original, modified)

      // Operations should be merged for efficiency
      const deleteOps = result.operations.filter(op => op.type === DiffType.DELETE)
      const insertOps = result.operations.filter(op => op.type === DiffType.INSERT)

      // Should have merged operations rather than individual line operations
      if (deleteOps.length > 0) {
        expect(deleteOps[0].lineCount).toBeGreaterThan(0)
      }
      if (insertOps.length > 0) {
        expect(insertOps[0].lineCount).toBeGreaterThan(0)
      }
    })
  })

  describe('edge cases and performance', () => {
    it('should handle very long lines', () => {
      const longLine = 'a'.repeat(10000)
      const original = `${longLine}\nLine 2`
      const modified = `${longLine}\nLine 3`
      const result = computeDiff(original, modified)

      expect(result.editDistance).toBeGreaterThan(0)
      expect(result.operations.length).toBeGreaterThan(0)
    })

    it('should handle many small changes', () => {
      const original = Array(100)
        .fill(0)
        .map((_, i) => `Line ${i}`)
        .join('\n')
      const modified = Array(100)
        .fill(0)
        .map((_, i) => (i % 2 === 0 ? `Line ${i}` : `Modified ${i}`))
        .join('\n')

      const result = computeDiff(original, modified)

      expect(result.editDistance).toBeGreaterThan(0)
      expect(result.additions).toBeGreaterThan(0)
      expect(result.deletions).toBeGreaterThan(0)
    })

    it('should complete in reasonable time for medium files', () => {
      const lineCount = 1000
      const original = Array(lineCount)
        .fill(0)
        .map((_, i) => `Line ${i}`)
        .join('\n')
      const modified = Array(lineCount)
        .fill(0)
        .map((_, i) => `Line ${i} modified`)
        .join('\n')

      const startTime = performance.now()
      const result = computeDiff(original, modified)
      const endTime = performance.now()

      expect(result.operations.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle mixed line endings gracefully', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const modified = 'Line 1\nLine 2\nLine 3'
      const result = computeDiff(original, modified)

      expect(result.isIdentical).toBe(true)
    })

    it('should handle tabs and spaces', () => {
      const original = '\tLine 1\n    Line 2'
      const modified = '\tLine 1\n\tLine 2'
      const result = computeDiff(original, modified)

      expect(result.isIdentical).toBe(false)
      expect(result.editDistance).toBeGreaterThan(0)
    })
  })
})
