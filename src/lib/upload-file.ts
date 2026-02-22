/**
 * Upload File - S3 file upload utility using AWS SDK v3
 * Uses modular @aws-sdk/client-s3 for tree-shakeable, minimal bundle size
 */

import { S3Client, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from './logger';

/**
 * S3 upload parameters
 */
export interface S3UploadParams {
  bucket: string;
  key: string;
  body: PutObjectCommandInput['Body'];
  contentType?: string;
}

/**
 * S3 upload result
 */
export interface S3UploadResult {
  location: string;
  bucket: string;
  key: string;
}

/**
 * Create a configured S3Client using environment variables
 */
function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
        }
      : undefined, // Fall back to default credential chain (IAM role, instance profile, etc.)
  });
}

const s3Client = createS3Client();

/**
 * Upload a file to S3 using AWS SDK v3 PutObjectCommand
 */
export const uploadFile = async (params: S3UploadParams): Promise<S3UploadResult> => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const encodedKey = params.key.split('/').map(encodeURIComponent).join('/');
  const host =
    region === 'us-east-1'
      ? `${params.bucket}.s3.amazonaws.com`
      : `${params.bucket}.s3.${region}.amazonaws.com`;
  const location = `https://${host}/${encodedKey}`;

  try {
    // Use managed upload to preserve multipart behavior for large objects.
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ...(params.contentType ? { ContentType: params.contentType } : {}),
      },
    });
    await upload.done();
  } catch (error) {
    logger.error('Failed to upload file to S3', {
      bucket: params.bucket,
      key: params.key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return {
    location,
    bucket: params.bucket,
    key: params.key,
  };
};
