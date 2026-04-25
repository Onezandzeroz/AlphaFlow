/**
 * Backup Scheduler for AlphaAi Accounting
 *
 * Implements Danish Bookkeeping Law §15 compliance:
 * - Automated hourly/daily/weekly/monthly backups via cron
 * - First-data-triggered initial backup (fires when tenant first inputs data)
 * - Automatic retention cleanup per policy
 *
 * Architecture:
 * - Scheduler starts on Next.js server boot (via instrumentation.ts)
 * - Iterates all active companies with data on each schedule tick
 * - Per-company dedup: skips if a backup of the same type already exists
 *   within the last N minutes (prevents rapid re-runs in dev)
 */

import cron, { type ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { runAutomaticBackup, cleanupExpiredBackups, BackupType } from '@/lib/backup-engine';
import { logger } from '@/lib/logger';

// ─── In-memory dedup tracking ───────────────────────────────────────────────
// Prevents creating duplicate backups of the same type within a cooldown window
// for the same company. Key = `${companyId}:${backupType}`
const LAST_AUTO_BACKUP: Map<string, number> = new Map();

// Cooldown periods (ms) per backup type – avoids hammering disk during dev restarts
const COOLDOWN_MS: Record<BackupType, number> = {
  hourly:  50 * 60 * 1000,   // 50 minutes
  daily:   22 * 60 * 1000,   // 22 hours
  weekly:  6  * 24 * 60 * 1000, // 6 days
  monthly: 28 * 24 * 60 * 1000, // 28 days
};

// Track which companies already received their first-data backup
// so we don't re-trigger on every subsequent write
const FIRST_BACKUP_DONE: Set<string> = new Set();

// ─── Cron expressions ───────────────────────────────────────────────────────
// These match the retention policy in backup-engine.ts

const SCHEDULES: { type: BackupType; cron: string; label: string }[] = [
  { type: 'hourly',  cron: '5 * * * *',       label: 'Hourly backup' },   // minute 5 every hour
  { type: 'daily',   cron: '15 2 * * *',       label: 'Daily backup' },    // 02:15 every day
  { type: 'weekly',  cron: '30 3 * * 1',       label: 'Weekly backup' },   // 03:30 every Monday
  { type: 'monthly', cron: '0 4 1 * *',        label: 'Monthly backup' },  // 04:00 on the 1st
];

// ─── Scheduled tasks (for cleanup on shutdown) ──────────────────────────────
const scheduledTasks: ScheduledTask[] = [];

/**
 * Get all active companies that have actual tenant data.
 * A company is considered to have data if it has any transactions,
 * journal entries, or invoices.
 */
async function getActiveCompaniesWithData(): Promise<{ userId: string; companyId: string }[]> {
  // Find companies that have at least one transaction, journal entry, or invoice
  const companiesWithData = await db.$queryRaw<Array<{ userId: string; companyId: string }>>`
    SELECT DISTINCT uc."userId", uc."companyId"
    FROM "UserCompany" uc
    JOIN "Company" c ON c.id = uc."companyId"
    WHERE (
      EXISTS (SELECT 1 FROM "Transaction" t WHERE t."companyId" = uc."companyId" AND t."cancelled" = false LIMIT 1)
      OR EXISTS (SELECT 1 FROM "JournalEntry" je WHERE je."companyId" = uc."companyId" AND je."isDemo" = false LIMIT 1)
      OR EXISTS (SELECT 1 FROM "Invoice" i WHERE i."companyId" = uc."companyId" LIMIT 1)
    )
    AND uc."role" IN ('OWNER', 'ADMIN', 'EDITOR')
  `;

  return companiesWithData;
}

/**
 * Run scheduled backups for all companies with data.
 */
async function runScheduledBackupCycle(backupType: BackupType): Promise<void> {
  try {
    const companies = await getActiveCompaniesWithData();

    if (companies.length === 0) {
      logger.debug(`[BACKUP-SCHEDULER] ${backupType} cycle: no companies with data found`);
      return;
    }

    let successCount = 0;
    let skipCount = 0;

    for (const { userId, companyId } of companies) {
      // Dedup check: skip if we already backed up this company recently
      const key = `${companyId}:${backupType}`;
      const lastRun = LAST_AUTO_BACKUP.get(key) ?? 0;
      const cooldown = COOLDOWN_MS[backupType];

      if (Date.now() - lastRun < cooldown) {
        skipCount++;
        continue;
      }

      try {
        await runAutomaticBackup(userId, companyId, backupType);
        LAST_AUTO_BACKUP.set(key, Date.now());
        successCount++;
      } catch (error) {
        logger.error(`[BACKUP-SCHEDULER] Failed ${backupType} backup for company ${companyId}:`, error);
      }
    }

    logger.info(
      `[BACKUP-SCHEDULER] ${backupType} cycle complete: ${successCount} backed up, ${skipCount} skipped (cooldown)`,
      { total: companies.length, success: successCount, skipped: skipCount }
    );
  } catch (error) {
    logger.error(`[BACKUP-SCHEDULER] ${backupType} cycle error:`, error);
  }
}

/**
 * Start all backup cron schedules.
 * Called once from instrumentation.ts on server startup.
 */
export function startBackupScheduler(): void {
  // Don't start in test or if explicitly disabled
  if (process.env.DISABLE_BACKUP_SCHEDULER === 'true') {
    logger.info('[BACKUP-SCHEDULER] Disabled via DISABLE_BACKUP_SCHEDULER env');
    return;
  }

  logger.info('[BACKUP-SCHEDULER] Starting backup automation...');

  for (const { type, cron: cronExpr, label } of SCHEDULES) {
    if (!cron.validate(cronExpr)) {
      logger.error(`[BACKUP-SCHEDULER] Invalid cron expression for ${label}: ${cronExpr}`);
      continue;
    }

    const task = cron.schedule(cronExpr, () => {
      runScheduledBackupCycle(type);
    });

    scheduledTasks.push(task);
    logger.info(`[BACKUP-SCHEDULER] Scheduled "${label}" (${type}): ${cronExpr}`);
  }

  // Also run a full cleanup cycle daily at 03:00
  const cleanupTask = cron.schedule('0 3 * * *', async () => {
    try {
      const companies = await getActiveCompaniesWithData();
      let totalCleaned = 0;
      for (const { userId } of companies) {
        const n = await cleanupExpiredBackups(userId);
        totalCleaned += n;
      }
      if (totalCleaned > 0) {
        logger.info(`[BACKUP-SCHEDULER] Daily cleanup: removed ${totalCleaned} expired backups`);
      }
    } catch (error) {
      logger.error('[BACKUP-SCHEDULER] Daily cleanup error:', error);
    }
  });
  scheduledTasks.push(cleanupTask);

  logger.info(`[BACKUP-SCHEDULER] Active with ${scheduledTasks.length} scheduled tasks`);
}

/**
 * Stop all backup cron schedules.
 * Called on server shutdown.
 */
export function stopBackupScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  logger.info('[BACKUP-SCHEDULER] Stopped all scheduled tasks');
}

