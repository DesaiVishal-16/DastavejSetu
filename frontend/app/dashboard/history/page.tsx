'use client';

import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Filter,
  LogOut,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

import { useEffect, useState } from 'react';

import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/language-context';
import { type DashboardJob, getDashboardData } from '@/lib/api-client';

interface Document extends DashboardJob {
  type: string;
  outputFormat: string;
  pages?: number;
}

export default function HistoryPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await getDashboardData(100);
        const docs: Document[] = data.jobs.map((job) => ({
          ...job,
          type: getFileType(job.fileName),
          outputFormat: job.status === 'completed' ? 'Excel' : '-',
        }));
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'].includes(ext || '')
    )
      return 'Image';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return 'Excel';
    return 'File';
  };

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'processing':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'Image':
        return <FileImage className="h-4 w-4 text-blue-500" />;
      case 'Excel':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
      default:
        return <FileType2 className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return t.history.completed;
      case 'processing':
        return t.history.processing;
      case 'failed':
        return t.history.failed;
      default:
        return status;
    }
  };

  const completedCount = documents.filter(
    (d) => d.status === 'completed',
  ).length;
  const failedCount = documents.filter((d) => d.status === 'failed').length;
  const processingCount = documents.filter(
    (d) => d.status === 'processing',
  ).length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="history" />

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
              {t.history.backToDashboard}
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

        {/* History Content */}
        <div className="space-y-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t.history.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t.history.subtitle}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm font-medium">
                  {t.history.totalDocuments}
                </p>
                <p className="text-foreground mt-1 text-2xl font-semibold">
                  {documents.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm font-medium">
                  {t.history.completed}
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-600">
                  {completedCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm font-medium">
                  {t.history.processing}
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">
                  {processingCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm font-medium">
                  {t.history.failed}
                </p>
                <p className="mt-1 text-2xl font-semibold text-red-600">
                  {failedCount}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t.history.allDocuments}</CardTitle>
                  <CardDescription>
                    {t.history.showingOf} {filteredDocuments.length}{' '}
                    {t.history.of} {documents.length} {t.history.document}s
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
                    <Input
                      placeholder={t.history.searchDocuments}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 pl-10"
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="h-12 animate-pulse rounded bg-slate-200 dark:bg-zinc-700"
                      ></div>
                    ))}
                </div>
              ) : filteredDocuments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.history.document}</TableHead>
                      <TableHead>{t.history.type}</TableHead>
                      <TableHead>{t.history.status}</TableHead>
                      <TableHead>{t.history.output}</TableHead>
                      <TableHead>{t.history.created}</TableHead>
                      <TableHead className="w-25">
                        {t.history.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.type)}
                            <span className="font-medium text-slate-900 dark:text-white">
                              {doc.fileName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(doc.status)}>
                            {getStatusLabel(doc.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-zinc-400">
                          {doc.outputFormat}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-zinc-400">
                          {formatDate(doc.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {doc.status === 'completed' && (
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t.history.preview}
                                </DropdownMenuItem>
                              )}
                              {doc.status === 'completed' && (
                                <DropdownMenuItem>
                                  <Download className="mr-2 h-4 w-4" />
                                  {t.history.download}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t.history.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-muted-foreground flex h-32 items-center justify-center">
                  No documents found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
