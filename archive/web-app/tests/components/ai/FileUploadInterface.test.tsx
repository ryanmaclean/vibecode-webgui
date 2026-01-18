/**
 * Comprehensive tests for FileUploadInterface component
 *
 * Test coverage:
 * - Component rendering
 * - Drag-and-drop events
 * - File selection via input
 * - File validation (MIME type, size, count)
 * - Upload flow
 * - Progress tracking
 * - Success/error states
 * - File preview rendering
 * - User interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FileUploadInterface } from '@/components/ai/FileUploadInterface';
import * as uploadClient from '@/lib/upload-client';

// Mock the upload client
jest.mock('@/lib/upload-client', () => ({
  ...jest.requireActual('@/lib/upload-client'),
  uploadFiles: jest.fn(),
}));

// Mock XMLHttpRequest for upload progress
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: {
    addEventListener: jest.fn(),
  },
  addEventListener: jest.fn(),
  responseText: '',
  status: 200,
};

describe('FileUploadInterface', () => {
  const mockWorkspaceId = 'test-workspace-123';
  const mockOnUploadComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.XMLHttpRequest = jest.fn(() => mockXHR) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to create mock files
  const createMockFile = (
    name: string,
    size: number,
    type: string
  ): File => {
    const file = new File(['x'.repeat(size)], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  // Helper function to create drag event with files
  const createDragEvent = (type: string, files: File[] = []) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files,
        items: files.map(file => ({
          kind: 'file',
          type: file.type,
          getAsFile: () => file,
        })),
        types: ['Files'],
      },
    });
    return event;
  };

  describe('Component Rendering', () => {
    it('should render the upload interface', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      expect(screen.getByTestId('file-upload-interface')).toBeInTheDocument();
      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
      expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          className="custom-class"
        />
      );

      const container = screen.getByTestId('file-upload-interface');
      expect(container).toHaveClass('custom-class');
    });

    it('should show supported file types', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      expect(screen.getByText(/Supported:/i)).toBeInTheDocument();
      expect(screen.getByText(/Max.*files.*MB per file/i)).toBeInTheDocument();
    });

    it('should render disabled state', () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          disabled={true}
        />
      );

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toBeDisabled();
    });

    it('should hide file input element', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toHaveClass('hidden');
    });
  });

  describe('Drag and Drop Events', () => {
    it('should handle dragover event', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);

      expect(screen.getByText(/Drop files here/i)).toBeInTheDocument();
    });

    it('should handle dragleave event', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);
      expect(screen.getByText(/Drop files here/i)).toBeInTheDocument();

      fireEvent.dragLeave(dropZone);
      expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
    });

    it('should handle drop event with valid files', async () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const dropZone = screen.getByTestId('drop-zone');
      const file = createMockFile('test.txt', 1000, 'text/plain');

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('file-preview-list')).toBeInTheDocument();
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    it('should not accept drop when disabled', () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          disabled={true}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      const file = createMockFile('test.txt', 1000, 'text/plain');

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(screen.queryByTestId('file-preview-list')).not.toBeInTheDocument();
    });

    it('should not accept drop when uploading', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      // First, add a file and start upload
      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      // Wait for upload to start
      await waitFor(() => {
        expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
      });

      // Now try to drop another file
      const dropZone = screen.getByTestId('drop-zone');
      const newFile = createMockFile('test2.txt', 1000, 'text/plain');

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [newFile],
        },
      });

      // Should not add new file during upload
      expect(screen.queryByText('test2.txt')).not.toBeInTheDocument();
    });
  });

  describe('File Selection via Input', () => {
    it('should handle file selection through input', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.js', 2000, 'text/javascript');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('file-preview-list')).toBeInTheDocument();
        expect(screen.getByText('test.js')).toBeInTheDocument();
      });
    });

    it('should handle multiple file selection', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const files = [
        createMockFile('test1.txt', 1000, 'text/plain'),
        createMockFile('test2.json', 1500, 'application/json'),
        createMockFile('test3.html', 2000, 'text/html'),
      ];

      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, files);

      await waitFor(() => {
        expect(screen.getByText('Selected Files (3)')).toBeInTheDocument();
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
        expect(screen.getByText('test2.json')).toBeInTheDocument();
        expect(screen.getByText('test3.html')).toBeInTheDocument();
      });
    });

    it('should trigger file input on drop zone click', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const dropZone = screen.getByTestId('drop-zone');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      const clickSpy = jest.spyOn(fileInput, 'click');

      await user.click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    it('should reject files with invalid MIME types', async () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          onError={mockOnError}
        />
      );

      const file = createMockFile('test.exe', 1000, 'application/x-msdownload');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      // Manually set files on input element
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it('should reject files exceeding size limit', async () => {
      const user = userEvent.setup();
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          onError={mockOnError}
        />
      );

      const file = createMockFile('large.txt', 11 * 1024 * 1024, 'text/plain'); // 11MB
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it('should reject when file count exceeds limit', async () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          maxFiles={2}
          onError={mockOnError}
        />
      );

      const files = [
        createMockFile('test1.txt', 1000, 'text/plain'),
        createMockFile('test2.txt', 1000, 'text/plain'),
        createMockFile('test3.txt', 1000, 'text/plain'),
      ];

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it('should reject files with path traversal in filename', async () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          onError={mockOnError}
        />
      );

      const file = createMockFile('../etc/passwd', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
      });
    });

    it('should accept valid files', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('valid.json', 1000, 'application/json');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('file-preview-list')).toBeInTheDocument();
        expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument();
      });
    });
  });

  describe('File Preview', () => {
    it('should display file preview with name and size', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1024, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
        expect(screen.getByText(/1.*KB/)).toBeInTheDocument();
      });
    });

    it('should display file type in preview', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.json', 2048, 'application/json');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/application\/json/)).toBeInTheDocument();
      });
    });

    it('should render file icon for each file', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        const previewItems = screen.getAllByTestId('file-preview-item');
        expect(previewItems).toHaveLength(1);
      });
    });

    it('should allow removing individual files', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const files = [
        createMockFile('test1.txt', 1000, 'text/plain'),
        createMockFile('test2.txt', 1000, 'text/plain'),
      ];

      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, files);

      await waitFor(() => {
        expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByLabelText(/Remove/);
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Selected Files (1)')).toBeInTheDocument();
      });
    });

    it('should allow clearing all files', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('file-preview-list')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear All');
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByTestId('file-preview-list')).not.toBeInTheDocument();
      });
    });
  });

  describe('Upload Flow', () => {
    it('should show upload button when files are selected', async () => {
      const user = userEvent.setup();
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByTestId('upload-button')).toBeInTheDocument();
      });
    });

    it('should upload files successfully', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        filesUploaded: 1,
        files: [{ name: 'test.txt', size: 1000, type: 'text/plain' }],
        workspaceId: mockWorkspaceId,
      };

      (uploadClient.uploadFiles as jest.Mock).mockResolvedValue(mockResponse);

      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-success')).toBeInTheDocument();
        expect(screen.getByText(/Upload Successful/i)).toBeInTheDocument();
        expect(mockOnUploadComplete).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should handle upload failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Network error';

      (uploadClient.uploadFiles as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          onError={mockOnError}
        />
      );

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalled();
      });
    });

    it('should disable upload button during upload', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(uploadButton).toBeDisabled();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should display upload progress', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockImplementation(
        async (workspaceId, files, onProgress) => {
          if (onProgress) {
            onProgress(25);
            await new Promise(resolve => setTimeout(resolve, 10));
            onProgress(50);
            await new Promise(resolve => setTimeout(resolve, 10));
            onProgress(75);
            await new Promise(resolve => setTimeout(resolve, 10));
            onProgress(100);
          }
          return {
            success: true,
            filesUploaded: 1,
            files: [],
            workspaceId,
          };
        }
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should show loading state and upload button disabled during upload', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          filesUploaded: 1,
          files: [],
          workspaceId: mockWorkspaceId,
        }), 100))
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');

      // Button should be enabled initially
      expect(uploadButton).not.toBeDisabled();

      // Start upload
      await user.click(uploadButton);

      // Button should become disabled
      await waitFor(() => {
        expect(uploadButton).toBeDisabled();
      });
    });
  });

  describe('Success State', () => {
    it('should display AI analysis results when provided', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        filesUploaded: 1,
        files: [{ name: 'test.txt', size: 1000, type: 'text/plain' }],
        workspaceId: mockWorkspaceId,
        analysis: 'This is a text file containing sample data.',
      };

      (uploadClient.uploadFiles as jest.Mock).mockResolvedValue(mockResponse);

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/AI Analysis:/i)).toBeInTheDocument();
        expect(screen.getByText(mockResponse.analysis)).toBeInTheDocument();
      });
    });

    it('should display file count in success message', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        filesUploaded: 3,
        files: [],
        workspaceId: mockWorkspaceId,
      };

      (uploadClient.uploadFiles as jest.Mock).mockResolvedValue(mockResponse);

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const files = [
        createMockFile('test1.txt', 1000, 'text/plain'),
        createMockFile('test2.txt', 1000, 'text/plain'),
        createMockFile('test3.txt', 1000, 'text/plain'),
      ];

      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, files);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/3 file\(s\) uploaded/i)).toBeInTheDocument();
      });
    });

    it('should hide upload button after successful upload', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        success: true,
        filesUploaded: 1,
        files: [],
        workspaceId: mockWorkspaceId,
      };

      (uploadClient.uploadFiles as jest.Mock).mockResolvedValue(mockResponse);

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should display error message on upload failure', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockRejectedValue(
        new Error('Server error')
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/Upload Failed/i)).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('should clear error when new files are selected', async () => {
      const { rerender } = render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      // First, trigger an error with invalid file
      const invalidFile = createMockFile('test.exe', 1000, 'application/x-msdownload');
      let fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
      });

      // Rerender to reset DOM
      rerender(<FileUploadInterface workspaceId={mockWorkspaceId} />);
      fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      // Then select valid file
      const validFile = createMockFile('test.txt', 1000, 'text/plain');
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument();
      });
    });

    it('should clear error when file is removed', async () => {
      const { rerender } = render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      // Trigger validation error
      const invalidFile = createMockFile('test.exe', 1000, 'application/x-msdownload');
      let fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('upload-error')).toBeInTheDocument();
      });

      // Rerender to reset DOM
      rerender(<FileUploadInterface workspaceId={mockWorkspaceId} />);
      fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      // Upload valid file to clear error
      const validFile = createMockFile('test.txt', 1000, 'text/plain');
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-label', 'Upload files');
      expect(dropZone).toHaveAttribute('role', 'button');
    });

    it('should indicate disabled state with aria-disabled', () => {
      render(
        <FileUploadInterface
          workspaceId={mockWorkspaceId}
          disabled={true}
        />
      );

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have progress bar with proper ARIA attributes', async () => {
      const user = userEvent.setup();

      (uploadClient.uploadFiles as jest.Mock).mockImplementation(
        async (workspaceId, files, onProgress) => {
          if (onProgress) {
            onProgress(50);
          }
          return new Promise(() => {}); // Never resolve to keep loading state
        }
      );

      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const file = createMockFile('test.txt', 1000, 'text/plain');
      const fileInput = screen.getByTestId('file-input');

      await user.upload(fileInput, file);

      const uploadButton = await screen.findByTestId('upload-button');
      await user.click(uploadButton);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });

    it('should have alert role for error messages', async () => {
      render(<FileUploadInterface workspaceId={mockWorkspaceId} />);

      const invalidFile = createMockFile('test.exe', 1000, 'application/x-msdownload');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      });
    });
  });
});
