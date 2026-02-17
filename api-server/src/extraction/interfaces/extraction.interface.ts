// Response from Python API service
export interface TableData {
  tableName: string;
  headers: string[];
  rows: string[][];
}

export interface ExtractionResult {
  tables: TableData[];
  summary: string;
}

export interface ExtractionResponse {
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
