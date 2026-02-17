import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('TIGRIS_ENDPOINT');
    const region =
      this.configService.get<string>('TIGRIS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('TIGRIS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'TIGRIS_SECRET_ACCESS_KEY',
    );
    this.bucketName =
      this.configService.get<string>('TIGRIS_BUCKET') || 'udayam-files';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.error('Tigris S3 credentials not configured');
      throw new Error('Tigris S3 credentials not configured');
    }

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false, // Use virtual-hosted-style for Tigris
    });

    this.logger.log('Tigris S3 client initialized');
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);
      this.logger.log(`File uploaded successfully: ${key}`);

      // Return the HTTP URL (virtual-hosted-style: https://bucket.endpoint/key)
      const endpoint =
        this.configService.get<string>('TIGRIS_ENDPOINT')?.replace(/\/$/, '') ||
        '';
      return `https://${this.bucketName}.${endpoint.replace('https://', '')}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('File not found');
      }

      this.logger.log(`File retrieved successfully: ${key}`);
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get file: ${error.message}`);
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const stream = await this.getFileStream(key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async getSignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  extractKeyFromUrl(url: string): string {
    // Handle s3://bucket/key format
    if (url.startsWith('s3://')) {
      const parts = url.replace('s3://', '').split('/');
      parts.shift(); // Remove bucket name
      return parts.join('/');
    }
    // Handle full URL format
    const urlObj = new URL(url);
    let pathname = urlObj.pathname.substring(1); // Remove leading slash

    // Handle double-slash bug: remove extra leading slash if present
    // e.g., //bucket/originals/... -> bucket/originals/...
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }

    // Handle old path-style URLs where bucket is in the path (backward compatibility)
    // e.g., https://bucket.t3.storage.dev/bucket/originals/... -> originals/...
    const bucketName = this.bucketName;
    if (pathname.startsWith(`${bucketName}/`)) {
      pathname = pathname.substring(bucketName.length + 1);
    }

    return pathname;
  }
}
