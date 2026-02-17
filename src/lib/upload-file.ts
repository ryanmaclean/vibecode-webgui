/**
 * Upload File - S3 file upload utility using AWS SDK v3
 * Uses modular @aws-sdk/client-s3 for tree-shakeable, minimal bundle size
 */

import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';

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
        }
      : undefined, // Fall back to default credential chain (IAM role, instance profile, etc.)
  });
}

const s3Client = createS3Client();

/**
 * Upload a file to S3 using AWS SDK v3 PutObjectCommand
 */
export const uploadFile = async (params: S3UploadParams): Promise<S3UploadResult> => {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
    ...(params.contentType ? { ContentType: params.contentType } : {}),
  });

  await s3Client.send(command);

  const location = `https://${params.bucket}.s3.amazonaws.com/${params.key}`;

  return {
    location,
    bucket: params.bucket,
    key: params.key,
  };
};
