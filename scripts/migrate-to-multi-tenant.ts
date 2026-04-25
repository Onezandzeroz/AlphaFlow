#!/usr/bin/env bun
/**
 * Multi-Tenant Data Migration Script
 * ──────────────────────────────────────────────────────────────────
 * Task ID: 3
 * Migrates existing single-tenant data to the new multi-tenant structure.
 *
 * What it does:
 *   1. For each existing User:
 *      - Reads their CompanyInfo records (live + demo) from the old table
 *      - Creates Company records from CompanyInfo data
 *      - Creates UserCompany records (OWNER role) for each company
 *      - Sets companyId on ALL company-scoped records
 *      - Sets activeCompanyId on all Sessions
 *
 *   2. Edge cases:
 *      - User with no CompanyInfo: creates a Company from businessName or email
 *      - CompanyInfo table missing: creates companies from user data only
 *      - Already-migrated users: skipped (idempotent)
 *
 *   3. Uses SQLite-compatible syntax only
 *
 * Usage:
 *   bun scripts/migrate-to-multi-tenant.ts
 *
 * Idempotent: safe to run multiple times.
 */

import { db } from '../src/lib/db'

// ─── Types ────────────────────────────────────────────────────────

interface CompanyInfoRow {
  id: string
  userId: string
  companyName: string
  address: string
  phone: string
  email: string
  cvrNumber: string
  companyType: string | null
  invoicePrefix: string
  invoiceTerms: string | null
  invoiceNotesTemplate: string | null
  nextInvoiceSequence: number
  currentYear: number
  logo: string | null
  bankName: string
  bankAccount: string
  bankRegistration: string
  bankIban: string | null
  bankStreet: string | null
  bankCity: string | null
  bankCountry: string | null
  isDemo: boolean
  createdAt: string
  updatedAt: string
}

interface Summary {
  usersProcessed: number
  usersSkipped: number
  companiesCreated: number
  userCompaniesCreated: number
  recordsUpdated: Record<string, number>
  sessionsUpdated: number
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function warn(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.warn(`[${ts}] ⚠️  ${msg}`)
}

function error(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.error(`[${ts}] ❌ ${msg}`)
}

/**
 * Check if a table exists in the SQLite database.
 */
async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
  ) as Array<{ name: string }>
  return result.length > 0
}

/**
 * Query the old CompanyInfo table using raw SQL.
 * Grouped by userId and isDemo flag.
 */
async function getCompanyInfos(): Promise<Map<string, CompanyInfoRow[]>> {
  const rows = await db.$queryRawUnsafe(
    `SELECT * FROM CompanyInfo ORDER BY createdAt ASC`
  ) as CompanyInfoRow[]

  const map = new Map<string, CompanyInfoRow[]>()
  for (const row of rows) {
    const list = map.get(row.userId) || []
    list.push(row)
    map.set(row.userId, list)
  }
  return map
}

/**
 * Create a Company record from CompanyInfo data.
 */
function companyDataFromInfo(info: CompanyInfoRow, isDemo: boolean) {
  return {
    name: info.companyName || 'Unnamed Company',
    logo: info.logo || null,
    address: info.address || '',
    phone: info.phone || '',
    email: info.email || '',
    cvrNumber: info.cvrNumber || '',
    companyType: info.companyType || null,
    invoicePrefix: info.invoicePrefix || 'INV',
    invoiceTerms: info.invoiceTerms || null,
    invoiceNotesTemplate: info.invoiceNotesTemplate || null,
    nextInvoiceSequence: info.nextInvoiceSequence || 1,
    currentYear: info.currentYear || new Date().getFullYear(),
    bankName: info.bankName || '',
    bankAccount: info.bankAccount || '',
    bankRegistration: info.bankRegistration || '',
    bankIban: info.bankIban || null,
    bankStreet: info.bankStreet || null,
    bankCity: info.bankCity || null,
    bankCountry: info.bankCountry || null,
    isDemo,
    isActive: true,
  }
}

/**
 * Create a Company record when there's no CompanyInfo (fallback).
 */
