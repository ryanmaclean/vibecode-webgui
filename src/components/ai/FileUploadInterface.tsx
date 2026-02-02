'use client';

/**
 * FileUploadInterface - Foundation component for file uploads to AI context
 *
 * Features:
 * - Drag-and-drop file upload with visual feedback
 * - Click-to-upload fallback with file input
 * - File preview with thumbnails/icons based on MIME type
 * - Upload progress indicator
 * - Display AI analysis results after upload
 * - Client-side file validation (type, size)
 * - Comprehensive error handling
 */

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  uploadFiles,
  validateFiles,
  formatFileSize,
  getFileIcon,
  type UploadResponse,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT
} from '@/lib/upload-client';

export interface FileUploadInterfaceProps {
  workspaceId: string;
  onUploadComplete?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  className?: string;
  maxFiles?: number;
  accept?: string;
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  id: string;
  preview?: string;
}

export const FileUploadInterface: React.FC<FileUploadInterfaceProps> = ({
  workspaceId,
  onUploadComplete,
  onError,
  className = '',
  maxFiles = MAX_FILE_COUNT,
  accept = '.txt,.js,.ts,.jsx,.tsx,.json,.html,.css,.md,.xml,.yml,.yaml',
  disabled = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  /**
   * Handle file selection via input
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  /**
   * Process selected files
   */
  const handleFiles = (files: File[]) => {
    // Reset previous state
    setUploadError(null);
    setUploadSuccess(false);
    setUploadResponse(null);

    // Check file count first
    if (files.length > maxFiles) {
      const error = `Maximum ${maxFiles} files allowed per upload`;
      setUploadError(error);
      if (onError) {
        onError(new Error(error));
      }
      return;
    }

    // Validate files
    const validation = validateFiles(files);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid files');
      if (onError) {
        onError(new Error(validation.error));
      }
      return;
    }

    // Create file previews
    const previews: FilePreview[] = files.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
    }));

    setSelectedFiles(previews);
  };

  /**
   * Remove a file from selection
   */
  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
    setUploadError(null);
    setUploadSuccess(false);
    setUploadResponse(null);
  };

  /**
   * Clear all selected files
   */
  const handleClearFiles = () => {
    setSelectedFiles([]);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadResponse(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Upload selected files
   */
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadProgress(0);

    try {
      const files = selectedFiles.map(fp => fp.file);
      const response = await uploadFiles(
        workspaceId,
        files,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadSuccess(true);
      setUploadResponse(response);
      if (onUploadComplete) {
        onUploadComplete(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Trigger file input click
   */
  const handleClickUpload = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  /**
   * Get icon component based on file type
   */
  const getIconComponent = (mimeType: string) => {
    const iconName = getFileIcon(mimeType);
    return <FileText className="w-6 h-6 text-blue-600" aria-hidden="true" />;
  };

  return (
    <div className={`w-full ${className}`} data-testid="file-upload-interface">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="file-input"
        disabled={disabled || isUploading}
      />

      {/* Drag-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        data-testid="drop-zone"
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        aria-disabled={disabled || isUploading}
      >
        <Upload
          className={`
            w-12 h-12 mx-auto mb-4
            ${isDragging ? 'text-blue-600 animate-bounce' : 'text-gray-400'}
          `}
          aria-hidden="true"
        />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          or click to browse
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Supported: {ALLOWED_MIME_TYPES.slice(0, 3).join(', ')}, etc.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Max {maxFiles} files, {MAX_FILE_SIZE / 1024 / 1024}MB per file
        </p>
      </div>

      {/* File preview list */}
      {selectedFiles.length > 0 && (
        <div className="mt-4" data-testid="file-preview-list">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Selected Files ({selectedFiles.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFiles}
              disabled={isUploading}
              aria-label="Clear all files"
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {selectedFiles.map((filePreview) => (
              <div
                key={filePreview.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                data-testid="file-preview-item"
              >
                <div className="flex-shrink-0">
                  {getIconComponent(filePreview.file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {filePreview.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(filePreview.file.size)} - {filePreview.file.type}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(filePreview.id)}
                  disabled={isUploading}
                  aria-label={`Remove ${filePreview.file.name}`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="mt-4" data-testid="upload-progress">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Uploading... {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div
          className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2"
          role="alert"
          data-testid="upload-error"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Upload Failed
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {uploadError}
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {uploadSuccess && uploadResponse && (
        <div
          className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          role="alert"
          data-testid="upload-success"
        >
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Upload Successful
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {uploadResponse.filesUploaded} file(s) uploaded to workspace {uploadResponse.workspaceId}
              </p>
              {uploadResponse.analysis && (
                <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    AI Analysis:
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {uploadResponse.analysis}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload button */}
      {selectedFiles.length > 0 && !uploadSuccess && (
        <div className="mt-4">
          <Button
            onClick={handleUpload}
            disabled={isUploading || disabled}
            className="w-full"
            data-testid="upload-button"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                Upload {selectedFiles.length} File(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploadInterface;
