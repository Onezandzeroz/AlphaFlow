import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/session';
import { companyScope, Permission, requirePermission, blockOversightMutation, requireNotDemoCompany } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import JSZip from 'jszip';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// POST /api/import-tenant — Restore tenant data from a previously exported ZIP snapshot
// Version 2: complete field coverage, journal documents, team members, file restoration
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx || !ctx.activeCompanyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    const denied = requirePermission(ctx, Permission.DATA_CREATE);
    if (denied) return denied;

    const companyId = ctx.activeCompanyId;
    const userId = ctx.id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('snapshot') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided. Use field name "snapshot".' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a .zip file.' }, { status: 400 });
    }

    // Allow up to 500MB for snapshots with files
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 500 MB.' }, { status: 400 });
    }

    // Read and parse ZIP
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    // Read manifest
    const manifestRaw = zip.file('manifest.json');
    if (!manifestRaw) {
      return NextResponse.json({ error: 'Invalid snapshot: missing manifest.json' }, { status: 400 });
    }
    const manifest = JSON.parse(await manifestRaw.async('string'));
    if (!manifest.version || !manifest.companyName) {
      return NextResponse.json({ error: 'Invalid snapshot: manifest is missing required fields.' }, { status: 400 });
    }

    // Read all JSON data files
    const readJson = async (name: string) => {
      const f = zip.file(`${name}.json`);
      if (!f) return [];
      return JSON.parse(await f.async('string'));
    };

    const companyData = zip.file('company.json')
      ? JSON.parse(await zip.file('company.json')!.async('string'))
      : null;
    const accounts = await readJson('accounts');
    const contacts = await readJson('contacts');
    const transactions = await readJson('transactions');
    const invoices = await readJson('invoices');
    const journalEntries = await readJson('journal-entries');
    const fiscalPeriods = await readJson('fiscal-periods');
    const budgets = await readJson('budgets');
    const recurringEntries = await readJson('recurring-entries');
    const bankStatements = await readJson('bank-statements');
    const members = await readJson('members');

    // ─── Build file data map from zip (files stored under files/ prefix) ───
    // Collect all files in the zip that start with "files/"
    const filePathsInZip: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith('files/') && !zipEntry.dir) {
        const storedPath = relativePath.slice('files/'.length);
        if (storedPath) {
          filePathsInZip.push(storedPath);
        }
      }
    });

    // Read file contents from zip
    const filesData = new Map<string, Buffer>();
    if (filePathsInZip.length > 0) {
      for (const storedPath of filePathsInZip) {
        try {
          const zipEntry = zip.file(`files/${storedPath}`);
          if (zipEntry) {
            const data = await zipEntry.async('nodebuffer');
            filesData.set(storedPath, data);
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    // ─── Build path remapping: old userId paths → new userId paths ───
    // On import, all files should belong to the importing user.
    // Old paths like "documents/{oldUserId}/{file}" → "documents/{newUserId}/{file}"
    // Old paths like "receipts/{oldUserId}/{file}" → "receipts/{newUserId}/{file}"
    const remapFilePath = (oldPath: string | null): string | null => {
      if (!oldPath) return null;
      // Match "documents/{anyUserId}/" or "receipts/{anyUserId}/"
      return oldPath.replace(
        /^(documents|receipts)\/[^/]+\//,
        `$1/${userId}/`
      );
    };

    // ─── PHASE 1: Delete all existing tenant data (respecting FK order) ───
    const scope = { companyId };

    await db.bankStatementLine.deleteMany({
      where: { bankStatement: { companyId } },
    });
    await db.bankStatement.deleteMany({ where: scope });
    await db.document.deleteMany({
      where: { journalEntry: { companyId } },
    });
    await db.journalEntryLine.deleteMany({
      where: { journalEntry: { companyId } },
    });
    await db.journalEntry.deleteMany({ where: scope });
    await db.budgetEntry.deleteMany({
      where: { budget: { companyId } },
    });
    await db.budget.deleteMany({ where: scope });
    await db.transaction.deleteMany({ where: scope });
    await db.invoice.deleteMany({ where: scope });
    await db.contact.deleteMany({ where: scope });
    await db.account.deleteMany({ where: scope });
    await db.fiscalPeriod.deleteMany({ where: scope });
    await db.recurringEntry.deleteMany({ where: scope });

    // ─── PHASE 2: Update company settings ───
    if (companyData) {
      await db.company.update({
        where: { id: companyId },
        data: {
          name: companyData.name || undefined,
          logo: companyData.logo ?? undefined,
          address: companyData.address ?? '',
          phone: companyData.phone ?? '',
          email: companyData.email ?? '',
          cvrNumber: companyData.cvrNumber ?? '',
          companyType: companyData.companyType ?? undefined,
          invoicePrefix: companyData.invoicePrefix ?? 'INV',
          invoiceTerms: companyData.invoiceTerms ?? undefined,
          invoiceNotesTemplate: companyData.invoiceNotesTemplate ?? undefined,
          nextInvoiceSequence: companyData.nextInvoiceSequence ?? 1,
          currentYear: companyData.currentYear ?? new Date().getFullYear(),
          bankName: companyData.bankName ?? '',
          bankAccount: companyData.bankAccount ?? '',
          bankRegistration: companyData.bankRegistration ?? '',
          bankIban: companyData.bankIban ?? undefined,
          bankStreet: companyData.bankStreet ?? undefined,
          bankCity: companyData.bankCity ?? undefined,
          bankCountry: companyData.bankCountry ?? undefined,
          dashboardWidgets: companyData.dashboardWidgets ?? undefined,
        },
      });
    }

    // ─── PHASE 3: Build ID reference maps (old _ref → new id) ───
    const accountMap = new Map<string, string>();
    const contactMap = new Map<string, string>();
    const invoiceMap = new Map<string, string>();

    // ─── PHASE 4: Import Accounts ───
    for (const a of accounts) {
      const created = await db.account.create({
        data: {
          number: a.number,
          name: a.name,
          nameEn: a.nameEn ?? undefined,
          type: a.type,
          group: a.group,
          description: a.description ?? undefined,
          isActive: a.isActive ?? true,
          isSystem: a.isSystem ?? false,
          isDemo: false,
          userId,
          companyId,
        },
      });
      if (a._ref) accountMap.set(a._ref, created.id);
    }

    // ─── PHASE 5: Import Contacts ───
    for (const c of contacts) {
      const created = await db.contact.create({
        data: {
          name: c.name,
          cvrNumber: c.cvrNumber ?? undefined,
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          address: c.address ?? undefined,
          city: c.city ?? undefined,
          postalCode: c.postalCode ?? undefined,
          country: c.country ?? 'Danmark',
          type: c.type || 'CUSTOMER',
          notes: c.notes ?? undefined,
          isActive: c.isActive ?? true,
          isDemo: false,
          userId,
          companyId,
        },
      });
      if (c._ref) contactMap.set(c._ref, created.id);
    }

    // ─── PHASE 6: Import Fiscal Periods ───
    for (const fp of fiscalPeriods) {
      await db.fiscalPeriod.upsert({
        where: {
          companyId_year_month_isDemo: {
            companyId,
            year: fp.year,
            month: fp.month,
            isDemo: false,
          },
        },
        create: {
          year: fp.year,
          month: fp.month,
          status: fp.status || 'OPEN',
          lockedAt: fp.lockedAt ? new Date(fp.lockedAt) : undefined,
          lockedBy: fp.lockedBy ?? undefined,
          isDemo: false,
          userId,
          companyId,
        },
        update: {
          status: fp.status || 'OPEN',
          lockedAt: fp.lockedAt ? new Date(fp.lockedAt) : undefined,
          lockedBy: fp.lockedBy ?? undefined,
        },
      });
    }

    // ─── PHASE 7: Import Invoices ───
    for (const inv of invoices) {
      const issueDate = inv.issueDate || inv.date;
      const created = await db.invoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          customerAddress: inv.customerAddress ?? undefined,
          customerEmail: inv.customerEmail ?? undefined,
          customerPhone: inv.customerPhone ?? undefined,
          customerCvr: inv.customerCvr ?? undefined,
          issueDate: new Date(issueDate),
          dueDate: new Date(inv.dueDate),
          lineItems: typeof inv.lineItems === 'string' ? inv.lineItems : JSON.stringify(inv.lineItems),
          subtotal: inv.subtotal,
          vatTotal: inv.vatTotal,
          total: inv.total,
          currency: inv.currency || 'DKK',
          exchangeRate: inv.exchangeRate ?? undefined,
          status: inv.status || 'DRAFT',
          notes: inv.notes ?? undefined,
          contactId: inv.contactId ? (contactMap.get(inv.contactId) ?? null) : null,
          cancelled: inv.cancelled ?? false,
          cancelReason: inv.cancelReason ?? undefined,
          isDemo: false,
          userId,
          companyId,
        },
      });
      if (inv._ref) invoiceMap.set(inv._ref, created.id);
    }

    // ─── PHASE 8: Import Transactions (with receipt image path remapping) ───
    for (const t of transactions) {
      // Remap receipt image path to new user directory
      const remappedReceiptImage = remapFilePath(t.receiptImage ?? null);

      await db.transaction.create({
        data: {
          date: new Date(t.date),
          type: t.type || 'SALE',
          amount: t.amount,
          currency: t.currency || 'DKK',
          exchangeRate: t.exchangeRate ?? undefined,
          amountDKK: t.amountDKK ?? undefined,
          description: t.description,
          vatPercent: t.vatPercent ?? 25.0,
          receiptImage: remappedReceiptImage,
          invoiceId: t.invoiceId ? (invoiceMap.get(t.invoiceId) ?? null) : null,
          accountId: t.accountId ? (accountMap.get(t.accountId) ?? null) : null,
          cancelled: t.cancelled ?? false,
          cancelReason: t.cancelReason ?? undefined,
          originalId: t.originalId ?? undefined,
          isDemo: false,
          userId,
          companyId,
        },
      });
    }

    // ─── PHASE 9: Import Journal Entries + Lines + Documents ───
    let filesRestored = 0;
    let filesSkipped = 0;

    for (const je of journalEntries) {
      const entry = await db.journalEntry.create({
        data: {
          date: new Date(je.date),
          description: je.description,
          reference: je.reference ?? undefined,
          status: je.status || 'POSTED',
          cancelled: je.cancelled ?? false,
          cancelReason: je.cancelReason ?? undefined,
          isDemo: false,
          userId,
          companyId,
        },
      });

      if (Array.isArray(je.lines)) {
        for (const line of je.lines) {
          const resolvedAccountId = line.accountId ? (accountMap.get(line.accountId) ?? null) : null;
          if (!resolvedAccountId) continue; // Skip lines without valid account
          await db.journalEntryLine.create({
            data: {
              journalEntryId: entry.id,
              accountId: resolvedAccountId,
              debit: line.debit ?? 0,
              credit: line.credit ?? 0,
              vatCode: line.vatCode ?? undefined,
              description: line.description ?? undefined,
            },
          });
        }
      }

      // Create documents and restore actual files
      if (Array.isArray(je.documents)) {
        for (const doc of je.documents) {
          const oldPath = doc.filePath ?? '';
          const newPath = remapFilePath(oldPath) ?? '';

          // Restore the actual file if present in the zip
          if (filesData.size > 0 && oldPath && filesData.has(oldPath)) {
            try {
              const absPath = path.join(process.cwd(), 'uploads', newPath);
              const dir = path.dirname(absPath);
              await mkdir(dir, { recursive: true });
              const fileBuffer = filesData.get(oldPath)!;
              await writeFile(absPath, fileBuffer);
              filesRestored++;
            } catch (err) {
              logger.warn(`Failed to restore file ${oldPath}:`, err);
              filesSkipped++;
            }
          } else if (filesData.size > 0 && oldPath) {
            filesSkipped++;
          }

          await db.document.create({
            data: {
              journalEntryId: entry.id,
              fileName: doc.fileName || 'unknown',
              fileType: doc.fileType || 'application/octet-stream',
              fileSize: doc.fileSize ?? 0,
              filePath: newPath,
              description: doc.description ?? undefined,
            },
          });
        }
      }
    }

    // ─── PHASE 10: Restore receipt image files from transactions ───
    if (filesData.size > 0) {
      for (const t of transactions) {
        const oldReceiptPath = t.receiptImage ?? '';
        if (!oldReceiptPath) continue;

        // Already restored if this path was handled in document phase
        // Receipts are separate from documents, check explicitly
        if (!oldReceiptPath.startsWith('receipts/')) continue;

        try {
          const newReceiptPath = remapFilePath(oldReceiptPath) ?? '';
          const absPath = path.join(process.cwd(), 'uploads', newReceiptPath);
          const dir = path.dirname(absPath);
          await mkdir(dir, { recursive: true });

          if (filesData.has(oldReceiptPath)) {
            const fileBuffer = filesData.get(oldReceiptPath)!;
            await writeFile(absPath, fileBuffer);
            filesRestored++;
          }
        } catch (err) {
          logger.warn(`Failed to restore receipt ${oldReceiptPath}:`, err);
          filesSkipped++;
        }
      }
    }

    // ─── PHASE 11: Import Budgets + Entries ───
    for (const b of budgets) {
      const budget = await db.budget.upsert({
        where: {
          companyId_year_isDemo: {
            companyId,
            year: b.year,
            isDemo: false,
          },
        },
        create: {
          name: b.name,
          year: b.year,
          notes: b.notes ?? undefined,
          isActive: b.isActive ?? true,
          isDemo: false,
          userId,
          companyId,
        },
        update: {
          name: b.name,
          notes: b.notes ?? undefined,
          isActive: b.isActive ?? true,
        },
      });

      if (Array.isArray(b.entries)) {
        for (const e of b.entries) {
          let newAccountId: string | undefined;
          if (e.accountNumber) {
            const accountRef = accounts.find((a) => a.number === e.accountNumber)?._ref;
            if (accountRef) {
              newAccountId = accountMap.get(accountRef) ?? undefined;
            }
          }

          if (e.accountNumber && !newAccountId) continue;

          await db.budgetEntry.upsert({
            where: {
              budgetId_accountId: {
                budgetId: budget.id,
                accountId: newAccountId || '__none__',
              },
            },
            create: {
              budgetId: budget.id,
              accountId: newAccountId || '__none__',
              january: e.january ?? 0,
              february: e.february ?? 0,
              march: e.march ?? 0,
              april: e.april ?? 0,
              may: e.may ?? 0,
              june: e.june ?? 0,
              july: e.july ?? 0,
              august: e.august ?? 0,
              september: e.september ?? 0,
              october: e.october ?? 0,
              november: e.november ?? 0,
              december: e.december ?? 0,
            },
            update: {
              january: e.january ?? 0,
              february: e.february ?? 0,
              march: e.march ?? 0,
              april: e.april ?? 0,
              may: e.may ?? 0,
              june: e.june ?? 0,
              july: e.july ?? 0,
              august: e.august ?? 0,
              september: e.september ?? 0,
              october: e.october ?? 0,
              november: e.november ?? 0,
              december: e.december ?? 0,
            },
          }).catch(() => {
            // Ignore budget entry upsert errors
          });
        }
      }
    }

    // ─── PHASE 12: Import Recurring Entries ───
    for (const re of recurringEntries) {
      await db.recurringEntry.create({
        data: {
          name: re.name,
          description: re.description,
          frequency: re.frequency || 'MONTHLY',
          status: re.status || 'ACTIVE',
          startDate: new Date(re.startDate),
          endDate: re.endDate ? new Date(re.endDate) : undefined,
          nextExecution: re.nextExecution ? new Date(re.nextExecution) : new Date(),
          lastExecuted: re.lastExecuted ? new Date(re.lastExecuted) : undefined,
          lines: typeof re.lines === 'string' ? re.lines : JSON.stringify(re.lines),
          reference: re.reference ?? undefined,
          isDemo: false,
          userId,
          companyId,
        },
      });
    }

    // ─── PHASE 13: Import Bank Statements + Lines ───
    for (const bs of bankStatements) {
      const statement = await db.bankStatement.create({
        data: {
          bankAccount: bs.bankAccount,
          startDate: new Date(bs.startDate),
          endDate: new Date(bs.endDate),
          openingBalance: bs.openingBalance,
          closingBalance: bs.closingBalance,
          fileName: bs.fileName ?? undefined,
          importSource: bs.importSource ?? undefined,
          reconciled: bs.reconciled ?? false,
          reconciledAt: bs.reconciledAt ? new Date(bs.reconciledAt) : undefined,
          isDemo: false,
          userId,
          companyId,
        },
      });

      if (Array.isArray(bs.lines)) {
        for (const line of bs.lines) {
          await db.bankStatementLine.create({
            data: {
              bankStatementId: statement.id,
              date: new Date(line.date),
              description: line.description,
              reference: line.reference ?? undefined,
              amount: line.amount,
              balance: line.balance,
              reconciliationStatus: line.reconciliationStatus || 'UNMATCHED',
            },
          });
        }
      }
    }

    // ─── PHASE 14: Restore Team Members (UserCompany) ───
    let restoredMembers = 0;
    if (Array.isArray(members) && members.length > 0) {
      for (const m of members) {
        if (!m.email) continue;

        const existingUser = await db.user.findUnique({
          where: { email: m.email },
          select: { id: true },
        });
        if (!existingUser) continue;

        await db.userCompany.upsert({
          where: {
            userId_companyId: {
              userId: existingUser.id,
              companyId,
            },
          },
          create: {
            userId: existingUser.id,
            companyId,
            role: m.role || 'VIEWER',
            invitedBy: m.invitedBy ?? undefined,
          },
          update: {
            role: m.role || 'VIEWER',
          },
        });
        restoredMembers++;
      }
    }

    // Ensure importing user always has access
    await db.userCompany.upsert({
      where: {
        userId_companyId: { userId, companyId },
      },
      create: {
        userId,
        companyId,
        role: 'OWNER',
      },
      update: {},
    });

    const importedCounts = {
      accounts: accounts.length,
      contacts: contacts.length,
      transactions: transactions.length,
      invoices: invoices.length,
      journalEntries: journalEntries.length,
      fiscalPeriods: fiscalPeriods.length,
      budgets: budgets.length,
      recurringEntries: recurringEntries.length,
      bankStatements: bankStatements.length,
      members: restoredMembers,
      ...(filesData.size > 0 ? {
        filesRestored,
        filesSkipped,
      } : {}),
    };

    return NextResponse.json({
      success: true,
      message: 'Tenant data restored successfully',
      sourceCompany: manifest.companyName,
      exportedAt: manifest.exportedAt,
      imported: importedCounts,
      filesIncluded: manifest.includeFiles || false,
      filesRestored,
      filesSkipped,
    });
  } catch (error) {
    logger.error('Import tenant data failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to import tenant data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