function companyDataFromUser(user: { id: string; email: string; businessName: string | null }, isDemo: boolean) {
  const name = user.businessName || user.email.split('@')[0]
  return {
    name,
    logo: null,
    address: '',
    phone: '',
    email: user.email,
    cvrNumber: `MIGRATED-${user.id.slice(0, 8)}`,
    companyType: null,
    invoicePrefix: 'INV',
    invoiceTerms: null,
    invoiceNotesTemplate: null,
    nextInvoiceSequence: 1,
    currentYear: new Date().getFullYear(),
    bankName: '',
    bankAccount: '',
    bankRegistration: '',
    bankIban: null,
    bankStreet: null,
    bankCity: null,
    bankCountry: null,
    isDemo,
    isActive: true,
  }
}

// ─── Main Migration ───────────────────────────────────────────────

async function migrateToMultiTenant() {
  const summary: Summary = {
    usersProcessed: 0,
    usersSkipped: 0,
    companiesCreated: 0,
    userCompaniesCreated: 0,
    recordsUpdated: {
      Transaction: 0,
      Invoice: 0,
      Account: 0,
      JournalEntry: 0,
      Contact: 0,
      FiscalPeriod: 0,
      BankStatement: 0,
      BankConnection: 0,
      RecurringEntry: 0,
      Budget: 0,
      Backup: 0,
      AuditLog: 0,
    },
    sessionsUpdated: 0,
    errors: [],
  }

  log('═══════════════════════════════════════════════════════════════')
  log('  Multi-Tenant Data Migration')
  log('═══════════════════════════════════════════════════════════════')
  log('')

  // ── Step 0: Check if CompanyInfo table exists ──────────────────
  const hasCompanyInfo = await tableExists('CompanyInfo')
  if (hasCompanyInfo) {
    log('✓ Found CompanyInfo table — will use it as migration source')
  } else {
    log('⚠  No CompanyInfo table found — will create companies from user data')
  }

  // ── Step 1: Load CompanyInfo data (if available) ───────────────
  let companyInfoMap = new Map<string, CompanyInfoRow[]>()
  if (hasCompanyInfo) {
    companyInfoMap = await getCompanyInfos()
    log(`✓ Loaded CompanyInfo for ${companyInfoMap.size} users`)
  }

  // ── Step 2: Get all users ──────────────────────────────────────
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      businessName: true,
      demoModeEnabled: true,
    },
  })
  log(`✓ Found ${users.length} users to process`)
  log('')

  // ── Step 3: Process each user ──────────────────────────────────
  for (const user of users) {
    try {
      await processUser(user, companyInfoMap, summary)
    } catch (err) {
      const msg = `User ${user.email}: ${err instanceof Error ? err.message : String(err)}`
      error(msg)
      summary.errors.push(msg)
    }
  }

  // ── Step 4: Print summary ──────────────────────────────────────
  log('')
  log('═══════════════════════════════════════════════════════════════')
  log('  Migration Summary')
  log('═══════════════════════════════════════════════════════════════')
  log(`  Users processed:  ${summary.usersProcessed}`)
  log(`  Users skipped:    ${summary.usersSkipped} (already migrated)`)
  log(`  Companies created: ${summary.companiesCreated}`)
  log(`  UserCompany links: ${summary.userCompaniesCreated}`)
  log('')
  log('  Records updated:')
  for (const [model, count] of Object.entries(summary.recordsUpdated)) {
    if (count > 0) {
      log(`    ${model}: ${count}`)
    }
  }
  log(`  Sessions updated: ${summary.sessionsUpdated}`)

  if (summary.errors.length > 0) {
    log('')
    log(`  ⚠️  Errors (${summary.errors.length}):`)
    for (const err of summary.errors) {
      log(`    - ${err}`)
    }
  }

  log('')
  log('Migration complete!')
}

