/**
 * Upload Client - Utility for handling file uploads to AI context
 * Provides type-safe API integration for the /api/ai/upload endpoint
 */

// File upload limits (mirror server-side validation)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_COUNT = 10;

// Allowed MIME types for AI context
export const ALLOWED_MIME_TYPES = [
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

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Uploaded file metadata
 */
export interface UploadedFileMetadata {
  name: string;
  size: number;
  type: string;
}

/**
 * Upload response from server
 */
export interface UploadResponse {
  success: boolean;
  filesUploaded: number;
  files: UploadedFileMetadata[];
  workspaceId: string;
  analysis?: string; // AI analysis of uploaded files
}

/**
 * Upload error response
 */
export interface UploadError {
  error: string;
  details?: string;
}

/**
 * Upload progress callback
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Validate file MIME type
 */
export function validateMimeType(mimeType: string): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }
  return { valid: true };
}

/**
 * Validate filename for security issues
 */
export function validateFilename(filename: string): FileValidationResult {
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

  // Check for excessive length
  if (filename.length > 255) {
    return { valid: false, error: 'Invalid filename: too long' };
  }

  return { valid: true };
}

/**
 * Validate individual file size
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
    };
  }
  return { valid: true };
}

/**
 * Validate total size of multiple files
 */
export function validateTotalSize(files: File[]): FileValidationResult {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `Total upload size exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB limit`
    };
  }
  return { valid: true };
}

/**
 * Validate file count
 */
export function validateFileCount(count: number): FileValidationResult {
  if (count > MAX_FILE_COUNT) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILE_COUNT} files allowed per upload`
    };
  }
  return { valid: true };
}

/**
 * Validate a single file
 */
export function validateFile(file: File): FileValidationResult {
  // Validate filename
  const filenameValidation = validateFilename(file.name);
  if (!filenameValidation.valid) {
    return filenameValidation;
  }

  // Validate MIME type
  const mimeValidation = validateMimeType(file.type);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }

  // Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}

/**
 * Validate multiple files before upload
 */
export function validateFiles(files: File[]): FileValidationResult {
  // Validate file count
  const countValidation = validateFileCount(files.length);
  if (!countValidation.valid) {
    return countValidation;
  }

  // Validate total size
  const totalSizeValidation = validateTotalSize(files);
  if (!totalSizeValidation.valid) {
    return totalSizeValidation;
  }

  // Validate each file
  for (const file of files) {
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return fileValidation;
    }
  }

  return { valid: true };
}

/**
 * Upload files to the AI context endpoint
 *
 * @param workspaceId - The workspace ID for the upload
 * @param files - Array of files to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload response with file metadata and optional AI analysis
 * @throws Error if upload fails or validation fails
 */
export async function uploadFiles(
  workspaceId: string,
  files: File[],
  onProgress?: UploadProgressCallback
): Promise<UploadResponse> {
  // Validate files before upload
  const validation = validateFiles(files);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create FormData
  const formData = new FormData();
  formData.append('workspaceId', workspaceId);

  // Append all files
  files.forEach(file => {
    formData.append('files', file);
  });

  try {
    // Create XMLHttpRequest for progress tracking
    return await new Promise<UploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(Math.round(percentComplete));
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText) as UploadResponse;
            resolve(response);
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText) as UploadError;
            reject(new Error(errorResponse.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      // Send request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error during upload');
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon name based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('text/javascript') || mimeType === 'text/typescript') {
    return 'file-code';
  }
  if (mimeType === 'application/json') {
    return 'file-json';
  }
  if (mimeType === 'text/html') {
    return 'file-html';
  }
  if (mimeType === 'text/css') {
    return 'file-css';
  }
  if (mimeType === 'text/markdown') {
    return 'file-text';
  }
  if (mimeType.includes('xml') || mimeType.includes('yaml')) {
    return 'file-code';
  }
  return 'file';
}
