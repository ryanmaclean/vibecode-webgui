/**
 * Unit tests for upload-file.ts
 * Tests S3 file upload utility using AWS SDK v3 @aws-sdk/client-s3
 */

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('Upload File Module', () => {
  let uploadFileModule: typeof import('../upload-file');

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();

    // Re-mock after resetModules
    jest.mock('@aws-sdk/client-s3', () => ({
      S3Client: jest.fn().mockImplementation(() => ({
        send: mockSend,
      })),
      PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    }));

    uploadFileModule = require('../upload-file');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Module exports', () => {
    it('should export uploadFile function', () => {
      expect(uploadFileModule.uploadFile).toBeDefined();
      expect(typeof uploadFileModule.uploadFile).toBe('function');
    });
  });

  describe('uploadFile', () => {
    it('should call S3Client send with PutObjectCommand and return location', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'path/to/file.txt',
        body: 'file content',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        location: 'https://my-bucket.s3.amazonaws.com/path/to/file.txt',
        bucket: 'my-bucket',
        key: 'path/to/file.txt',
      });
    });

    it('should include ContentType when provided', async () => {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      mockSend.mockResolvedValueOnce({});

      await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'image.png',
        body: Buffer.from('image data'),
        contentType: 'image/png',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'my-bucket',
          Key: 'image.png',
          ContentType: 'image/png',
        })
      );
    });

    it('should not include ContentType when not provided', async () => {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      mockSend.mockResolvedValueOnce({});

      await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'file.txt',
        body: 'content',
      });

      const callArg = PutObjectCommand.mock.calls[0][0];
      expect(callArg.ContentType).toBeUndefined();
    });

    it('should throw when S3Client send rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 upload failed'));

      await expect(
        uploadFileModule.uploadFile({
          bucket: 'my-bucket',
          key: 'file.txt',
          body: 'content',
        })
      ).rejects.toThrow('S3 upload failed');
    });

    it('should construct correct S3 URL with bucket and key', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await uploadFileModule.uploadFile({
        bucket: 'test-bucket',
        key: 'folder/subfolder/document.pdf',
        body: 'pdf content',
      });

      expect(result.location).toBe(
        'https://test-bucket.s3.amazonaws.com/folder/subfolder/document.pdf'
      );
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toBe('folder/subfolder/document.pdf');
    });
  });
});
