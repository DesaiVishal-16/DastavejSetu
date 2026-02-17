export interface TableData {
  tableName: string;
  headers: string[];
  rows: string[][];
}

export interface ExtractionResult {
  tables: TableData[];
  summary: string;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  job_id?: string;
  file_url?: string;
  data: ExtractionResult | null;
}

export interface ExtractionStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  data?: ExtractionResult;
  error?: string;
}

export interface DashboardStats {
  totalDocuments: number;
  processedThisMonth: number;
  successRate: number;
  processingTime: string;
}

export interface DashboardJob {
  id: string;
  fileName: string;
  fileUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  result?: ExtractionResult;
}

export interface DashboardResponse {
  jobs: DashboardJob[];
  stats: DashboardStats;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = API_URL
  ? `${API_URL}/api/v1/extraction`
  : '/api/v1/extraction';

const POLL_INTERVAL = 5000;
const MAX_POLL_ATTEMPTS = 180;

export async function uploadAndExtractFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ fileId: string; jobId: string; fileUrl?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_language', 'en');
  formData.append('preserve_names', 'true');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Set timeout for large file uploads (10 minutes)
    xhr.timeout = 600000;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText) as FileUploadResponse;
        if (response.success && response.job_id) {
          resolve({
            fileId: crypto.randomUUID(),
            jobId: response.job_id,
            fileUrl: response.file_url,
          });
        } else {
          reject(new Error(response.message || 'Extraction failed'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error occurred'));
    });

    xhr.addEventListener('timeout', () => {
      reject(
        new Error('Upload timed out. Please try again with a smaller file.'),
      );
    });

    xhr.open('POST', `${API_BASE}/extract`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

export async function pollExtractionStatus(
  jobId: string,
  onProgress?: (status: string) => void,
): Promise<{ data: ExtractionResult; fileUrl?: string }> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const response = await fetch(`${API_BASE}/status/${jobId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get extraction status');
    }

    const status: ExtractionStatusResponse = await response.json();

    if (onProgress) {
      onProgress(status.status);
    }

    if (status.status === 'completed') {
      if (status.data) {
        return {
          data: status.data,
          fileUrl: status.file_url,
        };
      }
      throw new Error('Extraction completed but no data returned');
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Extraction failed');
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    attempts++;
  }

  throw new Error('Extraction timed out');
}

export async function getExtractionResult(
  fileId: string,
): Promise<ExtractionResult | null> {
  try {
    console.log('getExtractionResult: Calling API for fileId:', fileId);
    const response = await fetch(`${API_BASE}/status/${fileId}`, {
      credentials: 'include',
    });
    console.log('getExtractionResult: Response status:', response.status);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    console.log('getExtractionResult: Full response:', data);
    if (data.data) {
      console.log('getExtractionResult: Returning data.data:', data.data);
      return data.data as ExtractionResult;
    }
    console.log('getExtractionResult: No data.data found');
    return null;
  } catch (error) {
    console.error('Failed to fetch extraction result:', error);
    return null;
  }
}

export async function saveExtractionResult(
  fileId: string,
  data: ExtractionResult,
): Promise<boolean> {
  try {
    console.log('API: Saving extraction result to:', `${API_BASE}/${fileId}`);
    console.log(
      'API: Data being sent:',
      JSON.stringify(data).substring(0, 200) + '...',
    );
    const response = await fetch(`${API_BASE}/${fileId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });

    console.log('API: Save response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: Save failed:', errorText);
      throw new Error('Failed to save extraction result');
    }

    return true;
  } catch (error) {
    console.error('Failed to save extraction result:', error);
    return false;
  }
}

export function exportToExcel(
  data: ExtractionResult,
  fileName: string = 'extracted-data.xlsx',
): void {
  import('xlsx').then((XLSX) => {
    const workbook = XLSX.utils.book_new();

    data.tables.forEach((table, index) => {
      const sheetName = table.tableName || `Table ${index + 1}`;
      const headersWithSrNo = ['Sr No.', ...table.headers];
      const rowsWithSrNo = table.rows.map((row, rowIndex) => [
        rowIndex + 1,
        ...row,
      ]);
      const wsData = [headersWithSrNo, ...rowsWithSrNo];
      const worksheet = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sheetName.substring(0, 31),
      );
    });

    XLSX.writeFile(workbook, fileName);
  });
}

export async function getDashboardData(
  limit: number = 10,
): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE}/jobs?limit=${limit}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return response.json();
}

export async function getExtractionJobById(
  jobId: string,
): Promise<DashboardJob | null> {
  const response = await fetch(`${API_BASE}/job/${jobId}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function getOriginalFileUrl(
  jobId: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/original-file/${jobId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Failed to get original file URL:', error);
    return null;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE}/stats`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.json();
}

export interface UsageStats {
  documentsProcessed: number;
  documentsLimit: number;
  storageUsed: number;
  storageLimit: number;
  apiCalls: number;
  apiCallsLimit: number;
}

export async function getUsageStats(): Promise<UsageStats> {
  const response = await fetch(`${API_BASE}/usage`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch usage stats');
  }

  return response.json();
}
