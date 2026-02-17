import { db } from '../database/db';
import { extractionJobs } from '../database/schema';
import { eq, desc, count, and, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedFile {
  id: string;
  fileName: string;
  fileUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  result?: any;
}

export interface DashboardStats {
  totalDocuments: number;
  processedThisMonth: number;
  successRate: number;
  processingTime: string;
}

export async function getRecentExtractions(
  userId?: string,
  limit: number = 10,
): Promise<ExtractedFile[]> {
  if (userId) {
    const results = await db
      .select({
        id: extractionJobs.id,
        fileName: extractionJobs.fileName,
        fileUrl: extractionJobs.fileUrl,
        status: extractionJobs.status,
        createdAt: extractionJobs.createdAt,
        updatedAt: extractionJobs.updatedAt,
        error: extractionJobs.error,
        result: extractionJobs.result,
      })
      .from(extractionJobs)
      .where(eq(extractionJobs.userId, userId))
      .orderBy(desc(extractionJobs.createdAt))
      .limit(limit);
    return results as unknown as ExtractedFile[];
  }

  const results = await db
    .select({
      id: extractionJobs.id,
      fileName: extractionJobs.fileName,
      fileUrl: extractionJobs.fileUrl,
      status: extractionJobs.status,
      createdAt: extractionJobs.createdAt,
      updatedAt: extractionJobs.updatedAt,
      error: extractionJobs.error,
      result: extractionJobs.result,
    })
    .from(extractionJobs)
    .orderBy(desc(extractionJobs.createdAt))
    .limit(limit);
  return results as unknown as ExtractedFile[];
}

export async function getDashboardStats(
  userId?: string,
): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get total documents
  const totalResult = await db
    .select({ count: count() })
    .from(extractionJobs)
    .where(userId ? eq(extractionJobs.userId, userId) : undefined);
  const totalDocuments = totalResult[0]?.count || 0;

  // Get processed this month
  const monthConditions = userId
    ? and(
        eq(extractionJobs.userId, userId),
        gte(extractionJobs.createdAt, startOfMonth),
      )
    : gte(extractionJobs.createdAt, startOfMonth);
  const monthResult = await db
    .select({ count: count() })
    .from(extractionJobs)
    .where(monthConditions);
  const processedThisMonth = monthResult[0]?.count || 0;

  // Get success rate
  const successConditions = userId
    ? and(
        eq(extractionJobs.userId, userId),
        eq(extractionJobs.status, 'completed'),
      )
    : eq(extractionJobs.status, 'completed');
  const successResult = await db
    .select({ count: count() })
    .from(extractionJobs)
    .where(successConditions);
  const successCount = successResult[0]?.count || 0;
  const successRate =
    totalDocuments > 0
      ? ((successCount / totalDocuments) * 100).toFixed(1)
      : '0.0';

  return {
    totalDocuments,
    processedThisMonth,
    successRate: parseFloat(successRate),
    processingTime: '2.4s',
  };
}

export async function getAllExtractions(
  userId?: string,
): Promise<ExtractedFile[]> {
  if (userId) {
    const results = await db
      .select({
        id: extractionJobs.id,
        fileName: extractionJobs.fileName,
        fileUrl: extractionJobs.fileUrl,
        status: extractionJobs.status,
        createdAt: extractionJobs.createdAt,
        updatedAt: extractionJobs.updatedAt,
        error: extractionJobs.error,
        result: extractionJobs.result,
      })
      .from(extractionJobs)
      .where(eq(extractionJobs.userId, userId))
      .orderBy(desc(extractionJobs.createdAt));
    return results as unknown as ExtractedFile[];
  }

  const results = await db
    .select({
      id: extractionJobs.id,
      fileName: extractionJobs.fileName,
      fileUrl: extractionJobs.fileUrl,
      status: extractionJobs.status,
      createdAt: extractionJobs.createdAt,
      updatedAt: extractionJobs.updatedAt,
      error: extractionJobs.error,
      result: extractionJobs.result,
    })
    .from(extractionJobs)
    .orderBy(desc(extractionJobs.createdAt));
  return results as unknown as ExtractedFile[];
}

export async function createExtractionJob(
  userId: string,
  fileName: string,
  fileUrl: string,
  jobId?: string,
): Promise<ExtractedFile> {
  const id = jobId || uuidv4();
  const results = await db
    .insert(extractionJobs)
    .values({
      id,
      userId,
      fileName,
      fileUrl,
      status: 'pending',
    })
    .returning({
      id: extractionJobs.id,
      fileName: extractionJobs.fileName,
      fileUrl: extractionJobs.fileUrl,
      status: extractionJobs.status,
      createdAt: extractionJobs.createdAt,
      updatedAt: extractionJobs.updatedAt,
      error: extractionJobs.error,
      result: extractionJobs.result,
    });
  return results[0] as unknown as ExtractedFile;
}

export async function updateExtractionJob(
  jobId: string,
  status: string,
  result?: any,
  error?: string,
): Promise<ExtractedFile | null> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (result !== undefined) {
    updateData.result = result;
  }
  if (error !== undefined) {
    updateData.error = error;
  }

  const results = await db
    .update(extractionJobs)
    .set(updateData)
    .where(eq(extractionJobs.id, jobId))
    .returning({
      id: extractionJobs.id,
      fileName: extractionJobs.fileName,
      fileUrl: extractionJobs.fileUrl,
      status: extractionJobs.status,
      createdAt: extractionJobs.createdAt,
      updatedAt: extractionJobs.updatedAt,
      error: extractionJobs.error,
      result: extractionJobs.result,
    });

  return results[0] ? (results[0] as unknown as ExtractedFile) : null;
}

export async function getExtractionJobById(
  jobId: string,
): Promise<ExtractedFile | null> {
  const results = await db
    .select({
      id: extractionJobs.id,
      fileName: extractionJobs.fileName,
      fileUrl: extractionJobs.fileUrl,
      status: extractionJobs.status,
      createdAt: extractionJobs.createdAt,
      updatedAt: extractionJobs.updatedAt,
      error: extractionJobs.error,
      result: extractionJobs.result,
    })
    .from(extractionJobs)
    .where(eq(extractionJobs.id, jobId));

  return results[0] ? (results[0] as unknown as ExtractedFile) : null;
}

export interface UsageStats {
  documentsProcessed: number;
  documentsLimit: number;
  storageUsed: number;
  storageLimit: number;
  apiCalls: number;
  apiCallsLimit: number;
}

export async function getUsageStats(userId?: string): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthConditions = userId
    ? and(
        eq(extractionJobs.userId, userId),
        gte(extractionJobs.createdAt, startOfMonth),
      )
    : gte(extractionJobs.createdAt, startOfMonth);

  const monthResult = await db
    .select({ count: count() })
    .from(extractionJobs)
    .where(monthConditions);

  const documentsProcessed = monthResult[0]?.count || 0;

  return {
    documentsProcessed,
    documentsLimit: 500,
    storageUsed: Math.round(documentsProcessed * 0.5 * 10) / 10,
    storageLimit: 10,
    apiCalls: documentsProcessed * 2,
    apiCallsLimit: 2000,
  };
}
