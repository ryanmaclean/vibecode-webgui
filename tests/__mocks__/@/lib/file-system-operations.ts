/**
 * Mock file system operations for testing
 */

export interface FileSystemConfig {
  basePath: string
  allowedExtensions?: string[]
  maxFileSize?: number
  watcherEnabled?: boolean
}

export interface FileSyncEvent {
  type: 'create' | 'update' | 'delete'
  path: string
  content?: string
  timestamp: number
  checksum?: string
}

export interface FileSystemInstance {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  listFiles: (directory: string) => Promise<string[]>
  watchFiles: (callback: (event: FileSyncEvent) => void) => void
  stopWatching: () => void
  syncFiles: (events: FileSyncEvent[]) => Promise<void>
}

// Mock implementation
export const getFileSystemInstance = jest.fn().mockReturnValue({
  readFile: jest.fn().mockResolvedValue('mock file content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  listFiles: jest.fn().mockResolvedValue(['file1.ts', 'file2.js']),
  watchFiles: jest.fn(),
  stopWatching: jest.fn(),
  syncFiles: jest.fn().mockResolvedValue(undefined),
})

export const validateFilePath = jest.fn().mockReturnValue(true)
export const calculateChecksum = jest.fn().mockReturnValue('mock-checksum')
export const isAllowedExtension = jest.fn().mockReturnValue(true)