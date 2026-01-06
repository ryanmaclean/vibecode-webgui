/**
 * File Operations Integration Tests
 * Tests file system operations integration with database and storage
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('File Operations Integration', () => {
  let testDir: string

  beforeAll(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `vibecode-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up test directory:', error)
    }
  })

  describe('File Creation and Reading', () => {
    test('should create and read a file', async () => {
      const testFile = path.join(testDir, 'test.txt')
      const content = 'Hello, World!'

      await fs.writeFile(testFile, content, 'utf-8')
      const readContent = await fs.readFile(testFile, 'utf-8')

      expect(readContent).toBe(content)
    })

    test('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep', 'folder')
      await fs.mkdir(nestedDir, { recursive: true })

      const stats = await fs.stat(nestedDir)
      expect(stats.isDirectory()).toBe(true)
    })

    test('should handle binary files', async () => {
      const binaryFile = path.join(testDir, 'binary.bin')
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF])

      await fs.writeFile(binaryFile, buffer)
      const readBuffer = await fs.readFile(binaryFile)

      expect(Buffer.compare(buffer, readBuffer)).toBe(0)
    })
  })

  describe('File Listing and Metadata', () => {
    test('should list directory contents', async () => {
      const files = await fs.readdir(testDir)
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBeGreaterThan(0)
    })

    test('should get file metadata', async () => {
      const testFile = path.join(testDir, 'metadata-test.txt')
      await fs.writeFile(testFile, 'test content')

      const stats = await fs.stat(testFile)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
      // mtime is a Date object
      expect(stats.mtime).toBeDefined()
      expect(typeof stats.mtime.getTime()).toBe('number')
      expect(stats.mtime.getTime()).toBeGreaterThan(0)
    })
  })

  describe('File Deletion and Updates', () => {
    test('should update file content', async () => {
      const testFile = path.join(testDir, 'update-test.txt')
      await fs.writeFile(testFile, 'original content')

      const updatedContent = 'updated content'
      await fs.writeFile(testFile, updatedContent)

      const readContent = await fs.readFile(testFile, 'utf-8')
      expect(readContent).toBe(updatedContent)
    })

    test('should delete a file', async () => {
      const testFile = path.join(testDir, 'delete-test.txt')
      await fs.writeFile(testFile, 'to be deleted')

      await fs.unlink(testFile)

      await expect(fs.stat(testFile)).rejects.toThrow()
    })

    test('should delete a directory', async () => {
      const deleteDir = path.join(testDir, 'delete-dir')
      await fs.mkdir(deleteDir)

      await fs.rmdir(deleteDir)

      await expect(fs.stat(deleteDir)).rejects.toThrow()
    })
  })

  describe('File Permissions and Access', () => {
    test('should check file accessibility', async () => {
      const testFile = path.join(testDir, 'access-test.txt')
      await fs.writeFile(testFile, 'accessible content')

      // Check read access
      await expect(fs.access(testFile, fs.constants.R_OK)).resolves.toBeUndefined()

      // Check write access
      await expect(fs.access(testFile, fs.constants.W_OK)).resolves.toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    test('should handle non-existent file reads', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt')
      await expect(fs.readFile(nonExistentFile)).rejects.toThrow()
    })

    test('should handle invalid file paths', async () => {
      const invalidPath = '\0invalid'
      await expect(fs.writeFile(invalidPath, 'content')).rejects.toThrow()
    })
  })
})
