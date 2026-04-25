'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@/lib/auth-store';
import { useTranslation } from '@/lib/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield,
  Database,
  Download,
  HardDrive,
  RotateCcw,
  Trash2,
  Clock,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  FileArchive,
  CalendarClock,
  Zap,
  PackageOpen,
  Upload,
  Paperclip,
} from 'lucide-react';
import JSZip from 'jszip';
import { PageHeader } from '@/components/shared/page-header';
import { format, formatDistanceToNow } from 'date-fns';

interface BackupEntry {
  id: string;
  triggerType: 'manual' | 'automatic' | 'scheduled';
  backupType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  filePath: string;
  fileSize: number;
  sha256: string;
  status: 'completed' | 'failed';
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
}

interface BackupPageProps {
  user: User;
}

// Format file size in human-readable form
function formatFileSize(bytes: number, language: 'da' | 'en'): string {
  if (bytes === 0) return `0 ${language === 'da' ? 'B' : 'B'}`;
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Badge color map for backup types
function getBackupTypeBadge(backupType: string) {
  switch (backupType) {
    case 'hourly':
      return 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/20';
    case 'daily':
      return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20';
    case 'weekly':
      return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20';
    case 'monthly':
      return 'bg-[#0d9488]/10 text-[#0d9488] dark:bg-[#0d9488]/20 dark:text-[#2dd4bf] border-[#0d9488]/20';
    default:
      return '';
  }
}

export function BackupPage({ user }: BackupPageProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<{
    accounts: number; contacts: number; transactions: number; invoices: number;
    journalEntries: number; journalLines: number; journalDocuments: number; fiscalPeriods: number;
    budgets: number; recurringEntries: number; bankStatements: number;
    bankStatementLines: number; members: number;
    files?: { total: number; size: number };
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    sourceCompany: string; exportedAt: string;
    imported: Record<string, number>;
    filesIncluded?: boolean;
  } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [includeFiles, setIncludeFiles] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<{
    running: boolean;
    scheduledTasks: number;
    activeForCompany: boolean;
    lastAutoBackup: { at: string; type: string } | null;
    autoBackupCounts: { type: string; count: number; lastAt: string | null }[];
    dataSummary: { transactions: number; journalEntries: number; invoices: number };
  } | null>(null);
  const { t, td, language } = useTranslation();

  // Fetch all backups
  const fetchBackups = useCallback(async () => {
    try {
      const response = await fetch('/api/backups');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Fetch scheduler status
  useEffect(() => {
    async function fetchSchedulerStatus() {
      try {
        const res = await fetch('/api/backups/scheduler-status');
        if (res.ok) {
          const data = await res.json();
          setSchedulerStatus(data.scheduler);
        }
      } catch {
        // Ignore — status display is non-critical
      }
    }
    fetchSchedulerStatus();
    // Refresh every 60 seconds
    const interval = setInterval(fetchSchedulerStatus, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Create manual backup
  const handleCreateBackup = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/backups', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.backup) {
          setBackups((prev) => [data.backup, ...prev]);
        }
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Download backup
  const handleDownload = useCallback(async (backup: BackupEntry) => {
    setIsDownloading(backup.id);
    try {
      const response = await fetch(`/api/backups/download/${backup.id}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = format(new Date(backup.createdAt), 'yyyy-MM-dd_HH-mm');
      a.download = `backup-${backup.backupType}-${dateStr}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download backup:', error);
    } finally {
      setIsDownloading(null);
    }
  }, []);

  // Restore from backup
  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    setIsRestoring(restoreTarget.id);
    try {
      const response = await fetch(`/api/backups/${restoreTarget.id}?action=restore`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh data after restore
        setRestoreTarget(null);
        await fetchBackups();
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
    } finally {
      setIsRestoring(null);
    }
  }, [restoreTarget, fetchBackups]);

  // Delete backup
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(deleteTarget.id);
    try {
      const response = await fetch(`/api/backups/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setBackups((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
    } finally {
      setIsDeleting(null);
    }
  }, [deleteTarget]);

  // Export tenant snapshot as zipped JSON files (optionally with actual uploaded files)
  const handleExportTenantSnapshot = useCallback(async () => {
    setIsExporting(true);
    setExportSummary(null);
    try {
      const params = new URLSearchParams();
      if (includeFiles) params.set('includeFiles', 'true');

      const response = await fetch(`/api/export-tenant${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) throw new Error('Export failed');

      const { exportData, summary, filesData } = await response.json();
      setExportSummary(summary);

      // Build a zip file with structured JSON
      const zip = new JSZip();

      // Root manifest
      zip.file('manifest.json', JSON.stringify(exportData._meta, null, 2));

      // Company settings
      if (exportData.company) {
        zip.file('company.json', JSON.stringify(exportData.company, null, 2));
      }

      // Each data type as its own JSON file
      const dataFiles: Record<string, unknown[]> = {
        'accounts': exportData.accounts,
        'contacts': exportData.contacts,
        'transactions': exportData.transactions,
        'invoices': exportData.invoices,
        'journal-entries': exportData.journalEntries,
        'fiscal-periods': exportData.fiscalPeriods,
        'budgets': exportData.budgets,
        'recurring-entries': exportData.recurringEntries,
        'bank-statements': exportData.bankStatements,
      };

      for (const [filename, data] of Object.entries(dataFiles)) {
        zip.file(`${filename}.json`, JSON.stringify(data, null, 2));
      }

      // Members
      if (exportData.members?.length > 0) {
        zip.file('members.json', JSON.stringify(exportData.members, null, 2));
      }

      // Include actual uploaded files if requested
      if (includeFiles && filesData && typeof filesData === 'object') {
        for (const [relativePath, base64Content] of Object.entries(filesData)) {
          if (typeof base64Content === 'string' && base64Content.length > 0) {
            try {
              zip.file(`files/${relativePath}`, base64Content, { base64: true });
            } catch {
              // Skip files that fail to add
            }
          }
        }
      }

      // Generate zip blob and trigger download
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: includeFiles ? 'DEFLATE' : 'DEFLATE',
        compressionOptions: { level: includeFiles ? 1 : 6 }, // Lower compression for already-compressed files
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const companyName = (exportData.company?.name || 'tenant')
        .replace(/[^a-zA-Z0-9æøåÆØÅ\-_ ]/g, '')
        .replace(/\s+/g, '-');
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      a.download = `alphaflow-${companyName}-${dateStr}${includeFiles ? '-with-files' : ''}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Auto-hide summary after 8 seconds
      setTimeout(() => setExportSummary(null), 8000);
    } catch (error) {
      console.error('Failed to export tenant snapshot:', error);
    } finally {
      setIsExporting(false);
    }
  }, [includeFiles]);

  // Import tenant snapshot from ZIP file
  const handleImportSnapshot = useCallback(async () => {
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('snapshot', importFile);

      const response = await fetch('/api/import-tenant', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Import failed (${response.status})`);
      }

      const data = await response.json();
      setImportResult({
        sourceCompany: data.sourceCompany,
        exportedAt: data.exportedAt,
        imported: data.imported,
        filesIncluded: data.filesIncluded || false,
      });

      // Refresh the page data after a short delay
      setTimeout(() => {
        setShowImportDialog(false);
        setImportFile(null);
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Failed to import snapshot:', error);
    } finally {
      setIsImporting(false);
    }
  }, [importFile]);

  // Stats
  const stats = useMemo(() => {
    const completedBackups = backups.filter((b) => b.status === 'completed');
    const latestBackup = completedBackups.length > 0
      ? completedBackups[0]
      : null;
    const totalStorage = completedBackups.reduce((sum, b) => sum + b.fileSize, 0);
    const failedCount = backups.filter((b) => b.status === 'failed').length;

    return {
      totalBackups: backups.length,
      latestBackup,
      totalStorage,
      failedCount,
    };
  }, [backups]);

  // Retention policy data
  const retentionPolicy = useMemo(() => {
    if (language === 'da') {
      return [
        { type: 'Timesvis', count: 24, period: '25 timer', color: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400' },
        { type: 'Daglig', count: 30, period: '31 dage', color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
        { type: 'Ugentlig', count: 52, period: '53 uger', color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
        { type: 'Månedlig', count: 60, period: '1 år', color: 'bg-[#0d9488]/10 text-[#0d9488] dark:bg-[#0d9488]/20 dark:text-[#2dd4bf]' },
      ];
    }
    return [
      { type: 'Hourly', count: 24, period: '25 hours', color: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400' },
      { type: 'Daily', count: 30, period: '31 days', color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
      { type: 'Weekly', count: 52, period: '53 weeks', color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
      { type: 'Monthly', count: 60, period: '1 year', color: 'bg-[#0d9488]/10 text-[#0d9488] dark:bg-[#0d9488]/20 dark:text-[#2dd4bf]' },
    ];
  }, [language]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="stat-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title={language === 'da' ? 'Sikkerhedskopiering' : 'Data Backup'}
        description={language === 'da'
          ? 'Automatiske sikkerhedskopier i henhold til §15 i Bogføringsloven'
          : 'Automated data backups compliant with §15 of the Danish Bookkeeping Act'}
        action={
          <Button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm gap-2 font-medium transition-all"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {language === 'da' ? 'Opret kopi nu' : 'Create Backup Now'}
          </Button>
        }
      />

      {/* Compliance Banner */}
      <Card className="relative overflow-hidden border-2 border-[#0d9488]/20 dark:border-[#0d9488]/30 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#0d9488]/10 to-transparent rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
        <CardContent className="relative p-3 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] flex items-center justify-center shrink-0 shadow-lg">
              <Shield className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'da' ? 'Bogføringsloven §15' : 'Danish Bookkeeping Act §15'}
                </h3>
                <Badge className="bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/20 dark:bg-[#0d9488]/20 dark:text-[#2dd4bf] dark:border-[#0d9488]/30 text-[10px] sm:text-xs">
                  {language === 'da' ? 'Lovkrav' : 'Legal Requirement'}
                </Badge>
                <div className="hidden sm:block" />
                <div className="sm:hidden ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0d9488]/5 dark:bg-[#0d9488]/10 shrink-0">
                  <p className="text-sm font-bold text-[#0d9488] dark:text-[#2dd4bf]">5</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'da' ? 'år' : 'yr'}
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {language === 'da'
                  ? 'Virksomheder skal opbevare regnskabsmateriale i mindst 5 år. Automatiske sikkerhedskopier sikrer, at dine data altid er sikrede og tilgængelige ved revision.'
                  : 'Businesses must retain accounting records for at least 5 years. Automated backups ensure your data is always secure and available for auditing.'}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <div className="text-center px-3 py-2 rounded-lg bg-[#0d9488]/5 dark:bg-[#0d9488]/10">
                <p className="text-lg font-bold text-[#0d9488] dark:text-[#2dd4bf]">5</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'da' ? 'År opbevaring' : 'Years Retention'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportFile(null); } }}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1f1e] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Upload className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              {language === 'da' ? 'Gendan fra Snapshot' : 'Restore from Snapshot'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-gray-600 dark:text-gray-400">
                  {language === 'da'
                    ? 'Vælg en tidligere eksporteret snapshot-fil (.zip). Alle nuværende data vil blive overskrevet.'
                    : 'Choose a previously exported snapshot file (.zip). All current data will be overwritten.'}
                </p>

                {/* File upload area */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    importFile
                      ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-gray-300 dark:border-gray-600 hover:border-[#0d9488] dark:hover:border-[#2dd4bf] hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.zip';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) setImportFile(file);
                    };
                    input.click();
                  }}
                >
                  {importFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {importFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(importFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImportFile(null); }}
                        className="text-xs text-red-500 hover:text-red-600 underline"
                      >
                        {language === 'da' ? 'Fjern fil' : 'Remove file'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <PackageOpen className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {language === 'da' ? 'Klik for at vælge fil' : 'Click to select file'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        .zip filer
                      </p>
                    </div>
                  )}
                </div>

                {/* Import result inside dialog */}
                {importResult && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {language === 'da' ? 'Import gennemført!' : 'Import complete!'}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {language === 'da'
                        ? `Data fra "${importResult.sourceCompany}" er gendannet. Siden opdateres automatisk...`
                        : `Data from "${importResult.sourceCompany}" has been restored. Page will refresh automatically...`}
                    </p>
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    {language === 'da'
                      ? 'Advarsel: Dette vil slette alle eksisterende data og erstatte dem med data fra snapshot-filen. Opret en backup først, hvis du vil kunne vende tilbage.'
                      : 'Warning: This will delete all existing data and replace it with data from the snapshot file. Create a backup first if you want to be able to revert.'}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="dark:bg-white/5 dark:text-gray-300" onClick={() => { setShowImportDialog(false); setImportFile(null); }} disabled={isImporting}>
              {language === 'da' ? 'Annuller' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleImportSnapshot(); }}
              disabled={isImporting || !importFile || !!importResult}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {language === 'da' ? 'Gendanner...' : 'Restoring...'}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {language === 'da' ? 'Gendan Data' : 'Restore Data'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Cards */}
      {/* Mobile: compact row of 4 indicators in one card */}
      <Card className="stat-card lg:hidden">
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-2">
            {/* Total Backups */}
            <div className="text-center">
              <div className="mx-auto h-8 w-8 rounded-full stat-icon-primary flex items-center justify-center mb-1">
                <Database className="h-3.5 w-3.5 text-[#0d9488] dark:text-[#2dd4bf]" />
              </div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {stats.totalBackups}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {language === 'da' ? 'Kopier' : 'Backups'}
              </p>
            </div>

            {/* Latest Backup */}
            <div className="text-center">
              <div className="mx-auto h-8 w-8 rounded-full stat-icon-green flex items-center justify-center mb-1">
                <Clock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {stats.latestBackup
                  ? formatDistanceToNow(new Date(stats.latestBackup.createdAt), { addSuffix: false })
                  : '—'}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {language === 'da' ? 'Seneste' : 'Latest'}
              </p>
            </div>

            {/* Total Storage */}
            <div className="text-center">
              <div className="mx-auto h-8 w-8 rounded-full stat-icon-amber flex items-center justify-center mb-1">
                <HardDrive className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {formatFileSize(stats.totalStorage, language)}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {language === 'da' ? 'Lagring' : 'Storage'}
              </p>
            </div>

            {/* Compliance */}
            <div className="text-center">
              <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                stats.latestBackup ? 'stat-icon-green' : 'stat-icon-amber'
              }`}>
                <Shield className={`h-3.5 w-3.5 ${
                  stats.latestBackup ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <p className={`text-sm font-bold ${
                stats.latestBackup ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stats.latestBackup
                  ? (language === 'da' ? 'OK' : 'OK')
                  : (language === 'da' ? '!' : '!')}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                §15
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop: original 4 separate cards */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'da' ? 'Totale kopier' : 'Total Backups'}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalBackups}</p>
              </div>
              <div className="h-12 w-12 rounded-full stat-icon-primary flex items-center justify-center">
                <Database className="h-6 w-6 text-[#0d9488] dark:text-[#2dd4bf]" />
              </div>
            </div>
            {stats.failedCount > 0 && (
              <div className="mt-3 flex items-center text-sm text-red-500 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 mr-1" />{stats.failedCount} {language === 'da' ? 'fejlede' : 'failed'}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'da' ? 'Seneste kopi' : 'Latest Backup'}</p>
                {stats.latestBackup ? (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatDistanceToNow(new Date(stats.latestBackup.createdAt), { addSuffix: false })}</p>
                ) : (
                  <p className="text-2xl font-bold text-gray-400 dark:text-gray-500 mt-1">—</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full stat-icon-green flex items-center justify-center"><Clock className="h-6 w-6 text-green-600 dark:text-green-400" /></div>
            </div>
            {stats.latestBackup && (
              <div className="mt-3 flex items-center text-sm text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4 mr-1" />{stats.latestBackup.status === 'completed' ? (language === 'da' ? 'Gennemført' : 'Completed') : (language === 'da' ? 'Fejlet' : 'Failed')}</div>
            )}
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'da' ? 'Total lagring' : 'Total Storage'}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatFileSize(stats.totalStorage, language)}</p>
              </div>
              <div className="h-12 w-12 rounded-full stat-icon-amber flex items-center justify-center"><HardDrive className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div>
            </div>
            <div className="mt-3 flex items-center text-sm text-gray-500 dark:text-gray-400"><HardDrive className="h-4 w-4 mr-1" />{language === 'da' ? 'Brugt plads' : 'Used space'}</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'da' ? 'Overholdelse' : 'Compliance'}</p>
                <p className={`text-2xl font-bold mt-1 ${stats.latestBackup ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{stats.latestBackup ? (language === 'da' ? 'I orden' : 'OK') : (language === 'da' ? 'Advarsel' : 'Warning')}</p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${stats.latestBackup ? 'stat-icon-green' : 'stat-icon-amber'}`}><Shield className={`h-6 w-6 ${stats.latestBackup ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} /></div>
            </div>
            <div className={`mt-3 flex items-center text-sm ${stats.latestBackup ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}><Shield className="h-4 w-4 mr-1" />{stats.latestBackup ? (language === 'da' ? '§15 opfyldt' : '§15 Compliant') : (language === 'da' ? 'Opret en kopi' : 'Create a backup')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Retention Policy */}
      <Card className="stat-card border-0 shadow-lg dark:border dark:border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 text-[#0d9488]" />
              {language === 'da' ? 'Opbevaringspolitik' : 'Retention Policy'}
            </CardTitle>
            {schedulerStatus ? (
              <div className="flex items-center gap-2">
                {schedulerStatus.running ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 gap-1 text-[10px] sm:text-xs">
                    <Zap className="h-3 w-3" />
                    <span className="hidden sm:inline">{language === 'da' ? 'Automatisk aktiv' : 'Auto Active'}</span>
                    <span className="sm:hidden">{language === 'da' ? 'Auto' : 'Auto'}</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-gray-400 text-[10px] sm:text-xs">
                    <XCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">{language === 'da' ? 'Inaktiv' : 'Inactive'}</span>
                  </Badge>
                )}
                {schedulerStatus.lastAutoBackup && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                          {language === 'da' ? 'Seneste' : 'Last'}: {formatDistanceToNow(new Date(schedulerStatus.lastAutoBackup.at), { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{new Date(schedulerStatus.lastAutoBackup.at).toLocaleString('da-DK')}</p>
                        <p className="text-xs text-gray-400">{schedulerStatus.lastAutoBackup.type}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : (
              <Skeleton className="h-6 w-28 rounded-full" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 lg:grid-cols-4 gap-2 lg:gap-3">
            {retentionPolicy.map((policy) => (
              <div
                key={policy.type}
                className="rounded-xl bg-gray-50 dark:bg-white/5 p-2.5 sm:p-4 text-center lg:text-left"
              >
                <p className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-1 sm:mb-2 ${policy.color}`}>
                  {policy.type}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {policy.count}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {language === 'da' ? 'kopier' : 'backups'}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 lg:hidden">
                  {policy.period}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 hidden lg:block">
                  ({policy.period})
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 info-box-primary rounded-lg p-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#0d9488] dark:text-[#2dd4bf]" />
            <p>
              {language === 'da'
                ? 'Automatiske sikkerhedskopier kører i baggrunden. Den første automatiske backup oprettes, når du indtaster din første postering, journalpost eller faktura. Ældre kopier slettes automatisk efter politikken. Manuelle kopier opbevares i 30 dage.'
                : 'Automated backups run in the background. The first automatic backup is created when you enter your first transaction, journal entry, or invoice. Older backups are automatically deleted per the policy. Manual backups are retained for 30 days.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Snapshot + Restore — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tenant Snapshot Export */}
        <Card className="relative overflow-hidden border-2 border-[#0d9488]/20 dark:border-[#0d9488]/30 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#14b8a6]/10 to-transparent rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
          <CardContent className="relative p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#5eead4] flex items-center justify-center shrink-0 shadow-lg">
                <PackageOpen className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {language === 'da' ? 'Data Snapshot' : 'Data Snapshot'}
                  </h3>
                  <Badge className="bg-[#14b8a6]/10 text-[#0d9488] border-[#14b8a6]/20 dark:bg-[#14b8a6]/20 dark:text-[#2dd4bf] dark:border-[#14b8a6]/30">
                    {language === 'da' ? 'Portabel' : 'Portable'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'da'
                    ? 'Download al din virksomheds data som en zippet mappe. Bruges til at migrere til en ny AlphaFlow-instans eller som ekstern sikkerhedskopi.'
                    : 'Download all your company data as a zipped folder. Use it to migrate to a new AlphaFlow instance or as an external backup.'}
                </p>

                {/* Export summary (shown after successful export) */}
                {exportSummary && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { label: language === 'da' ? 'Konti' : 'Accounts', value: exportSummary.accounts },
                      { label: language === 'da' ? 'Poster' : 'Trans.', value: exportSummary.transactions },
                      { label: language === 'da' ? 'Fakturaer' : 'Invoices', value: exportSummary.invoices },
                      { label: language === 'da' ? 'Journal' : 'Journal', value: exportSummary.journalEntries },
                      { label: language === 'da' ? 'Kontakter' : 'Contacts', value: exportSummary.contacts },
                      { label: language === 'da' ? 'Budgetter' : 'Budgets', value: exportSummary.budgets },
                      { label: language === 'da' ? 'Bank' : 'Bank', value: exportSummary.bankStatements },
                      ...(exportSummary.files
                        ? [{ label: language === 'da' ? 'Filer' : 'Files', value: exportSummary.files.total }]
                        : []),
                      { label: language === 'da' ? 'Medlemmer' : 'Members', value: exportSummary.members },
                    ].map((item) => (
                      <div key={item.label} className="text-center px-2 py-1.5 rounded-lg bg-[#14b8a6]/5 dark:bg-[#14b8a6]/10">
                        <p className="text-sm font-bold text-[#0d9488] dark:text-[#2dd4bf]">{item.value}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 info-box-turquoise rounded-lg p-3">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#14b8a6] dark:text-[#2dd4bf]" />
                  <p>
                    {language === 'da'
                      ? 'Indeholder: virksomhedsindstillinger, kontoplan, kontakter, posteringer, fakturaer, journalposter (inkl. bilag), perioder, budgetter, bankudtog, tilbagevendende poster og teammedlemmer.'
                      : 'Contains: company settings, chart of accounts, contacts, transactions, invoices, journal entries (incl. documents), fiscal periods, budgets, bank statements, recurring entries, and team members.'}
                  </p>
                </div>

                {/* Include files checkbox */}
                <div className="mt-3 flex items-center gap-2.5">
                  <Checkbox
                    id="include-files"
                    checked={includeFiles}
                    onCheckedChange={(checked) => setIncludeFiles(checked === true)}
                    className="data-[state=checked]:bg-[#14b8a6] data-[state=checked]:border-[#14b8a6]"
                  />
                  <label
                    htmlFor="include-files"
                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-1.5 select-none"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    {language === 'da'
                      ? 'Inkluder uploadede filer (bilag, kvitteringer)'
                      : 'Include uploaded files (attachments, receipts)'}
                  </label>
                </div>
                {includeFiles && (
                  <p className="mt-1 ml-6 text-[11px] text-gray-400 dark:text-gray-500">
                    {language === 'da'
                      ? 'Alle journalbilag og kvitteringsbilleder inkluderes i zip-filen. Kan gøre filen betydeligt større.'
                      : 'All journal attachments and receipt images will be included in the zip. This may significantly increase the file size.'}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleExportTenantSnapshot}
                disabled={isExporting}
                className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:from-[#0d9488] hover:to-[#0f766e] text-white gap-2 shadow-md hover:shadow-lg transition-all font-medium"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isExporting
                  ? (language === 'da' ? 'Eksporterer...' : 'Exporting...')
                  : (language === 'da' ? 'Download Snapshot' : 'Download Snapshot')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Snapshot Import */}
        <Card className="relative overflow-hidden border-2 border-amber-400/30 dark:border-amber-500/20 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-400/10 to-transparent rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
          <CardContent className="relative p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
                <Upload className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {language === 'da' ? 'Gendan fra Snapshot' : 'Restore from Snapshot'}
                  </h3>
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
                    {language === 'da' ? 'Advarsel' : 'Warning'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'da'
                    ? 'Upload en tidligere eksporteret snapshot-fil for at gendanne din virksomheds data. Dette overskriver alle eksisterende data.'
                    : 'Upload a previously exported snapshot file to restore your company data. This will overwrite all existing data.'}
                </p>

                {/* Import result (shown after successful import) */}
                {importResult && (
                  <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {language === 'da'
                        ? `Gendannet fra "${importResult.sourceCompany}"`
                        : `Restored from "${importResult.sourceCompany}"`}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
                      {Object.entries(importResult.imported).map(([key, count]) => (
                        <div key={key} className="text-center px-1.5 py-1 rounded bg-white dark:bg-green-900/30">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400">{count}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{key}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    {language === 'da'
                      ? 'Alle nuværende data i din virksomhed vil blive slettet og erstattet med data fra snapshot-filen. Denne handling kan ikke fortrydes!'
                      : 'All current data in your company will be deleted and replaced with data from the snapshot file. This action cannot be undone!'}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => { setImportFile(null); setImportResult(null); setShowImportDialog(true); }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 shadow-md hover:shadow-lg transition-all font-medium"
              >
                <Upload className="h-4 w-4" />
                {language === 'da' ? 'Upload Snapshot' : 'Upload Snapshot'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup List */}
      <Card className="stat-card border-0 shadow-lg dark:border dark:border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-[#0d9488]" />
              {language === 'da' ? 'Sikkerhedskopier' : 'Backups'}
              <Badge variant="outline" className="text-xs font-normal">
                {backups.length}
              </Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBackups}
              className="gap-1 text-gray-500 hover:text-[#0d9488] dark:text-gray-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {language === 'da' ? 'Opdater' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-white/5 mb-4">
                <Database className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {language === 'da' ? 'Ingen sikkerhedskopier endnu' : 'No backups yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                {language === 'da'
                  ? 'Opret din første sikkerhedskopi for at sikre dine regnskabsdata i henhold til loven.'
                  : 'Create your first backup to secure your accounting data in compliance with regulations.'}
              </p>
              <Button
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {language === 'da' ? 'Opret første kopi' : 'Create First Backup'}
              </Button>
            </div>
          ) : (
            /* Backup List */
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center gap-2.5 p-2.5 sm:p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
                >
                  {/* Left: Icon + Type */}
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                    backup.backupType === 'hourly' ? 'stat-icon-turquoise' :
                    backup.backupType === 'daily' ? 'stat-icon-green' :
                    backup.backupType === 'weekly' ? 'stat-icon-amber' :
                    'stat-icon-purple'
                  }`}>
                    {backup.backupType === 'hourly' ? (
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600 dark:text-sky-400" />
                    ) : backup.backupType === 'daily' ? (
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : backup.backupType === 'weekly' ? (
                      <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Database className="h-4 w-4 sm:h-5 sm:w-5 text-[#0d9488] dark:text-[#2dd4bf]" />
                    )}
                  </div>

                  {/* Middle: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] sm:text-xs px-1.5 sm:px-2 ${getBackupTypeBadge(backup.backupType)}`}>
                        {backup.backupType}
                      </Badge>
                      {backup.status === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{formatFileSize(backup.fileSize, language)}</span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                      {/* Download */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(backup)}
                              disabled={isDownloading === backup.id || backup.status !== 'completed'}
                              className="text-gray-400 hover:text-[#0d9488] dark:hover:text-[#2dd4bf]"
                            >
                              {isDownloading === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{language === 'da' ? 'Download' : 'Download'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Restore */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRestoreTarget(backup)}
                              disabled={isRestoring === backup.id || backup.status !== 'completed'}
                              className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                            >
                              {isRestoring === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{language === 'da' ? 'Gendan fra kopi' : 'Restore from backup'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Delete */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(backup)}
                              disabled={isDeleting === backup.id}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{language === 'da' ? 'Slet kopi' : 'Delete backup'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1f1e] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              {language === 'da' ? 'Gendan fra sikkerhedskopi?' : 'Restore from Backup?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-gray-600 dark:text-gray-400">
                  {language === 'da'
                    ? 'Dette vil overskrive alle nuværende data med data fra den valgte sikkerhedskopi. Denne handling kan ikke fortrydes!'
                    : 'This will overwrite all current data with data from the selected backup. This action cannot be undone!'}
                </p>

                {/* Backup details */}
                {restoreTarget && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {language === 'da' ? 'Type' : 'Type'}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {restoreTarget.backupType}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {language === 'da' ? 'Dato' : 'Date'}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {format(new Date(restoreTarget.createdAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {language === 'da' ? 'Størrelse' : 'Size'}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatFileSize(restoreTarget.fileSize, language)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Safety note */}
                <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    {language === 'da'
                      ? 'Tip: Opret en ny sikkerhedskopi af de nuværende data, før du gendanner, så du altid kan vende tilbage.'
                      : 'Tip: Create a new backup of your current data before restoring, so you can always revert back.'}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="dark:bg-white/5 dark:text-gray-300" onClick={() => setRestoreTarget(null)}>
              {language === 'da' ? 'Annuller' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isRestoring !== null}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {language === 'da' ? 'Gendanner...' : 'Restoring...'}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {language === 'da' ? 'Gendan data' : 'Restore Data'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1f1e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              {language === 'da' ? 'Slet sikkerhedskopi?' : 'Delete Backup?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              {language === 'da'
                ? 'Er du sikker på, at du vil slette denne sikkerhedskopi? Denne handling kan ikke fortrydes.'
                : 'Are you sure you want to delete this backup? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-white/5 dark:text-gray-300" onClick={() => setDeleteTarget(null)}>
              {language === 'da' ? 'Annuller' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting !== null}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {language === 'da' ? 'Sletter...' : 'Deleting...'}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {language === 'da' ? 'Slet' : 'Delete'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