async function processUser(
  user: { id: string; email: string; businessName: string | null; demoModeEnabled: boolean },
  companyInfoMap: Map<string, CompanyInfoRow[]>,
  summary: Summary
) {
  log(`Processing user: ${user.email} (${user.id})`)

  // ── Check if already migrated (idempotent) ─────────────────────
  const existingMembership = await db.userCompany.findFirst({
    where: { userId: user.id },
  })

  if (existingMembership) {
    log(`  ⏭  Already has company membership — skipping user creation`)
    summary.usersSkipped++

    // Still check if there are unscoped records for this user
    // (in case migration was partially run before)
    await fixUnscopedRecords(user, summary)
    return
  }

  summary.usersProcessed++

  // ── Determine company data source ──────────────────────────────
  const infos = companyInfoMap.get(user.id) || []
  const liveInfo = infos.find(ci => !ci.isDemo)
  const demoInfo = infos.find(ci => ci.isDemo)

  // Use live info for primary company, fall back to demo
  const primaryInfo = liveInfo || demoInfo

  // ── Create primary (live) Company ──────────────────────────────
  const primaryData = primaryInfo
    ? companyDataFromInfo(primaryInfo, false)
    : companyDataFromUser(user, false)

  const liveCompany = await db.company.create({
    data: primaryData,
  })
  summary.companiesCreated++
  log(`  ✓ Created live Company: "${liveCompany.name}" (${liveCompany.id})`)

  // ── Create UserCompany for live ────────────────────────────────
  await db.userCompany.create({
    data: {
      userId: user.id,
      companyId: liveCompany.id,
      role: 'OWNER',
      invitedBy: null,
    },
  })
  summary.userCompaniesCreated++

  // ── Create demo Company if user has demo CompanyInfo ───────────
  let demoCompanyId: string | null = null
  if (demoInfo && infos.length > 1) {
    // User has both live and demo CompanyInfo — create separate demo company
    const demoData = companyDataFromInfo(demoInfo, true)
    const demoCompany = await db.company.create({
      data: {
        ...demoData,
        name: demoData.name === liveCompany.name
          ? `${demoData.name} (Demo)`
          : demoData.name,
      },
    })
    demoCompanyId = demoCompany.id
    summary.companiesCreated++
    log(`  ✓ Created demo Company: "${demoCompany.name}" (${demoCompany.id})`)

    // UserCompany for demo
    await db.userCompany.create({
      data: {
        userId: user.id,
        companyId: demoCompany.id,
        role: 'OWNER',
        invitedBy: null,
      },
    })
    summary.userCompaniesCreated++
  } else if (!liveInfo && demoInfo) {
    // User only had demo CompanyInfo — the primary company IS the demo one
    // We already created it above as primary. Mark it as demo.
    await db.company.update({
      where: { id: liveCompany.id },
      data: { isDemo: true },
    })
    log(`  ℹ  Primary company marked as demo (no live CompanyInfo found)`)
  }

  // ── Set companyId on all company-scoped records ────────────────
  await assignRecordsToCompany(user.id, liveCompany.id, demoCompanyId, summary)

  // ── Set activeCompanyId on all sessions ────────────────────────
  const sessionResult = await db.session.updateMany({
    where: {
      userId: user.id,
      activeCompanyId: null,
    },
    data: {
      activeCompanyId: liveCompany.id,
    },
  })
  summary.sessionsUpdated += sessionResult.count
  if (sessionResult.count > 0) {
    log(`  ✓ Updated ${sessionResult.count} session(s) with activeCompanyId`)
  }
}

/**
 * Assign companyId to all company-scoped records for a user.
 * - Non-demo records → liveCompanyId
 * - Demo records → demoCompanyId (if available), else liveCompanyId
 */
