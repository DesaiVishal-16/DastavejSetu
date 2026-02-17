'use client';

import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  LogOut,
  Save,
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
  getExtractionResult,
  saveExtractionResult,
} from '@/lib/api-client';

interface TableData {
  tableName: string;
  headers: string[];
  rows: string[][];
}

export default function FileEditPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const fileId = params.fileId as string;
  const [extractionData, setExtractionData] = useState<ExtractionResult | null>(
    null,
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storedFileName, setStoredFileName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      // First try to get the jobId from localStorage mapping
      let actualJobId = localStorage.getItem(`job_id_${fileId}`);

      // If no mapping found, try using fileId directly (for backward compatibility)
      if (!actualJobId) {
        actualJobId = fileId;
      }

      const data = await getExtractionResult(actualJobId);
      if (isMounted) {
        setExtractionData(data);
        const storedName = localStorage.getItem(`file_name_${actualJobId}`);
        if (storedName) {
          setStoredFileName(storedName);
        }
        setLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [fileId]);

  const handleCellChange = (
    tableIndex: number,
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    if (!extractionData) return;

    const newTables = [...extractionData.tables];
    newTables[tableIndex] = {
      ...newTables[tableIndex],
      rows: newTables[tableIndex].rows.map((row, rIdx) =>
        rIdx === rowIndex
          ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
          : row,
      ),
    };

    setExtractionData({
      ...extractionData,
      tables: newTables,
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!extractionData) return;

    // Get the actual jobId
    const actualJobId = localStorage.getItem(`job_id_${fileId}`) || fileId;

    console.log('Saving extraction result for job:', actualJobId);
    console.log(
      'Data:',
      JSON.stringify(extractionData).substring(0, 200) + '...',
    );

    const success = await saveExtractionResult(actualJobId, extractionData);
    console.log('Save result:', success);
    if (success) {
      setHasChanges(false);
      router.push(`/dashboard/files/${fileId}`);
    } else {
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/files/${fileId}`);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="upload" />

      <main className="flex-1 overflow-auto">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#27272a] dark:bg-[#18181b]">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/files/${fileId}`}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9] dark:text-zinc-400"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.upload.backToFile}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {t.upload.unsavedChanges}
              </span>
            )}
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
          </div>
        </header>

        <div className="space-y-6 p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {t.upload.editFile}
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {fileId}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-slate-500">Loading...</p>
              </div>
            ) : extractionData?.tables && extractionData.tables.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{t.upload.outputFile}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                      {t.upload.cancel}
                    </Button>
                    <Button
                      className="bg-[#124AB9] hover:bg-[#0d3a94]"
                      onClick={handleSave}
                      disabled={!hasChanges}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {t.upload.save}
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
                      <Download className="mr-2 h-4 w-4" />
                      {t.upload.exportToExcel}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
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
                                  {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-2 py-2">
                                      <Input
                                        value={cell}
                                        onChange={(e) =>
                                          handleCellChange(
                                            tableIndex,
                                            rowIndex,
                                            cellIndex,
                                            e.target.value,
                                          )
                                        }
                                        className="h-8 border-slate-200 focus:border-[#124AB9] focus:ring-[#124AB9]"
                                      />
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
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex h-64 items-center justify-center">
                  <p className="text-slate-500">No extraction data found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
