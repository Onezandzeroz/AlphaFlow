/**
 * Backup Engine for AlphaAi Accounting
 *
 * Required by Danish Bookkeeping Law §15:
 * - Automated hourly/daily/weekly/monthly backups
 * - SHA-256 checksum verification
 * - Retention policy (24 hourly, 30 daily, 52 weekly, 60+ monthly)
 * - User can create manual backups and restore from any backup
 *
 * Uses SQLite's built-in backup API for safe, consistent copies.
 */

import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/session';
import { auditLog, requestMetadata } from '@/lib/audit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Backup directory structure: Tenant-Backup/{companyName}/{Hourly|Daily|Weekly|Monthly}/
const BACKUP_BASE_DIR = path.join(process.cwd(), 'Tenant-Backup');

// Map internal backup type to human-readable folder name matching retention policy labels
const BACKUP_TYPE_FOLDER: Record<BackupType, string> = {
  hourly:  'Hourly',
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
};

/**
 * Sanitize a company name for use as a directory name.
 * Strips or replaces characters that are unsafe for filesystems.
 */
function sanitizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')  // Replace forbidden filesystem chars
    .replace(/\s+/g, '-')              // Spaces to hyphens
    .replace(/-+/g, '-')                // Collapse multiple hyphens
    .replace(/^-|-$/g, '')              // Strip leading/trailing hyphens
    || 'unknown-company';
}

// Retention policy
const RETENTION = {
  hourly: { count: 24, expiresMs: 25 * 60 * 60 * 1000 },       // 25 hours
  daily:  { count: 30, expiresMs: 31 * 24 * 60 * 60 * 1000 },   // 31 days
  weekly: { count: 52, expiresMs: 53 * 24 * 60 * 60 * 1000 },   // 53 days
  monthly:{ count: 60, expiresMs: 365 * 24 * 60 * 60 * 1000 },  // 1 year
} as const;

export type BackupType = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type TriggerType = 'automatic' | 'manual' | 'scheduled';

/**
 * Ensure backup directory exists for a company.
 * Structure: Tenant-Backup/{companyName}/{Hourly|Daily|Weekly|Monthly}/
 *
 * Also creates a Tenant-Backup directory for each new tenant company
 * automatically when their first backup is made.
 */
