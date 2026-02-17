'use client';

import {
  CheckCircle,
  ChevronDown,
  Clock,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  TrendingUp,
  Upload,
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import {
  type DashboardJob,
  type DashboardStats,
  type UsageStats,
  getDashboardData,
  getUsageStats,
} from '@/lib/api-client';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<DashboardJob[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [data, usage] = await Promise.all([
          getDashboardData(10),
          getUsageStats(),
        ]);
        setStats(data.stats);
        setRecentDocuments(data.jobs);
        setUsageStats(usage);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const statsData = stats
    ? [
        {
          title: t.dashboard.totalDocuments,
          value: stats.totalDocuments.toLocaleString(),
          change: '+12%',
          icon: FileText,
          trend: 'up',
        },
        {
          title: t.dashboard.processedThisMonth,
          value: stats.processedThisMonth.toString(),
          change: '+8%',
          icon: CheckCircle,
          trend: 'up',
        },
        {
          title: t.dashboard.successRate,
          value: `${stats.successRate}%`,
          change: '+0.2%',
          icon: TrendingUp,
          trend: 'up',
        },
        {
          title: t.dashboard.processingTime,
          value: stats.processingTime,
          change: '-15%',
          icon: Clock,
          trend: 'down',
        },
      ]
    : [];

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
        return t.dashboard.completed;
      case 'processing':
        return t.dashboard.processing;
      case 'failed':
        return t.dashboard.failed;
      default:
        return status;
    }
  };

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
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="dashboard" />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#27272a] dark:bg-[#18181b]">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t.dashboard.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t.dashboard.welcomeBack}
              {user?.name ? `, ${user.name}` : ''}!{' '}
              {t.dashboard.documentOverview}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard/upload">
              <Button
                variant="outline"
                className="hover:bg-primary border-2 border-[#124AB9] text-[#124AB9] hover:text-white"
              >
                <Upload className="mr-2 h-4 w-4" />
                {t.dashboard.uploadDocument}
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8 border-2 border-[#124AB9]/20">
                    <AvatarFallback className="bg-linear-to-br from-[#124AB9] to-[#0d3a94] font-semibold text-white">
                      {user ? getInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {user?.name || t.common.myAccount}
                </DropdownMenuLabel>
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>{t.common.profile}</DropdownMenuItem>
                <DropdownMenuItem>{t.common.settings}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.common.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="space-y-6 p-8">
          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {loading
              ? // Loading skeleton
                Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700"></div>
                      </CardContent>
                    </Card>
                  ))
              : statsData.map((stat, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-muted-foreground text-sm font-medium">
                            {stat.title}
                          </p>
                          <p className="text-foreground mt-2 text-3xl font-semibold">
                            {stat.value}
                          </p>
                          <p
                            className={`mt-1 text-xs font-medium ${stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {stat.change} {t.dashboard.fromLastMonth}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#124AB9]/10">
                          <stat.icon className="h-6 w-6 text-[#124AB9]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* Recent Documents & Usage */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Documents Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t.dashboard.recentDocuments}</CardTitle>
                <CardDescription>{t.dashboard.lastProcessed}</CardDescription>
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
                ) : recentDocuments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.dashboard.document}</TableHead>
                        <TableHead>{t.dashboard.type}</TableHead>
                        <TableHead>{t.dashboard.status}</TableHead>
                        <TableHead>{t.dashboard.output}</TableHead>
                        <TableHead>{t.dashboard.date}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/files/${doc.id}`}
                              className="flex items-center gap-3 hover:underline"
                            >
                              {getFileIcon(getFileType(doc.fileName))}
                              <div>
                                <p className="text-foreground font-medium">
                                  {doc.fileName}
                                </p>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getFileType(doc.fileName)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(doc.status)}>
                              {getStatusLabel(doc.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {doc.status === 'completed' ? (
                              doc.result ? (
                                <span className="text-emerald-600">
                                  {doc.result.tables?.length || 0} tables
                                </span>
                              ) : (
                                'Excel'
                              )
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-muted-foreground flex h-32 items-center justify-center">
                    No documents yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{t.dashboard.usageStatistics}</CardTitle>
                <CardDescription>
                  {t.dashboard.monthlyUsageBreakdown}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <>
                    <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700"></div>
                    <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700"></div>
                    <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700"></div>
                  </>
                ) : usageStats ? (
                  <>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.dashboard.documentsProcessed}
                        </span>
                        <span className="text-foreground font-medium">
                          {usageStats.documentsProcessed}/
                          {usageStats.documentsLimit}
                        </span>
                      </div>
                      <Progress
                        value={
                          (usageStats.documentsProcessed /
                            usageStats.documentsLimit) *
                          100
                        }
                        className="mt-2"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        {Math.round(
                          (usageStats.documentsProcessed /
                            usageStats.documentsLimit) *
                            100,
                        )}
                        % {t.dashboard.ofLimit}
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.dashboard.storageUsed}
                        </span>
                        <span className="text-foreground font-medium">
                          {usageStats.storageUsed} GB/{usageStats.storageLimit}{' '}
                          GB
                        </span>
                      </div>
                      <Progress
                        value={
                          (usageStats.storageUsed / usageStats.storageLimit) *
                          100
                        }
                        className="mt-2"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        {Math.round(
                          (usageStats.storageUsed / usageStats.storageLimit) *
                            100,
                        )}
                        % {t.dashboard.ofLimit}
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.dashboard.apiCalls}
                        </span>
                        <span className="text-foreground font-medium">
                          {usageStats.apiCalls}/{usageStats.apiCallsLimit}
                        </span>
                      </div>
                      <Progress
                        value={
                          (usageStats.apiCalls / usageStats.apiCallsLimit) * 100
                        }
                        className="mt-2"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        {Math.round(
                          (usageStats.apiCalls / usageStats.apiCallsLimit) *
                            100,
                        )}
                        % {t.dashboard.ofLimit}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No usage data available
                  </p>
                )}

                <div className="rounded-lg bg-slate-50 p-4 dark:bg-zinc-800">
                  <p className="text-foreground text-sm font-medium">
                    {t.dashboard.currentPlan}
                  </p>
                  <p className="text-lg font-semibold text-[#124AB9]">Pro</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.dashboard.renewsOn} March 1, 2026
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.quickActions}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Link href="/dashboard/upload" className="w-full">
                  <Button
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-2 p-6 text-left hover:border-[#124AB9] hover:bg-[#124AB9]/5"
                  >
                    <Upload className="h-6 w-6 text-[#124AB9]" />
                    <div>
                      <p className="text-foreground font-medium">
                        {t.dashboard.uploadDocument}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t.dashboard.convertPdfImages}
                      </p>
                    </div>
                  </Button>
                </Link>

                <Link href="/dashboard/history" className="w-full">
                  <Button
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-2 p-6 text-left hover:border-[#124AB9] hover:bg-[#124AB9]/5"
                  >
                    <History className="h-6 w-6 text-[#124AB9]" />
                    <div>
                      <p className="text-foreground font-medium">
                        {t.dashboard.viewHistory}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t.dashboard.accessAllFiles}
                      </p>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
