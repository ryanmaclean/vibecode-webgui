import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Upload Route E2E Tests', () => {
  // Helper function to create a test file
  const createTestFile = (filename: string, content: string): string => {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to upload page before each test
    await page.goto('/upload');
  });

  test('should navigate to /upload page and render FileUploadInterface component', async ({ page }) => {
    // Verify URL
    await expect(page).toHaveURL(/.*\/upload/);

    // Verify page title exists
    await expect(page.locator('h1')).toContainText('File Upload');

    // Verify FileUploadInterface component is rendered
    await expect(page.locator('[data-testid="file-upload-interface"]')).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('[data-testid="drop-zone"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached();

    // Verify instructions are visible
    await expect(page.getByText(/Drag & drop files here/i)).toBeVisible();
    await expect(page.getByText(/or click to browse/i)).toBeVisible();
  });

  test('should display drag-and-drop zone with proper styling', async ({ page }) => {
    const dropZone = page.locator('[data-testid="drop-zone"]');

    // Verify drop zone is visible and styled
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toHaveAttribute('role', 'button');

    // Verify it's accessible
    await expect(dropZone).toHaveAttribute('aria-label', 'Upload files');

    // Verify upload icon is visible
    await expect(dropZone.locator('svg').first()).toBeVisible();
  });

  test('should select file via file input and display preview', async ({ page }) => {
    // Create a test file
    const testFilePath = createTestFile('test-file.txt', 'This is a test file for E2E testing.');

    // Get the file input and set files
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for file preview to appear
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Verify file preview item exists
    const filePreviewItem = page.locator('[data-testid="file-preview-item"]').first();
    await expect(filePreviewItem).toBeVisible();

    // Verify file name is displayed
    await expect(filePreviewItem).toContainText('test-file.txt');

    // Verify file size is displayed
    await expect(filePreviewItem).toContainText(/\d+\s*(B|KB|MB)/);

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  test('should display multiple selected files in preview list', async ({ page }) => {
    // Create multiple test files
    const testFile1 = createTestFile('test-file-1.txt', 'Content 1');
    const testFile2 = createTestFile('test-file-2.js', 'console.log("test");');
    const testFile3 = createTestFile('test-file-3.json', '{"key": "value"}');

    // Select multiple files
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([testFile1, testFile2, testFile3]);

    // Wait for file preview list
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Verify all files are displayed
    const filePreviewItems = page.locator('[data-testid="file-preview-item"]');
    await expect(filePreviewItems).toHaveCount(3);

    // Verify file count is displayed
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('Selected Files (3)');

    // Verify each file name appears
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('test-file-1.txt');
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('test-file-2.js');
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('test-file-3.json');

    // Clean up
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile2);
    fs.unlinkSync(testFile3);
  });

  test('should remove individual file from preview list', async ({ page }) => {
    // Create test files
    const testFile1 = createTestFile('keep-this-file.txt', 'Keep me');
    const testFile2 = createTestFile('remove-this-file.txt', 'Remove me');

    // Select files
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([testFile1, testFile2]);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(2);

    // Find and click remove button for second file
    const filePreviewItems = page.locator('[data-testid="file-preview-item"]');
    const secondFileRemoveButton = filePreviewItems.nth(1).locator('button[aria-label*="Remove"]');
    await secondFileRemoveButton.click();

    // Verify only one file remains
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(1);

    // Verify the correct file was removed
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('keep-this-file.txt');
    await expect(page.locator('[data-testid="file-preview-list"]')).not.toContainText('remove-this-file.txt');

    // Clean up
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile2);
  });

  test('should clear all files when clear button is clicked', async ({ page }) => {
    // Create test files
    const testFile1 = createTestFile('file1.txt', 'Content 1');
    const testFile2 = createTestFile('file2.txt', 'Content 2');

    // Select files
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([testFile1, testFile2]);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(2);

    // Click clear all button
    const clearButton = page.getByRole('button', { name: /Clear All/i });
    await clearButton.click();

    // Verify files are cleared
    await expect(page.locator('[data-testid="file-preview-list"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(0);

    // Clean up
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile2);
  });

  test('should show upload button after file selection', async ({ page }) => {
    // Create test file
    const testFile = createTestFile('ready-to-upload.txt', 'Upload me');

    // Select file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Verify upload button appears
    const uploadButton = page.locator('[data-testid="upload-button"]');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toContainText(/Upload.*File/i);
    await expect(uploadButton).toBeEnabled();

    // Clean up
    fs.unlinkSync(testFile);
  });

  test('should handle file upload and show success message', async ({ page }) => {
    // Create test file
    const testFile = createTestFile('upload-test.txt', 'Test upload content');

    // Select file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Click upload button
    const uploadButton = page.locator('[data-testid="upload-button"]');
    await uploadButton.click();

    // Wait for upload progress indicator
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible({ timeout: 5000 });

    // Verify progress bar exists
    await expect(page.locator('[role="progressbar"]')).toBeVisible();

    // Wait for success message (with longer timeout for actual upload)
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });

    // Verify success message content
    const successMessage = page.locator('[data-testid="upload-success"]');
    await expect(successMessage).toContainText(/Upload Successful/i);
    await expect(successMessage).toContainText(/uploaded/i);

    // Clean up
    fs.unlinkSync(testFile);
  });

  test('should display progress indicator during upload', async ({ page }) => {
    // Create test file
    const testFile = createTestFile('progress-test.txt', 'Testing progress indicator');

    // Select and upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    const uploadButton = page.locator('[data-testid="upload-button"]');
    await uploadButton.click();

    // Wait for progress indicator
    const uploadProgress = page.locator('[data-testid="upload-progress"]');
    await expect(uploadProgress).toBeVisible({ timeout: 5000 });

    // Verify progress text
    await expect(uploadProgress).toContainText(/Uploading/i);

    // Verify progress bar exists
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    // Verify upload button is disabled during upload
    await expect(uploadButton).toBeDisabled();

    // Clean up
    fs.unlinkSync(testFile);
  });

  test('should handle multiple file types correctly', async ({ page }) => {
    // Create files with different extensions
    const txtFile = createTestFile('document.txt', 'Text content');
    const jsFile = createTestFile('script.js', 'console.log("hello");');
    const jsonFile = createTestFile('data.json', '{"test": true}');
    const mdFile = createTestFile('readme.md', '# Test Readme');

    // Select files
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([txtFile, jsFile, jsonFile, mdFile]);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Verify all files are shown
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(4);

    // Verify file names and types
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('document.txt');
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('script.js');
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('data.json');
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('readme.md');

    // Clean up
    fs.unlinkSync(txtFile);
    fs.unlinkSync(jsFile);
    fs.unlinkSync(jsonFile);
    fs.unlinkSync(mdFile);
  });

  test('should display file size in human-readable format', async ({ page }) => {
    // Create test file with known size
    const content = 'A'.repeat(1024); // Exactly 1KB
    const testFile = createTestFile('size-test.txt', content);

    // Select file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);

    // Wait for preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Verify file size is displayed in KB
    const filePreview = page.locator('[data-testid="file-preview-item"]').first();
    await expect(filePreview).toContainText(/1(\.\d+)?\s*KB/i);

    // Clean up
    fs.unlinkSync(testFile);
  });

  test('should handle click-to-upload interaction', async ({ page }) => {
    // Create test file
    const testFile = createTestFile('click-upload.txt', 'Click test');

    // Click on drop zone to trigger file dialog
    const dropZone = page.locator('[data-testid="drop-zone"]');

    // Set up file chooser handler before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    await dropZone.click();

    // Handle file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testFile);

    // Wait for file preview
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="file-preview-item"]')).toHaveCount(1);

    // Verify file is selected
    await expect(page.locator('[data-testid="file-preview-list"]')).toContainText('click-upload.txt');

    // Clean up
    fs.unlinkSync(testFile);
  });

  test('should disable upload controls during active upload', async ({ page }) => {
    // Create test file
    const testFile = createTestFile('disable-test.txt', 'Testing disabled state');

    // Select file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);
    await expect(page.locator('[data-testid="file-preview-list"]')).toBeVisible({ timeout: 5000 });

    // Start upload
    const uploadButton = page.locator('[data-testid="upload-button"]');
    await uploadButton.click();

    // Verify controls are disabled during upload
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible({ timeout: 5000 });

    // Upload button should be disabled
    await expect(uploadButton).toBeDisabled();

    // Drop zone should be disabled
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone).toHaveAttribute('aria-disabled', 'true');

    // Clean up
    fs.unlinkSync(testFile);
  });
});
