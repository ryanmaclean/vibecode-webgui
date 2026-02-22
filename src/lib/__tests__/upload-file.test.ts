/**
 * Unit tests for upload-file.ts
 * Tests S3 file upload utility using AWS SDK v3
 */

const mockUploadDone = jest.fn();
const mockUploadConstructor = jest.fn();
const mockLoggerError = jest.fn();
const originalEnv = process.env;

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation((options) => {
    mockUploadConstructor(options);
    return {
      done: mockUploadDone,
    };
  }),
}));

jest.mock('../logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('Upload File Module', () => {
  let uploadFileModule: typeof import('../upload-file');

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockUploadDone.mockReset();
    mockUploadConstructor.mockReset();
    mockLoggerError.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Module exports', () => {
    it('should export uploadFile function', () => {
      uploadFileModule = require('../upload-file');
      expect(uploadFileModule.uploadFile).toBeDefined();
      expect(typeof uploadFileModule.uploadFile).toBe('function');
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return encoded location URL', async () => {
      uploadFileModule = require('../upload-file');
      mockUploadDone.mockResolvedValueOnce({});

      const result = await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'path/to/file name.txt',
        body: 'file content',
      });

      expect(mockUploadConstructor).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        location: 'https://my-bucket.s3.amazonaws.com/path/to/file%20name.txt',
        bucket: 'my-bucket',
        key: 'path/to/file name.txt',
      });
    });

    it('should include ContentType when provided', async () => {
      uploadFileModule = require('../upload-file');
      mockUploadDone.mockResolvedValueOnce({});

      await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'image.png',
        body: Buffer.from('image data'),
        contentType: 'image/png',
      });

      expect(mockUploadConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Bucket: 'my-bucket',
            Key: 'image.png',
            ContentType: 'image/png',
          }),
        })
      );
    });

    it('should not include ContentType when not provided', async () => {
      uploadFileModule = require('../upload-file');
      mockUploadDone.mockResolvedValueOnce({});

      await uploadFileModule.uploadFile({
        bucket: 'my-bucket',
        key: 'file.txt',
        body: 'content',
      });

      const callArg = mockUploadConstructor.mock.calls[0][0].params;
      expect(callArg.ContentType).toBeUndefined();
    });

    it('should log and throw when upload rejects', async () => {
      uploadFileModule = require('../upload-file');
      const error = new Error('S3 upload failed');
      mockUploadDone.mockRejectedValueOnce(error);

      await expect(
        uploadFileModule.uploadFile({
          bucket: 'my-bucket',
          key: 'file.txt',
          body: 'content',
        })
      ).rejects.toThrow('S3 upload failed');

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to upload file to S3',
        expect.objectContaining({
          bucket: 'my-bucket',
          key: 'file.txt',
          error: 'S3 upload failed',
        })
      );
    });

    it('should include session token in explicit credentials when provided', async () => {
      process.env.AWS_REGION = 'us-west-2';
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.AWS_SESSION_TOKEN = 'test-session-token';

      uploadFileModule = require('../upload-file');
      const { S3Client } = require('@aws-sdk/client-s3');
      mockUploadDone.mockResolvedValueOnce({});

      const result = await uploadFileModule.uploadFile({
        bucket: 'test-bucket',
        key: 'folder/subfolder/document.pdf',
        body: 'pdf content',
      });

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-west-2',
          credentials: expect.objectContaining({
            accessKeyId: 'test-access-key',
            secretAccessKey: 'test-secret-key',
            sessionToken: 'test-session-token',
          }),
        })
      );
      expect(result.location).toBe(
        'https://test-bucket.s3.us-west-2.amazonaws.com/folder/subfolder/document.pdf'
      );
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toBe('folder/subfolder/document.pdf');
    });
  });
});
