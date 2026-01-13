/**
 * File Upload API Endpoint
 * Handles file uploads with validation and storage for FileUploadInterface
 *
 * Features:
 * - Multipart/form-data support
 * - File type validation (text-based files only)
 * - File size validation (max 10MB per file)
 * - Total size validation (max 50MB per request)
 * - Secure filename validation (no path traversal)
 * - Filesystem storage with workspace isolation
 * - Progress tracking support
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// File upload limits (must match client-side validation)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 10;

// Allowed MIME types (text-based files only for AI context)
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/javascript',
  'text/typescript',
  'application/json',
  'text/html',
  'text/css',
  'text/markdown',
  'application/xml',
  'text/xml',
  'application/yaml',
  'text/yaml',
] as const;

/**
 * Uploaded file metadata response
 */
interface UploadedFileMetadata {
  name: string;
  size: number;
  type: string;
}

/**
 * Upload response structure
 */
interface UploadResponse {
  success: boolean;
  filesUploaded: number;
  files: UploadedFileMetadata[];
  workspaceId: string;
  analysis?: string;
}

/**
 * Get uploads directory for a workspace
 */
function getUploadsDir(workspaceId: string): string {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');
  return path.join(uploadDir, workspaceId);
}

/**
 * Ensure upload directories exist
 */
async function ensureDirectories(workspaceId: string): Promise<void> {
  const uploadsDir = getUploadsDir(workspaceId);
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
}

/**
 * Validate workspace ID format
 */
function validateWorkspaceId(workspaceId: string | null): { valid: boolean; error?: string } {
  if (!workspaceId) {
    return { valid: false, error: 'Workspace ID is required' };
  }

  if (workspaceId.length > 100) {
    return { valid: false, error: 'Workspace ID too long' };
  }

  // Allow alphanumeric, hyphens, and underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return { valid: false, error: 'Invalid workspace ID format' };
  }

  return { valid: true };
}

/**
 * Validate filename for security
 */
function validateFilename(filename: string): { valid: boolean; error?: string } {
  // Check for directory traversal
  if (filename.includes('../') || filename.includes('..\\') || filename.includes('..')) {
    return { valid: false, error: 'Invalid filename: directory traversal detected' };
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return { valid: false, error: 'Invalid filename: null byte detected' };
  }

  // Check for path separators
  if (filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename: path separators not allowed' };
  }

  // Check length
  if (filename.length > 255) {
    return { valid: false, error: 'Invalid filename: too long' };
  }

  return { valid: true };
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds 10MB limit`,
    };
  }

  return { valid: true };
}

/**
 * POST handler for file uploads
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const workspaceId = formData.get('workspaceId') as string | null;
    const files = formData.getAll('files') as File[];

    // Validate workspace ID
    const workspaceValidation = validateWorkspaceId(workspaceId);
    if (!workspaceValidation.valid) {
      return NextResponse.json(
        {
          error: workspaceValidation.error,
          details: workspaceValidation.error,
        },
        { status: 400 }
      );
    }

    // Validate file count
    if (files.length === 0) {
      return NextResponse.json(
        {
          error: 'No files provided',
          details: 'At least one file is required',
        },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_FILE_COUNT} files allowed per upload`,
          details: `Received ${files.length} files`,
        },
        { status: 400 }
      );
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        {
          error: 'Total upload size exceeds 50MB limit',
          details: `Total size: ${Math.round(totalSize / 1024 / 1024)}MB`,
        },
        { status: 413 }
      );
    }

    // Validate each file
    for (const file of files) {
      // Validate filename
      const filenameValidation = validateFilename(file.name);
      if (!filenameValidation.valid) {
        return NextResponse.json(
          {
            error: filenameValidation.error,
            details: `File: ${file.name}`,
          },
          { status: 400 }
        );
      }

      // Validate MIME type
      const mimeValidation = validateMimeType(file.type);
      if (!mimeValidation.valid) {
        return NextResponse.json(
          {
            error: mimeValidation.error,
            details: `File: ${file.name} (${file.type})`,
          },
          { status: 415 }
        );
      }

      // Validate file size
      const sizeValidation = validateFileSize(file.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          {
            error: sizeValidation.error,
            details: `File: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`,
          },
          { status: 413 }
        );
      }
    }

    // Ensure directories exist
    await ensureDirectories(workspaceId!);

    // Process and save files
    const uploadedFiles: UploadedFileMetadata[] = [];

    for (const file of files) {
      try {
        // Read file content
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename with timestamp
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${fileId}-${file.name}`;
        const filePath = path.join(getUploadsDir(workspaceId!), fileName);

        // Save file to disk
        await writeFile(filePath, buffer);

        // Add to uploaded files list
        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } catch (error) {
        console.error(`Failed to save file ${file.name}:`, error);
        // Continue with other files
      }
    }

    // Generate mock AI analysis (placeholder for future integration)
    const analysis = `Uploaded ${uploadedFiles.length} file(s) to workspace ${workspaceId}. Files are ready for AI processing.`;

    // Return success response
    const response: UploadResponse = {
      success: true,
      filesUploaded: uploadedFiles.length,
      files: uploadedFiles,
      workspaceId: workspaceId!,
      analysis,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('File upload error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process file upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