/**
 * Ensure the first automatic backup is created for a company
 * after its first data input (transaction, journal entry, or invoice).
 *
 * This is the "first tenant transaction" trigger:
 * - Fire-and-forget (non-blocking)
 * - Deduplicated: only runs once per company per server lifetime
 * - Creates a 'daily' backup type as the initial baseline
 *
 * Call this from data-mutating API routes (POST /transactions,
 * POST /journal-entries, POST /invoices, etc.)
 */
export function ensureInitialBackup(companyId: string, userId: string): void {
  // Skip demo companies — no need to back up demo data
  // (We don't have the isDemo flag here, but the backup engine
  // still records it; the initial backup is harmless for demos.)
  if (FIRST_BACKUP_DONE.has(companyId)) {
    return;
  }

  // Mark as done immediately to prevent concurrent calls
  FIRST_BACKUP_DONE.add(companyId);

  // Fire-and-forget — don't block the API response
  // Use setImmediate so the current request finishes first
  setImmediate(async () => {
    try {
      // Check if this company already has any automatic backups
      const existingAuto = await db.backup.count({
        where: {
          companyId,
          triggerType: 'automatic',
          status: 'completed',
        },
      });

      if (existingAuto > 0) {
        logger.debug(`[BACKUP-SCHEDULER] Company ${companyId} already has auto backups, skipping initial`);
        return;
      }

      // Check if the company actually has data (defensive)
      const [txCount, jeCount, invCount] = await Promise.all([
        db.transaction.count({ where: { companyId, cancelled: false } }),
        db.journalEntry.count({ where: { companyId, isDemo: false } }),
        db.invoice.count({ where: { companyId } }),
      ]);

      if (txCount + jeCount + invCount === 0) {
        logger.debug(`[BACKUP-SCHEDULER] Company ${companyId} has no data yet, skipping initial backup`);
        return;
      }

      logger.info(`[BACKUP-SCHEDULER] First data detected for company ${companyId} — creating initial daily backup`);
      await runAutomaticBackup(userId, companyId, 'daily');
      LAST_AUTO_BACKUP.set(`${companyId}:daily`, Date.now());
    } catch (error) {
      logger.error(`[BACKUP-SCHEDULER] Initial backup failed for company ${companyId}:`, error);
      // Don't remove from FIRST_BACKUP_DONE — retrying would spam errors
      // The scheduled daily backup will cover it anyway
    }
  });
}

/**
 * Get the current scheduler status for display in the UI.
 */
export function getSchedulerStatus(): { running: boolean; tasksCount: number; firstBackupCompanies: number } {
  return {
    running: scheduledTasks.length > 0,
    tasksCount: scheduledTasks.length,
    firstBackupCompanies: FIRST_BACKUP_DONE.size,
  };
}
