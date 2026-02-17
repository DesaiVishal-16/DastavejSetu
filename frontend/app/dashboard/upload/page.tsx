'use client';

import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  LogOut,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useCallback, useState } from 'react';

import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/language-context';
import {
  pollExtractionStatus,
  saveExtractionResult,
  uploadAndExtractFile,
} from '@/lib/api-client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  outputFormat: string;
  error?: string;
}

export default function UploadPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const simulateUpload = useCallback(async (file: File, fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'uploading', progress: 0 } : f,
      ),
    );

    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'processing' } : f)),
      );

      // Start extraction and get job_id
      const { jobId, fileUrl: initialFileUrl } = await uploadAndExtractFile(
        file,
        (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress } : f)),
          );
        },
      );

      // Poll for results
      const { data: extractionResult, fileUrl } = await pollExtractionStatus(
        jobId,
        (status) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: status === 'processing' ? 'processing' : f.status,
                  }
                : f,
            ),
          );
        },
      );

      // Save result and fileUrl to localStorage using both fileId and jobId
      saveExtractionResult(jobId, extractionResult); // Save with jobId (actual backend job ID)
      if (fileUrl || initialFileUrl) {
        localStorage.setItem(
          `file_url_${fileId}`,
          fileUrl || initialFileUrl || '',
        );
        localStorage.setItem(
          `file_url_${jobId}`,
          fileUrl || initialFileUrl || '',
        );
        // Store jobId mapping for view page
        localStorage.setItem(`job_id_${fileId}`, jobId);
      }
      // Save original filename for export
      const originalFile = files.find((f) => f.id === fileId);
      if (originalFile) {
        const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
        localStorage.setItem(`file_name_${fileId}`, baseName);
        localStorage.setItem(`file_name_${jobId}`, baseName);
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'completed', progress: 100 } : f,
        ),
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : f,
        ),
      );
    }
  }, []);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      const validFiles = newFiles.filter((file) => {
        const validTypes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/tiff',
        ];
        return validTypes.includes(file.type);
      });

      const newUploadedFiles: UploadedFile[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: 'uploading',
        outputFormat: 'Excel',
      }));

      setFiles((prev) => [...prev, ...newUploadedFiles]);

      newUploadedFiles.forEach((file) => {
        const originalFile = validFiles.find(
          (f) => f.name === file.name && f.size === file.size,
        );
        if (originalFile) {
          simulateUpload(originalFile, file.id);
        }
      });
    },
    [simulateUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    },
    [handleFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      handleFiles(selectedFiles);
    },
    [handleFiles],
  );

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    } else if (type.includes('image')) {
      return <FileImage className="h-8 w-8 text-blue-500" />;
    }
    return <FileType2 className="h-8 w-8 text-slate-500" />;
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-amber-500" />;
      case 'uploading':
        return <Loader2 className="h-5 w-5 animate-spin text-[#124AB9]" />;
      case 'error':
        return <X className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
            {t.dashboard.completed}
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="border-amber-200 bg-amber-100 text-amber-700">
            {t.dashboard.processing}
          </Badge>
        );
      case 'uploading':
        return (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700">
            {t.upload.uploading}
          </Badge>
        );
      case 'error':
        return (
          <Badge className="border-red-200 bg-red-100 text-red-700">
            {t.upload.error}
          </Badge>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="upload" />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#27272a] dark:bg-[#18181b]">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9] dark:text-zinc-400"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.upload.backToDashboard}
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

        {/* Upload Content */}
        <div className="space-y-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t.upload.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t.upload.subtitle}
            </p>
          </div>

          {/* Upload Area */}
          <Card>
            <CardContent className="p-0">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed p-12 transition-colors ${
                  isDragging
                    ? 'border-[#124AB9] bg-[#124AB9]/5'
                    : 'border-slate-300 hover:border-slate-400 dark:border-zinc-600 dark:hover:border-zinc-500'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.tiff"
                  onChange={handleFileInput}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#124AB9]/10">
                  <Upload className="h-8 w-8 text-[#124AB9]" />
                </div>
                <p className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                  {t.upload.dropFilesHere}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  {t.upload.clickToBrowse}
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    PDF
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    PNG
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    JPG
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    TIFF
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.upload.uploadQueue}</CardTitle>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {files.filter((f) => f.status === 'completed').length}{' '}
                  {t.upload.filesProcessed} {files.length}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-zinc-700"
                  >
                    {getFileIcon(file.type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {file.name}
                        </p>
                        {getStatusBadge(file.status)}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {formatFileSize(file.size)} • {t.dashboard.output}:{' '}
                        {file.outputFormat}
                      </p>
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-2" />
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                            {Math.round(file.progress)}% {t.upload.uploaded}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      {file.status === 'completed' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#124AB9] hover:text-[#0d3a94]"
                            onClick={() =>
                              router.push(`/dashboard/files/${file.id}`)
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {t.upload.view}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#124AB9] hover:text-[#0d3a94]"
                          >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            {t.upload.download}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-500 dark:text-zinc-400"
                        onClick={() => removeFile(file.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>{t.upload.supportedFormats}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
                  <FileText className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      PDF
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {t.upload.scannedTextBased}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
                  <FileImage className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      PNG
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {t.upload.highQuality}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
                  <FileImage className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      JPG/JPEG
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {t.upload.compressed}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
                  <FileImage className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      TIFF
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {t.upload.professionalScans}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
