'use client';

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  Pencil,
  SplitSquareHorizontal,
  Table2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';

import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import {
  type ExtractionResult,
  exportToExcel,
  getExtractionJobById,
  getExtractionResult,
  getOriginalFileUrl,
} from '@/lib/api-client';

type ViewMode = 'original' | 'output' | 'compare' | null;

const EXTRACTION_API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/extraction`
  : '/api/v1/extraction';

const STORAGE_API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/storage`
  : '/api/v1/storage';

interface TableRow {
  id: string;
  field: string;
  value: string;
}

const mockTableData: TableRow[] = [
  { id: '1', field: 'Invoice Number', value: 'INV-2024-001234' },
  { id: '2', field: 'Date', value: '15-02-2026' },
  { id: '3', field: 'Vendor Name', value: 'ABC Corporation Ltd.' },
  { id: '4', field: 'Total Amount', value: '₹25,000.00' },
  { id: '5', field: 'GST Number', value: '27AABCP1234M1ZN' },
  { id: '6', field: 'Items Count', value: '5' },
  { id: '7', field: 'Tax Amount', value: '₹4,500.00' },
  { id: '8', field: 'Payment Terms', value: 'Net 30' },
];

export default function FileViewPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const fileId = params.fileId as string;
  const [viewMode, setViewMode] = useState<ViewMode>('output');
  const [fileName, setFileName] = useState('sample-document.pdf');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(fileName);
  const [extractionData, setExtractionData] = useState<ExtractionResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [storedFileName, setStoredFileName] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      // First try to get the jobId from localStorage mapping
      let actualJobId = localStorage.getItem(`job_id_${fileId}`);

      // If no mapping found, try using fileId directly (for backward compatibility)
      if (!actualJobId) {
        actualJobId = fileId;
      }

      try {
        const job = await getExtractionJobById(actualJobId);

        if (job) {
          setFileName(job.fileName);
          setEditedName(job.fileName);
          setStoredFileName(job.fileName);

          // Use getExtractionResult to fetch data (handles in-memory, S3, Python API)
          const data = await getExtractionResult(actualJobId);
          console.log('View page - getExtractionResult result:', data);
          setExtractionData(data);

          // Try to get signed URL for original file from API first
          let foundUrl = false;
          console.log('Looking for original file URL, job.id:', job.id);
          if (job.id) {
            try {
              // First try to get signed URL from API
              const signedUrl = await getOriginalFileUrl(job.id);
              console.log('Got signed URL from API:', signedUrl ? 'YES' : 'NO');
              if (signedUrl) {
                setOriginalFileUrl(signedUrl);
                foundUrl = true;
              }
            } catch (e) {
              console.error('Failed to get signed URL from API:', e);
            }

            // Fallback: if job has fileUrl (S3 URL), try to get signed URL from it
            if (!foundUrl && job.fileUrl) {
              try {
                const response = await fetch(`${STORAGE_API_BASE}/signed-url`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileUrl: job.fileUrl }),
                });
                if (response.ok) {
                  const { url } = await response.json();
                  setOriginalFileUrl(url);
                  foundUrl = true;
                }
              } catch (e) {
                console.error('Failed to get signed URL from job.fileUrl:', e);
              }
            }
          }

          // Final fallback to localStorage
          if (!foundUrl) {
            const storedFileUrl = localStorage.getItem(`file_url_${fileId}`);
            if (storedFileUrl) {
              try {
                const response = await fetch(`${STORAGE_API_BASE}/signed-url`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileUrl: storedFileUrl }),
                });
                if (response.ok) {
                  const { url } = await response.json();
                  setOriginalFileUrl(url);
                }
              } catch (e) {
                console.error('Failed to get signed URL from localStorage:', e);
              }
            }
          }
        } else {
          console.log(
            'View page - job not found in DB, trying getExtractionResult',
          );
          const data = await getExtractionResult(actualJobId);
          console.log(
            'View page - getExtractionResult result (else branch):',
            data,
          );
          setExtractionData(data);

          const storedFileUrl = localStorage.getItem(`file_url_${actualJobId}`);
          const storedName = localStorage.getItem(`file_name_${actualJobId}`);
          if (storedName) {
            setStoredFileName(storedName);
            setFileName(storedName);
            setEditedName(storedName);
          }

          // Try to get signed URL from localStorage
          if (storedFileUrl) {
            try {
              const response = await fetch(`${STORAGE_API_BASE}/signed-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileUrl: storedFileUrl }),
              });
              if (response.ok) {
                const { url } = await response.json();
                setOriginalFileUrl(url);
              }
            } catch (e) {
              console.error('Failed to get signed URL:', e);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load job data:', error);
        console.log('View page - job fetch failed, trying getExtractionResult');
        const data = await getExtractionResult(actualJobId);
        console.log(
          'View page - getExtractionResult result (catch block):',
          data,
        );
        setExtractionData(data);

        const storedFileUrl = localStorage.getItem(`file_url_${actualJobId}`);
        const storedName = localStorage.getItem(`file_name_${actualJobId}`);
        if (storedName) {
          setStoredFileName(storedName);
          setFileName(storedName);
          setEditedName(storedName);
        }

        if (storedFileUrl) {
          try {
            const response = await fetch(`${STORAGE_API_BASE}/signed-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileUrl: storedFileUrl }),
            });
            if (response.ok) {
              const { url } = await response.json();
              setOriginalFileUrl(url);
            }
          } catch (e) {
            console.error('Failed to get signed URL:', e);
          }
        }
      }

      setLoading(false);
    }
    loadData();
  }, [fileId]);

  const tableData =
    extractionData?.tables?.[0]?.rows?.map((row, index) => {
      const headers = extractionData?.tables?.[0]?.headers || [];
      return {
        id: String(index + 1),
        field: headers[0] || `Field ${index + 1}`,
        value: row.join(' | '),
      };
    }) || mockTableData;

  const handleViewOriginal = () => {
    setViewMode(viewMode === 'original' ? null : 'original');
  };

  const handleViewOutput = () => {
    setViewMode(viewMode === 'output' ? null : 'output');
  };

  const handleCompare = () => {
    setViewMode(viewMode === 'compare' ? null : 'compare');
  };

  const handleEdit = () => {
    router.push(`/dashboard/files/${fileId}/edit`);
  };

  const handleStartEditName = () => {
    setEditedName(fileName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    setFileName(editedName);
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setEditedName(fileName);
    setIsEditingName(false);
  };

  const renderOriginalView = () => (
    <Card>
      <CardHeader>
        <CardTitle>{t.upload.originalFile}</CardTitle>
      </CardHeader>
      <CardContent>
        {originalFileUrl ? (
          <>
            <div className="h-[600px] w-full overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700">
              <iframe
                src={originalFileUrl}
                className="h-full w-full"
                title="Original Document"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <a
                href={originalFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                Open in new tab
              </a>
            </div>
          </>
        ) : (
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900">
            <div className="text-center">
              <FileText className="mx-auto h-16 w-16 text-slate-400" />
              <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
                {t.upload.originalPreviewPlaceholder}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderOutputView = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t.upload.outputFile}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            extractionData &&
            exportToExcel(
              extractionData,
              `${storedFileName || 'extracted-data'}.xlsx`,
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          {t.upload.exportToExcel}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-slate-500">Loading...</p>
          </div>
        ) : extractionData?.tables && extractionData.tables.length > 0 ? (
          <div className="space-y-6">
            {extractionData.tables.map((table, tableIndex) => (
              <div key={tableIndex}>
                {extractionData.tables.length > 1 && (
                  <h3 className="mb-2 text-lg font-medium">
                    {table.tableName}
                  </h3>
                )}
                <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-800">
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800">
                        <th className="w-16 px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                          Sr No.
                        </th>
                        {table.headers.map((header, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <td className="w-16 px-4 py-3 text-slate-700 dark:text-zinc-300">
                            {rowIndex + 1}
                          </td>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-4 py-3 text-slate-700 dark:text-zinc-300"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {extractionData.summary && (
              <div className="mt-4 rounded-lg bg-slate-100 p-4 dark:bg-zinc-800">
                <h4 className="mb-2 font-medium text-slate-900 dark:text-white">
                  Summary
                </h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {extractionData.summary}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-slate-500">No extraction data found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderCompareView = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t.upload.originalFile}</CardTitle>
        </CardHeader>
        <CardContent>
          {originalFileUrl ? (
            <div className="h-[500px] w-full overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700">
              <iframe
                src={originalFileUrl}
                className="h-full w-full"
                title="Original Document"
              />
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                  {t.upload.originalPreviewPlaceholder}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.upload.outputFile}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-slate-500">Loading...</p>
            </div>
          ) : extractionData?.tables && extractionData.tables.length > 0 ? (
            <div className="max-h-[500px] overflow-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-800">
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="w-12 px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                      Sr No.
                    </th>
                    {extractionData.tables[0].headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extractionData.tables[0].rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <td className="w-12 px-3 py-2 text-slate-700 dark:text-zinc-300">
                        {rowIndex + 1}
                      </td>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-3 py-2 text-slate-700 dark:text-zinc-300"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-slate-500">No data</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="upload" />

      <main className="flex-1 overflow-auto">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#27272a] dark:bg-[#18181b]">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/upload"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9] dark:text-zinc-400"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.upload.backToUpload}
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8 border-2 border-[#124AB9]/20">
                  <AvatarFallback className="bg-linear-to-br from-[#124AB9] to-[#0d3a94] font-semibold text-white">
                    JD
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t.common.myAccount}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t.common.profile}</DropdownMenuItem>
              <DropdownMenuItem>{t.common.settings}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="space-y-6 p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {t.upload.viewFile}
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {fileId}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={viewMode === 'original' ? 'default' : 'outline'}
                  size="sm"
                  className={
                    viewMode === 'original'
                      ? 'bg-[#124AB9]'
                      : 'border-slate-200 hover:border-[#124AB9] hover:text-[#124AB9] dark:border-zinc-700'
                  }
                  onClick={handleViewOriginal}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t.upload.viewOriginal}
                </Button>
                <Button
                  variant={viewMode === 'output' ? 'default' : 'outline'}
                  size="sm"
                  className={
                    viewMode === 'output'
                      ? 'bg-[#124AB9]'
                      : 'border-slate-200 hover:border-[#124AB9] hover:text-[#124AB9] dark:border-zinc-700'
                  }
                  onClick={handleViewOutput}
                >
                  <Table2 className="mr-2 h-4 w-4" />
                  {t.upload.viewOutput}
                </Button>
                <Button
                  variant={viewMode === 'compare' ? 'default' : 'outline'}
                  size="sm"
                  className={
                    viewMode === 'compare'
                      ? 'bg-[#124AB9]'
                      : 'border-slate-200 hover:border-[#124AB9] hover:text-[#124AB9] dark:border-zinc-700'
                  }
                  onClick={handleCompare}
                >
                  <SplitSquareHorizontal className="mr-2 h-4 w-4" />
                  {t.upload.compareBoth}
                </Button>
              </div>
            </div>

            {viewMode === 'original' && renderOriginalView()}
            {viewMode === 'output' && renderOutputView()}
            {viewMode === 'compare' && renderCompareView()}

            {!viewMode && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="h-8 w-64 border-slate-200 focus:border-[#124AB9] focus:ring-[#124AB9]"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                          onClick={handleSaveName}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={handleCancelEditName}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{fileName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-[#124AB9]"
                          onClick={handleStartEditName}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900">
                    <div className="text-center">
                      <FileText className="mx-auto h-16 w-16 text-slate-400" />
                      <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
                        {t.upload.previewComingSoon}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4">
                    <Button variant="outline" onClick={handleEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t.upload.edit}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        extractionData &&
                        exportToExcel(
                          extractionData,
                          `${storedFileName || 'extracted-data'}.xlsx`,
                        )
                      }
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      {t.upload.exportToExcel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode && (
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t.upload.edit}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    extractionData &&
                    exportToExcel(
                      extractionData,
                      `${storedFileName || 'extracted-data'}.xlsx`,
                    )
                  }
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t.upload.exportToExcel}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
