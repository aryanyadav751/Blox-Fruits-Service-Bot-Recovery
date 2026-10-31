import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Neon Object Storage Client Configuration
 * S3-compatible object storage with branch-aware storage buckets.
 * Target Bucket: blox-fruit-services-media (Private visibility)
 */

export const DEFAULT_BUCKET_NAME = 'blox-fruit-services-media';

// Allowed MIME types for gameplay proofs & evidence
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// Maximum file size: 50MB for screenshots & video clips
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

let s3ClientInstance: S3Client | null = null;

export function isStorageConfigured(): boolean {
  const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const hasEndpoint = Boolean(process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL);
  return hasKeys && hasEndpoint;
}

export function getStorageBucketName(): string {
  return process.env.NEON_STORAGE_BUCKET || DEFAULT_BUCKET_NAME;
}

export function getStorageClient(): S3Client | null {
  if (!isStorageConfigured()) {
    return null;
  }

  if (!s3ClientInstance) {
    const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL;
    const region = process.env.AWS_REGION || 'us-east-2';

    s3ClientInstance = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
      // Strictly required for Neon Object Storage: path-style addressing
      forcePathStyle: true,
    });
  }

  return s3ClientInstance;
}

export interface PresignedUploadOptions {
  orderId?: string;
  filename: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  bucket: string;
  expiresIn: number;
}

/**
 * Validates file extension and MIME type
 */
export function validateMediaUpload(filename: string, contentType: string): { valid: boolean; error?: string } {
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type: ${contentType}. Allowed types: PNG, JPEG, WEBP, MP4, WEBM.`,
    };
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov'];
  if (!ext || !allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension .${ext}. Allowed extensions: png, jpg, jpeg, webp, mp4, webm, mov.`,
    };
  }

  return { valid: true };
}

/**
 * Generates a presigned PUT URL for client-side direct upload to the private bucket.
 * Keeps customer uploads private by default.
 */
export async function generateUploadPresignedUrl(
  options: PresignedUploadOptions
): Promise<PresignedUploadResult> {
  const isProd = process.env.NODE_ENV === 'production';
  const client = getStorageClient();

  if (!client) {
    if (isProd) {
      throw new Error(
        'Neon Object Storage is not configured in production. ' +
        'Please set AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in environment variables.'
      );
    }
    // Development/Test mock fallback
    const mockKey = `evidence/${options.orderId || 'general'}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${options.filename}`;
    return {
      uploadUrl: `https://mock-storage.local/upload?key=${encodeURIComponent(mockKey)}`,
      fileKey: mockKey,
      bucket: getStorageBucketName(),
      expiresIn: options.expiresInSeconds || 900,
    };
  }

  const validation = validateMediaUpload(options.filename, options.contentType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeOrderId = options.orderId ? options.orderId.replace(/[^a-zA-Z0-9_-]/g, '') : 'general';
  const fileKey = `evidence/${safeOrderId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedFilename}`;
  const bucket = getStorageBucketName();
  const expiresIn = options.expiresInSeconds || 900; // 15 minutes

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: options.contentType,
    // Bucket is private by default; no public ACLs are set on upload
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    fileKey,
    bucket,
    expiresIn,
  };
}

/**
 * Generates a presigned GET URL for securely viewing private media
 */
export async function generateDownloadPresignedUrl(
  fileKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const isProd = process.env.NODE_ENV === 'production';
  const client = getStorageClient();

  if (!client) {
    if (isProd) {
      throw new Error('Neon Object Storage is not configured in production.');
    }
    return `https://mock-storage.local/view?key=${encodeURIComponent(fileKey)}`;
  }

  const bucket = getStorageBucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
