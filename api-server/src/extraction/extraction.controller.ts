import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ExtractionService } from './extraction.service';
import { ExtractDocumentDto } from './dto/extract-document.dto';
import {
  ExtractionResponse,
  ExtractionStatusResponse,
} from './interfaces/extraction.interface';
import { SessionGuard } from '../auth/session.guard';
import { StorageService } from '../storage/storage.service';
import {
  getRecentExtractions,
  getDashboardStats,
  getAllExtractions,
  DashboardStats,
  ExtractedFile,
  createExtractionJob,
  updateExtractionJob,
  getExtractionJobById,
  getUsageStats,
  UsageStats,
} from './extraction-queries';

@Controller('v1/extraction')
@UseGuards(SessionGuard)
export class ExtractionController {
  private readonly logger = new Logger(ExtractionController.name);

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly storageService: StorageService,
  ) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  async extractDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() extractDto: ExtractDocumentDto,
    @Req() request: Request,
  ): Promise<ExtractionResponse> {
    this.logger.log(
      `Received extraction request for file: ${file?.originalname}`,
    );

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = (request as any).user?.id || 'test-user';
    const targetLanguage = extractDto.target_language || 'en';
    const preserveNames = extractDto.preserve_names !== false;

    // Start extraction - api-server handles S3 operations
    const extractionResult = await this.extractionService.startExtraction(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
      targetLanguage,
      preserveNames,
    );

    // Create job record in database (optional - won't fail extraction if DB is down)
    const jobId = extractionResult.job_id;
    if (jobId) {
      try {
        await createExtractionJob(
          userId,
          file.originalname,
          extractionResult.file_url || '',
          jobId,
        );
      } catch (dbError) {
        this.logger.warn(
          `Failed to create job record in database: ${dbError.message}`,
        );
      }
    }

    return extractionResult;
  }

  @Get('status/:jobId')
  async getExtractionStatus(
    @Param('jobId') jobId: string,
  ): Promise<ExtractionStatusResponse> {
    const status = await this.extractionService.getExtractionStatus(jobId);

    // Update job in database when status is completed or failed (optional)
    if (status.status === 'completed' || status.status === 'failed') {
      try {
        await updateExtractionJob(
          jobId,
          status.status,
          status.data || null,
          status.error || undefined,
        );
      } catch (dbError) {
        this.logger.warn(
          `Failed to update job record in database: ${dbError.message}`,
        );
      }
    }

    return status;
  }

  @Get('jobs')
  async getExtractionJobs(
    @Query('limit') limit: string,
    @Req() request: Request,
  ): Promise<{ jobs: ExtractedFile[]; stats: DashboardStats }> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const userId = (request as any).user?.id;
    const jobs = await getRecentExtractions(userId, limitNum);
    const stats = await getDashboardStats(userId);
    return { jobs, stats };
  }

  @Get('job/:id')
  async getExtractionJob(
    @Param('id') id: string,
  ): Promise<ExtractedFile | null> {
    return getExtractionJobById(id);
  }

  @Get('stats')
  async getStats(@Req() request: Request): Promise<DashboardStats> {
    const userId = (request as any).user?.id;
    return getDashboardStats(userId);
  }

  @Get('usage')
  async getUsage(@Req() request: Request): Promise<UsageStats> {
    const userId = (request as any).user?.id;
    return getUsageStats(userId);
  }

  @Get('health')
  async checkHealth(): Promise<{ status: string; service: string }> {
    return this.extractionService.checkHealth();
  }

  @Get('original-file/:jobId')
  async getOriginalFileUrl(
    @Param('jobId') jobId: string,
  ): Promise<{ url: string | null }> {
    this.logger.log(`Getting original file URL for job: ${jobId}`);

    try {
      // Get the job from database
      const job = await getExtractionJobById(jobId);
      if (!job) {
        return { url: null };
      }

      // Get the file URL from the job
      const fileUrl = job.fileUrl;
      if (!fileUrl) {
        return { url: null };
      }

      // Extract the key from the file URL and generate signed URL
      const key = this.storageService.extractKeyFromUrl(fileUrl);
      const signedUrl = await this.storageService.getSignedDownloadUrl(key);

      return { url: signedUrl };
    } catch (error) {
      this.logger.error(
        `Failed to get original file URL for job ${jobId}: ${error.message}`,
        error.stack,
      );
      return { url: null };
    }
  }

  @Put(':jobId')
  async updateExtractionResult(
    @Param('jobId') jobId: string,
    @Body() body: { data: any },
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Updating extraction result for job: ${jobId}`);
    this.logger.log(`Received data type: ${typeof body.data}`);
    this.logger.log(`Received data keys: ${Object.keys(body.data || {})}`);

    try {
      // Validate data
      if (!body.data) {
        this.logger.error('No data provided in request body');
        throw new BadRequestException('No data provided');
      }

      // Get the job from database, or fall back to in-memory cache
      let job = await getExtractionJobById(jobId);

      if (!job) {
        // Try to get from in-memory cache
        const cachedJob = this.extractionService.getJobFromCache(jobId);
        if (cachedJob) {
          this.logger.log(
            `Job not in DB, creating from cache for jobId: ${jobId}`,
          );
          // Create job record in DB from cached data
          await createExtractionJob(
            'unknown', // userId not available in this context
            'unknown',
            cachedJob.fileUrl || '',
            jobId,
          );
          job = await getExtractionJobById(jobId);
        }
      }

      if (!job) {
        this.logger.error(`Job not found: ${jobId}`);
        throw new BadRequestException('Job not found');
      }

      this.logger.log(`Found job: ${jobId}, fileName: ${job.fileName}`);

      // Upload updated JSON to S3 (output folder)
      const fileName = job.fileName;
      const outputKey = `output/${jobId}/${encodeURIComponent(fileName)}.json`;
      const jsonBuffer = Buffer.from(JSON.stringify(body.data, null, 2));

      this.logger.log(`Uploading to S3 with key: ${outputKey}`);
      await this.storageService.uploadFile(
        outputKey,
        jsonBuffer,
        'application/json',
        {
          jobId,
          originalName: fileName,
          updated: 'true',
        },
      );
      this.logger.log(`Updated extraction result in S3: ${outputKey}`);

      // Update database with new result
      this.logger.log(`Updating database for job: ${jobId}`);
      await updateExtractionJob(jobId, 'completed', body.data);
      this.logger.log(
        `Updated extraction result in database for job: ${jobId}`,
      );

      // Update in-memory cache so subsequent status calls return updated data
      this.logger.log(`Updating in-memory cache for job: ${jobId}`);
      this.extractionService.updateJobResult(
        jobId,
        body.data,
        job.fileUrl,
        job.fileName,
      );

      return {
        success: true,
        message: 'Extraction result updated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to update extraction result for job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to update extraction result: ${error.message}`,
      );
    }
  }
}
