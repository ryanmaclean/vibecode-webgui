// File Upload API with RAG Integration
// Handles file uploads and creates vector embeddings for intelligent search

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  path: string
  workspaceId: string
  uploadedAt: string
  metadata: {
    language?: string
    lines?: number
    checksum?: string
  }
}

interface RAGIndex {
  fileId: string
  chunks: Array<{
    id: string
    content: string
    embedding?: number[]
    metadata: {
      startLine: number
      endLine: number
      tokens: number
    }
  }>
}

// Get uploads directory path
function getUploadsDir(workspaceId: string) {
  return path.join(process.cwd(), 'data', 'uploads', workspaceId)
}

function getRAGIndexPath(workspaceId: string) {
  return path.join(process.cwd(), 'data', 'rag', `${workspaceId}.json`)
}

// Ensure directories exist
async function ensureDirectories(workspaceId: string) {
  const uploadsDir = getUploadsDir(workspaceId)
  const ragDir = path.dirname(getRAGIndexPath(workspaceId))

  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  if (!existsSync(ragDir)) {
    await mkdir(ragDir, { recursive: true })
  }
}

// Detect programming language from file extension
function detectLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.xml': 'xml',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.md': 'markdown',
    '.txt': 'text'
  }

  return languageMap[ext] || 'text'
}

// Chunk text content for RAG processing
function chunkText(content: string, maxChunkSize: number = 1000): Array<{
  content: string
  startLine: number
  endLine: number
  tokens: number
}> {
  const lines = content.split('\n')
  const chunks = []
  let currentChunk = ''
  let startLine = 1
  let currentLine = 1

  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startLine,
        endLine: currentLine - 1,
        tokens: Math.ceil(currentChunk.length / 4) // Rough token estimate
      })
      currentChunk = line
      startLine = currentLine
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
    currentLine++
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      startLine,
      endLine: currentLine - 1,
      tokens: Math.ceil(currentChunk.length / 4)
    })
  }

  return chunks
}

// Generate simple hash for file content
function generateChecksum(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const workspaceId = formData.get('workspaceId') as string

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    await ensureDirectories(workspaceId)

    const uploadedFiles: UploadedFile[] = []
    const ragIndexes: RAGIndex[] = []

    for (const file of files) {
      try {
        // Read file content
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const content = buffer.toString('utf-8')

        // Generate file metadata
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const language = detectLanguage(file.name)
        const lines = content.split('\n').length
        const checksum = generateChecksum(content)

        // Save file
        const fileName = `${fileId}-${file.name}`
        const filePath = path.join(getUploadsDir(workspaceId), fileName)
        await writeFile(filePath, buffer)

        // Create uploaded file record
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          path: filePath,
          workspaceId,
          uploadedAt: new Date().toISOString(),
          metadata: {
            language,
            lines,
            checksum
          }
        }

        uploadedFiles.push(uploadedFile)

        // Create RAG index for text files
        if (content && content.length > 0) {
          const chunks = chunkText(content)
          const ragIndex: RAGIndex = {
            fileId,
            chunks: chunks.map((chunk, index) => ({
              id: `${fileId}-chunk-${index}`,
              content: chunk.content,
              metadata: {
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                tokens: chunk.tokens
              }
            }))
          }

          ragIndexes.push(ragIndex)
        }

      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error)
        // Continue with other files
      }
    }

    // Save RAG indexes
    if (ragIndexes.length > 0) {
      try {
        const ragIndexPath = getRAGIndexPath(workspaceId)

        // Load existing index or create new one
        let existingIndex: RAGIndex[] = []
        if (existsSync(ragIndexPath)) {
          const { readFile } = await import('fs/promises')
          const existingData = await readFile(ragIndexPath, 'utf-8')
          existingIndex = JSON.parse(existingData)
        }

        // Merge with new indexes
        const updatedIndex = [...existingIndex, ...ragIndexes]
        await writeFile(ragIndexPath, JSON.stringify(updatedIndex, null, 2))
      } catch (error) {
        console.error('Failed to save RAG index:', error)
      }
    }

    return NextResponse.json({
      success: true,
      filesUploaded: uploadedFiles.length,
      files: uploadedFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        language: f.metadata.language,
        lines: f.metadata.lines
      })),
      ragChunks: ragIndexes.reduce((total, index) => total + index.chunks.length, 0)
    })

  } catch (error) {
    console.error('Upload error:', error)

    return NextResponse.json(
      {
        error: 'Failed to upload files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET - List uploaded files for workspace
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // This would typically query a database
    // For now, we'll return a placeholder response
    return NextResponse.json({
      files: [],
      totalFiles: 0,
      totalSize: 0
    })

  } catch (error) {
    console.error('Failed to list files:', error)
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