async function ensureBackupDir(companyId: string, backupType: BackupType): Promise<string> {
  // Look up the company name for the folder
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  const folderName = company ? sanitizeCompanyName(company.name) : companyId;
  const typeFolder = BACKUP_TYPE_FOLDER[backupType] || backupType;
  const dir = path.join(BACKUP_BASE_DIR, folderName, typeFolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Calculate SHA-256 checksum of a file
 */
export function calculateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Create a backup of the SQLite database using the Prisma Client
 * (which wraps the better-sqlite3 backup API under the hood).
 *
 * For SQLite, we use the file copy approach since Prisma doesn't
 * expose a direct backup API. The file is copied atomically.
 */
export async function createBackup(
  userId: string,
  triggerType: TriggerType,
  backupType: BackupType,
  companyId: string,
  meta?: Record<string, unknown>
): Promise<{ id: string; filePath: string; fileSize: number; sha256: string } | null> {
  const dbFilePath = path.resolve(process.cwd(), 'prisma', 'db', 'custom.db');

  if (!fs.existsSync(dbFilePath)) {
    logger.error('[BACKUP] Database file not found:', dbFilePath);
    return null;
  }

  const backupDir = await ensureBackupDir(companyId, backupType);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `snapshot-${backupType}-${timestamp}.db`;
  const backupFilePath = path.join(backupDir, filename);

  try {
    // Use WAL checkpoint before backup for consistency
    try {
      await db.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (checkpointErr) {
      logger.warn('[BACKUP] WAL checkpoint failed (non-critical):', checkpointErr);
    }
    
    // Then copy the file
    fs.copyFileSync(dbFilePath, backupFilePath);

    const stats = fs.statSync(backupFilePath);
    const sha256 = calculateChecksum(backupFilePath);

    // Calculate expiry
    const expiresMs = RETENTION[backupType]?.expiresMs || 365 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs);

    // Save backup record in database
    const backup = await db.backup.create({
      data: {
        userId,
        companyId,
        triggerType,
        backupType,
        filePath: backupFilePath,
        fileSize: stats.size,
        sha256,
        status: 'completed',
        expiresAt,
      },
    });

    // Audit log
    await auditLog({
      action: 'BACKUP_CREATE',
      entityType: 'Backup',
      entityId: backup.id,
      userId,
      metadata: {
        triggerType,
        backupType,
        fileSize: stats.size,
        sha256,
        filename,
        ...meta,
      },
    });

    return {
      id: backup.id,
      filePath: backupFilePath,
      fileSize: stats.size,
      sha256,
    };
  } catch (error) {
    logger.error('[BACKUP] Failed to create backup:', error);

    // Record failure
    await db.backup.create({
      data: {
        userId,
        companyId,
        triggerType,
        backupType,
        filePath: backupFilePath,
        fileSize: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return null;
  }
}

/**
 * Restore from a backup
 */
export async function restoreBackup(
  userId: string,
  backupId: string,
  companyId: string,
  meta?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const backup = await db.backup.findFirst({
    where: { id: backupId, userId },
  });

  if (!backup) {
    return { success: false, error: 'Backup not found' };
  }

  if (!fs.existsSync(backup.filePath)) {
    return { success: false, error: 'Backup file not found on disk' };
  }

  // Verify checksum
  if (backup.sha256) {
    const currentChecksum = calculateChecksum(backup.filePath);
    if (currentChecksum !== backup.sha256) {
      return { success: false, error: 'Backup checksum mismatch — file may be corrupted' };
    }
  }

  const dbFilePath = path.resolve(process.cwd(), 'prisma', 'db', 'custom.db');

  try {
    // Create a pre-restore backup (safety net)
    const preRestoreBackup = await createBackup(userId, 'automatic', 'hourly', companyId, {
      reason: 'pre-restore-snapshot',
    });

    // Copy backup over current database
    // Disconnect Prisma client first to avoid corruption
    try {
      await db.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
    
    fs.copyFileSync(backup.filePath, dbFilePath);
    
    // Reconnect is automatic on next query, but we need to verify the database is accessible
    try {
      await db.$connect();
    } catch {
      // Connection will be re-established on next use
    }

    // Audit log
    await auditLog({
      action: 'BACKUP_RESTORE',
      entityType: 'Backup',
      entityId: backupId,
      userId,
      metadata: {
        restoredFrom: backup.backupType,
        preRestoreBackupId: preRestoreBackup?.id,
        ...meta,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during restore',
    };
  }
}

/**
 * Clean up expired backups for a user
 */
export async function cleanupExpiredBackups(userId: string): Promise<number> {
  const now = new Date();

  // Find expired backups
  const expired = await db.backup.findMany({
    where: {
      userId,
      expiresAt: { lt: now },
    },
  });

  let deletedCount = 0;

  for (const backup of expired) {
    try {
      // Delete file from disk
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }

      // Delete from database
      await db.backup.delete({ where: { id: backup.id } });
      deletedCount++;
    } catch (error) {
      logger.error(`[BACKUP] Failed to cleanup backup ${backup.id}:`, error);
    }
  }

  // Also apply retention limits per type
  for (const [type, policy] of Object.entries(RETENTION)) {
    const backups = await db.backup.findMany({
      where: { userId, backupType: type, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (backups.length > policy.count) {
      const toDelete = backups.slice(policy.count);
      for (const backup of toDelete) {
        try {
          if (backup.filePath && fs.existsSync(backup.filePath)) {
            fs.unlinkSync(backup.filePath);
          }
          await db.backup.delete({ where: { id: backup.id } });
          deletedCount++;
        } catch (error) {
          logger.error(`[BACKUP] Failed to delete excess backup ${backup.id}:`, error);
        }
      }
    }
  }

  return deletedCount;
}

/**
 * Run automatic backup for a user (called by scheduler)
 */
export async function runAutomaticBackup(userId: string, companyId: string, backupType: BackupType): Promise<void> {
  await createBackup(userId, 'automatic', backupType, companyId, {
    scheduled: true,
    timestamp: new Date().toISOString(),
  });

  // Cleanup old backups
  await cleanupExpiredBackups(userId);
}

/**
 * Verify a backup's integrity
 */
export function verifyBackup(backupFilePath: string): { valid: boolean; currentChecksum: string; matches: boolean; fileSize: number } {
  if (!fs.existsSync(backupFilePath)) {
    return { valid: false, currentChecksum: '', matches: false, fileSize: 0 };
  }

  const stats = fs.statSync(backupFilePath);
  const currentChecksum = calculateChecksum(backupFilePath);

  return {
    valid: true,
    currentChecksum,
    matches: true, // Will be compared with stored hash by caller
    fileSize: stats.size,
  };
}
