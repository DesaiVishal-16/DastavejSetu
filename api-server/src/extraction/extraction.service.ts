import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import {
  ExtractionResponse,
  ExtractionStatusResponse,
  ExtractionResult,
} from './interfaces/extraction.interface';
import { StorageService } from '../storage/storage.service';
import { getExtractionJobById } from './extraction-queries';

// In-memory job storage for synchronous processing
const jobResultsMap = new Map<
  string,
  {
    status: 'completed' | 'failed';
    fileUrl: string;
    fileName?: string;
    data?: ExtractionResult;
    error?: string;
  }
>();

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly pythonApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    const pythonApiUrl = this.configService.get<string>('PYTHON_API_URL');
    if (!pythonApiUrl) {
      throw new Error('PYTHON_API_URL environment variable is not set');
    }
    this.pythonApiUrl = pythonApiUrl;
  }

  async startExtraction(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    targetLanguage: string = 'en',
    preserveNames: boolean = true,
  ): Promise<ExtractionResponse> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      this.logger.log(
        `Starting extraction for file: ${fileName}, jobId: ${jobId}`,
      );

      // Step 1: Upload original file to S3 (originals/)
      const originalKey = `originals/${jobId}/${encodeURIComponent(fileName)}`;
      const originalUrl = await this.storageService.uploadFile(
        originalKey,
        fileBuffer,
        mimeType,
        {
          userId,
          originalName: fileName,
          jobId,
        },
      );
      this.logger.log(`Uploaded original file to S3: ${originalKey}`);

      // Step 2: Send file buffer to api-service for extraction
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      });
      formData.append('target_language', targetLanguage);
      formData.append('preserve_names', preserveNames.toString());

      this.logger.log(`Sending file to Python API for extraction`);

      const response = await firstValueFrom(
        this.httpService.post<ExtractionResult>(
          `${this.pythonApiUrl}/api/v1/ai/file-extractor/extract`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: 600000, // 10 minutes for large files
          },
        ),
      );

      const extractionResult = response.data;
      this.logger.log(
        `Extraction completed - Found ${extractionResult.tables?.length || 0} tables`,
      );

      // Step 3: Upload extraction result JSON to S3 (output/)
      const outputKey = `output/${jobId}/${encodeURIComponent(fileName)}.json`;
      const jsonBuffer = Buffer.from(JSON.stringify(extractionResult, null, 2));
      await this.storageService.uploadFile(
        outputKey,
        jsonBuffer,
        'application/json',
        {
          userId,
          originalName: fileName,
          jobId,
        },
      );
      this.logger.log(`Uploaded extraction result to S3: ${outputKey}`);

      // Step 4: Store result in memory for status endpoint
      jobResultsMap.set(jobId, {
        status: 'completed',
        fileUrl: originalUrl,
        fileName: fileName,
        data: extractionResult,
      });

      // Return job_id for frontend polling (backward compatible)
      return {
        success: true,
        message: 'Extraction completed',
        job_id: jobId,
        file_url: originalUrl,
        data: extractionResult,
      };
    } catch (error) {
      this.logger.error(
        `Extraction failed for job ${jobId}: ${error.message}`,
        error.stack,
      );

      // Store failure in memory
      jobResultsMap.set(jobId, {
        status: 'failed',
        fileUrl: '',
        fileName: fileName,
        error: error.message,
      });

      if (error.response) {
        throw new BadRequestException(
          error.response.data?.detail || 'Extraction failed',
        );
      }

      if (error.code === 'ECONNREFUSED') {
        throw new InternalServerErrorException(
          'Python extraction service is not running. Please start the API service on port 8000.',
        );
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Request to Python service timed out. Please try again.',
        );
      }

      throw new InternalServerErrorException('Document extraction failed');
    }
  }

  async getExtractionStatus(jobId: string): Promise<ExtractionStatusResponse> {
    try {
      // Check in-memory results first (synchronous processing)
      const cachedResult = jobResultsMap.get(jobId);
      if (cachedResult) {
        this.logger.log(
          `getExtractionStatus: Found in memory cache for job ${jobId}`,
        );
        return {
          job_id: jobId,
          status: cachedResult.status,
          file_url: cachedResult.fileUrl,
          data: cachedResult.data,
          error: cachedResult.error,
        };
      }
      this.logger.log(
        `getExtractionStatus: Not found in memory cache for job ${jobId}`,
      );

      // Try to get job from database to get fileName
      let fileName: string | null = null;
      try {
        const dbJob = await getExtractionJobById(jobId);
        if (dbJob) {
          fileName = dbJob.fileName;
          this.logger.log(
            `getExtractionStatus: Found job in DB, fileName: ${fileName}`,
          );
        } else {
          this.logger.log(
            `getExtractionStatus: Job not found in DB for ${jobId}`,
          );
        }
      } catch (dbError) {
        this.logger.warn(`Failed to get job from DB: ${dbError.message}`);
      }

      // Try to fetch from S3 if we have fileName
      if (fileName) {
        // Try encoded key first (new format), then unencoded (old format)
        const keysToTry = [
          `output/${jobId}/${encodeURIComponent(fileName)}.json`,
          `output/${jobId}/${fileName}.json`,
        ];

        for (const outputKey of keysToTry) {
          try {
            this.logger.log(
              `Trying to fetch extraction result from S3: ${outputKey}`,
            );
            const fileExists = await this.storageService.fileExists(outputKey);
            this.logger.log(`S3 file exists (${outputKey}): ${fileExists}`);
            if (!fileExists) {
              continue;
            }
            const jsonBuffer =
              await this.storageService.getFileBuffer(outputKey);
            const data = JSON.parse(jsonBuffer.toString()) as ExtractionResult;

            // Store in memory for future requests
            jobResultsMap.set(jobId, {
              status: 'completed',
              fileUrl: '',
              fileName: fileName,
              data: data,
            });

            return {
              job_id: jobId,
              status: 'completed' as const,
              file_url: '',
              data: data,
            };
          } catch (s3Error) {
            this.logger.warn(
              `Failed to fetch from S3 with key ${outputKey}: ${s3Error.message}`,
            );
          }
        }
      }

      // Fallback to Python API for any legacy jobs
      const response = await firstValueFrom(
        this.httpService.get<ExtractionStatusResponse>(
          `${this.pythonApiUrl}/api/v1/ai/file-extractor/status/${jobId}`,
          {
            timeout: 60000,
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get extraction status: ${error.message}`,
        error.stack,
      );

      if (error.response?.status === 404) {
        throw new BadRequestException('Job not found');
      }

      if (error.code === 'ECONNREFUSED') {
        throw new InternalServerErrorException(
          'Python extraction service is not running.',
        );
      }

      throw new InternalServerErrorException('Failed to get extraction status');
    }
  }

  updateJobResult(
    jobId: string,
    data: ExtractionResult,
    fileUrl: string,
    fileName?: string,
  ): void {
    jobResultsMap.set(jobId, {
      status: 'completed',
      fileUrl: fileUrl,
      fileName: fileName,
      data: data,
    });
    this.logger.log(`Updated in-memory cache for job: ${jobId}`);
  }

  getJobFromCache(jobId: string):
    | {
        status: string;
        fileUrl: string;
        fileName?: string;
        data?: ExtractionResult;
        error?: string;
      }
    | undefined {
    return jobResultsMap.get(jobId);
  }

  async checkHealth(): Promise<{ status: string; service: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.pythonApiUrl}/health`, {
          timeout: 5000,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Python API health check failed', error.message);
      throw new InternalServerErrorException('Python API service unavailable');
    }
  }
}