async function assignRecordsToCompany(
  userId: string,
  liveCompanyId: string,
  demoCompanyId: string | null,
  summary: Summary
) {
  // Models that have both companyId and isDemo fields
  // We split: isDemo=true → demo company, isDemo=false → live company
  const modelsWithDemo: Array<{
    name: string
    updateDemo: () => Promise<number>
    updateLive: () => Promise<number>
  }> = [
    {
      name: 'Transaction',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.transaction.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.transaction.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'Invoice',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.invoice.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.invoice.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'Account',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.account.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.account.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'JournalEntry',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.journalEntry.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.journalEntry.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'Contact',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.contact.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.contact.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'FiscalPeriod',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.fiscalPeriod.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.fiscalPeriod.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'BankStatement',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.bankStatement.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.bankStatement.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'BankConnection',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.bankConnection.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.bankConnection.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'RecurringEntry',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.recurringEntry.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.recurringEntry.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'Budget',
      updateDemo: async () => {
        const targetCompany = demoCompanyId || liveCompanyId
        const r = await db.budget.updateMany({
          where: { userId, isDemo: true, companyId: '' },
          data: { companyId: targetCompany },
        })
        return r.count
      },
      updateLive: async () => {
        const r = await db.budget.updateMany({
          where: { userId, isDemo: false, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
  ]

  // Models without isDemo field — always assign to live company
  const modelsWithoutDemo: Array<{
    name: string
    update: () => Promise<number>
  }> = [
    {
      name: 'Backup',
      update: async () => {
        const r = await db.backup.updateMany({
          where: { userId, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r.count
      },
    },
    {
      name: 'AuditLog',
      update: async () => {
        // AuditLog.companyId is nullable (String?), so check for null OR empty
        const r1 = await db.auditLog.updateMany({
          where: { userId, companyId: null },
          data: { companyId: liveCompanyId },
        })
        const r2 = await db.auditLog.updateMany({
          where: { userId, companyId: '' },
          data: { companyId: liveCompanyId },
        })
        return r1.count + r2.count
      },
    },
  ]

  // Process models with demo split
  for (const model of modelsWithDemo) {
    try {
      const demoCount = await model.updateDemo()
      const liveCount = await model.updateLive()
      const total = demoCount + liveCount
      summary.recordsUpdated[model.name] += total
      if (total > 0) {
        log(`  ✓ ${model.name}: ${liveCount} live, ${demoCount} demo → assigned companyId`)
      }
    } catch (err) {
      const msg = `${model.name} update failed: ${err instanceof Error ? err.message : String(err)}`
      warn(`  ${msg}`)
      summary.errors.push(msg)
    }
  }

  // Process models without demo split
  for (const model of modelsWithoutDemo) {
    try {
      const count = await model.update()
      summary.recordsUpdated[model.name] += count
      if (count > 0) {
        log(`  ✓ ${model.name}: ${count} → assigned companyId`)
      }
    } catch (err) {
      const msg = `${model.name} update failed: ${err instanceof Error ? err.message : String(err)}`
      warn(`  ${msg}`)
      summary.errors.push(msg)
    }
  }
}

/**
 * Fix records that belong to a user but have empty companyId.
 * This handles the case where a previous migration run was interrupted
 * or didn't complete fully.
 */
async function fixUnscopedRecords(
  user: { id: string; email: string; businessName: string | null; demoModeEnabled: boolean },
  summary: Summary
) {
  // Get the user's companies
  const memberships = await db.userCompany.findMany({
    where: { userId: user.id },
    include: { company: { select: { id: true, isDemo: true } } },
  })

  if (memberships.length === 0) return

  const liveCompany = memberships.find(m => !m.company.isDemo)
  const demoCompany = memberships.find(m => m.company.isDemo)

  const liveCompanyId = liveCompany?.companyId || memberships[0].companyId
  const demoCompanyId = demoCompany?.companyId || null

  // Delegate to the same assignment logic
  await assignRecordsToCompany(user.id, liveCompanyId, demoCompanyId, summary)

  // Also fix sessions
  const sessionResult = await db.session.updateMany({
    where: {
      userId: user.id,
      activeCompanyId: null,
    },
    data: {
      activeCompanyId: liveCompanyId,
    },
  })
  summary.sessionsUpdated += sessionResult.count
  if (sessionResult.count > 0) {
    log(`  ✓ Fixed ${sessionResult.count} session(s) with missing activeCompanyId`)
  }
}

// ─── Entry Point ──────────────────────────────────────────────────

migrateToMultiTenant()
  .then(async () => {
    await db.$disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Fatal migration error:', err)
    await db.$disconnect()
    process.exit(1)
  })
